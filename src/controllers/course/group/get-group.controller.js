import CourseGroup from '../../../models/course/group.model.js';

export async function getGroup(req, res) {
    const { id } = req.validatedData.params;
    const group = await CourseGroup.findById(id).populate('agents');
    if (!group) return res.error({}, 404, 'Группа не найдена');
    return res.success(group, 'Группа получена', 200);
}
