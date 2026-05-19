import User from '../../models/user.model.js';

export async function updateUserRole(req, res) {
    const { id } = req.validatedData.params;
    const { role } = req.validatedData.body;
    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).populate('role', 'name permissions');
    if (!user) return res.error({}, 404, 'Пользователь не найден');
    return res.success(user, 'Роль пользователя обновлена', 200);
}
