import User from '../../models/user.model.js';

export async function getUser(req, res) {
    try {
        const { id } = req.validatedData.params;
        const user = await User.findById(id).populate('role', 'name permissions').populate('courseGroup', 'name');
        if (!user) return res.error({}, 404, 'Пользователь не найден');
        return res.success(user, 'Пользователь получен', 200);
    } catch (error) {
        return res.error({}, 500, 'Ошибка при получении пользователя');
    }
}
