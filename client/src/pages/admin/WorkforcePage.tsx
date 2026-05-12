import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { userService, shiftService, clockEventService } from '../../api/service';
import { Role } from '@mumo/types';
import { Clock, Calendar as CalendarIcon, Users, DollarSign, Edit2, Check, X, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, differenceInMinutes } from 'date-fns';
import FormField from '../../components/ui/FormField';

export default function WorkforcePage() {
    const { session } = useStore();
    const isAdmin = session.role === Role.TENANT_ADMIN;
    
    const [users, setUsers] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [clockEvents, setClockEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 }); // Sunday
    
    // UI States
    const [activeTab, setActiveTab] = useState<'roster' | 'schedule' | 'clock'>('schedule');
    const [editingRateId, setEditingRateId] = useState<string | null>(null);
    const [tempRate, setTempRate] = useState<string>('');
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [selectedShift, setSelectedShift] = useState<any>(null);
    const [shiftForm, setShiftForm] = useState({ startTime: '', endTime: '', station: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersRes, shiftsRes, clocksRes] = await Promise.all([
                userService.getAll(),
                shiftService.getAll({ 
                    start: format(weekStart, 'yyyy-MM-dd'), 
                    end: format(weekEnd, 'yyyy-MM-dd') 
                }),
                clockEventService.getAll()
            ]);
            setUsers(usersRes);
            setShifts(shiftsRes);
            setClockEvents(clocksRes);
        } catch (error) {
            toast.error('Failed to load workforce data');
        } finally {
            setLoading(false);
        }
    };

    const handleRateSave = async (userId: string) => {
        try {
            const numRate = parseFloat(tempRate);
            if (!isNaN(numRate) && numRate >= 0) {
                await userService.updateRate(userId, numRate);
                setUsers(users.map(u => u.id === userId ? { ...u, hourlyRate: numRate } : u));
            }
        } catch (error) {
            toast.error('Failed to update rate');
        } finally {
            setEditingRateId(null);
        }
    };

    const totalLaborCost = shifts.reduce((total, shift) => {
        const user = users.find(u => u.id === shift.userId);
        if (!user) return total;
        
        const start = new Date(shift.startTime);
        const end = new Date(shift.endTime);
        const hours = differenceInMinutes(end, start) / 60;
        return total + (hours * (user.hourlyRate || 0));
    }, 0);

    const openShiftModal = (userId: string, date: Date, existingShift: LooseValue = null) => {
        setSelectedUserId(userId);
        setSelectedDate(date);
        setSelectedShift(existingShift);
        if (existingShift) {
            setShiftForm({
                startTime: format(new Date(existingShift.startTime), 'HH:mm'),
                endTime: format(new Date(existingShift.endTime), 'HH:mm'),
                station: existingShift.station || 'Floor'
            });
        } else {
            setShiftForm({ startTime: '09:00', endTime: '17:00', station: 'Floor' });
        }
        setIsShiftModalOpen(true);
    };

    const saveShift = async () => {
        try {
            const startStr = `${format(selectedDate, 'yyyy-MM-dd')}T${shiftForm.startTime}:00`;
            const endStr = `${format(selectedDate, 'yyyy-MM-dd')}T${shiftForm.endTime}:00`;

            if (selectedShift) {
                await shiftService.update(selectedShift.id, {
                    startTime: startStr,
                    endTime: endStr,
                    station: shiftForm.station
                });
            } else {
                await shiftService.create({
                    userId: selectedUserId,
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    startTime: startStr,
                    endTime: endStr,
                    station: shiftForm.station
                });
            }
            setIsShiftModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to save shift');
        }
    };

    const deleteShift = async (id: string) => {
        try {
            await shiftService.delete(id);
            setIsShiftModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to delete shift');
        }
    };

    const addManualClockEvent = async () => {
        const typeStr = prompt('Enter IN or OUT:');
        if (typeStr !== 'IN' && typeStr !== 'OUT') return;
        
        try {
            await clockEventService.create({
                userId: selectedUserId || (session.userId ?? undefined),
                type: typeStr
            });
            fetchData();
        } catch (error) {
            toast.error('Failed to record clock event');
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 tablet:p-10 space-y-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="display-lg text-on-surface">Staff & Workforce</h1>
                    <p className="body-lg text-on-surface-variant">High-trust staff scheduling and activity monitoring.</p>
                </div>
                
                <div className="card-default flex items-center gap-6 py-4 px-8 border-secondary/20">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p className="label-sm text-on-surface-variant">Weekly Labor Cost</p>
                        <p className="headline-md font-bold text-on-surface">KES {totalLaborCost.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="card-default p-1 bg-surface-container-low rounded-xl w-fit flex gap-2">
                {(['schedule', 'roster', 'clock'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2.5 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${
                            activeTab === tab 
                                ? 'bg-secondary text-white shadow-lg' 
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            {tab === 'roster' && <Users size={16} />}
                            {tab === 'schedule' && <CalendarIcon size={16} />}
                            {tab === 'clock' && <Clock size={16} />}
                            {tab}
                        </span>
                    </button>
                ))}
            </div>

            <div className="card-default overflow-hidden p-0">
                {/* TAB: SCHEDULE */}
                {activeTab === 'schedule' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-surface-container-low border-b border-outline-variant">
                                <tr className="label-sm text-on-surface-variant">
                                    <th className="px-8 py-6">Staff</th>
                                    {[0, 1, 2, 3, 4, 5, 6].map(offset => (
                                        <th key={offset} className="px-4 py-6 text-center border-l border-outline-variant/30">
                                            {format(addDays(weekStart, offset), 'EEE d')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant">
                                {users.map(user => (
                                    <tr key={user.id} className="hover:bg-surface-container-low/30 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="body-md font-bold text-on-surface">{user.firstName} {user.lastName}</div>
                                            <div className="label-sm text-on-surface-variant">{user.role.replace('TENANT_', '')}</div>
                                        </td>
                                        {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                                            const currentDay = addDays(weekStart, offset);
                                            const dayShift = shifts.find(s => s.userId === user.id && isSameDay(new Date(s.date), currentDay));
                                            
                                            return (
                                                <td key={offset} className="p-2 border-l border-outline-variant/30 w-[12%]">
                                                    <button
                                                        onClick={() => openShiftModal(user.id, currentDay, dayShift)}
                                                        className={`w-full h-full min-h-[64px] rounded-xl border border-dashed transition-all p-3 flex flex-col items-center justify-center ${
                                                            dayShift 
                                                                ? 'bg-secondary/10 border-secondary/30 hover:bg-secondary/20' 
                                                                : 'bg-transparent border-outline-variant/50 hover:border-secondary text-on-surface-variant hover:text-secondary'
                                                        }`}
                                                    >
                                                        {dayShift ? (
                                                            <div className="text-center">
                                                                <div className="label-sm font-bold text-on-surface">
                                                                    {format(new Date(dayShift.startTime), 'HH:mm')} - {format(new Date(dayShift.endTime), 'HH:mm')}
                                                                </div>
                                                                <div className="text-[10px] uppercase font-bold text-on-surface-variant mt-1">{dayShift.station}</div>
                                                            </div>
                                                        ) : (
                                                            <Plus size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        )}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB: ROSTER */}
                {activeTab === 'roster' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-surface-container-low border-b border-outline-variant">
                                <tr className="label-sm text-on-surface-variant">
                                    <th className="px-8 py-6">Staff Details</th>
                                    <th className="px-6 py-6">Role</th>
                                    <th className="px-6 py-6">Status</th>
                                    <th className="px-8 py-6 text-right">Hourly Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant">
                                {users.map(user => (
                                    <tr key={user.id} className="hover:bg-surface-container-low/30 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center font-bold text-secondary border border-outline-variant">
                                                    {user.firstName[0]}{user.lastName[0]}
                                                </div>
                                                <div>
                                                    <div className="body-md font-bold text-on-surface">{user.firstName} {user.lastName}</div>
                                                    <div className="label-sm text-on-surface-variant">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 font-medium">
                                            <span className="label-sm px-2 py-1 rounded bg-surface-container-highest text-on-surface-variant">
                                                {user.role.replace('TENANT_', '')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6">
                                            <span className={`pill-status ${user.status === 'ACTIVE' ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            {editingRateId === user.id ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <input 
                                                        type="number" 
                                                        value={tempRate} 
                                                        onChange={(e) => setTempRate(e.target.value)}
                                                        className="input-field w-32 h-10 text-right font-mono"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleRateSave(user.id);
                                                            if (e.key === 'Escape') setEditingRateId(null);
                                                        }}
                                                    />
                                                    <button onClick={() => handleRateSave(user.id)} className="p-2 text-secondary hover:bg-secondary/10 rounded-lg transition-colors">
                                                        <Check size={18} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className="headline-sm font-bold text-on-surface">KES {user.hourlyRate?.toLocaleString()}</span>
                                                    {isAdmin && (
                                                        <button 
                                                            onClick={() => { setEditingRateId(user.id); setTempRate((user.hourlyRate || 0).toString()); }}
                                                            className="p-2 text-on-surface-variant hover:text-secondary hover:bg-secondary/10 rounded-lg transition-all"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB: ACTIVITY */}
                {activeTab === 'clock' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-surface-container-low border-b border-outline-variant">
                                <tr className="label-sm text-on-surface-variant">
                                    <th className="px-8 py-6">Time</th>
                                    <th className="px-6 py-6">Staff</th>
                                    <th className="px-8 py-6 text-right">Event</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant">
                                {clockEvents.map((event: LooseValue) => (
                                    <tr key={event.id} className="hover:bg-surface-container-low/30 transition-colors">
                                        <td className="px-8 py-6 body-md font-medium text-on-surface">
                                            {format(new Date(event.timestamp), 'MMM d, yyyy • HH:mm:ss')}
                                        </td>
                                        <td className="px-6 py-6 body-md text-on-surface">
                                            {event.user?.firstName} {event.user?.lastName}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className={`pill-status font-bold tracking-widest ${event.type === 'IN' ? 'bg-secondary text-white' : 'bg-warning/10 text-warning border border-warning/30'}`}>
                                                CLOCK {event.type}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Shift Modal */}
            {isShiftModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
                            <div>
                                <h2 className="headline-md font-bold text-on-surface">{selectedShift ? 'Edit Shift' : 'Assign Shift'}</h2>
                                <p className="body-md text-on-surface-variant">{format(selectedDate, 'EEEE, MMM d, yyyy')}</p>
                            </div>
                            <button onClick={() => setIsShiftModalOpen(false)} className="p-2 rounded-full hover:bg-surface-container-high">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="label-sm text-on-surface-variant font-bold uppercase">Start Time</label>
                                    <input 
                                        type="time" 
                                        value={shiftForm.startTime} 
                                        onChange={(e) => setShiftForm({...shiftForm, startTime: e.target.value})}
                                        className="input-field"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="label-sm text-on-surface-variant font-bold uppercase">End Time</label>
                                    <input 
                                        type="time" 
                                        value={shiftForm.endTime} 
                                        onChange={(e) => setShiftForm({...shiftForm, endTime: e.target.value})}
                                        className="input-field"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="label-sm text-on-surface-variant font-bold uppercase">Station / Role Assignment</label>
                                <input 
                                    type="text" 
                                    value={shiftForm.station} 
                                    onChange={(e) => setShiftForm({...shiftForm, station: e.target.value})}
                                    placeholder="e.g. Register, Floor, Kitchen..."
                                    className="input-field"
                                />
                            </div>
                        </div>
                        
                        <div className="p-8 bg-surface-container-low border-t border-outline-variant flex items-center justify-end gap-4">
                            {selectedShift && (
                                <button onClick={() => deleteShift(selectedShift.id)} className="mr-auto text-error font-bold hover:underline">Delete Shift</button>
                            )}
                            <button onClick={() => setIsShiftModalOpen(false)} className="btn-secondary">Cancel</button>
                            <button onClick={saveShift} className="btn-primary">
                                {selectedShift ? 'Save Changes' : 'Assign Shift'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
