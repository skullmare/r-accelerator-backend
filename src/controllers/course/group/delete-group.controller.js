import CourseGroup from '../../../models/course/group.model.js';

export async function deleteGroup(req, res) {
    try {
        const { id } = req.validatedData.params;
        const group = await CourseGroup.findByIdAndDelete(id);
        if (!group) return res.error({}, 404, 'Группа не найдена');
        return res.success({}, 'Группа удалена', 200);
    } catch (error) {
        return res.error({}, 500, 'Ошибка при удалении группы');
    }
}
