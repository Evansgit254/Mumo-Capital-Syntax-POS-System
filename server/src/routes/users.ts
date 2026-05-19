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
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    // FIX 4 — CODEX-WARN-012: Paginated list endpoint
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Number(req.query.limit) || 50);
            const skip = (page - 1) * limit;

            const where = { tenantId };
            const [users, total] = await Promise.all([
                prisma.user.findMany({
                    where,
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
                    skip,
                    take: limit,
                }),
                prisma.user.count({ where }),
            ]);

            res.json({
                data: users.map(u => ({
                    ...u,
                    hourlyRate: u.hourlyRate.toNumber()
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

            // FIX 5 — CODEX-CRIT-005: Check uniqueness within tenant scope
            const existing = await prisma.user.findFirst({
                where: { email: email.toLowerCase().trim(), tenantId }
            });
            if (existing) {
                throw forbidden('A user with this email already exists in this tenant');
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
// FIX 8 — CODEX-CRIT-008: User deactivation revokes all refresh tokens
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

            // FIX 8: Wrap in transaction — update status + revoke tokens atomically
            const updated = await prisma.$transaction(async (tx) => {
                const updatedUser = await tx.user.update({
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

                // Revoke all active refresh tokens when deactivating
                if (status === 'INACTIVE') {
                    await tx.refreshToken.updateMany({
                        where: { userId: id, revokedAt: null },
                        data: { revokedAt: new Date() },
                    });
                }

                return updatedUser;
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
