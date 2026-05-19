import User from '../../models/user.model.js';

export async function updateUser(req, res) {
    const { id } = req.validatedData.params;
    const user = await User.findByIdAndUpdate(id, req.validatedData.body, { new: true });
    if (!user) return res.error({}, 404, 'Пользователь не найден');
    return res.success(user, 'Пользователь обновлён', 200);
}
