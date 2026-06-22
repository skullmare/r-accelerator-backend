import StudyAgent from '../../../models/study/agent.model.js';

export async function updateAgent(req, res) {
    try {
        const { id } = req.validatedData.params;
        const agent = await StudyAgent.findByIdAndUpdate(id, req.validatedData.body, { returnDocument: 'after' });
        if (!agent) return res.error({}, 404, 'Агент не найден');
        return res.success(agent, 'Агент обновлён', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при обновлении агента');
    }
}
