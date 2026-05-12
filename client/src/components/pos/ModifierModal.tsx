import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { menuService } from '../../api/service';

interface Modifier {
    id: string;
    name: string;
    price: number;
}

interface ModifierModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: string; // Changed from itemName to itemId
    itemName: string;
    onConfirm: (selected: Modifier[]) => void;
}

export default function ModifierModal({ isOpen, onClose, itemId, itemName, onConfirm }: ModifierModalProps) {
    const [selected, setSelected] = useState<Modifier[]>([]);

    // Stable refs to avoid infinite loops from inline callbacks
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

    if (!isOpen) return null;

    const toggleModifier = (mod: Modifier) => {
        setSelected(prev => 
            prev.find(m => m.id === mod.id)
                ? prev.filter(m => m.id !== mod.id)
                : [...prev, mod]
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
            <div className="absolute inset-0 bg-surface/80 backdrop-blur-md animate-in fade-in duration-500" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] border border-outline-variant overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/10">
                {/* Header Section */}
                <div className="p-10 pb-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="space-y-1">
                            <h3 className="display-sm !text-3xl tracking-tight">Customize Item</h3>
                            <p className="body-lg text-primary font-bold flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                {itemName}
                            </p>
                        </div>
                        <button onClick={onClose} className="h-12 w-12 rounded-2xl hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors border border-outline-variant/30">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Modifiers List */}
                <div className="px-10 py-4 space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-6 text-on-surface-variant">
                            <Loader2 className="animate-spin text-primary" size={48} strokeWidth={3} />
                            <p className="headline-sm font-bold opacity-50 uppercase tracking-widest text-xs">Preparing categories...</p>
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
                                            "group w-full p-6 p-y-5 rounded-[1.5rem] border-2 flex items-center justify-between transition-all duration-300 active:scale-[0.98]",
                                            isSelected
                                                ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]'
                                                : 'bg-surface-container-low border-outline-variant/50 text-on-surface hover:bg-surface-container-high hover:border-outline'
                                        )}
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className={cn(
                                                "h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-500",
                                                isSelected
                                                    ? 'bg-primary text-on-primary rotate-0 scale-100'
                                                    : 'bg-surface-container-highest text-on-surface-variant rotate-[-45deg] scale-90 group-hover:rotate-0 group-hover:scale-100'
                                            )}>
                                                {isSelected ? <Check size={18} strokeWidth={3} /> : <Plus size={18} />}
                                            </div>
                                            <div className="text-left">
                                                <div className={cn("body-lg font-bold transition-colors", isSelected ? "text-primary" : "text-on-surface")}>
                                                    {mod.name}
                                                </div>
                                                <div className="text-xs text-on-surface-variant font-medium uppercase tracking-widest opacity-60">Add-on Option</div>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "px-4 py-2 rounded-full label-sm font-black transition-all",
                                            isSelected ? "bg-primary text-on-primary" : "bg-surface-container-highest text-on-surface-variant"
                                        )}>
                                            +KES {mod.price}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer / Action */}
                <div className="p-10 pt-6 bg-surface-container-low/50 backdrop-blur-xl border-t border-outline-variant/30 mt-4">
                    <div className="flex items-center justify-between mb-8 px-2">
                        <div className="space-y-1">
                            <div className="label-sm text-on-surface-variant uppercase font-bold tracking-widest">Added Cost</div>
                            <div className="display-sm !text-orange-400">
                                KES {selected.reduce((sum, m) => sum + m.price, 0).toLocaleString()}
                            </div>
                        </div>
                        <div className="text-right">
                           <div className="label-sm text-on-surface-variant uppercase font-bold tracking-widest">Selections</div>
                           <div className="headline-sm text-primary">{selected.length} Item{selected.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                            onConfirm(selected);
                            onClose();
                        }}
                        disabled={isLoading}
                        className="btn-primary w-full h-[72px] rounded-[1.5rem] !text-lg !font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 active:scale-95 transition-all"
                    >
                        Confirm Selection
                    </button>
                </div>
            </div>
        </div>
    );
}
