import React, { useState, useEffect, useRef } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { menuService } from '../../api/service';
import Dialog from '../ui/Dialog';
import { formatCurrency } from '../../lib/formatCurrency';
import { useStore } from '../../store/useStore';

interface Modifier {
    id: string;
    name: string;
    price: number;
}

interface ModifierModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: string;
    itemName: string;
    onConfirm: (selected: Modifier[]) => void;
}

/**
 * DEEP-WARN-009: Modifier modal state leaks - Reset selected state on open.
 * DEEP-WARN-012: Modal accessibility - Uses Dialog component.
 */
export default function ModifierModal({ isOpen, onClose, itemId, itemName, onConfirm }: ModifierModalProps) {
    const [selected, setSelected] = useState<Modifier[]>([]);
    const { session } = useStore();
    const currency = session.tenantId ? 'KES' : 'KES'; // Will be optimized later with tenant settings

    // DEEP-WARN-009: Reset state when opening for a new item
    useEffect(() => {
        if (isOpen && itemId) {
            setSelected([]);
        }
    }, [isOpen, itemId]);

    const onConfirmRef = useRef(onConfirm);
    const onCloseRef = useRef(onClose);
    onConfirmRef.current = onConfirm;
    onCloseRef.current = onClose;

    const { data: modifiers, isLoading } = useQuery({
        queryKey: ['modifiers', itemId],
        queryFn: () => menuService.getModifiers(itemId),
        enabled: isOpen && !!itemId,
    });

    // Auto-confirm if no modifiers exist
    useEffect(() => {
        if (isOpen && modifiers && modifiers.length === 0 && !isLoading) {
            onConfirmRef.current([]);
            onCloseRef.current();
        }
    }, [isOpen, modifiers, isLoading]);

    const toggleModifier = (mod: Modifier) => {
        setSelected(prev => 
            prev.find(m => m.id === mod.id)
                ? prev.filter(m => m.id !== mod.id)
                : [...prev, mod]
        );
    };

    return (
        <Dialog 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Customize Item"
            size="md"
        >
            <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                    <span className="text-lg font-bold text-primary">{itemName}</span>
                </div>

                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <Loader2 className="animate-spin text-primary" size={32} />
                            <p className="text-sm font-medium text-white/50 uppercase tracking-widest">Loading options...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {modifiers?.map(mod => {
                                const isSelected = selected.find(m => m.id === mod.id);
                                return (
                                    <button 
                                        key={mod.id}
                                        onClick={() => toggleModifier(mod)}
                                        className={cn(
                                            "group w-full p-5 rounded-2xl border-2 flex items-center justify-between transition-all active:scale-[0.98]",
                                            isSelected
                                                ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                                                : 'bg-white/5 border-white/5 text-white hover:bg-white/10 hover:border-white/10'
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                                                isSelected
                                                    ? 'bg-primary text-white'
                                                    : 'bg-white/5 text-white/40 group-hover:bg-white/10'
                                            )}>
                                                {isSelected ? <Check size={20} strokeWidth={3} /> : <Plus size={20} />}
                                            </div>
                                            <div className="text-left">
                                                <div className={cn("font-bold", isSelected ? "text-primary" : "text-white")}>
                                                    {mod.name}
                                                </div>
                                                <div className="text-xs text-white/40 uppercase tracking-wider">Add-on</div>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "px-3 py-1.5 rounded-lg text-sm font-bold",
                                            isSelected ? "bg-primary text-white" : "bg-white/5 text-white/60"
                                        )}>
                                            + {formatCurrency(mod.price, currency)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-white/10 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div>
                            <div className="text-xs text-white/40 uppercase font-black tracking-widest mb-1">Added Cost</div>
                            <div className="text-2xl font-black text-orange-400">
                                {formatCurrency(selected.reduce((sum, m) => sum + m.price, 0), currency)}
                            </div>
                        </div>
                        <div className="text-right">
                           <div className="text-xs text-white/40 uppercase font-black tracking-widest mb-1">Selections</div>
                           <div className="text-xl font-bold text-primary">{selected.length} Item{selected.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => {
                            onConfirm(selected);
                            onClose();
                        }}
                        disabled={isLoading}
                        className="w-full h-16 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-[0.98] transition-all"
                    >
                        Confirm Selection
                    </button>
                </div>
            </div>
        </Dialog>
    );
}
