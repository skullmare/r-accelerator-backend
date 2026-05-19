import crypto from 'crypto';
import CourseGroup from '../../../models/course/group.model.js';

export async function updateGroup(req, res) {
    const { id } = req.validatedData.params;
    const { updateQRCode, ...rest } = req.validatedData.body;

    if (updateQRCode) {
        rest.qrCode = crypto.randomBytes(32).toString('hex');
    }

    const group = await CourseGroup.findByIdAndUpdate(id, rest, { returnDocument: 'after' });
    if (!group) return res.error({}, 404, 'Группа не найдена');
    return res.success(group, 'Группа обновлена', 200);
}
