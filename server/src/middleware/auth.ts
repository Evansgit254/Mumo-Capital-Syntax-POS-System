import { Request, Response, NextFunction } from 'express';
import { AuthPayload, Role } from '@mumo/types';
import { verifyAccessToken } from '../lib/jwt';
import { unauthorized, forbidden, AppError } from '../lib/errors';

// ── Augment Express Request ──────────────────────────────────────────────────
declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

/**
 * Authentication middleware.
 *
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies and decodes the JWT
 * 3. Validates that the `x-tenant-id` request header matches the JWT tenantId
 * 4. Attaches typed `req.user` for downstream handlers
 *
 * Edge cases handled:
 * - Missing/malformed Authorization header → 401
 * - Expired token → 401 (via verifyAccessToken)
 * - Invalid/tampered token → 401 (via verifyAccessToken)
 * - Missing x-tenant-id header → 403
 * - x-tenant-id mismatch with JWT → 403
 */
/**
 * Public tenant extraction middleware.
 * Use for guest-facing routes that don't require JWT auth.
 */
export const extractTenant = (req: Request, _res: Response, next: NextFunction) => {
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;

    if (!headerTenantId) {
        return next(forbidden('Missing x-tenant-id header'));
    }
    
    // For convenience, attach a partial user object
    req.user = { tenantId: headerTenantId, userId: 'guest', role: Role.STAFF } as any;
    next();
};

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {

    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw unauthorized('Missing or malformed Authorization header');
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            throw unauthorized('Token not provided');
        }

        // Decode — throws AppError on expiry or invalidity
        const decoded = verifyAccessToken(token);

        // ── Tenant ID cross-validation ───────────────────────────────────────────
        const headerTenantId = req.headers['x-tenant-id'] as string | undefined;

        if (!headerTenantId) {
            throw forbidden('Missing x-tenant-id header');
        }

        if (headerTenantId !== decoded.tenantId) {
            throw forbidden('Tenant ID mismatch: x-tenant-id header does not match token');
        }

        // Attach to request
        req.user = decoded;
        next();
    } catch (err) {
        // If it's already an AppError, pass it through
        if (err instanceof AppError) {
            return next(err);
        }
        // Unexpected error
        return next(unauthorized('Authentication failed'));
    }
};
