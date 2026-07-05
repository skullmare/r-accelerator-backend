import StudyLesson from '../../../models/study/lesson.model.js';

export async function getLesson(req, res) {
    try {
        const { lessonId } = req.validatedData.params;
        const lesson = await StudyLesson.findById(lessonId);
        if (!lesson) return res.error({}, 404, 'Урок не найден');
        return res.success(lesson, 'Урок получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении урока');
    }
}
