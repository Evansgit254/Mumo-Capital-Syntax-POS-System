import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notFound, badRequest, conflict } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import {
    createReservationSchema,
    updateReservationSchema,
    checkinReservationSchema,
} from '../validators/reservation';
import { getTenantId } from '../lib/tenant';
import { Role, ReservationStatus } from '@mumo/types';

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTER — read-only, safe endpoints for guest-facing pages
// FIX 2 — CODEX-CRIT-002: No auth required, but returns LIMITED fields only
// ══════════════════════════════════════════════════════════════════════════════
export const publicReservationRouter = Router();

// ── Public: Lookup reservation (Guest Facing) ────────────────────────────────
publicReservationRouter.post('/lookup', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = getTenantId(req);
        const { id, guestName } = req.body;

        const where: LooseValue = { tenantId };
        if (id) where.id = id;
        else if (guestName) where.guestName = { contains: guestName, mode: 'insensitive' };
        else return next(badRequest('Please provide a booking ID or name'));

        const reservation = await prisma.reservation.findFirst({
            where,
            select: {
                id: true,
                guestName: true,
                startTime: true,
                endTime: true,
                status: true,
                guestCount: true,
            },
        });

        if (!reservation) throw notFound('Reservation not found');
        res.json(reservation);
    } catch (err) {
        next(err);
    }
});

// ── Public: Get reservation by ID (Guest Facing) ────────────────────────────
// FIX 2: Returns limited fields only — never internal fields like tableId, tenantId
publicReservationRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = getTenantId(req);
        const reservation = await prisma.reservation.findFirst({
            where: { id: req.params.id, tenantId },
            select: {
                id: true,
                guestName: true,
                startTime: true,
                endTime: true,
                status: true,
                guestCount: true,
            },
        });
        if (!reservation) throw notFound('Reservation not found');
        res.json(reservation);
    } catch (err) {
        next(err);
    }
});


// ══════════════════════════════════════════════════════════════════════════════
// STAFF ROUTER — requires authenticate middleware (mounted in index.ts)
// FIX 2 — CODEX-CRIT-002: All mutations and sensitive reads require auth
// ══════════════════════════════════════════════════════════════════════════════
export const staffReservationRouter = Router();

// ── GET /api/reservations/waitlist ───────────────────────────────────────────
// Must be before /:id to avoid path conflict
staffReservationRouter.get('/waitlist', async (req: Request, res: Response, next: NextFunction) => {
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
// FIX 4 — CODEX-WARN-012: Paginated list endpoint
staffReservationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const { date, status } = req.query;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Number(req.query.limit) || 50);
        const skip = (page - 1) * limit;

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

        const [reservations, total] = await Promise.all([
            prisma.reservation.findMany({
                where,
                include: { table: { select: { id: true, number: true, capacity: true } } },
                orderBy: { startTime: 'asc' },
                skip,
                take: limit,
            }),
            prisma.reservation.count({ where }),
        ]);

        res.json({
            data: reservations,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        next(err);
    }
});

// ── GET /api/reservations/:id ───────────────────────────────────────────────
staffReservationRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
staffReservationRouter.post(
    '/',
    validate(createReservationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { tableId } = req.body;

            // Validate table belongs to tenant if provided
            if (tableId) {
                const table = await prisma.table.findFirst({
                    where: { id: tableId, tenantId },
                });
                if (!table) throw notFound('Table not found in this tenant');
            }

            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const reservation = await prisma.reservation.create({
                data: {
                    tenantId,
                    tableId: tableId || null,
                    guestName: req.body.guestName,
                    guestPhone: req.body.guestPhone,
                    guestEmail: req.body.guestEmail,
                    guestCount: req.body.guestCount,
                    notes: req.body.notes,
                    startTime: new Date(req.body.startTime),
                    endTime: req.body.endTime ? new Date(req.body.endTime) : null,
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
staffReservationRouter.put(
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

            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const updated = await prisma.reservation.update({
                where: { id: req.params.id },
                data: {
                    tableId: req.body.tableId,
                    guestName: req.body.guestName,
                    guestPhone: req.body.guestPhone,
                    guestEmail: req.body.guestEmail,
                    guestCount: req.body.guestCount,
                    notes: req.body.notes,
                    status: req.body.status,
                    startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
                    endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
                },
                include: { table: true },
            });
            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

// ── DELETE /api/reservations/:id ────────────────────────────────────────────
staffReservationRouter.delete(
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
// DEEP-CRIT-007: Atomic check-in — prevents double check-in race condition
staffReservationRouter.post(
    '/:id/checkin',
    requireRole(Role.MANAGER, Role.STAFF, Role.TENANT_ADMIN),
    validate(checkinReservationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const updated = await prisma.$transaction(async (tx) => {
                // Atomic status check and update — only one request can succeed
                const result = await tx.reservation.updateMany({
                    where: {
                        id: req.params.id,
                        tenantId,
                        status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.SEATED] }
                    },
                    data: { status: ReservationStatus.SEATED }
                });

                if (result.count === 0) {
                    // Check if reservation exists at all for a better error message
                    const exists = await tx.reservation.findFirst({
                        where: { id: req.params.id, tenantId },
                        select: { status: true }
                    });
                    if (!exists) throw notFound('Reservation not found');
                    throw conflict(
                        'Reservation cannot be checked in — it may already be checked in or cancelled'
                    );
                }

                // Get the reservation to find tableId and return full object
                const reservation = await tx.reservation.findUnique({
                    where: { id: req.params.id },
                    include: { table: true },
                });

                // If the reservation has a table, mark it as occupied
                if (reservation?.tableId) {
                    await tx.table.update({
                        where: { id: reservation.tableId },
                        data: { isOccupied: true },
                    });
                }

                return reservation;
            });

            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);
