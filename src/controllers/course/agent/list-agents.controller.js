import CourseAgent from '../../../models/course/agent.model.js';

export async function listAgents(req, res) {
    try {
        const agents = await CourseAgent.find();
        return res.success(agents, 'Список агентов получен', 200);
    } catch (error) {
        return res.error({}, 500, 'Ошибка при получении агентов');
    }
}
