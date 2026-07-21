import { connect, closeDatabase, clearDatabase } from '../setup.js';
import Knowledge from '../../models/accelerator/knowledge.model.js';

jest.mock('../../services/qdrant.service.js', () => ({
    upsertKnowledgeChunks: jest.fn().mockResolvedValue(['kp-1']),
    deleteByKnowledge: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../services/knowledge-processing/load-source.js', () => ({
    loadKnowledgeSource: jest.fn()
}));

jest.mock('../../services/knowledge-processing/extract-from-buffer.js', () => ({
    extractChunksFromBuffer: jest.fn()
}));

import { upsertKnowledgeChunks, deleteByKnowledge } from '../../services/qdrant.service.js';
import { loadKnowledgeSource } from '../../services/knowledge-processing/load-source.js';
import { extractChunksFromBuffer } from '../../services/knowledge-processing/extract-from-buffer.js';
import { processKnowledge } from '../../services/knowledge-processing/process-knowledge.job.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
});

async function createKnowledge(overrides = {}) {
    return Knowledge.create({
        title: 'Методичка',
        sourceUrl: 'https://example.com/doc.pdf',
        status: 'pending',
        ...overrides
    });
}

describe('processKnowledge', () => {
    it('индексирует поддерживаемый источник и проставляет indexed + chunksCount', async () => {
        loadKnowledgeSource.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'application/pdf' });
        extractChunksFromBuffer.mockResolvedValue([
            { chunkIndex: 0, text: 'hello', textHash: 'h0' },
            { chunkIndex: 1, text: 'world', textHash: 'h1' }
        ]);

        const knowledge = await createKnowledge();
        await processKnowledge({ knowledgeId: String(knowledge._id) });

        const updated = await Knowledge.findById(knowledge._id);
        expect(updated.status).toBe('indexed');
        expect(updated.chunksCount).toBe(2);
        expect(updated.qdrantPointIds).toEqual(['kp-1']);
        expect(updated.sourceMimeType).toBe('application/pdf');
        expect(updated.textHash).toEqual(expect.any(String));
        expect(updated.indexedAt).not.toBeNull();
        expect(deleteByKnowledge).toHaveBeenCalledWith(String(knowledge._id));
        expect(upsertKnowledgeChunks).toHaveBeenCalledWith(expect.objectContaining({
            knowledgeId: String(knowledge._id)
        }));
    });

    it('помечает unsupported, если формат без экстрактора (extract вернул null)', async () => {
        loadKnowledgeSource.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'application/zip' });
        extractChunksFromBuffer.mockResolvedValue(null);

        const knowledge = await createKnowledge();
        await processKnowledge({ knowledgeId: String(knowledge._id) });

        const updated = await Knowledge.findById(knowledge._id);
        expect(updated.status).toBe('unsupported');
        expect(updated.chunksCount).toBe(0);
        expect(upsertKnowledgeChunks).not.toHaveBeenCalled();
    });

    it('пустой текст: indexed с 0 чанков', async () => {
        loadKnowledgeSource.mockResolvedValue({ buffer: Buffer.from(''), mimeType: 'text/plain' });
        extractChunksFromBuffer.mockResolvedValue([]);

        const knowledge = await createKnowledge();
        await processKnowledge({ knowledgeId: String(knowledge._id) });

        const updated = await Knowledge.findById(knowledge._id);
        expect(updated.status).toBe('indexed');
        expect(updated.chunksCount).toBe(0);
        expect(updated.qdrantPointIds).toEqual([]);
        expect(upsertKnowledgeChunks).not.toHaveBeenCalled();
    });

    it('сбой скачивания источника: failed + processingErrorCode=SOURCE_FETCH_FAILED', async () => {
        const err = new Error('404');
        err.code = 'SOURCE_FETCH_FAILED';
        loadKnowledgeSource.mockRejectedValue(err);

        const knowledge = await createKnowledge();
        await expect(processKnowledge({ knowledgeId: String(knowledge._id) })).rejects.toThrow('404');

        const updated = await Knowledge.findById(knowledge._id);
        expect(updated.status).toBe('failed');
        expect(updated.processingErrorCode).toBe('SOURCE_FETCH_FAILED');
    });

    it('сбой записи в Qdrant: failed + processingErrorCode=QDRANT_INDEX_FAILED', async () => {
        loadKnowledgeSource.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'text/plain' });
        extractChunksFromBuffer.mockResolvedValue([{ chunkIndex: 0, text: 'hello', textHash: 'h0' }]);
        upsertKnowledgeChunks.mockRejectedValueOnce(new Error('Qdrant недоступен'));

        const knowledge = await createKnowledge();
        await expect(processKnowledge({ knowledgeId: String(knowledge._id) })).rejects.toThrow('Qdrant недоступен');

        const updated = await Knowledge.findById(knowledge._id);
        expect(updated.status).toBe('failed');
        expect(updated.processingErrorCode).toBe('QDRANT_INDEX_FAILED');
    });
});
