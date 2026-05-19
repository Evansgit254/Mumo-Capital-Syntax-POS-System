import { Navigate, Outlet } from 'react-router-dom';
import { useStore } from '../store/useStore';

/**
 * DEEP-WARN-017: Super admin route guard.
 * Checks the superAdmin slice in Zustand (not the tenant session).
 * Redirects to /super-admin/login if no super admin token is present.
 */
export default function SuperAdminRoute() {
    const { token } = useStore((state) => state.superAdmin);

    if (!token) {
        return <Navigate to="/super-admin/login" replace />;
    }

    return <Outlet />;
}
