-- CreateTable
CREATE TABLE "TenantApplication" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "adminFirstName" TEXT NOT NULL,
    "adminLastName" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "adminPhone" TEXT,
    "propertyType" TEXT NOT NULL,
    "propertySize" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "provisionedAt" TIMESTAMP(3),
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantApplication_domain_key" ON "TenantApplication"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "TenantApplication_adminEmail_key" ON "TenantApplication"("adminEmail");

-- CreateIndex
CREATE INDEX "TenantApplication_status_idx" ON "TenantApplication"("status");

-- CreateIndex
CREATE INDEX "TenantApplication_domain_idx" ON "TenantApplication"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdmin_email_key" ON "SuperAdmin"("email");
