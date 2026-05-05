import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { AuthPayload } from '@mumo/types';
import { unauthorized } from './errors';

const ACCESS_SECRET = () => process.env.JWT_SECRET || 'fallback_dev_secret';
const REFRESH_SECRET = () => process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback_dev_refresh';

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

// ── Signing ──────────────────────────────────────────────────────────────────

export function signAccessToken(payload: AuthPayload): string {
    return jwt.sign(payload, ACCESS_SECRET(), { expiresIn: ACCESS_EXPIRY });
}

export function signRefreshToken(payload: AuthPayload): string {
    return jwt.sign(payload, REFRESH_SECRET(), { expiresIn: REFRESH_EXPIRY });
}

// ── Verification ─────────────────────────────────────────────────────────────

export function verifyAccessToken(token: string): AuthPayload {
    try {
        return jwt.verify(token, ACCESS_SECRET()) as AuthPayload;
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
        return jwt.verify(token, REFRESH_SECRET()) as AuthPayload;
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
