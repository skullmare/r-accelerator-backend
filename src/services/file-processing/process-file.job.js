import crypto from 'crypto';
import File from '../../models/file.model.js';
import { getExtractor } from './extractors/index.js';
import { upsertChunks, deleteBySource } from '../qdrant.service.js';

export const FILE_PROCESS_JOB_TYPE = 'file:process';

const EMBED_BATCH_SIZE = 20;

async function markUnsupported(file) {
    file.processingStatus = 'unsupported';
    file.extractedTextStatus = 'unsupported';
    file.qdrantStatus = 'not_indexed';
    file.processingError = null;
    await file.save();
}

// Runs entirely off the HTTP request path (invoked by the job worker only).
// Chunks are pulled from the extractor's async generator and embedded/
// upserted in small batches, so memory stays bounded by EMBED_BATCH_SIZE
// regardless of the source file's size, and Qdrant reflects progress
// incrementally instead of only after the whole file is done.
export async function processFile({ fileId }) {
    const file = await File.findById(fileId);
    if (!file) return;

    const extract = getExtractor(file.type);
    if (!extract) {
        await markUnsupported(file);
        return;
    }

    file.processingStatus = 'extracting';
    await file.save();

    await deleteBySource(String(file._id), file.projectId);

    const runningHash = crypto.createHash('sha256');
    const pointIds = [];
    let firstChunkText = null;
    let batch = [];
    let totalChunks = 0;

    try {
        for await (const chunk of extract(file.key)) {
            totalChunks++;
            runningHash.update(chunk.textHash);
            if (firstChunkText === null) firstChunkText = chunk.text;
            batch.push(chunk);

            if (batch.length >= EMBED_BATCH_SIZE) {
                pointIds.push(...await upsertChunks({
                    projectId: file.projectId,
                    sourceType: 'file_chunk',
                    sourceId: String(file._id),
                    chunks: batch
                }));
                batch = [];
            }
        }

        if (batch.length > 0) {
            pointIds.push(...await upsertChunks({
                projectId: file.projectId,
                sourceType: 'file_chunk',
                sourceId: String(file._id),
                chunks: batch
            }));
        }

        if (totalChunks === 0) {
            file.extractedTextStatus = 'empty';
            file.processingStatus = 'indexed';
            file.qdrantStatus = 'indexed';
            file.qdrantPointIds = [];
        } else {
            file.extractedTextStatus = 'success';
            file.processingStatus = 'indexed';
            file.qdrantStatus = 'indexed';
            file.qdrantPointIds = pointIds;
            file.textHash = runningHash.digest('hex');
            file.extractedTextPreview = firstChunkText.slice(0, 300);
            file.indexedAt = new Date();
        }
        file.processingError = null;
        await file.save();
    } catch (error) {
        if (error.code === 'FILE_TOO_LARGE_FOR_FORMAT') {
            await markUnsupported(file);
            return;
        }

        file.processingStatus = 'failed';
        file.extractedTextStatus = 'failed';
        file.qdrantStatus = 'failed';
        file.processingError = String(error.message).slice(0, 500);
        await file.save();
        throw error;
    }
}
