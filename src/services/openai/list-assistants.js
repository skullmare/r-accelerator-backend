import openai from '../../../config/openai.config.js';
import logger from '../../../config/logger.config.js';

export async function listAssistants() {
    try {
        const assistants = await openai.beta.assistants.list();
        return assistants;
    } catch (error) {
        logger.error('Ошибка получения списка ассистентов openAI', error);
        throw error;
    }
}
