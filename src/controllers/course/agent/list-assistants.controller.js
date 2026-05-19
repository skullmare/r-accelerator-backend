import { listAssistants } from '../../../services/openai/list-assistants.js';

export async function listOpenAiAssistants(req, res) {
    const assistants = await listAssistants();
    return res.success(
        assistants.data.map(a => ({ id: a.id, name: a.name })),
        'Список ассистентов получен',
        200
    );
}
