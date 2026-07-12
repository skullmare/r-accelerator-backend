import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { enqueue, claimNextJob, completeJob, failJob } from '../../services/queue/job-queue.service.js';
import Job from '../../models/job.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

describe('job-queue.service', () => {
    it('enqueue создаёт job со статусом pending', async () => {
        const job = await enqueue('test:job', { foo: 'bar' });
        expect(job.status).toBe('pending');
        expect(job.payload).toEqual({ foo: 'bar' });
    });

    it('claimNextJob атомарно переводит job в processing и не отдаёт его повторно', async () => {
        await enqueue('test:job', { n: 1 });

        const claimed = await claimNextJob(['test:job']);
        expect(claimed).not.toBeNull();
        expect(claimed.status).toBe('processing');
        expect(claimed.attempts).toBe(1);

        const second = await claimNextJob(['test:job']);
        expect(second).toBeNull();
    });

    it('claimNextJob игнорирует job с runAt в будущем', async () => {
        await enqueue('test:job', { n: 1 }, { runAt: new Date(Date.now() + 60_000) });

        const claimed = await claimNextJob(['test:job']);
        expect(claimed).toBeNull();
    });

    it('claimNextJob игнорирует job другого типа', async () => {
        await enqueue('other:job', { n: 1 });

        const claimed = await claimNextJob(['test:job']);
        expect(claimed).toBeNull();
    });

    it('completeJob помечает job как completed', async () => {
        const job = await enqueue('test:job', {});
        const claimed = await claimNextJob(['test:job']);
        await completeJob(claimed._id);

        const stored = await Job.findById(job._id);
        expect(stored.status).toBe('completed');
    });

    it('failJob переводит job обратно в pending с задержкой, если остались попытки', async () => {
        const job = await enqueue('test:job', {}, { maxAttempts: 3 });
        const claimed = await claimNextJob(['test:job']);

        await failJob(claimed._id, new Error('boom'), { retryDelayMs: 1000 });

        const stored = await Job.findById(job._id);
        expect(stored.status).toBe('pending');
        expect(stored.attempts).toBe(1);
        expect(stored.lastError).toContain('boom');
        expect(stored.runAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('failJob помечает job как failed после исчерпания попыток', async () => {
        const job = await enqueue('test:job', {}, { maxAttempts: 1 });
        const claimed = await claimNextJob(['test:job']);

        await failJob(claimed._id, new Error('boom'));

        const stored = await Job.findById(job._id);
        expect(stored.status).toBe('failed');
    });
});
