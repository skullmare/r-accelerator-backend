import Role from '../../models/role.model.js';

export async function listRoles(req, res) {
    try {
        const roles = await Role.find();
        return res.success(roles, 'Список ролей получен', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при получении ролей');
    }
}
