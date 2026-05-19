import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Plus, 
    Search, 
    Building2, 
    Phone, 
    Mail, 
    MapPin,
    Truck,
    Package,
    ArrowUpRight,
    MoreVertical,
    FileText,
    CheckCircle2,
    Calendar,
    AlertCircle,
    ChevronDown,
    X,
    Filter,
    Loader2,
    Edit2,
    Trash2
} from 'lucide-react';
import { Vendor } from '@mumo/types';
import { cn } from '../../lib/utils';
import { vendorService, purchaseOrderService, inventoryService, getErrorMessage } from '../../api/service';
import Skeleton from '../../components/ui/Skeleton';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const VendorPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'vendors' | 'pos'>('vendors');
    const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
    const [isPOConfirmModalOpen, setIsPOConfirmModalOpen] = useState(false);
    const [selectedPO, setSelectedPO] = useState<any>(null);
    const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>({});
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const { data: vendors, isLoading: vendorsLoading } = useQuery({
        queryKey: ['vendors'],
        queryFn: () => vendorService.getAll(),
    });

    const { data: purchaseOrders, isLoading: posLoading } = useQuery({
        queryKey: ['purchase-orders'],
        queryFn: () => purchaseOrderService.getAll(),
    });

    const markReceivedMutation = useMutation({
        mutationFn: ({ id }: { id: string }) => {
            // DEEP-CRIT-002: Send correct payload shape matching server expectations
            const items = selectedPO?.items?.map((item: LooseValue) => ({
                inventoryItemId: item.inventoryItemId,
                receivedQty: parseFloat(receivedQtys[item.id] || '0'),
            }));
            return purchaseOrderService.updateStatus(id, 'RECEIVED', items);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast.success('Inventory updated successfully');
            setIsPOConfirmModalOpen(false);
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    const handleConfirmReceive = (po: LooseValue) => {
        setSelectedPO(po);
        // DEEP-CRIT-002: Initialize from orderedQty (not item.quantity which doesn't exist)
        const qtys: Record<string, string> = {};
        po.items?.forEach((item: LooseValue) => {
            qtys[item.id] = String(item.orderedQty ?? 0);
        });
        setReceivedQtys(qtys);
        setIsPOConfirmModalOpen(true);
    };

    const isLoading = vendorsLoading || posLoading;

    if (isLoading) {
        return <div className="p-10"><Skeleton className="h-full w-full rounded-2xl" /></div>;
    }

    const handleDeleteVendor = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            await vendorService.delete(id);
            toast.success('Vendor deleted');
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    return (
        <div className="p-6 tablet:p-10 space-y-10" onClick={() => setOpenMenuId(null)}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="display-lg text-on-surface">Supply Chain</h1>
                    <p className="body-lg text-on-surface-variant">Manage vendors and track purchase orders.</p>
                </div>
                <button 
                    onClick={() => activeTab === 'vendors' ? setIsVendorModalOpen(true) : null}
                    className="btn-primary flex items-center gap-2 group self-start md:self-center"
                >
                    <Plus size={20} />
                    {activeTab === 'vendors' ? 'Add Vendor' : 'New Order'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-outline-variant px-6 bg-surface-container-low card-default rounded-b-none border-b-0">
                <button 
                    onClick={() => setActiveTab('vendors')}
                    className={`px-6 py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${
                        activeTab === 'vendors' ? 'border-primary border-b-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                    Vendors
                </button>
                <button 
                    onClick={() => setActiveTab('pos')}
                    className={`px-6 py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${
                        activeTab === 'pos' ? 'border-primary border-b-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                    Purchase Orders
                </button>
            </div>

            <div className="card-default rounded-t-none">
                {activeTab === 'vendors' ? (
                    <div className="divide-y divide-outline-variant">
                         <div className="hidden md:grid grid-cols-5 gap-6 px-8 py-4 bg-surface-container-low text-on-surface-variant label-sm uppercase tracking-widest font-bold">
                            <div className="col-span-2">Vendor Details</div>
                            <div>Contact</div>
                            <div>Status</div>
                            <div className="text-right">Actions</div>
                        </div>
                        {vendors?.data?.map((vendor: LooseValue) => (
                            <div key={vendor.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6 px-8 py-6 items-center hover:bg-surface-container-low/30 transition-colors">
                                <div className="col-span-2 flex items-center gap-4">
                                     <div className="h-12 w-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
                                         <Building2 size={24} />
                                     </div>
                                     <div>
                                         <div className="body-lg font-bold text-on-surface">{vendor.name}</div>
                                         <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                                             <MapPin size={12} /> {vendor.address || 'Global Supplier'}
                                         </div>
                                     </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-on-surface body-sm font-medium">
                                        <Phone size={14} className="text-on-surface-variant" /> {vendor.phone || 'N/A'}
                                    </div>
                                    <div className="flex items-center gap-2 text-on-surface body-sm font-medium">
                                        <Mail size={14} className="text-on-surface-variant" /> {vendor.email || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <span className="label-sm px-3 py-1 rounded-full bg-secondary/10 text-secondary font-bold uppercase">Active</span>
                                </div>
                                <div className="text-right flex justify-end gap-2 relative">
                                     <button onClick={() => toast(`Viewing details for ${vendor.name}`, { icon: '📋' })} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title="View details"><FileText size={18} /></button>
                                     <div className="relative">
                                         <button 
                                             onClick={(e) => {
                                                 e.stopPropagation();
                                                 setOpenMenuId(openMenuId === vendor.id ? null : vendor.id);
                                             }} 
                                             className={cn(
                                                 "p-2 rounded-lg transition-colors",
                                                 openMenuId === vendor.id ? "bg-primary text-on-primary" : "hover:bg-surface-container-high text-on-surface-variant"
                                             )}
                                             title="Actions"
                                         >
                                            <MoreVertical size={18} />
                                         </button>

                                         {openMenuId === vendor.id && (
                                             <div className="absolute right-0 top-full mt-3 w-48 bg-surface-container-highest border border-outline-variant rounded-2xl shadow-2xl z-[100] py-3 animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/20">
                                                 <button 
                                                     onClick={() => setEditingVendor(vendor)}
                                                     className="w-full px-5 py-3 text-left flex items-center gap-4 hover:bg-white/10 transition-colors text-sm font-bold text-on-surface"
                                                 >
                                                     <Edit2 size={18} className="text-primary" />
                                                     Edit Details
                                                 </button>
                                                 <div className="my-2 border-t border-outline-variant" />
                                                 <button 
                                                     onClick={() => handleDeleteVendor(vendor.id, vendor.name)}
                                                     className="w-full px-5 py-3 text-left flex items-center gap-4 hover:bg-error/15 text-error transition-colors text-sm font-bold"
                                                 >
                                                     <Trash2 size={18} />
                                                     Delete Vendor
                                                 </button>
                                             </div>
                                         )}
                                     </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="divide-y divide-outline-variant">
                         <div className="hidden md:grid grid-cols-6 gap-6 px-8 py-4 bg-surface-container-low text-on-surface-variant label-sm uppercase tracking-widest font-bold">
                            <div className="col-span-2">PO # / Vendor</div>
                            <div className="text-center">Items</div>
                            <div className="text-center">Total</div>
                            <div className="text-center">Status</div>
                            <div className="text-right">Actions</div>
                        </div>
                        {(purchaseOrders as any)?.data?.map((po: LooseValue) => (
                            <div key={po.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6 px-8 py-6 items-center hover:bg-surface-container-low/30 transition-colors">
                                <div className="col-span-2 space-y-1">
                                     <div className="body-md font-bold text-on-surface">PO-{po.id.substring(0, 6).toUpperCase()}</div>
                                     <div className="flex items-center gap-2 text-on-surface-variant label-sm">
                                         <Building2 size={12} /> Vendor ID: {po.vendorId.substring(0, 8)}
                                     </div>
                                </div>
                                <div className="text-center">
                                    <div className="body-md font-medium text-on-surface">{po.items?.length || 0} Items</div>
                                </div>
                                <div className="text-center">
                                    <div className="body-md font-bold text-primary">KES {po.totalAmount?.toLocaleString() || 0}</div>
                                </div>
                                <div className="text-center">
                                    <span className={`label-sm px-3 py-1 rounded-full font-bold uppercase ${
                                        po.status === 'RECEIVED' ? 'bg-secondary/10 text-secondary' : 
                                        po.status === 'SENT' ? 'bg-secondary/10 text-secondary' : 
                                        'bg-surface-container-highest text-on-surface-variant'
                                    }`}>
                                        {po.status}
                                    </span>
                                </div>
                                <div className="text-right">
                                    {po.status === 'SENT' ? (
                                        <button 
                                            onClick={() => handleConfirmReceive(po)}
                                            className="btn-secondary py-2 px-4 text-xs flex items-center gap-2 float-right"
                                        >
                                            <CheckCircle2 size={14} /> Receive
                                        </button>
                                    ) : (
                                        <button className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors float-right">
                                            <FileText size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* New/Edit Vendor Modal */}
            {(isVendorModalOpen || editingVendor) && (
                <div className="fixed inset-0 bg-surface/90 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <VendorForm
                        initialData={editingVendor || undefined}
                        onClose={() => {
                            setIsVendorModalOpen(false);
                            setEditingVendor(null);
                        }}
                        onSuccess={() => {
                            setIsVendorModalOpen(false);
                            setEditingVendor(null);
                            queryClient.invalidateQueries({ queryKey: ['vendors'] });
                        }}
                    />
                </div>
            )}

            {/* Receipt Confirmation Modal */}
            {isPOConfirmModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
                            <div>
                                <h2 className="headline-md font-bold text-on-surface">Confirm Inventory Receipt</h2>
                                <p className="body-md text-on-surface-variant">Verify quantities received for PO: {selectedPO?.id.substring(0, 8).toUpperCase()}</p>
                            </div>
                            <button onClick={() => setIsPOConfirmModalOpen(false)} className="p-2 rounded-full hover:bg-surface-container-high">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                            {selectedPO?.items?.map((item: LooseValue) => {
                                const received = receivedQtys[item.id] || '0';
                                const isPartial = parseFloat(received) < (item.orderedQty ?? 0);
                                return (
                                    <div key={item.id} className={`p-4 rounded-2xl border transition-colors ${isPartial ? 'bg-tertiary/10 border-tertiary/20' : 'bg-surface-container border-outline-variant'}`}>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center">
                                                    <Package size={20} className={isPartial ? 'text-tertiary' : 'text-on-surface-variant'} />
                                                </div>
                                                <div>
                                                    <div className="body-md font-bold text-on-surface">{item.inventoryItem?.name || `Item ${item.inventoryItemId.substring(0, 8)}`}</div>
                                                    <div className="label-sm text-on-surface-variant">Ordered: {item.orderedQty} {item.inventoryItem?.unit || 'units'}</div>
                                                </div>
                                            </div>
                                            <div className="w-32 space-y-1">
                                                <label className="label-xs text-on-surface-variant uppercase font-bold">Qty Received</label>
                                                <input 
                                                    type="number"
                                                    value={received}
                                                    onChange={(e) => setReceivedQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                    className="input-field py-2 text-center font-bold"
                                                />
                                            </div>
                                        </div>
                                        {isPartial && (
                                            <div className="mt-3 flex items-center gap-2 text-tertiary text-xs font-bold uppercase tracking-wider">
                                                <AlertCircle size={14} /> Partial Shipment
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-8 bg-surface-container-low border-t border-outline-variant flex items-center justify-end gap-4">
                            <button onClick={() => setIsPOConfirmModalOpen(false)} className="btn-secondary">Cancel</button>
                            <button 
                                onClick={() => markReceivedMutation.mutate({ id: selectedPO.id })}
                                disabled={markReceivedMutation.isPending}
                                className="btn-primary"
                            >
                                {markReceivedMutation.isPending ? 'Processing...' : 'Confirm & Update Stock'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Vendor Form (Create & Edit) ─────────────────────────────────────────────
function VendorForm({ initialData, onClose, onSuccess }: { initialData?: Vendor; onClose: () => void; onSuccess: () => void }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        address: initialData?.address || '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const mutation = useMutation({
        mutationFn: (data: Partial<Omit<Vendor, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'categories'>>) => initialData 
            ? vendorService.update(initialData.id, data)
            : vendorService.create(data),
        onSuccess: () => {
            toast.success(initialData ? 'Vendor updated successfully' : 'Vendor created successfully');
            onSuccess();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = 'Vendor name is required';
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format';

        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        mutation.mutate(form);
    };

    return (
        <div className="w-full max-w-lg card-default shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
                <h2 className="headline-md">{initialData ? 'Edit Vendor' : 'Add Vendor'}</h2>
                <button onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center">
                    <X size={24} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="label-sm text-on-surface-variant">Vendor Name</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className={cn('input-field', errors.name && 'border-error focus:ring-error/20')}
                        placeholder="e.g. Fresh Farms Ltd"
                    />
                    {errors.name && <p className="text-xs text-error">{errors.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="label-sm text-on-surface-variant">Email</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            className={cn('input-field', errors.email && 'border-error focus:ring-error/20')}
                            placeholder="vendor@example.com"
                        />
                        {errors.email && <p className="text-xs text-error">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                        <label className="label-sm text-on-surface-variant">Phone</label>
                        <input
                            type="tel"
                            value={form.phone}
                            onChange={e => setForm({ ...form, phone: e.target.value })}
                            className="input-field"
                            placeholder="+254 700 000 000"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="label-sm text-on-surface-variant">Address</label>
                    <input
                        type="text"
                        value={form.address}
                        onChange={e => setForm({ ...form, address: e.target.value })}
                        className="input-field"
                        placeholder="e.g. Industrial Area, Nairobi"
                    />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary !h-12">Cancel</button>
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="btn-primary !h-12 !px-10"
                    >
                        {mutation.isPending ? <Loader2 className="animate-spin" size={20} /> : initialData ? 'Save Changes' : 'Add Vendor'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default VendorPage;
