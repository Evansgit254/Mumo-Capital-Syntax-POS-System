import React, { useState } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';

interface Modifier {
    id: string;
    name: string;
    price: number;
}

interface ModifierModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemName: string;
    modifiers: Modifier[];
    onConfirm: (selected: Modifier[]) => void;
}

export default function ModifierModal({ isOpen, onClose, itemName, modifiers, onConfirm }: ModifierModalProps) {
    const [selected, setSelected] = useState<Modifier[]>([]);

    if (!isOpen) return null;

    const toggleModifier = (mod: Modifier) => {
        setSelected(prev => 
            prev.find(m => m.id === mod.id)
                ? prev.filter(m => m.id !== mod.id)
                : [...prev, mod]
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-surface-container-high rounded-[2rem] shadow-2xl border border-outline-variant overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 border-b border-outline-variant">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="headline-md">Customize</h3>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-on-surface-variant">
                            <X size={24} />
                        </button>
                    </div>
                    <p className="text-secondary font-bold">{itemName}</p>
                </div>

                <div className="p-8 space-y-4 max-h-[400px] overflow-y-auto">
                    {modifiers.map(mod => (
                        <button 
                            key={mod.id}
                            onClick={() => toggleModifier(mod)}
                            className={`w-full p-5 rounded-2xl border flex items-center justify-between transition-all ${
                                selected.find(m => m.id === mod.id)
                                    ? 'bg-secondary/10 border-secondary text-secondary'
                                    : 'bg-surface-container border-outline-variant text-on-surface hover:border-outline'
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                    selected.find(m => m.id === mod.id)
                                        ? 'bg-secondary border-secondary'
                                        : 'border-outline-variant'
                                }`}>
                                    {selected.find(m => m.id === mod.id) && <Check size={14} className="text-white" />}
                                </div>
                                <span className="font-bold">{mod.name}</span>
                            </div>
                            <span className="label-sm">+{mod.price} KES</span>
                        </button>
                    ))}
                </div>

                <div className="p-8 bg-surface-container border-t border-outline-variant">
                    <button 
                        onClick={() => {
                            onConfirm(selected);
                            onClose();
                        }}
                        className="btn-primary w-full h-[56px]"
                    >
                        Add to Order
                    </button>
                </div>
            </div>
        </div>
    );
}
