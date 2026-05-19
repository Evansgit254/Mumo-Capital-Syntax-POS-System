import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { Role } from '@mumo/types';

const router = Router();



const createShiftSchema = z.object({
    userId: z.string().uuid(),
    date: z.string(), // YYYY-MM-DD
    startTime: z.string(), // ISO string
    endTime: z.string(), // ISO string
    station: z.string()
});

const updateShiftSchema = z.object({
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    station: z.string().optional()
});

// All routes require authentication
router.use(authenticate);

// Get shifts (with optional date range filters)
router.get('/', requireRole(Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF), async (req, res) => {
    try {
        const tenantId = req.user!.tenantId;
        const { start, end } = req.query; // YYYY-MM-DD strings

        let dateFilter: Prisma.DateTimeFilter = {};
        if (start && end) {
            dateFilter = {
                gte: new Date(start as string),
                lte: new Date(end as string)
            };
        } else if (start) {
            dateFilter = { gte: new Date(start as string) };
        }

        const shifts = await prisma.shift.findMany({
            where: {
                tenantId,
                ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        hourlyRate: true
                    }
                }
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
        });

        res.json(shifts.map(s => ({
            ...s,
            user: s.user ? {
                ...s.user,
                hourlyRate: s.user.hourlyRate.toNumber()
            } : undefined
        })));
    } catch (error) {
        logger.error({ err: error }, 'Error fetching shifts');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a shift
router.post('/', requireRole(Role.TENANT_ADMIN, Role.MANAGER), async (req, res) => {
    try {
        const tenantId = req.user!.tenantId;
        const data = createShiftSchema.parse(req.body);

        // DEEP-CRIT-011: Verify target userId belongs to tenant
        const targetUser = await prisma.user.findFirst({
            where: { id: data.userId, tenantId }
        });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found in this tenant' });
        }

        const shift = await prisma.shift.create({
            data: {
                tenantId,
                userId: data.userId,
                date: new Date(data.date),
                startTime: new Date(data.startTime),
                endTime: new Date(data.endTime),
                station: data.station
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        hourlyRate: true
                    }
                }
            }
        });

        res.status(201).json({
            ...shift,
            user: shift.user ? {
                ...shift.user,
                hourlyRate: shift.user.hourlyRate.toNumber()
            } : undefined
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        logger.error({ err: error }, 'Error creating shift');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update a shift
router.put('/:id', requireRole(Role.TENANT_ADMIN, Role.MANAGER), async (req, res) => {
    try {
        const tenantId = req.user!.tenantId;
        const shiftId = req.params.id;
        const data = updateShiftSchema.parse(req.body);

        // Verify shift belongs to tenant
        const existingShift = await prisma.shift.findUnique({
            where: { id: shiftId, tenantId }
        });

        if (!existingShift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        const updateData: Prisma.ShiftUpdateInput = {};
        if (data.startTime) updateData.startTime = new Date(data.startTime);
        if (data.endTime) updateData.endTime = new Date(data.endTime);
        if (data.station) updateData.station = data.station;

        const shift = await prisma.shift.update({
            where: { id: shiftId },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        hourlyRate: true
                    }
                }
            }
        });

        res.json({
            ...shift,
            user: shift.user ? {
                ...shift.user,
                hourlyRate: shift.user.hourlyRate.toNumber()
            } : undefined
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        logger.error({ err: error }, 'Error updating shift');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a shift
router.delete('/:id', requireRole(Role.TENANT_ADMIN, Role.MANAGER), async (req, res) => {
    try {
        const tenantId = req.user!.tenantId;
        const shiftId = req.params.id;

        // Verify shift belongs to tenant
        const existingShift = await prisma.shift.findUnique({
            where: { id: shiftId, tenantId }
        });

        if (!existingShift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        await prisma.shift.delete({
            where: { id: shiftId }
        });

        res.status(204).send();
    } catch (error) {
        logger.error({ err: error }, 'Error deleting shift');
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
