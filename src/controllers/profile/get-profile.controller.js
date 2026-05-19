import User from '../../models/user.model.js';

export async function getProfile(req, res) {
    try {
        const user = await User.findById(req.user.id).populate('role', 'name permissions').populate('courseGroup', 'name');
        if (!user) return res.error({}, 404, 'Пользователь не найден');
        return res.success(user, 'Профиль получен', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при получении профиля');
    }
}
