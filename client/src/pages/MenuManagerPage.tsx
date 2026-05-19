import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../api/service';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuService } from '../api/service';
import { useStore } from '../store/useStore';
import { 
    Plus, 
    Search, 
    Edit2, 
    Trash2, 
    MoreVertical,
    UtensilsCrossed,
    Check,
    X,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { MenuItem } from '@mumo/types';
import Skeleton, { RowSkeleton } from '../components/ui/Skeleton';
import { Navigate } from 'react-router-dom';

export default function MenuManagerPage() {
    const { session } = useStore();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 15;

    // Role guard
    if (session.role !== 'TENANT_ADMIN' && session.role !== 'MANAGER') {
        return <Navigate to="/dashboard" replace />;
    }

    const menuQuery = useQuery({
        queryKey: ['menus'],
        queryFn: () => menuService.getAll(),
    });

    const deleteMutation = useMutation({
        mutationFn: menuService.delete,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menus'] }),
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    const filteredItems = menuQuery.data?.data?.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.categoryId?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil((filteredItems?.length || 0) / PAGE_SIZE);
    const paginatedItems = filteredItems?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const categories = useMemo(() => {
        const base = ['GENERAL', 'STARTER', 'MAIN', 'DESSERT', 'DRINK'];
        const existing = menuQuery.data?.data?.map(i => i.categoryId).filter(Boolean) as string[] || [];
        return Array.from(new Set([...base, ...existing]));
    }, [menuQuery.data]);

    return (
        <div className="p-8 tablet:p-10 space-y-8 min-h-full">
            {/* Header */}
            <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-6">
                <div>
                    <h1 className="display-lg text-on-surface">Menu Management</h1>
                    <p className="body-lg text-on-surface-variant">Update prices, availability, and menu structure.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative w-[300px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                        <input 
                            type="text" 
                            placeholder="Filter by name or category..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-field !h-[48px] !pl-12 !rounded-full !text-sm"
                        />
                    </div>
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="btn-primary !h-[48px] !rounded-full shadow-lg shadow-secondary/20"
                    >
                        <Plus size={20} />
                        <span>Add Item</span>
                    </button>
                </div>
            </div>

            {/* Menu Table */}
            <div className="card-default p-0 overflow-hidden border-outline-variant/30">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-surface-container-high/50 border-b border-outline-variant">
                            <th className="px-6 py-4 label-sm text-on-surface-variant">Item Details</th>
                            <th className="px-6 py-4 label-sm text-on-surface-variant">Category</th>
                            <th className="px-6 py-4 label-sm text-on-surface-variant text-right">Price</th>
                            <th className="px-6 py-4 label-sm text-on-surface-variant">Status</th>
                            <th className="px-6 py-4 label-sm text-on-surface-variant text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                        {menuQuery.isLoading ? (
                            Array(8).fill(0).map((_, i) => (
                                <tr key={i}>
                                    <td colSpan={5} className="p-0"><RowSkeleton /></td>
                                </tr>
                            ))
                        ) : filteredItems?.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-20 text-center opacity-30">
                                    <UtensilsCrossed size={48} className="mx-auto mb-4" />
                                    <p className="body-lg">No menu items found.</p>
                                </td>
                            </tr>
                        ) : (
                            paginatedItems?.map(item => (
                                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0">
                                                <UtensilsCrossed size={20} className="text-secondary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="body-md font-bold text-on-surface truncate">{item.name}</p>
                                                <p className="text-[11px] text-on-surface-variant/60 truncate italic">{item.description || 'No description'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="pill-status bg-surface-container-highest text-on-surface-variant border border-outline-variant/30">
                                            {item.categoryId || 'General'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="body-md font-black text-secondary">{item.price.toLocaleString()} KES</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {item.isAvailable ? (
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-secondary uppercase tracking-widest">
                                                <div className="h-2 w-2 rounded-full bg-secondary" />
                                                Available
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest">
                                                <div className="h-2 w-2 rounded-full bg-surface-container-highest" />
                                                Unavailable
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => setEditingItem(item)}
                                                className="h-10 w-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-all"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if (confirm('Delete this item?')) deleteMutation.mutate(item.id);
                                                }}
                                                className="h-10 w-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-all"
                                            >
                                                {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination / Summary */}
            <div className="flex items-center justify-between px-6">
                <span className="label-sm text-on-surface-variant/60 lowercase italic">
                    Showing {filteredItems?.length || 0} of {menuQuery.data?.total || 0} total items
                </span>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="btn-secondary !h-[40px] !px-4 !text-xs !bg-surface-container-low disabled:opacity-30"
                    >Previous</button>
                    <span className="flex items-center px-3 text-xs text-on-surface-variant font-bold">
                        {totalPages > 0 ? `${page + 1} / ${totalPages}` : '—'}
                    </span>
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="btn-secondary !h-[40px] !px-4 !text-xs !bg-surface-container-low disabled:opacity-30"
                    >Next</button>
                </div>
            </div>

            {/* Simple Overlay for Modals placeholder */}
            {(isAdding || editingItem) && (
                <div className="fixed inset-0 bg-surface/90 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <MenuItemForm 
                        initialData={editingItem || undefined}
                        categories={categories}
                        onClose={() => { setIsAdding(false); setEditingItem(null); }} 
                        onSuccess={() => {
                            setIsAdding(false);
                            setEditingItem(null);
                            queryClient.invalidateQueries({ queryKey: ['menus'] });
                        }}
                    />
                </div>
            )}
        </div>
    );
}

function MenuItemForm({ onClose, onSuccess, initialData, categories }: { onClose: () => void, onSuccess: () => void, initialData?: MenuItem, categories: string[] }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        price: initialData?.price || 0,
        categoryId: initialData?.categoryId || '',
        isAvailable: initialData?.isAvailable ?? true,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const mutation = useMutation({
        mutationFn: (data: LooseValue) => initialData 
            ? menuService.update(initialData.id, data) 
            : menuService.create(data),
        onSuccess,
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = 'Name is required';
        if (form.price <= 0) errs.price = 'Price must be positive';
        
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        mutation.mutate(form);
    };

    return (
        <div className="w-full max-w-lg card-default shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
                <h2 className="headline-md">{initialData ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
                <button onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center">
                    <X size={24} />
                </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                {mutation.isError && (
                    <div className="p-4 bg-error/10 border border-error/20 rounded-xl flex items-start gap-3 animate-in shake duration-300">
                        <AlertCircle className="text-error shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <p className="label-sm text-error font-black uppercase tracking-widest">Action Failed</p>
                            <p className="body-xs text-error/80 leading-relaxed">{getErrorMessage(mutation.error)}</p>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="label-sm text-on-surface-variant">Item Name</label>
                    <input 
                        type="text" 
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className={cn("input-field", errors.name && "border-error focus:ring-error/20")}
                        placeholder="e.g. Grilled Ribeye"
                    />
                    {errors.name && <p className="text-xs text-error">{errors.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="label-sm text-on-surface-variant">Price (KES)</label>
                        <input 
                            type="number" 
                            value={form.price}
                            onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                            className={cn("input-field", errors.price && "border-error focus:ring-error/20")}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="label-sm text-on-surface-variant">Category</label>
                        <select 
                            value={form.categoryId}
                            onChange={e => setForm({ ...form, categoryId: e.target.value })}
                            className="input-field cursor-pointer uppercase font-bold"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="label-sm text-on-surface-variant">Description</label>
                    <textarea 
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        className="input-field min-h-[100px] py-3"
                        placeholder="Detail the ingredients or preparation..."
                    />
                </div>

                <div className="flex items-center gap-3 p-4 bg-surface-container rounded-2xl">
                    <input 
                        type="checkbox" 
                        checked={form.isAvailable}
                        onChange={e => setForm({ ...form, isAvailable: e.target.checked })}
                        className="h-5 w-5 rounded border-outline-variant text-secondary focus:ring-secondary/20"
                    />
                    <span className="body-md font-medium">Currently Available for Order</span>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary !h-12">Cancel</button>
                    <button 
                        type="submit" 
                        disabled={mutation.isPending}
                        className="btn-primary !h-12 !px-10"
                    >
                        {mutation.isPending ? <Loader2 className="animate-spin" size={20} /> : 'Save Item'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function cn(...inputs: LooseValue[]) {
    return inputs.filter(Boolean).join(' ');
}
