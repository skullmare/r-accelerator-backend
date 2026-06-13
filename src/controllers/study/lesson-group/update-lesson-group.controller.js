import LessonGroup from '../../../models/study/lesson-group.model.js';

export async function updateLessonGroup(req, res) {
    try {
        const { groupId } = req.validatedData.params;
        const { name } = req.validatedData.body;
        const group = await LessonGroup.findByIdAndUpdate(groupId, { name }, { returnDocument: 'after' });
        if (!group) return res.error({}, 404, 'Группа не найдена');
        return res.success(group, 'Группа обновлена', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при обновлении группы');
    }
}
