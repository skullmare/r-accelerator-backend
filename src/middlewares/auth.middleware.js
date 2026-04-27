import authService from '../services/auth.service.js';

function authMiddleware(req, res, next) {
    const token = req.cookies?.accessToken;

    if (!token) {
        return res.error({}, 401, 'Требуется авторизация');
    }

    const payload = authService.validateAccessToken(token);

    if (!payload) {
        return res.error({}, 401, 'Недействительный токен');
    }

    req.user = { id: payload.id, email: payload.email };
    next();
}

export default authMiddleware;
