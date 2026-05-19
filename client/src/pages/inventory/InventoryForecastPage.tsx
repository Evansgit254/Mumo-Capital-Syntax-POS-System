import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    AlertTriangle, 
    TrendingDown,
    CheckCircle2,
    Clock,
    ArrowUpRight,
} from 'lucide-react';
import { inventoryService, orderService } from '../../api/service';
import { useStore } from '../../store/useStore';
import Skeleton from '../../components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';

const InventoryForecastPage: React.FC = () => {
    const navigate = useNavigate();
    const { session } = useStore();
    
    // Fetch all orders — we filter to last 30 days client-side
    const { data: orders, isLoading: ordersLoading } = useQuery({
        queryKey: ['orders-30days'],
        queryFn: () => orderService.getAll(),
    });

    const { data: inventoryResponse, isLoading: itemsLoading } = useQuery({
        queryKey: ['inventory'],
        queryFn: () => inventoryService.getAll(),
    });

    const inventory = inventoryResponse?.data;
    const ordersData = orders?.data;

    const isLoading = ordersLoading || itemsLoading;

    const forecastingData = useMemo(() => {
        if (!inventory || !ordersData) return [];

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return inventory.map(item => {
            // Sum quantities consumed per item in last 30 days (order line items only)
            const itemUsage = ordersData
                .filter(order => new Date(order.createdAt) >= thirtyDaysAgo)
                .reduce((total, order) => {
                    const lineItem = order.items?.find((i: LooseValue) => i.menuItemId === item.id);
                    return total + (lineItem?.quantity || 0);
                }, 0);

            const avgDailyUsage = itemUsage / 30;
            const daysRemaining = avgDailyUsage > 0
                ? Math.floor(item.currentStock / avgDailyUsage)
                : Infinity;

            return {
                ...item,
                avgDailyUsage: avgDailyUsage.toFixed(2),
                daysRemaining,
                totalConsumed: itemUsage,
            };
        });
    }, [inventory, ordersData]);

    const criticalItems = forecastingData.filter(i => i.daysRemaining <= 3);

    if (isLoading) {
        return (
            <div className="p-6 tablet:p-10 space-y-10">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-[400px] w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="p-6 tablet:p-10 space-y-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="display-lg text-on-surface">Demand forecasting</h1>
                    <p className="body-lg text-on-surface-variant">30-day usage analysis and stock depletion projections.</p>
                </div>
            </div>

            {/* Health Summary */}
            {criticalItems.length === 0 ? (
                <div className="card-default p-8 flex flex-col items-center justify-center text-center space-y-4 border-secondary/20">
                    <div className="h-16 w-16 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                        <CheckCircle2 size={32} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="headline-md text-on-surface font-bold">Stock levels healthy</h3>
                        <p className="body-md text-on-surface-variant">All tracked items have sufficient supply for the next 7+ days.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="card-default p-6 border-l-4 border-l-error">
                         <div className="flex items-center gap-3 text-error mb-2">
                             <AlertTriangle size={20} />
                             <span className="label-sm font-bold">Critical Depletion</span>
                         </div>
                         <p className="body-md text-on-surface-variant">
                             {criticalItems.filter(i => i.daysRemaining <= 1).length} items will be out of stock within <span className="font-bold text-error">24 hours</span>.
                         </p>
                    </div>
                    <div className="card-default p-6 border-l-4 border-l-tertiary">
                         <div className="flex items-center gap-3 text-tertiary mb-2">
                             <Clock size={20} />
                             <span className="label-sm font-bold">Early Warning</span>
                         </div>
                         <p className="body-md text-on-surface-variant">
                             {criticalItems.filter(i => i.daysRemaining > 1 && i.daysRemaining <= 3).length} items reaching critical levels within <span className="font-bold text-tertiary">3 days</span>.
                         </p>
                    </div>
                </div>
            )}

            {/* Forecast Table */}
            <div className="card-default overflow-hidden p-0">
                <div className="p-6 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
                    <h2 className="headline-md font-bold text-on-surface">Inventory Projections</h2>
                    <span className="label-sm px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant">Last 30 Days</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-surface-container-low border-b border-outline-variant">
                            <tr className="text-on-surface-variant label-sm">
                                <th className="px-8 py-4">Item</th>
                                <th className="px-6 py-4 text-center">Avg Daily Usage</th>
                                <th className="px-6 py-4 text-center">Current Stock</th>
                                <th className="px-6 py-4 text-center">Days left</th>
                                <th className="px-8 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                            {forecastingData.map((item) => {
                                const isCritical = item.daysRemaining <= 1;
                                const isWarning = item.daysRemaining > 1 && item.daysRemaining <= 3;
                                const noUsage = item.daysRemaining === Infinity;
                                
                                return (
                                    <tr key={item.id} className="hover:bg-surface-container-low/30 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center font-bold text-on-surface border border-outline-variant">
                                                    {item.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="body-md font-bold text-on-surface">{item.name}</div>
                                                    <div className="label-sm text-on-surface-variant">{item.sku || 'No SKU'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            {noUsage ? (
                                                <span className="body-md text-on-surface-variant italic">No usage data</span>
                                            ) : (
                                                <div className="body-md font-medium text-on-surface">
                                                    {item.avgDailyUsage} <span className="label-sm text-on-surface-variant">{item.unit}/day</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className="body-md font-bold text-on-surface">
                                                {item.currentStock} {item.unit}
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`pill-status ${
                                                    isCritical ? 'bg-error-container text-on-error-container' : 
                                                    isWarning ? 'bg-tertiary/20 text-tertiary' : 
                                                    'bg-secondary/10 text-secondary'
                                                }`}>
                                                    {noUsage ? 'No usage' : `${item.daysRemaining} Days`}
                                                </span>
                                                {item.daysRemaining < 7 && !noUsage && (
                                                    <span className="label-sm text-on-surface-variant mt-1">Runs out soon</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button 
                                                onClick={() => navigate('/vendors', { state: { prefilledItem: item } })}
                                                className="btn-secondary py-2 px-4 h-auto flex items-center gap-2 float-right group"
                                            >
                                                Generate PO
                                                <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default InventoryForecastPage;
