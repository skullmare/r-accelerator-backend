import Role from '../../models/role.model.js';

export async function createRole(req, res) {
    const { name, permissions } = req.validatedData.body;
    const role = await Role.create({ name, permissions });
    return res.success(role, 'Роль создана', 201);
}
