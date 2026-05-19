import CourseAgent from '../../../models/course/agent.model.js';

export async function getAgent(req, res) {
    try {
        const { id } = req.validatedData.params;
        const agent = await CourseAgent.findById(id);
        if (!agent) return res.error({}, 404, 'Агент не найден');
        return res.success(agent, 'Агент получен', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при получении агента');
    }
}
