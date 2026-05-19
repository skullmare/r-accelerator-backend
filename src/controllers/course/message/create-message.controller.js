import User from '../../../models/user.model.js';
import CourseAgent from '../../../models/course/agent.model.js';
import CourseGroup from '../../../models/course/group.model.js';
import CourseMessage from '../../../models/course/message.model.js';
import { createThreadAssistant } from '../../../services/openai/create-thread-assistant.js';
import { sendMessageAssistant } from '../../../services/openai/send-message-assistant.js';

export async function createMessage(req, res) {
    try {
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

        const responseText = await sendMessageAssistant({
            threadId,
            assistantId: agent.openAiAssistantId,
            message: messageText
        });

        const [userMessage, agentMessage] = await Promise.all([
            CourseMessage.create({ messageText, user: req.user.id, agent: agentId, author: 'user' }),
            CourseMessage.create({ messageText: responseText, user: req.user.id, agent: agentId, author: 'agent' })
        ]);

        return res.success({ userMessage, agentMessage }, 'Сообщение отправлено', 201);
    } catch (error) {
        return res.error({}, 500, 'Ошибка при отправке сообщения');
    }
}
