import StudyLesson from '../../../models/study/lesson.model.js';

export async function getLesson(req, res) {
    try {
        const { lessonId } = req.validatedData.params;
        // возвращаем полный урок включая questions с isCorrect для admin-просмотра
        const lesson = await StudyLesson.findById(lessonId).select('+questions.answerOptions.isCorrect');
        if (!lesson) return res.error({}, 404, 'Урок не найден');
        return res.success(lesson, 'Урок получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении урока');
    }
}
