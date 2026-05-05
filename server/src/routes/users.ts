import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { requireRole } from '../middleware/requireRole';
import { forbidden, notFound } from '../lib/errors';
import { Role } from '@mumo/types';

const router = Router();

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
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            res.json(users);
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
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { email, firstName, lastName, role, password } = req.body;

            // Basic validation
            if (!email || !firstName || !role) {
                throw forbidden('Missing required fields (email, firstName, role)');
            }

            // Check if user already exists
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                throw forbidden('A user with this email already exists');
            }

            // In a real app, we'd hash the password and send an invitation email.
            // For this POS, we'll hash it and create the account immediately.
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(password || 'Mumo1234!', 10);

            const user = await prisma.user.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    role,
                    tenantId,
                    password: hashedPassword,
                },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    createdAt: true,
                },
            });

            res.status(201).json(user);
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
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const { id } = req.params;
            const { role } = req.body;

            // Validate role
            const validRoles = [Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF];
            if (!validRoles.includes(role)) {
                throw notFound(`Invalid role: ${role}`);
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
                data: { role },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            res.json(updated);
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
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId: currentUserId } = req.user!;
            const { id } = req.params;
            const { status } = req.body;

            if (!['ACTIVE', 'INACTIVE'].includes(status)) {
                throw notFound(`Invalid status: ${status}`);
            }

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
                    createdAt: true,
                    updatedAt: true,
                },
            });

            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
