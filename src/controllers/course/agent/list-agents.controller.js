import CourseAgent from '../../../models/course/agent.model.js';

export async function listAgents(req, res) {
    const agents = await CourseAgent.find();
    return res.success(agents, 'Список агентов получен', 200);
}
