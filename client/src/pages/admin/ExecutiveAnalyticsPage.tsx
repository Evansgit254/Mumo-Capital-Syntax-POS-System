import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
    Calendar, 
    Download, 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Users, 
    Package, 
    Activity,
    ChevronDown,
    LayoutPanelLeft,
    Clock,
    AlertTriangle,
    RotateCcw,
    FileBarChart,
    BarChart3,
    ArrowRight
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    AreaChart, Area, Cell, PieChart as RePieChart, Pie 
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

// Services
import { 
    orderService, 
    paymentService, 
    shiftService, 
    userService, 
    inventoryService,
    tableService,
    getErrorMessage 
} from '../../api/service';

// Libs
import { 
    deriveRevenue, 
    deriveOccupancy, 
    deriveMenuPerformance, 
    deriveLaborCost, 
    deriveInventoryStats,
    DateRange 
} from '../../lib/analytics';
import { downloadCSV } from '../../lib/exportCsv';
import toast from 'react-hot-toast';

// UI
import Skeleton from '../../components/ui/Skeleton';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface PanelProps {
    dateRange: DateRange;
}

// ─── ERROR BOUNDARY (Simplistic for Panel level) ──────────────────────────────

class PanelErrorBoundary extends React.Component<{ children: React.ReactNode, title: string, onRetry: () => void }, { hasError: boolean }> {
    constructor(props: LooseValue) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
        if (this.state.hasError) {
            return (
                <div className="card-default h-full min-h-[300px] flex flex-col items-center justify-center p-8 space-y-4">
                    <AlertTriangle size={48} className="text-error/50" />
                    <div className="text-center">
                        <h3 className="body-lg font-bold text-on-surface">Panel Error: {this.props.title}</h3>
                        <p className="body-sm text-on-surface-variant">Something went wrong while rendering this panel.</p>
                    </div>
                    <button onClick={() => { this.setState({ hasError: false }); this.props.onRetry(); }} className="btn-secondary flex items-center gap-2">
                        <RotateCcw size={16} />
                        Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ─── PANELS ──────────────────────────────────────────────────────────────────

const RevenuePanel: React.FC<PanelProps> = ({ dateRange }) => {
    const queryClient = useQueryClient();
    const { data: payments, isLoading, error, refetch } = useQuery({
        queryKey: ['executive-revenue', dateRange],
        queryFn: paymentService.getAll // Ideally we'd pass filters to API, but using client aggregation as requested
    });

    const stats = useMemo(() => payments ? deriveRevenue(payments, dateRange) : null, [payments, dateRange]);

    if (isLoading) return <Skeleton className="h-[400px] w-full rounded-3xl" />;
    if (error) return (
        <div className="card-default p-10 text-center space-y-4">
            <p className="text-error">Failed to load revenue data</p>
            <button onClick={() => refetch()} className="btn-secondary mx-auto">Retry</button>
        </div>
    );

    return (
        <div className="card-default p-8 space-y-8">
            <div className="flex items-center justify-between">
                <h3 className="headline-sm font-bold flex items-center gap-3">
                    <DollarSign size={20} className="text-secondary" />
                    Revenue Overview
                </h3>
                <div className="flex items-center gap-2">
                   <span className="label-sm bg-secondary/10 text-secondary px-3 py-1 rounded-full font-bold">TOTAL: KES {stats?.totalRevenue.toLocaleString()}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="h-[250px]">
                    <p className="label-sm text-on-surface-variant mb-4 uppercase tracking-widest font-bold">Daily Trend</p>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats?.trendData}>
                            <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" opacity={0.3} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }} tickFormatter={v => `K${v/1000}k`} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--surface-container-high)', border: 'none', borderRadius: '12px' }} />
                            <Area type="monotone" dataKey="revenue" stroke="var(--color-secondary)" strokeWidth={3} fill="url(#colorRev)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="h-[250px]">
                    <p className="label-sm text-on-surface-variant mb-4 uppercase tracking-widest font-bold">Revenue by Outlet</p>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.outletData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" opacity={0.3} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }} />
                            <Tooltip cursor={{fill: 'var(--surface-container-high)'}} contentStyle={{ backgroundColor: 'var(--surface-container-high)', border: 'none', borderRadius: '12px' }} />
                            <Bar dataKey="value" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const OccupancyPanel: React.FC<PanelProps> = ({ dateRange }) => {
    const { data: orders, isLoading: ordersLoading } = useQuery({ queryKey: ['executive-orders', dateRange], queryFn: () => orderService.getAll() });
    const { data: tables, isLoading: tablesLoading } = useQuery({ queryKey: ['executive-tables'], queryFn: () => tableService.getAll() });

    const stats = useMemo(() => (orders && tables) ? deriveOccupancy(orders, tables, dateRange) : null, [orders, tables, dateRange]);

    if (ordersLoading || tablesLoading) return <Skeleton className="h-[300px] w-full rounded-3xl" />;

    return (
        <div className="card-default p-8 space-y-6">
            <h3 className="headline-sm font-bold flex items-center gap-3">
                <Users size={20} className="text-secondary" />
                Occupancy & Covers
            </h3>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30">
                    <p className="label-sm text-on-surface-variant uppercase font-bold">Total Covers</p>
                    <p className="display-sm">{stats?.totalCovers}</p>
                </div>
                <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30">
                    <p className="label-sm text-on-surface-variant uppercase font-bold">Avg. Turn Time</p>
                    <p className="display-sm text-secondary">{stats?.avgTurnTime}m</p>
                </div>
                {/* Visual grid representation of heatmap would go here if space permitted, showing summary metrics instead for mobile-first layout */}
            </div>
        </div>
    );
};

const MenuPanel: React.FC<PanelProps> = ({ dateRange }) => {
    const { data: orders, isLoading } = useQuery({ queryKey: ['executive-orders-menu', dateRange], queryFn: () => orderService.getAll() });
    const stats = useMemo(() => orders ? deriveMenuPerformance(orders, dateRange) : null, [orders, dateRange]);

    if (isLoading) return <Skeleton className="h-[400px] w-full rounded-3xl" />;

    return (
        <div className="card-default p-8 space-y-8">
            <h3 className="headline-sm font-bold flex items-center gap-3">
                <BarChart3 size={20} className="text-secondary" />
                Menu Performance
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                    <p className="label-sm text-on-surface-variant uppercase tracking-widest font-bold border-b border-outline-variant pb-2">Top 10 by Revenue</p>
                    <div className="space-y-3">
                        {stats?.topRevenue.map((item, i) => (
                            <div key={i} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-on-surface-variant w-4">{i+1}</span>
                                    <span className="body-md font-semibold text-on-surface group-hover:text-secondary transition-colors">{item.name}</span>
                                </div>
                                <span className="body-md font-bold">KES {item.revenue.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <p className="label-sm text-on-surface-variant uppercase tracking-widest font-bold border-b border-outline-variant pb-2">Needs Attention (Bottom 5)</p>
                    <div className="space-y-3">
                        {stats?.bottomRevenue.map((item, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <span className="body-md font-semibold text-on-surface-variant">{item.name}</span>
                                <span className="label-sm px-2 py-0.5 rounded bg-error/10 text-error font-bold tracking-tighter">LOW VOLUME</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const LaborPanel: React.FC<PanelProps> = ({ dateRange }) => {
    const { data: shifts, isLoading: sLoading } = useQuery({ queryKey: ['executive-shifts', dateRange], queryFn: () => shiftService.getAll() });
    const { data: users, isLoading: uLoading } = useQuery({ queryKey: ['executive-users'], queryFn: () => userService.getAll() });

    const stats = useMemo(() => (shifts && users) ? deriveLaborCost(shifts, users, dateRange) : null, [shifts, users, dateRange]);

    if (sLoading || uLoading) return <Skeleton className="h-[250px] w-full rounded-3xl" />;

    return (
        <div className="card-default p-8 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="headline-sm font-bold flex items-center gap-3">
                    <Clock size={20} className="text-secondary" />
                    Labor Efficiency
                </h3>
                <div className="text-right">
                    <p className="label-sm text-on-surface-variant uppercase font-bold">Total Cost</p>
                    <p className="headline-md font-bold text-on-surface">KES {stats?.totalCost.toLocaleString()}</p>
                </div>
            </div>

            {stats?.missingRates.length! > 0 && (
                <div className="p-4 bg-tertiary/10 border border-tertiary/30 rounded-2xl flex items-start gap-3">
                    <AlertTriangle size={18} className="text-tertiary shrink-0 mt-0.5" />
                    <p className="body-sm text-on-surface">
                        <span className="font-bold">⚠ Missing rates for:</span> {stats?.missingRates.join(', ')}. Aggregation treats these as 0.
                    </p>
                </div>
            )}
        </div>
    );
};

const InventoryPanel: React.FC<PanelProps> = ({ dateRange }) => {
    const { data: inventory, isLoading } = useQuery({ queryKey: ['executive-inventory'], queryFn: () => inventoryService.getAll() });
    const stats = useMemo(() => inventory ? deriveInventoryStats(inventory) : null, [inventory]);

    if (isLoading) return <Skeleton className="h-[250px] w-full rounded-3xl" />;

    return (
        <div className="card-default p-8 space-y-6">
            <h3 className="headline-sm font-bold flex items-center gap-3">
                <Package size={20} className="text-secondary" />
                Inventory Snapshot
            </h3>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1">
                    <p className="label-sm text-on-surface-variant uppercase font-bold">Stock Valuation</p>
                    <p className="headline-md font-bold">KES {stats?.totalValue.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                    <p className="label-sm text-on-surface-variant uppercase font-bold">Stock-out Risk</p>
                    <p className={`headline-md font-bold ${stats?.alertCount! > 0 ? 'text-error' : 'text-secondary'}`}>
                        {stats?.alertCount} Items
                    </p>
                </div>
                <div className="space-y-1">
                    <p className="label-sm text-on-surface-variant uppercase font-bold">Avg Supply</p>
                    <p className="headline-md font-bold">{stats?.avgDays} Days</p>
                </div>
            </div>
        </div>
    );
};

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function ExecutiveAnalyticsPage() {
    const [dateRange, setDateRange] = useState<DateRange>({
        start: subDays(new Date(), 7),
        end: new Date()
    });

    const queryClient = useQueryClient();

    const handleExport = () => {
        // Collect current data for export
        const payments = queryClient.getQueryData(['executive-revenue', dateRange]) as any[] || [];
        const orders = queryClient.getQueryData(['executive-orders', dateRange]) as any[] || [];
        const shifts = queryClient.getQueryData(['executive-shifts', dateRange]) as any[] || [];
        const users = queryClient.getQueryData(['executive-users']) as any[] || [];
        const inventory = queryClient.getQueryData(['executive-inventory']) as any[] || [];

        const revData = deriveRevenue(payments, dateRange);
        const occData = deriveOccupancy(orders, [], dateRange);
        const menuData = deriveMenuPerformance(orders, dateRange);
        const laborData = deriveLaborCost(shifts, users, dateRange);

        downloadCSV(`Executive_Analytics_${format(new Date(), 'yyyy-MM-dd')}.csv`, [
            { header: 'Revenue Overview', rows: [{ total: revData.totalRevenue, start: format(dateRange.start, 'yyyy-MM-dd'), end: format(dateRange.end, 'yyyy-MM-dd') }] },
            { header: 'Menu - top Revenue', rows: menuData.topRevenue },
            { header: 'Labor Cost', rows: [{ total: laborData.totalCost, missing: laborData.missingRates.join('|') }] }
        ]);
    };

    const handleRetryAll = () => {
        queryClient.invalidateQueries({ queryKey: ['executive'] });
    };

    return (
        <div className="p-6 tablet:p-10 space-y-10 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-2">
                    <h1 className="display-lg text-theme-gradient flex items-center gap-4">
                        <LayoutPanelLeft size={40} className="text-secondary" />
                        Executive Insights
                    </h1>
                    <p className="body-lg text-on-surface-variant">Multidimensional performance audit and aggregation.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-surface-container-low p-2 rounded-2xl border border-outline-variant/30">
                        <Calendar size={18} className="text-on-surface-variant ml-2" />
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-sm font-bold text-on-surface focus:ring-0 p-1"
                            value={format(dateRange.start, 'yyyy-MM-dd')}
                            onChange={e => setDateRange({...dateRange, start: new Date(e.target.value)})}
                        />
                        <span className="text-on-surface-variant text-xs font-bold">—</span>
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-sm font-bold text-on-surface focus:ring-0 p-1"
                            value={format(dateRange.end, 'yyyy-MM-dd')}
                            onChange={e => setDateRange({...dateRange, end: new Date(e.target.value)})}
                        />
                    </div>
                    <button onClick={handleExport} className="btn-primary flex items-center gap-3 h-[56px] px-8 shadow-xl shadow-secondary/20">
                        <Download size={20} />
                        Export Global Report
                    </button>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="lg:col-span-2">
                    <PanelErrorBoundary title="Revenue" onRetry={() => queryClient.invalidateQueries({queryKey: ['executive-revenue']})}>
                         <RevenuePanel dateRange={dateRange} />
                    </PanelErrorBoundary>
                </div>
                
                <PanelErrorBoundary title="Occupancy" onRetry={() => queryClient.invalidateQueries({queryKey: ['executive-orders']})}>
                    <OccupancyPanel dateRange={dateRange} />
                </PanelErrorBoundary>

                <PanelErrorBoundary title="Labor" onRetry={() => queryClient.invalidateQueries({queryKey: ['executive-shifts']})}>
                    <LaborPanel dateRange={dateRange} />
                </PanelErrorBoundary>

                <div className="lg:col-span-2">
                    <PanelErrorBoundary title="Menu" onRetry={() => queryClient.invalidateQueries({queryKey: ['executive-orders-menu']})}>
                        <MenuPanel dateRange={dateRange} />
                    </PanelErrorBoundary>
                </div>

                <div className="lg:col-span-2">
                    <PanelErrorBoundary title="Inventory" onRetry={() => queryClient.invalidateQueries({queryKey: ['executive-inventory']})}>
                        <InventoryPanel dateRange={dateRange} />
                    </PanelErrorBoundary>
                </div>
            </div>
            
            {/* Footer Insight */}
            <div className="flex justify-center pt-8">
                <button onClick={() => toast('Granular audit dashboard coming soon', { icon: '📊' })} className="text-on-surface-variant label-sm font-bold flex items-center gap-2 hover:text-secondary transition-all group">
                    ACCESS GRANULAR TRANSACTION AUDIT
                    <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                </button>
            </div>
        </div>
    );
}
