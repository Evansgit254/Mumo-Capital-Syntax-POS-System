import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'password123';

async function main() {
    console.log('🌱 Seeding database...\n');

    // ── Clean existing data (order matters for FK constraints) ─────────────────
    await prisma.rolePermission.deleteMany();
    await prisma.tenantSettings.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menuItem.deleteMany();
    await prisma.table.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    // ══════════════════════════════════════════════════════════════════════════════
    // TENANT 1: Grand Horizon Resort
    // ══════════════════════════════════════════════════════════════════════════════
    const tenant1 = await prisma.tenant.create({
        data: {
            name: 'Grand Horizon Resort',
            domain: 'grand-horizon',
        },
    });
    console.log(`✅ Tenant: ${tenant1.name} (${tenant1.id})`);

    // Users
    const t1Admin = await prisma.user.create({
        data: {
            tenantId: tenant1.id,
            email: 'admin@grand.com',
            password: hashedPassword,
            firstName: 'Alice',
            lastName: 'Director',
            role: 'TENANT_ADMIN',
        },
    });
    const t1Manager = await prisma.user.create({
        data: {
            tenantId: tenant1.id,
            email: 'manager@grand.com',
            password: hashedPassword,
            firstName: 'Bob',
            lastName: 'Manager',
            role: 'MANAGER',
        },
    });
    const t1Cashier = await prisma.user.create({
        data: {
            tenantId: tenant1.id,
            email: 'cashier@grand.com',
            password: hashedPassword,
            firstName: 'Carol',
            lastName: 'Staff',
            role: 'STAFF',
        },
    });
    console.log(`   Users: ${t1Admin.email}, ${t1Manager.email}, ${t1Cashier.email}`);

    // Menu Items
    await prisma.menuItem.createMany({
        data: [
            { tenantId: tenant1.id, name: 'Grilled Salmon', description: 'Atlantic salmon with lemon butter sauce', price: 24.99, isAvailable: true },
            { tenantId: tenant1.id, name: 'Wagyu Burger', description: 'Premium wagyu beef with truffle aioli', price: 18.50, isAvailable: true },
            { tenantId: tenant1.id, name: 'Caesar Salad', description: 'Romaine lettuce, croutons, parmesan', price: 12.00, isAvailable: true },
            { tenantId: tenant1.id, name: 'Lobster Bisque', description: 'Creamy New England style', price: 15.99, isAvailable: true },
            { tenantId: tenant1.id, name: 'Tiramisu', description: 'Classic Italian dessert', price: 9.50, isAvailable: true },
        ],
    });
    console.log('   Menu Items: 5 created');

    // Tables
    const t1Tables = await Promise.all([
        prisma.table.create({ data: { tenantId: tenant1.id, number: 'T1', type: 'TABLE', capacity: 2 } }),
        prisma.table.create({ data: { tenantId: tenant1.id, number: 'T2', type: 'TABLE', capacity: 4 } }),
        prisma.table.create({ data: { tenantId: tenant1.id, number: 'T3', type: 'TABLE', capacity: 4 } }),
        prisma.table.create({ data: { tenantId: tenant1.id, number: 'T4', type: 'TABLE', capacity: 6 } }),
        prisma.table.create({ data: { tenantId: tenant1.id, number: 'T5', type: 'TABLE', capacity: 8 } }),
        prisma.table.create({ data: { tenantId: tenant1.id, number: 'T6', type: 'TABLE', capacity: 10 } }),
        prisma.table.create({ data: { tenantId: tenant1.id, number: '101', type: 'ROOM', capacity: 4 } }),
        prisma.table.create({ data: { tenantId: tenant1.id, number: '102', type: 'ROOM', capacity: 4 } }),
        prisma.table.create({ data: { tenantId: tenant1.id, number: '201', type: 'ROOM', capacity: 6 } }),
    ]);
    console.log('   Tables & Rooms: 9 created');

    // Reservations
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    dayAfter.setHours(20, 0, 0, 0);

    await prisma.reservation.createMany({
        data: [
            {
                tenantId: tenant1.id,
                tableId: t1Tables[3].id, // T4 (6-seater)
                guestName: 'James Kariuki',
                guestPhone: '+254712345678',
                guestEmail: 'james.k@email.com',
                guestCount: 4,
                startTime: tomorrow,
                status: 'CONFIRMED',
                notes: 'Anniversary dinner — champagne on arrival',
            },
            {
                tenantId: tenant1.id,
                tableId: t1Tables[0].id, // T1 (2-seater)
                guestName: 'Sarah Wanjiku',
                guestPhone: '+254723456789',
                guestCount: 2,
                startTime: dayAfter,
                status: 'PENDING',
            },
            {
                tenantId: tenant1.id,
                guestName: 'Michael Odhiambo',
                guestPhone: '+254734567890',
                guestCount: 8,
                startTime: tomorrow,
                status: 'PENDING',
                notes: 'Business dinner — needs large table, on waitlist',
            },
        ],
    });
    console.log('   Reservations: 3 created');

    // Customers
    await prisma.customer.createMany({
        data: [
            {
                tenantId: tenant1.id,
                name: 'James Kariuki',
                email: 'james.k@email.com',
                phone: '+254712345678',
                totalSpend: 45800.00,
                visitCount: 23,
                loyaltyPoints: 4580,
            },
            {
                tenantId: tenant1.id,
                name: 'Grace Muthoni',
                email: 'grace.m@email.com',
                phone: '+254745678901',
                totalSpend: 12300.00,
                visitCount: 8,
                loyaltyPoints: 1230,
            },
            {
                tenantId: tenant1.id,
                name: 'Peter Kimani',
                phone: '+254756789012',
                totalSpend: 89200.00,
                visitCount: 56,
                loyaltyPoints: 8920,
            },
        ],
    });
    console.log('   Customers: 3 created');

    // Inventory Items
    await prisma.inventoryItem.createMany({
        data: [
            { tenantId: tenant1.id, name: 'Atlantic Salmon (Fresh)', sku: 'GH-FISH-001', unit: 'kg', currentStock: 25.5, minStock: 10, costPerUnit: 1800 },
            { tenantId: tenant1.id, name: 'Wagyu Beef Patties', sku: 'GH-MEAT-001', unit: 'pcs', currentStock: 48, minStock: 20, costPerUnit: 650 },
            { tenantId: tenant1.id, name: 'Romaine Lettuce', sku: 'GH-VEG-001', unit: 'heads', currentStock: 30, minStock: 15, costPerUnit: 120 },
            { tenantId: tenant1.id, name: 'Heavy Cream', sku: 'GH-DAIRY-001', unit: 'liters', currentStock: 12, minStock: 8, costPerUnit: 350 },
            { tenantId: tenant1.id, name: 'Mascarpone Cheese', sku: 'GH-DAIRY-002', unit: 'kg', currentStock: 5.5, minStock: 3, costPerUnit: 2200 },
        ],
    });
    console.log('   Inventory: 5 items created');

    // Tenant Settings
    await prisma.tenantSettings.create({
        data: {
            tenantId: tenant1.id,
            currency: 'KES',
            taxRate: 16.0,
            timezone: 'Africa/Nairobi',
        },
    });
    console.log('   Settings: created');

    // Role Permissions (custom STAFF override)
    await prisma.rolePermission.create({
        data: {
            tenantId: tenant1.id,
            role: 'STAFF',
            permissions: [
                'pos:create_order',
                'pos:view_menu',
                'tables:view',
                'reservations:view',
                'customers:view',
            ],
        },
    });
    console.log('   Role Permissions: STAFF customized\n');

    // ══════════════════════════════════════════════════════════════════════════════
    // TENANT 2: Seaside Bistro
    // ══════════════════════════════════════════════════════════════════════════════
    const tenant2 = await prisma.tenant.create({
        data: {
            name: 'Seaside Bistro',
            domain: 'seaside-bistro',
        },
    });
    console.log(`✅ Tenant: ${tenant2.name} (${tenant2.id})`);

    // Users
    const t2Admin = await prisma.user.create({
        data: {
            tenantId: tenant2.id,
            email: 'admin@seaside.com',
            password: hashedPassword,
            firstName: 'David',
            lastName: 'Owner',
            role: 'TENANT_ADMIN',
        },
    });
    const t2Manager = await prisma.user.create({
        data: {
            tenantId: tenant2.id,
            email: 'manager@seaside.com',
            password: hashedPassword,
            firstName: 'Eva',
            lastName: 'Floor Manager',
            role: 'MANAGER',
        },
    });
    const t2Cashier = await prisma.user.create({
        data: {
            tenantId: tenant2.id,
            email: 'cashier@seaside.com',
            password: hashedPassword,
            firstName: 'Frank',
            lastName: 'Cashier',
            role: 'STAFF',
        },
    });
    console.log(`   Users: ${t2Admin.email}, ${t2Manager.email}, ${t2Cashier.email}`);

    // Menu Items
    await prisma.menuItem.createMany({
        data: [
            { tenantId: tenant2.id, name: 'Fish & Chips', description: 'Beer-battered cod with tartar sauce', price: 14.99, isAvailable: true },
            { tenantId: tenant2.id, name: 'Shrimp Tacos', description: 'Grilled shrimp with mango salsa', price: 13.50, isAvailable: true },
            { tenantId: tenant2.id, name: 'Clam Chowder', description: 'Fresh local clams in cream base', price: 10.00, isAvailable: true },
            { tenantId: tenant2.id, name: 'Beach Burger', description: 'Angus beef, avocado, crispy onion', price: 16.00, isAvailable: true },
            { tenantId: tenant2.id, name: 'Key Lime Pie', description: 'House-made with whipped cream', price: 8.50, isAvailable: true },
        ],
    });
    console.log('   Menu Items: 5 created');

    // Tables
    const t2Tables = await Promise.all([
        prisma.table.create({ data: { tenantId: tenant2.id, number: 'B1', capacity: 2 } }),
        prisma.table.create({ data: { tenantId: tenant2.id, number: 'B2', capacity: 2 } }),
        prisma.table.create({ data: { tenantId: tenant2.id, number: 'B3', capacity: 4 } }),
        prisma.table.create({ data: { tenantId: tenant2.id, number: 'B4', capacity: 4 } }),
        prisma.table.create({ data: { tenantId: tenant2.id, number: 'B5', capacity: 6 } }),
        prisma.table.create({ data: { tenantId: tenant2.id, number: 'B6', capacity: 8 } }),
    ]);
    console.log('   Tables: 6 created');

    // Reservations
    await prisma.reservation.createMany({
        data: [
            {
                tenantId: tenant2.id,
                tableId: t2Tables[4].id, // B5 (6-seater)
                guestName: 'Lisa Chen',
                guestPhone: '+15551234567',
                guestEmail: 'lisa.chen@email.com',
                guestCount: 5,
                startTime: tomorrow,
                status: 'CONFIRMED',
                notes: 'Birthday celebration — gluten-free options needed',
            },
            {
                tenantId: tenant2.id,
                tableId: t2Tables[1].id, // B2 (2-seater)
                guestName: 'Mark Johnson',
                guestPhone: '+15559876543',
                guestCount: 2,
                startTime: dayAfter,
                status: 'PENDING',
            },
            {
                tenantId: tenant2.id,
                guestName: 'Corporate Event — Acme Inc',
                guestPhone: '+15555555555',
                guestCount: 12,
                startTime: tomorrow,
                status: 'CONFIRMED',
                notes: 'Company dinner — prepaid, full venue',
            },
        ],
    });
    console.log('   Reservations: 3 created');

    // Customers
    await prisma.customer.createMany({
        data: [
            {
                tenantId: tenant2.id,
                name: 'Lisa Chen',
                email: 'lisa.chen@email.com',
                phone: '+15551234567',
                totalSpend: 3420.50,
                visitCount: 15,
                loyaltyPoints: 342,
            },
            {
                tenantId: tenant2.id,
                name: 'Tom Rivera',
                email: 'tom.r@email.com',
                phone: '+15552345678',
                totalSpend: 1890.00,
                visitCount: 9,
                loyaltyPoints: 189,
            },
            {
                tenantId: tenant2.id,
                name: 'Amy Nguyen',
                phone: '+15553456789',
                totalSpend: 6780.00,
                visitCount: 34,
                loyaltyPoints: 678,
            },
        ],
    });
    console.log('   Customers: 3 created');

    // Inventory Items
    await prisma.inventoryItem.createMany({
        data: [
            { tenantId: tenant2.id, name: 'Fresh Cod Fillets', sku: 'SB-FISH-001', unit: 'kg', currentStock: 18, minStock: 8, costPerUnit: 22.50 },
            { tenantId: tenant2.id, name: 'Jumbo Shrimp', sku: 'SB-FISH-002', unit: 'kg', currentStock: 10, minStock: 5, costPerUnit: 35.00 },
            { tenantId: tenant2.id, name: 'Angus Beef Patties', sku: 'SB-MEAT-001', unit: 'pcs', currentStock: 60, minStock: 25, costPerUnit: 8.50 },
            { tenantId: tenant2.id, name: 'Fresh Clams', sku: 'SB-FISH-003', unit: 'kg', currentStock: 7.5, minStock: 4, costPerUnit: 28.00 },
            { tenantId: tenant2.id, name: 'Key Limes', sku: 'SB-FRUIT-001', unit: 'pcs', currentStock: 200, minStock: 50, costPerUnit: 0.75 },
        ],
    });
    console.log('   Inventory: 5 items created');

    // Tenant Settings
    await prisma.tenantSettings.create({
        data: {
            tenantId: tenant2.id,
            currency: 'USD',
            taxRate: 8.25,
            timezone: 'America/Los_Angeles',
        },
    });
    console.log('   Settings: created');

    // Role Permissions (custom STAFF override)
    await prisma.rolePermission.create({
        data: {
            tenantId: tenant2.id,
            role: 'STAFF',
            permissions: [
                'pos:create_order',
                'pos:view_menu',
                'tables:view',
                'reservations:view',
            ],
        },
    });
    console.log('   Role Permissions: STAFF customized\n');

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Seed complete!');
    console.log('');
    console.log('  Default password for all users: ' + DEFAULT_PASSWORD);
    console.log('');
    console.log('  Tenant 1: Grand Horizon Resort');
    console.log(`    ID: ${tenant1.id}`);
    console.log('    admin@grand.com / manager@grand.com / cashier@grand.com');
    console.log('');
    console.log('  Tenant 2: Seaside Bistro');
    console.log(`    ID: ${tenant2.id}`);
    console.log('    admin@seaside.com / manager@seaside.com / cashier@seaside.com');
    console.log('═══════════════════════════════════════════════════════');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
