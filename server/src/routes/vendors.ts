import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
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
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const vendors = await prisma.vendor.findMany({
                where: { tenantId },
                orderBy: { name: 'asc' },
            });
            res.json(vendors);
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
            const vendor = await prisma.vendor.create({
                data: { ...req.body, tenantId },
            });
            res.status(201).json(vendor);
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

            const updated = await prisma.vendor.update({
                where: { id: req.params.id },
                data: req.body,
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

// ── PURCHASE ORDERS ──────────────────────────────────────────────────────────

router.get(
    '/orders',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const orders = await prisma.purchaseOrder.findMany({
                where: { tenantId },
                include: { 
                    vendor: { select: { name: true } },
                    items: { include: { inventoryItem: { select: { name: true, unit: true } } } }
                },
                orderBy: { createdAt: 'desc' },
            });
            
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
            
            res.json(serializedOrders);
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
                        create: items.map((item: any) => ({
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
                    // Update main PO status
                    await tx.purchaseOrder.update({
                        where: { id: order.id },
                        data: { status: 'RECEIVED' }
                    });

                    // Fetch PO items
                    const poItems = await tx.purchaseOrderItem.findMany({
                        where: { purchaseOrderId: order.id }
                    });

                    // Process each item received
                    if (receivedItems && receivedItems.length > 0) {
                        for (const receipt of receivedItems) {
                            const poItem = poItems.find(i => i.inventoryItemId === receipt.inventoryItemId);
                            const item = await tx.inventoryItem.findUnique({
                                where: { id: receipt.inventoryItemId }
                            });

                            if (item && poItem) {
                                const receivedQtyDecimal = new Prisma.Decimal(receipt.receivedQty);
                                const newQty = item.currentStock.plus(receivedQtyDecimal);
                                
                                // Update stock
                                await tx.inventoryItem.update({
                                    where: { id: item.id },
                                    data: { currentStock: newQty }
                                });

                                // Update PO Item received qty
                                await tx.purchaseOrderItem.update({
                                    where: { id: poItem.id },
                                    data: { receivedQty: receivedQtyDecimal }
                                });

                                // Create Audit Log
                                await tx.inventoryAuditLog.create({
                                    data: {
                                        inventoryItemId: item.id,
                                        userId,
                                        previousQty: item.currentStock,
                                        newQty,
                                        adjustmentType: 'PURCHASE',
                                        reason: receipt.reason || `Received via PO-${order.id.substring(0, 8)}`,
                                        tenantId
                                    }
                                });
                            }
                        }
                    } else {
                        // Fallback: Use original PO item quantities if none provided
                        for (const poItem of poItems) {
                            const item = await tx.inventoryItem.findUnique({
                                where: { id: poItem.inventoryItemId }
                            });
                            if (item) {
                                const newQty = item.currentStock.plus(poItem.orderedQty);
                                
                                await tx.inventoryItem.update({
                                    where: { id: item.id },
                                    data: { currentStock: newQty }
                                });

                                await tx.purchaseOrderItem.update({
                                    where: { id: poItem.id },
                                    data: { receivedQty: poItem.orderedQty }
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
                        }
                    }
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

export default router;
