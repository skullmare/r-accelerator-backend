import { loadSessionAndAgent, completeSession, ExpertSessionError } from '../../../services/accelerator/expert-session.service.js';

export async function completeExpertSession(req, res) {
    try {
        const { sessionId } = req.validatedData.params;
        const { confirmArtifact } = req.validatedData.body;

        const { session, agent } = await loadSessionAndAgent(req.project, sessionId);
        const result = await completeSession(req.project, session, agent, confirmArtifact);

        return res.success(result, result.confirmed ? 'Этап завершён' : 'Черновик артефакта готов, требуется подтверждение', 200);
    } catch (error) {
        if (error instanceof ExpertSessionError) {
            return res.error({ code: error.code }, error.status, error.message);
        }
        return res.error({ description: error.message, code: error.code || 'ARTIFACT_VALIDATION_FAILED' }, 500, 'Ошибка при завершении экспертной сессии');
    }
}
