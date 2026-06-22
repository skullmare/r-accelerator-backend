import StudyLesson from '../../../models/study/lesson.model.js';
import StudyProgress from '../../../models/study/progress.model.js';

export async function getProgressLesson(req, res) {
    try {
        const { programId, lessonId } = req.validatedData.params;

        // загружаем урок без isCorrect — пользователь не должен видеть правильные ответы
        const lesson = await StudyLesson.findById(lessonId);
        if (!lesson) return res.error({}, 404, 'Урок не найден');

        const progress = await StudyProgress.findOne(
            { user: req.user.id, program: programId },
            'lessonDetails'
        );

        // подмешиваем userAnswer к каждому вопросу из сохранённых ответов пользователя
        const lessonDetail = progress?.lessonDetails?.find(d => d.item.equals(lessonId));
        const answersMap = new Map((lessonDetail?.quizAnswers ?? []).map(a => [a.questionId.toString(), a.answerId]));

        const questions = lesson.questions.map(q => ({
            _id: q._id,
            questionText: q.questionText,
            answerOptions: q.answerOptions,
            userAnswer: answersMap.get(q._id.toString()) ?? null
        }));

        return res.success(
            { ...lesson.toObject(), questions },
            'Урок получен',
            200
        );
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении урока');
    }
}
