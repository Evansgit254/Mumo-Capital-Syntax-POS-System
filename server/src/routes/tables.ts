import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { createTableSchema, updateTableSchema } from '../validators/table';
import { Role } from '@mumo/types';

const router = Router();

// ── GET /public (Guest Facing) ───────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const tables = await prisma.table.findMany({
            where: { tenantId },
            orderBy: { number: 'asc' },
        });
        res.json(tables);
    } catch (err) {
        next(err);
    }
});

// ── GET /api/tables ──────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const tables = await prisma.table.findMany({
            where: { tenantId },
            orderBy: { number: 'asc' },
        });
        res.json(tables);
    } catch (err) {
        next(err);
    }
});

// ── GET /api/tables/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const table = await prisma.table.findFirst({
            where: { id: req.params.id, tenantId },
            include: {
                orders: {
                    where: { status: { not: 'CANCELLED' } },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });
        if (!table) throw notFound('Table not found');
        res.json(table);
    } catch (err) {
        next(err);
    }
});

// ── GET /api/tables/:id/orders ──────────────────────────────────────────────
router.get('/:id/orders', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;

        // Verify table belongs to tenant
        const table = await prisma.table.findFirst({
            where: { id: req.params.id, tenantId },
        });
        if (!table) throw notFound('Table not found');

        const orders = await prisma.order.findMany({
            where: {
                tenantId,
                tableId: req.params.id,
                status: { notIn: ['CANCELLED', 'SERVED'] },
            },
            include: {
                items: { include: { menuItem: { select: { name: true, price: true } } } },
                user: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(orders);
    } catch (err) {
        next(err);
    }
});

// ── POST /api/tables ─────────────────────────────────────────────────────────
router.post(
    '/',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(createTableSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const table = await prisma.table.create({
                data: { ...req.body, tenantId },
            });
            res.status(201).json(table);
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/tables/:id ──────────────────────────────────────────────────────
router.put(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(updateTableSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const existing = await prisma.table.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Table not found');

            const updated = await prisma.table.update({
                where: { id: req.params.id },
                data: req.body,
            });
            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

// ── DELETE /api/tables/:id ───────────────────────────────────────────────────
router.delete(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const existing = await prisma.table.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Table not found');

            await prisma.table.delete({ where: { id: req.params.id } });
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /api/tables/:id/settle ──────────────────────────────────────────────
// Finalizes table orders and marks table as available.
router.post(
    '/:id/settle',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { id } = req.params;

            // Verify table and tenant
            const table = await prisma.table.findFirst({ where: { id, tenantId } });
            if (!table) throw notFound('Table not found');

            // Update all active orders to SERVED
            await prisma.order.updateMany({
                where: { 
                    tableId: id, 
                    tenantId, 
                    status: { notIn: ['CANCELLED', 'SERVED'] } 
                },
                data: { status: 'SERVED' }
            });

            // Mark table as available
            const updated = await prisma.table.update({
                where: { id },
                data: { isOccupied: false }
            });

            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /api/tables/:id/transfer ─────────────────────────────────────────────
// Moves all active orders from current table to another target table.
router.post(
    '/:id/transfer',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { id } = req.params;
            const { targetTableId } = req.body;

            if (!targetTableId) throw new Error('Target table ID is required');

            // 1. Verify both tables belong to tenant
            const tables = await prisma.table.findMany({
                where: { id: { in: [id, targetTableId] }, tenantId }
            });
            if (tables.length < 2) throw notFound('One or both tables not found');

            const sourceTable = tables.find(t => t.id === id);
            const targetTable = tables.find(t => t.id === targetTableId);

            if (targetTable?.isOccupied) throw new Error('Target table is already occupied');

            // 2. Transfer orders
            await prisma.order.updateMany({
                where: { tableId: id, tenantId, status: { notIn: ['CANCELLED', 'SERVED'] } },
                data: { tableId: targetTableId }
            });

            // 3. Swap occupancy status
            await prisma.table.update({ where: { id }, data: { isOccupied: false } });
            const updated = await prisma.table.update({ where: { id: targetTableId }, data: { isOccupied: true } });

            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /api/tables/:id/merge ────────────────────────────────────────────────
// Merges all active orders from source table into target table.
router.post(
    '/:id/merge',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { id } = req.params; // Source table
            const { targetTableId } = req.body;

            if (!targetTableId) throw new Error('Target table ID is required');

            // 1. Verify tables
            const tables = await prisma.table.findMany({
                where: { id: { in: [id, targetTableId] }, tenantId }
            });
            if (tables.length < 2) throw notFound('One or both tables not found');

            // 2. Move orders
            await prisma.order.updateMany({
                where: { tableId: id, tenantId, status: { notIn: ['CANCELLED', 'SERVED'] } },
                data: { tableId: targetTableId }
            });

            // 3. Release source table
            const updated = await prisma.table.update({ where: { id }, data: { isOccupied: false } });

            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
