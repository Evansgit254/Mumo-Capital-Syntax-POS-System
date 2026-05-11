import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notFound, badRequest } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import {
    createReservationSchema,
    updateReservationSchema,
    checkinReservationSchema,
} from '../validators/reservation';
import { Role, ReservationStatus } from '@mumo/types';

const router = Router();

// ── public/lookup (Guest Facing) ──────────────────────────────────────────────
router.post('/lookup', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const { id, guestName } = req.body;

        const where: any = { tenantId };
        if (id) where.id = id;
        else if (guestName) where.guestName = { contains: guestName, mode: 'insensitive' };
        else return next(badRequest('Please provide a booking ID or name'));

        const reservation = await prisma.reservation.findFirst({
            where,
            include: { table: true },
        });

        if (!reservation) throw notFound('Reservation not found');
        res.json(reservation);
    } catch (err) {
        next(err);
    }
});

// ── public/checkin (Guest Facing) ─────────────────────────────────────────────
router.post('/:id/checkin', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const { id } = req.params;

        const reservation = await prisma.reservation.findFirst({
            where: { id, tenantId },
            include: { table: true }
        });

        if (!reservation) throw notFound('Reservation not found');
        if (reservation.status === ReservationStatus.SEATED) throw badRequest('Guest is already seated');

        // Use transaction for atomic check-in
        const updated = await prisma.$transaction(async (tx) => {
            const upd = await tx.reservation.update({
                where: { id },
                data: { status: ReservationStatus.SEATED },
                include: { table: true }
            });

            if (upd.tableId) {
                await tx.table.update({
                    where: { id: upd.tableId },
                    data: { isOccupied: true }
                });
            }
            return upd;
        });

        res.json(updated);
    } catch (err) {
        next(err);
    }
});


// ── GET /api/reservations/waitlist ───────────────────────────────────────────
// Must be before /:id to avoid path conflict
router.get('/waitlist', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const waitlist = await prisma.reservation.findMany({
            where: {
                tenantId,
                tableId: null,
                status: ReservationStatus.PENDING,
            },
            orderBy: { createdAt: 'asc' },
            include: { table: true },
        });
        res.json(waitlist);
    } catch (err) {
        next(err);
    }
});

// ── GET /api/reservations ───────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const { date, status } = req.query;

        const where: Record<string, unknown> = { tenantId };

        if (status && typeof status === 'string') {
            where.status = status;
        }

        if (date && typeof date === 'string') {
            const dayStart = new Date(date);
            const dayEnd = new Date(date);
            dayEnd.setDate(dayEnd.getDate() + 1);
            where.startTime = { gte: dayStart, lt: dayEnd };
        }

        const reservations = await prisma.reservation.findMany({
            where,
            include: { table: { select: { id: true, number: true, capacity: true } } },
            orderBy: { startTime: 'asc' },
        });
        res.json(reservations);
    } catch (err) {
        next(err);
    }
});

// ── GET /api/reservations/:id ───────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const reservation = await prisma.reservation.findFirst({
            where: { id: req.params.id, tenantId },
            include: { table: true },
        });
        if (!reservation) throw notFound('Reservation not found');
        res.json(reservation);
    } catch (err) {
        next(err);
    }
});

// ── POST /api/reservations ──────────────────────────────────────────────────
router.post(
    '/',
    validate(createReservationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { tableId, ...rest } = req.body;

            // Validate table belongs to tenant if provided
            if (tableId) {
                const table = await prisma.table.findFirst({
                    where: { id: tableId, tenantId },
                });
                if (!table) throw notFound('Table not found in this tenant');
            }

            const reservation = await prisma.reservation.create({
                data: {
                    tenantId,
                    tableId: tableId || null,
                    ...rest,
                    startTime: new Date(rest.startTime),
                    endTime: rest.endTime ? new Date(rest.endTime) : null,
                    status: ReservationStatus.PENDING,
                },
                include: { table: true },
            });

            res.status(201).json(reservation);
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/reservations/:id ───────────────────────────────────────────────
router.put(
    '/:id',
    validate(updateReservationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const existing = await prisma.reservation.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Reservation not found');

            // Validate table if being changed
            if (req.body.tableId) {
                const table = await prisma.table.findFirst({
                    where: { id: req.body.tableId, tenantId },
                });
                if (!table) throw notFound('Table not found in this tenant');
            }

            const data: Record<string, unknown> = { ...req.body };
            if (data.startTime) data.startTime = new Date(data.startTime as string);
            if (data.endTime) data.endTime = new Date(data.endTime as string);

            const updated = await prisma.reservation.update({
                where: { id: req.params.id },
                data,
                include: { table: true },
            });
            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

// ── DELETE /api/reservations/:id ────────────────────────────────────────────
router.delete(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const existing = await prisma.reservation.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Reservation not found');

            await prisma.reservation.update({
                where: { id: req.params.id },
                data: { status: ReservationStatus.CANCELLED },
            });
            res.json({ message: 'Reservation cancelled' });
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /api/reservations/:id/checkin ──────────────────────────────────────
router.post(
    '/:id/checkin',
    validate(checkinReservationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const reservation = await prisma.reservation.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!reservation) throw notFound('Reservation not found');

            if (reservation.status === ReservationStatus.CANCELLED) {
                throw badRequest('Cannot check in a cancelled reservation');
            }
            if (reservation.status === ReservationStatus.SEATED) {
                throw badRequest('Guest is already seated');
            }

            // Use transaction for atomic check-in
            const updated = await prisma.$transaction(async (tx) => {
                const upd = await tx.reservation.update({
                    where: { id: req.params.id },
                    data: { status: ReservationStatus.SEATED },
                    include: { table: true },
                });

                // If the reservation has a table, mark it as occupied
                if (upd.tableId) {
                    await tx.table.update({
                        where: { id: upd.tableId },
                        data: { isOccupied: true },
                    });
                }
                return upd;
            });

            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
