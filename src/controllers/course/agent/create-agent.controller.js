import CourseAgent from '../../../models/course/agent.model.js';

export async function createAgent(req, res) {
    const { name, description, avatar, openAiAssistantId, baseMessages } = req.validatedData.body;
    const agent = await CourseAgent.create({ name, description, avatar, openAiAssistantId, baseMessages });
    return res.success(agent, 'Агент создан', 201);
}
