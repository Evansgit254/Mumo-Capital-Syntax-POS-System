import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import Shell from './components/layout/Shell';

// Pages
import LoginPage from './pages/LoginPage';
import CheckInPage from './pages/reception/CheckInPage';
import RoomServicePage from './pages/RoomServicePage';
import DashboardPage from './pages/DashboardPage';
import POSPage from './pages/POSPage';
import TableMapPage from './pages/TableMapPage';
import TableDetailsPage from './pages/TableDetailsPage';
import KDSPage from './pages/KDSPage';
import ReservationsPage from './pages/ReservationsPage';
import MenuManagerPage from './pages/MenuManagerPage';
import CheckoutPage from './pages/CheckoutPage';
import ReportsPage from './pages/ReportsPage';
import PermissionsPage from './pages/admin/PermissionsPage';
import TenantPage from './pages/admin/TenantPage';
import SettingsPage from './pages/SettingsPage';
import { Role } from '@mumo/types';

function App() {
    return (
        <Router>
            <Routes>
                {/* Guest-Facing Routes (Public) */}
                <Route path="/checkin" element={<CheckInPage />} />
                <Route path="/room-service" element={<RoomServicePage />} />

                {/* Public Staff Route */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected App Shell */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<Shell />}>
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/pos" element={<POSPage />} />
                        
                        {/* Tables */}
                        <Route path="/tables" element={<TableMapPage />} />
                        <Route path="/tables/:id" element={<TableDetailsPage />} />
                        
                        {/* KDS (Restricted) */}
                        <Route element={<ProtectedRoute allowedRoles={[Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF]} />}>
                            <Route path="/kds" element={<KDSPage />} />
                        </Route>

                        {/* Reservations (Restricted) */}
                        <Route element={<ProtectedRoute allowedRoles={[Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF]} />}>
                            <Route path="/reservations" element={<ReservationsPage />} />
                        </Route>

                        <Route path="/menu" element={<MenuManagerPage />} />
                        <Route path="/checkout" element={<CheckoutPage />} />
                        <Route path="/reports" element={<ReportsPage />} />

                        {/* Settings (All authenticated roles) */}
                        <Route path="/settings" element={<SettingsPage />} />

                        {/* Admin Routes (TENANT_ADMIN only) */}
                        <Route element={<ProtectedRoute allowedRoles={[Role.TENANT_ADMIN]} />}>
                            <Route path="/admin/permissions" element={<PermissionsPage />} />
                            <Route path="/admin/tenant" element={<TenantPage />} />
                        </Route>
                        
                        {/* Root redirect */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Route>
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
