import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { Role } from '@mumo/types';
import app from '../index';

const prisma = new PrismaClient();

let adminToken: string;
let tenantId: string;
let testTableId: string;
let testInventoryItemId: string;

beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({
        where: { domain: 'grand-horizon' },
    });
    expect(tenant).toBeTruthy();
    tenantId = tenant!.id;

    const admin = await prisma.user.findFirst({
        where: { tenantId, email: 'admin@grand.com' },
    });
    expect(admin).toBeTruthy();

    adminToken = jwt.sign(
        { id: admin!.id, tenantId, role: Role.TENANT_ADMIN },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
    );
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('REGRESSION-001: Concurrent table order creation', () => {
    beforeEach(async () => {
        const table = await prisma.table.create({
            data: {
                tenantId,
                number: `Test-Race-${Date.now()}`,
                capacity: 4,
                isOccupied: false,
                zone: 'Test',
                shape: 'SQUARE',
                x: 99,
                y: 99,
            },
        });
        testTableId = table.id;
    });

    afterEach(async () => {
        await prisma.orderItem.deleteMany({
            where: { order: { tableId: testTableId } },
        });
        await prisma.payment.deleteMany({
            where: { order: { tableId: testTableId } },
        });
        await prisma.order.deleteMany({
            where: { tableId: testTableId },
        });
        await prisma.table.deleteMany({
            where: { id: testTableId },
        });
    });

    it('only one of two concurrent orders succeeds on same table', async () => {
        const menuItem = await prisma.menuItem.findFirst({
            where: { tenantId },
        });
        expect(menuItem).toBeTruthy();

        const orderPayload = {
            tableId: testTableId,
            items: [{ menuItemId: menuItem!.id, quantity: 1 }],
        };

        const [res1, res2] = await Promise.all([
            request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${adminToken}`)
                .set('x-tenant-id', tenantId)
                .send(orderPayload),
            request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${adminToken}`)
                .set('x-tenant-id', tenantId)
                .send(orderPayload),
        ]);

        const statuses = [res1.status, res2.status].sort();
        expect(statuses).toEqual([201, 409]);

        const orderCount = await prisma.order.count({
            where: { tableId: testTableId },
        });
        expect(orderCount).toBe(1);

        const table = await prisma.table.findUnique({
            where: { id: testTableId },
        });
        expect(table!.isOccupied).toBe(true);
    });
});

describe('REGRESSION-002: Concurrent inventory decrement', () => {
    beforeEach(async () => {
        const item = await prisma.inventoryItem.create({
            data: {
                tenantId,
                name: `Test-Stock-${Date.now()}`,
                sku: `TSK-${Date.now()}`,
                unit: 'kg',
                currentStock: 5,
                minStock: 1,
                costPerUnit: 1,
            },
        });
        testInventoryItemId = item.id;
    });

    afterEach(async () => {
        await prisma.inventoryAuditLog.deleteMany({
            where: { inventoryItemId: testInventoryItemId },
        });
        await prisma.inventoryItem.deleteMany({
            where: { id: testInventoryItemId },
        });
    });

    it('prevents concurrent decrements from going negative', async () => {
        const adjustPayload = {
            quantity: 4,
            adjustmentType: 'WASTE',
            reason: 'Concurrent test',
        };

        const [res1, res2] = await Promise.all([
            request(app)
                .post(`/api/inventory/${testInventoryItemId}/adjust`)
                .set('Authorization', `Bearer ${adminToken}`)
                .set('x-tenant-id', tenantId)
                .send(adjustPayload),
            request(app)
                .post(`/api/inventory/${testInventoryItemId}/adjust`)
                .set('Authorization', `Bearer ${adminToken}`)
                .set('x-tenant-id', tenantId)
                .send(adjustPayload),
        ]);

        const statuses = [res1.status, res2.status].sort();
        expect(statuses[0]).toBe(200);
        expect(statuses[1]).toBeGreaterThanOrEqual(400);

        const item = await prisma.inventoryItem.findUnique({
            where: { id: testInventoryItemId },
        });
        expect(Number(item!.currentStock)).toBeGreaterThanOrEqual(1);
        expect(Number(item!.currentStock)).not.toBeLessThan(0);

        const logCount = await prisma.inventoryAuditLog.count({
            where: { inventoryItemId: testInventoryItemId },
        });
        expect(logCount).toBe(1);
    });
});

describe('REGRESSION-003: Table settlement transaction', () => {
    let tableId: string;
    let orderId1: string;
    let orderId2: string;

    beforeEach(async () => {
        const menuItem = await prisma.menuItem.findFirst({
            where: { tenantId },
        });
        expect(menuItem).toBeTruthy();

        const table = await prisma.table.create({
            data: {
                tenantId,
                number: `Settle-Test-${Date.now()}`,
                capacity: 4,
                isOccupied: true,
                zone: 'Test',
                shape: 'SQUARE',
                x: 98,
                y: 98,
            },
        });
        tableId = table.id;

        const o1 = await prisma.order.create({
            data: {
                tenantId,
                tableId,
                status: 'OPEN',
                totalAmount: 100,
                items: {
                    create: [{
                        menuItemId: menuItem!.id,
                        quantity: 2,
                        unitPrice: 50,
                        subtotal: 100,
                    }],
                },
            },
        });
        orderId1 = o1.id;

        const o2 = await prisma.order.create({
            data: {
                tenantId,
                tableId,
                status: 'OPEN',
                totalAmount: 50,
                items: {
                    create: [{
                        menuItemId: menuItem!.id,
                        quantity: 1,
                        unitPrice: 50,
                        subtotal: 50,
                    }],
                },
            },
        });
        orderId2 = o2.id;
    });

    afterEach(async () => {
        await prisma.payment.deleteMany({
            where: { orderId: { in: [orderId1, orderId2] } },
        });
        await prisma.orderItem.deleteMany({
            where: { orderId: { in: [orderId1, orderId2] } },
        });
        await prisma.order.deleteMany({
            where: { id: { in: [orderId1, orderId2] } },
        });
        await prisma.table.deleteMany({ where: { id: tableId } });
    });

    it('settles all orders and releases table in one transaction', async () => {
        const res = await request(app)
            .post(`/api/tables/${tableId}/settle-orders`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send({ orderIds: [orderId1, orderId2], method: 'CASH' });

        expect(res.status).toBe(200);

        const payments = await prisma.payment.findMany({
            where: { orderId: { in: [orderId1, orderId2] } },
        });
        expect(payments).toHaveLength(2);

        const orders = await prisma.order.findMany({
            where: { id: { in: [orderId1, orderId2] } },
        });
        expect(orders.every(o => o.status === 'PAID')).toBe(true);

        const table = await prisma.table.findUnique({
            where: { id: tableId },
        });
        expect(table!.isOccupied).toBe(false);
    });

    it('rolls back entirely when one orderId is invalid', async () => {
        const res = await request(app)
            .post(`/api/tables/${tableId}/settle-orders`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send({
                orderIds: [orderId1, '00000000-0000-0000-0000-000000000000'],
                method: 'CASH',
            });

        expect(res.status).toBe(400);

        const payments = await prisma.payment.count({
            where: { orderId: orderId1 },
        });
        expect(payments).toBe(0);
    });
});

describe('REGRESSION-004: Payment underpayment', () => {
    let orderId: string;
    let tableId: string;

    beforeEach(async () => {
        const menuItem = await prisma.menuItem.findFirst({
            where: { tenantId },
        });
        expect(menuItem).toBeTruthy();

        const table = await prisma.table.create({
            data: {
                tenantId,
                number: `Pay-Test-${Date.now()}`,
                capacity: 2,
                isOccupied: true,
                zone: 'Test',
                shape: 'SQUARE',
                x: 97,
                y: 97,
            },
        });
        tableId = table.id;

        const order = await prisma.order.create({
            data: {
                tenantId,
                tableId,
                status: 'OPEN',
                totalAmount: 100,
                items: {
                    create: [{
                        menuItemId: menuItem!.id,
                        quantity: 2,
                        unitPrice: 50,
                        subtotal: 100,
                    }],
                },
            },
        });
        orderId = order.id;
    });

    afterEach(async () => {
        await prisma.payment.deleteMany({ where: { orderId } });
        await prisma.orderItem.deleteMany({ where: { orderId } });
        await prisma.order.deleteMany({ where: { id: orderId } });
        await prisma.table.deleteMany({ where: { id: tableId } });
    });

    it('underpayment does not mark order PAID', async () => {
        const res = await request(app)
            .post('/api/payments')
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send({ orderId, amount: 50, method: 'CASH' });

        expect(res.status).toBe(201);

        const order = await prisma.order.findUnique({
            where: { id: orderId },
        });
        expect(order!.status).not.toBe('PAID');
    });

    it('full payment marks order PAID', async () => {
        await request(app)
            .post('/api/payments')
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send({ orderId, amount: 50, method: 'CASH' });

        const res = await request(app)
            .post('/api/payments')
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send({ orderId, amount: 50, method: 'CASH' });

        expect(res.status).toBe(201);

        const order = await prisma.order.findUnique({
            where: { id: orderId },
        });
        expect(order!.status).toBe('PAID');
    });

    it('overpayment returns 400', async () => {
        const res = await request(app)
            .post('/api/payments')
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send({ orderId, amount: 150, method: 'CASH' });

        expect(res.status).toBe(400);
    });
});

describe('REGRESSION-005: PO create tenant isolation', () => {
    let vendorId: string;

    afterEach(async () => {
        const pos = await prisma.purchaseOrder.findMany({
            where: { vendorId },
            select: { id: true },
        });
        const poIds = pos.map(po => po.id);
        await prisma.purchaseOrderItem.deleteMany({
            where: { purchaseOrderId: { in: poIds } },
        });
        await prisma.purchaseOrder.deleteMany({ where: { id: { in: poIds } } });
        await prisma.vendor.deleteMany({ where: { id: vendorId } });
    });

    it('rejects PO with inventory item from another tenant', async () => {
        const tenantB = await prisma.tenant.findFirst({
            where: { domain: 'seaside-bistro' },
        });
        expect(tenantB).toBeTruthy();

        const foreignItem = await prisma.inventoryItem.findFirst({
            where: { tenantId: tenantB!.id, deletedAt: null },
        });
        expect(foreignItem).toBeTruthy();

        const vendor = await prisma.vendor.create({
            data: {
                tenantId,
                name: `Tenant Isolation Vendor ${Date.now()}`,
            },
        });
        vendorId = vendor.id;

        const beforeCount = await prisma.purchaseOrder.count({ where: { vendorId } });

        const res = await request(app)
            .post('/api/vendors/orders')
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send({
                vendorId,
                items: [{
                    inventoryItemId: foreignItem!.id,
                    orderedQty: 10,
                    unitCost: 5,
                }],
            });

        expect(res.status).toBeGreaterThanOrEqual(400);

        const afterCount = await prisma.purchaseOrder.count({ where: { vendorId } });
        expect(afterCount).toBe(beforeCount);
    });
});
