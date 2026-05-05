import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { orderService, tableService, inventoryService, reservationService, userService } from '../api/service';
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
    Package
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
    
    // Queries
    const ordersQuery = useQuery({
        queryKey: ['orders'],
        queryFn: orderService.getAll,
    });

    const tablesQuery = useQuery({
        queryKey: ['tables'],
        queryFn: tableService.getAll,
    });

    const reservationsQuery = useQuery({
        queryKey: ['reservations', 'today'],
        queryFn: () => reservationService.getAll({ date: todayStr }),
    });

    const inventoryAlertsQuery = useQuery({
        queryKey: ['inventory', 'alerts'],
        queryFn: inventoryService.getAlerts,
    });

    const staffQuery = useQuery({
        queryKey: ['users'],
        queryFn: userService.getAll,
    });

    const isLoading = ordersQuery.isLoading || tablesQuery.isLoading || reservationsQuery.isLoading || inventoryAlertsQuery.isLoading || staffQuery.isLoading;

    // Derived Stats
    const todayOrders = useMemo(() => ordersQuery.data?.filter(o => {
        const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
        return orderDate === todayStr;
    }) || [], [ordersQuery.data, todayStr]);

    const totalRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const pendingOrdersCount = todayOrders.filter(o => o.status === OrderStatus.PENDING).length;

    // Occupancy Logic
    const occupancyData = useMemo(() => {
        if (!tablesQuery.data) return { occupied: 0, reserved: 0, available: 0, total: 0 };
        
        const tables = tablesQuery.data;
        const reservations = reservationsQuery.data || [];
        
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

    return (
        <div className="p-6 tablet:p-10 space-y-10">
            {/* Greeting */}
            <div className="flex flex-col gap-1">
                <h1 className="display-lg text-on-surface">Good Day, {session.firstName}</h1>
                <p className="body-lg text-on-surface-variant">Here's what's happening at <span className="text-secondary font-bold">{session.tenantName}</span> today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {isLoading ? (
                    Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
                ) : (
                    <>
                        <StatCard 
                            title="Today's Revenue" 
                            value={`${totalRevenue.toLocaleString()} KES`} 
                            icon={TrendingUp} 
                            trend="+12% from yesterday"
                            color="bg-secondary/10 text-secondary"
                        />
                        <StatCard 
                            title="Active Orders" 
                            value={pendingOrdersCount.toString()} 
                            icon={Clock} 
                            trend="avg. prep time: 14m"
                            color="bg-tertiary/10 text-tertiary"
                        />
                        <StatCard 
                            title="Table Occupancy" 
                            value={`${occupancyData.occupied}/${occupancyData.total}`} 
                            icon={Utensils} 
                            trend={`${Math.round((occupancyData.occupied / (occupancyData.total || 1)) * 100)}% capacity`}
                            color="bg-primary/10 text-on-surface"
                        />
                        <StatCard 
                            title="Staff Active" 
                            value={staffQuery.data?.length.toString() || '0'} 
                            icon={Users} 
                            trend={`${staffQuery.data?.length || 0} staff members set up`}
                            color="bg-surface-container-highest text-on-surface-variant"
                        />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left: Recent Orders & Alerts */}
                <div className="lg:col-span-2 space-y-10">
                    {/* Recent Orders */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="headline-md">Recent Orders</h2>
                            <button onClick={() => navigate('/reports')} className="flex items-center gap-2 text-secondary label-sm hover:underline">
                                View All <ArrowRight size={14} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {isLoading ? (
                                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
                            ) : todayOrders.length === 0 ? (
                                <div className="card-default flex flex-col items-center justify-center py-12 text-on-surface-variant/40">
                                    <AlertCircle size={48} className="mb-4 opacity-20" />
                                    <p className="body-lg">No orders yet today.</p>
                                </div>
                            ) : (
                                todayOrders.slice(0, 5).map((order) => (
                                    <div key={order.id} className="card-interactive flex items-center justify-between p-4 px-6 hover:bg-surface-container-high transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-surface-container-highest rounded-full flex items-center justify-center text-secondary">
                                                <ShoppingCart size={24} />
                                            </div>
                                            <div>
                                                <h3 className="body-md font-bold text-on-surface">Order #{order.id.slice(-4).toUpperCase()}</h3>
                                                <p className="body-sm text-on-surface-variant">Table {(order as any).table?.number || 'Takeaway'}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className="body-md font-bold text-secondary">{order.totalAmount.toLocaleString()} KES</span>
                                            <span className={cn(
                                                "pill-status",
                                                order.status === OrderStatus.PENDING && "bg-tertiary/10 text-tertiary border border-tertiary/20",
                                                order.status === OrderStatus.READY && "bg-secondary/10 text-secondary border border-secondary/20",
                                                order.status === OrderStatus.SERVED && "bg-surface-container-highest text-on-surface-variant"
                                            )}>
                                                {order.status}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Inventory Alerts Card */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="headline-md">Inventory Alerts</h2>
                            <button onClick={() => navigate('/menu')} className="flex items-center gap-2 text-secondary label-sm hover:underline">
                                Management <ArrowRight size={14} />
                            </button>
                        </div>
                        <div className="card-default p-0 overflow-hidden">
                            {isLoading ? (
                                <Skeleton className="h-40 w-full" />
                            ) : !inventoryAlertsQuery.data || inventoryAlertsQuery.data.length === 0 ? (
                                <div className="p-10 flex flex-col items-center justify-center text-center">
                                    <div className="h-16 w-16 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-4">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <h3 className="body-lg font-bold text-on-surface">All stock levels healthy</h3>
                                    <p className="text-sm text-on-surface-variant">Everything is currently above reorder thresholds.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-outline-variant/30">
                                    {inventoryAlertsQuery.data.map((item: InventoryItem) => (
                                        <div key={item.id} className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                                                    <Package size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="body-md font-bold text-on-surface">{item.name}</h4>
                                                    <p className="text-xs text-on-surface-variant uppercase tracking-widest">Threshold: {item.minStock} {item.unit}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="body-md font-black text-red-400">{item.currentStock} {item.unit}</div>
                                                <p className="text-[10px] text-red-500/60 font-bold uppercase">CRITICAL</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Right: Occupancy Chart & Reservations */}
                <div className="space-y-10">
                    {/* Live Occupancy Chart */}
                    <section className="space-y-6">
                        <h2 className="headline-md">Occupancy</h2>
                        <div className="card-default p-8 flex flex-col items-center text-center space-y-6">
                            <div className="relative h-48 w-48 flex items-center justify-center">
                                {/* Simple SVG Donut */}
                                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-surface-container-highest" />
                                    
                                    {/* Occupied Slice */}
                                    <circle 
                                        cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="10" 
                                        strokeDasharray={`${(occupancyData.occupied / (occupancyData.total || 1)) * 251.2} 251.2`} 
                                        className="text-secondary transition-all duration-1000" 
                                    />
                                    
                                    {/* Reserved Slice (Offset by occupied) */}
                                    <circle 
                                        cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="10" 
                                        strokeDasharray={`${(occupancyData.reserved / (occupancyData.total || 1)) * 251.2} 251.2`} 
                                        strokeDashoffset={-((occupancyData.occupied / (occupancyData.total || 1)) * 251.2)}
                                        className="text-tertiary transition-all duration-1000" 
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="display-sm font-black text-on-surface">{Math.round((occupancyData.occupied / (occupancyData.total || 1)) * 100)}%</span>
                                    <span className="label-sm text-on-surface-variant">Occupied</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 w-full gap-2">
                                <OccupancyLegend label="Active" count={occupancyData.occupied} color="bg-secondary" />
                                <OccupancyLegend label="Reserved" count={occupancyData.reserved} color="bg-tertiary" />
                                <OccupancyLegend label="Free" count={occupancyData.available} color="bg-surface-container-highest" />
                            </div>
                        </div>
                    </section>

                    {/* Upcoming Reservations */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="headline-md">Reservations</h2>
                            <button onClick={() => navigate('/reservations')} className="text-secondary label-sm hover:underline">Today</button>
                        </div>
                        <div className="space-y-3">
                            {isLoading ? (
                                Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
                            ) : !reservationsQuery.data || reservationsQuery.data.length === 0 ? (
                                <div className="p-8 bg-surface-container/30 rounded-3xl border border-dashed border-outline-variant text-center space-y-2">
                                    <div className="h-10 w-10 bg-surface-container-highest rounded-full flex items-center justify-center mx-auto text-on-surface-variant/40">
                                        <Calendar size={20} />
                                    </div>
                                    <p className="body-sm text-on-surface-variant font-medium">No reservations today</p>
                                </div>
                            ) : (
                                reservationsQuery.data.slice(0, 5).map((res: any) => (
                                    <div key={res.id} className="card-default !p-4 flex items-center gap-4 hover:border-secondary/40 transition-colors">
                                        <div className="h-12 w-12 rounded-xl bg-surface-container-high flex flex-col items-center justify-center shrink-0 border border-outline-variant/30">
                                            <span className="text-[10px] font-bold text-secondary uppercase -mb-1">
                                                {new Date(res.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[0]}
                                            </span>
                                            <span className="text-[10px] font-black text-on-surface opacity-40">
                                            {new Date(res.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[1]}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="body-sm font-bold text-on-surface truncate">{res.guestName}</h4>
                                            <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
                                                <Users size={10} className="shrink-0" /> {res.guestCount} pax 
                                                <span className="opacity-20">|</span> 
                                                <MapIcon size={10} className="shrink-0" /> Table {res.table?.number || 'TBD'}
                                            </p>
                                        </div>
                                        <ChevronRight size={16} className="text-on-surface-variant/20" />
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Quick Actions */}
                    <section className="space-y-4">
                        <h2 className="headline-md">Quick Actions</h2>
                        <div className="grid grid-cols-1 gap-4">
                            <QuickActionBtn label="New POS Order" icon={ShoppingCart} onClick={() => navigate('/pos')} color="bg-secondary" />
                            <QuickActionBtn label="Manage Tables" icon={MapIcon} onClick={() => navigate('/tables')} color="bg-surface-container-highest" />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, trend, color }: any) {
    return (
        <div className="card-default space-y-4 bg-surface-container-low/50 hover:bg-surface-container-low transition-all">
            <div className="flex items-center justify-between">
                <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", color)}>
                    <Icon size={24} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">{title}</span>
            </div>
            <div className="space-y-1">
                <h3 className="headline-md !text-[32px] font-bold text-on-surface">{value}</h3>
                <p className="label-sm !normal-case !font-medium text-on-surface-variant/60">{trend}</p>
            </div>
        </div>
    );
}

function QuickActionBtn({ label, icon: Icon, onClick, color }: any) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "flex items-center gap-4 p-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] w-full text-left font-semibold",
                color === 'bg-secondary' ? "bg-secondary text-white shadow-xl shadow-secondary/20" : "bg-surface-container border border-outline-variant text-on-surface"
            )}
        >
            <Icon size={24} />
            <span>{label}</span>
        </button>
    );
}

function OccupancyLegend({ label, count, color }: { label: string, count: number, color: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
                <div className={cn("h-1.5 w-1.5 rounded-full", color)} />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">{label}</span>
            </div>
            <span className="text-sm font-black text-on-surface">{count}</span>
        </div>
    );
}
