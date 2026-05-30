import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notFound, badRequest } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { Role } from '@mumo/types';
import {
    createVendorSchema,
    updateVendorSchema,
    createPurchaseOrderSchema,
    updatePOStatusSchema,
} from '../validators/vendors';

const router = Router();

// ── VENDORS ──────────────────────────────────────────────────────────────────

router.get(
    '/',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    // FIX 4 — CODEX-WARN-012: Paginated list endpoint
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Number(req.query.limit) || 50);
            const skip = (page - 1) * limit;

            const [vendors, total] = await Promise.all([
                prisma.vendor.findMany({
                    where: { tenantId },
                    orderBy: { name: 'asc' },
                    skip,
                    take: limit,
                }),
                prisma.vendor.count({ where: { tenantId } }),
            ]);

            res.json({
                data: vendors,
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

router.post(
    '/',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(createVendorSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const vendor = await prisma.vendor.create({
                data: {
                    tenantId,
                    name: req.body.name,
                    contactName: req.body.contactName,
                    email: req.body.email,
                    phone: req.body.phone,
                    address: req.body.address,
                    categories: req.body.categories ?? [],
                },
            });
            res.status(201).json(vendor);
        } catch (err) {
            next(err);
        }
    }
);

// ── PURCHASE ORDERS ──────────────────────────────────────────────────────────
// DEEP-CRIT-001: All /orders* routes MUST be declared BEFORE /:id routes,
// otherwise Express treats "orders" as a vendor ID parameter.

router.get(
    '/orders',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    // FIX 4 — CODEX-WARN-012: Paginated list endpoint
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Number(req.query.limit) || 50);
            const skip = (page - 1) * limit;

            const [orders, total] = await Promise.all([
                prisma.purchaseOrder.findMany({
                    where: { tenantId },
                    include: { 
                        vendor: { select: { name: true } },
                        items: { include: { inventoryItem: { select: { name: true, unit: true } } } }
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                prisma.purchaseOrder.count({ where: { tenantId } }),
            ]);
            
            // Map Decimal to number for response
            const serializedOrders = orders.map(order => ({
                ...order,
                totalCost: order.totalCost.toNumber(),
                items: order.items.map(item => ({
                    ...item,
                    orderedQty: item.orderedQty.toNumber(),
                    receivedQty: item.receivedQty?.toNumber() ?? null,
                    unitCost: item.unitCost.toNumber()
                }))
            }));
            
            res.json({
                data: serializedOrders,
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

router.post(
    '/orders',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(createPurchaseOrderSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { items, vendorId } = req.body;

            // DEEP-CRIT-003: Verify vendor belongs to tenant before creating PO
            const vendor = await prisma.vendor.findFirst({
                where: { id: vendorId, tenantId }
            });
            if (!vendor) throw notFound('Vendor not found');

            // FIX-003 (DEEP-CRIT-003): Verify all inventory items belong to tenant
            const inventoryIds = [
                ...new Set(
                    items.map((item: { inventoryItemId: string }) => item.inventoryItemId)
                )
            ];

            const validItems = await prisma.inventoryItem.findMany({
                where: {
                    id: { in: inventoryIds as string[] },
                    tenantId,
                    deletedAt: null,
                },
                select: { id: true },
            });

            if (validItems.length !== inventoryIds.length) {
                throw notFound('One or more inventory items not found in this tenant');
            }

            // Decimal arithmetic for total cost
            let totalCost = new Prisma.Decimal(0);
            for (const item of items) {
                const itemTotal = new Prisma.Decimal(item.orderedQty).times(new Prisma.Decimal(item.unitCost));
                totalCost = totalCost.plus(itemTotal);
            }

            const order = await prisma.purchaseOrder.create({
                data: {
                    tenantId,
                    vendorId,
                    totalCost,
                    items: {
                        create: items.map((item: LooseValue) => ({
                            inventoryItemId: item.inventoryItemId,
                            orderedQty: new Prisma.Decimal(item.orderedQty),
                            unitCost: new Prisma.Decimal(item.unitCost),
                        }))
                    }
                },
                include: { items: true }
            });

            res.status(201).json({
                ...order,
                totalCost: order.totalCost.toNumber(),
                items: order.items.map(item => ({
                    ...item,
                    orderedQty: item.orderedQty.toNumber(),
                    unitCost: item.unitCost.toNumber()
                }))
            });
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    '/orders/:id/status',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(updatePOStatusSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, id: userId } = req.user!;
            const { status, receivedItems } = req.body;

            const order = await prisma.purchaseOrder.findFirst({
                where: { id: req.params.id, tenantId }
            });
            if (!order) throw notFound('Purchase Order not found');

            // If marking as RECEIVED, handle inventory updates
            if (status === 'RECEIVED' && order.status !== 'RECEIVED') {
                await prisma.$transaction(async (tx) => {
                    const poItems = await tx.purchaseOrderItem.findMany({
                        where: { purchaseOrderId: order.id }
                    });

                    if (receivedItems && receivedItems.length > 0) {
                        for (const receipt of receivedItems) {
                            const poItem = poItems.find(i => i.inventoryItemId === receipt.inventoryItemId);
                            if (poItem) {
                                await tx.purchaseOrderItem.update({
                                    where: { id: poItem.id },
                                    data: { receivedQty: new Prisma.Decimal(receipt.receivedQty) }
                                });
                            }
                        }
                    } else {
                        for (const poItem of poItems) {
                            await tx.purchaseOrderItem.update({
                                where: { id: poItem.id },
                                data: { receivedQty: poItem.receivedQty ?? poItem.orderedQty }
                            });
                        }
                    }

                    const receivedPoItems = await tx.purchaseOrderItem.findMany({
                        where: { purchaseOrderId: order.id },
                    });

                    for (const poItem of receivedPoItems) {
                        if (!poItem.receivedQty || poItem.receivedQty.isZero()) continue;

                        // DEEP-CRIT-003: Tenant-scoped inventory item lookup
                        const item = await tx.inventoryItem.findFirst({
                            where: { id: poItem.inventoryItemId, tenantId, deletedAt: null }
                        });
                        if (!item) throw notFound(`Inventory item not found: ${poItem.inventoryItemId}`);

                        const newQty = item.currentStock.plus(poItem.receivedQty);

                        await tx.inventoryItem.update({
                            where: { id: item.id },
                            data: { currentStock: newQty }
                        });

                        await tx.inventoryAuditLog.create({
                            data: {
                                inventoryItemId: item.id,
                                userId,
                                previousQty: item.currentStock,
                                newQty,
                                adjustmentType: 'PURCHASE',
                                reason: `Received via PO-${order.id.substring(0, 8)}`,
                                tenantId
                            }
                        });
                    }

                    await tx.purchaseOrder.update({
                        where: { id: order.id },
                        data: { status: 'RECEIVED' }
                    });
                });
                return res.json({ message: 'Purchase Order received and inventory updated' });
            }

            const updated = await prisma.purchaseOrder.update({
                where: { id: req.params.id },
                data: { status },
            });
            res.json({
                ...updated,
                totalCost: updated.totalCost.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── VENDOR DETAIL (/:id) ─────────────────────────────────────────────────────
// DEEP-CRIT-001: These /:id routes MUST be AFTER all /orders* routes
// so Express doesn't treat "orders" as a vendor ID.

// FIX 7 — CODEX-WARN-010: Missing GET /api/vendors/:id
router.get(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const vendor = await prisma.vendor.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!vendor) throw notFound('Vendor not found');
            res.json(vendor);
        } catch (err) {
            next(err);
        }
    }
);

router.put(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(updateVendorSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const existing = await prisma.vendor.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Vendor not found');

            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const updated = await prisma.vendor.update({
                where: { id: req.params.id },
                data: {
                    name: req.body.name,
                    contactName: req.body.contactName,
                    email: req.body.email,
                    phone: req.body.phone,
                    address: req.body.address,
                    categories: req.body.categories,
                },
            });
            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

router.delete(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const existing = await prisma.vendor.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Vendor not found');

            await prisma.vendor.delete({ where: { id: req.params.id } });
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

export default router;
