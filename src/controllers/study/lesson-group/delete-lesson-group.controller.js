import LessonGroup from '../../../models/study/lesson-group.model.js';
import StudyLesson from '../../../models/study/lesson.model.js';

export async function deleteLessonGroup(req, res) {
    try {
        const { groupId } = req.validatedData.params;
        const group = await LessonGroup.findByIdAndDelete(groupId);
        if (!group) return res.error({}, 404, 'Группа не найдена');
        // обнуляем group у уроков, которые принадлежали этой группе
        await StudyLesson.updateMany({ group: groupId }, { group: null });
        return res.success({}, 'Группа удалена', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при удалении группы');
    }
}
