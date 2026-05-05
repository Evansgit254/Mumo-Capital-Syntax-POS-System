import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { unauthorized, notFound, conflict, badRequest } from '../lib/errors';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema, refreshSchema } from '../validators/auth';
import { AuthPayload, Role } from '@mumo/types';

const router = Router();
const SALT_ROUNDS = 12;

// ── POST /auth/register ──────────────────────────────────────────────────────
router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, firstName, lastName, tenantId, role } = req.body;

        // Verify tenant exists
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw notFound('Tenant not found');
        }

        // Check for existing user within tenant
        const existing = await prisma.user.findUnique({
            where: { tenantId_email: { tenantId, email } },
        });
        if (existing) {
            throw conflict('A user with this email already exists in this tenant');
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                tenantId,
                role: role || Role.STAFF,
            },
        });

        const payload: AuthPayload = {
            userId: user.id,
            tenantId: user.tenantId,
            role: user.role as Role,
        };

        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);

        res.status(201).json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                tenantId: user.tenantId,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ── POST /auth/login ─────────────────────────────────────────────────────────
router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
            include: { tenant: true },
        });

        if (!user) {
            throw unauthorized('Invalid email or password');
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            throw unauthorized('Invalid email or password');
        }

        const payload: AuthPayload = {
            userId: user.id,
            tenantId: user.tenantId,
            role: user.role as Role,
        };

        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                tenantId: user.tenantId,
                tenantName: user.tenant.name,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ── POST /auth/refresh ───────────────────────────────────────────────────────
router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body;

        // verifyRefreshToken throws AppError on expiry or invalid
        const decoded = verifyRefreshToken(refreshToken);

        // Ensure the user still exists and hasn't been deactivated
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) {
            throw unauthorized('User no longer exists');
        }

        if (user.tenantId !== decoded.tenantId) {
            throw unauthorized('Token tenant mismatch — please sign in again');
        }

        const payload: AuthPayload = {
            userId: user.id,
            tenantId: user.tenantId,
            role: user.role as Role,
        };

        const newAccessToken = signAccessToken(payload);
        const newRefreshToken = signRefreshToken(payload);

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
