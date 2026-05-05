import { useQuery } from '@tanstack/react-query';
import { orderService, paymentService } from '../api/service';
import { 
    TrendingUp, 
    ShoppingBag, 
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Download,
    PieChart,
    Search,
    ChevronUp,
    ChevronDown,
    Filter,
    Clock,
    User as UserIcon,
    ShoppingCart
} from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { useState, useMemo } from 'react';
import { cn } from '../lib/utils';
import { Order, OrderStatus } from '@mumo/types';

type SortConfig = { key: keyof Order | 'staff' | 'tableNum'; direction: 'asc' | 'desc' } | null;

export default function ReportsPage() {
    const [range, setRange] = useState<'today' | 'week' | 'month'>('today');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const ordersQuery = useQuery({
        queryKey: ['orders'],
        queryFn: orderService.getAll,
    });

    const paymentsQuery = useQuery({
        queryKey: ['payments'],
        queryFn: paymentService.getAll,
    });

    const isLoading = ordersQuery.isLoading || paymentsQuery.isLoading;

    // Filter by Date Range
    const rangeFilteredData = useMemo(() => {
        const items = ordersQuery.data || [];
        const now = new Date();
        return items.filter(item => {
            const date = new Date(item.createdAt);
            if (range === 'today') return date.toDateString() === now.toDateString();
            if (range === 'week') {
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return date >= oneWeekAgo;
            }
            if (range === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            return true;
        });
    }, [ordersQuery.data, range]);

    // Derived Financial Stats from range filtered data
    const stats = useMemo(() => {
        const totalRevenue = rangeFilteredData.reduce((sum, o) => sum + o.totalAmount, 0);
        const orderCount = rangeFilteredData.length;
        const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
        return { totalRevenue, orderCount, avgOrderValue };
    }, [rangeFilteredData]);

    // Ledger Data Processing (Search + Filter + Sort)
    const ledgerData = useMemo(() => {
        let data = [...rangeFilteredData];

        // Search locally
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            data = data.filter(o => 
                o.id.toLowerCase().includes(query) || 
                (o as any).user?.firstName?.toLowerCase().includes(query) ||
                (o as any).user?.lastName?.toLowerCase().includes(query)
            );
        }

        // Sort locally
        if (sortConfig) {
            data.sort((a, b) => {
                let valA: any = a[sortConfig.key as keyof Order];
                let valB: any = b[sortConfig.key as keyof Order];

                if (sortConfig.key === 'staff') {
                    valA = `${(a as any).user?.firstName} ${(a as any).user?.lastName}`;
                    valB = `${(b as any).user?.firstName} ${(b as any).user?.lastName}`;
                } else if (sortConfig.key === 'tableNum') {
                    valA = (a as any).table?.number || '';
                    valB = (b as any).table?.number || '';
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return data;
    }, [rangeFilteredData, searchQuery, sortConfig]);

    // Pagination
    const paginatedLedger = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return ledgerData.slice(start, start + itemsPerPage);
    }, [ledgerData, currentPage]);

    const totalPages = Math.ceil(ledgerData.length / itemsPerPage);

    const handleSort = (key: any) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const downloadCSV = () => {
        if (ledgerData.length === 0) return;
        
        const headers = ['Order ID', 'Date', 'Table', 'Staff', 'Items', 'Amount', 'Payment Method', 'Status'];
        const rows = ledgerData.map(o => [
            o.id.slice(-8).toUpperCase(),
            new Date(o.createdAt).toLocaleString(),
            (o as any).table?.number || 'Takeaway',
            `${(o as any).user?.firstName} ${(o as any).user?.lastName}`,
            (o as any).items?.length || 0,
            o.totalAmount,
            (o as any).payments?.[0]?.method || 'N/A',
            o.status
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `mumo_pos_ledger_${range}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-8 tablet:p-10 space-y-10 min-h-full">
            {/* Header */}
            <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-6">
                <div>
                    <h1 className="display-lg text-on-surface">Reports & Analytics</h1>
                    <p className="body-lg text-on-surface-variant">Performance metrics and financial breakdown for <span className="text-secondary font-bold">{range}</span>.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-surface-container rounded-xl p-1 border border-outline-variant">
                        {(['today', 'week', 'month'] as const).map(r => (
                            <button 
                                key={r}
                                onClick={() => { setRange(r); setCurrentPage(1); }}
                                className={cn(
                                    "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                                    range === r ? "bg-secondary text-white shadow-lg" : "text-on-surface-variant hover:text-on-surface"
                                )}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {isLoading ? (
                    Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
                ) : (
                    <>
                        <ReportStatCard 
                            title="Total Revenue" 
                            value={`${stats.totalRevenue.toLocaleString()} KES`} 
                            icon={TrendingUp} 
                            trend={{ val: "+8.4%", positive: true }} 
                        />
                        <ReportStatCard 
                            title="Total Orders" 
                            value={stats.orderCount.toString()} 
                            icon={ShoppingBag} 
                            trend={{ val: "+2.1%", positive: true }} 
                        />
                        <ReportStatCard 
                            title="Avg. Ticket" 
                            value={`${Math.round(stats.avgOrderValue).toLocaleString()} KES`} 
                            icon={PieChart} 
                            trend={{ val: "-1.2%", positive: false }} 
                        />
                    </>
                )}
            </div>

            {/* Ledger Section */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <h2 className="headline-md">Transaction Ledger</h2>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                            <input 
                                type="text"
                                placeholder="Search by ID or staff..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="input-field !pl-11"
                            />
                        </div>
                        <button 
                            onClick={downloadCSV}
                            disabled={ledgerData.length === 0}
                            className="h-10 px-4 btn-primary !rounded-xl !bg-surface-container-highest !text-on-surface hover:!bg-white/10 border border-outline-variant disabled:opacity-50"
                        >
                            <Download size={18} />
                            <span className="hidden md:inline">Export CSV</span>
                        </button>
                    </div>
                </div>

                <div className="card-default p-0 overflow-hidden border border-outline-variant/30">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-surface-container border-b border-outline-variant">
                                    <SortHeader label="Order ID" sortKey="id" currentSort={sortConfig} onSort={handleSort} />
                                    <SortHeader label="Table" sortKey="tableNum" currentSort={sortConfig} onSort={handleSort} />
                                    <SortHeader label="Waitron" sortKey="staff" currentSort={sortConfig} onSort={handleSort} />
                                    <SortHeader label="Total" sortKey="totalAmount" currentSort={sortConfig} onSort={handleSort} textAlign="right" />
                                    <th className="px-6 py-4 label-sm text-on-surface-variant">Method</th>
                                    <SortHeader label="Time" sortKey="createdAt" currentSort={sortConfig} onSort={handleSort} />
                                    <th className="px-6 py-4 label-sm text-on-surface-variant text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/20">
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={7}><Skeleton className="h-16 w-full" /></td></tr>)
                                ) : paginatedLedger.length === 0 ? (
                                    <tr>
                                        <td colSpan={7}>
                                            <EmptyState 
                                                icon={<ShoppingCart size={32} />}
                                                title={searchQuery ? "No matching orders" : "No transactions found"}
                                                description={searchQuery ? `We couldn't find any orders matching "${searchQuery}"` : `There are no transactions recorded for ${range}.`}
                                                className="py-16"
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedLedger.map((order: Order) => (
                                        <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-4 font-mono text-xs font-black text-secondary tracking-widest">
                                                #{order.id.slice(-8).toUpperCase()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-secondary/40" />
                                                    <span className="body-sm font-bold text-on-surface">{(order as any).table?.number || 'T-AWAY'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 body-sm text-on-surface/80">
                                                {(order as any).user ? `${(order as any).user.firstName} ${(order as any).user.lastName}` : 'Guest'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="body-md font-black text-on-surface">{order.totalAmount.toLocaleString()}</span>
                                                <span className="text-[10px] ml-1 opacity-40 font-bold">KES</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-on-surface-variant">
                                                    <span className="text-[10px] font-bold uppercase border border-outline-variant px-1.5 rounded">
                                                        {(order as any).payments?.[0]?.method || 'CASH'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-on-surface">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span className="text-[10px] opacity-60 uppercase">{new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={cn(
                                                    "pill-status",
                                                    order.status === OrderStatus.SERVED && "bg-secondary/10 text-secondary border border-secondary/20",
                                                    order.status === OrderStatus.READY && "bg-secondary/10 text-secondary border border-secondary/20",
                                                    order.status === OrderStatus.CANCELLED && "bg-red-500/10 text-red-500 border border-red-500/20",
                                                    "text-[10px]"
                                                )}>
                                                    {order.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="p-4 px-6 bg-surface-container-low border-t border-outline-variant flex items-center justify-between">
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                            Showing {Math.min(ledgerData.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(ledgerData.length, currentPage * itemsPerPage)} of {ledgerData.length}
                        </p>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-8 w-8 rounded-lg flex items-center justify-center border border-outline-variant hover:bg-white/5 disabled:opacity-20"
                            >
                                <ChevronUp className="-rotate-90" size={16} />
                            </button>
                            <span className="body-sm font-black mx-2">{currentPage} / {totalPages || 1}</span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="h-8 w-8 rounded-lg flex items-center justify-center border border-outline-variant hover:bg-white/5 disabled:opacity-20"
                            >
                                <ChevronDown className="-rotate-90" size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SortHeader({ label, sortKey, currentSort, onSort, textAlign = 'left' }: any) {
    const isActive = currentSort?.key === sortKey;
    return (
        <th 
            className={cn(
                "px-6 py-4 label-sm text-on-surface-variant cursor-pointer hover:bg-white/5 transition-colors",
                textAlign === 'right' && "text-right",
                textAlign === 'center' && "text-center"
            )}
            onClick={() => onSort(sortKey)}
        >
            <div className={cn("flex items-center gap-2", textAlign === 'right' && "justify-end", textAlign === 'center' && "justify-center")}>
                {label}
                <div className="flex flex-col">
                    <ChevronUp size={10} className={cn("transition-opacity", isActive && currentSort.direction === 'asc' ? "opacity-100" : "opacity-20")} />
                    <ChevronDown size={10} className={cn("transition-opacity", -2, isActive && currentSort.direction === 'desc' ? "opacity-100" : "opacity-20")} />
                </div>
            </div>
        </th>
    );
}

function ReportStatCard({ title, value, icon: Icon, trend }: any) {
    return (
        <div className="card-default flex items-center gap-6 group hover:border-secondary/30 transition-all border border-outline-variant/30">
            <div className="h-16 w-16 rounded-2xl bg-surface-container-highest flex items-center justify-center text-secondary group-hover:scale-110 transition-transform shadow-inner">
                <Icon size={32} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="label-sm text-on-surface-variant/60 lowercase italic tracking-tight">{title}</p>
                <div className="flex items-baseline gap-3 mt-1">
                    <h3 className="headline-md !text-[28px] font-black text-on-surface truncate tracking-tighter">{value}</h3>
                    <span className={cn(
                        "flex items-center text-[10px] font-black",
                        trend.positive ? "text-secondary" : "text-red-500"
                    )}>
                        {trend.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {trend.val}
                    </span>
                </div>
            </div>
        </div>
    );
}
