import React from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center p-12 text-center", className)}>
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-4">
                {icon}
            </div>
            <h3 className="headline-md text-on-surface mb-2">{title}</h3>
            {description && <p className="body-md text-on-surface-variant max-w-xs mx-auto mb-6">{description}</p>}
            {action}
        </div>
    );
}
