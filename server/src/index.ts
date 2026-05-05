import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { authenticate, extractTenant } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import menuRoutes from './routes/menus';
import orderRoutes from './routes/orders';
import tableRoutes from './routes/tables';
import paymentRoutes from './routes/payments';
import reservationRoutes from './routes/reservations';
import customerRoutes from './routes/customers';
import discountRoutes from './routes/discounts';
import inventoryRoutes from './routes/inventory';
import tenantSettingsRoutes from './routes/tenant-settings';
import permissionRoutes from './routes/permissions';
import userRoutes from './routes/users';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// ── Global Middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Public Routes ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'OK', message: 'Mumo POS Server Running', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);

// ── Public API Routes (require tenant ID but no JWT) ──────────────────────
app.use('/api/public/reservations', extractTenant, reservationRoutes);
app.use('/api/public/orders', extractTenant, orderRoutes);
app.use('/api/public/menus', extractTenant, menuRoutes);
app.use('/api/public/tables', extractTenant, tableRoutes);

// ── Protected Routes (require auth + tenant validation) ──────────────────────
app.use('/api/menus', authenticate, menuRoutes);
app.use('/api/orders', authenticate, orderRoutes);
app.use('/api/tables', authenticate, tableRoutes);
app.use('/api/payments', authenticate, paymentRoutes);
app.use('/api/reservations', authenticate, reservationRoutes);
app.use('/api/customers', authenticate, customerRoutes);
app.use('/api/discounts', authenticate, discountRoutes);
app.use('/api/inventory', authenticate, inventoryRoutes);
app.use('/api/tenants', authenticate, tenantSettingsRoutes);
app.use('/api/roles', authenticate, permissionRoutes);
app.use('/api/users', authenticate, userRoutes);

// ── Centralized Error Handler (must be last) ─────────────────────────────────
// Trigger reload for Prisma client sync
app.use(errorHandler);

// ── Startup ──────────────────────────────────────────────────────────────────
app.listen(port, () => {
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

export default app;
