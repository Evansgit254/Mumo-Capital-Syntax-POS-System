import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { menuService, tableService, tenantService, orderService } from '../api/service';
import { useStore } from '../store/useStore';
import { 
    Search, 
    Plus, 
    Minus, 
    Trash2, 
    CreditCard,
    ShoppingBag,
    UtensilsCrossed,
    WifiOff,
    RefreshCw,
    X,
    AlertTriangle,
    ShoppingCart,
    Clock,
    ChevronRight,
    Wallet,
    Receipt,
    Table as TableIcon,
    Map,
    ChevronLeft,
    FileText,
    LogOut,
    Send
} from 'lucide-react';
import { MenuItem } from '@mumo/types';
import Skeleton from '../components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';
import ModifierModal from '../components/pos/ModifierModal';
import NoteDrawer from '../components/pos/NoteDrawer';
import { cn } from '../lib/utils';
import { useOfflineOrders } from '../hooks/useOfflineOrders';
import { PendingOrder } from '../lib/offlineOrderStore';
import toast from 'react-hot-toast';

export default function POSPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { cart } = useStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modals state
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [isModifierOpen, setIsModifierOpen] = useState(false);
    const [isNoteOpen, setIsNoteOpen] = useState(false);
    const [orderNote, setOrderNote] = useState('');
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

    // Offline resilience
    const {
        hasPendingOrders,
        pendingOrders,
        showOfflineBanner,
        submitOrder,
        retryRecoveredOrder,
        discardRecoveredOrder,
    } = useOfflineOrders();

    const [showRecoveryModal, setShowRecoveryModal] = useState(true);

    const menuQuery = useQuery({
        queryKey: ['menus'],
        queryFn: menuService.getAll,
    });

    const tablesQuery = useQuery({
        queryKey: ['tables'],
        queryFn: tableService.getAll,
    });
    
    const settingsQuery = useQuery({
        queryKey: ['tenant-settings'],
        queryFn: tenantService.getSettings,
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

    // Navigate to checkout with cart intact — checkout handles order creation + payment
    const handleCharge = () => {
        if (cart.items.length === 0) return;
        navigate('/checkout', { state: { orderNote } });
    };

    const handleSendToKitchen = async () => {
        if (cart.items.length === 0) return;
        
        setIsSubmitting(true);
        try {
            await orderService.create({
                tableId: cart.tableId || undefined,
                items: cart.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
            });
            
            toast.success('Order sent to kitchen! 🔥', {
                duration: 4000,
                icon: '👨‍🍳'
            });
            
            // Invalidate relevant queries to update KDS and other views
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['orders-live'] });

            // Let's clear the cart but stay on the page.
            cart.clearCart();
            setOrderNote('');
        } catch (err) {
            toast.error('Failed to send to kitchen. Check your connection.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-full bg-surface overflow-hidden relative">
            {/* ── Offline Banner ───────────────────────────────────── */}
            {showOfflineBanner && (
                <div className="absolute top-0 left-0 right-0 z-[100] animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3 px-6 py-3 bg-amber-600/90 backdrop-blur-md text-white shadow-lg shadow-amber-900/20">
                        <WifiOff size={18} className="shrink-0 animate-pulse" />
                        <p className="body-sm font-medium flex-1">
                            Order saved locally — will sync when connection is restored
                        </p>
                        <RefreshCw size={16} className="shrink-0 animate-spin opacity-60" />
                    </div>
                </div>
            )}

            {/* ── Recovery Modal ───────────────────────────────────── */}
            {hasPendingOrders && showRecoveryModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center">
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowRecoveryModal(false)} 
                    />
                    <div className="relative w-full max-w-lg mx-4 rounded-3xl bg-surface-container-low border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="flex items-center gap-4 px-6 py-5 border-b border-outline-variant bg-surface-container">
                            <div className="h-11 w-11 rounded-2xl bg-amber-500/15 flex items-center justify-center">
                                <AlertTriangle size={22} className="text-amber-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="headline-md !text-[18px]">Unsent Orders Recovered</h2>
                                <p className="body-sm text-on-surface-variant mt-0.5">
                                    {pendingOrders.length} order{pendingOrders.length > 1 ? 's' : ''} saved while offline
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowRecoveryModal(false)}
                                className="h-9 w-9 rounded-xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Order List */}
                        <div className="max-h-[360px] overflow-y-auto p-4 space-y-3">
                            {pendingOrders.map((order) => (
                                <RecoveryOrderCard
                                    key={order.id}
                                    order={order}
                                    currency={settingsQuery.data?.currency || 'KES'}
                                    onRetry={async () => {
                                        const ok = await retryRecoveredOrder(order);
                                        if (ok) navigate('/checkout');
                                    }}
                                    onDiscard={() => discardRecoveredOrder(order.id!)}
                                />
                            ))}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-outline-variant bg-surface-container/50">
                            <p className="body-sm text-on-surface-variant text-center">
                                Orders will auto-retry every 30 seconds while you work
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Main POS Content */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-outline-variant">
                {/* Header */}
                <header className={cn(
                    "h-[80px] px-8 flex items-center justify-between bg-surface-container-low shrink-0",
                    showOfflineBanner && "mt-[44px]"
                )}>
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={() => navigate('/tables')}
                            className="h-12 w-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="headline-md font-bold text-on-surface">
                                Table {activeTable?.number || 'POS'}
                            </h1>
                            <p className="label-sm text-on-surface-variant uppercase tracking-widest">
                                {settingsQuery.data?.currency || 'KES'} • {activeTable ? `Table ${activeTable.number}` : (cart.items.length > 0 ? 'Direct Order' : 'Select Items')}
                            </p>
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
                                "h-9 px-6 rounded-full label-sm transition-all whitespace-nowrap capitalize",
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
                                <MenuItemCard 
                                    key={item.id} 
                                    item={item} 
                                    currency={settingsQuery.data?.currency || 'KES'}
                                    onAdd={() => {
                                        setSelectedItem(item);
                                        setIsModifierOpen(true);
                                    }} 
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar Cart */}
            <aside className="hidden lg:flex w-[400px] flex-col bg-surface-container-low shrink-0 relative">
                <div className={cn(
                    "h-[80px] px-6 flex items-center gap-4 border-b border-outline-variant shrink-0",
                    showOfflineBanner && "mt-[44px]"
                )}>
                    <div className="h-10 w-10 bg-surface-container-highest rounded-xl flex items-center justify-center text-secondary">
                        <ShoppingBag size={20} />
                    </div>
                    <h2 className="headline-md !text-[18px]">Current Order</h2>
                    <button 
                        onClick={() => setIsNoteOpen(true)}
                        className="ml-auto p-2 bg-surface-container-highest rounded-xl text-on-surface-variant hover:text-secondary transition-colors"
                    >
                        <FileText size={20} />
                    </button>
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
                                    <p className="text-secondary font-bold text-sm mt-1">{item.unitPrice} {settingsQuery.data?.currency || 'KES'}</p>
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
                    <span className="text-on-surface font-semibold">{totalAmount.toLocaleString()} {settingsQuery.data?.currency || 'KES'}</span>
                </div>
                <div className="flex justify-between body-md">
                    <span className="text-on-surface-variant">Tax ({settingsQuery.data?.taxRate ?? 16}% VAT)</span>
                    <span className="text-on-surface font-semibold">Included</span>
                </div>
                <div className="h-[1px] bg-outline-variant my-2" />
                <div className="flex justify-between items-end">
                    <span className="headline-md !text-[16px]">Total Amount</span>
                    <span className="headline-md !text-[24px] text-secondary">{totalAmount.toLocaleString()} {settingsQuery.data?.currency || 'KES'}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={handleSendToKitchen}
                    disabled={cart.items.length === 0 || isSubmitting}
                    className="btn-secondary h-[56px] text-tertiary border-tertiary/20 hover:bg-tertiary/5"
                    title="Send to Kitchen"
                >
                    {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
                    <span className="hidden xl:inline">Fire</span>
                </button>
                <button 
                    onClick={handleCharge}
                    disabled={cart.items.length === 0 || isSubmitting}
                    className="btn-primary h-[56px] flex-1"
                >
                    <CreditCard size={20} />
                    <span>Charge</span>
                </button>
            </div>
        </div>
    </aside>

    {/* Mobile View Toggle (Floating Action Button) */}
    <button 
        onClick={() => setIsMobileCartOpen(!isMobileCartOpen)}
        className="lg:hidden fixed bottom-20 right-6 h-16 w-16 rounded-full bg-secondary text-white shadow-2xl flex items-center justify-center z-[60]"
    >
        {isMobileCartOpen ? <X size={24} /> : <ShoppingBag size={24} />}
        {!isMobileCartOpen && cart.items.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-tertiary text-on-tertiary h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-surface">
                {cart.items.length}
            </span>
        )}
    </button>

    {/* Mobile Cart Sheet */}
    {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-[55] flex flex-col">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileCartOpen(false)} />
            <div className="relative mt-auto w-full max-h-[80vh] bg-surface-container-low rounded-t-3xl border-t border-outline-variant flex flex-col animate-in slide-in-from-bottom duration-300">
                <div className="p-6 border-b border-outline-variant flex items-center justify-between">
                    <h2 className="headline-md !text-[18px]">Current Order</h2>
                    <button onClick={() => setIsMobileCartOpen(false)} className="p-2 rounded-xl bg-surface-container-highest"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {cart.items.length === 0 ? (
                        <p className="text-center text-on-surface-variant/40 py-8">Your cart is empty</p>
                    ) : cart.items.map(item => (
                        <div key={item.menuItemId} className="flex gap-4 p-4 rounded-2xl bg-surface-container-high/50">
                            <div className="flex-1 min-w-0">
                                <h4 className="body-md font-bold text-on-surface truncate">{item.name}</h4>
                                <p className="text-secondary font-bold text-sm mt-1">{item.unitPrice} {settingsQuery.data?.currency || 'KES'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => cart.updateQuantity(item.menuItemId, -1)} className="h-8 w-8 rounded-lg bg-surface-container-highest flex items-center justify-center"><Minus size={14} /></button>
                                <span className="w-6 text-center font-bold">{item.quantity}</span>
                                <button onClick={() => cart.updateQuantity(item.menuItemId, 1)} className="h-8 w-8 rounded-lg bg-secondary text-white flex items-center justify-center"><Plus size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-6 bg-surface-container border-t border-outline-variant space-y-4">
                    <div className="flex justify-between headline-md !text-[16px]">
                        <span>Total</span>
                        <span className="text-secondary">{totalAmount.toLocaleString()} {settingsQuery.data?.currency || 'KES'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={handleSendToKitchen} 
                            disabled={cart.items.length === 0 || isSubmitting} 
                            className="btn-secondary h-[56px] text-tertiary"
                        >
                            {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
                            <span>Fire</span>
                        </button>
                        <button onClick={handleCharge} disabled={cart.items.length === 0 || isSubmitting} className="btn-primary h-[56px]"><CreditCard size={20} /><span>Charge</span></button>
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* Modals */}
    {selectedItem && (
        <ModifierModal 
            isOpen={isModifierOpen}
            onClose={() => { setIsModifierOpen(false); setSelectedItem(null); }}
            itemId={selectedItem.id}
            itemName={selectedItem.name}
            onConfirm={(mods) => {
                cart.addItem({
                    menuItemId: selectedItem.id,
                    name: `${selectedItem.name} ${mods.length > 0 ? `(${mods.map(m => m.name).join(', ')})` : ''}`,
                    quantity: 1,
                    unitPrice: selectedItem.price + mods.reduce((s, m) => s + m.price, 0),
                    subtotal: selectedItem.price + mods.reduce((s, m) => s + m.price, 0)
                });
            }}
        />
    )}

    <NoteDrawer 
        isOpen={isNoteOpen}
        onClose={() => setIsNoteOpen(false)}
        note={orderNote}
        onSave={(note) => setOrderNote(note)}
    />
</div>
);
}

// ── Recovery Order Card ─────────────────────────────────────────────────────
function RecoveryOrderCard({ 
order, 
onRetry, 
onDiscard,
currency 
}: { 
order: PendingOrder; 
onRetry: () => void; 
onDiscard: () => void;
currency: string;
}) {
const savedDate = new Date(order.savedAt);
const timeAgo = getTimeAgo(savedDate);
const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
const total = order.items.reduce((sum, i) => sum + i.subtotal, 0);

return (
<div className="rounded-2xl border border-outline-variant/50 bg-surface-container-high/30 p-4 space-y-3">
    <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
            <p className="body-md font-bold text-on-surface">
                {itemCount} item{itemCount !== 1 ? 's' : ''} · {total.toLocaleString()} {currency}
            </p>
            <p className="body-sm text-on-surface-variant mt-0.5">
                Saved {timeAgo}{order.tableId ? ` · Table order` : ''}
            </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
            <button
                onClick={onDiscard}
                className="h-9 px-4 rounded-xl bg-surface-container-highest text-on-surface-variant label-sm hover:bg-error/10 hover:text-error transition-all"
            >
                Discard
            </button>
            <button
                onClick={onRetry}
                className="h-9 px-4 rounded-xl bg-secondary text-white label-sm hover:brightness-110 transition-all flex items-center gap-1.5"
            >
                <RefreshCw size={14} />
                Retry
            </button>
        </div>
    </div>
    
    {/* Item preview */}
    <div className="flex flex-wrap gap-1.5">
        {order.items.slice(0, 4).map((item, idx) => (
            <span key={idx} className="px-2.5 py-1 rounded-lg bg-surface-container-highest text-on-surface-variant text-[11px] font-medium">
                {item.quantity}× {item.name}
            </span>
        ))}
        {order.items.length > 4 && (
            <span className="px-2.5 py-1 rounded-lg bg-surface-container-highest text-on-surface-variant text-[11px] font-medium">
                +{order.items.length - 4} more
            </span>
        )}
    </div>
</div>
);
}

// ── Menu Item Card ──────────────────────────────────────────────────────────
function MenuItemCard({ item, onAdd, currency }: { item: MenuItem, onAdd: () => void, currency: string }) {
return (
<div className="card-interactive group bg-surface-container-low/40 border-[var(--surface-bright)] hover:bg-surface-container-low hover:border-outline-variant flex flex-col p-4">
    <div className="aspect-square w-full rounded-2xl bg-surface-container-highest mb-4 flex items-center justify-center relative overflow-hidden">
        <UtensilsCrossed size={48} className="text-on-surface-variant/10 group-hover:scale-110 transition-transform duration-500" />
        {item.categoryId && (
            <div className="absolute top-3 left-3">
                <span className="pill-status bg-surface-container-highest/80 backdrop-blur-md border border-outline-variant/30 lowercase italic opacity-60">
                    {item.categoryId}
                </span>
            </div>
        )}
    </div>
    <div className="flex-1">
        <h3 className="body-md font-bold text-on-surface line-clamp-2 leading-tight group-hover:text-secondary transition-colors">{item.name}</h3>
        <p className="body-sm text-on-surface-variant/60 mt-1 line-clamp-1">{item.description || 'No description available'}</p>
    </div>
    <div className="mt-4 flex items-center justify-between">
        <span className="body-md font-black text-on-surface tracking-tight">{item.price} {currency}</span>
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

// ── Helpers ─────────────────────────────────────────────────────────────────
type LooseValue = any;

function getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
