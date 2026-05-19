import React, { useEffect, useRef } from 'react';
import FocusTrap from 'focus-trap-react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    className?: string;
}

/**
 * DEEP-WARN-012: Centralized accessible dialog component.
 */
export default function Dialog({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    className
}: DialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent background scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-[95vw] h-[90vh]'
    };

    return (
        <FocusTrap active={isOpen} focusTrapOptions={{ fallbackFocus: '#dialog-title' }}>
            <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="dialog-title"
                    className={cn(
                        "w-full bg-surface rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200",
                        sizeClasses[size],
                        className
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                        <h2 id="dialog-title" className="text-xl font-semibold text-white">
                            {title}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/60 hover:text-white"
                            aria-label="Close dialog"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {children}
                    </div>
                </div>
            </div>
        </FocusTrap>
    );
}
