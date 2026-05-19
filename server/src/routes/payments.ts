import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notFound, badRequest } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { createFolioPaymentSchema, createPaymentSchema, updatePaymentStatusSchema } from '../validators/payment';
import { Role, PaymentStatus } from '@mumo/types';

const router = Router();

// ── GET /api/payments ────────────────────────────────────────────────────────
router.get(
    '/',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF),
    // FIX 4 — CODEX-WARN-012: Paginated list endpoint
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Number(req.query.limit) || 50);
            const skip = (page - 1) * limit;

            const [payments, total] = await Promise.all([
                prisma.payment.findMany({
                    where: { tenantId },
                    include: {
                        order: { select: { id: true, status: true, totalAmount: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                prisma.payment.count({ where: { tenantId } }),
            ]);

            res.json({
                data: payments.map(p => ({
                    ...p,
                    amount: p.amount.toNumber(),
                    order: p.order ? {
                        ...p.order,
                        totalAmount: p.order.totalAmount.toNumber()
                    } : undefined
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

// ── POST /api/payments/folio ────────────────────────────────────────────────
router.post(
    '/folio',
    requireRole(Role.STAFF, Role.MANAGER, Role.TENANT_ADMIN, Role.SUPER_ADMIN),
    validate(createFolioPaymentSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { roomId, charges } = req.body;
            const orderIds = charges.map((charge: { orderId: string }) => charge.orderId);

            const room = await prisma.table.findFirst({
                where: { id: roomId, tenantId },
            });
            if (!room) throw notFound('Room not found in this tenant');

            const orders = await prisma.order.findMany({
                where: { id: { in: orderIds }, tenantId },
                select: { id: true },
            });
            if (orders.length !== new Set(orderIds).size) {
                throw badRequest('One or more orders do not belong to this tenant');
            }

            const result = await prisma.$transaction(async (tx) => {
                const payments = await Promise.all(charges.map((charge: { orderId: string; amount: number; method: 'CASH' | 'CARD' }) =>
                    tx.payment.create({
                        data: {
                            tenantId,
                            orderId: charge.orderId,
                            amount: new Prisma.Decimal(charge.amount),
                            method: charge.method,
                            status: PaymentStatus.COMPLETED,
                        },
                    })
                ));

                const totalSettled = payments.reduce(
                    (sum, payment) => sum.plus(payment.amount),
                    new Prisma.Decimal(0)
                );

                return {
                    folioId: `folio_${roomId}_${Date.now()}`,
                    totalSettled: totalSettled.toNumber(),
                    payments: payments.map(payment => ({
                        ...payment,
                        amount: payment.amount.toNumber(),
                    })),
                };
            });

            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// ── GET /api/payments/:id ────────────────────────────────────────────────────
router.get(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const payment = await prisma.payment.findFirst({
                where: { id: req.params.id, tenantId },
                include: {
                    order: { include: { items: { include: { menuItem: true } } } },
                },
            });
            if (!payment) throw notFound('Payment not found');
            res.json({
                ...payment,
                amount: payment.amount.toNumber(),
                order: payment.order ? {
                    ...payment.order,
                    totalAmount: payment.order.totalAmount.toNumber(),
                    items: payment.order.items.map(item => ({
                        ...item,
                        unitPrice: item.unitPrice.toNumber(),
                        subtotal: item.subtotal.toNumber()
                    }))
                } : undefined
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /api/payments ───────────────────────────────────────────────────────
// FIX 7 — CODEX-CRIT-007: Transactional payment settlement
// FIX 8 — CRITICAL-010: Role guard added. Only STAFF+ can create payments.
router.post(
    '/',
    requireRole(Role.STAFF, Role.MANAGER, Role.TENANT_ADMIN, Role.SUPER_ADMIN),
    validate(createPaymentSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { orderId, amount, method } = req.body;

            // Verify order belongs to this tenant
            const order = await prisma.order.findFirst({
                where: { id: orderId, tenantId },
            });
            if (!order) throw notFound('Order not found in this tenant');

            if (new Prisma.Decimal(amount).greaterThan(order.totalAmount)) {
                throw badRequest('Payment amount exceeds order total');
            }

            // FIX 7: Atomic transaction — create payment, update order, release table
            const result = await prisma.$transaction(async (tx) => {
                const payment = await tx.payment.create({
                    data: {
                        tenantId,
                        orderId,
                        amount: new Prisma.Decimal(amount),
                        method,
                        status: PaymentStatus.COMPLETED,
                    },
                });

                // Mark order as PAID
                await tx.order.updateMany({
                    where: { id: orderId, tenantId },
                    data: { status: 'PAID' },
                });

                // Release table only if all orders for that table are paid
                if (order.tableId) {
                    const openOrders = await tx.order.count({
                        where: {
                            tableId: order.tableId,
                            tenantId,
                            status: { not: 'PAID' },
                        },
                    });
                    if (openOrders === 0) {
                        await tx.table.updateMany({
                            where: { id: order.tableId, tenantId },
                            data: { isOccupied: false },
                        });
                    }
                }

                return payment;
            });

            res.status(201).json({
                ...result,
                amount: result.amount.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/payments/:id/status ─────────────────────────────────────────────
// FIX 7 — CODEX-CRIT-007: Transactional status update
router.put(
    '/:id/status',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(updatePaymentStatusSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const newStatus = req.body.status;

            const existing = await prisma.payment.findFirst({
                where: { id: req.params.id, tenantId },
                include: { order: true },
            });
            if (!existing) throw notFound('Payment not found');

            // FIX 7: Atomic transaction for status update + side effects
            const updated = await prisma.$transaction(async (tx) => {
                const payment = await tx.payment.update({
                    where: { id: req.params.id },
                    data: { status: newStatus },
                });

                // If completing the payment, mark order as PAID and potentially release table
                if (newStatus === PaymentStatus.COMPLETED && existing.order) {
                    await tx.order.updateMany({
                        where: { id: existing.orderId, tenantId },
                        data: { status: 'PAID' },
                    });

                    if (existing.order.tableId) {
                        const openOrders = await tx.order.count({
                            where: {
                                tableId: existing.order.tableId,
                                tenantId,
                                status: { not: 'PAID' },
                            },
                        });
                        if (openOrders === 0) {
                            await tx.table.updateMany({
                                where: { id: existing.order.tableId, tenantId },
                                data: { isOccupied: false },
                            });
                        }
                    }
                }

                return payment;
            });

            res.json({
                ...updated,
                amount: updated.amount.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
