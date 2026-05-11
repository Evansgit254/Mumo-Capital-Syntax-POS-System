import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useTenant } from '../../hooks/useTenant';
import { guestService, getErrorMessage } from '../../api/service';
import { 
    Search, 
    CheckCircle2, 
    ArrowRight, 
    ArrowLeft, 
    Loader2, 
    Building2, 
    User, 
    Calendar,
    AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import EmptyState from '../../components/ui/EmptyState';

type Step = 'lookup' | 'confirm' | 'success';

export default function CheckInPage() {
    const [searchParams] = useSearchParams();
    const { guest } = useStore();
    const { tenant, isLoading: isTenantLoading, error: tenantError } = useTenant();
    const [step, setStep] = useState<Step>('lookup');
    const [lookupValue, setLookupValue] = useState('');
    const [reservation, setReservation] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (tenant?.tenantId) {
            guest.setTenantId(tenant.tenantId);
        }
    }, [tenant, guest]);

    const lookupMutation = useMutation({
        mutationFn: (val: string) => {
            // Check if it looks like a UUID or name
            const isId = val.length > 20; 
            return guestService.lookupReservation(isId ? { id: val } : { guestName: val });
        },
        onSuccess: (data) => {
            setReservation(data);
            setStep('confirm');
            setError(null);
        },
        onError: (err) => {
            setError(getErrorMessage(err));
        }
    });

    const checkInMutation = useMutation({
        mutationFn: () => guestService.checkIn(reservation.id),
        onSuccess: (data) => {
            setReservation(data);
            setStep('success');
        },
        onError: (err) => {
            setError(getErrorMessage(err));
        }
    });

    const handleLookup = (e: React.FormEvent) => {
        e.preventDefault();
        if (!lookupValue.trim()) return;
        lookupMutation.mutate(lookupValue);
    };

    if (isTenantLoading) {
        return (
            <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="animate-spin text-secondary mb-4" size={48} />
                <h2 className="headline-md">Loading Check-In Service</h2>
            </div>
        );
    }

    if (tenantError || !tenant) {
        return (
            <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 pb-[20vh] text-center">
                <AlertCircle className="text-error mb-4" size={48} />
                <p className="body-lg text-on-surface-variant max-w-sm">
                    {tenantError || 'Unable to identify hotel system.'}
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface flex flex-col items-center p-6 tablet:p-12">
            {/* Header / Branding */}
            <header className="w-full max-w-[500px] flex flex-col items-center mb-12">
                <div className="h-16 w-16 bg-secondary rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-secondary/20">
                    <Building2 className="text-white" size={32} />
                </div>
                <h1 className="display-lg text-center tracking-tight">Welcome to {tenant.displayName || tenant.tenantName}</h1>
                <p className="body-lg text-on-surface-variant text-center mt-2">Mobile Check-in Experience</p>
            </header>

            {/* Progress Indicator */}
            {step !== 'success' && (
                <div className="w-full max-w-[400px] flex items-center justify-between mb-12 relative">
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-outline-variant z-0" />
                    <ProgressStep active={step === 'lookup'} completed={step === 'confirm'} label="Lookup" />
                    <ProgressStep active={step === 'confirm'} label="Confirm" />
                </div>
            )}

            <main className="w-full max-w-[500px] flex-1 flex flex-col">
                {step === 'lookup' && (
                    <form onSubmit={handleLookup} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h2 className="headline-md tracking-tight">Find your reservation</h2>
                            <p className="body-md text-on-surface-variant">Enter your booking ID or the last name on the reservation.</p>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={24} />
                            <input 
                                type="text"
                                value={lookupValue}
                                onChange={(e) => setLookupValue(e.target.value)}
                                placeholder="e.g. 550e8400... or 'Smith'"
                                className="w-full h-16 pl-14 pr-6 rounded-2xl bg-surface-container border-2 border-transparent focus:border-secondary outline-none display-md !text-lg transition-all"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3 animate-in shake duration-300">
                                <AlertCircle className="text-error shrink-0" size={20} />
                                <p className="label-sm text-error">{error}</p>
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={lookupMutation.isPending || !lookupValue.trim()}
                            className="w-full h-16 bg-on-surface text-surface rounded-2xl font-black tracking-widest flex items-center justify-center gap-3 hover:brightness-90 active:scale-[0.98] transition-all shadow-xl disabled:opacity-50"
                        >
                            {lookupMutation.isPending ? <Loader2 className="animate-spin" /> : <>CONTINUE <ArrowRight size={20} /></>}
                        </button>
                    </form>
                )}

                {step === 'confirm' && reservation && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="space-y-2">
                            <h2 className="headline-md tracking-tight">Confirm Details</h2>
                            <p className="body-md text-on-surface-variant">Please verify the information below before checking in.</p>
                        </div>

                        <div className="card-default !p-8 space-y-6 bg-surface-container-high border-secondary/20">
                            <DetailRow icon={<User size={20} />} label="Guest Name" value={reservation.guestName} />
                            <DetailRow icon={<Calendar size={20} />} label="Arrival" value={new Date(reservation.startTime).toLocaleDateString(undefined, { dateStyle: 'long' })} />
                            <DetailRow icon={<ArrowRight size={20} />} label="Party Size" value={`${reservation.guestCount} People`} />
                            {reservation.table && (
                                <DetailRow icon={<Building2 size={20} />} label="Room/Table" value={`#${reservation.table.number}`} />
                            )}
                        </div>

                        <div className="flex flex-col gap-4">
                            <button 
                                onClick={() => checkInMutation.mutate()}
                                disabled={checkInMutation.isPending}
                                className="w-full h-16 bg-secondary text-white rounded-2xl font-black tracking-widest flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-secondary/20 disabled:opacity-50"
                            >
                                {checkInMutation.isPending ? <Loader2 className="animate-spin" /> : <>CHECK IN NOW <CheckCircle2 size={20} /></>}
                            </button>
                            <button 
                                onClick={() => setStep('lookup')}
                                disabled={checkInMutation.isPending}
                                className="w-full h-16 bg-surface-container text-on-surface rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-surface-container-high transition-all"
                            >
                                <ArrowLeft size={20} /> NOT ME
                            </button>
                        </div>
                    </div>
                )}

                {step === 'success' && (
                    <div className="flex flex-col items-center text-center animate-in zoom-in duration-500 pt-8">
                        <div className="h-24 w-24 bg-secondary/10 rounded-full flex items-center justify-center text-secondary mb-8 border-4 border-secondary/20 animate-bounce">
                            <CheckCircle2 size={48} />
                        </div>
                        <h2 className="display-md mb-4">You're checked in!</h2>
                        <p className="body-lg text-on-surface-variant mb-8 max-w-[320px]">
                            Welcome, {reservation?.guestName}. 
                            {reservation?.table 
                                ? `Your room #${reservation.table.number} is ready for you.`
                                : "Please proceed to the lobby for your table assignment."}
                        </p>
                        <div className="w-full card-default !p-8 bg-surface-container border-2 border-secondary/30 mb-8">
                            <p className="label-sm text-secondary uppercase tracking-widest mb-1">Room Assignment</p>
                            <p className="display-lg">{reservation?.table?.number || '---'}</p>
                        </div>
                        <button 
                            onClick={() => window.location.reload()}
                            className="text-secondary font-bold hover:underline"
                        >
                            Return Home
                        </button>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="w-full max-w-[500px] py-8 text-center mt-auto">
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em]">
                    Powered by Mumo Hospitality Enterprise
                </p>
            </footer>
        </div>
    );
}

function ProgressStep({ active, completed, label }: { active: boolean, completed?: boolean, label: string }) {
    return (
        <div className="flex flex-col items-center gap-2 z-10">
            <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                completed ? "bg-secondary border-secondary text-white" :
                active ? "bg-surface border-secondary text-secondary" : "bg-surface border-outline-variant text-on-surface-variant"
            )}>
                {completed ? <CheckCircle2 size={16} /> : active ? <div className="h-2 w-2 rounded-full bg-secondary" /> : null}
            </div>
            <span className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                active || completed ? "text-secondary" : "text-on-surface-variant"
            )}>{label}</span>
        </div>
    );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant shrink-0">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{label}</p>
                <p className="body-md font-bold text-on-surface truncate">{value}</p>
            </div>
        </div>
    );
}
