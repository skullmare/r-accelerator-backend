import CourseGroup from '../../../models/course/group.model.js';
import User from '../../../models/user.model.js';

export async function addToGroup(req, res) {
    const { qrCode } = req.validatedData.body;

    const group = await CourseGroup.findOne({ qrCode, active: true });
    if (!group) return res.error({}, 404, 'Группа не найдена или неактивна');

    await User.findByIdAndUpdate(req.user.id, { courseGroup: group._id });
    return res.success({ groupId: group._id }, 'Вы добавлены в группу', 200);
}
