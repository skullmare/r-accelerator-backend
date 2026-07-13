import Agent from '../../../models/accelerator/agent.model.js';

export async function updateAgent(req, res) {
    try {
        const { agentId } = req.validatedData.params;
        const updates = req.validatedData.body;

        const agent = await Agent.findById(agentId);
        if (!agent) {
            return res.error({ code: 'AGENT_NOT_FOUND' }, 404, 'Агент не найден');
        }

        if (updates.nextAgentId) {
            const nextExists = await Agent.exists({ _id: updates.nextAgentId });
            if (!nextExists) {
                return res.error({ code: 'AGENT_NOT_FOUND', description: `nextAgentId "${updates.nextAgentId}" не найден` }, 400, 'nextAgentId должен ссылаться на существующего агента');
            }
        }

        Object.assign(agent, updates);
        await agent.save();

        return res.success(agent, 'Агент обновлён', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при обновлении агента');
    }
}
