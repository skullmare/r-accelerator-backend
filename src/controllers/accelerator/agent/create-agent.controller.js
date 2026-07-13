import Agent from '../../../models/accelerator/agent.model.js';

export async function createAgent(req, res) {
    try {
        const data = req.validatedData.body;

        if (data.nextAgentId) {
            const nextExists = await Agent.exists({ _id: data.nextAgentId });
            if (!nextExists) {
                return res.error({ code: 'AGENT_NOT_FOUND', description: `nextAgentId "${data.nextAgentId}" не найден` }, 400, 'nextAgentId должен ссылаться на существующего агента');
            }
        }

        const agent = await Agent.create(data);
        return res.success(agent, 'Агент создан', 201);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при создании агента');
    }
}
