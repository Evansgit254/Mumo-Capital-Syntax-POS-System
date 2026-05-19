import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tableService } from '../api/service';
import { useStore } from '../store/useStore';
import { 
    Users, 
    ArrowRight,
    Map as MapIcon,
    Search,
    Filter,
    Table as TableIcon,
    AlertCircle
} from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';

export default function TableMapPage() {
    const navigate = useNavigate();
    const { cart } = useStore();
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
    
    const tablesQuery = useQuery({
        queryKey: ['tables'],
        queryFn: () => tableService.getAll(),
    });

    const handleTableSelect = (tableId: string) => {
        navigate(`/tables/${tableId}`);
    };

    return (
        <div className="p-8 tablet:p-10 space-y-8 bg-surface min-h-full">
            {/* Header */}
            <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl tablet:display-lg text-on-surface">Floor Plan</h1>
                    <p className="body-md tablet:body-lg text-on-surface-variant">Real-time table status and reservation overview.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-surface-container rounded-xl p-1 border border-outline-variant">
                        <button 
                            onClick={() => setViewMode('map')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                                viewMode === 'map' ? "bg-secondary text-white shadow-lg" : "text-on-surface-variant hover:text-on-surface"
                            )}
                        >
                            Map View
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                                viewMode === 'list' ? "bg-secondary text-white shadow-lg" : "text-on-surface-variant hover:text-on-surface"
                            )}
                        >
                            List View
                        </button>
                    </div>
                </div>
            </div>

            {/* Status Legend */}
            <div className="flex items-center flex-wrap gap-6 px-6 py-4 bg-surface-container-low/50 rounded-2xl border border-outline-variant/30">
                <LegendItem color="bg-secondary" label="Available" />
                <LegendItem color="bg-error" label="Occupied" />
                <LegendItem color="bg-tertiary" label="Reserved" />
                <LegendItem color="bg-surface-container-highest" label="Dirty / Closed" />
            </div>

            {/* View Content */}
            {viewMode === 'map' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                    {tablesQuery.isLoading ? (
                        Array(12).fill(0).map((_, i) => <Skeleton key={i} className="aspect-square rounded-3xl" />)
                    ) : tablesQuery.data?.data?.length === 0 ? (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-20">
                            <AlertCircle size={64} className="mb-4" />
                            <p className="body-lg">No tables configured for this outlet.</p>
                        </div>
                    ) : (
                        tablesQuery.data?.data?.map(table => (
                            <div 
                                key={table.id}
                                onClick={() => handleTableSelect(table.id)}
                                className={cn(
                                    "group relative aspect-square rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-[1.05] hover:shadow-2xl active:scale-95",
                                    table.isOccupied 
                                        ? "bg-error/10 border-2 border-error/20" 
                                        : "bg-surface-container-high border-2 border-outline-variant/50 hover:border-secondary"
                                )}
                            >
                                {/* Table Shape (Visual) */}
                                <div className={cn(
                                    "h-24 w-24 rounded-2xl flex items-center justify-center transition-all duration-500 mb-2",
                                    table.isOccupied ? "bg-error/20 scale-110" : "bg-secondary/10 group-hover:bg-secondary/20"
                                )}>
                                    <TableIcon size={40} className={table.isOccupied ? "text-error" : "text-secondary"} />
                                </div>

                                <div className="text-center">
                                    <h3 className="body-md font-black text-on-surface">Table {table.number}</h3>
                                    <div className="flex items-center justify-center gap-1.5 mt-1 text-on-surface-variant/60">
                                        <Users size={12} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">{table.capacity} Seats</span>
                                    </div>
                                </div>

                                {/* Indicators */}
                                <div className="absolute top-4 right-4">
                                    <div className={cn(
                                        "h-3 w-3 rounded-full animate-pulse",
                                        table.isOccupied ? "bg-error shadow-[0_0_10px_rgba(255,180,171,0.5)]" : "bg-secondary shadow-[0_0_10px_rgba(0,139,139,0.5)]"
                                    )} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                /* List View */
                <div className="space-y-3">
                    {tablesQuery.isLoading ? (
                        Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
                    ) : (
                        tablesQuery.data?.data?.map(table => (
                            <div 
                                key={table.id}
                                onClick={() => handleTableSelect(table.id)}
                                className="flex items-center gap-4 p-4 bg-surface-container-low border border-outline-variant rounded-2xl hover:bg-surface-container transition-colors cursor-pointer"
                            >
                                <div className={cn(
                                    "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                                    table.isOccupied ? "bg-error/10 text-error" : "bg-secondary/10 text-secondary"
                                )}>
                                    <TableIcon size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <h3 className="body-md font-bold text-on-surface">Table {table.number}</h3>
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                                            table.isOccupied ? "bg-error/10 text-error" : "bg-secondary/10 text-secondary"
                                        )}>
                                            {table.isOccupied ? 'Occupied' : 'Available'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-on-surface-variant/60 uppercase tracking-widest mt-0.5">
                                        {table.capacity} Seats • {(table as any).zone || 'Main Area'}
                                    </p>
                                </div>
                                <button className="h-10 px-4 bg-surface-container-highest text-on-surface-variant group-hover:text-secondary rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all">
                                    Manage
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Bottom Bar Info - Only on Large Screens */}
            <div className="hidden lg:flex fixed bottom-10 left-1/2 -translate-x-1/2 bg-surface-container-highest/80 backdrop-blur-xl border border-outline-variant p-4 px-10 rounded-full shadow-2xl items-center gap-12 z-40">
                <SummaryItem label="Total Tables" value={tablesQuery.data?.data?.length || 0} />
                <div className="h-8 w-[1px] bg-white/10" />
                <SummaryItem label="Available" value={tablesQuery.data?.data?.filter(t => !t.isOccupied).length || 0} color="text-secondary" />
                <div className="h-8 w-[1px] bg-white/10" />
                <SummaryItem label="Occupancy" value={`${Math.round((tablesQuery.data?.data?.filter(t => t.isOccupied).length || 0) / (tablesQuery.data?.data?.length || 1) * 100)}%`} />
            </div>
        </div>
    );
}

function LegendItem({ color, label }: { color: string, label: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className={cn("h-4 w-4 rounded-full", color)} />
            <span className="label-sm !normal-case !text-[11px] text-on-surface-variant">{label}</span>
        </div>
    );
}

function SummaryItem({ label, value, color }: { label: string, value: string | number, color?: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest">{label}</span>
            <span className={cn("text-xl font-black tabular-nums", color || "text-on-surface")}>{value}</span>
        </div>
    );
}

function cn(...inputs: LooseValue[]) {
    return inputs.filter(Boolean).join(' ');
}
