import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuService, tableService } from '../api/service';
import { useStore } from '../store/useStore';
import { 
    Search, 
    Plus, 
    Minus, 
    Trash2, 
    CreditCard,
    ShoppingBag,
    UtensilsCrossed,
    ChevronLeft
} from 'lucide-react';
import { MenuItem } from '@mumo/types';
import Skeleton from '../components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';

export default function POSPage() {
    const navigate = useNavigate();
    const { cart } = useStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const menuQuery = useQuery({
        queryKey: ['menus'],
        queryFn: menuService.getAll,
    });

    const tablesQuery = useQuery({
        queryKey: ['tables'],
        queryFn: tableService.getAll,
    });

    // Filtering logic
    const categories = Array.from(new Set(menuQuery.data?.map(i => i.categoryId).filter(Boolean))) as string[];
    
    const filteredItems = menuQuery.data?.filter(item => {
        const matchesCategory = !activeCategory || item.categoryId === activeCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch && item.isAvailable;
    });

    const activeTable = tablesQuery.data?.find(t => t.id === cart.tableId);

    const totalAmount = cart.items.reduce((sum, item) => sum + item.subtotal, 0);

    return (
        <div className="flex h-full bg-surface overflow-hidden relative">
            {/* Main POS Content */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-outline-variant">
                {/* Header */}
                <header className="h-[80px] px-8 flex items-center justify-between bg-surface-container-low shrink-0">
                    <div className="flex items-center gap-6">
                        <h1 className="headline-md">POS Interface</h1>
                        <div className="h-8 w-[1px] bg-outline-variant" />
                        <div className="flex items-center gap-3">
                            <span className="label-sm text-on-surface-variant">Active Table:</span>
                            <span className={cn(
                                "h-8 px-4 rounded-full flex items-center justify-center font-bold text-sm",
                                activeTable ? "bg-secondary text-white" : "bg-surface-container-highest text-on-surface-variant"
                            )}>
                                {activeTable ? `Table ${activeTable.number}` : 'No Table Selected'}
                            </span>
                        </div>
                    </div>

                    <div className="relative w-[300px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-11 pl-12 pr-4 rounded-full bg-surface-container-highest border-none text-on-surface placeholder:text-on-surface-variant/30 focus:ring-2 focus:ring-secondary/50 transition-all text-sm"
                        />
                    </div>
                </header>

                {/* Categories Bar */}
                <div className="h-[64px] px-8 flex items-center gap-3 bg-surface shrink-0 overflow-x-auto no-scrollbar border-b border-outline-variant/30">
                    <button 
                        onClick={() => setActiveCategory(null)}
                        className={cn(
                            "h-9 px-6 rounded-full label-sm transition-all whitespace-nowrap",
                            !activeCategory ? "bg-secondary text-white" : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-highest/80"
                        )}
                    >
                        All Items
                    </button>
                    {categories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                                "h-9 px-6 rounded-full label-sm transition-all whitespace-nowrap",
                                activeCategory === cat ? "bg-secondary text-white" : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-highest/80"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Items Grid */}
                <div className="flex-1 overflow-y-auto p-8 pt-6">
                    {menuQuery.isLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                            {Array(15).fill(0).map((_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 translate-y-0 animate-in fade-in duration-500">
                            {filteredItems?.map(item => (
                                <MenuItemCard key={item.id} item={item} onAdd={() => cart.addItem({
                                    menuItemId: item.id,
                                    name: item.name,
                                    quantity: 1,
                                    unitPrice: item.price,
                                    subtotal: item.price
                                })} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar Cart */}
            <aside className="hidden lg:flex w-[400px] flex-col bg-surface-container-low shrink-0 relative">
                <div className="h-[80px] px-6 flex items-center gap-4 border-b border-outline-variant shrink-0">
                    <div className="h-10 w-10 bg-surface-container-highest rounded-xl flex items-center justify-center text-secondary">
                        <ShoppingBag size={20} />
                    </div>
                    <h2 className="headline-md !text-[18px]">Current Order</h2>
                    <div className="ml-auto bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-bold">
                        {cart.items.length} Items
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {cart.items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
                            <ShoppingBag size={64} className="mb-4 stroke-[1px]" />
                            <p className="body-lg font-medium">Your cart is empty</p>
                            <p className="body-sm mt-1">Select items to start an order</p>
                        </div>
                    ) : (
                        cart.items.map(item => (
                            <div key={item.menuItemId} className="flex gap-4 p-4 rounded-2xl bg-surface-container-high/50 hover:bg-surface-container-high transition-all group animate-in slide-in-from-right-4">
                                <div className="flex-1 min-w-0">
                                    <h4 className="body-md font-bold text-on-surface truncate">{item.name}</h4>
                                    <p className="text-secondary font-bold text-sm mt-1">{item.unitPrice} KES</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => cart.updateQuantity(item.menuItemId, -1)}
                                        className="h-8 w-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error transition-all"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="w-6 text-center font-bold text-on-surface">{item.quantity}</span>
                                    <button 
                                        onClick={() => cart.updateQuantity(item.menuItemId, 1)}
                                        className="h-8 w-8 rounded-lg bg-secondary text-white flex items-center justify-center hover:brightness-110 transition-all"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer / Summary */}
                <div className="p-6 bg-surface-container border-t border-outline-variant space-y-4 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
                    <div className="space-y-2">
                        <div className="flex justify-between body-md">
                            <span className="text-on-surface-variant">Subtotal</span>
                            <span className="text-on-surface font-semibold">{totalAmount.toLocaleString()} KES</span>
                        </div>
                        <div className="flex justify-between body-md">
                            <span className="text-on-surface-variant">Tax (16% VAT)</span>
                            <span className="text-on-surface font-semibold">Included</span>
                        </div>
                        <div className="h-[1px] bg-outline-variant my-2" />
                        <div className="flex justify-between items-end">
                            <span className="headline-md !text-[16px]">Total Amount</span>
                            <span className="headline-md !text-[24px] text-secondary">{totalAmount.toLocaleString()} KES</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => cart.clearCart()}
                            disabled={cart.items.length === 0}
                            className="btn-secondary h-[56px] text-error border-error/20 hover:bg-error/5"
                        >
                            <Trash2 size={20} />
                        </button>
                        <button 
                            onClick={() => navigate('/checkout')}
                            disabled={cart.items.length === 0}
                            className="btn-primary h-[56px] flex-1"
                        >
                            <CreditCard size={20} />
                            <span>Charge</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile View Toggle (Floating Action Button) */}
            <button className="lg:hidden fixed bottom-20 right-6 h-16 w-16 rounded-full bg-secondary text-white shadow-2xl flex items-center justify-center z-[60]">
                <ShoppingBag size={24} />
                {cart.items.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-tertiary text-on-tertiary h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-surface">
                        {cart.items.length}
                    </span>
                )}
            </button>
        </div>
    );
}

function MenuItemCard({ item, onAdd }: { item: MenuItem, onAdd: () => void }) {
    return (
        <div className="card-interactive group bg-surface-container-low/40 border-[#2c2c2c] hover:bg-surface-container-low hover:border-outline-variant flex flex-col p-4">
            <div className="aspect-square w-full rounded-2xl bg-surface-container-highest mb-4 flex items-center justify-center relative overflow-hidden">
                <UtensilsCrossed size={48} className="text-on-surface-variant/10 group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute top-3 left-3">
                    <span className="pill-status bg-surface-container-highest/80 backdrop-blur-md border border-outline-variant/30 lowercase italic opacity-60">
                        {item.categoryId}
                    </span>
                </div>
            </div>
            <div className="flex-1">
                <h3 className="body-md font-bold text-on-surface line-clamp-2 leading-tight group-hover:text-secondary transition-colors">{item.name}</h3>
                <p className="body-sm text-on-surface-variant/60 mt-1 line-clamp-1">{item.description || 'No description available'}</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
                <span className="body-md font-black text-on-surface tracking-tight">{item.price} KES</span>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onAdd();
                    }}
                    className="h-10 w-10 rounded-xl bg-secondary text-white flex items-center justify-center shadow-lg shadow-secondary/20 active:scale-95 transition-all hover:brightness-110"
                >
                    <Plus size={20} />
                </button>
            </div>
        </div>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
