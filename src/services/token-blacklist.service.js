import jwt from 'jsonwebtoken';
import RevokedToken from '../models/revoked-token.model.js';

export async function isRevoked(token) {
    return !!(await RevokedToken.exists({ token }));
}

export async function revokeToken(token) {
    const decoded = jwt.decode(token);
    const expiresAt = decoded?.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await RevokedToken.create({ token, expiresAt });
}
