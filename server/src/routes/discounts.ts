import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notFound, badRequest } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { redeemDiscountSchema } from '../validators/discount';
import { Role } from '@mumo/types';

const router = Router();

/**
 * Demo discount codes.
 * In production these would come from a Discount model with
 * expiry dates, usage limits, and tenant-scoping.
 */
const DEMO_CODES: Record<string, { type: 'percent' | 'flat'; value: number; label: string }> = {
    WELCOME10: { type: 'percent', value: 10, label: '10% off (Welcome)' },
    VIP20:     { type: 'percent', value: 20, label: '20% off (VIP)' },
    FLAT500:   { type: 'flat',    value: 500, label: '500 KES off' },
};

// ── POST /api/discounts/redeem ──────────────────────────────────────────────
router.post(
    '/redeem',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF),
    validate(redeemDiscountSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { orderId, code } = req.body;

            // Verify order belongs to this tenant
            const order = await prisma.order.findFirst({
                where: { id: orderId, tenantId },
            });
            if (!order) throw notFound('Order not found in this tenant');

            // Look up discount code
            const discount = DEMO_CODES[code];
            if (!discount) {
                throw badRequest(`Invalid discount code: ${code}`);
            }

            // Calculate new total
            let discountAmount: number;
            if (discount.type === 'percent') {
                discountAmount = Math.round(order.totalAmount * (discount.value / 100) * 100) / 100;
            } else {
                discountAmount = discount.value;
            }

            // Ensure discount doesn't exceed order total
            discountAmount = Math.min(discountAmount, order.totalAmount);
            const newTotal = Math.round((order.totalAmount - discountAmount) * 100) / 100;

            // Update order total
            const updated = await prisma.order.update({
                where: { id: orderId },
                data: { totalAmount: newTotal },
            });

            res.json({
                success: true,
                code,
                label: discount.label,
                discountAmount,
                originalTotal: order.totalAmount,
                newTotal: updated.totalAmount,
            });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
