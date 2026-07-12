import Agent from '../../../models/accelerator/agent.model.js';
import { resolveCurrentAgent } from '../../../services/accelerator/expert-session.service.js';

export async function getExpertRoute(req, res) {
    try {
        const project = req.project;
        const [agents, currentAgent] = await Promise.all([
            Agent.find({ isActive: true }).sort({ order: 1 }),
            resolveCurrentAgent(project)
        ]);
        const currentAgentCode = currentAgent?.code ?? null;

        const items = agents.map((agent) => ({
            code: agent.code,
            name: agent.name,
            status: project.completedAgentCodes.includes(agent.code)
                ? 'completed'
                : agent.code === currentAgentCode ? 'current' : 'locked',
            nextAgentCode: agent.nextAgentCode
        }));

        return res.success({ currentAgentCode, items }, 'Маршрут агентов получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении маршрута агентов');
    }
}
