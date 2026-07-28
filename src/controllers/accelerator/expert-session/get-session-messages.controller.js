import Message from '../../../models/accelerator/message.model.js';
import ExpertSession from '../../../models/accelerator/expert-session.model.js';

export async function getSessionMessages(req, res) {
    try {
        const { sessionId } = req.validatedData.params;

        const session = await ExpertSession.findOne({ _id: sessionId, projectId: req.project._id });
        if (!session) {
            return res.error({ code: 'SESSION_NOT_FOUND' }, 404, 'Экспертная сессия не найдена');
        }

        const items = await Message.find({ sessionId: session._id }).sort({ createdAt: 1 });

        // completionState отдаётся вместе с историей, чтобы после перезагрузки
        // страницы фронт восстановил состояние кнопки завершения этапа без
        // отправки нового сообщения и без лишнего вызова модели.
        return res.success({
            items,
            completionState: session.completionState,
            artifactId: session.artifactId,
            status: session.status
        }, 'История сообщений получена', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении истории сообщений');
    }
}
