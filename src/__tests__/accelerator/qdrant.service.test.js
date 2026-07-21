// В отличие от других тестов, здесь qdrant.service.js НЕ мокается —
// проверяется его настоящий код (projectId-гварды, сборка Qdrant-фильтров).
// Мокаются только его внешние зависимости: сам Qdrant-клиент (заменён на
// компактный in-memory движок с реальной cosine-similarity и реальным
// применением фильтров) и embedding.service.js (детерминированный
// псевдо-эмбеддинг вместо вызова OpenAI).

jest.mock('../../../config/qdrant.config.js', () => {
    function cosineSim(a, b) {
        let dot = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
    }

    function matchesFilter(point, filter) {
        if (!filter?.must) return true;
        return filter.must.every((cond) => {
            const value = point.payload[cond.key];
            if (cond.match?.value !== undefined) return value === cond.match.value;
            if (cond.match?.any !== undefined) return cond.match.any.includes(value);
            return true;
        });
    }

    const collections = new Map();

    const qdrantClient = {
        getCollections: jest.fn(async () => ({
            collections: [...collections.keys()].map((name) => ({ name }))
        })),
        createCollection: jest.fn(async (name) => {
            if (!collections.has(name)) collections.set(name, new Map());
        }),
        upsert: jest.fn(async (name, { points }) => {
            if (!collections.has(name)) collections.set(name, new Map());
            const store = collections.get(name);
            for (const point of points) store.set(point.id, point);
        }),
        delete: jest.fn(async (name, { filter }) => {
            const store = collections.get(name);
            if (!store) return;
            for (const [id, point] of store) {
                if (matchesFilter(point, filter)) store.delete(id);
            }
        }),
        search: jest.fn(async (name, { vector, limit, filter }) => {
            const store = collections.get(name) || new Map();
            return [...store.values()]
                .filter((point) => matchesFilter(point, filter))
                .map((point) => ({ score: cosineSim(vector, point.vector), payload: point.payload }))
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        })
    };

    return { qdrantClient, QDRANT_COLLECTION: 'expert_context_test' };
});

jest.mock('../../services/embedding.service.js', () => {
    // Детерминированный псевдо-эмбеддинг: одинаковый текст -> одинаковый
    // вектор, разный текст -> разный вектор. Специально НЕ идёт в OpenAI.
    function fakeVector(text) {
        const dim = 8;
        const vector = new Array(dim).fill(0);
        for (let i = 0; i < text.length; i++) {
            vector[i % dim] += text.charCodeAt(i);
        }
        const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
        return vector.map((v) => v / norm);
    }

    return {
        embedTexts: jest.fn(async (texts) => texts.map(fakeVector)),
        embedText: jest.fn(async (text) => fakeVector(text))
    };
});

import { qdrantClient } from '../../../config/qdrant.config.js';
import { searchContext, upsertChunks, deleteBySource } from '../../services/qdrant.service.js';

const PROJECT_A = '507f1f77bcf86cd799439011';
const PROJECT_B = '507f1f77bcf86cd799439022';

afterEach(() => {
    jest.clearAllMocks();
});

describe('qdrant.service — обязательность projectId', () => {
    it('searchContext кидает ошибку без projectId', async () => {
        await expect(searchContext({ sourceTypes: ['file_chunk'], queryText: 'текст', topK: 5 }))
            .rejects.toThrow(/projectId/);
    });

    it('upsertChunks кидает ошибку без projectId', async () => {
        await expect(upsertChunks({
            sourceType: 'file_chunk',
            sourceId: 'file-1',
            chunks: [{ chunkIndex: 0, text: 'текст', textHash: 'h' }]
        })).rejects.toThrow(/projectId/);
    });

    it('deleteBySource кидает ошибку без projectId', async () => {
        await expect(deleteBySource('file-1')).rejects.toThrow(/projectId/);
    });
});

describe('qdrant.service — изоляция между проектами (SEC-6/QDR-3)', () => {
    it('чужие фрагменты с ИДЕНТИЧНЫМ текстом (и значит идентичным вектором) не попадают в результат поиска другого проекта', async () => {
        // Одинаковый текст в двух разных проектах -> одинаковый fake-вектор
        // -> без фильтра по projectId оба фрагмента были бы top-match с
        // одинаковым score. Это специально сделано, чтобы тест доказывал
        // именно работу фильтра, а не то, что "чужой текст менее похож".
        const sensitiveText = 'Секретная бизнес-стратегия конкурента';

        await upsertChunks({
            projectId: PROJECT_A,
            sourceType: 'file_chunk',
            sourceId: 'file-a',
            chunks: [{ chunkIndex: 0, text: sensitiveText, textHash: 'hash-a' }]
        });
        await upsertChunks({
            projectId: PROJECT_B,
            sourceType: 'file_chunk',
            sourceId: 'file-b',
            chunks: [{ chunkIndex: 0, text: sensitiveText, textHash: 'hash-b' }]
        });

        const resultsForA = await searchContext({
            projectId: PROJECT_A,
            sourceTypes: ['file_chunk'],
            queryText: sensitiveText,
            topK: 10
        });

        expect(resultsForA.length).toBeGreaterThan(0);
        expect(resultsForA.every((hit) => hit.payload.projectId === PROJECT_A)).toBe(true);
        expect(resultsForA.some((hit) => hit.payload.sourceId === 'file-b')).toBe(false);

        const resultsForB = await searchContext({
            projectId: PROJECT_B,
            sourceTypes: ['file_chunk'],
            queryText: sensitiveText,
            topK: 10
        });

        expect(resultsForB.every((hit) => hit.payload.projectId === PROJECT_B)).toBe(true);
        expect(resultsForB.some((hit) => hit.payload.sourceId === 'file-a')).toBe(false);
    });

    it('передаёт projectId-фильтр в реальный вызов qdrantClient.search', async () => {
        await upsertChunks({
            projectId: PROJECT_A,
            sourceType: 'file_chunk',
            sourceId: 'file-a',
            chunks: [{ chunkIndex: 0, text: 'что угодно', textHash: 'h' }]
        });

        await searchContext({ projectId: PROJECT_A, sourceTypes: ['file_chunk'], queryText: 'что угодно', topK: 5 });

        expect(qdrantClient.search).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                filter: expect.objectContaining({
                    must: expect.arrayContaining([{ key: 'projectId', match: { value: PROJECT_A } }])
                })
            })
        );
    });

    it('deleteBySource не удаляет чужие точки при совпадении sourceId', async () => {
        await upsertChunks({
            projectId: PROJECT_A,
            sourceType: 'file_chunk',
            sourceId: 'shared-source-id',
            chunks: [{ chunkIndex: 0, text: 'A', textHash: 'ha' }]
        });
        await upsertChunks({
            projectId: PROJECT_B,
            sourceType: 'file_chunk',
            sourceId: 'shared-source-id',
            chunks: [{ chunkIndex: 0, text: 'B', textHash: 'hb' }]
        });

        await deleteBySource('shared-source-id', PROJECT_A);

        const resultsForB = await searchContext({
            projectId: PROJECT_B,
            sourceTypes: ['file_chunk'],
            queryText: 'B',
            topK: 10
        });
        expect(resultsForB.some((hit) => hit.payload.sourceId === 'shared-source-id')).toBe(true);

        const resultsForA = await searchContext({
            projectId: PROJECT_A,
            sourceTypes: ['file_chunk'],
            queryText: 'A',
            topK: 10
        });
        expect(resultsForA.some((hit) => hit.payload.sourceId === 'shared-source-id')).toBe(false);
    });
});
