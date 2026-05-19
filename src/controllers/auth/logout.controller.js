import { COOKIE_BASE, COOKIE_REFRESH } from '../../constants/auth.constants.js';

export async function logout(req, res) {
    try {
        res.clearCookie('accessToken', COOKIE_BASE);
        res.clearCookie('refreshToken', COOKIE_REFRESH);

        return res.success({}, 'Выход выполнен успешно', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при выходе из системы');
    }
}
