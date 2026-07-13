import { claimNextJob, completeJob, failJob } from './job-queue.service.js';
import logger from '../../../config/logger.config.js';

// In-process worker loop with a bounded concurrency: heavy per-job work
// (S3 fetch, text extraction, embeddings) runs off the request-handling
// path entirely, so a large file being processed never delays unrelated
// API requests. The claim itself is a single atomic Mongo update, so this
// also scales to multiple server replicas without extra coordination.

const handlers = new Map();
let timer = null;
let running = 0;
let concurrencyLimit = 3;

export function registerHandler(type, handler) {
    handlers.set(type, handler);
}

async function runJob(job) {
    running++;
    try {
        const handler = handlers.get(job.type);
        await handler(job.payload, job);
        await completeJob(job._id);
    } catch (error) {
        logger.error(`Job ${job.type} (${job._id}) failed: ${error.message}`);
        await failJob(job._id, error);
    } finally {
        running--;
    }
}

async function tick() {
    const types = [...handlers.keys()];
    if (types.length === 0) return;

    while (running < concurrencyLimit) {
        const job = await claimNextJob(types);
        if (!job) break;
        runJob(job);
    }
}

export function startWorker({ pollIntervalMs = 2000, concurrency = 3 } = {}) {
    if (timer) return;
    concurrencyLimit = concurrency;
    timer = setInterval(() => {
        tick().catch((error) => logger.error(`Ошибка воркера очереди: ${error.message}`));
    }, pollIntervalMs);
    timer.unref?.();
}

export function stopWorker() {
    if (timer) clearInterval(timer);
    timer = null;
}
