import { useState } from 'react';
import { useTenant } from '../hooks/useTenant';
import { getPublicClient } from '../api/service';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
    Bell, 
    Droplet, 
    Wrench, 
    Car, 
    Utensils, 
    Sprout,
    HelpCircle,
    CheckCircle2,
    Loader2,
    Search
} from 'lucide-react';

const CATEGORIES = [
    { id: 'HOUSEKEEPING', label: 'Housekeeping', icon: Droplet },
    { id: 'MAINTENANCE', label: 'Maintenance', icon: Wrench },
    { id: 'TRANSPORT', label: 'Transport', icon: Car },
    { id: 'DINING', label: 'Dining', icon: Utensils },
    { id: 'SPA', label: 'Spa & Wellness', icon: Sprout },
    { id: 'GENERAL', label: 'General Inquiry', icon: HelpCircle },
];

export default function ConciergePage() {
    const { tenant, isLoading: isTenantLoading, error: tenantError } = useTenant();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [roomNumber, setRoomNumber] = useState('');
    const [description, setDescription] = useState('');
    const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
    const [searchRef, setSearchRef] = useState('');

    const publicClient = tenant ? getPublicClient(tenant.tenantId) : null;

    const requestMutation = useMutation({
        mutationFn: (data: LooseValue) => publicClient!.post('/api/requests', data).then(r => r.data),
        onSuccess: (data) => {
            setReferenceNumber(data.id);
            setRoomNumber('');
            setDescription('');
        }
    });

    const { data: requestStatus, refetch: fetchStatus, isFetching: isSearching } = useQuery({
        queryKey: ['request-status', searchRef],
        queryFn: () => publicClient!.get(`/api/requests/${searchRef}`).then(r => r.data),
        enabled: false, // manual trigger
        retry: false,
    });

    if (isTenantLoading) {
        return (
            <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="animate-spin text-secondary mb-4" size={48} />
                <h2 className="headline-md mb-2">Connecting to Hotel System</h2>
                <p className="body-md text-on-surface-variant max-w-sm">
                    Please wait while we establish a secure connection to the digital concierge service.
                </p>
            </div>
        );
    }

    if (tenantError || !tenant) {
        return (
            <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
                <div className="h-16 w-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-6">
                    <Bell size={32} />
                </div>
                <h2 className="headline-md mb-2">Service Unavailable</h2>
                <p className="body-md text-on-surface-variant max-w-sm">
                    {tenantError || 'Unable to identify hotel from your current link. Please scan the QR code in your room.'}
                </p>
            </div>
        );
    }

    const unmappedCategory = () => setSelectedCategory(null);

    return (
        <div className="min-h-screen bg-surface text-on-surface flex flex-col overflow-y-auto">
            <header className="px-6 py-12 shrink-0 border-b border-outline-variant/30 text-center relative overflow-hidden bg-surface-container-low">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
                <Bell size={40} className="mx-auto text-secondary mb-4" />
                <h1 className="display-lg text-on-surface mb-2">{tenant.displayName || tenant.tenantName}</h1>
                <p className="body-lg text-on-surface-variant">Digital Concierge & Services</p>
            </header>

            <div className="flex-1 max-w-2xl mx-auto w-full p-6">
                {referenceNumber ? (
                    <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <CheckCircle2 size={64} className="mx-auto text-secondary mb-6" />
                        <h2 className="headline-lg mb-4">Request Submitted</h2>
                        <p className="body-lg text-on-surface-variant mb-8">
                            Your request has been routed to the appropriate department. We will attend to it shortly.
                        </p>
                        <div className="bg-surface-container-high rounded-xl py-6 mb-8 border border-outline-variant/30">
                            <p className="label-md text-on-surface-variant mb-2">REFERENCE NUMBER</p>
                            <p className="display-sm text-secondary tracking-wider font-mono">{referenceNumber.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <button 
                            onClick={() => {
                                setReferenceNumber(null);
                                setSelectedCategory(null);
                            }}
                            className="btn-primary w-full h-14"
                        >
                            Make Another Request
                        </button>
                    </div>
                ) : selectedCategory ? (
                    <div className="animate-in slide-in-from-right-8 duration-300">
                        <button onClick={unmappedCategory} className="text-secondary body-md mb-6 hover:underline flex items-center gap-1">
                            &larr; Back to Categories
                        </button>
                        
                        <h2 className="headline-md mb-6 flex items-center gap-3">
                            {CATEGORIES.find(c => c.id === selectedCategory)?.label} Request
                        </h2>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if(!roomNumber || !description) return;
                            requestMutation.mutate({ category: selectedCategory, roomNumber, description });
                        }} className="space-y-6">
                            
                            <div className="space-y-2">
                                <label className="label-lg text-on-surface-variant">Room Number</label>
                                <input 
                                    className="input-default w-full"
                                    required 
                                    placeholder="e.g. 402"
                                    value={roomNumber}
                                    onChange={e => setRoomNumber(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="label-lg text-on-surface-variant">Details</label>
                                <textarea 
                                    className="input-default w-full min-h-[120px] py-4"
                                    required 
                                    placeholder="Please describe what you need..."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={requestMutation.isPending || !roomNumber || !description}
                                className="btn-primary w-full h-14 tracking-wider"
                            >
                                {requestMutation.isPending ? <Loader2 className="animate-spin" /> : 'Submit Request'}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="animate-in fade-in duration-500 space-y-12">
                        <section>
                            <h2 className="headline-md mb-6">How can we assist you?</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {CATEGORIES.map(category => {
                                    const IconInfo = category.icon;
                                    return (
                                        <button 
                                            key={category.id}
                                            onClick={() => setSelectedCategory(category.id)}
                                            className="card-default hover:border-secondary hover:bg-surface-variant/20 transition-all flex flex-col items-center justify-center p-6 text-center gap-4 group"
                                        >
                                            <div className="h-14 w-14 rounded-full bg-surface-container-high flex items-center justify-center group-hover:bg-secondary/10 transition-colors">
                                                <IconInfo size={28} className="text-secondary" />
                                            </div>
                                            <span className="body-lg font-medium">{category.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </section>

                        <section className="border-t border-outline-variant/30 pt-10">
                            <h2 className="headline-md mb-6">Check Request Status</h2>
                            <div className="flex gap-4">
                                <input 
                                    className="input-default flex-1 font-mono uppercase"
                                    placeholder="Reference No..."
                                    value={searchRef}
                                    onChange={e => setSearchRef(e.target.value)}
                                />
                                <button 
                                    onClick={() => fetchStatus()}
                                    disabled={!searchRef || isSearching}
                                    className="btn-secondary px-6 shrink-0"
                                >
                                    {isSearching ? <Loader2 className="animate-spin" /> : <Search size={20} />}
                                </button>
                            </div>
                            
                            {requestStatus && (
                                <div className="mt-6 p-6 rounded-xl bg-surface-container-low border border-outline-variant">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="label-lg text-on-surface-variant font-mono">REF: {requestStatus.id.slice(0,8).toUpperCase()}</span>
                                        <span className={`px-3 py-1 rounded-full text-sm font-bold tracking-wider ${
                                            requestStatus.status === 'COMPLETED' ? 'bg-primary/20 text-primary' : 
                                            requestStatus.status === 'PENDING' ? 'bg-error/20 text-error' : 
                                            'bg-secondary/20 text-secondary'
                                        }`}>
                                            {requestStatus.status}
                                        </span>
                                    </div>
                                    <p className="body-lg">{requestStatus.description}</p>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
