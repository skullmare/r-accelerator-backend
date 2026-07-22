import Agent from '../../../models/accelerator/agent.model.js';

export async function getAgent(req, res) {
    try {
        const { agentId } = req.validatedData.params;
        const agent = await Agent.findById(agentId);

        if (!agent) {
            return res.error({ code: 'AGENT_NOT_FOUND' }, 404, 'Агент не найден');
        }

        return res.success(agent, 'Агент получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении агента');
    }
}
