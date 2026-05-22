import openai from '../../../config/openai.config.js';

const ACTIVE_STATUSES = new Set(['queued', 'in_progress', 'requires_action']);

export async function cancelActiveRuns(threadId) {
    const runs = await openai.beta.threads.runs.list(threadId, { limit: 10 });
    const activeRuns = runs.data.filter(run => ACTIVE_STATUSES.has(run.status));

    await Promise.all(activeRuns.map(async (run) => {
        try {
            await openai.beta.threads.runs.cancel(threadId, run.id);
            let current = run;
            while (current.status === 'cancelling' || ACTIVE_STATUSES.has(current.status)) {
                await new Promise(r => setTimeout(r, 500));
                current = await openai.beta.threads.runs.retrieve(threadId, run.id);
            }
        } catch {
            // run may have already completed or failed — safe to ignore
        }
    }));
}
