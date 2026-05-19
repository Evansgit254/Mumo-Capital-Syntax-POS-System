import axios from 'axios';

export interface ResolvedTenant {
    tenantId: string;
    tenantName: string;
    displayName?: string;
    settings?: LooseValue;
}

export class TenantResolutionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TenantResolutionError';
    }
}

// Module-level cache to prevent duplicate lookups in the same browser session
let cachedTenant: ResolvedTenant | null = null;
let resolvePromise: Promise<ResolvedTenant> | null = null;

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) throw new Error(
  'FATAL: VITE_API_URL is not set. Check your .env file.'
);

export async function resolveTenant(forcedSubdomain?: string): Promise<ResolvedTenant> {
    if (cachedTenant && !forcedSubdomain) {
        return cachedTenant;
    }

    if (resolvePromise && !forcedSubdomain) {
        return resolvePromise;
    }

    // Extract subdomain
    const hostname = window.location.hostname;
    let subdomain = forcedSubdomain || 'grand-horizon'; 
    
    if (!forcedSubdomain && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        const parts = hostname.split('.');
        // Handle Railway: tenant.mumo-app-production.up.railway.app
        // parts = [tenant, mumo-app-production, up, railway, app]
        if (parts.length > 4) {
            subdomain = parts[0];
        } else if (parts.length === 4) {
            // base domain: mumo-app-production.up.railway.app
            // parts = [mumo-app-production, up, railway, app]
            // We should NOT default to mumo-app-production, but let the UI handle the failure
            subdomain = ''; 
        } else if (parts.length >= 2) {
            subdomain = parts[0];
        }
    }

    if (!subdomain) {
        throw new TenantResolutionError('No workspace identified. Please specify your property ID.');
    }

    resolvePromise = axios.get<ResolvedTenant>(
        `${API_URL}/api/public/tenants/resolve`,
        { params: { subdomain } }
    ).then(response => {
        cachedTenant = response.data;
        return response.data;
    }).catch(error => {
        if (error.response?.status === 404) {
            throw new TenantResolutionError(`Workspace "${subdomain}" not found.`);
        }
        throw new TenantResolutionError('Failed to connect to the hotel system.');
    }).finally(() => {
        resolvePromise = null;
    });

    return resolvePromise;
}
