import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Search, 
    Plus, 
    AlertTriangle, 
    TrendingDown, 
    TrendingUp, 
    History,
    MoreVertical,
    FileDown,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Package
} from 'lucide-react';
import { inventoryService, getErrorMessage } from '../../api/service';
import { useStore } from '../../store/useStore';
import Skeleton from '../../components/ui/Skeleton';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const InventoryPage: React.FC = () => {
    const queryClient = useQueryClient();
    const { session } = useStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAlerts, setFilterAlerts] = useState(false);
    const [activeTab, setActiveTab] = useState<'stock' | 'audit'>('stock');

    const { data: items, isLoading: itemsLoading } = useQuery({
        queryKey: ['inventory', filterAlerts],
        queryFn: filterAlerts ? inventoryService.getAlerts : inventoryService.getAll,
    });

    const { data: auditData, isLoading: auditLoading } = useQuery({
        queryKey: ['inventory-audit'],
        queryFn: () => inventoryService.getAuditLog(),
        enabled: activeTab === 'audit',
    });

    const isLoading = activeTab === 'stock' ? itemsLoading : auditLoading;

    const filteredItems = useMemo(() => {
        if (!items) return [];
        return items.filter(item => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [items, searchQuery]);

    const stats = useMemo(() => {
        if (!items) return { total: 0, alerts: 0, value: 0 };
        return {
            total: items.length,
            alerts: items.filter(i => i.currentStock < i.minStock).length,
            value: items.reduce((sum, i) => sum + (i.currentStock * (i.costPerUnit || 0)), 0),
        };
    }, [items]);

    if (isLoading) {
        return (
            <div className="p-6 tablet:p-10 space-y-10">
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-5 w-48" />
                    </div>
                    <Skeleton className="h-12 w-32 rounded-xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
                <Skeleton className="h-[600px] w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="p-6 tablet:p-10 space-y-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="display-lg text-on-surface">Inventory & Stock</h1>
                    <p className="body-lg text-on-surface-variant">Manage supplies and monitor stock levels across {session.tenantName}.</p>
                </div>
                <button className="btn-primary flex items-center gap-2 group self-start md:self-center">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                    New Item
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-default p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-primary/10 rounded-xl text-primary">
                            <Package size={24} />
                        </div>
                        <span className="label-sm text-on-surface-variant font-bold uppercase tracking-wider">Total SKUs</span>
                    </div>
                    <div className="space-y-1">
                        <div className="display-sm">{stats.total}</div>
                        <div className="flex items-center gap-1 text-on-surface-variant body-sm">
                           Across all categories
                        </div>
                    </div>
                </div>

                <div className={`card-default p-6 space-y-4 ${stats.alerts > 0 ? 'border-tertiary/20' : ''}`}>
                    <div className="flex items-center justify-between">
                        <div className={`p-3 rounded-xl ${stats.alerts > 0 ? 'bg-tertiary/10 text-tertiary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                            <AlertTriangle size={24} />
                        </div>
                        <span className="label-sm text-on-surface-variant font-bold uppercase tracking-wider">Stock Alerts</span>
                    </div>
                    <div className="space-y-1">
                        <div className={`display-sm ${stats.alerts > 0 ? 'text-tertiary' : ''}`}>{stats.alerts}</div>
                        <div className="flex items-center gap-1 text-on-surface-variant body-sm">
                            Items below minimum level
                        </div>
                    </div>
                </div>

                <div className="card-default p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-secondary/10 rounded-xl text-secondary">
                            <TrendingUp size={24} />
                        </div>
                        <span className="label-sm text-on-surface-variant font-bold uppercase tracking-wider">Total Value</span>
                    </div>
                    <div className="space-y-1">
                        <div className="display-sm">KES {stats.value.toLocaleString()}</div>
                        <div className="flex items-center gap-1 text-on-surface-variant body-sm">
                            Estimated stock valuation
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="card-default overflow-hidden flex flex-col">
                {/* Tabs */}
                <div className="flex border-b border-outline-variant px-6 bg-surface-container-low">
                    <button 
                        onClick={() => setActiveTab('stock')}
                        className={`px-6 py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${
                            activeTab === 'stock' ? 'border-primary border-b-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                        }`}
                    >
                        Stock levels
                    </button>
                    <button 
                        onClick={() => setActiveTab('audit')}
                        className={`px-6 py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${
                            activeTab === 'audit' ? 'border-primary border-b-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                        }`}
                    >
                        Audit log
                    </button>
                </div>

                {activeTab === 'stock' ? (
                    <>
                        {/* Actions Bar */}
                        <div className="p-6 border-b border-outline-variant flex flex-col md:flex-row gap-4 items-center justify-between bg-surface-container-low">
                            <div className="relative w-full md:w-96 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={18} />
                                <input 
                                    type="text"
                                    placeholder="Search by name or SKU..."
                                    className="input-field pl-12 bg-surface-container-lowest"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <button 
                                    onClick={() => setFilterAlerts(!filterAlerts)}
                                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 border ${
                                        filterAlerts 
                                        ? 'bg-tertiary/10 border-tertiary text-tertiary shadow-lg shadow-tertiary/5' 
                                        : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-outline'
                                    }`}
                                >
                                    <AlertTriangle size={16} />
                                    Alerts Only
                                </button>
                                <button className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:border-outline transition-colors">
                                    <Filter size={18} />
                                </button>
                                <button className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:border-outline transition-colors">
                                    <FileDown size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Grid Header */}
                        <div className="hidden md:grid grid-cols-6 gap-6 px-8 py-4 bg-surface-container-low border-b border-outline-variant text-on-surface-variant label-sm uppercase tracking-widest font-bold">
                            <div className="col-span-2">Item Details</div>
                            <div className="text-center">Current Stock</div>
                            <div className="text-center">Min level</div>
                            <div className="text-center">Unit Price</div>
                            <div className="text-right">Actions</div>
                        </div>

                        {/* Items List */}
                        <div className="divide-y divide-outline-variant bg-surface-container-lowest">
                            {filteredItems.length > 0 ? (
                                filteredItems.map((item) => (
                                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6 px-6 md:px-8 py-6 items-center hover:bg-surface-container-low/50 transition-colors group">
                                        <div className="col-span-2 flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold bg-surface-container-high border border-outline-variant group-hover:border-primary/30 group-hover:bg-primary/5 transition-all text-on-surface`}>
                                                {item.name.charAt(0)}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="body-lg font-semibold text-on-surface">{item.name}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className="label-sm px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant uppercase tracking-wider">{item.sku || 'NO-SKU'}</span>
                                                    <span className="text-on-surface-variant text-xs">•</span>
                                                    <span className="text-on-surface-variant text-xs">{item.unit}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-center">
                                            <div className="space-y-1">
                                                <div className={`body-lg font-bold ${item.currentStock < item.minStock ? 'text-tertiary' : 'text-primary'}`}>
                                                    {item.currentStock} {item.unit}
                                                </div>
                                                {item.currentStock < item.minStock && (
                                                    <div className="flex items-center justify-center gap-1 text-tertiary text-[10px] font-bold uppercase tracking-tighter">
                                                        <TrendingDown size={10} /> Low Stock
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-center">
                                            <div className="body-md text-on-surface-variant font-medium">
                                                {item.minStock} {item.unit}
                                            </div>
                                        </div>

                                        <div className="text-center">
                                            <div className="body-md text-on-surface-variant font-medium">
                                                KES {item.costPerUnit}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2">
                                            <button className="p-2 rounded-lg hover:bg-primary/10 hover:text-primary text-on-surface-variant transition-colors">
                                                <History size={18} />
                                            </button>
                                            <button className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
                                                <MoreVertical size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-32 text-on-surface-variant/40">
                                    <div className="p-6 bg-surface-container-high rounded-full mb-6 italic border border-outline-variant opacity-10">
                                        <Package size={64} strokeWidth={1} />
                                    </div>
                                    <h3 className="headline-sm text-on-surface-variant/60 font-bold mb-2">No items found</h3>
                                    <p className="body-md text-on-surface-variant max-w-xs text-center">We couldn't find any inventory items matching your current filters.</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="divide-y divide-outline-variant bg-surface-container-lowest">
                        {/* Audit Log Header */}
                        <div className="hidden md:grid grid-cols-6 gap-6 px-8 py-4 bg-surface-container-low border-b border-outline-variant text-on-surface-variant label-sm uppercase tracking-widest font-bold">
                            <div className="col-span-2">Event & Item</div>
                            <div className="text-center">Adjustment</div>
                            <div className="text-center">Type</div>
                            <div className="text-center">Reason</div>
                            <div className="text-right">Date/Time</div>
                        </div>
                        {auditData?.logs?.length > 0 ? (
                            auditData.logs.map((log: any) => {
                                const diff = log.newQty - log.previousQty;
                                const isPositive = diff > 0;
                                return (
                                    <div key={log.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6 px-8 py-6 items-center hover:bg-surface-container-low/30 transition-colors">
                                        <div className="col-span-2 flex items-center gap-4">
                                             <div className={`p-2 rounded-lg ${isPositive ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
                                                 {isPositive ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                                             </div>
                                             <div>
                                                 <div className="body-md font-bold text-on-surface">Item #{log.inventoryItemId.substring(0, 8)}</div>
                                                 <div className="label-sm text-on-surface-variant uppercase">By User #{log.userId.substring(0, 8)}</div>
                                             </div>
                                        </div>
                                        <div className="text-center">
                                            <div className={`body-md font-bold ${isPositive ? 'text-secondary' : 'text-error'}`}>
                                                {isPositive ? '+' : ''}{diff} units
                                            </div>
                                            <div className="label-sm text-on-surface-variant">{log.previousQty} → {log.newQty}</div>
                                        </div>
                                        <div className="text-center">
                                            <span className="label-sm px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase tracking-wider">
                                                {log.adjustmentType}
                                            </span>
                                        </div>
                                        <div className="text-center">
                                            <div className="body-sm text-on-surface-variant italic">
                                                "{log.reason || 'No reason provided'}"
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="body-sm font-medium text-on-surface">
                                                {format(new Date(log.createdAt), 'MMM dd, HH:mm')}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-20 text-center text-on-surface-variant">No audit logs found.</div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Insight */}
            <div className="card-default p-6 bg-gradient-to-r from-primary/5 to-transparent border-l-4 border-l-primary flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <TrendingDown size={24} />
                    </div>
                    <div>
                        <h4 className="body-lg font-bold text-on-surface">Predictive Alert: Tomato Stock</h4>
                        <p className="body-md text-on-surface-variant">Based on last week's consumption, you will run out of Tomatoes by Thursday.</p>
                    </div>
                </div>
                <button className="btn-secondary whitespace-nowrap bg-surface-container-lowest">
                    Order Refill
                </button>
            </div>
        </div>
    );
};

export default InventoryPage;
