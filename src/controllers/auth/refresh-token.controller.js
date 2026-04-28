import authService from '../../services/auth.service.js';
import { COOKIE_BASE, COOKIE_REFRESH } from '../../constants/auth.constants.js';

export async function refreshToken(req, res) {
    const token = req.cookies?.refreshToken;

    if (!token) {
        return res.error({}, 401, 'Отсутствует refresh токен');
    }

    const payload = authService.validateRefreshToken(token);

    if (!payload) {
        return res.error({}, 401, 'Недействительный refresh токен');
    }

    const { accessToken, refreshToken: newRefreshToken } = authService.generateTokens({
        id: payload.id,
        email: payload.email,
    });

    res.cookie('accessToken', accessToken, {
        ...COOKIE_BASE,
        expires: new Date(Date.now() + 15 * 60 * 1000),
    });
    res.cookie('refreshToken', newRefreshToken, {
        ...COOKIE_REFRESH,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return res.success({ id: payload.id, email: payload.email }, 'Токены обновлены', 200);
}
