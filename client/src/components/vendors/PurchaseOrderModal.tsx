import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Loader2, Package, Building2 } from 'lucide-react';
import { vendorService, inventoryService, purchaseOrderService, getErrorMessage } from '../../api/service';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../../lib/formatCurrency';
import { cn } from '../../lib/utils';

interface POItemForm {
    inventoryItemId: string;
    quantity: string;
    unitCost: string;
}

interface PurchaseOrderModalProps {
    onClose: () => void;
    tenantCurrency: string;
}

const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({ onClose, tenantCurrency }) => {
    const queryClient = useQueryClient();
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [items, setItems] = useState<POItemForm[]>([
        { inventoryItemId: '', quantity: '1', unitCost: '0.01' }
    ]);

    const { data: vendors } = useQuery({
        queryKey: ['vendors'],
        queryFn: () => vendorService.getAll(),
    });

    const { data: inventory } = useQuery({
        queryKey: ['inventory'],
        queryFn: () => inventoryService.getAll(),
    });

    const mutation = useMutation({
        mutationFn: (payload: any) => purchaseOrderService.create(payload),
        onSuccess: () => {
            toast.success('Purchase Order created successfully');
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    const addItem = () => {
        setItems([...items, { inventoryItemId: '', quantity: '1', unitCost: '0.01' }]);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof POItemForm, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const totalCost = items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const cost = parseFloat(item.unitCost) || 0;
        return sum + (qty * cost);
    }, 0);

    const isSubmitDisabled = 
        !selectedVendorId || 
        items.length === 0 || 
        items.some(item => 
            !item.inventoryItemId || 
            !item.quantity || 
            parseFloat(item.quantity) <= 0 || 
            !item.unitCost || 
            parseFloat(item.unitCost) < 0.01
        ) || 
        mutation.isPending;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            vendorId: selectedVendorId,
            items: items.map(item => ({
                inventoryItemId: item.inventoryItemId,
                orderedQty: parseFloat(item.quantity),
                unitCost: parseFloat(item.unitCost),
            }))
        };
        mutation.mutate(payload);
    };

    return (
        <div className="w-full max-w-4xl bg-surface-container-lowest rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <Plus size={24} />
                    </div>
                    <div>
                        <h2 className="headline-md font-bold text-on-surface">New Purchase Order</h2>
                        <p className="body-md text-on-surface-variant">Procure inventory from approved vendors.</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high transition-colors">
                    <X size={24} />
                </button>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
                    {/* Vendor Selection */}
                    <div className="space-y-2">
                        <label className="label-sm text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-2">
                            <Building2 size={16} /> Select Vendor
                        </label>
                        <select 
                            value={selectedVendorId}
                            onChange={(e) => setSelectedVendorId(e.target.value)}
                            className="input-field h-14"
                        >
                            <option value="">-- Choose a vendor --</option>
                            {vendors?.data?.map((vendor: any) => (
                                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Line Items */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="label-sm text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-2">
                                <Package size={16} /> Order Items
                            </label>
                            <button 
                                type="button"
                                onClick={addItem}
                                className="text-secondary hover:bg-secondary/10 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
                            >
                                <Plus size={18} /> Add Line Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="flex gap-4 items-end bg-surface-container-low/50 p-4 rounded-2xl border border-outline-variant/30 group animate-in slide-in-from-right-4 duration-300">
                                    <div className="flex-1 space-y-2">
                                        <label className="label-xs text-on-surface-variant uppercase font-bold opacity-50">Inventory Item</label>
                                        <select 
                                            value={item.inventoryItemId}
                                            onChange={(e) => updateItem(index, 'inventoryItemId', e.target.value)}
                                            className="input-field h-12"
                                        >
                                            <option value="">Select Item</option>
                                            {inventory?.data?.map((inv: any) => (
                                                <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-32 space-y-2">
                                        <label className="label-xs text-on-surface-variant uppercase font-bold opacity-50">Quantity</label>
                                        <input 
                                            type="number"
                                            value={item.quantity}
                                            min="1"
                                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                            className="input-field h-12 text-center font-bold"
                                        />
                                    </div>
                                    <div className="w-40 space-y-2">
                                        <label className="label-xs text-on-surface-variant uppercase font-bold opacity-50">Unit Cost ({tenantCurrency})</label>
                                        <input 
                                            type="number"
                                            step="0.01"
                                            value={item.unitCost}
                                            min="0.01"
                                            onChange={(e) => updateItem(index, 'unitCost', e.target.value)}
                                            className="input-field h-12 text-right font-mono"
                                        />
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => removeItem(index)}
                                        className="h-12 w-12 flex items-center justify-center text-error hover:bg-error/10 rounded-xl transition-colors shrink-0"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-surface-container-low border-t border-outline-variant flex items-center justify-between">
                    <div>
                        <p className="label-xs text-on-surface-variant uppercase font-bold tracking-widest mb-1">Estimated Total Cost</p>
                        <p className="display-sm text-on-surface font-bold">
                            {formatCurrency(totalCost, tenantCurrency)}
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="btn-secondary h-14 px-8">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={isSubmitDisabled}
                            className="btn-primary h-14 px-10 gap-3"
                        >
                            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Package size={20} />}
                            Place Order
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default PurchaseOrderModal;
