import openai from '../../../config/openai.config.js';

async function cancelLastRun(threadId) {
    const { data } = await openai.beta.threads.runs.list(threadId, { limit: 1, order: 'desc' });
    const run = data[0];
    if (!run) return;

    try {
        await openai.beta.threads.runs.cancel(run.id, { thread_id: threadId });
    } catch {
        // Run already in terminal state — thread is free
        return;
    }

    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        const updated = await openai.beta.threads.runs.retrieve(run.id, { thread_id: threadId });
        if (updated.status !== 'cancelling') return;
    }

    throw new Error('Предыдущий запрос завис и не может быть отменён, попробуйте позже');
}

/**
 * Streams assistant response via SSE. Calls onDelta(text) for each chunk,
 * resolves with the full response text when done.
 */
export async function sendMessageAssistantStream({ threadId, assistantId, message, onDelta }) {
    await cancelLastRun(threadId);

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

    return fullText;
}
