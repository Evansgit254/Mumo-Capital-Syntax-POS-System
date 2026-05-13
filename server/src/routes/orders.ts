import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notFound, badRequest } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { createOrderSchema, updateOrderStatusSchema } from '../validators/order';
import { Role, OrderStatus } from '@mumo/types';

const router = Router();

// ── POST /public/orders/external (Guest Facing) ─────────────────────────────
router.post('/external', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const { tableId, items } = req.body;

        if (!tableId) throw badRequest('Room number/Table ID is required');

        // Fetch menu items to get current prices
        const menuItemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
        const menuItems = await prisma.menuItem.findMany({
            where: { id: { in: menuItemIds }, tenantId },
        });

        if (menuItems.length !== menuItemIds.length) {
            throw badRequest('One or more menu items not found');
        }

        const priceMap = new Map(menuItems.map((m) => [m.id, m.price]));
        const orderItems = items.map((item: { menuItemId: string; quantity: number }) => {
            const unitPrice = priceMap.get(item.menuItemId)!;
            return {
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                unitPrice,
                subtotal: unitPrice.times(item.quantity),
            };
        });

        const totalAmount = orderItems.reduce(
            (sum: Prisma.Decimal, oi: LooseValue) => sum.plus(oi.subtotal),
            new Prisma.Decimal(0)
        );

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
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = req.user!;
        const orders = await prisma.order.findMany({
            where: { tenantId },
            include: {
                items: { include: { menuItem: { select: { name: true, categoryId: true } } } },
                table: { select: { number: true } },
                user: { select: { firstName: true, lastName: true } },
                payments: { select: { method: true, amount: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

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

        res.json(serialized);
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

            // Validate table belongs to tenant if provided
            if (tableId) {
                const table = await prisma.table.findFirst({
                    where: { id: tableId, tenantId },
                });
                if (!table) throw notFound('Table not found in this tenant');
            }

            // Fetch menu items to get current prices — prevents price manipulation
            const menuItemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
            const menuItems = await prisma.menuItem.findMany({
                where: { id: { in: menuItemIds }, tenantId },
            });

            if (menuItems.length !== menuItemIds.length) {
                throw badRequest('One or more menu items not found in this tenant');
            }

            const priceMap = new Map(menuItems.map((m) => [m.id, m.price]));

            // Calculate line items from server-side prices
            const orderItems = items.map((item: { menuItemId: string; quantity: number }) => {
                const unitPrice = priceMap.get(item.menuItemId)!;
                return {
                    menuItemId: item.menuItemId,
                    quantity: item.quantity,
                    unitPrice,
                    subtotal: unitPrice.times(item.quantity),
                };
            });

            const totalAmount = orderItems.reduce(
                (sum: Prisma.Decimal, oi: LooseValue) => sum.plus(oi.subtotal),
                new Prisma.Decimal(0)
            );

            const order = await prisma.order.create({
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
