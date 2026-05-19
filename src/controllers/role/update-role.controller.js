import Role from '../../models/role.model.js';

export async function updateRole(req, res) {
    try {
        const { id } = req.validatedData.params;

        const role = await Role.findById(id);
        if (!role) return res.error({}, 404, 'Роль не найдена');
        if (role.isSystem) return res.error({}, 403, 'Системную роль нельзя изменить');

        Object.assign(role, req.validatedData.body);
        await role.save();

        return res.success(role, 'Роль обновлена', 200);
    } catch (error) {
        return res.error({}, 500, 'Ошибка при обновлении роли');
    }
}
