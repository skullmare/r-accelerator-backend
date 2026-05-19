import User from '../../models/user.model.js';

export async function listUsers(req, res) {
    try {
        const { page, limit, email } = req.validatedData.query;
        const skip = (page - 1) * limit;

        const filter = {};
        if (email) {
            filter.email = { $regex: email, $options: 'i' };
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .populate('role', 'name')
                .populate('courseGroup', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(total / limit);

        return res.success(
            { users, pagination: { page, limit, total, totalPages, hasMore: page < totalPages } },
            'Список пользователей получен',
            200
        );
    } catch (error) {
        return res.error({}, 500, 'Ошибка при получении пользователей');
    }
}
