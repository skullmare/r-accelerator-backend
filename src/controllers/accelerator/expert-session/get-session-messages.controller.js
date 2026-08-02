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

        // Состояние этапа отдаётся вместе с историей: после перезагрузки
        // страницы фронт восстанавливает и диалог, и кнопку «сформировать
        // документ» — без обращения к модели.
        return res.success({
            items,
            collectedData: session.collectedData,
            readyForArtifact: session.readyForArtifact,
            artifactId: session.artifactId,
            status: session.status
        }, 'История сообщений получена', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении истории сообщений');
    }
}
