import User from '../../../models/user.model.js';
import StudyAgent from '../../../models/study/agent.model.js';
import StudyMessage from '../../../models/study/message.model.js';
import { createThreadAssistant } from '../../../services/openai/create-thread-assistant.js';
import { sendMessageAssistantStream } from '../../../services/openai/send-message-assistant-stream.js';

export async function createMessage(req, res) {
    const { agentId } = req.validatedData.params;
    const { messageText } = req.validatedData.body;

    // доступ к агенту уже проверен middleware check-access-agent и check-item-unlocked
    const [user, agent] = await Promise.all([
        User.findById(req.user.id),
        StudyAgent.findById(agentId)
    ]);

    if (!agent) return res.error({}, 404, 'Агент не найден');

    let threadId = user.openAiThreadId;
    if (!threadId) {
        threadId = await createThreadAssistant();
        await User.findByIdAndUpdate(req.user.id, { openAiThreadId: threadId });
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
        const userMessage = await StudyMessage.create({
            messageText,
            user: req.user.id,
            agent: agentId,
            author: 'user'
        });

        sendEvent('message_created', { userMessage });

        // собираем контекст пользователя для передачи агенту
        const userContextParts = [];
        if (user.firstName || user.lastName) userContextParts.push(`Имя пользователя: ${[user.firstName, user.lastName].filter(Boolean).join(' ')}`);
        if (user.profession) userContextParts.push(`Профессия: ${user.profession}`);
        if (user.fieldOfActivity) userContextParts.push(`Сфера деятельности: ${user.fieldOfActivity}`);
        if (user.city) userContextParts.push(`Город: ${user.city}`);

        const messageWithContext = userContextParts.length > 0
            ? `[Контекст о пользователе: ${userContextParts.join(', ')}]\n\n${messageText}`
            : messageText;

        const { text: responseText, threadId: usedThreadId } = await sendMessageAssistantStream({
            threadId,
            assistantId: agent.openAiAssistantId,
            message: messageWithContext,
            getMessages: async () => {
                const messages = await StudyMessage.find({
                    user: req.user.id,
                    agent: agentId,
                    _id: { $ne: userMessage._id }
                }).sort({ createdAt: -1 }).limit(32).lean();

                return messages.reverse().map(m => ({
                    role: m.author === 'user' ? 'user' : 'assistant',
                    content: m.messageText
                }));
            },
            onDelta: (chunk) => sendEvent('delta', { text: chunk })
        });

        if (usedThreadId !== threadId) {
            await User.findByIdAndUpdate(req.user.id, { openAiThreadId: usedThreadId });
        }

        const agentMessage = await StudyMessage.create({
            messageText: responseText,
            user: req.user.id,
            agent: agentId,
            author: 'agent'
        });

        sendEvent('done', { agentMessage });
    } catch (error) {
        sendEvent('error', { message: error.message, code: error.code });
    } finally {
        res.end();
    }
}
