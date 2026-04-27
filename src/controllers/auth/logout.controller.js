import { revokeToken } from '../../services/token-blacklist.service.js';

const COOKIE_BASE = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    domain: process.env.MAIN_DOMAIN,
};

async function logout(req, res) {
    const token = req.cookies?.refreshToken;

    if (token) {
        await revokeToken(token);
    }

    res.clearCookie('accessToken', COOKIE_BASE);
    res.clearCookie('refreshToken', COOKIE_BASE);

    return res.success({}, 'Выход выполнен успешно', 200);
}

export default logout;
