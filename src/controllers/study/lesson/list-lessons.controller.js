import StudyLesson from '../../../models/study/lesson.model.js';
import LessonGroup from '../../../models/study/lesson-group.model.js';

export async function listLessons(req, res) {
    try {
        const [lessons, groups] = await Promise.all([
            StudyLesson.find({}, 'name cover group video presentation createdAt').populate('group', 'name'),
            LessonGroup.find({}, 'name createdAt')
        ]);
        return res.success({ lessons, groups }, 'Список уроков и групп получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении уроков');
    }
}
