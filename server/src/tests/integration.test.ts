import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import path from 'path';
import app from '../index';

const prisma = new PrismaClient();

let tenantId: string;

beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({
        where: { domain: 'grand-horizon' },
    });
    expect(tenant).toBeTruthy();
    tenantId = tenant!.id;
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('REGRESSION-006: Public check-in flow', () => {
    let reservationId: string;
    let tableId: string;

    beforeAll(async () => {
        const table = await prisma.table.create({
            data: {
                tenantId,
                number: `CheckIn-Test-${Date.now()}`,
                capacity: 2,
                isOccupied: false,
                zone: 'Test',
                shape: 'SQUARE',
                x: 96,
                y: 96,
            },
        });
        tableId = table.id;

        const startTime = new Date(Date.now() + 60 * 60 * 1000);
        const reservation = await prisma.reservation.create({
            data: {
                tenantId,
                guestName: 'Test Guest',
                guestCount: 2,
                startTime,
                endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
                status: 'PENDING',
                tableId,
            },
        });
        reservationId = reservation.id;
    });

    afterAll(async () => {
        await prisma.reservation.deleteMany({
            where: { id: reservationId },
        });
        await prisma.table.deleteMany({ where: { id: tableId } });
    });

    it('successfully checks in a pending reservation', async () => {
        const res = await request(app)
            .post(`/api/public/reservations/${reservationId}/checkin`)
            .set('x-tenant-id', tenantId)
            .send({ guestName: 'Test Guest' });

        expect(res.status).toBe(200);

        const reservation = await prisma.reservation.findUnique({
            where: { id: reservationId },
        });
        expect(reservation!.status).toBe('SEATED');
    });

    it('rejects duplicate check-in with 409', async () => {
        const res = await request(app)
            .post(`/api/public/reservations/${reservationId}/checkin`)
            .set('x-tenant-id', tenantId)
            .send({ guestName: 'Test Guest' });

        expect(res.status).toBe(409);
    });
});

describe('REGRESSION-007: Vendor PO creation UI wiring', () => {
    it('has a purchase order modal wired to create POs and refresh the list', () => {
        const modalPath = path.resolve(process.cwd(), '../client/src/components/vendors/PurchaseOrderModal.tsx');
        const pagePath = path.resolve(process.cwd(), '../client/src/pages/vendors/VendorPage.tsx');

        const modal = readFileSync(modalPath, 'utf8');
        const page = readFileSync(pagePath, 'utf8');

        expect(page).toContain("setIsPOModalOpen(true)");
        expect(page).toContain("<PurchaseOrderModal");
        expect(modal).toContain("purchaseOrderService.create");
        expect(modal).toContain("queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })");
        expect(modal).toContain("items.length === 0");
        expect(modal).toContain("parseFloat(item.quantity) <= 0");
    });
});

describe('REGRESSION-008: Frontend route permissions', () => {
    it('restricts tenant, table admin, and analytics routes to TENANT_ADMIN only', () => {
        const appPath = path.resolve(process.cwd(), '../client/src/App.tsx');
        const appSource = readFileSync(appPath, 'utf8');

        expect(appSource).toContain("ProtectedRoute allowedRoles={[Role.TENANT_ADMIN]}");
        expect(appSource).toContain('<Route path="/admin/tenant"');
        expect(appSource).toContain('<Route path="/admin/tables"');
        expect(appSource).toContain('<Route path="/admin/analytics"');

        const adminBlockStart = appSource.indexOf('{/* Admin Routes');
        const adminBlock = appSource.slice(adminBlockStart, appSource.indexOf('{/* Root redirect */', adminBlockStart));

        expect(adminBlock).not.toContain('Role.MANAGER');
    });
});
