import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Role } from '@mumo/types';

interface ProtectedRouteProps {
    allowedRoles?: Role[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
    const { token, role } = useStore((state) => state.session);
    const location = useLocation();

    if (!token) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && role && !allowedRoles.includes(role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
