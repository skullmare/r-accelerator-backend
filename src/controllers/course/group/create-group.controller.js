import crypto from 'crypto';
import CourseGroup from '../../../models/course/group.model.js';

export async function createGroup(req, res) {
    try {
        const { name, agents, active } = req.validatedData.body;
        const qrCode = crypto.randomBytes(32).toString('hex');
        const group = await CourseGroup.create({ name, agents, active, qrCode });
        return res.success(group, 'Группа создана', 201);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при создании группы');
    }
}
