import StudyMessage from '../../../models/study/message.model.js';

export async function listMessages(req, res) {
    try {
        const { agentId, page, limit } = req.validatedData.query;
        const skip = (page - 1) * limit;

        const filter = { user: req.user.id, agent: agentId };

        const [messages, total] = await Promise.all([
            StudyMessage.find(filter)
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(limit),
            StudyMessage.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(total / limit);

        return res.success(
            { messages, pagination: { page, limit, total, totalPages, hasMore: page < totalPages } },
            'Сообщения получены',
            200
        );
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при получении сообщений');
    }
}
