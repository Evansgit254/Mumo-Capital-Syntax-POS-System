import React from 'react';
import { X, FileText } from 'lucide-react';

interface NoteDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    note: string;
    onSave: (note: string) => void;
}

export default function NoteDrawer({ isOpen, onClose, note, onSave }: NoteDrawerProps) {
    const [tempNote, setTempNote] = React.useState(note);

    React.useEffect(() => {
        setTempNote(note);
    }, [note, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-surface-container-high h-full shadow-2xl border-l border-outline-variant flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-8 border-b border-outline-variant flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileText size={24} className="text-secondary" />
                        <h3 className="headline-md">Order Notes</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 p-8">
                    <label className="label-sm text-on-surface-variant mb-3 block">Special Instructions / Kitchen Notes</label>
                    <textarea 
                        className="w-full h-64 bg-surface-container border border-outline-variant rounded-2xl p-6 text-on-surface placeholder:text-on-surface-variant/30 focus:ring-2 focus:ring-secondary/40 focus:border-secondary transition-all resize-none body-md"
                        placeholder="e.g. Extra spicy, No onions, Guest allergic to peanuts..."
                        value={tempNote}
                        onChange={(e) => setTempNote(e.target.value)}
                    />
                    <div className="mt-6 p-4 bg-tertiary/10 border border-tertiary/20 rounded-xl flex gap-3">
                        <span className="text-tertiary font-black">!</span>
                        <p className="body-sm text-on-surface-variant leading-tight">These notes will be printed on the KDS and kitchen tickets.</p>
                    </div>
                </div>

                <div className="p-8 bg-surface-container border-t border-outline-variant">
                    <button 
                        onClick={() => {
                            onSave(tempNote);
                            onClose();
                        }}
                        className="btn-primary w-full h-[56px]"
                    >
                        Save Note
                    </button>
                </div>
            </div>
        </div>
    );
}
