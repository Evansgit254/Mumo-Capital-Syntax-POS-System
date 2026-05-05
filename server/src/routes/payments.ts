import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notFound, badRequest } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { createPaymentSchema, updatePaymentStatusSchema } from '../validators/payment';
import { Role, PaymentStatus } from '@mumo/types';

const router = Router();

// ── GET /api/payments ────────────────────────────────────────────────────────
router.get(
    '/',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const payments = await prisma.payment.findMany({
                where: { tenantId },
                include: {
                    order: { select: { id: true, status: true, totalAmount: true } },
                },
                orderBy: { createdAt: 'desc' },
            });
            res.json(payments);
        } catch (err) {
            next(err);
        }
    }
);

// ── GET /api/payments/:id ────────────────────────────────────────────────────
router.get(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
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
            res.json(payment);
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /api/payments ───────────────────────────────────────────────────────
router.post(
    '/',
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

            if (amount > order.totalAmount) {
                throw badRequest('Payment amount exceeds order total');
            }

            const payment = await prisma.payment.create({
                data: {
                    tenantId,
                    orderId,
                    amount,
                    method,
                    status: PaymentStatus.PENDING,
                },
            });

            res.status(201).json(payment);
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/payments/:id/status ─────────────────────────────────────────────
router.put(
    '/:id/status',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(updatePaymentStatusSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const existing = await prisma.payment.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Payment not found');

            const updated = await prisma.payment.update({
                where: { id: req.params.id },
                data: { status: req.body.status },
            });
            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
