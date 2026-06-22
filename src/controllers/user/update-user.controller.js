import User from '../../models/user.model.js';

export async function updateUser(req, res) {
    try {
        const { id } = req.validatedData.params;
        const user = await User.findById(id);
        if (!user) return res.error({}, 404, 'Пользователь не найден');
        if (user.isSystem) return res.error({}, 400, 'Нельзя обновить системного пользователя');

        const { studyPrograms, ...rest } = req.validatedData.body;
        const update = {};
        if (Object.keys(rest).length > 0) update.$set = rest;
        if (studyPrograms !== undefined) update.$set = { ...update.$set, studyPrograms };

        const updatedUser = await User.findByIdAndUpdate(id, update, { returnDocument: 'after' });
        return res.success(updatedUser, 'Пользователь обновлён', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при обновлении пользователя');
    }
}
