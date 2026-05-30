import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orderService, paymentService, tableService, tenantService } from '../api/service';
import { useStore } from '../store/useStore';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../lib/formatCurrency';
import { 
    CreditCard, 
    Banknote, 
    ChevronLeft, 
    CheckCircle2, 
    Loader2, 
    ArrowRight,
    ShoppingBag
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { cart } = useStore();
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CARD');
    const [isSuccess, setIsSuccess] = useState(false);

    const settingsQuery = useQuery({
        queryKey: ['tenant-settings'],
        queryFn: () => tenantService.getSettings(),
    });

    // Retrieve any order notes passed from POS page
    const orderNote = (location.state as { orderNote?: string } | null)?.orderNote || '';

    // DEEP-CRIT-009: Detect if we're settling an existing table (vs POS cart flow)
    const settleState = location.state as { settleTableId?: string; orderIds?: string[]; totalAmount?: number } | null;
    const isTableSettle = !!(settleState?.settleTableId && settleState?.orderIds?.length);

    // Snapshot cart data on mount so clearCart() doesn't zero out display
    const cartSnapshot = useMemo(() => ({
        items: cart.items,
        tableId: cart.tableId,
        totalAmount: cart.items.reduce((sum, item) => sum + item.subtotal, 0),
    }), []); // intentionally empty deps — snapshot on mount only

    const totalAmount = isTableSettle ? (settleState!.totalAmount ?? 0) : cartSnapshot.totalAmount;

    // DEEP-CRIT-008: ALL hooks must be declared before any conditional returns
    // Step 1: Create order on server, Step 2: Create payment
    // FIX-004: Removed fire-and-forget tableService.settle — server handles table release
    const paymentMutation = useMutation({
        mutationFn: paymentService.create,
        onSuccess: () => {
            const tableId = cartSnapshot.tableId;

            setIsSuccess(true);
            cart.clearCart();

            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['tables'] });
            if (tableId) {
                queryClient.invalidateQueries({ queryKey: ['table', tableId] });
                queryClient.invalidateQueries({ queryKey: ['table-orders', tableId] });
            }
            queryClient.invalidateQueries({ queryKey: ['orders-live'] });
        },
        onError: () => {
            toast.error('Payment failed. Please try again.');
        }
    });

    const orderMutation = useMutation({
        mutationFn: orderService.create,
        onSuccess: (order) => {
            paymentMutation.mutate({
                orderId: order.id,
                amount: totalAmount,
                method: paymentMethod,
            });
        },
        onError: () => {
            toast.error('Failed to create order. Please try again.');
        }
    });

    const handleConfirm = () => {
        if (isTableSettle) {
            // DEEP-CRIT-009: Settle existing table orders
            settleTableMutation.mutate();
        } else {
            // Standard POS cart flow
            if (cartSnapshot.items.length === 0) return;
            orderMutation.mutate({
                tableId: cartSnapshot.tableId || undefined,
                items: cartSnapshot.items.map(i => ({ 
                    menuItemId: i.menuItemId, 
                    quantity: i.quantity,
                    notes: i.notes || null,
                    modifiers: i.modifiers || []
                }))
            });
        }
    };

    // FIX-004 (DEEP-CRIT-004): Transactional table settlement via single backend call
    const settleTableMutation = useMutation({
        mutationFn: async () => {
            const tableId = settleState!.settleTableId!;
            const orderIds = settleState!.orderIds!;

            // Single transactional call — server calculates outstanding per order
            await tableService.settleOrders(tableId, {
                orderIds,
                method: paymentMethod,
            });
        },
        onSuccess: () => {
            setIsSuccess(true);
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['tables'] });
            if (settleState?.settleTableId) {
                queryClient.invalidateQueries({ queryKey: ['table', settleState.settleTableId] });
                queryClient.invalidateQueries({ queryKey: ['table-orders', settleState.settleTableId] });
            }
            queryClient.invalidateQueries({ queryKey: ['orders-live'] });
        },
        onError: () => {
            toast.error('Failed to settle table. Please try again.');
        }
    });

    // Conditional renders AFTER all hooks are declared
    // Redirect to POS if there's nothing in the cart AND not a table settle flow
    if (!isTableSettle && cartSnapshot.items.length === 0 && !isSuccess) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6">
                <ShoppingBag size={64} className="text-on-surface-variant/20 mb-4" />
                <h2 className="headline-md mb-2">No items to settle</h2>
                <p className="body-md text-on-surface-variant mb-8">Add items from the POS before proceeding to checkout.</p>
                <button onClick={() => navigate('/pos')} className="btn-primary h-14 px-8">
                    <ArrowRight size={20} />
                    <span>Go to POS</span>
                </button>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="h-full flex items-center justify-center p-6 pb-20">
                <div className="w-full max-w-md text-center animate-in zoom-in-95 duration-500">
                    <div className="h-24 w-24 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                        <CheckCircle2 size={56} />
                    </div>
                    <h1 className="display-lg text-on-surface mb-2">Payment Settled</h1>
                    <p className="body-lg text-on-surface-variant mb-10">Transaction completed successfully. The receipt has been generated.</p>
                    <div className="space-y-3">
                        <button 
                            onClick={() => navigate('/dashboard')}
                            className="btn-primary w-full !h-14"
                        >
                            Back to Dashboard
                        </button>
                        <button 
                            onClick={() => navigate('/pos')}
                            className="btn-secondary w-full !h-14"
                        >
                            New POS Order
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-surface">
            {/* Header */}
            <header className="h-[80px] px-8 flex items-center gap-6 bg-surface-container-low border-b border-outline-variant shrink-0">
                <button 
                    onClick={() => navigate('/pos')}
                    className="h-12 w-12 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface hover:text-secondary transition-all"
                >
                    <ChevronLeft size={24} />
                </button>
                <h1 className="headline-md">Settle Order</h1>
            </header>

            <div className="flex-1 overflow-y-auto p-8 pt-10">
                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Order Summary */}
                    <section className="space-y-6">
                        <h2 className="headline-md !text-[20px] flex items-center gap-2">
                            <ShoppingBag size={20} className="text-secondary" />
                            Order Summary
                        </h2>
                        <div className="card-default border-outline-variant/30 divide-y divide-outline-variant/20 p-0 overflow-hidden">
                            <div className="max-h-[400px] overflow-y-auto p-6 space-y-4">
                                {isTableSettle ? (
                                    <div className="text-center py-4">
                                        <p className="body-md text-on-surface-variant">Settling {settleState!.orderIds!.length} existing order(s) for this table</p>
                                        <p className="headline-md text-secondary mt-2">{formatCurrency(totalAmount, settingsQuery.data?.currency)}</p>
                                    </div>
                                ) : (
                                    cartSnapshot.items.map(item => (
                                        <div key={item.menuItemId} className="flex justify-between items-center group">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-lg bg-surface-container flex items-center justify-center font-bold text-xs text-secondary">
                                                    {item.quantity}x
                                                </div>
                                                <span className="body-md font-medium text-on-surface">{item.name}</span>
                                            </div>
                                            <span className="body-md font-bold text-on-surface-variant tabular-nums">{formatCurrency(item.subtotal, settingsQuery.data?.currency)}</span>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Order Note */}
                            {orderNote && (
                                <div className="px-6 py-4 bg-tertiary/5">
                                    <p className="label-sm text-tertiary font-bold mb-1">Order Note</p>
                                    <p className="body-sm text-on-surface-variant">{orderNote}</p>
                                </div>
                            )}

                            <div className="p-6 bg-surface-container-high/30 space-y-3">
                                <div className="flex justify-between body-md">
                                    <span className="text-on-surface-variant">Subtotal</span>
                                    <span className="text-on-surface font-semibold">{formatCurrency(totalAmount, settingsQuery.data?.currency)}</span>
                                </div>
                                <div className="flex justify-between body-md">
                                    <span className="text-on-surface-variant">Service Charge (0%)</span>
                                    <span className="text-on-surface font-semibold">{formatCurrency(0, settingsQuery.data?.currency)}</span>
                                </div>
                                <div className="pt-3 border-t border-outline-variant flex justify-between items-end">
                                    <span className="headline-md !text-[18px]">Payable Amount</span>
                                    <span className="headline-md !text-[28px] text-secondary tabular-nums">{formatCurrency(totalAmount, settingsQuery.data?.currency)}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Payment Form */}
                    <section className="space-y-8">
                        <div className="space-y-6">
                            <h2 className="headline-md !text-[20px] flex items-center gap-2">
                                <CreditCard size={20} className="text-secondary" />
                                Payment Method
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                <PaymentMethodBtn 
                                    active={paymentMethod === 'CARD'}
                                    onClick={() => setPaymentMethod('CARD')}
                                    icon={CreditCard}
                                    label="Debit / Credit Card"
                                />
                                <PaymentMethodBtn 
                                    active={paymentMethod === 'CASH'}
                                    onClick={() => setPaymentMethod('CASH')}
                                    icon={Banknote}
                                    label="Cash Payment"
                                />
                            </div>
                        </div>

                        {paymentMethod === 'CARD' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="space-y-2">
                                    <label className="label-sm text-on-surface-variant">Swipe or Insert Card</label>
                                    <div className="h-20 border-2 border-dashed border-outline-variant rounded-2xl flex items-center justify-center gap-4 text-on-surface-variant/40">
                                        <Loader2 className="animate-spin" size={24} />
                                        <span className="body-md font-medium italic">Waiting for card terminal response...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-8">
                            <button 
                                onClick={handleConfirm}
                                disabled={orderMutation.isPending || paymentMutation.isPending || settleTableMutation.isPending || (!isTableSettle && cartSnapshot.items.length === 0)}
                                className="btn-primary w-full !h-16 text-lg tracking-wider"
                            >
                                {orderMutation.isPending || paymentMutation.isPending ? (
                                    <Loader2 className="animate-spin" size={24} />
                                ) : (
                                    <>
                                        <span>Confirm & Settle</span>
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function PaymentMethodBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
    return (
        <button 
            onClick={onClick}
            className={[
                "flex flex-col items-center justify-center gap-3 h-32 rounded-2xl border-2 transition-all p-4",
                active 
                    ? "bg-secondary/10 border-secondary text-secondary shadow-[0_0_20px_rgba(0,139,139,0.15)]" 
                    : "bg-surface-container border-outline-variant text-on-surface-variant hover:border-outline"
            ].filter(Boolean).join(' ')}
        >
            <Icon size={32} className="shrink-0" />
            <span className="text-[12px] font-bold uppercase tracking-widest text-center">{label}</span>
        </button>
    );
}
