import { createSession, ExpertSessionError } from '../../../services/accelerator/expert-session.service.js';

export async function createExpertSession(req, res) {
    try {
        const { agentId } = req.validatedData.body;

        const { session } = await createSession(req.project, agentId);

        return res.success({ session }, 'Экспертная сессия создана', 201);
    } catch (error) {
        if (error instanceof ExpertSessionError) {
            return res.error({ code: error.code }, error.status, error.message);
        }
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при создании экспертной сессии');
    }
}
