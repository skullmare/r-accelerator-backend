import StudyAgent from '../../../models/study/agent.model.js';

export async function createAgent(req, res) {
    try {
        const { name, description, role, avatar, openAiAssistantId } = req.validatedData.body;
        const agent = await StudyAgent.create({ name, description, role, avatar, openAiAssistantId });
        return res.success(agent, 'Агент создан', 201);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при создании агента');
    }
}
