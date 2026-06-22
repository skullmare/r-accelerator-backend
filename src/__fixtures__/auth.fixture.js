import jwt from 'jsonwebtoken';

const JWT_ACCESS_SECRET = 'test-access-secret';
const JWT_REFRESH_SECRET = 'test-refresh-secret';

process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;
process.env.JWT_REFRESH_SECRET = JWT_REFRESH_SECRET;

export function generateAccessToken(payload) {
    return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '1h' });
}

export function authCookie(userId, email = 'test@test.com') {
    const token = generateAccessToken({ id: userId, email });
    return `accessToken=${token}`;
}
