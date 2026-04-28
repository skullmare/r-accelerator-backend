const COOKIE_BASE = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    domain: process.env.MAIN_DOMAIN,
};
const COOKIE_REFRESH = {
    ...COOKIE_BASE,
    path: '/api/v1/auth'
};
const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;
export { COOKIE_BASE, COOKIE_REFRESH, CODE_TTL_MS, MAX_ATTEMPTS };