import CourseAgent from '../../../models/course/agent.model.js';

export async function updateAgent(req, res) {
    const { id } = req.validatedData.params;
    const agent = await CourseAgent.findByIdAndUpdate(id, req.validatedData.body, { new: true });
    if (!agent) return res.error({}, 404, 'Агент не найден');
    return res.success(agent, 'Агент обновлён', 200);
}
