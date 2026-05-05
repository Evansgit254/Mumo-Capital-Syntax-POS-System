import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { createCustomerSchema, updateCustomerSchema } from '../validators/customer';
import { Role } from '@mumo/types';

const router = Router();

// ── GET /api/customers ──────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const { search } = req.query;

        const where: Record<string, unknown> = { tenantId };

        if (search && typeof search === 'string') {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
            ];
        }

        const customers = await prisma.customer.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        res.json(customers);
    } catch (err) {
        next(err);
    }
});

// ── GET /api/customers/:id ──────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const customer = await prisma.customer.findFirst({
            where: { id: req.params.id, tenantId },
        });
        if (!customer) throw notFound('Customer not found');
        res.json(customer);
    } catch (err) {
        next(err);
    }
});

// ── POST /api/customers ─────────────────────────────────────────────────────
router.post(
    '/',
    validate(createCustomerSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;
            const customer = await prisma.customer.create({
                data: { ...req.body, tenantId },
            });
            res.status(201).json(customer);
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/customers/:id ──────────────────────────────────────────────────
router.put(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER),
    validate(updateCustomerSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const existing = await prisma.customer.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Customer not found');

            const updated = await prisma.customer.update({
                where: { id: req.params.id },
                data: req.body,
            });
            res.json(updated);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
