import React, { useState, useEffect } from 'react';
import { FileText, AlertCircle } from 'lucide-react';
import Dialog from '../ui/Dialog';

interface NoteDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    note: string;
    onSave: (note: string) => void;
}

/**
 * DEEP-WARN-011: Notes sent to server - Added 200 char validation.
 * DEEP-WARN-012: Modal accessibility - Uses Dialog component.
 */
export default function NoteDrawer({ isOpen, onClose, note, onSave }: NoteDrawerProps) {
    const [tempNote, setTempNote] = useState(note);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setTempNote(note);
        setError(null);
    }, [note, isOpen]);

    const handleSave = () => {
        if (tempNote.length > 200) {
            setError('Note cannot exceed 200 characters');
            return;
        }
        onSave(tempNote);
        onClose();
    };

    return (
        <Dialog 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Order Notes"
            size="md"
        >
            <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 bg-secondary/5 rounded-2xl border border-secondary/10 text-secondary">
                    <FileText size={20} />
                    <span className="font-bold">Special Instructions</span>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-white/40 block">
                        Kitchen Notes
                    </label>
                    <textarea 
                        className="w-full h-48 bg-white/5 border border-white/10 rounded-2xl p-6 text-white placeholder:text-white/20 focus:ring-2 focus:ring-secondary/40 focus:border-secondary transition-all resize-none"
                        placeholder="e.g. Extra spicy, No onions, Guest allergic to peanuts..."
                        value={tempNote}
                        onChange={(e) => {
                            setTempNote(e.target.value);
                            if (e.target.value.length <= 200) setError(null);
                        }}
                    />
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest px-2">
                        <span className={tempNote.length > 200 ? "text-red-400" : "text-white/40"}>
                            {tempNote.length} / 200 Characters
                        </span>
                        {tempNote.length > 200 && (
                            <span className="text-red-400 flex items-center gap-1">
                                <AlertCircle size={10} /> Too long
                            </span>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-xl flex items-center gap-3 text-red-400">
                        <AlertCircle size={18} />
                        <p className="text-sm font-bold uppercase tracking-wider">{error}</p>
                    </div>
                )}

                <div className="p-4 bg-orange-400/10 border border-orange-400/20 rounded-xl flex gap-3 text-orange-400">
                    <AlertCircle size={18} className="shrink-0" />
                    <p className="text-xs font-bold leading-tight uppercase tracking-wide">
                        These notes will be printed on kitchen tickets and visible on the KDS.
                    </p>
                </div>

                <div className="pt-6 border-t border-white/10">
                    <button 
                        onClick={handleSave}
                        className="w-full h-16 bg-secondary hover:bg-secondary-dark text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-secondary/20 active:scale-[0.98] transition-all"
                    >
                        Save Notes
                    </button>
                </div>
            </div>
        </Dialog>
    );
}
