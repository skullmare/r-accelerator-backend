import StudyProgress from '../../../models/study/progress.model.js';

export async function completeLesson(req, res) {
    try {
        const { programId, lessonId } = req.validatedData.params;
        const { quizAnswers } = req.validatedData.body;

        // добавляем lessonId в completedItems (если ещё нет) и сохраняем ответы на тест
        // используем upsert чтобы создать прогресс если его ещё нет
        await StudyProgress.findOneAndUpdate(
            { user: req.user.id, program: programId },
            {
                $addToSet: { completedItems: lessonId },
                $set: { 'lessonDetails.$[detail].quizAnswers': quizAnswers }
            },
            {
                arrayFilters: [{ 'detail.item': lessonId }],
                upsert: true
            }
        );

        // если lessonDetail для этого урока ещё не существует — создаём его
        await StudyProgress.findOneAndUpdate(
            { user: req.user.id, program: programId, 'lessonDetails.item': { $ne: lessonId } },
            { $push: { lessonDetails: { item: lessonId, quizAnswers } } }
        );

        return res.success({}, 'Урок отмечен как пройденный', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при завершении урока');
    }
}
