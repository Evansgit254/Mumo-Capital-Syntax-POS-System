import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { forbidden, notFound, badRequest } from '../lib/errors';
import { 
    createUserSchema, 
    updateRoleSchema, 
    updateStatusSchema, 
    updateRateSchema 
} from '../validators/users';
import { Role } from '@mumo/types';

const router = Router();
const SALT_ROUNDS = 12;

// ── GET /api/users ──────────────────────────────────────────────────────────
// List all staff accounts for the authenticated tenant. ADMIN only.
router.get(
    '/',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const users = await prisma.user.findMany({
                where: { tenantId },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    hourlyRate: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            res.json(users.map(u => ({
                ...u,
                hourlyRate: u.hourlyRate.toNumber()
            })));
        } catch (err) {
            next(err);
        }
    }
);

// ── POST /api/users ──────────────────────────────────────────────────────────
// Create/Invite a new staff member. ADMIN only.
router.post(
    '/',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
    validate(createUserSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { email, firstName, lastName, password, hourlyRate } = req.body;

            // Check if user already exists
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                throw forbidden('A user with this email already exists');
            }

            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

            const user = await prisma.user.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    role: Role.STAFF,
                    tenantId,
                    password: hashedPassword,
                    hourlyRate: new Prisma.Decimal(hourlyRate || 0),
                },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    hourlyRate: true,
                    createdAt: true,
                },
            });

            res.status(201).json({
                ...user,
                hourlyRate: user.hourlyRate.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/users/:id/role ─────────────────────────────────────────────────
// Update a user's role. ADMIN only.
router.put(
    '/:id/role',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
    validate(updateRoleSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { id } = req.params;
            const { role } = req.body;

            // Verify user belongs to this tenant
            const user = await prisma.user.findFirst({
                where: { id, tenantId },
            });

            if (!user) {
                throw notFound('User not found in this tenant');
            }

            const updated = await prisma.user.update({
                where: { id },
                data: { role },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    status: true,
                    hourlyRate: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            res.json({
                ...updated,
                hourlyRate: updated.hourlyRate.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/users/:id/status ───────────────────────────────────────────────
// Activate or deactivate a user. ADMIN only.
// An admin cannot deactivate their own account.
router.put(
    '/:id/status',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
    validate(updateStatusSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, id: currentUserId } = req.user!;
            const { id } = req.params;
            const { status } = req.body;

            // Prevent self-deactivation
            if (id === currentUserId && status === 'INACTIVE') {
                throw forbidden('You cannot deactivate your own account');
            }

            // Verify user belongs to this tenant
            const user = await prisma.user.findFirst({
                where: { id, tenantId },
            });

            if (!user) {
                throw notFound('User not found in this tenant');
            }

            const updated = await prisma.user.update({
                where: { id },
                data: { status },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    status: true,
                    hourlyRate: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            res.json({
                ...updated,
                hourlyRate: updated.hourlyRate.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/users/:id/rate ─────────────────────────────────────────────────
// Update a user's hourly rate. ADMIN only.
router.put(
    '/:id/rate',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
    validate(updateRateSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { id } = req.params;
            const { hourlyRate } = req.body;

            // Verify user belongs to this tenant
            const user = await prisma.user.findFirst({
                where: { id, tenantId },
            });

            if (!user) {
                throw notFound('User not found in this tenant');
            }

            const updated = await prisma.user.update({
                where: { id },
                data: { hourlyRate: new Prisma.Decimal(hourlyRate) },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    hourlyRate: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            res.json({
                ...updated,
                hourlyRate: updated.hourlyRate.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
