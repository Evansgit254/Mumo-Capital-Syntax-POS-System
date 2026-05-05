import { Request, Response, NextFunction } from 'express';
import { Role } from '@mumo/types';
import { unauthorized, forbidden } from '../lib/errors';

/**
 * Role-based access control middleware factory.
 *
 * Usage: `requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN)`
 *
 * Must be placed AFTER `authenticate` middleware so that `req.user` is populated.
 *
 * Edge cases handled:
 * - req.user missing (authenticate not called first) → 401
 * - req.user.role not in allowedRoles → 403 with descriptive message
 */
export const requireRole = (...allowedRoles: Role[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(unauthorized('Authentication required before role check'));
        }

        const userRole = req.user.role as Role;

        if (!allowedRoles.includes(userRole)) {
            return next(
                forbidden(
                    `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${userRole}`
                )
            );
        }

        next();
    };
};
