import { loadSessionAndAgent, sendMessage, ExpertSessionError } from '../../../services/accelerator/expert-session.service.js';

// Streams the agent's reply over SSE (mirrors src/services/openai/send-message-assistant-stream.js
// usage in the study domain). Validation/access errors that can be known
// before the LLM call starts (session/agent not found, session already
// completed) are still returned as normal JSON errors — only once those
// pass do we switch the response to text/event-stream.
export async function sendExpertMessage(req, res) {
    try {
        const { sessionId } = req.validatedData.params;
        const { content } = req.validatedData.body;

        const { session, agent } = await loadSessionAndAgent(req.project, sessionId);

        if (session.status === 'completed') {
            return res.error({ code: 'SESSION_ALREADY_COMPLETED' }, 409, 'Сессия уже завершена');
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
            const { assistantMessage } = await sendMessage(req.project, session, agent, content, {
                onUserMessage: (userMessage) => sendEvent('message_created', { userMessage }),
                onDelta: (text) => sendEvent('delta', { text })
            });
            sendEvent('done', { assistantMessage });
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
