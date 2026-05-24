import User from '../../models/user.model.js';

export async function updateUserRole(req, res) {
    try {
        const { id } = req.validatedData.params;
        const { role } = req.validatedData.body;
        const user = await User.findById(id);
        if (!user) return res.error({}, 404, 'Пользователь не найден');
        if (user.isSystem) return res.error({}, 400, 'Нельзя обновить роль суперадмина');
        const update = role === null ? { $unset: { role: 1 } } : { $set: { role } };
        const updatedUser = await User.findByIdAndUpdate(id, update, { returnDocument: 'after' }).populate('role', 'name permissions');
        return res.success(updatedUser, 'Роль пользователя обновлена', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при обновлении роли пользователя');
    }
}
