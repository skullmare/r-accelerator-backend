import CourseAgent from '../../../models/course/agent.model.js';

export async function deleteAgent(req, res) {
    try {
        const { id } = req.validatedData.params;
        const agent = await CourseAgent.findByIdAndDelete(id);
        if (!agent) return res.error({}, 404, 'Агент не найден');
        return res.success({}, 'Агент удалён', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при удалении агента');
    }
}
