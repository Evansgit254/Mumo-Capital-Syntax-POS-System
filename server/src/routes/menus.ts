import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { createMenuItemSchema, updateMenuItemSchema } from '../validators/menu';
import { getTenantId } from '../lib/tenant';
import { Role } from '@mumo/types';

const router = Router();

// ── GET /public (Guest Facing) ───────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = getTenantId(req);
        const items = await prisma.menuItem.findMany({
            where: { tenantId, isAvailable: true },
            orderBy: { name: 'asc' },
        });
        res.json(items.map(item => ({ ...item, price: item.price.toNumber() })));
    } catch (err) {
        next(err);
    }
});

// ── GET /api/menus ───────────────────────────────────────────────────────────
// FIX 4 — CODEX-WARN-012: Paginated list endpoint
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Number(req.query.limit) || 50);
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            prisma.menuItem.findMany({
                where: { tenantId },
                orderBy: { name: 'asc' },
                skip,
                take: limit,
            }),
            prisma.menuItem.count({ where: { tenantId } }),
        ]);

        res.json({
            data: items.map(item => ({ ...item, price: item.price.toNumber() })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        next(err);
    }
});

// ── GET /api/menus/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const item = await prisma.menuItem.findFirst({
            where: { id: req.params.id, tenantId },
        });
        if (!item) throw notFound('Menu item not found');
        res.json({ ...item, price: item.price.toNumber() });
    } catch (err) {
        next(err);
    }
});

// ── GET /api/menus/:id/modifiers ─────────────────────────────────────────────
router.get('/:id/modifiers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        // Verify item exists for this tenant
        const item = await prisma.menuItem.findFirst({
            where: { id: req.params.id, tenantId },
        });
        if (!item) throw notFound('Menu item not found');
        
        // Return empty array as modifiers are not yet in the data model
        // but the client requires this dynamic endpoint.
        res.json([]);
    } catch (err) {
        next(err);
    }
});

// ── POST /api/menus ──────────────────────────────────────────────────────────
router.post(
    '/',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(createMenuItemSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const item = await prisma.menuItem.create({
                data: {
                    tenantId,
                    name: req.body.name,
                    price: new Prisma.Decimal(req.body.price),
                    description: req.body.description,
                    categoryId: req.body.categoryId,
                    isAvailable: req.body.isAvailable ?? true,
                },
            });
            res.status(201).json({ ...item, price: item.price.toNumber() });
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/menus/:id ───────────────────────────────────────────────────────
router.put(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF),
    validate(updateMenuItemSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            // Verify item belongs to this tenant
            const existing = await prisma.menuItem.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Menu item not found');

            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const updated = await prisma.menuItem.update({
                where: { id: req.params.id },
                data: {
                    name: req.body.name,
                    price: req.body.price !== undefined ? new Prisma.Decimal(req.body.price) : undefined,
                    description: req.body.description,
                    categoryId: req.body.categoryId,
                    isAvailable: req.body.isAvailable,
                },
            });
            res.json({ ...updated, price: updated.price.toNumber() });
        } catch (err) {
            next(err);
        }
    }
);

// ── DELETE /api/menus/:id ────────────────────────────────────────────────────
router.delete(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const existing = await prisma.menuItem.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Menu item not found');

            await prisma.menuItem.delete({ where: { id: req.params.id } });
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

export default router;
