import CourseGroup from '../../../models/course/group.model.js';

export async function listGroups(req, res) {
    try {
        const groups = await CourseGroup.find().populate('agents');
        return res.success(groups, 'Список групп получен', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при получении групп');
    }
}
