import CourseGroup from '../../../models/course/group.model.js';

export async function listGroups(req, res) {
    const groups = await CourseGroup.find().populate('agents');
    return res.success(groups, 'Список групп получен', 200);
}
