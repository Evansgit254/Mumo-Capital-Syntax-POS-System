import { Router } from 'express';
import { prisma } from '../lib/prisma';
import rateLimit from 'express-rate-limit';

const router = Router();



const resolveLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per window
    message: { error: 'Too many requests from this IP, please try again after a minute' },
});

router.get('/resolve', resolveLimiter, async (req, res) => {
    try {
        const { subdomain } = req.query;
        if (!subdomain || typeof subdomain !== 'string') {
            return res.status(400).json({ error: 'Subdomain parameter is required' });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { domain: subdomain },
            include: { settings: true }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found. The hotel subdomain may be incorrect.' });
        }

        res.json({
            tenantId: tenant.id,
            tenantName: tenant.name,
            displayName: tenant.settings?.displayName
        });
    } catch (error) {
        console.error('Tenant resolution error:', error);
        res.status(500).json({ error: 'Internal server error while resolving tenant' });
    }
});

export default router;
