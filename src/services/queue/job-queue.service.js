import Job from '../../models/job.model.js';

// enqueue/claimNextJob/completeJob/failJob is the whole contract a worker
// needs. If this ever needs to move to BullMQ + Redis for higher throughput,
// only this file and worker.js change — job producers and job handlers
// (business logic) stay untouched.

export async function enqueue(type, payload, { runAt = new Date(), maxAttempts = 5 } = {}) {
    return Job.create({ type, payload, runAt, maxAttempts });
}

export async function claimNextJob(types) {
    return Job.findOneAndUpdate(
        { type: { $in: types }, status: 'pending', runAt: { $lte: new Date() } },
        { $set: { status: 'processing', lockedAt: new Date() }, $inc: { attempts: 1 } },
        { sort: { runAt: 1 }, returnDocument: 'after' }
    );
}

export async function completeJob(jobId) {
    await Job.findByIdAndUpdate(jobId, { status: 'completed', lockedAt: null });
}

export async function failJob(jobId, error, { retryDelayMs = 30000 } = {}) {
    const job = await Job.findById(jobId);
    if (!job) return;

    const message = String(error?.message || error).slice(0, 2000);

    if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
    } else {
        job.status = 'pending';
        job.runAt = new Date(Date.now() + retryDelayMs * job.attempts);
    }
    job.lastError = message;
    job.lockedAt = null;
    await job.save();
}
