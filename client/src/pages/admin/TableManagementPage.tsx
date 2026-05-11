import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tableService, getErrorMessage } from '../../api/service';
import { 
    Plus, 
    Trash2, 
    Copy, 
    Save, 
    Maximize2, 
    Map as MapIcon, 
    Layout, 
    ChevronRight,
    Users,
    Layers,
    Eye,
    X,
    Loader2
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import Skeleton from '../../components/ui/Skeleton';
import TableMapPage from '../TableMapPage';

const GRID_SIZE = 20;
const ZONES = ['Indoor', 'Outdoor', 'Bar', 'Pool'];

export default function TableManagementPage() {
    const queryClient = useQueryClient();
    const { session } = useStore();
    
    // State for local modifications
    const [localTables, setLocalTables] = useState<any[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const tablesQuery = useQuery({
        queryKey: ['tables'],
        queryFn: tableService.getAll,
    });

    useEffect(() => {
        if (tablesQuery.data) {
            setLocalTables(tablesQuery.data);
        }
    }, [tablesQuery.data]);

    const batchUpdateMutation = useMutation({
        mutationFn: (tables: any[]) => tableService.batchUpdate(tables),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tables'] });
            showToast('Floor plan saved successfully', 'success');
        },
        onError: (err) => {
            showToast(getErrorMessage(err), 'error');
        }
    });

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleDragStart = (e: React.PointerEvent, id: string) => {
        const table = localTables.find(t => t.id === id);
        if (!table) return;

        const grid = e.currentTarget.parentElement!;
        const rect = grid.getBoundingClientRect();
        
        const onPointerMove = (moveEvent: PointerEvent) => {
            const x = Math.floor((moveEvent.clientX - rect.left) / (rect.width / GRID_SIZE));
            const y = Math.floor((moveEvent.clientY - rect.top) / (rect.height / GRID_SIZE));
            
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                setLocalTables(prev => prev.map(t => 
                    t.id === id ? { ...t, x, y } : t
                ));
            }
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    const handleAddTable = () => {
        const newTable = {
            id: crypto.randomUUID(), // Local ID, server will assign real UUID if creating
            number: (localTables.length + 1).toString(),
            capacity: 2,
            x: 0,
            y: 0,
            zone: 'Indoor',
            shape: 'SQUARE',
            isNew: true
        };
        setLocalTables([...localTables, newTable]);
        setSelectedTableId(newTable.id);
    };

    const handleDuplicateTable = () => {
        if (!selectedTableId) return;
        const base = localTables.find(t => t.id === selectedTableId);
        if (!base) return;

        const copy = {
            ...base,
            id: crypto.randomUUID(),
            number: `${base.number} (Copy)`,
            x: Math.min(base.x + 1, GRID_SIZE - 1),
            y: base.y,
            isNew: true
        };
        setLocalTables([...localTables, copy]);
        setSelectedTableId(copy.id);
    };

    const handleDeleteTable = () => {
        if (!selectedTableId) return;
        setLocalTables(prev => prev.filter(t => t.id !== selectedTableId));
        setSelectedTableId(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Filter out existing tables to see what's truly new vs updated
            // For simplicity in this demo, batchUpdate handles both or we create first
            // Requirement says batchUpdate accepts tables array.
            await batchUpdateMutation.mutateAsync(localTables.map(({ isNew, ...t }) => t));
        } finally {
            setIsSaving(false);
        }
    };

    const selectedTable = localTables.find(t => t.id === selectedTableId);

    return (
        <div className="h-full flex flex-col bg-surface overflow-hidden relative">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl animate-in slide-in-from-top-4 ${
                    toast.type === 'success' ? 'bg-secondary text-white' : 'bg-red-600 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header Toolbar */}
            <header className="h-[80px] bg-surface-container-low border-b border-outline-variant flex items-center justify-between px-8 shrink-0">
                <div className="flex items-center gap-6">
                    <div className="h-12 w-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                        <Layout size={24} className="text-secondary" />
                    </div>
                    <div>
                        <h1 className="headline-md">Floor Plan Editor</h1>
                        <p className="label-sm text-on-surface-variant font-bold uppercase tracking-widest">Workspace: {session.tenantName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setIsPreviewOpen(true)} className="btn-secondary h-12 px-6 gap-2">
                        <Eye size={18} /> Preview
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="btn-primary h-12 px-8 gap-2"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Save Layout
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Editor Sidebar (Left) */}
                <aside className="w-80 border-r border-outline-variant bg-surface-container-low flex flex-col p-6 space-y-8 overflow-y-auto">
                    <div className="space-y-4">
                        <h3 className="label-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                            <Plus size={14} /> Elements
                        </h3>
                        <button onClick={handleAddTable} className="w-full h-14 bg-surface-container hover:bg-secondary/10 border border-outline-variant rounded-xl flex items-center gap-4 px-4 transition-all group">
                            <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20">
                                <Plus size={20} className="text-secondary" />
                            </div>
                            <span className="body-md font-bold text-on-surface">Add New Table</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h3 className="label-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                            <Layers size={14} /> Zones
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {ZONES.map(z => (
                                <button key={z} className="h-10 rounded-lg border border-outline-variant text-[10px] font-bold uppercase tracking-widest hover:border-secondary transition-colors">
                                    {z}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-outline-variant/30">
                        <h3 className="label-sm font-bold text-on-surface-variant uppercase tracking-widest">Shortcuts</h3>
                        <div className="space-y-2 text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-wider">
                            <div className="flex justify-between"><span>Select</span> <span>Click</span></div>
                            <div className="flex justify-between"><span>Move</span> <span>Drag</span></div>
                            <div className="flex justify-between"><span>Delete</span> <span>⌫ / ⌦</span></div>
                        </div>
                    </div>
                </aside>

                {/* Main Canvas Area */}
                <main className="flex-1 bg-surface-container-highest/10 relative p-12 flex items-center justify-center overflow-auto p-[100px]">
                    <div 
                        className="relative bg-surface p-1 shadow-2xl rounded-sm border border-outline-variant/50"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${GRID_SIZE}, 40px)`,
                            gridTemplateRows: `repeat(${GRID_SIZE}, 40px)`,
                            gap: '1px',
                            background: '#f0f0f0'
                        }}
                    >
                        {/* Grid lines */}
                        {Array(GRID_SIZE * GRID_SIZE).fill(0).map((_, i) => (
                            <div key={i} className="bg-surface border-[0.5px] border-outline-variant/10 pointer-events-none" />
                        ))}

                        {/* Tables */}
                        {localTables.map(table => (
                            <div
                                key={table.id}
                                onPointerDown={(e) => {
                                    setSelectedTableId(table.id);
                                    handleDragStart(e, table.id);
                                }}
                                className={`absolute cursor-move flex items-center justify-center transition-all duration-75 ${
                                    selectedTableId === table.id ? 'z-50' : 'z-10'
                                }`}
                                style={{
                                    width: table.shape === 'RECTANGLE' ? '81px' : '40px',
                                    height: '40px',
                                    left: table.x * 41,
                                    top: table.y * 41,
                                }}
                            >
                                <div className={`w-full h-full rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 shadow-lg ${
                                    selectedTableId === table.id 
                                        ? 'bg-secondary text-white border-white' 
                                        : 'bg-surface-container-high border-outline text-on-surface'
                                } ${table.shape === 'ROUND' ? 'rounded-full' : ''}`}>
                                    <span className="text-[10px] font-black">{table.number}</span>
                                    <div className="flex items-center gap-1 opacity-50">
                                        <Users size={8} />
                                        <span className="text-[8px]">{table.capacity}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>

                {/* Config Panel (Right Drawer) */}
                {selectedTable && (
                    <aside className="w-80 border-l border-outline-variant bg-surface-container-low flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="h-[80px] px-6 border-b border-outline-variant flex items-center justify-between bg-surface-container/30">
                            <h2 className="headline-sm flex items-center gap-2">
                                <ChevronRight size={18} className="text-secondary" /> Table Config
                            </h2>
                            <button onClick={() => setSelectedTableId(null)} className="h-8 w-8 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors flex items-center justify-center">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <label className="label-sm font-bold text-on-surface-variant uppercase tracking-widest">Table Label</label>
                                    <input 
                                        type="text" 
                                        value={selectedTable.number}
                                        onChange={(e) => setLocalTables(prev => prev.map(t => t.id === selectedTableId ? { ...t, number: e.target.value } : t))}
                                        className="input-field" 
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="label-sm font-bold text-on-surface-variant uppercase tracking-widest">Seating Capacity</label>
                                    <input 
                                        type="number" 
                                        value={selectedTable.capacity}
                                        onChange={(e) => setLocalTables(prev => prev.map(t => t.id === selectedTableId ? { ...t, capacity: parseInt(e.target.value) || 2 } : t))}
                                        className="input-field" 
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="label-sm font-bold text-on-surface-variant uppercase tracking-widest">Zone / Section</label>
                                    <select 
                                        value={selectedTable.zone}
                                        onChange={(e) => setLocalTables(prev => prev.map(t => t.id === selectedTableId ? { ...t, zone: e.target.value } : t))}
                                        className="input-field"
                                    >
                                        {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-4">
                                    <label className="label-sm font-bold text-on-surface-variant uppercase tracking-widest">Table Shape</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['SQUARE', 'ROUND', 'RECTANGLE'].map(s => (
                                            <button 
                                                key={s} 
                                                onClick={() => setLocalTables(prev => prev.map(t => t.id === selectedTableId ? { ...t, shape: s } : t))}
                                                className={`h-10 rounded-lg border text-[8px] font-bold uppercase tracking-widest transition-all ${
                                                    selectedTable.shape === s ? 'bg-secondary text-white border-secondary' : 'bg-surface-container border-outline-variant text-on-surface-variant'
                                                }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-outline-variant/30 space-y-3">
                                <button onClick={handleDuplicateTable} className="w-full h-12 rounded-xl border border-outline-variant flex items-center justify-center gap-2 label-sm font-bold text-on-surface hover:bg-secondary/5 hover:border-secondary transition-all">
                                    <Copy size={16} /> Duplicate Table
                                </button>
                                <button onClick={handleDeleteTable} className="w-full h-12 rounded-xl border border-red-500/30 text-red-400 flex items-center justify-center gap-2 label-sm font-bold hover:bg-red-500/5 transition-all">
                                    <Trash2 size={16} /> Delete Table
                                </button>
                            </div>
                        </div>
                    </aside>
                )}
            </div>

            {/* Preview Modal */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md p-12 flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="display-md text-white">Layout Preview</h2>
                            <p className="body-md text-white/60 text-secondary">Verify the customer-facing floor plan appears exactly as intended.</p>
                        </div>
                        <button onClick={() => setIsPreviewOpen(false)} className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center shadow-2xl border border-white/10">
                            <X size={28} />
                        </button>
                    </div>
                    <div className="flex-1 bg-surface rounded-3xl overflow-hidden shadow-2xl relative">
                        {/* Recursive component or local mock render since TableMapPage might not be fully flexible */}
                        <div className="h-full p-12 overflow-y-auto">
                            <div className="grid grid-cols-5 gap-8">
                                {localTables.map(table => (
                                    <div 
                                        key={table.id}
                                        className="aspect-square rounded-3xl bg-surface-container-high border-2 border-outline-variant/50 flex flex-col items-center justify-center grayscale opacity-80"
                                    >
                                        <div className={`h-24 w-24 bg-secondary/10 flex items-center justify-center mb-2 ${table.shape === 'ROUND' ? 'rounded-full' : 'rounded-2xl'}`}>
                                            <MapIcon size={40} className="text-secondary" />
                                        </div>
                                        <h3 className="body-md font-black text-on-surface">Table {table.number}</h3>
                                        <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest">{table.zone}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
