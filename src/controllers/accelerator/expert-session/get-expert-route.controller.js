import Agent from '../../../models/accelerator/agent.model.js';
import { resolveCurrentAgent } from '../../../services/accelerator/expert-session.service.js';

export async function getExpertRoute(req, res) {
    try {
        const project = req.project;
        const [agents, currentAgent] = await Promise.all([
            Agent.find({ isActive: true }).sort({ order: 1 }),
            resolveCurrentAgent(project)
        ]);
        const currentAgentId = currentAgent?._id ?? null;

        const items = agents.map((agent) => ({
            _id: agent._id,
            name: agent.name,
            status: project.completedAgentIds.some((id) => id.equals(agent._id))
                ? 'completed'
                : currentAgentId && agent._id.equals(currentAgentId) ? 'current' : 'locked',
            nextAgentId: agent.nextAgentId
        }));

        return res.success({ currentAgentId, items }, 'Маршрут агентов получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении маршрута агентов');
    }
}
