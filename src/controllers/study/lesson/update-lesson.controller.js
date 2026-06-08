import StudyLesson from '../../../models/study/lesson.model.js';

export async function updateLesson(req, res) {
    try {
        const { lessonId } = req.validatedData.params;
        const lesson = await StudyLesson.findByIdAndUpdate(lessonId, req.validatedData.body, { returnDocument: 'after' });
        if (!lesson) return res.error({}, 404, 'Урок не найден');
        return res.success(lesson, 'Урок обновлён', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при обновлении урока');
    }
}
