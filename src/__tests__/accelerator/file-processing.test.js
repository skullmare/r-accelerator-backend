import { connect, closeDatabase, clearDatabase } from '../setup.js';
import File from '../../models/file.model.js';

jest.mock('../../services/qdrant.service.js', () => ({
    upsertChunks: jest.fn().mockResolvedValue(['point-1']),
    deleteBySource: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../services/file-processing/extractors/index.js', () => ({
    getExtractor: jest.fn()
}));

import { upsertChunks, deleteBySource } from '../../services/qdrant.service.js';
import { getExtractor } from '../../services/file-processing/extractors/index.js';
import { processFile } from '../../services/file-processing/process-file.job.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
});

async function createFile(overrides = {}) {
    return File.create({
        name: 'notes.txt',
        url: 'https://storage.yandexcloud.net/bucket/notes.txt',
        key: 'notes.txt',
        type: 'text/plain',
        size: 100,
        uploadedBy: '507f1f77bcf86cd799439011',
        source: 'user',
        projectId: '507f1f77bcf86cd799439012',
        ...overrides
    });
}

describe('processFile', () => {
    it('индексирует поддерживаемый файл и записывает qdrantPointIds', async () => {
        getExtractor.mockReturnValue(async function* extract() {
            yield { chunkIndex: 0, text: 'hello world', textHash: 'h0' };
            yield { chunkIndex: 1, text: 'more text', textHash: 'h1' };
        });

        const file = await createFile();
        await processFile({ fileId: String(file._id) });

        const updated = await File.findById(file._id);
        expect(updated.processingStatus).toBe('indexed');
        expect(updated.extractedTextStatus).toBe('success');
        expect(updated.qdrantStatus).toBe('indexed');
        expect(updated.qdrantPointIds).toEqual(['point-1']);
        expect(updated.textHash).toEqual(expect.any(String));
        expect(updated.indexedAt).not.toBeNull();
        expect(upsertChunks).toHaveBeenCalledWith(expect.objectContaining({
            projectId: file.projectId,
            sourceType: 'file_chunk',
            sourceId: String(file._id)
        }));
        expect(deleteBySource).toHaveBeenCalledWith(String(file._id), file.projectId);
    });

    it('помечает файл unsupported, если для mimetype нет экстрактора', async () => {
        getExtractor.mockReturnValue(null);

        const file = await createFile({ type: 'application/zip' });
        await processFile({ fileId: String(file._id) });

        const updated = await File.findById(file._id);
        expect(updated.processingStatus).toBe('unsupported');
        expect(updated.extractedTextStatus).toBe('unsupported');
        expect(upsertChunks).not.toHaveBeenCalled();
    });

    it('помечает extractedTextStatus=empty, если извлечённого текста нет', async () => {
        getExtractor.mockReturnValue(async function* extract() {});

        const file = await createFile();
        await processFile({ fileId: String(file._id) });

        const updated = await File.findById(file._id);
        expect(updated.extractedTextStatus).toBe('empty');
        expect(updated.processingStatus).toBe('indexed');
        expect(updated.qdrantPointIds).toEqual([]);
    });

    it('не роняет процесс при ошибке экстракции — помечает файл failed и пробрасывает ошибку джобе', async () => {
        getExtractor.mockReturnValue(async function* extract() {
            throw new Error('S3 недоступен');
        });

        const file = await createFile();
        await expect(processFile({ fileId: String(file._id) })).rejects.toThrow('S3 недоступен');

        const updated = await File.findById(file._id);
        expect(updated.processingStatus).toBe('failed');
        expect(updated.extractedTextStatus).toBe('failed');
        expect(updated.qdrantStatus).toBe('failed');
        expect(updated.processingError).toContain('S3 недоступен');
    });

    it('помечает unsupported (без ретраев) при превышении лимита размера для формата', async () => {
        getExtractor.mockReturnValue(async function* extract() {
            const error = new Error('too big');
            error.code = 'FILE_TOO_LARGE_FOR_FORMAT';
            throw error;
        });

        const file = await createFile({ type: 'application/pdf' });
        await expect(processFile({ fileId: String(file._id) })).resolves.toBeUndefined();

        const updated = await File.findById(file._id);
        expect(updated.processingStatus).toBe('unsupported');
    });
});
