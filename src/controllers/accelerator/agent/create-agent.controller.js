import Agent from '../../../models/accelerator/agent.model.js';
import Knowledge from '../../../models/accelerator/knowledge.model.js';

export async function createAgent(req, res) {
    try {
        const data = req.validatedData.body;

        if (data.nextAgentId) {
            const nextExists = await Agent.exists({ _id: data.nextAgentId });
            if (!nextExists) {
                return res.error({ code: 'AGENT_NOT_FOUND', description: `nextAgentId "${data.nextAgentId}" не найден` }, 400, 'nextAgentId должен ссылаться на существующего агента');
            }
        }

        if (data.knowledgeIds?.length) {
            const found = await Knowledge.countDocuments({ _id: { $in: data.knowledgeIds } });
            if (found !== data.knowledgeIds.length) {
                return res.error({ code: 'KNOWLEDGE_NOT_FOUND' }, 400, 'knowledgeIds должны ссылаться на существующие базы знаний');
            }
        }

        const agent = await Agent.create(data);
        return res.success(agent, 'Агент создан', 201);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при создании агента');
    }
}
