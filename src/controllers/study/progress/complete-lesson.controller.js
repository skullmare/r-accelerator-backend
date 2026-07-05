import StudyProgress from '../../../models/study/progress.model.js';

export async function completeLesson(req, res) {
    try {
        const { programId, lessonId } = req.validatedData.params;

        await StudyProgress.findOneAndUpdate(
            { user: req.user.id, program: programId },
            { $addToSet: { completedItems: lessonId } },
            { upsert: true }
        );

        return res.success({}, 'Урок отмечен как пройденный', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при завершении урока');
    }
}
