import StudyProgress from '../../../models/study/progress.model.js';

export async function completeAgent(req, res) {
    try {
        const { programId, agentId } = req.validatedData.params;

        await StudyProgress.findOneAndUpdate(
            { user: req.user.id, program: programId },
            { $addToSet: { completedItems: agentId } },
            { upsert: true }
        );

        return res.success({}, 'Агент отмечен как пройденный', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при завершении агента');
    }
}
