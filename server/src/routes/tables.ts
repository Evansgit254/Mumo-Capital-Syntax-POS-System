import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { createTableSchema, updateTableSchema, batchUpdateTablesSchema } from '../validators/table';
import { getTenantId } from '../lib/tenant';
import { Role } from '@mumo/types';

const router = Router();

// ── GET / ──────────────────────────────────────────────────────────────────
// Returns tables for the current tenant.
// Staff Context (req.user): Returns paginated results with data/total structure.
// Guest Context (header): Returns flat array for backward compatibility.
// FIX 4 — CODEX-WARN-012: Unified paginated/non-paginated endpoint
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = getTenantId(req);
        
        // If authenticated (Staff UI), return paginated
        if (req.user) {
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Number(req.query.limit) || 50);
            const skip = (page - 1) * limit;

            const [tables, total] = await Promise.all([
                prisma.table.findMany({
                    where: { tenantId },
                    orderBy: { number: 'asc' },
                    skip,
                    take: limit,
                }),
                prisma.table.count({ where: { tenantId } }),
            ]);

            return res.json({
                data: tables,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            });
        }

        // Guest Flow / Legacy: Return raw array
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
        
        const serialized = orders.map(order => ({
            ...order,
            totalAmount: order.totalAmount.toNumber(),
            items: order.items.map(item => ({
                ...item,
                unitPrice: item.unitPrice.toNumber(),
                subtotal: item.subtotal.toNumber(),
                menuItem: item.menuItem ? {
                    ...item.menuItem,
                    price: item.menuItem.price.toNumber()
                } : undefined
            }))
        }));

        res.json(serialized);
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
            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const table = await prisma.table.create({
                data: {
                    tenantId,
                    number: req.body.number,
                    capacity: req.body.capacity,
                    x: req.body.x,
                    y: req.body.y,
                    zone: req.body.zone,
                    shape: req.body.shape,
                },
            });
            res.status(201).json(table);
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/tables/batch (Floor Plan Save) ───────────────────────────────────
router.put(
    '/batch',
    requireRole(Role.TENANT_ADMIN, Role.MANAGER, Role.SUPER_ADMIN),
    validate(batchUpdateTablesSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { tables } = req.body;

            // Execute transaction with upsert to support creating new tables from the floor planner
            const result = await prisma.$transaction(
                tables.map((t: any) => {
                    return prisma.table.upsert({
                        where: { id: t.id },
                        update: {
                            number: t.number,
                            capacity: t.capacity,
                            x: t.x || 0,
                            y: t.y || 0,
                            zone: t.zone || 'Indoor',
                            shape: t.shape || 'SQUARE',
                        },
                        create: {
                            id: t.id,
                            tenantId,
                            number: t.number,
                            capacity: t.capacity || 2,
                            x: t.x || 0,
                            y: t.y || 0,
                            zone: t.zone || 'Indoor',
                            shape: t.shape || 'SQUARE',
                        }
                    });
                })
            );

            res.json({ updated: result.length, tables: result });
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

            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const updated = await prisma.table.update({
                where: { id: req.params.id },
                data: {
                    number: req.body.number,
                    capacity: req.body.capacity,
                    isOccupied: req.body.isOccupied,
                    x: req.body.x,
                    y: req.body.y,
                    zone: req.body.zone,
                    shape: req.body.shape,
                },
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

            // Execute as transaction
            const updated = await prisma.$transaction(async (tx) => {
                // REMOVED: Automatic status update to SERVED.
                // Orders should remain PENDING/PREPARING/READY in KDS until manually served,
                // even if the bill is settled early (Direct POS workflow).

                // Mark table as available
                return tx.table.update({
                    where: { id },
                    data: { isOccupied: false }
                });
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

            // Execute as transaction
            const updated = await prisma.$transaction(async (tx) => {
                // 2. Transfer orders
                await tx.order.updateMany({
                    where: { tableId: id, tenantId, status: { notIn: ['CANCELLED', 'SERVED'] } },
                    data: { tableId: targetTableId }
                });

                // 3. Swap occupancy status
                await tx.table.update({ where: { id }, data: { isOccupied: false } });
                return tx.table.update({ where: { id: targetTableId }, data: { isOccupied: true } });
            });

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

            // Execute as transaction
            const updated = await prisma.$transaction(async (tx) => {
                // 2. Move orders
                await tx.order.updateMany({
                    where: { tableId: id, tenantId, status: { notIn: ['CANCELLED', 'SERVED'] } },
                    data: { tableId: targetTableId }
                });

                // 3. Release source table
                return tx.table.update({ where: { id }, data: { isOccupied: false } });
            });

            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
