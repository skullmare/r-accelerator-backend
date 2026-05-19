import Role from '../../models/role.model.js';

export async function createRole(req, res) {
    try {
        const { name, permissions } = req.validatedData.body;
        const role = await Role.create({ name, permissions });
        return res.success(role, 'Роль создана', 201);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при создании роли');
    }
}
