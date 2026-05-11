import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import Shell from './components/layout/Shell';

// Pages
import LoginPage from './pages/LoginPage';
import CheckInPage from './pages/reception/CheckInPage';
import RoomServicePage from './pages/RoomServicePage';
import ConciergePage from './pages/ConciergePage';
import ActivityBookingPage from './pages/ActivityBookingPage';
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
import TableManagementPage from './pages/admin/TableManagementPage';
import SettingsPage from './pages/SettingsPage';
import InventoryPage from './pages/inventory/InventoryPage';
import InventoryForecastPage from './pages/inventory/InventoryForecastPage';
import VendorPage from './pages/vendors/VendorPage';
import LoyaltyPage from './pages/LoyaltyPage';
import BillingPage from './pages/BillingPage';
import GuestDirectoryPage from './pages/GuestDirectoryPage';
import GuestFolioPage from './pages/GuestFolioPage';
import WorkforcePage from './pages/admin/WorkforcePage';
import ExecutiveAnalyticsPage from './pages/admin/ExecutiveAnalyticsPage';
import { Role } from '@mumo/types';

function App() {
    return (
        <Router>
            <Routes>
                {/* Guest-Facing Routes (Public) */}
                <Route path="/checkin" element={<CheckInPage />} />
                <Route path="/room-service" element={<RoomServicePage />} />
                <Route path="/concierge" element={<ConciergePage />} />
                <Route path="/activities" element={<ActivityBookingPage />} />

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

                        <Route element={<ProtectedRoute allowedRoles={[Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF]} />}>
                            <Route path="/guests" element={<GuestDirectoryPage />} />
                            <Route path="/folio/:roomId" element={<GuestFolioPage />} />
                        </Route>

                        <Route path="/menu" element={<MenuManagerPage />} />
                        <Route path="/checkout" element={<CheckoutPage />} />
                        <Route path="/billing" element={<BillingPage />} />
                        <Route path="/reports" element={<ReportsPage />} />

                        {/* Inventory (Manager/Admin) */}
                        <Route element={<ProtectedRoute allowedRoles={[Role.TENANT_ADMIN, Role.MANAGER]} />}>
                            <Route path="/inventory" element={<InventoryPage />} />
                            <Route path="/inventory/forecast" element={<InventoryForecastPage />} />
                            <Route path="/vendors" element={<VendorPage />} />
                            <Route path="/loyalty" element={<LoyaltyPage />} />
                            <Route path="/admin/workforce" element={<WorkforcePage />} />
                        </Route>

                        {/* Settings (All authenticated roles) */}
                        <Route path="/settings" element={<SettingsPage />} />

                        {/* Admin Routes (TENANT_ADMIN only) */}
                        <Route element={<ProtectedRoute allowedRoles={[Role.TENANT_ADMIN]} />}>
                            <Route path="/admin/permissions" element={<PermissionsPage />} />
                            <Route path="/admin/tenant" element={<TenantPage />} />
                            <Route path="/admin/tables" element={<TableManagementPage />} />
                            <Route path="/admin/analytics" element={<ExecutiveAnalyticsPage />} />
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
