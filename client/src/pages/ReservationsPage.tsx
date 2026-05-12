import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService, getErrorMessage } from '../api/service';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { 
    Calendar, 
    Users, 
    Clock, 
    Plus, 
    Search,
    Filter,
    CheckCircle2,
    XCircle,
    MoreHorizontal,
    MoreVertical,
    Bell,
    UserCircle,
    UserPlus,
    Loader2,
    Table as TableIcon,
    Edit2,
    Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import FormField from '../components/ui/FormField';
import ReservationModal from '../components/reservations/ReservationModal';

type Tab = 'reservations' | 'waitlist';

export default function ReservationsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('reservations');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [modalType, setModalType] = useState<'booking' | 'waitlist' | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Fetch Reservations for selected date
    const reservationsQuery = useQuery({
        queryKey: ['reservations', selectedDate],
        queryFn: () => reservationService.getAll({ date: selectedDate }),
        enabled: activeTab === 'reservations',
    });

    // Fetch Waitlist
    const waitlistQuery = useQuery({
        queryKey: ['waitlist'],
        queryFn: reservationService.getWaitlist,
        enabled: activeTab === 'waitlist',
    });

    const checkInMutation = useMutation({
        mutationFn: reservationService.checkIn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
            queryClient.invalidateQueries({ queryKey: ['waitlist'] });
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    const cancelMutation = useMutation({
        mutationFn: reservationService.cancel,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
            queryClient.invalidateQueries({ queryKey: ['waitlist'] });
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    const createMutation = useMutation({
        mutationFn: reservationService.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
            queryClient.invalidateQueries({ queryKey: ['waitlist'] });
            setModalType(null);
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    return (
        <div className="flex flex-col h-full bg-surface" onClick={() => setOpenMenuId(null)}>
            {/* Header */}
            <div className="p-6 tablet:p-10 pb-0 space-y-8">
                <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-6">
                    <div>
                        <h1 className="display-lg text-on-surface">Reservations</h1>
                        <p className="body-lg text-on-surface-variant">Manage guest bookings and walk-in waitlist.</p>
                    </div>
                    <button 
                        onClick={() => setModalType('booking')}
                        className="btn-primary w-full tablet:w-auto h-14 tablet:h-12 px-8"
                    >
                        <Plus size={20} />
                        NEW BOOKING
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-outline-variant">
                    <TabButton 
                        active={activeTab === 'reservations'} 
                        onClick={() => setActiveTab('reservations')}
                        label="Reservations"
                        count={reservationsQuery.data?.length}
                    />
                    <TabButton 
                        active={activeTab === 'waitlist'} 
                        onClick={() => setActiveTab('waitlist')}
                        label="Waitlist"
                        count={waitlistQuery.data?.length}
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 tablet:p-10 pt-4">
                {activeTab === 'reservations' ? (
                    <div className="space-y-6">
                        {/* Filters */}
                        <div className="flex gap-4 mb-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search by name or phone..." 
                                    className="input-field pl-12 bg-surface-container"
                                />
                            </div>
                            <input 
                                type="date" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="input-field w-auto tablet:w-48 bg-surface-container-high border-secondary"
                            />
                        </div>

                        {reservationsQuery.isLoading ? (
                            <Skeleton className="h-64 rounded-2xl" />
                        ) : reservationsQuery.data?.length === 0 ? (
                            <EmptyState 
                                icon={<Calendar size={32} />}
                                title="No reservations for this date"
                                description="Select another date or add a new booking to this schedule."
                            />
                        ) : (
                            <div className="space-y-3">
                                {reservationsQuery.data?.map(res => (
                                    <ReservationItem 
                                        key={res.id} 
                                        reservation={res} 
                                        onCheckIn={() => checkInMutation.mutate(res.id)}
                                        onCancel={() => cancelMutation.mutate(res.id)}
                                        isProcessing={checkInMutation.isPending}
                                        openMenuId={openMenuId}
                                        setOpenMenuId={setOpenMenuId}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {waitlistQuery.isLoading ? (
                            <Skeleton className="h-64 rounded-2xl" />
                        ) : waitlistQuery.data?.length === 0 ? (
                            <EmptyState 
                                icon={<Users size={32} />}
                                title="Waitlist is empty"
                                description="Handle walk-in guests by adding them to the priority queue."
                                action={
                                    <button 
                                        onClick={() => setModalType('waitlist')}
                                        className="btn-secondary"
                                    >
                                        <Plus size={20} />
                                        ADD WALK-IN
                                    </button>
                                }
                            />
                        ) : (
                            <div className="space-y-3">
                                {waitlistQuery.data?.map((res, idx) => (
                                    <WaitlistItem 
                                        key={res.id} 
                                        index={idx}
                                        reservation={res}
                                        onCheckIn={() => checkInMutation.mutate(res.id)}
                                        isProcessing={checkInMutation.isPending}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {modalType && (
                <ReservationModal 
                    type={modalType}
                    onClose={() => setModalType(null)}
                    onSubmit={(data) => createMutation.mutate(data)}
                    isPending={createMutation.isPending}
                />
            )}
        </div>
    );
}

function TabButton({ active, label, count, onClick }: { active: boolean, label: string, count?: number, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "px-8 py-4 label-sm text-[13px] border-b-2 transition-all flex items-center gap-3",
                active ? "border-secondary text-secondary" : "border-transparent text-on-surface-variant hover:text-on-surface"
            )}
        >
            {label}
            {count !== undefined && (
                <span className={cn(
                    "h-6 min-w-[24px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-black",
                    active ? "bg-secondary text-white" : "bg-surface-container-highest text-on-surface-variant"
                )}>
                    {count}
                </span>
            )}
        </button>
    );
}

function ReservationItem({ 
    reservation, 
    onCheckIn, 
    onCancel, 
    isProcessing,
    openMenuId,
    setOpenMenuId
}: { 
    reservation: LooseValue, 
    onCheckIn: () => void, 
    onCancel: () => void, 
    isProcessing: boolean,
    openMenuId: string | null,
    setOpenMenuId: (id: string | null) => void 
}) {
    const time = new Date(reservation.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return (
        <div className="card-default !p-6 flex flex-col tablet:flex-row tablet:items-center gap-6 group hover:bg-[var(--surface-bright)]">
            <div className="flex-1 flex items-center gap-6">
                <div className="h-14 w-14 rounded-2xl bg-surface-container-high flex flex-col items-center justify-center text-secondary border border-outline-variant group-hover:border-secondary transition-all">
                    <Clock size={18} className="mb-0.5" />
                    <span className="text-xs font-black tracking-tighter">{time}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <UserCircle size={16} className="text-on-surface-variant" />
                        <h4 className="body-lg font-bold text-on-surface truncate tracking-tight">{reservation.guestName}</h4>
                    </div>
                    <div className="flex items-center gap-4 text-on-surface-variant text-xs font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-1.5"><Users size={12} /> {reservation.guestCount} PAX</div>
                        {reservation.table && (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <TableIcon size={12} /> Table {reservation.table.number}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 justify-between tablet:justify-end tablet:min-w-[400px]">
                <div className={cn(
                    "pill-status",
                    reservation.status === 'SEATED' ? "bg-secondary/10 text-secondary" :
                    reservation.status === 'CONFIRMED' ? "bg-tertiary/10 text-tertiary" :
                    "bg-on-surface-variant/10 text-on-surface-variant"
                )}>
                    <span className="font-bold">{reservation.status}</span>
                </div>

                <div className="flex items-center gap-2">
                    {reservation.status === 'PENDING' || reservation.status === 'CONFIRMED' ? (
                        <>
                            <button 
                                onClick={onCheckIn}
                                disabled={isProcessing}
                                className="h-12 px-6 bg-secondary text-white rounded-xl label-sm flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                CHECK IN
                            </button>
                            <button 
                                onClick={onCancel}
                                className="h-12 w-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-all shadow-md group/btn"
                            >
                                <XCircle size={18} />
                            </button>
                        </>
                    ) : (
                        <div className="relative">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(openMenuId === reservation.id ? null : reservation.id);
                                }} 
                                className={cn(
                                    "h-12 w-12 rounded-xl flex items-center justify-center transition-all shadow-md",
                                    openMenuId === reservation.id ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                                )}
                            >
                                <MoreVertical size={18} />
                            </button>

                            {openMenuId === reservation.id && (
                                <div className="absolute right-0 mt-2 w-48 bg-surface-container-high border border-outline-variant rounded-xl shadow-2xl z-[50] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button 
                                        onClick={() => toast('Guest details view coming soon')}
                                        className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-white/5 transition-colors text-sm font-medium"
                                    >
                                        <UserCircle size={16} className="text-secondary" />
                                        Guest Details
                                    </button>
                                    <button 
                                        onClick={() => toast('Reservation editing coming soon')}
                                        className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-white/5 transition-colors text-sm font-medium"
                                    >
                                        <Edit2 size={16} className="text-primary" />
                                        Edit Booking
                                    </button>
                                    {reservation.status === 'SEATED' && (
                                        <button 
                                            onClick={() => toast('Checking out... redirecting to POS')}
                                            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-white/5 transition-colors text-sm font-medium"
                                        >
                                            <CheckCircle2 size={16} className="text-tertiary" />
                                            Check Out
                                        </button>
                                    )}
                                    <div className="my-1 border-t border-outline-variant" />
                                    <button 
                                        onClick={onCancel}
                                        className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-error/10 text-error transition-colors text-sm font-medium"
                                    >
                                        <Trash2 size={16} />
                                        Cancel Reservation
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function WaitlistItem({ index, reservation, onCheckIn, isProcessing }: { index: number, reservation: LooseValue, onCheckIn: () => void, isProcessing: boolean }) {
    const elapsedMinutes = Math.floor((new Date().getTime() - new Date(reservation.createdAt).getTime()) / 60000);
    
    return (
        <div className="card-default !p-6 flex flex-col tablet:flex-row tablet:items-center gap-6 bg-gradient-to-r from-surface-container to-surface-container/50">
            <div className="flex-1 flex items-center gap-6">
                <div className="h-14 w-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary border-2 border-secondary/20">
                    <span className="display-lg !text-2xl italic tracking-tighter">#{index + 1}</span>
                </div>
                <div>
                    <h4 className="body-lg font-bold text-on-surface mb-1">{reservation.guestName}</h4>
                    <div className="flex items-center gap-4 text-on-surface-variant text-xs font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-1.5"><Users size={12} /> {reservation.guestCount} GUESTS</div>
                        <div className="flex items-center gap-1.5 text-tertiary">
                            <Clock size={12} /> Wait: {elapsedMinutes}m
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="bg-surface-container-high rounded-xl p-3 border border-outline-variant flex items-center gap-2">
                    <span className="label-sm text-on-surface-variant">Notify Guest</span>
                    <button onClick={() => toast.success(`Notification sent to ${reservation.guestName}`)} className="h-8 w-8 rounded-lg bg-secondary/20 text-secondary flex items-center justify-center hover:bg-secondary/30">
                        <Bell size={14} />
                    </button>
                </div>
                <button 
                    onClick={onCheckIn}
                    disabled={isProcessing}
                    className="h-12 px-8 bg-on-surface text-surface rounded-xl label-sm font-black tracking-widest flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                >
                    {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={18} />}
                    SEAT NOW
                </button>
            </div>
        </div>
    );
}
