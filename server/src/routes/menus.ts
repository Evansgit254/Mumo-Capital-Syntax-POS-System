import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { createMenuItemSchema, updateMenuItemSchema } from '../validators/menu';
import { Role } from '@mumo/types';

const router = Router();

// ── GET /public (Guest Facing) ───────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
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
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const items = await prisma.menuItem.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
        });
        res.json(items.map(item => ({ ...item, price: item.price.toNumber() })));
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

// ── POST /api/menus ──────────────────────────────────────────────────────────
router.post(
    '/',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(createMenuItemSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const item = await prisma.menuItem.create({
                data: { ...req.body, tenantId },
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
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(updateMenuItemSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            // Verify item belongs to this tenant
            const existing = await prisma.menuItem.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Menu item not found');

            const updated = await prisma.menuItem.update({
                where: { id: req.params.id },
                data: req.body,
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
