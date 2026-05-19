import CourseMessage from '../../../models/course/message.model.js';

export async function listMessages(req, res) {
    const { agentId } = req.validatedData.query;

    const messages = await CourseMessage.find({
        user: req.user.id,
        agent: agentId
    }).sort({ createdAt: 1 });

    return res.success(messages, 'Сообщения получены', 200);
}
