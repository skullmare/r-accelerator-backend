import { loadSessionAndAgent, completeSession, ExpertSessionError } from '../../../services/accelerator/expert-session.service.js';

export async function completeExpertSession(req, res) {
    try {
        const { sessionId } = req.validatedData.params;
        const { confirmArtifact, regenerate } = req.validatedData.body;

        const { session, agent } = await loadSessionAndAgent(req.project, sessionId);
        const result = await completeSession(req.project, session, agent, { confirmArtifact, regenerate });

        return res.success(result, result.confirmed ? 'Этап завершён' : 'Черновик артефакта готов, требуется подтверждение', 200);
    } catch (error) {
        if (error instanceof ExpertSessionError) {
            // details несёт missingFields/reason для STAGE_NOT_READY — фронту
            // нужно показать пользователю, чего именно не хватает. resify-express
            // деструктурирует из первого аргумента только { code, description,
            // error }, поэтому детали передаются через ключ error (он целиком
            // становится телом res.body.error) — спред "лишних" полей рядом с
            // code был бы молча отброшен.
            return res.error({
                code: error.code,
                error: error.details ? { code: error.code, ...error.details } : null
            }, error.status, error.message);
        }
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при завершении экспертной сессии');
    }
}
