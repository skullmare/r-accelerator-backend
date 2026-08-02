import { loadSessionAndAgent, completeSession, ExpertSessionError } from '../../../services/accelerator/expert-session.service.js';

// Один вызов = документ создан, этап закрыт, проект переключён на следующего
// агента. Параметров у запроса нет.
export async function completeExpertSession(req, res) {
    try {
        const { sessionId } = req.validatedData.params;

        const { session, agent } = await loadSessionAndAgent(req.project, sessionId);
        const result = await completeSession(req.project, session, agent);

        return res.success(result, 'Этап завершён', 200);
    } catch (error) {
        if (error instanceof ExpertSessionError) {
            return res.error({ code: error.code }, error.status, error.message);
        }
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при завершении этапа');
    }
}
