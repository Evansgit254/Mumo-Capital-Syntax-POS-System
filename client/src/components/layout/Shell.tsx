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
    { name: 'Floor Plan', path: '/admin/tables', icon: Layout, roles: ['TENANT_ADMIN'] },
    { name: 'Executive Insights', path: '/admin/analytics', icon: LayoutPanelLeft, roles: ['TENANT_ADMIN'] },
];

export default function Shell() {
    const session = useStore((state) => state.session);
    const sidebarOpen = useStore((state) => state.ui.sidebarOpen);
    const setSidebarOpen = useStore((state) => state.ui.setSidebarOpen);
    const navigate = useNavigate();

    // DEEP-WARN-014: Use comprehensive logout() instead of just clearSession()
    const handleLogout = () => {
        useStore.getState().logout();
        navigate('/login');
    };


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
                        <div className="flex flex-col overflow-hidden animate-fade-in">
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
                    className="hidden tablet:flex absolute top-6 -right-5 h-10 w-10 bg-secondary text-on-secondary rounded-full items-center justify-center transition-all hover:scale-110 active:scale-95 z-50 shadow-xl border-4 border-surface"
                >
                    <ChevronRight className={cn("transition-transform duration-500", sidebarOpen && "rotate-180")} size={24} />
                </button>

                {/* Nav */}
                <nav className={cn(
                    "flex-1 py-6 px-3 space-y-1",
                    sidebarOpen ? "overflow-y-auto" : "overflow-visible"
                )}>
                    {NAV_ITEMS.map((item) => {
                        // Role guard for nav items
                        if (item.roles && !item.roles.includes(session.role as string)) return null;
                        
                        return (
                            <div key={item.path} className="relative group">
                                {(item as any).separator && (
                                    <div className="my-3 mx-2 border-t border-outline-variant/50" />
                                )}
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) => cn(
                                        "flex items-center h-[56px] rounded-xl transition-all relative overflow-hidden",
                                        sidebarOpen ? "gap-4 px-4" : "justify-center px-0 mx-2",
                                        isActive 
                                            ? "bg-secondary text-on-secondary shadow-lg shadow-secondary/20" 
                                            : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                                    )}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <item.icon size={24} className={cn("shrink-0 transition-transform", isActive && "scale-110")} />
                                            {sidebarOpen && (
                                                <span className="font-semibold whitespace-nowrap animate-fade-in">
                                                    {item.name}
                                                </span>
                                            )}
                                            
                                            {isActive && (
                                                <div className={cn(
                                                    "absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full",
                                                    !sidebarOpen && "top-0 bottom-0 w-1.5"
                                                )} />
                                            )}
                                        </>
                                    )}
                                </NavLink>

                                {/* Hover Tooltip (only when collapsed) */}
                                {!sidebarOpen && (
                                    <div className="fixed left-[72px] invisible group-hover:visible opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all duration-200 z-[100] pointer-events-none">
                                        <div className="px-3 py-2 bg-surface-container-highest text-on-surface text-sm font-bold rounded-lg shadow-2xl border border-outline-variant whitespace-nowrap ml-2">
                                            {item.name}
                                            <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-surface-container-highest border-l border-b border-outline-variant rotate-45" />
                                        </div>
                                    </div>
                                )}
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
                            <div className="flex flex-col min-w-0 animate-fade-in">
                                <span className="text-sm font-bold truncate">{session.firstName}</span>
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
                        {sidebarOpen && <span className="label-sm font-black tracking-widest animate-fade-in">Sign Out</span>}
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
