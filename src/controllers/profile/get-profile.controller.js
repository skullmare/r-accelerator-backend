import User from '../../models/user.model.js';

export async function getProfile(req, res) {
    const user = await User.findById(req.user.id).populate('role', 'name permissions').populate('courseGroup', 'name');
    if (!user) return res.error({}, 404, 'Пользователь не найден');
    return res.success(user, 'Профиль получен', 200);
}
