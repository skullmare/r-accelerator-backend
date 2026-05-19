import User from '../../models/user.model.js';

export async function updateUserRole(req, res) {
    const { id } = req.validatedData.params;
    const { role } = req.validatedData.body;
    const user = await User.findById(id);
    if (!user) return res.error({}, 404, 'Пользователь не найден');
    if (user.isSystem) return res.error({}, 400, 'Нельзя обновить роль суперадмина');
    const updatedUser = await User.findByIdAndUpdate(id, { role }, { new: true }).populate('role', 'name permissions');
    return res.success(updatedUser, 'Роль пользователя обновлена', 200);
}
