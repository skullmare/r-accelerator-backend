import Role from '../../models/role.model.js';

export async function listRoles(req, res) {
    const roles = await Role.find();
    return res.success(roles, 'Список ролей получен', 200);
}
