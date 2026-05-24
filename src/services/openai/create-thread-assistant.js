import openai from '../../../config/openai.config.js';

export async function createThreadAssistant(messages = []) {
    const thread = await openai.beta.threads.create(
        messages.length ? { messages } : {}
    );
    return thread.id;
}
