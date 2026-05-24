import openai from '../../../config/openai.config.js';

const ACTIVE_STATUSES = new Set(['queued', 'in_progress', 'requires_action', 'cancelling']);

async function resolveThreadId(threadId, previousMessages) {
    const { data } = await openai.beta.threads.runs.list(threadId, { limit: 1, order: 'desc' });
    const lastRun = data[0];

    if (!lastRun || !ACTIVE_STATUSES.has(lastRun.status)) {
        return threadId;
    }

    const messages = previousMessages.map(m => ({
        role: m.author === 'user' ? 'user' : 'assistant',
        content: m.messageText
    }));

    const thread = await openai.beta.threads.create(messages.length ? { messages } : {});
    return thread.id;
}

/**
 * Streams assistant response via SSE. Calls onDelta(text) for each chunk,
 * resolves with { text, threadId } when done.
 */
export async function sendMessageAssistantStream({ threadId, assistantId, message, previousMessages, onDelta }) {
    const resolvedThreadId = await resolveThreadId(threadId, previousMessages);

    await openai.beta.threads.messages.create(resolvedThreadId, {
        role: 'user',
        content: message
    });

    let fullText = '';

    const stream = openai.beta.threads.runs.stream(resolvedThreadId, {
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

    return { text: fullText, threadId: resolvedThreadId };
}
