import Role from '../../models/role.model.js';

export async function getRole(req, res) {
    const { id } = req.validatedData.params;
    const role = await Role.findById(id);
    if (!role) return res.error({}, 404, 'Роль не найдена');
    return res.success(role, 'Роль получена', 200);
}
