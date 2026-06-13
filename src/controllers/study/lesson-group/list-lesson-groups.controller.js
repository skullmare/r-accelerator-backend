import LessonGroup from '../../../models/study/lesson-group.model.js';

export async function listLessonGroups(req, res) {
    try {
        const groups = await LessonGroup.find({}, 'name createdAt');
        return res.success(groups, 'Список групп получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении групп');
    }
}
