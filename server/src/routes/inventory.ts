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
    // FIX 4 — CODEX-WARN-012: Paginated list endpoint
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user; if (!user) return res.sendStatus(401);
            const { tenantId } = user;
            const { alert } = req.query;
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Number(req.query.limit) || 50);
            const skip = (page - 1) * limit;

            // If filtering by alert, we need to fetch all and filter in memory
            // because Prisma doesn't support comparing two columns directly
            if (alert === 'true') {
                const allItems = await prisma.inventoryItem.findMany({
                    where: { tenantId, deletedAt: null },
                    orderBy: { name: 'asc' },
                });
                const alertItems = allItems.filter(item => item.currentStock.lt(item.minStock));
                const total = alertItems.length;
                const paginated = alertItems.slice(skip, skip + limit);

                return res.json({
                    data: paginated.map(item => ({
                        ...item,
                        currentStock: item.currentStock.toNumber(),
                        minStock: item.minStock.toNumber(),
                        costPerUnit: item.costPerUnit.toNumber()
                    })),
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                });
            }

            const where = { tenantId, deletedAt: null };
            const [items, total] = await Promise.all([
                prisma.inventoryItem.findMany({
                    where,
                    orderBy: { name: 'asc' },
                    skip,
                    take: limit,
                }),
                prisma.inventoryItem.count({ where }),
            ]);

            res.json({
                data: items.map(item => ({
                    ...item,
                    currentStock: item.currentStock.toNumber(),
                    minStock: item.minStock.toNumber(),
                    costPerUnit: item.costPerUnit.toNumber()
                })),
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── GET /api/inventory/audit-log ────────────────────────────────────────────
// FIX 6 — CODEX-WARN-009: Must be before /:id to avoid being shadowed
router.get(
    '/audit-log',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user; if (!user) return res.sendStatus(401);
            const { tenantId } = user;
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

// ── GET /api/inventory/:id ──────────────────────────────────────────────────
router.get(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user; if (!user) return res.sendStatus(401);
            const { tenantId } = user;
            const item = await prisma.inventoryItem.findFirst({
                where: { id: req.params.id, tenantId, deletedAt: null },
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
            const user = req.user; if (!user) return res.sendStatus(401);
            const { tenantId } = user;
            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const item = await prisma.inventoryItem.create({
                data: {
                    tenantId,
                    name: req.body.name,
                    sku: req.body.sku,
                    unit: req.body.unit,
                    supplierId: req.body.supplierId,
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
            const user = req.user; if (!user) return res.sendStatus(401);
            const { tenantId } = user;

            const existing = await prisma.inventoryItem.findFirst({
                where: { id: req.params.id, tenantId, deletedAt: null },
            });
            if (!existing) throw notFound('Inventory item not found');

            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const updated = await prisma.inventoryItem.update({
                where: { id: req.params.id },
                data: {
                    name: req.body.name,
                    sku: req.body.sku,
                    unit: req.body.unit,
                    supplierId: req.body.supplierId,
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
// Soft delete to avoid Restrict errors from PO/audit relations
router.delete(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user; if (!user) return res.sendStatus(401);
            const { tenantId } = user;

            const existing = await prisma.inventoryItem.findFirst({
                where: { id: req.params.id, tenantId, deletedAt: null },
            });
            if (!existing) throw notFound('Inventory item not found');

            // Soft delete instead of hard delete
            await prisma.inventoryItem.update({
                where: { id: req.params.id },
                data: { deletedAt: new Date() },
            });
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /api/inventory/:id/adjust ──────────────────────────────────────────
// DEEP-CRIT-006: Atomic increment/decrement to prevent race conditions
router.post(
    '/:id/adjust',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(adjustInventorySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user; if (!user) return res.sendStatus(401);
            const { tenantId, id: userId } = user;
            const { adjustmentType, quantity, reason } = req.body;
            const itemId = req.params.id;
            const quantityDecimal = new Prisma.Decimal(quantity);

            const result = await prisma.$transaction(async (tx) => {
                // Verify item exists and belongs to tenant
                const item = await tx.inventoryItem.findFirst({
                    where: { id: itemId, tenantId, deletedAt: null },
                });
                if (!item) throw notFound('Inventory item not found');

                const previousStock = item.currentStock;

                if (adjustmentType === AdjustmentType.WASTE || adjustmentType === AdjustmentType.TRANSFER) {
                    // For reductions, verify sufficient stock inside the transaction
                    if (item.currentStock.lessThan(quantityDecimal)) {
                        throw badRequest(
                            `Insufficient stock. Current: ${item.currentStock.toNumber()}, Requested: ${quantity}`
                        );
                    }
                    // Atomic decrement — no read-modify-write
                    await tx.inventoryItem.update({
                        where: { id: itemId },
                        data: { currentStock: { decrement: quantityDecimal } },
                    });
                } else {
                    // Atomic increment — no read-modify-write
                    await tx.inventoryItem.update({
                        where: { id: itemId },
                        data: { currentStock: { increment: quantityDecimal } },
                    });
                }

                // Fetch updated stock for audit log and response
                const updated = await tx.inventoryItem.findUnique({
                    where: { id: itemId },
                });

                // Create audit log in same transaction
                await tx.inventoryAuditLog.create({
                    data: {
                        tenantId,
                        inventoryItemId: itemId,
                        previousQty: previousStock,
                        newQty: updated!.currentStock,
                        adjustmentType,
                        reason,
                        userId,
                    },
                });

                return { updated: updated!, previousStock };
            });

            res.json({
                item: {
                    ...result.updated,
                    currentStock: result.updated.currentStock.toNumber(),
                    minStock: result.updated.minStock.toNumber(),
                    costPerUnit: result.updated.costPerUnit.toNumber()
                },
                adjustment: {
                    type: adjustmentType,
                    quantity,
                    reason,
                    previousStock: result.previousStock.toNumber(),
                    newStock: result.updated.currentStock.toNumber(),
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
