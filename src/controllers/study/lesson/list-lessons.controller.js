import StudyLesson from '../../../models/study/lesson.model.js';

export async function listLessons(req, res) {
    try {
        // возвращаем только мета-данные без content и questions — для списка этого достаточно
        const lessons = await StudyLesson.find({}, 'name video presentation createdAt');
        return res.success(lessons, 'Список уроков получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении уроков');
    }
}
