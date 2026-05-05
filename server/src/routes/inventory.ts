import { Router, Request, Response, NextFunction } from 'express';
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
                items = items.filter(item => item.currentStock < item.minStock);
            }

            res.json(items);
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
            res.json(item);
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
                data: { ...req.body, tenantId },
            });
            res.status(201).json(item);
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
                data: req.body,
            });
            res.json(updated);
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

// ── POST /api/inventory/:id/adjust ──────────────────────────────────────────
router.post(
    '/:id/adjust',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(adjustInventorySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { adjustmentType, quantity, reason } = req.body;

            const item = await prisma.inventoryItem.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!item) throw notFound('Inventory item not found');

            let newStock: number;
            if (adjustmentType === AdjustmentType.WASTE || adjustmentType === AdjustmentType.TRANSFER) {
                newStock = item.currentStock - quantity;
                if (newStock < 0) {
                    throw badRequest(
                        `Insufficient stock. Current: ${item.currentStock}, Requested: ${quantity}`
                    );
                }
            } else {
                // RESTOCK or CORRECTION
                newStock = item.currentStock + quantity;
            }

            const updated = await prisma.inventoryItem.update({
                where: { id: req.params.id },
                data: { currentStock: newStock },
            });

            res.json({
                item: updated,
                adjustment: {
                    type: adjustmentType,
                    quantity,
                    reason,
                    previousStock: item.currentStock,
                    newStock: updated.currentStock,
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
