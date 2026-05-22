import openai from '../../../config/openai.config.js';

export class StuckThreadError extends Error {
    constructor() { super('STUCK_THREAD'); this.name = 'StuckThreadError'; }
}

/**
 * Streams assistant response via SSE. Calls onDelta(text) for each chunk,
 * resolves with the full response text when done.
 */
export async function sendMessageAssistantStream({ threadId, assistantId, message, onDelta }) {
    try {
        await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: message
        });
    } catch (err) {
        if (err?.status === 400 && err?.message?.includes('while a run') && err?.message?.includes('is active')) {
            throw new StuckThreadError();
        }
        throw err;
    }

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
