import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { updateTenantSettingsSchema } from '../validators/tenant-settings';
import { Role } from '@mumo/types';

const router = Router();

// ── GET /api/tenants/settings ───────────────────────────────────────────────
router.get(
    '/settings',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            // Upsert: return existing or create with defaults
            const settings = await prisma.tenantSettings.upsert({
                where: { tenantId },
                create: { tenantId },
                update: {},
            });

            res.json(settings);
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/tenants/settings ───────────────────────────────────────────────
router.put(
    '/settings',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
    validate(updateTenantSettingsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const settings = await prisma.tenantSettings.upsert({
                where: { tenantId },
                create: { tenantId, ...req.body },
                update: req.body,
            });

            res.json(settings);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
