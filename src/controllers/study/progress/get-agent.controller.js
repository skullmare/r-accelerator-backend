import StudyAgent from '../../../models/study/agent.model.js';

export async function getProgressAgent(req, res) {
    try {
        const { agentId } = req.validatedData.params;
        // доступность агента уже проверена middleware check-access-agent и check-item-unlocked
        const agent = await StudyAgent.findById(agentId);
        if (!agent) return res.error({}, 404, 'Агент не найден');
        return res.success(agent, 'Агент получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении агента');
    }
}
