import { createSession, ExpertSessionError } from '../../../services/accelerator/expert-session.service.js';
import { toPublicAgent } from '../../../services/accelerator/agent-view.service.js';

export async function createExpertSession(req, res) {
    try {
        const { agentId } = req.validatedData.body;

        const { session, agent } = await createSession(req.project, agentId);

        // Агент отдаётся рядом с сессией: фронту он нужен сразу (имя,
        // описание, аватарки), чтобы отрисовать шапку чата без второго запроса.
        return res.success({ session, agent: toPublicAgent(agent) }, 'Экспертная сессия создана', 201);
    } catch (error) {
        if (error instanceof ExpertSessionError) {
            return res.error({ code: error.code }, error.status, error.message);
        }
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при создании экспертной сессии');
    }
}
