import { loadSessionAndAgent, sendMessage, ExpertSessionError } from '../../../services/accelerator/expert-session.service.js';

export async function sendExpertMessage(req, res) {
    try {
        const { sessionId } = req.validatedData.params;
        const { content } = req.validatedData.body;

        const { session, agent } = await loadSessionAndAgent(req.project, sessionId);
        const { userMessage, assistantMessage } = await sendMessage(req.project, session, agent, content);

        return res.success({ userMessage, assistantMessage }, 'Сообщение обработано', 200);
    } catch (error) {
        if (error instanceof ExpertSessionError) {
            return res.error({ code: error.code }, error.status, error.message);
        }
        return res.error({ description: error.message, code: 'LLM_PROVIDER_FAILED' }, 500, 'Ошибка при обработке сообщения');
    }
}
