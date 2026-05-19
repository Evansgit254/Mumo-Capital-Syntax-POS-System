import React, { useState, useMemo } from 'react';
import type { OrderItem } from '@mumo/types';
import { useQuery } from '@tanstack/react-query';
import { 
    Calendar, 
    Download, 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Users, 
    Package, 
    ArrowUpRight, 
    ArrowDownRight,
    ChevronDown,
    Filter,
    BarChart3,
    PieChart,
    Activity
} from 'lucide-react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    AreaChart, 
    Area,
    Cell,
    PieChart as RePieChart,
    Pie
} from 'recharts';
import { orderService, paymentService, getErrorMessage } from '../api/service';
import { downloadCSV } from '../lib/exportCsv';
import Skeleton from '../components/ui/Skeleton';
import toast from 'react-hot-toast';
import { tenantService } from '../api/service';
import { formatCurrency } from '../lib/formatCurrency';
import { formatDate } from '../lib/formatDate';

// Chart theme constants — extracted from inline hex values for maintainability
const CHART_THEME = {
    primary: '#008B8B',
    accent: '#00BFBF',
    text: '#9CA3AF',
    tooltipBg: '#282a2b',
    tooltipText: '#e2e2e2',
    grid: '#555',
} as const;

const ReportsPage: React.FC = () => {
    const [timeframe, setTimeframe] = useState('7d');

    const { data: paymentsResponse, isLoading: paymentsLoading } = useQuery({
        queryKey: ['payments'],
        queryFn: () => paymentService.getAll(),
    });

    const { data: ordersResponse, isLoading: ordersLoading } = useQuery({
        queryKey: ['orders'],
        queryFn: () => orderService.getAll(),
    });

    const settingsQuery = useQuery({
        queryKey: ['tenant-settings'],
        queryFn: () => tenantService.getSettings(),
    });

    const payments = paymentsResponse?.data;
    const orders = ordersResponse?.data;

    const stats = useMemo(() => {
        if (!payments || !orders) return { 
            revenue: 0, orders: 0, avgCheck: 0, guests: 0,
            revenueTrend: '0%', ordersTrend: '0%', avgCheckTrend: '0%', guestTrend: '0%', guestCount: 0
        };
        
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(today.getDate() - 14);

        const currentPayments = payments.filter(p => new Date(p.createdAt) >= weekAgo);
        const currentOrders = orders.filter(o => new Date(o.createdAt) >= weekAgo);
        const currentRevenue = currentPayments.reduce((sum, p) => sum + p.amount, 0);

        const prevPayments = payments.filter(p => {
            const d = new Date(p.createdAt);
            return d >= twoWeeksAgo && d < weekAgo;
        });
        const prevOrders = orders.filter(o => {
            const d = new Date(o.createdAt);
            return d >= twoWeeksAgo && d < weekAgo;
        });
        const prevRevenue = prevPayments.reduce((sum, p) => sum + p.amount, 0);

        const calcTrend = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? '+100%' : '0.0%';
            const diff = ((curr - prev) / prev) * 100;
            return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
        };

        return {
            revenue: currentRevenue,
            orders: currentOrders.length,
            avgCheck: currentOrders.length > 0 ? currentRevenue / currentOrders.length : 0,
            revenueTrend: calcTrend(currentRevenue, prevRevenue),
            ordersTrend: calcTrend(currentOrders.length, prevOrders.length),
            avgCheckTrend: calcTrend(currentOrders.length > 0 ? currentRevenue / currentOrders.length : 0, prevOrders.length > 0 ? prevRevenue / prevOrders.length : 0),
            guestCount: currentOrders.length, // Proxy for guests
            guestTrend: calcTrend(currentOrders.length, prevOrders.length)
        };
    }, [payments, orders]);

    const trendData = useMemo(() => {
        if (!payments) return [];
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        
        return payments
            .filter(p => new Date(p.createdAt) >= weekAgo)
            .reduce((acc, p) => {
                const day = new Date(p.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
                const existing = acc.find(d => d.name === day);
                if (existing) existing.revenue += p.amount;
                else acc.push({ name: day, revenue: p.amount });
                return acc;
            }, [] as { name: string; revenue: number }[]);
    }, [payments]);

    const categoryData = useMemo(() => {
        if (!orders) return [];
        const counts: Record<string, number> = {};
        let totalItems = 0;
        
        orders.forEach(o => {
            if (!o.items) return;
            o.items.forEach((item: OrderItem & { menuItem?: { categoryId?: string } }) => {
                const cat = item.menuItem?.categoryId || 'Uncategorized';
                counts[cat] = (counts[cat] || 0) + item.quantity;
                totalItems += item.quantity;
            });
        });

        if (totalItems === 0) return [];

        const colors = ['var(--color-secondary)', 'var(--color-tertiary)', 'var(--color-error)', 'var(--color-primary)'];
        return Object.entries(counts).map(([name, count], i) => ({
            name,
            value: Math.round((count / totalItems) * 100),
            color: colors[i % colors.length]
        }));
    }, [orders]);

    const handleExport = () => {
        if (!payments && !orders) {
            toast.error('No data available to export');
            return;
        }

        const date = new Date().toISOString().split('T')[0];

        const sections = [
            {
                header: 'Revenue Trends',
                rows: trendData.map(d => ({ Day: d.name, 'Revenue (KES)': d.revenue })),
            },
            {
                header: 'Category Breakdown',
                rows: categoryData.map(c => ({ Category: c.name, 'Share (%)': c.value })),
            },
            {
                header: 'Recent Payments',
                rows: (payments || []).map((p: LooseValue) => ({
                    'Order ID': p.orderId,
                    'Amount (KES)': p.amount,
                    Method: p.method,
                    Status: p.status || 'SETTLED',
                    Date: new Date(p.createdAt).toLocaleString(),
                })),
            },
        ];

        downloadCSV(`mumo-reports-${date}.csv`, sections);
        toast.success('Report exported successfully');
    };

    if (paymentsLoading || ordersLoading) {
        return <div className="p-10 space-y-10"><Skeleton className="h-20 w-64" /><Skeleton className="h-[600px] w-full rounded-3xl" /></div>;
    }

    return (
        <div className="p-6 tablet:p-10 space-y-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="display-lg text-on-surface text-premium-gradient">Executive Analytics</h1>
                    <p className="body-lg text-on-surface-variant">Real-time performance metrics and business insights.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="dropdown relative group">
                         <button className="btn-secondary flex items-center gap-2 bg-surface-container-low border-outline-variant">
                            <Calendar size={18} />
                            Last 7 Days
                            <ChevronDown size={16} />
                        </button>
                    </div>
                    <button onClick={handleExport} className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20">
                        <Download size={18} />
                        Export
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Revenue', value: formatCurrency(stats.revenue, settingsQuery.data?.currency), trend: stats.revenueTrend, icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Total Orders', value: stats.orders, trend: stats.ordersTrend, icon: BarChart3, color: 'text-secondary', bg: 'bg-secondary/10' },
                    { label: 'Avg. Check', value: formatCurrency(Math.round(stats.avgCheck), settingsQuery.data?.currency), trend: stats.avgCheckTrend, icon: Activity, color: 'text-tertiary', bg: 'bg-tertiary/10' },
                    { label: 'Guest Growth', value: `+${stats.guestCount}`, trend: stats.guestTrend, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
                ].map((stat, i) => (
                    <div key={i} className="card-default p-6 space-y-4 hover:border-primary/30 transition-all duration-300">
                        <div className="flex justify-between items-start">
                            <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                            <div className={`flex items-center gap-1 text-xs font-bold ${stat.trend.startsWith('+') ? 'text-primary' : 'text-tertiary'}`}>
                                {stat.trend.startsWith('+') ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {stat.trend}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="label-sm text-on-hint font-bold uppercase tracking-widest">{stat.label}</p>
                            <div className="display-sm">{stat.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Revenue Trend */}
                <div className="lg:col-span-2 card-default overflow-hidden flex flex-col h-[500px]">
                    <div className="p-8 border-b border-outline-variant flex justify-between items-center">
                        <h3 className="headline-sm font-bold flex items-center gap-3">
                            Revenue Trends
                            <span className="label-sm bg-primary/10 text-primary px-3 py-1 rounded-full">LIVE</span>
                        </h3>
                        <div className="flex gap-2">
                             {[{ label: 'Week', key: '7d' }, { label: 'Month', key: '30d' }, { label: 'Year', key: '365d' }].map(t => (
                                 <button key={t.key} onClick={() => setTimeframe(t.key)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${timeframe === t.key ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-high text-on-surface-variant'}`}>{t.label}</button>
                             ))}
                        </div>
                    </div>
                    <div className="flex-1 p-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_THEME.primary} stopOpacity={0.4}/>
                                        <stop offset="50%" stopColor={CHART_THEME.primary} stopOpacity={0.15}/>
                                        <stop offset="95%" stopColor={CHART_THEME.primary} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME.grid} opacity={0.6} />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: CHART_THEME.text, fontSize: 13, fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: CHART_THEME.text, fontSize: 13, fontWeight: 600 }}
                                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}K` : `${val}`}
                                    width={60}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: CHART_THEME.tooltipBg, 
                                        border: `1px solid ${CHART_THEME.grid}`,
                                        borderRadius: '16px',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                        color: CHART_THEME.tooltipText
                                    }}
                                    itemStyle={{ color: CHART_THEME.accent, fontWeight: 700 }}
                                    labelStyle={{ color: CHART_THEME.text, fontWeight: 600, marginBottom: 4 }}
                                    formatter={(value) => [formatCurrency(Number(value), settingsQuery.data?.currency), 'Revenue']}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="revenue" 
                                    stroke={CHART_THEME.accent} 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorRev)" 
                                    animationDuration={2000}
                                    dot={{ r: 5, fill: CHART_THEME.primary, stroke: CHART_THEME.accent, strokeWidth: 2 }}
                                    activeDot={{ r: 7, fill: CHART_THEME.accent, stroke: '#fff', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="card-default overflow-hidden flex flex-col h-[500px]">
                    <div className="p-8 border-b border-outline-variant">
                        <h3 className="headline-sm font-bold flex items-center gap-3">
                            <PieChart size={20} className="text-secondary" />
                            By Category
                        </h3>
                    </div>
                    <div className="flex-1 p-6 flex flex-col">
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="55%"
                                        innerRadius={65}
                                        outerRadius={95}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        animationBegin={0}
                                        animationDuration={1500}
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-4 px-4 pb-4">
                            {categoryData.map((cat, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                        <span className="body-md text-on-surface font-semibold">{cat.name}</span>
                                    </div>
                                    <span className="body-md font-bold text-on-surface-variant">{cat.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row - Activity Log */}
            <div className="card-default p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="headline-sm font-bold">Recent Financial Activity</h3>
                    <button onClick={() => toast('Full transaction ledger coming soon', { icon: '📊' })} className="text-primary label-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                        VIEW ALL TRANSACTIONS
                        <ArrowRight size={16} />
                    </button>
                </div>
                <div className="divide-y divide-outline-variant">
                    {payments?.slice(0, 5).map((payment: LooseValue, i: number) => (
                        <div key={i} className="py-5 flex items-center justify-between group cursor-pointer hover:px-2 transition-all">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-surface-container-high rounded-2xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <div className="body-lg font-bold text-on-surface">Payment for Order #{payment.orderId.slice(-4).toUpperCase()}</div>
                                    <div className="label-sm text-on-hint uppercase tracking-wider">{payment.method} • {formatDate(payment.createdAt, settingsQuery.data?.timezone, 'HH:mm')}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="body-lg font-bold text-primary">+{formatCurrency(payment.amount, settingsQuery.data?.currency)}</div>
                                <div className="label-sm text-on-hint uppercase tracking-tighter">Settled</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ArrowRight: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
);

export default ReportsPage;
