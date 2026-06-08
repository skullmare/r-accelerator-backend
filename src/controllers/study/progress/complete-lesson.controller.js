import StudyProgress from '../../../models/study/progress.model.js';

export async function completeLesson(req, res) {
    try {
        const { programId, lessonId } = req.validatedData.params;
        const { quizAnswers } = req.validatedData.body;

        // уpsert документ прогресса и добавляем lessonId в completedItems
        await StudyProgress.findOneAndUpdate(
            { user: req.user.id, program: programId },
            { $addToSet: { completedItems: lessonId } },
            { upsert: true }
        );

        // обновляем существующий lessonDetail если есть
        const updateResult = await StudyProgress.updateOne(
            { user: req.user.id, program: programId, 'lessonDetails.item': lessonId },
            { $set: { 'lessonDetails.$.quizAnswers': quizAnswers } }
        );

        // если lessonDetail для этого урока ещё не существует — создаём его
        if (updateResult.matchedCount === 0) {
            await StudyProgress.updateOne(
                { user: req.user.id, program: programId },
                { $push: { lessonDetails: { item: lessonId, quizAnswers } } }
            );
        }

        return res.success({}, 'Урок отмечен как пройденный', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при завершении урока');
    }
}
