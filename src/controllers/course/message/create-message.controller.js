import User from '../../../models/user.model.js';
import CourseAgent from '../../../models/course/agent.model.js';
import CourseGroup from '../../../models/course/group.model.js';
import CourseMessage from '../../../models/course/message.model.js';
import { createThreadAssistant } from '../../../services/openai/create-thread-assistant.js';
import { sendMessageAssistantStream } from '../../../services/openai/send-message-assistant-stream.js';

export async function createMessage(req, res) {
    const { agentId, messageText } = req.validatedData.body;

    const user = await User.findById(req.user.id);
    if (!user.courseGroup) return res.error({}, 403, 'Вы не состоите ни в одной группе');

    const group = await CourseGroup.findById(user.courseGroup);
    if (!group?.active) return res.error({}, 403, 'Ваша группа неактивна');

    const hasAccess = group.agents.some(a => a.toString() === agentId);
    if (!hasAccess) return res.error({}, 403, 'Нет доступа к этому агенту');

    const agent = await CourseAgent.findById(agentId);
    if (!agent) return res.error({}, 404, 'Агент не найден');

    let threadId = user.openAiThreadId;
    if (!threadId) {
        threadId = await createThreadAssistant();
        await User.findByIdAndUpdate(req.user.id, { openAiThreadId: threadId });
    }

    const existingRunId = user.openAiRunId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        const userMessage = await CourseMessage.create({
            messageText,
            user: req.user.id,
            agent: agentId,
            author: 'user'
        });

        sendEvent('message_created', { userMessage });

        const userContextParts = [];
        if (user.firstName || user.lastName) userContextParts.push(`Имя пользователя: ${[user.firstName, user.lastName].filter(Boolean).join(' ')}`);
        if (user.profession) userContextParts.push(`Профессия: ${user.profession}`);
        if (user.fieldOfActivity) userContextParts.push(`Сфера деятельности: ${user.fieldOfActivity}`);
        if (user.city) userContextParts.push(`Город: ${user.city}`);

        const messageWithContext = userContextParts.length > 0
            ? `[Контекст о пользователе: ${userContextParts.join(', ')}]\n\n${messageText}`
            : messageText;

        const responseText = await sendMessageAssistantStream({
            threadId,
            assistantId: agent.openAiAssistantId,
            message: messageWithContext,
            runId: existingRunId,
            onDelta: (chunk) => sendEvent('delta', { text: chunk }),
            onRunCreated: (id) => User.findByIdAndUpdate(req.user.id, { openAiRunId: id })
        });

        const agentMessage = await CourseMessage.create({
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
