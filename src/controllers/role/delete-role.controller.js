import Role from '../../models/role.model.js';

export async function deleteRole(req, res) {
    const { id } = req.validatedData.params;

    const role = await Role.findById(id);
    if (!role) return res.error({}, 404, 'Роль не найдена');
    if (role.isSystem) return res.error({}, 403, 'Системную роль нельзя удалить');

    await role.deleteOne();

    return res.success({}, 'Роль удалена', 200);
}
