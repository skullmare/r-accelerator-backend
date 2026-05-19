import User from '../../models/user.model.js';

export async function updateProfile(req, res) {
    const user = await User.findByIdAndUpdate(req.user.id, req.validatedData.body, { returnDocument: 'after' });
    return res.success(user, 'Профиль обновлён', 200);
}
