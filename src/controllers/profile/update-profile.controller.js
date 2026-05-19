import User from '../../models/user.model.js';

export async function updateProfile(req, res) {
    try {
        const user = await User.findByIdAndUpdate(req.user.id, req.validatedData.body, { returnDocument: 'after' });
        return res.success(user, 'Профиль обновлён', 200);
    } catch (error) {
        return res.error({}, 500, 'Ошибка при обновлении профиля');
    }
}
