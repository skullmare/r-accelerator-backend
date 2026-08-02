import { loadSessionAndAgent, sendMessage, ExpertSessionError } from '../../../services/accelerator/expert-session.service.js';

// Ответ агента отдаётся по SSE. Ошибки, которые известны до обращения к
// модели (сессия не найдена, этап уже завершён), возвращаются обычным JSON —
// на text/event-stream переключаемся только после этих проверок.
export async function sendExpertMessage(req, res) {
    try {
        const { sessionId } = req.validatedData.params;
        const { content } = req.validatedData.body;

        const { session, agent } = await loadSessionAndAgent(req.project, sessionId);

        if (session.status === 'completed') {
            return res.error({ code: 'SESSION_ALREADY_COMPLETED' }, 409, 'Этап уже завершён');
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const sendEvent = (event, data) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        try {
            const { assistantMessage, collectedData, readyForArtifact } = await sendMessage(req.project, session, agent, content, {
                onUserMessage: (userMessage) => sendEvent('message_created', { userMessage }),
                onDelta: (text) => sendEvent('delta', { text }),
                // Агент сохранил данные посреди хода. Событие приходит ДО done,
                // пока он ещё дописывает реплику, — чтобы состояние на фронте
                // обновлялось сразу, а не после конца стрима.
                onDataUpdated: (state) => sendEvent('data_updated', state)
            });
            // readyForArtifact — то, по чему фронт решает, показывать ли кнопку
            // «Сформировать документ».
            sendEvent('done', { assistantMessage, collectedData, readyForArtifact });
        } catch (error) {
            sendEvent('error', { message: error.message, code: error.code });
        } finally {
            res.end();
        }
    } catch (error) {
        if (error instanceof ExpertSessionError) {
            return res.error({ code: error.code }, error.status, error.message);
        }
        return res.error({ description: error.message, code: 'LLM_PROVIDER_FAILED' }, 500, 'Ошибка при обработке сообщения');
    }
}
