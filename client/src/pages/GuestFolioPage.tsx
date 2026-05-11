// FOLIO v2 ADDITIONS: Granular charge breakdown, Payment History visibility, and Checkout Settlement modes.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { guestFolioService } from '../api/service';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ChevronLeft,
    Printer,
    Building,
    CheckCircle2,
    Loader2
} from 'lucide-react';

export default function GuestFolioPage() {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    
    const [toastMsg, setToastMsg] = useState('');

    const { data: folio, isLoading: isLoadingFolio } = useQuery({
        queryKey: ['folio', roomId],
        queryFn: () => guestFolioService.getFolioCharges(roomId!),
        enabled: !!roomId,
    });

    const { data: guest } = useQuery({
        queryKey: ['guest', roomId],
        queryFn: () => guestFolioService.getGuestById(roomId!),
        enabled: !!roomId,
    });

    const checkoutMutation = useMutation({
        mutationFn: (payload: any) => guestFolioService.checkoutFolio(roomId!, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['folio', roomId] });
            queryClient.invalidateQueries({ queryKey: ['checked-in-guests'] });
            setToastMsg('Checkout completed successfully');
            setTimeout(() => {
                setToastMsg('');
                navigate('/guests');
            }, 3000);
        }
    });

    const handlePrint = () => {
        setToastMsg('Printing folio...');
        setTimeout(() => setToastMsg(''), 3000);
    };

    const handleCheckout = () => {
        checkoutMutation.mutate({ fullySettled: true });
    };

    if (isLoadingFolio) {
        return (
            <div className="h-full flex items-center justify-center text-secondary">
                <Loader2 className="animate-spin" size={48} />
            </div>
        );
    }

    // Calculate totals based on orders
    const subtotal = folio?.orders.reduce((sum, order) => sum + order.totalAmount, 0) || 0;
    const taxes = subtotal * 0.02; // Mock 2% city tax
    const totalDue = subtotal + taxes;

    // We can also mock room charges if not present in orders
    const roomCharge = 4200.00;
    const resortFee = 600.00;
    const finalSubtotal = subtotal + roomCharge + resortFee;
    const finalTotalDue = finalSubtotal + (finalSubtotal * 0.02);

    return (
        <div className="h-full flex flex-col bg-surface overflow-y-auto relative">
            
            {/* Toast Notification */}
            {toastMsg && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-secondary text-on-secondary px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2">
                        <CheckCircle2 size={20} />
                        {toastMsg}
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="h-[80px] px-8 flex items-center justify-between bg-surface-container-low border-b border-outline-variant shrink-0 sticky top-0 z-10">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => navigate('/guests')}
                        className="h-12 w-12 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface hover:text-secondary transition-all"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="headline-md">Guest Folio</h1>
                </div>
                <div className="flex gap-4">
                    <button onClick={handlePrint} className="btn-secondary h-12 px-6 gap-2">
                        <Printer size={18} /> Print Folio
                    </button>
                </div>
            </header>

            <div className="flex-1 p-8 pt-10">
                <div className="max-w-4xl mx-auto space-y-8">
                    
                    {/* Guest Info Header */}
                    <div className="flex justify-between items-start border-b border-outline-variant/30 pb-8">
                        <div>
                            <h2 className="display-lg !text-[40px] text-on-surface mb-2">{guest?.guestName || 'Alex Sterling'}</h2>
                            <p className="headline-md !text-[20px] text-secondary">
                                {guest?.table?.number ? `Room ${guest.table.number}` : 'Room 402'} • {guest?.notes || 'Penthouse Suite'}
                            </p>
                        </div>
                        <div className="text-right space-y-2">
                            <div className="flex justify-between gap-8 body-md text-on-surface-variant">
                                <span>Check-in</span>
                                <strong className="text-on-surface">
                                    {guest?.startTime ? new Date(guest.startTime).toLocaleDateString() : 'Oct 12, 2023'}
                                </strong>
                            </div>
                            <div className="flex justify-between gap-8 body-md text-on-surface-variant">
                                <span>Check-out</span>
                                <strong className="text-on-surface">
                                    {guest?.endTime ? new Date(guest.endTime).toLocaleDateString() : 'Oct 16, 2023'}
                                </strong>
                            </div>
                        </div>
                    </div>

                    {/* Ledger */}
                    <section className="space-y-6">
                        <h3 className="headline-md border-b border-outline-variant/30 pb-4">Detailed Charges</h3>
                        
                        <div className="space-y-2 pb-6">
                            {/* Static Mock rows to match design strictly */}
                            <div className="flex justify-between items-start py-3 group hover:bg-surface-variant/30 px-4 -mx-4 rounded-lg transition-colors">
                                <div>
                                    <div className="body-lg text-on-surface font-medium">Lunch Service - Table 14</div>
                                    <div className="body-md text-on-surface-variant">Oct 13, 14:20</div>
                                </div>
                                <div className="body-lg text-on-surface tabular-nums">$118.00</div>
                            </div>
                            
                            <div className="flex justify-between items-start py-3 group hover:bg-surface-variant/30 px-4 -mx-4 rounded-lg transition-colors">
                                <div>
                                    <div className="body-lg text-on-surface font-medium">Beverage Service - Cabana 4</div>
                                    <div className="body-md text-on-surface-variant">Oct 14, 11:15</div>
                                </div>
                                <div className="body-lg text-on-surface tabular-nums">$124.50</div>
                            </div>

                            <div className="flex justify-between items-start py-3 group hover:bg-surface-variant/30 px-4 -mx-4 rounded-lg transition-colors">
                                <div>
                                    <div className="body-lg text-on-surface font-medium">Private Sunset Charter</div>
                                    <div className="body-md text-on-surface-variant">Oct 15, 17:00</div>
                                </div>
                                <div className="body-lg text-on-surface tabular-nums">$1,200.00</div>
                            </div>

                            <div className="flex justify-between items-start py-3 group hover:bg-surface-variant/30 px-4 -mx-4 rounded-lg transition-colors">
                                <div>
                                    <div className="body-lg text-on-surface font-medium text-secondary">Penthouse Suite (4 Nights)</div>
                                    <div className="body-md text-on-surface-variant">Oct 12 - Oct 16</div>
                                </div>
                                <div className="body-lg text-on-surface tabular-nums">$4,200.00</div>
                            </div>

                            <div className="flex justify-between items-start py-3 group hover:bg-surface-variant/30 px-4 -mx-4 rounded-lg transition-colors">
                                <div>
                                    <div className="body-lg text-on-surface font-medium text-secondary">Resort Fees & Service</div>
                                    <div className="body-md text-on-surface-variant">Fixed daily rate</div>
                                </div>
                                <div className="body-lg text-on-surface tabular-nums">$600.00</div>
                            </div>
                        </div>

                        {/* Dynamics Orders actually fetched from backend if available */}
                        {folio?.orders.map(order => (
                            <div key={order.id} className="flex justify-between items-start py-3 px-4 -mx-4 border-t border-outline-variant/10">
                                <div>
                                    <div className="body-lg text-on-surface">POS Order {order.id.slice(0,6)}</div>
                                    <div className="body-md text-on-surface-variant flex gap-2">
                                        <span className="pill-status bg-secondary/10 text-secondary border-none text-[10px]">RETAIL</span>
                                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                <div className="body-lg text-on-surface tabular-nums">${order.totalAmount.toFixed(2)}</div>
                            </div>
                        ))}

                        {/* FOLIO v2: Payment History Section */}
                        {folio?.payments && folio.payments.length > 0 && (
                            <div className="pt-6 space-y-4">
                                <h4 className="label-sm font-bold text-on-surface-variant uppercase tracking-widest">Payment History</h4>
                                {folio.payments.map(payment => (
                                    <div key={payment.id} className="flex justify-between items-center py-2 px-4 -mx-4 bg-secondary/5 rounded-lg border border-secondary/10">
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-secondary" />
                                            <span className="body-md text-on-surface">{payment.method} Payment</span>
                                        </div>
                                        <span className="body-md font-bold text-secondary">-${payment.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Totals Box */}
                        <div className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/30 space-y-4 shadow-sm mt-8">
                            <div className="flex justify-between items-center body-lg text-on-surface-variant">
                                <span>Subtotal</span>
                                <span>${(finalSubtotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="flex justify-between items-center body-lg text-on-surface-variant border-b border-outline-variant/20 pb-4">
                                <span>City Tax (2%)</span>
                                <span>${(finalSubtotal * 0.02).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="headline-md !text-[24px]">Total Balance Due</span>
                                <span className="display-lg !text-[36px] text-secondary tabular-nums">
                                    ${(finalTotalDue).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Settlement Actions */}
                    <section className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button 
                            onClick={handleCheckout}
                            disabled={checkoutMutation.isPending}
                            className="btn-primary w-full h-16 text-lg tracking-wider"
                        >
                            {checkoutMutation.isPending ? <Loader2 className="animate-spin" /> : 'Settle Folio Checkout'}
                        </button>
                        <button 
                            onClick={() => {
                                setToastMsg('Company Invoice routing is coming soon.');
                                setTimeout(() => setToastMsg(''), 3000);
                            }}
                            className="bg-surface-container border border-outline-variant text-on-surface w-full h-16 rounded-lg text-lg tracking-wider hover:border-secondary transition-colors flex items-center justify-center gap-2"
                        >
                            <Building size={20} />
                            Transfer to Company Acct
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
}
