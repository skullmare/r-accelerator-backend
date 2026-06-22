import StudyLesson from '../../../models/study/lesson.model.js';

export async function deleteLesson(req, res) {
    try {
        const { lessonId } = req.validatedData.params;
        const lesson = await StudyLesson.findByIdAndDelete(lessonId);
        if (!lesson) return res.error({}, 404, 'Урок не найден');
        return res.success({}, 'Урок удалён', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при удалении урока');
    }
}
