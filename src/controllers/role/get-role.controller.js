import Role from '../../models/role.model.js';

export async function getRole(req, res) {
    try {
        const { id } = req.validatedData.params;
        const role = await Role.findById(id);
        if (!role) return res.error({}, 404, 'Роль не найдена');
        return res.success(role, 'Роль получена', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при получении роли');
    }
}
