import openai from '../../../config/openai.config.js';
import { cancelActiveRuns } from './cancel-active-runs.js';

export async function sendMessageAssistant({ threadId, assistantId, message }) {
    await cancelActiveRuns(threadId);

    await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: message
    });

    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: assistantId
    });

    if (run.status !== 'completed') {
        throw new Error(`Ответ не получен: ${run.status}`);
    }

    const messages = await openai.beta.threads.messages.list(threadId, {
        order: 'desc',
        limit: 1
    });

    const content = messages.data[0]?.content[0];
    if (content?.type !== 'text') {
        throw new Error('Неожиданный формат ответа от ассистента');
    }

    return content.text.value;
}
