import { useState, useEffect } from 'react';
import { resolveTenant, ResolvedTenant, TenantResolutionError } from '../lib/resolveTenant';

export function useTenant() {
    const [tenant, setTenant] = useState<ResolvedTenant | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        resolveTenant()
            .then(data => {
                if (mounted) {
                    setTenant(data);
                    setIsLoading(false);
                }
            })
            .catch(err => {
                if (mounted) {
                    if (err instanceof TenantResolutionError) {
                        setError(err.message);
                    } else {
                        setError('An unexpected error occurred while resolving the hotel system.');
                    }
                    setIsLoading(false);
                }
            });

        return () => {
            mounted = false;
        };
    }, []);

    return { tenant, isLoading, error };
}
