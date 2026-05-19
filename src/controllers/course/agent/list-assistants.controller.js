import { listAssistants } from '../../../services/openai/list-assistants.js';

export async function listOpenAiAssistants(req, res) {
    try {
        const assistants = await listAssistants();
        return res.success(
            assistants.data.map(a => ({ id: a.id, name: a.name })),
            'Список ассистентов получен',
            200
        );
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при получении ассистентов OpenAI');
    }
}
