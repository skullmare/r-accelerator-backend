import CourseGroup from '../../../models/course/group.model.js';
import User from '../../../models/user.model.js';

export async function addToGroup(req, res) {
    try {
        const { qrCode } = req.validatedData.body;

        const group = await CourseGroup.findOne({ qrCode });
        if (!group) return res.error({}, 404, 'Группа не найдена');

        await User.findByIdAndUpdate(req.user.id, { courseGroup: group._id });
        return res.success({ groupId: group._id }, 'Вы добавлены в группу', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при вступлении в группу');
    }
}
