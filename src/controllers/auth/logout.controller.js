import { COOKIE_BASE, COOKIE_REFRESH } from '../../constants/auth.constants.js';

export async function logout(req, res) {
    const token = req.cookies?.refreshToken;

    res.clearCookie('accessToken', COOKIE_BASE);
    res.clearCookie('refreshToken', COOKIE_REFRESH);

    return res.success({}, 'Выход выполнен успешно', 200);
}
