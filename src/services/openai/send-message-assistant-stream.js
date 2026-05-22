import openai from '../../../config/openai.config.js';
import { cancelActiveRuns } from './cancel-active-runs.js';

/**
 * Streams assistant response via SSE. Calls onDelta(text) for each chunk,
 * resolves with the full response text when done.
 */
export async function sendMessageAssistantStream({ threadId, assistantId, message, onDelta }) {
    await cancelActiveRuns(threadId);

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
