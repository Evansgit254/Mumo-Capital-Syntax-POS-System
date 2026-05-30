import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { tableService, orderService, tenantService } from '../api/service';
import { formatCurrency } from '../lib/formatCurrency';
import { useStore } from '../store/useStore';
import { 
    Users, 
    Plus, 
    History, 
    ArrowLeft,
    CreditCard,
    MoveHorizontal,
    Combine,
    StickyNote,
    Trash2,
    CalendarCheck,
    ChevronRight,
    MessageSquare
} from 'lucide-react';
import { cn } from '../lib/utils';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import TableActionModal from '../components/tables/TableActionModal';
import { Table } from '@mumo/types';

export default function TableDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { cart } = useStore();
    const [actionType, setActionType] = useState<'merge' | 'transfer' | null>(null);

    // Fetch Table Info
    const tableQuery = useQuery({
        queryKey: ['table', id],
        queryFn: () => tableService.getOne(id!),
        enabled: !!id,
    });

    // Fetch Active Orders on this table
    const ordersQuery = useQuery({
        queryKey: ['table-orders', id],
        queryFn: () => tableService.getOrders(id!),
        enabled: !!id,
    });

    const settingsQuery = useQuery({
        queryKey: ['tenant-settings'],
        queryFn: tenantService.getSettings,
    });
    const currency = settingsQuery.data?.currency || 'KES';

    const handleAddOrder = () => {
        cart.setTableId(id!);
        navigate('/pos');
    };

    const handleCloseTable = () => {
        // DEEP-CRIT-009: Do NOT load items into cart (that creates duplicate orders).
        // Instead, pass existing order IDs to checkout for direct settlement.
        const orderIds = activeOrders.map(o => o.id);
        const totalAmount = activeOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

        navigate('/checkout', { 
            state: { 
                settleTableId: id, 
                orderIds,
                totalAmount,
            } 
        });
    };

    const transferMutation = useMutation({
        mutationFn: (targetTableId: string) => tableService.transfer(id!, targetTableId),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tables'] });
            queryClient.invalidateQueries({ queryKey: ['table', id] });
            setActionType(null);
            navigate(`/tables/${data.id}`);
        },
    });

    const mergeMutation = useMutation({
        mutationFn: (targetTableId: string) => tableService.merge(id!, targetTableId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tables'] });
            queryClient.invalidateQueries({ queryKey: ['table', id] });
            setActionType(null);
            navigate('/tables');
        },
    });

    if (tableQuery.isLoading) {
        return <div className="p-10"><Skeleton className="h-64 rounded-3xl" /></div>;
    }

    const table = tableQuery.data;
    const activeOrders = ordersQuery.data || [];

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Header */}
            <div className="p-6 tablet:p-10 pb-0 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/tables')}
                        className="h-12 w-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="headline-md text-on-surface">Table {table?.number}</h1>
                        <div className="flex items-center gap-2 text-on-surface-variant">
                            <Users size={14} />
                            <span className="label-sm !normal-case">{table?.capacity} Seats Max</span>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        <StatusPill active={table?.isOccupied || false} />
                    </div>
                </div>

                {/* Quick Actions Bar */}
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                    <ActionButton icon={<Combine size={18} />} label="Merge Tables" onClick={() => setActionType('merge')} />
                    <ActionButton icon={<MoveHorizontal size={18} />} label="Move Table" onClick={() => setActionType('transfer')} />
                    <ActionButton icon={<CalendarCheck size={18} />} label="Set Reservation" onClick={() => navigate('/reservations')} />
                </div>
            </div>

            {/* Orders Content */}
            <div className="flex-1 overflow-y-auto p-6 tablet:p-10 pt-4 space-y-8">
                {ordersQuery.isLoading ? (
                    <Skeleton className="h-96 rounded-3xl" />
                ) : activeOrders.length === 0 ? (
                    <EmptyState 
                        icon={<History size={32} />}
                        title="No active orders"
                        description="This table is currently available. Start a new session to begin service."
                        action={
                            <button onClick={handleAddOrder} className="btn-primary w-64">
                                <Plus size={20} />
                                START ORDER
                            </button>
                        }
                    />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* List of active orders as "Seat Blocks" or generic list as per designs */}
                        <div className="space-y-6">
                            <h2 className="label-sm text-on-surface-variant tracking-widest">CURRENT ITEMS</h2>
                            <div className="space-y-4">
                                {activeOrders.flatMap(o => o.items).map((item: LooseValue, idx) => (
                                    <div key={idx} className="card-default !p-4 flex items-center gap-4 hover:border-outline transition-colors group">
                                        <div className="h-10 w-10 rounded-lg bg-surface-container-highest flex items-center justify-center font-black text-secondary">
                                            {item.quantity}
                                        </div>
                                        <div className="flex-1">
                                            <p className="body-md font-bold text-on-surface">{item.menuItem?.name || 'Unknown Item'}</p>
                                            <p className="text-xs text-on-surface-variant">{formatCurrency(item.unitPrice, currency)}</p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="h-10 w-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface">
                                                <MessageSquare size={16} />
                                            </button>
                                            <button className="h-10 w-10 rounded-lg flex items-center justify-center text-error/60 hover:bg-error/10 hover:text-error">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Order Summary / Bill Preview */}
                        <div className="space-y-6">
                            <h2 className="label-sm text-on-surface-variant tracking-widest">ORDER SUMMARY</h2>
                            <div className="card-default space-y-4 bg-surface-container-low/30">
                                {activeOrders.map(order => (
                                    <div key={order.id} className="flex items-center justify-between py-2 border-b border-outline-variant/30 last:border-0 text-on-surface-variant body-md">
                                        <span>Order #{order.id.slice(0, 4)}</span>
                                        <span className="font-bold text-on-surface">{formatCurrency(order.totalAmount, currency)}</span>
                                    </div>
                                ))}
                                <div className="pt-6 flex flex-col gap-6">
                                    <div className="flex items-center justify-between">
                                        <span className="headline-md text-on-surface-variant">Running Total</span>
                                        <span className="headline-md text-secondary">
                                            {formatCurrency(activeOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0), currency)}
                                        </span>
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={handleAddOrder} className="btn-secondary flex-1">
                                            <Plus size={20} />
                                            ADD ORDER
                                        </button>
                                        <button onClick={handleCloseTable} className="btn-primary flex-1 bg-on-surface text-surface">
                                            <CreditCard size={20} />
                                            CHECKOUT
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {actionType && table && (
                <TableActionModal 
                    type={actionType}
                    sourceTable={table}
                    onClose={() => setActionType(null)}
                    onSubmit={(targetId) => {
                        if (actionType === 'transfer') transferMutation.mutate(targetId);
                        else mergeMutation.mutate(targetId);
                    }}
                    isPending={transferMutation.isPending || mergeMutation.isPending}
                />
            )}
        </div>
    );
}

function StatusPill({ active }: { active: boolean }) {
    return (
        <div className={cn(
            "pill-status h-10 px-6",
            active ? "bg-error/10 text-error border border-error/20" : "bg-secondary/10 text-secondary border border-secondary/20"
        )}>
            <div className={cn("h-2 w-2 rounded-full mr-2", active ? "bg-error" : "bg-secondary")} />
            <span className="font-bold">{active ? 'OCCUPIED' : 'AVAILABLE'}</span>
        </div>
    );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className="flex flex-col items-center justify-center gap-2 min-w-[120px] aspect-square rounded-2xl bg-surface-container border border-outline-variant hover:border-secondary transition-all hover:-translate-y-1"
        >
            <div className="h-10 w-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                {icon}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
        </button>
    );
}
