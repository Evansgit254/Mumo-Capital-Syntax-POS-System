import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { validate } from '../middleware/validate';
import { superAdminAuth } from '../middleware/superAdminAuth';
import { provisionTenant } from '../services/provisionTenant';
import {
  sendApplicationReceived,
  sendSuperAdminNotification,
  sendApplicationRejected,
} from '../services/emailService';
import { AppError } from '../lib/errors';

const router = Router();

const applyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many applications from this IP' },
});

const applySchema = z.object({
  organizationName: z.string().min(2).max(100).trim(),
  domain: z.string()
    .min(3).max(30)
    .regex(/^[a-z0-9-]+$/,
      'Only lowercase letters, numbers, and hyphens')
    .trim()
    .toLowerCase(),
  adminFirstName: z.string().min(1).trim(),
  adminLastName: z.string().min(1).trim(),
  adminEmail: z.string().email().toLowerCase().trim(),
  adminPhone: z.string().optional(),
  propertyType: z.enum([
    'HOTEL', 'RESORT', 'RESTAURANT', 'BAR', 'CAFE'
  ]),
  propertySize: z.enum([
    'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'
  ]),
  country: z.string().min(2).trim(),
  message: z.string().max(500).optional(),
});

// ── PUBLIC ROUTES ────────────────────────────────────────

// Check domain availability
router.get('/check-domain', async (req, res, next) => {
  try {
    const domain = String(req.query.domain || '').toLowerCase();
    if (!domain) {
      return res.json({ available: false });
    }
    const [existingTenant, existingApp] = await Promise.all([
      prisma.tenant.findFirst({ where: { domain } }),
      prisma.tenantApplication.findFirst({
        where: { domain, status: { not: 'REJECTED' } }
      }),
    ]);
    res.json({ available: !existingTenant && !existingApp });
  } catch (err) {
    next(err);
  }
});

// Submit application
router.post(
  '/apply',
  applyLimiter,
  validate(applySchema),
  async (req, res, next) => {
    try {
      const data = req.body;

      // Check domain not taken
      const [existingTenantDomain, existingAppDomain] = await Promise.all([
        prisma.tenant.findFirst({ where: { domain: data.domain } }),
        prisma.tenantApplication.findFirst({
          where: { domain: data.domain, status: { not: 'REJECTED' } }
        }),
      ]);

      const domainTaken = !!existingTenantDomain || !!existingAppDomain;

      const [existingUserEmail, existingAppEmail] = await Promise.all([
        prisma.user.findFirst({ where: { email: data.adminEmail } }),
        prisma.tenantApplication.findFirst({
          where: { adminEmail: data.adminEmail }
        }),
      ]);

      const emailTaken = !!existingUserEmail || !!existingAppEmail;

      if (domainTaken) {
        throw new AppError(
          'This domain is already taken. Please choose another.',
          409
        );
      }
      if (emailTaken) {
        throw new AppError(
          'An account with this email already exists.',
          409
        );
      }

      const application = await prisma.tenantApplication.create({
        data: {
          organizationName: data.organizationName,
          domain: data.domain.toLowerCase(),
          adminFirstName: data.adminFirstName,
          adminLastName: data.adminLastName,
          adminEmail: data.adminEmail,
          adminPhone: data.adminPhone,
          propertyType: data.propertyType,
          propertySize: data.propertySize,
          country: data.country,
          message: data.message,
        },
      });

      // Send emails (non-blocking)
      Promise.all([
        sendApplicationReceived({
          to: application.adminEmail,
          name: application.adminFirstName,
          organizationName: application.organizationName,
          applicationId: application.id,
        }),
        sendSuperAdminNotification({
          organizationName: application.organizationName,
          domain: application.domain,
          adminEmail: application.adminEmail,
          propertyType: application.propertyType,
          country: application.country,
          applicationId: application.id,
        }),
      ]).catch(err =>
        logger.error({ err }, 'Failed to send onboarding emails')
      );

      res.status(201).json({
        applicationId: application.id,
        message:
          'Application received. ' +
          'We will review and respond within 24 hours.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// Check application status
router.get('/status/:applicationId', async (req, res, next) => {
  try {
    const app = await prisma.tenantApplication.findUnique({
      where: { id: req.params.applicationId },
      select: {
        status: true,
        organizationName: true,
        createdAt: true,
        reviewedAt: true,
        provisionedAt: true,
        rejectionReason: true,
        domain: true,
      },
    });
    if (!app) throw new AppError('Application not found', 404);
    res.json(app);
  } catch (err) {
    next(err);
  }
});

// ── SUPER-ADMIN ROUTES ───────────────────────────────────

// List applications
router.get(
  '/applications',
  superAdminAuth,
  async (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const where = status ? { status } : {};
      const [applications, total] = await Promise.all([
        prisma.tenantApplication.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.tenantApplication.count({ where }),
      ]);

      res.json({ applications, total, page, limit });
    } catch (err) {
      next(err);
    }
  }
);

// Get single application
router.get(
  '/applications/:id',
  superAdminAuth,
  async (req, res, next) => {
    try {
      const app = await prisma.tenantApplication.findUnique({
        where: { id: req.params.id },
      });
      if (!app) throw new AppError('Application not found', 404);
      res.json(app);
    } catch (err) {
      next(err);
    }
  }
);

// Approve application
router.post(
  '/applications/:id/approve',
  superAdminAuth,
  async (req, res, next) => {
    try {
      const app = await prisma.tenantApplication.findUnique({
        where: { id: req.params.id },
      });
      if (!app) throw new AppError('Application not found', 404);
      if (app.status !== 'PENDING') {
        throw new AppError(
          'Only PENDING applications can be approved', 400
        );
      }

      // Set to APPROVED first
      await prisma.tenantApplication.update({
        where: { id: req.params.id },
        data: {
          status: 'APPROVED',
          reviewedBy: req.superAdmin!.id,
          reviewedAt: new Date(),
        },
      });

      // Provision immediately
      const result = await provisionTenant(
        req.params.id,
        req.superAdmin!.id
      );

      res.json({
        message: result.emailSent 
          ? 'Application approved and client notified.' 
          : 'Application approved, but failed to send notification email.',
        tenantId: result.tenant.id,
        domain: result.tenant.domain,
        emailSent: result.emailSent
      });
    } catch (err) {
      next(err);
    }
  }
);

// Reject application
router.post(
  '/applications/:id/reject',
  superAdminAuth,
  async (req, res, next) => {
    try {
      const { reason } = req.body;
      if (!reason || reason.trim().length < 10) {
        throw new AppError(
          'A rejection reason of at least 10 characters is required',
          400
        );
      }

      const app = await prisma.tenantApplication.findUnique({
        where: { id: req.params.id },
      });
      if (!app) throw new AppError('Application not found', 404);
      if (app.status !== 'PENDING') {
        throw new AppError(
          'Only PENDING applications can be rejected', 400
        );
      }

      await prisma.tenantApplication.update({
        where: { id: req.params.id },
        data: {
          status: 'REJECTED',
          reviewedBy: req.superAdmin!.id,
          reviewedAt: new Date(),
          rejectionReason: reason,
        },
      });

      const emailSent = await sendApplicationRejected({
        to: app.adminEmail,
        name: app.adminFirstName,
        organizationName: app.organizationName,
        reason,
      });

      res.json({ 
        message: emailSent 
          ? 'Application rejected and client notified.' 
          : 'Application rejected, but failed to send notification email.',
        emailSent 
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
