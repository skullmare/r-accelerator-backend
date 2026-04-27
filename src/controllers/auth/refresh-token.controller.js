import authService from '../../services/auth.service.js';
import { blacklist } from '../../services/token-blacklist.service.js';

const COOKIE_BASE = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    domain: process.env.MAIN_DOMAIN,
};

async function refreshToken(req, res) {
    const token = req.cookies?.refreshToken;

    if (!token) {
        return res.error({}, 401, 'Отсутствует refresh токен');
    }

    if (blacklist.has(token)) {
        return res.error({}, 401, 'Токен отозван');
    }

    const payload = authService.validateRefreshToken(token);

    if (!payload) {
        return res.error({}, 401, 'Недействительный refresh токен');
    }

    blacklist.add(token);

    const { accessToken, refreshToken: newRefreshToken } = authService.generateTokens({
        id: payload.id,
        email: payload.email,
    });

    res.cookie('accessToken', accessToken, {
        ...COOKIE_BASE,
        expires: new Date(Date.now() + 15 * 60 * 1000),
    });
    res.cookie('refreshToken', newRefreshToken, {
        ...COOKIE_BASE,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return res.success({ id: payload.id, email: payload.email }, 'Токены обновлены', 200);
}

export default refreshToken;
