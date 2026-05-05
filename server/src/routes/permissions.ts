import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { updatePermissionsSchema } from '../validators/permissions';
import { Role } from '@mumo/types';

const router = Router();

/**
 * Default permission sets.
 * These serve as a reference when no custom permissions have been configured for a tenant.
 */
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
    [Role.STAFF]: [
        'pos:create_order',
        'pos:view_menu',
        'tables:view',
        'reservations:view',
        'customers:view',
    ],
    [Role.MANAGER]: [
        'pos:create_order',
        'pos:view_menu',
        'pos:manage_menu',
        'tables:view',
        'tables:manage',
        'orders:manage_status',
        'reservations:view',
        'reservations:manage',
        'customers:view',
        'customers:manage',
        'inventory:view',
        'inventory:manage',
        'reports:view',
        'discounts:redeem',
    ],
    [Role.TENANT_ADMIN]: [
        'pos:create_order',
        'pos:view_menu',
        'pos:manage_menu',
        'tables:view',
        'tables:manage',
        'orders:manage_status',
        'reservations:view',
        'reservations:manage',
        'customers:view',
        'customers:manage',
        'inventory:view',
        'inventory:manage',
        'inventory:delete',
        'reports:view',
        'discounts:redeem',
        'settings:view',
        'settings:manage',
        'staff:manage_permissions',
    ],
};

// ── GET /api/roles/:role/permissions ─────────────────────────────────────────
router.get(
    '/:role/permissions',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const role = req.params.role.toUpperCase();

            // Validate the role string is a known role
            if (!Object.values(Role).includes(role as Role)) {
                throw notFound(`Unknown role: ${role}`);
            }

            // Look for tenant-specific override
            const custom = await prisma.rolePermission.findUnique({
                where: { tenantId_role: { tenantId, role } },
            });

            if (custom) {
                res.json({ role, permissions: custom.permissions, isCustom: true });
            } else {
                res.json({
                    role,
                    permissions: DEFAULT_PERMISSIONS[role] || [],
                    isCustom: false,
                });
            }
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/roles/:role/permissions ─────────────────────────────────────────
router.put(
    '/:role/permissions',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
    validate(updatePermissionsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const role = req.params.role.toUpperCase();
            const { permissions } = req.body;

            if (!Object.values(Role).includes(role as Role)) {
                throw notFound(`Unknown role: ${role}`);
            }

            const result = await prisma.rolePermission.upsert({
                where: { tenantId_role: { tenantId, role } },
                create: { tenantId, role, permissions },
                update: { permissions },
            });

            res.json({ role, permissions: result.permissions, isCustom: true });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
