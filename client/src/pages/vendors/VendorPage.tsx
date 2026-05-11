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
    Filter
} from 'lucide-react';
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
    const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});

    const { data: vendors, isLoading: vendorsLoading } = useQuery({
        queryKey: ['vendors'],
        queryFn: vendorService.getAll,
    });

    const { data: purchaseOrders, isLoading: posLoading } = useQuery({
        queryKey: ['purchase-orders'],
        queryFn: purchaseOrderService.getAll,
    });

    const markReceivedMutation = useMutation({
        mutationFn: ({ id }: { id: string }) => {
            const items = selectedPO?.items?.map((item: any) => ({
                inventoryItemId: item.inventoryItemId,
                qtyReceived: receivedQtys[item.id] || 0,
                reason: `Received via PO-${id.substring(0, 8)}`
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

    const handleConfirmReceive = (po: any) => {
        setSelectedPO(po);
        const qtys: Record<string, number> = {};
        po.items?.forEach((item: any) => {
            qtys[item.id] = item.quantity;
        });
        setReceivedQtys(qtys);
        setIsPOConfirmModalOpen(true);
    };

    const isLoading = vendorsLoading || posLoading;

    if (isLoading) {
        return <div className="p-10"><Skeleton className="h-full w-full rounded-2xl" /></div>;
    }

    return (
        <div className="p-6 tablet:p-10 space-y-10">
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

            <div className="card-default rounded-t-none overflow-hidden">
                {activeTab === 'vendors' ? (
                    <div className="divide-y divide-outline-variant">
                         <div className="hidden md:grid grid-cols-5 gap-6 px-8 py-4 bg-surface-container-low text-on-surface-variant label-sm uppercase tracking-widest font-bold">
                            <div className="col-span-2">Vendor Details</div>
                            <div>Contact</div>
                            <div>Status</div>
                            <div className="text-right">Actions</div>
                        </div>
                        {vendors?.map((vendor: any) => (
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
                                <div className="text-right flex justify-end gap-2">
                                     <button className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"><FileText size={18} /></button>
                                     <button className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"><MoreVertical size={18} /></button>
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
                        {purchaseOrders?.map((po: any) => (
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
                            {selectedPO?.items?.map((item: any) => {
                                const received = receivedQtys[item.id] || 0;
                                const isPartial = received < item.quantity;
                                return (
                                    <div key={item.id} className={`p-4 rounded-2xl border transition-colors ${isPartial ? 'bg-tertiary/10 border-tertiary/20' : 'bg-surface-container border-outline-variant'}`}>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center">
                                                    <Package size={20} className={isPartial ? 'text-tertiary' : 'text-on-surface-variant'} />
                                                </div>
                                                <div>
                                                    <div className="body-md font-bold text-on-surface">Item ID: {item.inventoryItemId.substring(0, 8)}</div>
                                                    <div className="label-sm text-on-surface-variant">Ordered: {item.quantity} units</div>
                                                </div>
                                            </div>
                                            <div className="w-32 space-y-1">
                                                <label className="label-xs text-on-surface-variant uppercase font-bold">Qty Received</label>
                                                <input 
                                                    type="number"
                                                    value={received}
                                                    onChange={(e) => setReceivedQtys(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                                                    className="input-field py-2 text-center font-bold"
                                                />
                                            </div>
                                        </div>
                                        {isPartial && (
                                            <div className="mt-3 flex items-center gap-2 text-tertiary text-xs font-bold uppercase tracking-wider">
                                                <AlertCircle size={14} /> Partial Shipment Noted
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

export default VendorPage;
