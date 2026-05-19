import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { unauthorized, notFound, conflict, forbidden } from '../lib/errors';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { loginSchema, registerSchema } from '../validators/auth';
import { AuthPayload, Role } from '@mumo/types';

const router = Router();
const SALT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// FIX 6 — CODEX-CRIT-006: Precomputed dummy hash for timing-attack prevention.
// Always run bcrypt.compare() even when user is not found.
const DUMMY_HASH = '$2b$12$LJ3m4ys3Lzwpzen.Dv0eOe1JEaVPq3B3qUBfVVqFmxJ1kGpQvS6.e';

/**
 * Set the refresh token as an httpOnly cookie.
 * FIX 11 — WARN-018: Never expose refresh tokens in response body or localStorage.
 */
function setRefreshCookie(res: Response, token: string): void {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: 'strict',
        path: '/auth',
        maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });
}

function clearRefreshCookie(res: Response): void {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: 'strict',
        path: '/auth',
    });
}

// ── Rate Limiter (FIX 3 — CRITICAL-002) ─────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    message: { error: 'Too many attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Hash a refresh token for storage. We store the hash, not the raw token,
 * so a database breach doesn't expose valid tokens.
 */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Store a refresh token in the database.
 */
async function storeRefreshToken(rawToken: string, userId: string, tenantId: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
        data: {
            token: hashToken(rawToken),
            userId,
            tenantId,
            expiresAt,
        },
    });
}

/**
 * Revoke a refresh token by setting revokedAt.
 */
async function revokeRefreshToken(rawToken: string): Promise<boolean> {
    const hashed = hashToken(rawToken);
    const result = await prisma.refreshToken.updateMany({
        where: { token: hashed, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    return result.count > 0;
}

// ── POST /auth/register ──────────────────────────────────────────────────────
// FIX 2 — CRITICAL-003: Registration is now admin-only.
// New users are always created as STAFF. Role assignment happens via
// PUT /api/users/:id/role (already admin-only).
router.post(
    '/register',
    authLimiter,
    authenticate,
    requireRole(Role.TENANT_ADMIN),
    validate(registerSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password, firstName, lastName, tenantId } = req.body;

            // Admin can only create users within their own tenant
            if (tenantId !== req.user!.tenantId) {
                throw forbidden('You can only create users in your own tenant');
            }

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

            // FIX 2: Role is always STAFF — ignore anything the caller sends
            const user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    firstName,
                    lastName,
                    tenantId,
                    role: Role.STAFF,
                },
            });

            res.status(201).json({
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
    }
);

// ── POST /auth/login ─────────────────────────────────────────────────────────
// FIX 5 — CODEX-CRIT-005: Scope user lookup by tenantId (no global email unique)
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        // FIX 5: Resolve tenant from request header or subdomain
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            throw unauthorized('Tenant ID required for login');
        }

        const user = await prisma.user.findFirst({
            where: { email: email.toLowerCase().trim(), tenantId },
            include: { tenant: true },
        });

        // FIX 6 — CODEX-CRIT-006: Always compare to prevent timing attack
        const passwordToCompare = user?.password ?? DUMMY_HASH;
        const valid = await bcrypt.compare(password, passwordToCompare);

        if (!user || !valid) {
            throw unauthorized('Invalid email or password');
        }

        // FIX 4 — CRITICAL-011: Block inactive users from logging in
        if (user.status === 'INACTIVE') {
            throw forbidden('Account has been deactivated. Contact your administrator.');
        }

        const payload: AuthPayload = {
            id: user.id,
            tenantId: user.tenantId,
            role: user.role as Role,
        };

        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);

        // FIX 5 — CRITICAL-005: Store refresh token hash in DB
        await storeRefreshToken(refreshToken, user.id, user.tenantId);

        // FIX 11 — WARN-018: Set refresh token as httpOnly cookie, not in body
        setRefreshCookie(res, refreshToken);

        res.json({
            accessToken,
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
// FIX 11 — WARN-018: Read refresh token from httpOnly cookie, not request body
router.post('/refresh', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refreshToken: string | undefined = req.cookies?.refreshToken;

        if (!refreshToken) {
            throw unauthorized('No refresh token provided — please sign in');
        }

        // Verify JWT signature and expiry
        const decoded = verifyRefreshToken(refreshToken);

        // FIX 5 — CRITICAL-005: Validate against DB record
        const hashed = hashToken(refreshToken);
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: hashed },
        });

        if (!storedToken) {
            throw unauthorized('Refresh token not recognized — please sign in again');
        }

        if (storedToken.revokedAt) {
            // Token reuse detected — possible theft. Revoke ALL tokens for this user.
            await prisma.refreshToken.updateMany({
                where: { userId: storedToken.userId, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            clearRefreshCookie(res);
            throw unauthorized('Refresh token has been revoked — please sign in again');
        }

        if (storedToken.expiresAt < new Date()) {
            clearRefreshCookie(res);
            throw unauthorized('Refresh token has expired — please sign in again');
        }

        // Ensure the user still exists and is active
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            include: { tenant: true },
        });

        if (!user) {
            clearRefreshCookie(res);
            throw unauthorized('User no longer exists');
        }

        if (user.status === 'INACTIVE') {
            clearRefreshCookie(res);
            throw forbidden('Account has been deactivated. Contact your administrator.');
        }

        if (user.tenantId !== decoded.tenantId) {
            clearRefreshCookie(res);
            throw unauthorized('Token tenant mismatch — please sign in again');
        }

        // FIX 1 — CODEX-WARN-002: Atomic token rotation via $transaction
        const oldTokenHash = hashToken(refreshToken);
        const newPayload: AuthPayload = {
            id: user.id,
            tenantId: user.tenantId,
            role: user.role as Role,
        };

        const newAccessToken = signAccessToken(newPayload);
        const newRefreshToken = signRefreshToken(newPayload);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

        await prisma.$transaction(async (tx) => {
            // Revoke old token
            await tx.refreshToken.updateMany({
                where: { token: oldTokenHash, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            // Store new token
            await tx.refreshToken.create({
                data: {
                    token: hashToken(newRefreshToken),
                    userId: user.id,
                    tenantId: user.tenantId,
                    expiresAt,
                },
            });
        });

        // FIX 11: Set new refresh token as httpOnly cookie
        setRefreshCookie(res, newRefreshToken);

        res.json({
            accessToken: newAccessToken,
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

// ── POST /auth/logout ────────────────────────────────────────────────────────
// FIX 5 + FIX 11: Revoke refresh token from cookie and clear it
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refreshToken: string | undefined = req.cookies?.refreshToken;

        if (refreshToken && typeof refreshToken === 'string') {
            await revokeRefreshToken(refreshToken);
        }

        clearRefreshCookie(res);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

// ── Cleanup Job ──────────────────────────────────────────────────────────────
// FIX 5: Delete expired refresh tokens every 24 hours
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const cleanupInterval = setInterval(async () => {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 1); // 1 day past expiry
        const result = await prisma.refreshToken.deleteMany({
            where: { expiresAt: { lt: cutoff } },
        });
        if (result.count > 0) {
            logger.info({ deletedCount: result.count }, 'Refresh token cleanup completed');
        }
    } catch (err) {
        logger.error({ err }, 'Refresh token cleanup failed');
    }
}, CLEANUP_INTERVAL_MS);
cleanupInterval.unref(); // Don't keep process alive just for cleanup

export default router;
