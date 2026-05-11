import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { Role } from '@mumo/types';

const router = Router();

const requestWriteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many requests from this IP, please try again after a minute' },
});

const requestReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many requests from this IP, please try again after a minute' },
});

const requestSchema = z.object({
    roomNumber: z.string().min(1),
    category: z.string().min(1),
    description: z.string().min(1)
});

// ── PUBLIC: Create a new service request (guest-facing) ─────────────────────
router.post('/', requestWriteLimiter, async (req: Request, res: Response) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID is required' });
        }

        const data = requestSchema.parse(req.body);

        const request = await prisma.serviceRequest.create({
            data: {
                tenantId,
                ...data
            }
        });

        res.status(201).json(request);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to create request' });
    }
});

// ── PUBLIC: Check status by ID (guest-facing) ───────────────────────────────
// FIX 6 — Only returns status field, never full request data
router.get('/:id/status', requestReadLimiter, async (req: Request, res: Response) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID is required' });
        }

        const request = await prisma.serviceRequest.findUnique({
            where: { id: req.params.id },
            select: { id: true, status: true, createdAt: true }
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json(request);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch request status' });
    }
});

// ── PROTECTED: List all requests (admin/manager only) ───────────────────────
// FIX 6 — CRITICAL-004: Requires authentication + MANAGER or higher
router.get(
    '/',
    authenticate,
    requireRole(Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const requests = await prisma.serviceRequest.findMany({
                where: { tenantId },
                orderBy: { createdAt: 'desc' }
            });
            res.json(requests);
        } catch (error) {
            next(error);
        }
    }
);

// ── PROTECTED: Get full request detail by ID (admin/manager only) ───────────
router.get(
    '/:id',
    authenticate,
    requireRole(Role.TENANT_ADMIN, Role.MANAGER),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const request = await prisma.serviceRequest.findFirst({
                where: { id: req.params.id, tenantId }
            });

            if (!request) {
                return res.status(404).json({ error: 'Request not found' });
            }

            res.json(request);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
