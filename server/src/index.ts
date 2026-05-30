import 'dotenv/config';
import path from 'path';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { authenticate, extractTenant } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

import authRoutes, { cleanupInterval } from './routes/auth';
import menuRoutes from './routes/menus';
import orderRoutes from './routes/orders';
import tableRoutes from './routes/tables';
import paymentRoutes from './routes/payments';
import { publicReservationRouter, staffReservationRouter } from './routes/reservations';
import customerRoutes from './routes/customers';
import discountRoutes from './routes/discounts';
import inventoryRoutes from './routes/inventory';
import tenantSettingsRoutes from './routes/tenant-settings';
import permissionRoutes from './routes/permissions';
import userRoutes from './routes/users';
import tenantPublicRoutes from './routes/tenants-public';
import requestsRoutes from './routes/requests';
import activitiesRoutes from './routes/activities';
import shiftsRoutes from './routes/shifts';
import clockEventsRoutes from './routes/clock-events';
import activityBookingsRoutes from './routes/activity-bookings';
import vendorRoutes from './routes/vendors';
import onboardingRouter from './routes/onboarding';
import superAdminAuthRouter from './routes/super-admin-auth';

const app = express();
app.set("trust proxy", 1);
const port = process.env.PORT || 5000;
const rawOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '').split(',')
    .map(o => o.trim())
    .filter(Boolean);

// ── Global Middleware ────────────────────────────────────────────────────────
// FIX 9 — CRITICAL-012: Helmet FIRST, before all other middleware
app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed = rawOrigins.some(pattern => {
            if (pattern.startsWith('*.')) {
                const domain = pattern.slice(2);
                return origin.endsWith(`.${domain}`) ||
                    origin === `https://${domain}`;
            }
            return origin === pattern;
        });
        if (allowed) callback(null, true);
        else callback(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Public Routes ────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            status: 'OK',
            database: 'connected',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
        });
    } catch (err) {
        res.status(503).json({
            status: 'ERROR',
            database: 'disconnected',
            timestamp: new Date().toISOString(),
        });
    }
});

app.use('/auth', authRoutes);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/super-admin', superAdminAuthRouter);

// ── Public API Routes (require tenant ID but no JWT) ──────────────────────
app.use('/api/public/reservations', extractTenant, publicReservationRouter);
app.use('/api/public/orders', extractTenant, orderRoutes);
app.use('/api/public/menus', extractTenant, menuRoutes);
app.use('/api/public/tables', extractTenant, tableRoutes);
app.use('/api/public/tenants', tenantPublicRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/clock-events', clockEventsRoutes);
app.use('/api/activity-bookings', activityBookingsRoutes);

// ── Protected Routes (require auth + tenant validation) ──────────────────────
app.use('/api/menus', authenticate, menuRoutes);
app.use('/api/orders', authenticate, orderRoutes);
app.use('/api/tables', authenticate, tableRoutes);
app.use('/api/payments', authenticate, paymentRoutes);
app.use('/api/reservations', authenticate, staffReservationRouter);
app.use('/api/customers', authenticate, customerRoutes);
app.use('/api/discounts', authenticate, discountRoutes);
app.use('/api/inventory', authenticate, inventoryRoutes);
app.use('/api/tenants', authenticate, tenantSettingsRoutes);
app.use('/api/roles', authenticate, permissionRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/vendors', authenticate, vendorRoutes);

// ── Centralized Error Handler (must be last) ─────────────────────────────────
// Trigger reload for Prisma client sync
app.use(errorHandler);

// ── Super Admin Sync ───────────────────────────────────────────────────────
async function syncSuperAdmin() {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !password) {
        logger.info('Skipping Super Admin sync: credentials not provided in environment');
        return;
    }

    try {
        const bcrypt = await import('bcrypt');
        const hash = await bcrypt.hash(password, 12);
        
        await prisma.superAdmin.upsert({
            where: { email },
            update: { passwordHash: hash },
            create: {
                email,
                passwordHash: hash,
                name: 'Super Admin',
            },
        });
        logger.info(`Super Admin synched for: ${email}`);
    } catch (err) {
        logger.error({ err }, 'Failed to sync Super Admin');
    }
}

// ── Startup ──────────────────────────────────────────────────────────────────
const server = process.env.NODE_ENV === 'test'
    ? null
    : app.listen(port, async () => {
        await syncSuperAdmin();
        console.log(`\n🚀 Mumo POS Server running on http://localhost:${port}\n`);
        console.log('Registered routes:');
        console.log('  PUBLIC:');
        console.log('    GET    /health');
        console.log('    POST   /auth/register');
        console.log('    POST   /auth/login');
        console.log('    POST   /auth/refresh');
        console.log('  PROTECTED (Bearer + x-tenant-id):');
        console.log('    GET    /api/menus');
        console.log('    GET    /api/menus/:id');
        console.log('    POST   /api/menus');
        console.log('    PUT    /api/menus/:id');
        console.log('    DELETE /api/menus/:id');
        console.log('    GET    /api/orders');
        console.log('    GET    /api/orders/live          (KDS)');
        console.log('    GET    /api/orders/:id');
        console.log('    POST   /api/orders');
        console.log('    PUT    /api/orders/:id/status');
        console.log('    GET    /api/tables');
        console.log('    GET    /api/tables/:id');
        console.log('    GET    /api/tables/:id/orders');
        console.log('    POST   /api/tables');
        console.log('    PUT    /api/tables/:id');
        console.log('    DELETE /api/tables/:id');
        console.log('    GET    /api/payments');
        console.log('    GET    /api/payments/:id');
        console.log('    POST   /api/payments');
        console.log('    PUT    /api/payments/:id/status');
        console.log('    GET    /api/reservations');
        console.log('    GET    /api/reservations/waitlist');
        console.log('    GET    /api/reservations/:id');
        console.log('    POST   /api/reservations');
        console.log('    PUT    /api/reservations/:id');
        console.log('    DELETE /api/reservations/:id');
        console.log('    POST   /api/reservations/:id/checkin');
        console.log('    GET    /api/customers');
        console.log('    GET    /api/customers/:id');
        console.log('    POST   /api/customers');
        console.log('    PUT    /api/customers/:id');
        console.log('    POST   /api/discounts/redeem');
        console.log('    GET    /api/inventory');
        console.log('    GET    /api/inventory/:id');
        console.log('    POST   /api/inventory');
        console.log('    PUT    /api/inventory/:id');
        console.log('    DELETE /api/inventory/:id');
        console.log('    POST   /api/inventory/:id/adjust');
        console.log('    GET    /api/tenants/settings');
        console.log('    PUT    /api/tenants/settings');
        console.log('    GET    /api/roles/:role/permissions');
        console.log('    PUT    /api/roles/:role/permissions');
        console.log('');
    });

// ── Static Assets (Client) ──────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(process.cwd(), 'client/dist');
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
        // If it looks like an API call, don't serve index.html (safety)
        if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
            return res.status(404).json({ error: 'Not Found' });
        }
        res.sendFile(path.join(clientDist, 'index.html'));
    });
}

// ── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    clearInterval(cleanupInterval); // FIX 2 — CODEX-WARN-003: Clear cleanup interval on shutdown
    if (!server) {
        await prisma.$disconnect();
        process.exit(0);
    }
    server.close(async () => {
        await prisma.$disconnect();
        logger.info('Server closed and database disconnected');
        process.exit(0);
    });
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
