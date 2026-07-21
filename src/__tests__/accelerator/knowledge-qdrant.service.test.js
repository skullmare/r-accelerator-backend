// Как и qdrant.service.test.js, здесь qdrant.service.js НЕ мокается —
// проверяется его настоящий код для knowledge-контура: knowledgeId-гварды и
// сборка Qdrant-фильтров. Мокаются только Qdrant-клиент (in-memory движок с
// реальной cosine-similarity и применением фильтров) и embedding.service.js.

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

    return {
        qdrantClient,
        QDRANT_COLLECTION: 'expert_context_test',
        QDRANT_KNOWLEDGE_COLLECTION: 'knowledge_context_test'
    };
});

jest.mock('../../services/embedding.service.js', () => {
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
import { searchKnowledge, upsertKnowledgeChunks, deleteByKnowledge } from '../../services/qdrant.service.js';

const KNOWLEDGE_A = '507f1f77bcf86cd799439011';
const KNOWLEDGE_B = '507f1f77bcf86cd799439022';

afterEach(() => {
    jest.clearAllMocks();
});

describe('qdrant.service — knowledge-контур: обязательность knowledgeId(s)', () => {
    it('upsertKnowledgeChunks кидает ошибку без knowledgeId', async () => {
        await expect(upsertKnowledgeChunks({
            chunks: [{ chunkIndex: 0, text: 'текст', textHash: 'h' }]
        })).rejects.toThrow(/knowledgeId/);
    });

    it('deleteByKnowledge кидает ошибку без knowledgeId', async () => {
        await expect(deleteByKnowledge()).rejects.toThrow(/knowledgeId/);
    });

    it('searchKnowledge возвращает [] при пустом списке knowledgeIds (агенту ничего не привязано) и НЕ ходит в Qdrant', async () => {
        const empty = await searchKnowledge({ knowledgeIds: [], queryText: 'что угодно', topK: 5 });
        expect(empty).toEqual([]);
        expect(qdrantClient.search).not.toHaveBeenCalled();
    });
});

describe('qdrant.service — knowledge-контур: изоляция по knowledgeId', () => {
    it('поиск возвращает только те knowledge, что переданы в knowledgeIds (чужие с идентичным текстом не попадают)', async () => {
        const sameText = 'Общая методичка по юнит-экономике';

        await upsertKnowledgeChunks({
            knowledgeId: KNOWLEDGE_A,
            chunks: [{ chunkIndex: 0, text: sameText, textHash: 'ha' }]
        });
        await upsertKnowledgeChunks({
            knowledgeId: KNOWLEDGE_B,
            chunks: [{ chunkIndex: 0, text: sameText, textHash: 'hb' }]
        });

        const resultsForA = await searchKnowledge({
            knowledgeIds: [KNOWLEDGE_A],
            queryText: sameText,
            topK: 10
        });

        expect(resultsForA.length).toBeGreaterThan(0);
        expect(resultsForA.every((hit) => hit.payload.knowledgeId === KNOWLEDGE_A)).toBe(true);
        expect(resultsForA.some((hit) => hit.payload.knowledgeId === KNOWLEDGE_B)).toBe(false);
    });

    it('поиск по нескольким knowledgeIds возвращает оба', async () => {
        await upsertKnowledgeChunks({ knowledgeId: KNOWLEDGE_A, chunks: [{ chunkIndex: 0, text: 'A-текст', textHash: 'ha' }] });
        await upsertKnowledgeChunks({ knowledgeId: KNOWLEDGE_B, chunks: [{ chunkIndex: 0, text: 'B-текст', textHash: 'hb' }] });

        const results = await searchKnowledge({
            knowledgeIds: [KNOWLEDGE_A, KNOWLEDGE_B],
            queryText: 'A-текст',
            topK: 10
        });

        const ids = new Set(results.map((r) => r.payload.knowledgeId));
        expect(ids.has(KNOWLEDGE_A)).toBe(true);
        expect(ids.has(KNOWLEDGE_B)).toBe(true);
    });

    it('deleteByKnowledge удаляет только точки указанной knowledge', async () => {
        await upsertKnowledgeChunks({ knowledgeId: KNOWLEDGE_A, chunks: [{ chunkIndex: 0, text: 'A', textHash: 'ha' }] });
        await upsertKnowledgeChunks({ knowledgeId: KNOWLEDGE_B, chunks: [{ chunkIndex: 0, text: 'B', textHash: 'hb' }] });

        await deleteByKnowledge(KNOWLEDGE_A);

        const a = await searchKnowledge({ knowledgeIds: [KNOWLEDGE_A], queryText: 'A', topK: 10 });
        expect(a.length).toBe(0);

        const b = await searchKnowledge({ knowledgeIds: [KNOWLEDGE_B], queryText: 'B', topK: 10 });
        expect(b.some((hit) => hit.payload.knowledgeId === KNOWLEDGE_B)).toBe(true);
    });

    it('пишет в отдельную knowledge-коллекцию, а не в проектную', async () => {
        await upsertKnowledgeChunks({ knowledgeId: KNOWLEDGE_A, chunks: [{ chunkIndex: 0, text: 'X', textHash: 'h' }] });
        expect(qdrantClient.upsert).toHaveBeenCalledWith('knowledge_context_test', expect.any(Object));
    });
});
