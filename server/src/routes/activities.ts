import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';

const router = Router();


const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many requests from this IP, please try again after a minute' },
});

const activitySchema = z.object({
    name: z.string().min(1),
    description: z.string(),
    duration: z.number().int().positive(),
    price: z.number().min(0),
    maxCapacity: z.number().int().positive(),
    imageUrl: z.string().optional()
});

// GET endpoints are public
router.get('/', publicLimiter, async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });

        const activities = await prisma.activity.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' }
        });
        res.json(activities.map(a => ({ ...a, price: a.price.toNumber() })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

router.get('/:id', publicLimiter, async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const activity = await prisma.activity.findUnique({
            where: { id: req.params.id }
        });

        if (!activity || activity.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        res.json({ ...activity, price: activity.price.toNumber() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

// Admin routes
router.use(authenticate);

router.post('/', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        if (req.user.role !== 'TENANT_ADMIN' && req.user.role !== 'MANAGER') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const data = activitySchema.parse(req.body);

        const activity = await prisma.activity.create({
            data: {
                tenantId: req.user.tenantId,
                availableSlots: data.maxCapacity,
                ...data,
                price: new Prisma.Decimal(data.price)
            }
        });

        res.status(201).json({ ...activity, price: activity.price.toNumber() });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to create activity' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        if (req.user.role !== 'TENANT_ADMIN' && req.user.role !== 'MANAGER') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const data = activitySchema.parse(req.body);

        const activity = await prisma.activity.updateMany({
            where: { id: req.params.id, tenantId: req.user.tenantId },
            data: {
                ...data,
                availableSlots: data.maxCapacity,
                price: new Prisma.Decimal(data.price)
            }
        });

        if (activity.count === 0) return res.status(404).json({ error: 'Activity not found' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update activity' });
    }
});

export default router;
