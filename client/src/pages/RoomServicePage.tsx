import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { guestService, getErrorMessage } from '../api/service';
import { 
    UtensilsCrossed, 
    ShoppingCart, 
    ChevronRight, 
    Plus, 
    Minus, 
    X, 
    Clock, 
    CheckCircle2, 
    Search,
    Loader2,
    ChefHat,
    Building2,
    AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

type Step = 'room-entry' | 'menu' | 'summary' | 'success';

interface CartItem {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
}

export default function RoomServicePage() {
    const [searchParams] = useSearchParams();
    const { guest } = useStore();
    const [step, setStep] = useState<Step>('room-entry');
    const [roomNumber, setRoomNumber] = useState('');
    const [selectedRoom, setSelectedRoom] = useState<any>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const tid = searchParams.get('tenantId');
        if (tid) {
            guest.setTenantId(tid);
        }
    }, [searchParams, guest]);

    // Fetch all rooms (tables) publicly
    const roomsQuery = useQuery({
        queryKey: ['public-rooms'],
        queryFn: guestService.getRooms
    });

    const menuQuery = useQuery({
        queryKey: ['public-menu'],
        queryFn: guestService.getMenu,
        enabled: step === 'menu'
    });

    const orderMutation = useMutation({
        mutationFn: () => guestService.placeOrder({
            tableId: selectedRoom.id,
            items: cart.map(item => ({ menuItemId: item.menuItemId, quantity: item.quantity }))
        }),
        onSuccess: () => {
            setStep('success');
            setCart([]);
        },
        onError: (err) => {
            setError(getErrorMessage(err));
        }
    });

    const handleRoomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const room = roomsQuery.data?.find(t => t.number === roomNumber);
        if (room) {
            setSelectedRoom(room);
            setStep('menu');
            setError(null);
        } else {
            setError('Valid room number not found. Please try again or contact the front desk.');
        }
    };

    const addToCart = (item: any) => {
        setCart(prev => {
            const existing = prev.find(i => i.menuItemId === item.id);
            if (existing) {
                return prev.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
        });
    };

    const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);

    return (
        <div className="min-h-screen bg-surface flex flex-col max-w-[500px] mx-auto border-x border-outline-variant/30">
            {/* Minimal Header */}
            <header className="h-[80px] bg-surface flex items-center justify-between px-6 border-b border-outline-variant/30 sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-secondary rounded-xl flex items-center justify-center text-white">
                        <UtensilsCrossed size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-on-surface leading-none">Mumo Dining</h1>
                        {selectedRoom && <p className="text-[10px] text-secondary font-black uppercase tracking-widest mt-1">Room {selectedRoom.number}</p>}
                    </div>
                </div>
                {cart.length > 0 && step === 'menu' && (
                    <button 
                        onClick={() => setStep('summary')}
                        className="relative h-10 w-10 rounded-full bg-on-surface text-surface flex items-center justify-center animate-in zoom-in"
                    >
                        <ShoppingCart size={18} />
                        <span className="absolute -top-1 -right-1 h-5 w-5 bg-secondary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-surface">
                            {cart.reduce((s, i) => s + i.quantity, 0)}
                        </span>
                    </button>
                )}
            </header>

            <main className="flex-1 flex flex-col p-6 overflow-y-auto">
                {step === 'room-entry' && (
                    <form onSubmit={handleRoomSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 my-auto">
                        <div className="flex flex-col items-center text-center">
                            <div className="h-20 w-20 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant mb-6">
                                <Building2 size={32} />
                            </div>
                            <h2 className="display-md mb-2">Identify your room</h2>
                            <p className="body-md text-on-surface-variant">Please enter your room number to access the digital menu.</p>
                        </div>

                        <div className="space-y-4">
                            <input 
                                type="text"
                                value={roomNumber}
                                onChange={(e) => setRoomNumber(e.target.value)}
                                placeholder="Room Number (e.g. 101)"
                                className="w-full h-16 px-6 text-center rounded-2xl bg-surface-container border-2 border-transparent focus:border-secondary outline-none display-lg tracking-widest transition-all"
                                autoFocus
                            />
                            {error && (
                                <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
                                    <AlertCircle className="text-error shrink-0" size={18} />
                                    <p className="text-xs text-error font-medium">{error}</p>
                                </div>
                            )}
                        </div>

                        <button 
                            type="submit"
                            disabled={roomsQuery.isLoading || !roomNumber}
                            className="w-full h-16 bg-on-surface text-surface rounded-2xl font-black tracking-widest flex items-center justify-center gap-3"
                        >
                            {roomsQuery.isLoading ? <Loader2 className="animate-spin" /> : "ENTER MENU"}
                        </button>
                    </form>
                )}

                {step === 'menu' && (
                    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
                        {menuQuery.isLoading ? (
                            <div className="space-y-6">
                                <Skeleton className="h-6 w-32" />
                                <div className="grid gap-4">
                                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
                                </div>
                            </div>
                        ) : menuQuery.data?.length === 0 ? (
                            <div className="my-auto">
                                <EmptyState 
                                    icon={<ChefHat size={48} />}
                                    title="Kitchen is closed"
                                    description="Our room service team is currently resting. Please check back later."
                                />
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <h2 className="display-sm">Today's Selection</h2>
                                <div className="grid gap-6">
                                    {menuQuery.data?.map(item => (
                                        <div key={item.id} className="card-default !p-0 overflow-hidden bg-surface-container-low flex h-[120px] hover:border-secondary/30 transition-colors group">
                                            <div className="w-[120px] bg-surface-container-highest flex items-center justify-center shrink-0">
                                                <UtensilsCrossed size={32} className="text-on-surface-variant/20" />
                                            </div>
                                            <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                                                <div>
                                                    <h4 className="body-md font-bold text-on-surface truncate pr-8">{item.name}</h4>
                                                    <p className="text-[10px] text-on-surface-variant line-clamp-2 mt-1 leading-tight">{item.description}</p>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="font-black text-secondary">KES {item.price.toLocaleString()}</span>
                                                    <button 
                                                        onClick={() => addToCart(item)}
                                                        className="h-10 w-10 rounded-full bg-on-surface text-surface flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-lg"
                                                    >
                                                        <Plus size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === 'summary' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-500">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setStep('menu')} className="h-12 w-12 rounded-full border border-outline-variant flex items-center justify-center text-on-surface">
                                <Minus size={18} />
                            </button>
                            <h2 className="display-sm">Checkout</h2>
                        </div>

                        <div className="space-y-4">
                            {cart.map(item => (
                                <div key={item.menuItemId} className="flex items-center justify-between p-4 bg-surface-container rounded-2xl border border-outline-variant/30">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-surface-container-high flex items-center justify-center font-bold text-secondary">{item.quantity}x</div>
                                        <div>
                                            <p className="body-md font-bold text-on-surface">{item.name}</p>
                                            <p className="text-xs text-on-surface-variant">KES {item.price.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setCart(c => c.filter(i => i.menuItemId !== item.menuItemId))}
                                        className="text-on-surface-variant/40 hover:text-error transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="card-default !p-6 bg-secondary/5 border-secondary/20 space-y-4 mt-8">
                            <div className="flex items-center justify-between text-on-surface">
                                <span className="label-sm opacity-60">Subtotal</span>
                                <span className="body-md font-bold">KES {cartTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-on-surface">
                                <span className="label-sm opacity-60">Delivery Fee</span>
                                <span className="body-md font-bold text-secondary">Free</span>
                            </div>
                            <div className="h-px bg-outline-variant" />
                            <div className="flex items-center justify-between text-on-surface pt-2">
                                <span className="headline-sm">Total</span>
                                <span className="display-sm text-secondary">KES {cartTotal.toLocaleString()}</span>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
                                <AlertCircle className="text-error shrink-0" size={18} />
                                <p className="text-xs text-error font-medium">{error}</p>
                            </div>
                        )}

                        <button 
                            onClick={() => orderMutation.mutate()}
                            disabled={orderMutation.isPending || cart.length === 0}
                            className="w-full h-16 bg-on-surface text-surface rounded-2xl font-black tracking-widest flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {orderMutation.isPending ? <Loader2 className="animate-spin" /> : "PLACE ORDER"}
                        </button>
                    </div>
                )}

                {step === 'success' && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
                        <div className="h-24 w-24 bg-secondary/10 rounded-full flex items-center justify-center text-secondary mb-8 border-4 border-secondary/20">
                            <CheckCircle2 size={48} />
                        </div>
                        <h2 className="display-md mb-2">Order Received</h2>
                        <p className="body-lg text-on-surface-variant mb-12">
                            Your meal is being prepared and will be delivered to room 
                            <span className="text-on-surface font-black"> {selectedRoom?.number} </span> 
                            shortly.
                        </p>
                        
                        <div className="w-full card-default !p-8 bg-surface-container border-2 border-secondary/20 mb-8 flex flex-col items-center gap-4">
                            <div className="flex items-center gap-3 text-secondary font-black uppercase tracking-[0.2em] text-[10px]">
                                <Clock size={14} /> Est. Delivery: 25-35 mins
                            </div>
                            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-4">Order Reference</p>
                            <p className="headline-md font-mono">#RM-{Math.random().toString(36).substring(7).toUpperCase()}</p>
                        </div>

                        <button 
                            onClick={() => setStep('menu')}
                            className="btn-secondary h-14 w-full"
                        >
                            ORDER MORE
                        </button>
                    </div>
                )}
            </main>

            <footer className="h-[64px] flex items-center justify-center border-t border-outline-variant/30 text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em]">
                Secure Guest Portal
            </footer>
        </div>
    );
}
