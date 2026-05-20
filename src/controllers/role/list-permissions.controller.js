import { getPermissionsForUI } from '../../constants/permissions.constants.js';

export async function listPermissions(req, res) {
    try {
        const permissions = getPermissionsForUI();
        return res.success(permissions, 'Список прав получен', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при получении прав');
    }
}
