import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { createCustomerSchema, updateCustomerSchema } from '../validators/customer';
import { Role } from '@mumo/types';

const router = Router();

// ── GET /api/customers ──────────────────────────────────────────────────────
// FIX 4 — CODEX-WARN-012: Paginated list endpoint
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const { search } = req.query;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Number(req.query.limit) || 50);
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = { tenantId };

        if (search && typeof search === 'string') {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
            ];
        }

        const [customers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                orderBy: { name: 'asc' },
                skip,
                take: limit,
            }),
            prisma.customer.count({ where }),
        ]);

        res.json({
            data: customers.map(c => ({
                ...c,
                totalSpend: c.totalSpend.toNumber()
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
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
        res.json({
            ...customer,
            totalSpend: customer.totalSpend.toNumber()
        });
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
            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const customer = await prisma.customer.create({
                data: {
                    tenantId,
                    name: req.body.name,
                    email: req.body.email ? req.body.email.trim().toLowerCase() : undefined,
                    phone: req.body.phone,
                    totalSpend: new Prisma.Decimal(req.body.totalSpend || 0),
                },
            });
            res.status(201).json({
                ...customer,
                totalSpend: customer.totalSpend.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/customers/:id ──────────────────────────────────────────────────
router.put(
    '/:id',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF),
    validate(updateCustomerSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const existing = await prisma.customer.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Customer not found');

            // FIX 3 — CODEX-WARN-004: Explicit field mapping (no mass assignment)
            const updated = await prisma.customer.update({
                where: { id: req.params.id },
                data: {
                    name: req.body.name,
                    email: req.body.email ? req.body.email.trim().toLowerCase() : undefined,
                    phone: req.body.phone,
                    loyaltyPoints: req.body.loyaltyPoints,
                    totalSpend: req.body.totalSpend !== undefined ? new Prisma.Decimal(req.body.totalSpend) : undefined,
                },
            });
            res.json({
                ...updated,
                totalSpend: updated.totalSpend.toNumber()
            });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
