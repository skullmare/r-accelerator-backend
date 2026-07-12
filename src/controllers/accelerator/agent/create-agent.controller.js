import Agent from '../../../models/accelerator/agent.model.js';

export async function createAgent(req, res) {
    try {
        const data = req.validatedData.body;

        const existing = await Agent.findOne({ code: data.code });
        if (existing) {
            return res.error({ code: 'AGENT_CODE_TAKEN', description: `Агент с code "${data.code}" уже существует` }, 409, 'Код агента уже используется');
        }

        if (data.nextAgentCode) {
            const nextExists = await Agent.exists({ code: data.nextAgentCode });
            if (!nextExists) {
                return res.error({ code: 'AGENT_NOT_FOUND', description: `nextAgentCode "${data.nextAgentCode}" не найден` }, 400, 'nextAgentCode должен ссылаться на существующего агента');
            }
        }

        const agent = await Agent.create(data);
        return res.success(agent, 'Агент создан', 201);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при создании агента');
    }
}
