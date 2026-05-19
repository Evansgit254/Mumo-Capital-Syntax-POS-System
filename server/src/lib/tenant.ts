import { Request } from 'express';
import { AppError } from './errors';

/**
 * Safely extract the tenant ID from a request.
 *
 * Priority:
 *  1. Authenticated user's JWT tenantId (cannot be spoofed via header)
 *  2. x-tenant-id header (for public/guest routes only)
 *
 * FIX 1 — CODEX-CRIT-001: Prevents tenant spoofing on authenticated routes
 * by always preferring the JWT-derived tenantId over the header.
 */
export function getTenantId(req: Request): string {
    // Authenticated users — JWT tenantId always wins
    if (req.user?.tenantId) return req.user.tenantId;

    // Public context (set by extractTenant middleware)
    if (req.publicContext?.tenantId) return req.publicContext.tenantId;

    // Fallback: raw header (backward compat for routes not yet migrated)
    const header = req.headers['x-tenant-id'];
    if (typeof header === 'string' && header) return header;

    throw new AppError('Tenant ID required', 400);
}
