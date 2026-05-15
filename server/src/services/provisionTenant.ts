import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { sendApplicationApproved } from './emailService';
import { logger } from '../lib/logger';

function generateSecurePassword(): string {
  const chars =
    'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  return Array.from(crypto.randomBytes(12))
    .map((b) => chars[b % chars.length])
    .join('');
}

export async function provisionTenant(
  applicationId: string,
  reviewedBy: string
) {
  const app = await prisma.tenantApplication.findUnique({
    where: { id: applicationId },
  });

  if (!app) throw new Error('Application not found');
  if (app.status !== 'APPROVED') {
    throw new Error('Application must be APPROVED before provisioning');
  }

  logger.info({ applicationId }, 'Starting tenant provisioning');

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Tenant
    const tenant = await tx.tenant.create({
      data: {
        name: app.organizationName,
        domain: app.domain,
      },
    });

    // 2. Create TenantSettings with defaults
    await tx.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        outletType: app.propertyType,
        taxRate: new Decimal('0'),
        currency: 'USD',
        timezone: 'UTC',
        receiptConfig: {
          headerText: app.organizationName,
          footerText: 'Thank you for your visit!',
          showTaxBreakdown: true,
          showLogo: true,
        },
      },
    });

    // 3. Generate temp password and create TENANT_ADMIN
    const tempPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const adminUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: app.adminEmail,
        firstName: app.adminFirstName,
        lastName: app.adminLastName,
        password: hashedPassword,
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
        hourlyRate: new Decimal('0'),
      },
    });

    // 4. Create 5 default tables
    await tx.table.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        tenantId: tenant.id,
        number: `Table ${i + 1}`,
        capacity: 4,
        isOccupied: false,
        zone: 'Main',
        shape: 'SQUARE',
        x: i * 2,
        y: 0,
      })),
    });

    // 5. Mark application as PROVISIONED
    await tx.tenantApplication.update({
      where: { id: applicationId },
      data: {
        status: 'PROVISIONED',
        tenantId: tenant.id,
        provisionedAt: new Date(),
      },
    });

    return { tenant, adminUser, tempPassword };
  });

  // 6. Send welcome email outside transaction
  const clientUrl = process.env.VITE_CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginUrl = `${clientUrl}/login`;
  await sendApplicationApproved({
    to: app.adminEmail,
    name: app.adminFirstName,
    organizationName: app.organizationName,
    domain: app.domain,
    loginUrl,
    tempPassword: result.tempPassword,
  });

  logger.info(
    { tenantId: result.tenant.id, domain: app.domain },
    'Tenant provisioned successfully'
  );

  return result;
}
