import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const router = Router();



const bookingLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many booking requests from this IP, please try again after a minute' },
});

const bookingSchema = z.object({
    activityId: z.string().uuid(),
    roomNumber: z.string().min(1),
    guestName: z.string().min(1),
    slotTime: z.string().datetime()
});

router.post('/', bookingLimiter, async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required' });
        }

        const data = bookingSchema.parse(req.body);

        // DEEP-CRIT-010: Atomic slot check + decrement + booking inside transaction
        const booking = await prisma.$transaction(async (tx) => {
            // Atomic: only decrement if slots > 0 AND activity belongs to tenant
            const slotUpdate = await tx.activity.updateMany({
                where: {
                    id: data.activityId,
                    tenantId,
                    availableSlots: { gt: 0 }
                },
                data: { availableSlots: { decrement: 1 } }
            });

            if (slotUpdate.count === 0) {
                // Distinguish between "not found" and "fully booked"
                const activity = await tx.activity.findFirst({
                    where: { id: data.activityId, tenantId },
                    select: { availableSlots: true }
                });
                if (!activity) {
                    throw Object.assign(new Error('Activity not found'), { statusCode: 404 });
                }
                throw Object.assign(
                    new Error('No available slots for this activity'),
                    { statusCode: 409 }
                );
            }

            // Create the booking only after slot was successfully reserved
            return tx.activityBooking.create({
                data: {
                    tenantId,
                    activityId: data.activityId,
                    roomNumber: data.roomNumber,
                    guestName: data.guestName,
                    slotTime: new Date(data.slotTime),
                }
            });
        });

        res.status(201).json(booking);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        logger.error({ err: error }, 'Booking error');
        res.status(500).json({ error: 'Failed to process booking' });
    }
});

export default router;
