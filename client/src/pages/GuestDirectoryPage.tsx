import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { guestFolioService } from '../api/service';
import { useNavigate } from 'react-router-dom';
import { 
    Search,
    Filter,
    Users,
    Calendar,
    ChevronRight,
    UserCircle2,
    BedDouble
} from 'lucide-react';

export default function GuestDirectoryPage() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [floorFilter, setFloorFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('SEATED');

    // Fetch guests
    const { data: paginatedGuests, isLoading } = useQuery({
        queryKey: ['seated-guests', statusFilter],
        queryFn: () => guestFolioService.getCheckedInGuests({ status: statusFilter }),
    });

    const guests = paginatedGuests?.data || [];

    const filteredGuests = guests.filter(guest => {
        if (searchTerm && !guest.guestName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        // Mock floor filtering if needed
        return true;
    });

    return (
        <div className="h-full flex flex-col bg-surface overflow-y-auto">
            <header className="px-8 pt-10 pb-6 shrink-0 border-b border-outline-variant/30">
                <h1 className="display-lg text-on-surface mb-2">Guest Directory</h1>
                <p className="body-lg text-on-surface-variant max-w-2xl">
                    Searchable directory of all current in-house guests for the active tenant.
                </p>
                
                {/* Desktop Filter Bar */}
                <div className="mt-8 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[280px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                        <input 
                            type="text" 
                            placeholder="Find guest by name or room..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-surface-container-low border border-outline-variant rounded-lg h-14 w-full pl-12 pr-4 text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-all outline-none"
                        />
                    </div>
                    
                    <select 
                        className="bg-surface-container-low border border-outline-variant rounded-lg h-14 px-4 text-on-surface focus:border-secondary outline-none"
                        value={floorFilter}
                        onChange={(e) => setFloorFilter(e.target.value)}
                    >
                        <option value="ALL">All Floors</option>
                        <option value="1">Floor 1</option>
                        <option value="2">Floor 2</option>
                        <option value="PENTHOUSE">Penthouse</option>
                    </select>

                    <select 
                        className="bg-surface-container-low border border-outline-variant rounded-lg h-14 px-4 text-on-surface focus:border-secondary outline-none"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="SEATED">Seated / In-House</option>
                        <option value="EXPECTED">Expected</option>
                        <option value="CHECKED_OUT">Checked-Out</option>
                    </select>
                </div>
            </header>

            <div className="p-8 flex-1 max-w-7xl mx-auto w-full">
                {isLoading ? (
                    <div className="animate-pulse space-y-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 bg-surface-container rounded-lg"></div>
                        ))}
                    </div>
                ) : filteredGuests.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center">
                        <div className="h-16 w-16 bg-surface-variant rounded-full flex items-center justify-center mb-4 text-on-surface-variant">
                            <Users size={32} />
                        </div>
                        <h3 className="headline-md mb-2">No guests currently in-house</h3>
                        <p className="body-md text-on-surface-variant max-w-sm">
                            Try adjusting your filters or wait for new check-ins.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="col-span-full mb-2">
                            <p className="body-md text-on-surface-variant">
                                Displaying {filteredGuests.length} active guests
                            </p>
                        </div>
                        {filteredGuests.map(guest => (
                            <div 
                                key={guest.id}
                                onClick={() => navigate(`/folio/${guest.tableId || guest.id}`)}
                                className="card-default group cursor-pointer hover:border-secondary transition-colors overflow-hidden relative border border-outline-variant/30"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                                    <ChevronRight className="text-secondary" size={24} />
                                </div>
                                
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="h-12 w-12 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                                        <UserCircle2 size={24} className="text-on-surface" />
                                    </div>
                                    <div>
                                        <h3 className="headline-md !text-[18px] text-on-surface">{guest.guestName}</h3>
                                        <p className="label-sm text-secondary tracking-widest mt-1">
                                            {guest.table?.number ? `ROOM ${guest.table.number}` : 'NO ROOM'}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center gap-3 body-md text-on-surface-variant">
                                        <Calendar size={18} className="shrink-0" />
                                        <span>
                                            {guest.startTime ? new Date(guest.startTime).toLocaleDateString() : 'N/A'} 
                                            &nbsp;-&nbsp; 
                                            {guest.endTime ? new Date(guest.endTime).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 body-md text-on-surface-variant">
                                        <Users size={18} className="shrink-0" />
                                        <span>Party of {guest.guestCount || 1}</span>
                                    </div>
                                    <div className="flex items-center gap-3 body-md text-on-surface-variant">
                                        <BedDouble size={18} className="shrink-0" />
                                        <span>{guest.notes || 'Standard Booking'}</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-outline-variant max-w-max">
                                    <p className="label-sm text-on-surface-variant mb-1">FOLIO BALANCE</p>
                                    <p className="headline-md !text-[20px] text-on-surface tabular-nums">
                                        {/* Mock balance since reservation object doesn't have it direct */}
                                        $0.00
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
