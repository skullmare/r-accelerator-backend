import Agent from '../../../models/accelerator/agent.model.js';

export async function listAgents(req, res) {
    try {
        const agents = await Agent.find().sort({ order: 1 });
        return res.success(agents, 'Список агентов получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении агентов');
    }
}
