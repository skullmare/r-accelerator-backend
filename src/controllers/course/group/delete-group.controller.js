import CourseGroup from '../../../models/course/group.model.js';

export async function deleteGroup(req, res) {
    const { id } = req.validatedData.params;
    const group = await CourseGroup.findByIdAndDelete(id);
    if (!group) return res.error({}, 404, 'Группа не найдена');
    return res.success({}, 'Группа удалена', 200);
}
