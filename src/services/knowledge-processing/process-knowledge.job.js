import crypto from 'crypto';
import Knowledge from '../../models/accelerator/knowledge.model.js';
import { loadKnowledgeSource } from './load-source.js';
import { extractChunksFromBuffer } from './extract-from-buffer.js';
import { upsertKnowledgeChunks, deleteByKnowledge } from '../qdrant.service.js';

const EMBED_BATCH_SIZE = 20;

// Тегирует сбой записи в Qdrant стабильным кодом, чтобы отличить его от сбоя
// извлечения текста (симметрично process-file.job.js).
async function upsertBatch(knowledgeId, chunks) {
    try {
        return await upsertKnowledgeChunks({ knowledgeId, chunks });
    } catch (error) {
        error.code = 'QDRANT_INDEX_FAILED';
        throw error;
    }
}

// Синхронная обработка knowledge (очереди в проекте больше нет): скачивает
// источник (файл в S3 по fileId ИЛИ внешнюю ссылку), извлекает текст,
// чанкует, эмбеддит батчами и пишет в коллекцию knowledge_context. Источник
// берётся из самого документа Knowledge (fileId/sourceUrl) — контроллер
// reindex при необходимости обновляет их перед вызовом. Идемпотентна:
// deleteByKnowledge чистит старые точки перед записью новых.
export async function processKnowledge({ knowledgeId }) {
    const knowledge = await Knowledge.findById(knowledgeId);
    if (!knowledge) return;

    knowledge.status = 'processing';
    knowledge.processingError = null;
    knowledge.processingErrorCode = null;
    await knowledge.save();

    await deleteByKnowledge(String(knowledge._id));

    try {
        const { buffer, mimeType } = await loadKnowledgeSource({
            fileId: knowledge.fileId,
            sourceUrl: knowledge.sourceUrl
        });
        knowledge.sourceMimeType = mimeType;

        const chunks = await extractChunksFromBuffer(buffer, mimeType);

        if (chunks === null) {
            knowledge.status = 'unsupported';
            knowledge.chunksCount = 0;
            knowledge.qdrantPointIds = [];
            await knowledge.save();
            return;
        }

        const runningHash = crypto.createHash('sha256');
        const pointIds = [];
        for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
            const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
            for (const chunk of batch) runningHash.update(chunk.textHash);
            pointIds.push(...await upsertBatch(String(knowledge._id), batch));
        }

        knowledge.status = 'indexed';
        knowledge.chunksCount = chunks.length;
        knowledge.qdrantPointIds = pointIds;
        knowledge.textHash = chunks.length > 0 ? runningHash.digest('hex') : null;
        knowledge.indexedAt = new Date();
        knowledge.processingError = null;
        knowledge.processingErrorCode = null;
        await knowledge.save();
    } catch (error) {
        knowledge.status = 'failed';
        knowledge.processingError = String(error.message).slice(0, 500);
        knowledge.processingErrorCode = error.code || null;
        await knowledge.save();
        throw error;
    }
}
