import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notFound, badRequest } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import {
    createInventoryItemSchema,
    updateInventoryItemSchema,
    adjustInventorySchema,
} from '../validators/inventory';
import { Role, AdjustmentType } from '@mumo/types';

const router = Router();

// ── GET /api/inventory ──────────────────────────────────────────────────────
router.get(
    '/',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { alert } = req.query;

            let items = await prisma.inventoryItem.findMany({
                where: { tenantId },
                orderBy: { name: 'asc' },
            });

            if (alert === 'true') {
                items = items.filter(item => item.currentStock.lt(item.minStock));
            }

            res.json(items.map(item => ({
                ...item,
                currentStock: item.currentStock.toNumber(),
                minStock: item.minStock.toNumber(),
                costPerUnit: item.costPerUnit.toNumber()
            })));
        } catch (err) {
            next(err);
        }
    }
);

// ── GET /api/inventory/:id ──────────────────────────────────────────────────
router.get(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const item = await prisma.inventoryItem.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!item) throw notFound('Inventory item not found');
            res.json({
                ...item,
                currentStock: item.currentStock.toNumber(),
                minStock: item.minStock.toNumber(),
                costPerUnit: item.costPerUnit.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /api/inventory ─────────────────────────────────────────────────────
router.post(
    '/',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(createInventoryItemSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const item = await prisma.inventoryItem.create({
                data: {
                    ...req.body,
                    tenantId,
                    currentStock: new Prisma.Decimal(req.body.currentStock || 0),
                    minStock: new Prisma.Decimal(req.body.minStock || 0),
                    costPerUnit: new Prisma.Decimal(req.body.costPerUnit || 0),
                },
            });
            res.status(201).json({
                ...item,
                currentStock: item.currentStock.toNumber(),
                minStock: item.minStock.toNumber(),
                costPerUnit: item.costPerUnit.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/inventory/:id ──────────────────────────────────────────────────
router.put(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(updateInventoryItemSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const existing = await prisma.inventoryItem.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Inventory item not found');

            const updated = await prisma.inventoryItem.update({
                where: { id: req.params.id },
                data: {
                    ...req.body,
                    currentStock: req.body.currentStock !== undefined ? new Prisma.Decimal(req.body.currentStock) : undefined,
                    minStock: req.body.minStock !== undefined ? new Prisma.Decimal(req.body.minStock) : undefined,
                    costPerUnit: req.body.costPerUnit !== undefined ? new Prisma.Decimal(req.body.costPerUnit) : undefined,
                },
            });
            res.json({
                ...updated,
                currentStock: updated.currentStock.toNumber(),
                minStock: updated.minStock.toNumber(),
                costPerUnit: updated.costPerUnit.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── DELETE /api/inventory/:id ───────────────────────────────────────────────
router.delete(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const existing = await prisma.inventoryItem.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Inventory item not found');

            await prisma.inventoryItem.delete({ where: { id: req.params.id } });
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

// ── GET /api/inventory/audit-log ────────────────────────────────────────────
router.get(
    '/audit-log',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { page = '1', limit = '10' } = req.query;
            const skip = (Number(page) - 1) * Number(limit);

            const logs = await prisma.inventoryAuditLog.findMany({
                where: { tenantId },
                orderBy: { createdAt: 'desc' },
                take: Number(limit),
                skip: skip,
            });

            const total = await prisma.inventoryAuditLog.count({
                where: { tenantId },
            });

            res.json({
                logs: logs.map(l => ({
                    ...l,
                    previousQty: l.previousQty.toNumber(),
                    newQty: l.newQty.toNumber()
                })),
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /api/inventory/:id/adjust ──────────────────────────────────────────
router.post(
    '/:id/adjust',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(adjustInventorySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, id: userId } = req.user!;
            const { adjustmentType, quantity, reason } = req.body;

            const item = await prisma.inventoryItem.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!item) throw notFound('Inventory item not found');

            let newStock: Prisma.Decimal;
            const quantityDecimal = new Prisma.Decimal(quantity);

            if (adjustmentType === AdjustmentType.WASTE || adjustmentType === AdjustmentType.TRANSFER) {
                newStock = item.currentStock.minus(quantityDecimal);
                if (newStock.lt(0)) {
                    throw badRequest(
                        `Insufficient stock. Current: ${item.currentStock.toNumber()}, Requested: ${quantity}`
                    );
                }
            } else {
                newStock = item.currentStock.plus(quantityDecimal);
            }

            // Wrap in transaction to ensure audit log is always created
            const [updated] = await prisma.$transaction([
                prisma.inventoryItem.update({
                    where: { id: req.params.id },
                    data: { currentStock: newStock },
                }),
                prisma.inventoryAuditLog.create({
                    data: {
                        tenantId,
                        inventoryItemId: req.params.id,
                        previousQty: item.currentStock,
                        newQty: newStock,
                        adjustmentType,
                        reason,
                        userId,
                    },
                }),
            ]);

            res.json({
                item: {
                    ...updated,
                    currentStock: updated.currentStock.toNumber(),
                    minStock: updated.minStock.toNumber(),
                    costPerUnit: updated.costPerUnit.toNumber()
                },
                adjustment: {
                    type: adjustmentType,
                    quantity,
                    reason,
                    previousStock: item.currentStock.toNumber(),
                    newStock: updated.currentStock.toNumber(),
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
