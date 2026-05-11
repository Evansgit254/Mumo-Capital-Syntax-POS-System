import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { restoreSession } from '../api/service';
import { Role } from '@mumo/types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    allowedRoles?: Role[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
    const { token, role } = useStore((state) => state.session);
    const location = useLocation();
    const [isRestoring, setIsRestoring] = useState(!token);

    // FIX 11: On page reload, attempt to restore session from httpOnly cookie
    useEffect(() => {
        if (!token) {
            restoreSession().finally(() => setIsRestoring(false));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Show loading state while attempting silent refresh
    if (isRestoring) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <Loader2 className="animate-spin text-secondary" size={40} />
            </div>
        );
    }

    if (!token) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && role && !allowedRoles.includes(role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
