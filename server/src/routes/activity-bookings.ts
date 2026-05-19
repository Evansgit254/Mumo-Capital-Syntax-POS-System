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

        // FIX 4 — CODEX-CRIT-004: Database-level tenant scoping via findFirst
        const activity = await prisma.activity.findFirst({
            where: { id: data.activityId, tenantId }
        });

        if (!activity) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        if (activity.availableSlots <= 0) {
            return res.status(400).json({ error: 'Activity is fully booked' });
        }

        // FIX 4: Use updateMany with tenantId for slot decrement (database-level scoping)
        const [booking, slotUpdate] = await prisma.$transaction([
            prisma.activityBooking.create({
                data: {
                    tenantId,
                    activityId: data.activityId,
                    roomNumber: data.roomNumber,
                    guestName: data.guestName,
                    slotTime: new Date(data.slotTime)
                }
            }),
            prisma.activity.updateMany({
                where: { id: data.activityId, tenantId },
                data: { availableSlots: { decrement: 1 } }
            })
        ]);

        res.status(201).json(booking);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        logger.error({ err: error }, 'Booking error');
        res.status(500).json({ error: 'Failed to process booking' });
    }
});

export default router;
