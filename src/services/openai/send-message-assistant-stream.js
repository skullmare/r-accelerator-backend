import openai from '../../../config/openai.config.js';

const ACTIVE_STATUSES = new Set(['queued', 'in_progress']);

async function cancelIfActive(threadId, runId) {
    if (!runId) return;
    try {
        const run = await openai.beta.threads.runs.retrieve(runId, { thread_id: threadId });
        if (!ACTIVE_STATUSES.has(run.status)) return;

        await openai.beta.threads.runs.cancel(runId, { thread_id: threadId });

        // Poll until run leaves 'cancelling' state (max 5s)
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 500));
            const updated = await openai.beta.threads.runs.retrieve(runId, { thread_id: threadId });
            if (updated.status !== 'cancelling') break;
        }
    } catch {
        // Run not found or already terminal — safe to proceed
    }
}

/**
 * Streams assistant response via SSE. Calls onDelta(text) for each chunk,
 * resolves with { text, runId } when done.
 */
export async function sendMessageAssistantStream({ threadId, assistantId, message, runId, onDelta }) {
    await cancelIfActive(threadId, runId);

    await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: message
    });

    let fullText = '';

    const stream = openai.beta.threads.runs.stream(threadId, {
        assistant_id: assistantId
    });

    await new Promise((resolve, reject) => {
        stream
            .on('textDelta', (delta) => {
                const chunk = delta.value ?? '';
                if (chunk) {
                    fullText += chunk;
                    onDelta(chunk);
                }
            })
            .on('error', reject)
            .on('end', resolve);
    });

    if (!fullText) {
        throw new Error('Пустой ответ от ассистента');
    }

    return { text: fullText, runId: stream.currentRun()?.id };
}
