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

export async function resolveTenant(): Promise<ResolvedTenant> {
    if (cachedTenant) {
        return cachedTenant;
    }

    if (resolvePromise) {
        return resolvePromise;
    }

    // Extract subdomain
    const hostname = window.location.hostname;
    // Localhost fallback for development
    let subdomain = 'grand-horizon'; 
    
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        const parts = hostname.split('.');
        // Assuming format like: grand-horizon.domain.com
        if (parts.length >= 2) {
            subdomain = parts[0];
        }
    }

    resolvePromise = axios.get<{tenantId: string; tenantName: string; displayName?: string; settings?: LooseValue}>(
        `${API_URL}/api/public/tenants/resolve`,
        { params: { subdomain } }
    ).then(response => {
        cachedTenant = response.data;
        return response.data;
    }).catch(error => {
        if (error.response?.status === 404) {
            throw new TenantResolutionError('Tenant not found for this subdomain.');
        }
        throw new TenantResolutionError('Failed to resolve tenant.');
    }).finally(() => {
        resolvePromise = null;
    });

    return resolvePromise;
}
