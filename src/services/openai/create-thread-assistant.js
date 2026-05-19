import openai from '../../../config/openai.config.js';

export async function createThreadAssistant() {
    const thread = await openai.beta.threads.create();
    return thread.id;
}
