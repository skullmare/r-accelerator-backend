import CourseGroup from '../../../models/course/group.model.js';

export async function getGroup(req, res) {
    try {
        const { id } = req.validatedData.params;
        const group = await CourseGroup.findById(id).populate('agents');
        if (!group) return res.error({}, 404, 'Группа не найдена');
        return res.success(group, 'Группа получена', 200);
    } catch (error) {
        return res.error({}, 500, 'Ошибка при получении группы');
    }
}
