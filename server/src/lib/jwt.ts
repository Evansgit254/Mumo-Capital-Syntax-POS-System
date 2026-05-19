import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { AuthPayload } from '@mumo/types';
import { unauthorized } from './errors';

const getSecret = (envVar: string): string => {
    const secret = process.env[envVar];
    if (!secret) {
        throw new Error(
            `FATAL: ${envVar} is not set. Server cannot start without it.`
        );
    }
    return secret;
};

const ACCESS_SECRET = getSecret('JWT_SECRET');
const REFRESH_SECRET = getSecret('JWT_REFRESH_SECRET');

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

// ── Signing ──────────────────────────────────────────────────────────────────

export function signAccessToken(payload: AuthPayload): string {
    return jwt.sign(payload, ACCESS_SECRET, { algorithm: 'HS256', expiresIn: ACCESS_EXPIRY });
}

export function signRefreshToken(payload: AuthPayload): string {
    return jwt.sign(payload, REFRESH_SECRET, { algorithm: 'HS256', expiresIn: REFRESH_EXPIRY });
}

// ── Verification ─────────────────────────────────────────────────────────────

export function verifyAccessToken(token: string): AuthPayload {
    try {
        return jwt.verify(token, ACCESS_SECRET, { algorithms: ['HS256'] }) as AuthPayload;
    } catch (err) {
        if (err instanceof TokenExpiredError) {
            throw unauthorized('Token has expired');
        }
        if (err instanceof JsonWebTokenError) {
            throw unauthorized('Invalid token');
        }
        throw unauthorized('Token verification failed');
    }
}

export function verifyRefreshToken(token: string): AuthPayload {
    try {
        return jwt.verify(token, REFRESH_SECRET, { algorithms: ['HS256'] }) as AuthPayload;
    } catch (err) {
        if (err instanceof TokenExpiredError) {
            throw unauthorized('Refresh token has expired');
        }
        if (err instanceof JsonWebTokenError) {
            throw unauthorized('Invalid refresh token');
        }
        throw unauthorized('Refresh token verification failed');
    }
}
