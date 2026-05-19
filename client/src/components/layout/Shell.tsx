import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { 
    LayoutDashboard, 
    ShoppingCart, 
    Map as MapIcon, 
    UtensilsCrossed, 
    CreditCard, 
    BarChart3, 
    LogOut,
    Menu,
    X,
    ChevronRight,
    User,
    ChefHat,
    Calendar,
    Shield,
    Building2,
    Settings,
    Package,
    Heart,
    TrendingUp,
    Truck,
    Users,
    Layout,
    LayoutPanelLeft,
    HelpCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const NAV_ITEMS = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Tables', path: '/tables', icon: MapIcon },
    { name: 'POS', path: '/pos', icon: ShoppingCart },
    { name: 'KDS', path: '/kds', icon: ChefHat },
    { name: 'Reservations', path: '/reservations', icon: Calendar },
    { name: 'Inventory', path: '/inventory', icon: Package, roles: ['TENANT_ADMIN', 'MANAGER', 'STAFF'] },
    { name: 'Forecasting', path: '/inventory/forecast', icon: TrendingUp, roles: ['TENANT_ADMIN', 'MANAGER'] },
    { name: 'Vendors', path: '/vendors', icon: Truck, roles: ['TENANT_ADMIN', 'MANAGER'] },
    { name: 'Workforce', path: '/admin/workforce', icon: Users, roles: ['TENANT_ADMIN', 'MANAGER'] },
    { name: 'Loyalty', path: '/loyalty', icon: Heart, roles: ['TENANT_ADMIN', 'MANAGER', 'STAFF'] },
    { name: 'Guests', path: '/guests', icon: Users, roles: ['TENANT_ADMIN', 'MANAGER', 'STAFF'] },
    { name: 'Menu', path: '/menu', icon: UtensilsCrossed, roles: ['TENANT_ADMIN', 'MANAGER'] },
    { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['TENANT_ADMIN', 'MANAGER', 'STAFF'] },
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'Help', path: '/help', icon: HelpCircle },
    { name: 'Permissions', path: '/admin/permissions', icon: Shield, roles: ['TENANT_ADMIN'], separator: true },
    { name: 'Tenant', path: '/admin/tenant', icon: Building2, roles: ['TENANT_ADMIN'] },
    { name: 'Floor Plan', path: '/admin/tables', icon: Layout, roles: ['TENANT_ADMIN', 'MANAGER'] },
    { name: 'Executive Insights', path: '/admin/analytics', icon: LayoutPanelLeft, roles: ['TENANT_ADMIN'] },
];

export default function Shell() {
    const { session, ui } = useStore();
    const { setSidebarOpen } = ui;
    const navigate = useNavigate();

    // DEEP-WARN-014: Use comprehensive logout() instead of just clearSession()
    const handleLogout = () => {
        useStore.getState().logout();
        navigate('/login');
    };

    const sidebarOpen = ui.sidebarOpen;

    return (
        <div className="flex h-screen bg-surface overflow-hidden">
            {/* Desktop Sidebar */}
            <aside 
                className={cn(
                    "hidden tablet:flex flex-col bg-surface-container-low border-r border-outline-variant transition-all duration-300 shrink-0 relative z-30",
                    sidebarOpen ? "w-[280px] min-w-[280px]" : "w-[80px] min-w-[80px]"
                )}
            >
                {/* Header */}
                <div className="h-[80px] border-b border-outline-variant flex items-center px-6 gap-4">
                    <div className="h-10 w-10 bg-secondary rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-xl font-bold text-white">M</span>
                    </div>
                    {sidebarOpen && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-bold text-on-surface truncate">
                                {session.tenantName || 'Mumo POS'}
                            </span>
                            <span className="label-sm text-secondary truncate">
                                {session.role?.replace('_', ' ')}
                            </span>
                        </div>
                    )}
                </div>

                <button 
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="hidden tablet:flex absolute top-6 -right-4 h-8 w-8 bg-surface-container-high border border-outline-variant rounded-full items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors z-50 shadow-lg"
                >
                    <ChevronRight className={cn("transition-transform", sidebarOpen && "rotate-180")} size={16} />
                </button>

                {/* Nav */}
                <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                    {NAV_ITEMS.map((item) => {
                        // Role guard for nav items
                        if (item.roles && !item.roles.includes(session.role as string)) return null;
                        
                        return (
                            <div key={item.path}>
                                {(item as any).separator && (
                                    <div className="my-3 mx-2 border-t border-outline-variant/50" />
                                )}
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) => cn(
                                        "flex items-center h-[56px] rounded-xl transition-all group relative",
                                        sidebarOpen ? "gap-4 px-4" : "justify-center px-0 mx-2",
                                        isActive 
                                            ? "bg-secondary/10 text-secondary" 
                                            : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                                    )}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <item.icon size={24} className="shrink-0" />
                                            {sidebarOpen && <span className="font-medium">{item.name}</span>}
                                            {!sidebarOpen && (
                                                <div className="absolute left-full ml-2 px-2 py-1 bg-surface-container-highest text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                                    {item.name}
                                                </div>
                                            )}
                                            {isActive && (
                                                <div className={cn(
                                                    "absolute left-0 top-1/4 bottom-1/4 w-1 bg-secondary rounded-r-full",
                                                    !sidebarOpen && "top-0 bottom-0"
                                                )} />
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            </div>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="p-3 border-t border-outline-variant">
                    <div className={cn(
                        "flex items-center gap-4 p-3 rounded-xl bg-surface-container mb-3",
                        !sidebarOpen && "justify-center"
                    )}>
                        <div className="h-10 w-10 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
                            <User size={20} className="text-on-surface-variant" />
                        </div>
                        {sidebarOpen && (
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold truncate">{session.firstName}</span>
                                <span className="text-xs text-on-surface-variant truncate lowercase">{session.email}</span>
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={handleLogout}
                        className={cn(
                            "flex items-center gap-4 px-4 h-[48px] w-full text-error hover:bg-error/10 rounded-xl transition-all",
                            !sidebarOpen && "justify-center"
                        )}
                    >
                        <LogOut size={20} className="shrink-0" />
                        {sidebarOpen && <span className="label-sm font-bold tracking-widest">Sign Out</span>}
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Nav */}
            <aside className="tablet:hidden fixed bottom-10 left-4 right-4 h-[64px] bg-surface-container/80 backdrop-blur-xl border border-outline-variant/30 rounded-2xl flex items-center justify-around z-50 px-2 shadow-2xl">
                {NAV_ITEMS.filter(item => !item.roles || item.roles.includes(session.role as string)).slice(0, 5).map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => cn(
                            "flex flex-col items-center justify-center gap-1 min-w-[56px] transition-all",
                            isActive ? "text-secondary scale-110" : "text-on-surface-variant hover:text-on-surface"
                        )}
                    >
                        <item.icon size={20} className={cn("transition-transform")} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">{item.name}</span>
                    </NavLink>
                ))}
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Mobile Header */}
                <header className="tablet:hidden h-[64px] bg-surface-container-low border-b border-outline-variant flex items-center justify-between px-6 shrink-0">
                    <span className="text-lg font-bold tracking-tight">{session.tenantName}</span>
                    <button onClick={handleLogout} className="text-error">
                        <LogOut size={20} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto pb-20 tablet:pb-0">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
