import React, { useState, useMemo } from 'react';
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
import Skeleton from '../components/ui/Skeleton';

// Mock data for trends (In production, this would come from a dedicated analytics endpoint)
const trendData = [
    { name: 'Mon', revenue: 42000, orders: 45 },
    { name: 'Tue', revenue: 38000, orders: 40 },
    { name: 'Wed', revenue: 55000, orders: 62 },
    { name: 'Thu', revenue: 48000, orders: 55 },
    { name: 'Fri', revenue: 72000, orders: 88 },
    { name: 'Sat', revenue: 85000, orders: 95 },
    { name: 'Sun', revenue: 65000, orders: 70 },
];

const categoryData = [
    { name: 'Food', value: 45, color: '#008B8B' },
    { name: 'Beverages', value: 30, color: '#FFBF00' },
    { name: 'Rooms', value: 15, color: '#6366F1' },
    { name: 'Services', value: 10, color: '#EC4899' },
];

const ReportsPage: React.FC = () => {
    const [timeframe, setTimeframe] = useState('7d');

    const { data: payments, isLoading: paymentsLoading } = useQuery({
        queryKey: ['payments'],
        queryFn: paymentService.getAll,
    });

    const { data: orders, isLoading: ordersLoading } = useQuery({
        queryKey: ['orders'],
        queryFn: orderService.getAll,
    });

    const stats = useMemo(() => {
        if (!payments || !orders) return { revenue: 0, orders: 0, avgCheck: 0 };
        const revenue = payments.reduce((sum, p) => sum + p.amount, 0);
        return {
            revenue,
            orders: orders.length,
            avgCheck: orders.length > 0 ? revenue / orders.length : 0,
        };
    }, [payments, orders]);

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
                    <button className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20">
                        <Download size={18} />
                        Export
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Revenue', value: `KES ${stats.revenue.toLocaleString()}`, trend: '+12.5%', icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Total Orders', value: stats.orders, trend: '+8.2%', icon: BarChart3, color: 'text-secondary', bg: 'bg-secondary/10' },
                    { label: 'Avg. Check', value: `KES ${Math.round(stats.avgCheck).toLocaleString()}`, trend: '-2.1%', icon: Activity, color: 'text-tertiary', bg: 'bg-tertiary/10' },
                    { label: 'Guest Growth', value: '+142', trend: '+18%', icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
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
                             {['Week', 'Month', 'Year'].map(t => (
                                 <button key={t} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${t === 'Week' ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-high text-on-surface-variant'}`}>{t}</button>
                             ))}
                        </div>
                    </div>
                    <div className="flex-1 p-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" opacity={0.5} />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'var(--on-hint)', fontSize: 12, fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'var(--on-hint)', fontSize: 12, fontWeight: 600 }}
                                    tickFormatter={(val) => `K${val/1000}k`}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'var(--surface-container-high)', 
                                        border: '1px solid var(--outline-variant)',
                                        borderRadius: '16px',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                                    }}
                                    itemStyle={{ color: 'var(--on-surface)', fontWeight: 700 }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="revenue" 
                                    stroke="var(--primary)" 
                                    strokeWidth={4}
                                    fillOpacity={1} 
                                    fill="url(#colorRev)" 
                                    animationDuration={2000}
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
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={5}
                                        dataKey="value"
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
                    <button className="text-primary label-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                        VIEW ALL TRANSACTIONS
                        <ArrowRight size={16} />
                    </button>
                </div>
                <div className="divide-y divide-outline-variant">
                    {payments?.slice(0, 5).map((payment: any, i: number) => (
                        <div key={i} className="py-5 flex items-center justify-between group cursor-pointer hover:px-2 transition-all">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-surface-container-high rounded-2xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <div className="body-lg font-bold text-on-surface">Payment for Order #{payment.orderId.slice(-4).toUpperCase()}</div>
                                    <div className="label-sm text-on-hint uppercase tracking-wider">{payment.method} • {new Date(payment.createdAt).toLocaleTimeString()}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="body-lg font-bold text-primary">+KES {payment.amount.toLocaleString()}</div>
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
