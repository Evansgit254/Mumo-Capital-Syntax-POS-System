import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { orderService, tableService, inventoryService, reservationService, userService, tenantService } from '../api/service';
import { useStore } from '../store/useStore';
import { 
    TrendingUp, 
    Users, 
    Clock, 
    ArrowRight,
    Utensils,
    AlertCircle,
    ShoppingCart,
    Map as MapIcon,
    Calendar,
    ChevronRight,
    CheckCircle2,
    Package,
    Settings
} from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { OrderStatus, Table, Reservation, InventoryItem } from '@mumo/types';
import { cn } from '../lib/utils';
import { useMemo } from 'react';

export default function DashboardPage() {
    const { session } = useStore();
    const navigate = useNavigate();
    const todayStr = new Date().toISOString().split('T')[0];

    const settingsQuery = useQuery({
        queryKey: ['tenant-settings'],
        queryFn: tenantService.getSettings,
    });

    const currency = settingsQuery.data?.currency || 'KES';
    
    const activeOrdersQuery = useQuery({
        queryKey: ['orders-live'],
        queryFn: () => orderService.getLive(),
        refetchInterval: (query) => {
            // DEEP-WARN-014: Only poll if tab is visible to save resources
            return document.visibilityState === 'visible' ? 15000 : false;
        },
    });

    const ordersQuery = useQuery({
        queryKey: ['orders'],
        queryFn: () => orderService.getAll(),
    });

    const tablesQuery = useQuery({
        queryKey: ['tables'],
        queryFn: () => tableService.getAll(),
    });

    const reservationsQuery = useQuery({
        queryKey: ['reservations', 'today'],
        queryFn: () => reservationService.getAll({ date: todayStr }),
    });

    const inventoryAlertsQuery = useQuery({
        queryKey: ['inventory', 'alerts'],
        queryFn: () => inventoryService.getAlerts(),
    });

    const staffQuery = useQuery({
        queryKey: ['users'],
        queryFn: () => userService.getAll(),
        enabled: session.role === 'TENANT_ADMIN' || session.role === 'MANAGER',
    });

    const isLoading = ordersQuery.isLoading || tablesQuery.isLoading || reservationsQuery.isLoading || inventoryAlertsQuery.isLoading || staffQuery.isLoading;

    // Derived Stats
    const yesterdayStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    }, []);

    const todayOrders = useMemo(() => (ordersQuery.data?.data || []).filter(o => {
        const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
        return orderDate === todayStr;
    }), [ordersQuery.data, todayStr]);

    const yesterdayOrders = useMemo(() => (ordersQuery.data?.data || []).filter(o => {
        const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
        return orderDate === yesterdayStr;
    }), [ordersQuery.data, yesterdayStr]);

    const totalRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    
    const revenueTrend = useMemo(() => {
        if (yesterdayRevenue === 0) return totalRevenue > 0 ? '+100% since yesterday' : 'No change';
        const diff = ((totalRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
        return `${diff >= 0 ? '+' : ''}${Math.round(diff)}% from yesterday`;
    }, [totalRevenue, yesterdayRevenue]);

    const avgPrepTime = useMemo(() => {
        const servedOrders = (ordersQuery.data?.data || []).filter(o => o.status === OrderStatus.SERVED);
        if (servedOrders.length === 0) return 'avg. prep time: --';
        const total = servedOrders.reduce((sum, o) => sum + (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()), 0);
        const mins = Math.round((total / servedOrders.length) / 60000);
        return `avg. prep time: ${mins}m`;
    }, [ordersQuery.data]);

    const pendingOrdersCount = todayOrders.filter(o => o.status === OrderStatus.PENDING).length;

    // Occupancy Logic
    const occupancyData = useMemo(() => {
        if (!tablesQuery.data?.data) return { occupied: 0, reserved: 0, available: 0, total: 0 };
        
        const tables = tablesQuery.data.data;
        const reservations = reservationsQuery.data?.data || [];
        
        // A table is reserved if it has a confirmed booking today
        const reservedTableIds = new Set(
            reservations
                .filter(r => r.status === 'CONFIRMED' || r.status === 'PENDING')
                .map(r => r.tableId)
                .filter(Boolean)
        );

        let occupied = 0;
        let reserved = 0;
        let available = 0;

        tables.forEach(t => {
            if (t.isOccupied) occupied++;
            else if (reservedTableIds.has(t.id)) reserved++;
            else available++;
        });

        return { occupied, reserved, available, total: tables.length };
    }, [tablesQuery.data, reservationsQuery.data]);

    const activeStaff = staffQuery.data?.data?.filter(u => u.status === 'ACTIVE').length || 0;

    return (
        <div className="p-6 tablet:p-10 space-y-10">
            {/* ── Stats Overview ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <StatCard 
                    title="Today's Revenue" 
                    value={`${totalRevenue.toLocaleString()} ${currency}`}
                    trend={revenueTrend}
                    trendUp={totalRevenue >= yesterdayRevenue}
                    icon={<TrendingUp size={24} />}
                    color="bg-secondary"
                />
                <StatCard 
                    title="Active Orders" 
                    value={activeOrdersQuery.data?.length || 0}
                    trend={`${pendingOrdersCount} pending kitchen`}
                    icon={<ShoppingCart size={24} />}
                    color="bg-primary"
                />
                <StatCard 
                    title="Occupancy" 
                    value={`${occupancyData.occupied}/${occupancyData.total}`}
                    trend={`${occupancyData.reserved} reserved today`}
                    icon={<MapIcon size={24} />}
                    color="bg-tertiary"
                />
                <StatCard 
                    title="Staff Active" 
                    value={activeStaff}
                    trend="In workplace now"
                    icon={<Users size={24} />}
                    color="bg-surface-container-highest"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                {/* ── Active Kitchen Orders ──────────────────────────────────── */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                <Clock size={20} />
                            </div>
                            <h2 className="headline-md">Live Kitchen Status</h2>
                        </div>
                        <button 
                            onClick={() => navigate('/kds')}
                            className="flex items-center gap-2 text-sm font-bold text-secondary hover:underline"
                        >
                            Open KDS <ArrowRight size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeOrdersQuery.isLoading ? (
                            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-3xl" />)
                        ) : activeOrdersQuery.data?.length === 0 ? (
                            <div className="col-span-2">
                                <EmptyState 
                                    icon={<Utensils size={40} />}
                                    title="No active orders"
                                    description="When orders are sent to the kitchen, they will appear here."
                                />
                            </div>
                        ) : (
                            activeOrdersQuery.data?.slice(0, 4).map(order => (
                                <OrderMiniCard key={order.id} order={order} />
                            ))
                        )}
                    </div>
                </div>

                {/* ── Inventory Alerts ─────────────────────────────────────── */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                            <AlertCircle size={20} />
                        </div>
                        <h2 className="headline-md">Stock Alerts</h2>
                    </div>

                    <div className="space-y-3">
                        {inventoryAlertsQuery.isLoading ? (
                            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-[80px] rounded-2xl" />)
                        ) : inventoryAlertsQuery.data?.data?.length === 0 ? (
                            <div className="p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 text-center">
                                <CheckCircle2 size={32} className="mx-auto mb-3 text-green-500/30" />
                                <p className="body-sm text-on-surface-variant/60">Inventory is healthy</p>
                            </div>
                        ) : (
                            inventoryAlertsQuery.data?.data?.slice(0, 3).map(item => (
                                <InventoryAlertCard key={item.id} item={item} />
                            ))
                        )}
                        {inventoryAlertsQuery.data?.data && inventoryAlertsQuery.data.data.length > 3 && (
                            <button 
                                onClick={() => navigate('/inventory')}
                                className="w-full py-3 text-sm font-bold text-on-surface-variant hover:text-secondary transition-colors"
                            >
                                View all {inventoryAlertsQuery.data.data.length} alerts
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Quick Actions ───────────────────────────────────────────── */}
            <div className="pt-6 border-t border-outline-variant">
                <h2 className="headline-md mb-6">Quick Operations</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <QuickActionBtn 
                        icon={<ShoppingCart />} 
                        label="Point of Sale" 
                        onClick={() => navigate('/pos')}
                        desc="Create orders"
                    />
                    <QuickActionBtn 
                        icon={<MapIcon />} 
                        label="Table Map" 
                        onClick={() => navigate('/tables')}
                        desc="Manage floor"
                    />
                    <QuickActionBtn 
                        icon={<Package />} 
                        label="Inventory" 
                        onClick={() => navigate('/inventory')}
                        desc="Stock & supply"
                    />
                    <QuickActionBtn 
                        icon={<Settings />} 
                        label="Settings" 
                        onClick={() => navigate('/settings')}
                        desc="App config"
                    />
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, trend, trendUp, icon, color }: any) {
    return (
        <div className="group rounded-[32px] bg-surface-container-low border border-outline-variant/50 p-7 hover:bg-surface-container transition-all hover:shadow-xl hover:shadow-secondary/5">
            <div className="flex items-start justify-between mb-6">
                <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg", color)}>
                    {icon}
                </div>
                <div className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider",
                    trendUp ? "bg-green-500/10 text-green-500" : "bg-on-surface-variant/10 text-on-surface-variant"
                )}>
                    {trendUp ? '↑' : ''} {trend}
                </div>
            </div>
            <p className="text-on-surface-variant/60 font-medium label-md mb-1 uppercase tracking-widest">{title}</p>
            <h3 className="headline-lg text-on-surface group-hover:scale-[1.02] origin-left transition-transform duration-300">{value}</h3>
        </div>
    );
}

function OrderMiniCard({ order }: { order: any }) {
    const timeAgo = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);
    
    return (
        <div className="flex gap-4 p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 hover:shadow-md transition-all">
            <div className="h-12 w-12 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                <Utensils size={20} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-1">
                    <h4 className="body-md font-bold text-on-surface truncate">
                        {order.table ? `Table ${order.table.number}` : 'Takeaway'}
                    </h4>
                    <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                        {timeAgo}m ago
                    </span>
                </div>
                <p className="body-sm text-on-surface-variant truncate">
                    {order.items.length} items • {order.status}
                </p>
                <div className="mt-3 w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div 
                        className={cn(
                            "h-full animate-pulse transition-all duration-1000",
                            order.status === 'PENDING' ? 'bg-orange-400 w-1/3' : 
                            order.status === 'PREPARING' ? 'bg-secondary w-2/3' : 'bg-green-500 w-full'
                        )} 
                    />
                </div>
            </div>
        </div>
    );
}

function InventoryAlertCard({ item }: { item: InventoryItem }) {
    return (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
            <div className="min-w-0 flex-1">
                <h4 className="body-md font-bold text-on-surface truncate">{item.name}</h4>
                <p className="body-sm text-red-500 font-medium">
                    Only {item.currentStock} {item.unit} left
                </p>
            </div>
            <div className="ml-4 px-3 py-1 rounded-lg bg-red-500/10 text-red-500 label-xs font-bold whitespace-nowrap">
                Low Stock
            </div>
        </div>
    );
}

function QuickActionBtn({ icon, label, onClick, desc }: any) {
    return (
        <button 
            onClick={onClick}
            className="flex flex-col items-center justify-center p-6 rounded-[2rem] bg-surface-container-low border border-outline-variant/50 hover:bg-secondary hover:text-white transition-all group hover:shadow-2xl hover:shadow-secondary/20 active:scale-95"
        >
            <div className="h-12 w-12 rounded-2xl bg-surface-container-highest flex items-center justify-center text-secondary group-hover:bg-white/20 group-hover:text-white mb-4 transition-colors">
                {icon}
            </div>
            <span className="label-md font-bold group-hover:text-white">{label}</span>
            <span className="text-[10px] opacity-40 group-hover:opacity-100 h-0 group-hover:h-auto overflow-hidden transition-all">{desc}</span>
        </button>
    );
}
