import { useState } from 'react';
import { X, Combine, MoveHorizontal, Loader2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { tableService } from '../../api/service';
import { cn } from '../../lib/utils';
import { Table } from '@mumo/types';

interface TableActionModalProps {
    type: 'merge' | 'transfer';
    sourceTable: Table;
    onClose: () => void;
    onSubmit: (targetTableId: string) => void;
    isPending?: boolean;
}

export default function TableActionModal({ type, sourceTable, onClose, onSubmit, isPending }: TableActionModalProps) {
    const [selectedTableId, setSelectedTableId] = useState<string>('');

    const tablesQuery = useQuery({
        queryKey: ['tables'],
        queryFn: () => tableService.getAll(),
    });

    // Filter tables:
    // - For Transfer: must be Available (NOT occupied) and NOT the source table
    // - For Merge: must be Occupied and NOT the source table
    const targetTables = tablesQuery.data?.data?.filter((t: Table) => {
        if (t.id === sourceTable.id) return false;
        if (type === 'transfer') return !t.isOccupied;
        if (type === 'merge') return t.isOccupied;
        return true;
    }) || [];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTableId) return;
        onSubmit(selectedTableId);
    };

    return (
        <div className="fixed inset-0 bg-surface/90 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-lg card-default shadow-2xl animate-in zoom-in-95 duration-300 bg-surface-container border-outline-variant/30">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="headline-md capitalize">{type === 'transfer' ? 'Transfer Table' : 'Merge Tables'}</h2>
                        <p className="body-sm text-on-surface-variant">
                            {type === 'transfer' 
                                ? `Move orders from Table ${sourceTable.number} to a new table.` 
                                : `Merge Table ${sourceTable.number}'s orders into an existing active table.`}
                        </p>
                    </div>
                    <button onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {targetTables.length === 0 ? (
                        <div className="p-10 bg-surface-container/30 rounded-3xl border border-dashed border-outline-variant text-center space-y-4">
                            <AlertCircle size={40} className="mx-auto text-on-surface-variant/20" />
                            <p className="body-md text-on-surface-variant">
                                No suitable tables found for this action.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <label className="label-sm text-on-surface-variant">Select Target Table</label>
                            <div className="grid grid-cols-3 tablet:grid-cols-4 gap-3">
                                {targetTables.map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setSelectedTableId(t.id)}
                                        className={cn(
                                            "h-16 rounded-xl border-2 flex flex-col items-center justify-center transition-all animate-in fade-in",
                                            selectedTableId === t.id 
                                                ? "border-secondary bg-secondary/10 text-secondary" 
                                                : "border-outline-variant/30 text-on-surface-variant hover:border-outline hover:bg-white/5"
                                        )}
                                    >
                                        <span className="text-xs font-bold opacity-60 uppercase tracking-tighter">Table</span>
                                        <span className="display-sm !text-xl font-black italic">{t.number}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 pt-4">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 h-14 rounded-2xl border border-outline-variant text-on-surface-variant font-bold hover:bg-white/5 transition-all"
                        >
                            Cancel Action
                        </button>
                        <button 
                            type="submit" 
                            disabled={isPending || !selectedTableId}
                            className="flex-1 h-14 rounded-2xl bg-on-surface text-surface font-black tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isPending ? <Loader2 className="animate-spin" size={20} /> : (type === 'transfer' ? <MoveHorizontal size={20} /> : <Combine size={20} />)}
                            <span className="uppercase">{type === 'transfer' ? 'RUN TRANSFER' : 'MERGE NOW'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
