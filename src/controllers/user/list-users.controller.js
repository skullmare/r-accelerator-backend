import User from '../../models/user.model.js';

export async function listUsers(req, res) {
    const users = await User.find().populate('role', 'name').populate('courseGroup', 'name');
    return res.success(users, 'Список пользователей получен', 200);
}
