import User from '../../models/user.model.js';

export async function updateUser(req, res) {
    try {
        const { id } = req.validatedData.params;
        const user = await User.findByIdAndUpdate(id, req.validatedData.body, { returnDocument: 'after' });
        if (!user) return res.error({}, 404, 'Пользователь не найден');
        if (user.isSystem) return res.error({}, 400, 'Нельзя обновить суперадмина');
        return res.success(user, 'Пользователь обновлён', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при обновлении пользователя');
    }
}
