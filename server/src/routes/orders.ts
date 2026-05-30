import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { notFound, badRequest, conflict } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { createOrderSchema, updateOrderStatusSchema } from '../validators/order';
import { Role, OrderStatus } from '@mumo/types';

// FIX-006 (DEEP-CRIT-006): Zod schema for public external orders
const externalOrderSchema = z.object({
    tableId: z.string().min(1, 'Room number/Table ID is required'),
    items: z.array(z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1),
        notes: z.string().max(200).optional(),
        modifiers: z.array(z.string()).optional(),
    })).min(1, 'At least one item required'),
});

const router = Router();

// ── POST /public/orders/external (Guest Facing) ─────────────────────────────
// FIX-006: Validated with Zod schema + tenant-scoped table check
router.post('/external', validate(externalOrderSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const data = req.body;
        const { tableId, items } = data;

        // FIX-006: Verify table belongs to tenant
        const table = await prisma.table.findFirst({
            where: { id: tableId, tenantId },
        });
        if (!table) throw notFound('Table not found');

        // Fetch menu items to get current prices
        const menuItemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
        const menuItems = await prisma.menuItem.findMany({
            where: { id: { in: menuItemIds }, tenantId },
        });

        if (menuItems.length !== menuItemIds.length) {
            throw badRequest('One or more menu items not found');
        }

        const priceMap = new Map(menuItems.map((m) => [m.id, m.price]));
        const orderItems = items.map((item: { menuItemId: string; quantity: number, notes?: string, modifiers?: string[] }) => {
            const unitPrice = priceMap.get(item.menuItemId)!;
            const subtotal = unitPrice.times(item.quantity).toDecimalPlaces(2);
            return {
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                unitPrice,
                subtotal,
                notes: item.notes || null,
                modifiers: item.modifiers || []
            };
        });

        const totalAmount = orderItems.reduce(
            (sum: Prisma.Decimal, oi: LooseValue) => sum.plus(oi.subtotal),
            new Prisma.Decimal(0)
        ).toDecimalPlaces(2);

        const order = await prisma.order.create({
            data: {
                tenantId,
                tableId,
                status: OrderStatus.PENDING,
                totalAmount,
                items: { create: orderItems },
            },
            include: { items: true },
        });

        const serialized = {
            ...order,
            totalAmount: order.totalAmount.toNumber(),
            items: order.items.map(item => ({
                ...item,
                unitPrice: item.unitPrice.toNumber(),
                subtotal: item.subtotal.toNumber()
            }))
        };

        res.status(201).json(serialized);
    } catch (err) {
        next(err);
    }
});


// ── GET /api/orders ──────────────────────────────────────────────────────────
// FIX 4 — CODEX-WARN-012: Paginated list endpoint
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Number(req.query.limit) || 50);
        const skip = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where: { tenantId },
                include: {
                    items: { include: { menuItem: { select: { name: true, categoryId: true } } } },
                    table: { select: { number: true } },
                    user: { select: { firstName: true, lastName: true } },
                    payments: { select: { method: true, amount: true, status: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.order.count({ where: { tenantId } }),
        ]);

        const serialized = orders.map(order => ({
            ...order,
            totalAmount: order.totalAmount.toNumber(),
            items: order.items.map(item => ({
                ...item,
                unitPrice: item.unitPrice.toNumber(),
                subtotal: item.subtotal.toNumber()
            })),
            payments: order.payments.map(p => ({
                ...p,
                amount: p.amount.toNumber()
            }))
        }));

        res.json({
            data: serialized,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        next(err);
    }
});

// ── GET /api/orders/live (KDS) ───────────────────────────────────────────────
// Must be before /:id to avoid path conflict
router.get('/live', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const activeStatuses = [
            OrderStatus.PENDING,
            OrderStatus.PAID,
            OrderStatus.PREPARING,
            OrderStatus.READY,
        ];

        const orders = await prisma.order.findMany({
            where: {
                tenantId,
                status: { in: activeStatuses },
            },
            include: {
                items: { include: { menuItem: { select: { name: true, categoryId: true } } } },
                table: { select: { id: true, number: true } },
                user: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        const serialized = orders.map(order => ({
            ...order,
            totalAmount: order.totalAmount.toNumber(),
            items: order.items.map(item => ({
                ...item,
                unitPrice: item.unitPrice.toNumber(),
                subtotal: item.subtotal.toNumber()
            }))
        }));

        res.json(serialized);
    } catch (err) {
        next(err);
    }
});

// ── GET /api/orders/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const order = await prisma.order.findFirst({
            where: { id: req.params.id, tenantId },
            include: {
                items: { include: { menuItem: true } },
                table: true,
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                payments: true,
            },
        });
        if (!order) throw notFound('Order not found');

        const serialized = {
            ...order,
            totalAmount: order.totalAmount.toNumber(),
            items: order.items.map(item => ({
                ...item,
                unitPrice: item.unitPrice.toNumber(),
                subtotal: item.subtotal.toNumber(),
                menuItem: item.menuItem ? {
                    ...item.menuItem,
                    price: item.menuItem.price.toNumber()
                } : undefined
            })),
            payments: order.payments.map(p => ({
                ...p,
                amount: p.amount.toNumber()
            }))
        };

        res.json(serialized);
    } catch (err) {
        next(err);
    }
});

// ── POST /api/orders ─────────────────────────────────────────────────────────
router.post(
    '/',
    validate(createOrderSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, id: userId } = req.user!;
            const { tableId, items } = req.body;

            // FIX-001 (DEEP-CRIT-001): Atomic table locking — conditional updateMany
            const order = await prisma.$transaction(async (tx) => {
                // If table provided, atomically lock it
                if (tableId) {
                    const locked = await tx.table.updateMany({
                        where: { id: tableId, tenantId, isOccupied: false },
                        data: { isOccupied: true },
                    });
                    if (locked.count !== 1) {
                        throw conflict('Table is not available or already occupied');
                    }
                }

                // Fetch menu items to get current prices — prevents price manipulation
                const menuItemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
                const menuItems = await tx.menuItem.findMany({
                    where: { id: { in: menuItemIds }, tenantId },
                });

                if (menuItems.length !== menuItemIds.length) {
                    throw badRequest('One or more menu items not found in this tenant');
                }

                const priceMap = new Map(menuItems.map((m) => [m.id, m.price]));

                // Calculate line items from server-side prices
                const orderItems = items.map((item: { menuItemId: string; quantity: number, notes?: string, modifiers?: string[] }) => {
                    const unitPrice = priceMap.get(item.menuItemId)!;
                    const subtotal = unitPrice.times(item.quantity).toDecimalPlaces(2);
                    return {
                        menuItemId: item.menuItemId,
                        quantity: item.quantity,
                        unitPrice,
                        subtotal,
                        notes: item.notes || null,
                        modifiers: item.modifiers || []
                    };
                });

                const totalAmount = orderItems.reduce(
                    (sum: Prisma.Decimal, oi: LooseValue) => sum.plus(oi.subtotal),
                    new Prisma.Decimal(0)
                ).toDecimalPlaces(2);

                const created = await tx.order.create({
                    data: {
                        tenantId,
                        userId,
                        tableId: tableId || null,
                        status: OrderStatus.PENDING,
                        totalAmount,
                        items: { create: orderItems },
                    },
                    include: { items: true },
                });

                // FIX-001: Table already locked atomically above — no second update needed

                return created;
            });

            const serialized = {
                ...order,
                totalAmount: order.totalAmount.toNumber(),
                items: order.items.map(item => ({
                    ...item,
                    unitPrice: item.unitPrice.toNumber(),
                    subtotal: item.subtotal.toNumber()
                }))
            };

            res.status(201).json(serialized);
        } catch (err) {
            next(err);
        }
    }
);

// ── PUT /api/orders/:id/status ───────────────────────────────────────────────
router.put(
    '/:id/status',
    requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF),
    validate(updateOrderStatusSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = req.user!;

            const existing = await prisma.order.findFirst({
                where: { id: req.params.id, tenantId },
            });
            if (!existing) throw notFound('Order not found');

            const updated = await prisma.order.update({
                where: { id: req.params.id },
                data: { status: req.body.status },
                include: { items: true },
            });

            const serialized = {
                ...updated,
                totalAmount: updated.totalAmount.toNumber(),
                items: updated.items.map(item => ({
                    ...item,
                    unitPrice: item.unitPrice.toNumber(),
                    subtotal: item.subtotal.toNumber()
                }))
            };

            res.json(serialized);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
