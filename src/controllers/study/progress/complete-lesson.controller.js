import StudyProgress from '../../../models/study/progress.model.js';
import StudyLesson from '../../../models/study/lesson.model.js';

export async function completeLesson(req, res) {
    try {
        const { programId, lessonId } = req.validatedData.params;
        const { quizAnswers } = req.validatedData.body;

        // upsert документ прогресса и добавляем lessonId в completedItems
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

        // вычисляем результат теста
        const lesson = await StudyLesson.findById(lessonId).select('+questions.answerOptions.isCorrect');
        const correctMap = new Map();
        for (const q of lesson?.questions ?? []) {
            for (const a of q.answerOptions) {
                if (a.isCorrect) correctMap.set(q._id.toString(), a._id.toString());
            }
        }

        const questions = (quizAnswers ?? []).map(({ questionId, answerId }) => ({
            questionId,
            answerId,
            isCorrect: correctMap.get(questionId.toString()) === answerId.toString()
        }));

        const score = questions.filter(q => q.isCorrect).length;

        return res.success({ score, total: questions.length, questions }, 'Урок отмечен как пройденный', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при завершении урока');
    }
}
