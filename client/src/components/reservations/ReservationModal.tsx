import { useState } from 'react';
import { X, Calendar, Users, Clock, Loader2, Phone, User, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ReservationModalProps {
    type: 'booking' | 'waitlist';
    onClose: () => void;
    onSubmit: (data: any) => void;
    isPending?: boolean;
}

export default function ReservationModal({ type, onClose, onSubmit, isPending }: ReservationModalProps) {
    const [form, setForm] = useState({
        guestName: '',
        phoneNumber: '',
        guestCount: 2,
        startTime: type === 'booking' ? '' : new Date().toISOString(),
        notes: '',
        status: type === 'booking' ? 'CONFIRMED' : 'WAITLIST'
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (!form.guestName.trim()) errs.guestName = 'Name is required';
        if (!form.phoneNumber.trim()) errs.phoneNumber = 'Phone is required';
        if (type === 'booking' && !form.startTime) errs.startTime = 'Time is required';

        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        onSubmit(form);
    };

    return (
        <div className="fixed inset-0 bg-surface/90 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-lg card-default shadow-2xl animate-in zoom-in-95 duration-300 bg-surface-container border-outline-variant/30">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="headline-md capitalize">{type === 'booking' ? 'New Reservation' : 'Add to Waitlist'}</h2>
                        <p className="body-sm text-on-surface-variant">Collect guest details for {type === 'booking' ? 'future service' : 'walk-in queue'}.</p>
                    </div>
                    <button onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="label-sm text-on-surface-variant flex items-center gap-2">
                                <User size={14} /> Guest Name
                            </label>
                            <input 
                                type="text"
                                value={form.guestName}
                                onChange={e => setForm({ ...form, guestName: e.target.value })}
                                placeholder="e.g. John Doe"
                                className={cn("input-field bg-surface-container-highest", errors.guestName && "border-error focus:ring-error/20")}
                                autoFocus
                            />
                            {errors.guestName && <p className="text-xs text-error font-medium">{errors.guestName}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="label-sm text-on-surface-variant flex items-center gap-2">
                                <Phone size={14} /> Phone Number
                            </label>
                            <input 
                                type="tel"
                                value={form.phoneNumber}
                                onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
                                placeholder="+254 7..."
                                className={cn("input-field bg-surface-container-highest", errors.phoneNumber && "border-error focus:ring-error/20")}
                            />
                            {errors.phoneNumber && <p className="text-xs text-error font-medium">{errors.phoneNumber}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="label-sm text-on-surface-variant flex items-center gap-2">
                                    <Users size={14} /> Party Size
                                </label>
                                <div className="flex items-center gap-2 bg-surface-container-highest rounded-xl p-1 border border-outline-variant/30">
                                    <button 
                                        type="button"
                                        onClick={() => setForm({ ...form, guestCount: Math.max(1, form.guestCount - 1) })}
                                        className="h-10 w-10 rounded-lg hover:bg-white/5 flex items-center justify-center"
                                    >
                                        -
                                    </button>
                                    <span className="flex-1 text-center font-black">{form.guestCount}</span>
                                    <button 
                                        type="button"
                                        onClick={() => setForm({ ...form, guestCount: form.guestCount + 1 })}
                                        className="h-10 w-10 rounded-lg hover:bg-white/5 flex items-center justify-center"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {type === 'booking' && (
                                <div className="space-y-2">
                                    <label className="label-sm text-on-surface-variant flex items-center gap-2">
                                        <Clock size={14} /> Select Time
                                    </label>
                                    <input 
                                        type="datetime-local"
                                        value={form.startTime}
                                        onChange={e => setForm({ ...form, startTime: e.target.value })}
                                        className={cn("input-field bg-surface-container-highest", errors.startTime && "border-error focus:ring-error/20")}
                                    />
                                    {errors.startTime && <p className="text-xs text-error font-medium">{errors.startTime}</p>}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="label-sm text-on-surface-variant flex items-center gap-2">
                                <MessageSquare size={14} /> Notes (Optional)
                            </label>
                            <textarea 
                                value={form.notes}
                                onChange={e => setForm({ ...form, notes: e.target.value })}
                                placeholder="Dietary requirements, preferred table, etc."
                                className="input-field bg-surface-container-highest min-h-[100px] py-3"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 h-12 rounded-xl border border-outline-variant text-on-surface-variant font-bold hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isPending}
                            className="flex-1 h-12 rounded-xl bg-secondary text-white font-black tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-secondary/20 flex items-center justify-center gap-2"
                        >
                            {isPending ? <Loader2 className="animate-spin" size={20} /> : (type === 'booking' ? 'CONFIRM BOOKING' : 'JOIN WAITLIST')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
