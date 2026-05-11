import { useState } from 'react';
import { useTenant } from '../hooks/useTenant';
import { getPublicClient } from '../api/service';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Ticket, MapPin, Clock, Users, CalendarDays, CheckCircle2 } from 'lucide-react';
import { Activity } from '@mumo/types';

export default function ActivityBookingPage() {
    const { tenant, isLoading: isTenantLoading, error: tenantError } = useTenant();
    const publicClient = tenant ? getPublicClient(tenant.tenantId) : null;

    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [roomNumber, setRoomNumber] = useState('');
    const [guestName, setGuestName] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const [bookedRef, setBookedRef] = useState<string | null>(null);

    const { data: activities, isLoading: isActLoading } = useQuery({
        queryKey: ['public-activities', tenant?.tenantId],
        queryFn: () => publicClient!.get<Activity[]>('/api/activities').then(r => r.data),
        enabled: !!publicClient
    });

    const bookingMutation = useMutation({
        mutationFn: (data: any) => publicClient!.post('/api/activity-bookings', data).then(r => r.data),
        onSuccess: (data) => {
            setBookedRef(data.id);
            setRoomNumber('');
            setGuestName('');
            setBookingDate('');
        }
    });

    if (isTenantLoading) {
        return (
            <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="animate-spin text-secondary mb-4" size={48} />
                <h2 className="headline-md">Loading Experiences</h2>
            </div>
        );
    }

    if (tenantError || !tenant) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center p-6">
                <p className="text-error">{tenantError || 'System context missing.'}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface text-on-surface flex flex-col overflow-y-auto">
            <header className="px-6 py-12 shrink-0 border-b border-outline-variant/30 text-center relative overflow-hidden bg-surface-container-low">
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'2\' fill=\'%23000\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }} />
                <Ticket size={40} className="mx-auto text-secondary mb-4" />
                <h1 className="display-lg text-on-surface mb-2">{tenant.displayName || tenant.tenantName}</h1>
                <p className="body-lg text-on-surface-variant">Experiences & Activities</p>
            </header>

            <main className="flex-1 w-full max-w-5xl mx-auto p-6 lg:p-8">
                {bookedRef ? (
                    <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-2xl mx-auto">
                        <CheckCircle2 size={64} className="mx-auto text-secondary mb-6" />
                        <h2 className="headline-lg mb-4">Booking Confirmed!</h2>
                        <p className="body-lg text-on-surface-variant mb-8">
                            Your spot for <span className="text-on-surface font-bold">{selectedActivity?.name}</span> has been secured.
                        </p>
                        <div className="bg-surface-container-high rounded-xl py-6 mb-8 border border-outline-variant/30">
                            <p className="label-md text-on-surface-variant mb-2">BOOKING REFERENCE</p>
                            <p className="display-sm text-secondary tracking-wider font-mono">{bookedRef.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <button 
                            onClick={() => {
                                setBookedRef(null);
                                setSelectedActivity(null);
                            }}
                            className="btn-primary w-full h-14"
                        >
                            Browse More Experiences
                        </button>
                    </div>
                ) : selectedActivity ? (
                    <div className="grid md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                        {/* Booking Form Sidebar */}
                        <div className="order-2 md:order-1 bg-surface-container-low rounded-2xl p-6 border border-outline-variant/50 h-fit">
                            <button 
                                onClick={() => setSelectedActivity(null)} 
                                className="text-secondary body-md mb-6 hover:underline flex items-center gap-1"
                            >
                                &larr; Back to Catalog
                            </button>
                            
                            <h3 className="headline-md mb-6">Complete Booking</h3>
                            
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                if(!bookingDate || !roomNumber || !guestName) return;
                                bookingMutation.mutate({
                                    activityId: selectedActivity.id,
                                    roomNumber,
                                    guestName,
                                    slotTime: new Date(bookingDate).toISOString()
                                });
                            }} className="space-y-6">
                                
                                <div className="space-y-2">
                                    <label className="label-lg text-on-surface-variant">Guest Name</label>
                                    <input 
                                        className="input-default w-full"
                                        required 
                                        value={guestName}
                                        onChange={e => setGuestName(e.target.value)}
                                        placeholder="Name under reservation"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="label-lg text-on-surface-variant">Room Number</label>
                                    <input 
                                        className="input-default w-full"
                                        required 
                                        value={roomNumber}
                                        onChange={e => setRoomNumber(e.target.value)}
                                        placeholder="e.g. 402"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="label-lg text-on-surface-variant">Select Date & Time</label>
                                    <input 
                                        type="datetime-local"
                                        className="input-default w-full"
                                        required 
                                        value={bookingDate}
                                        onChange={e => setBookingDate(e.target.value)}
                                    />
                                </div>

                                <div className="bg-surface-container-high rounded-lg p-4 flex justify-between items-center text-on-surface mt-2">
                                    <span className="body-lg font-medium">Total Price</span>
                                    <span className="headline-sm text-secondary">
                                        {tenant.settings?.currency} {selectedActivity.price.toFixed(2)}
                                    </span>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={bookingMutation.isPending || selectedActivity.availableSlots <= 0}
                                    className="btn-primary w-full h-14 tracking-wider mt-4"
                                >
                                    {bookingMutation.isPending ? <Loader2 className="animate-spin" /> : 
                                     selectedActivity.availableSlots <= 0 ? 'Fully Booked' : 'Confirm Booking'}
                                </button>
                                <p className="body-sm text-center text-on-surface-variant mt-2">
                                    Charge will be posted to your room folio.
                                </p>
                            </form>
                        </div>
                        
                        {/* Activity Details */}
                        <div className="order-1 md:order-2 space-y-6">
                            <div className="aspect-video bg-surface-container-highest rounded-2xl overflow-hidden relative">
                                {selectedActivity.imageUrl ? (
                                    <img src={selectedActivity.imageUrl} className="w-full h-full object-cover" alt={selectedActivity.name} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center opacity-20">
                                        <MapPin size={64} />
                                    </div>
                                )}
                            </div>
                            
                            <h2 className="display-sm text-secondary">{selectedActivity.name}</h2>
                            <p className="body-lg text-on-surface-variant leading-relaxed">
                                {selectedActivity.description}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <div className="bg-surface-container-low rounded-xl p-4 flex items-center gap-4">
                                    <Clock className="text-primary opacity-80" />
                                    <div>
                                        <p className="label-sm text-on-surface-variant uppercase">Duration</p>
                                        <p className="body-lg">{selectedActivity.duration} mins</p>
                                    </div>
                                </div>
                                <div className="bg-surface-container-low rounded-xl p-4 flex items-center gap-4">
                                    <Users className="text-primary opacity-80" />
                                    <div>
                                        <p className="label-sm text-on-surface-variant uppercase">Availability</p>
                                        <p className="body-lg">{selectedActivity.availableSlots} slots left</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="animate-in fade-in duration-500">
                        {isActLoading ? (
                            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-secondary" size={32} /></div>
                        ) : activities?.length === 0 ? (
                            <div className="text-center p-12 text-on-surface-variant body-lg">
                                No activities currently available.
                            </div>
                        ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {activities?.map((activity) => (
                                    <div key={activity.id} className="card-default group flex flex-col overflow-hidden p-0 border-outline-variant/30 hover:border-secondary transition-colors">
                                        <div className="h-48 bg-surface-container-highest relative">
                                            {activity.imageUrl ? (
                                                <img src={activity.imageUrl} className="w-full h-full object-cover" alt={activity.name} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center opacity-10">
                                                    <MapPin size={48} />
                                                </div>
                                            )}
                                            {activity.availableSlots <= 0 && (
                                                <div className="absolute inset-0 bg-surface/80 flex items-center justify-center">
                                                    <span className="font-bold text-error bg-error/10 px-4 py-2 rounded-full uppercase tracking-widest">Sold Out</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-6 flex-1 flex flex-col">
                                            <div className="flex justify-between items-start mb-2 gap-4">
                                                <h3 className="headline-sm group-hover:text-secondary transition-colors line-clamp-2">{activity.name}</h3>
                                                <span className="text-primary font-bold whitespace-nowrap">
                                                     {tenant.settings?.currency} {activity.price}
                                                </span>
                                            </div>
                                            <p className="body-md text-on-surface-variant line-clamp-2 mb-6 flex-1">
                                                {activity.description}
                                            </p>
                                            
                                            <div className="flex items-center gap-4 text-on-surface-variant body-sm mb-6">
                                                <div className="flex items-center gap-1.5 opacity-80"><Clock size={16} /> {activity.duration}m</div>
                                                <div className="text-outline-variant">•</div>
                                                <div className="flex items-center gap-1.5 opacity-80"><Users size={16} /> {activity.availableSlots} left</div>
                                            </div>

                                            <button 
                                                disabled={activity.availableSlots <= 0}
                                                onClick={() => setSelectedActivity(activity)}
                                                className="btn-secondary w-full"
                                            >
                                                Book Now
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
