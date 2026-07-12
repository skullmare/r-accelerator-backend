import Agent from '../../../models/accelerator/agent.model.js';

export async function updateAgent(req, res) {
    try {
        const { agentId } = req.validatedData.params;
        const updates = req.validatedData.body;

        const agent = await Agent.findById(agentId);
        if (!agent) {
            return res.error({ code: 'AGENT_NOT_FOUND' }, 404, 'Агент не найден');
        }

        if (updates.code && updates.code !== agent.code) {
            const codeTaken = await Agent.exists({ code: updates.code, _id: { $ne: agent._id } });
            if (codeTaken) {
                return res.error({ code: 'AGENT_CODE_TAKEN', description: `Агент с code "${updates.code}" уже существует` }, 409, 'Код агента уже используется');
            }
        }

        if (updates.nextAgentCode) {
            const nextExists = await Agent.exists({ code: updates.nextAgentCode });
            if (!nextExists) {
                return res.error({ code: 'AGENT_NOT_FOUND', description: `nextAgentCode "${updates.nextAgentCode}" не найден` }, 400, 'nextAgentCode должен ссылаться на существующего агента');
            }
        }

        Object.assign(agent, updates);
        await agent.save();

        return res.success(agent, 'Агент обновлён', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при обновлении агента');
    }
}
