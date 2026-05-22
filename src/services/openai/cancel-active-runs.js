import openai from '../../../config/openai.config.js';

const CANCELLABLE = new Set(['queued', 'in_progress', 'requires_action']);
const BLOCKING = new Set(['queued', 'in_progress', 'requires_action', 'cancelling']);

/**
 * Cancels all active/cancelling runs on a thread.
 * Returns true if thread is clear, false if stuck after timeout.
 */
export async function cancelActiveRuns(threadId) {
    const runs = await openai.beta.threads.runs.list(threadId, { limit: 10 });
    const blockingRuns = runs.data.filter(run => BLOCKING.has(run.status));

    if (blockingRuns.length === 0) return true;

    await Promise.all(blockingRuns.map(async (run) => {
        if (CANCELLABLE.has(run.status)) {
            try {
                await openai.beta.threads.runs.cancel(threadId, run.id);
            } catch {
                // run may have already transitioned — still poll below
            }
        }

        let current = run;
        let attempts = 0;
        while (BLOCKING.has(current.status) && attempts < 20) {
            await new Promise(r => setTimeout(r, 500));
            current = await openai.beta.threads.runs.retrieve(threadId, run.id);
            attempts++;
        }
    }));

    const check = await openai.beta.threads.runs.list(threadId, { limit: 10 });
    return !check.data.some(run => BLOCKING.has(run.status));
}
