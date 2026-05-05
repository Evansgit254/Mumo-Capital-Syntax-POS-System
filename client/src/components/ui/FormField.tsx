import React from 'react';
import { cn } from '../../lib/utils';

interface FormFieldProps {
    label: string;
    error?: string;
    helpText?: string;
    children: React.ReactNode;
    className?: string;
}

export default function FormField({ label, error, helpText, children, className }: FormFieldProps) {
    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <label className="label-sm text-on-surface-variant tracking-wider">{label}</label>
            {children}
            {error ? (
                <span className="label-sm !text-error !normal-case">{error}</span>
            ) : helpText ? (
                <span className="label-sm !text-on-surface-variant/60 !normal-case">{helpText}</span>
            ) : null}
        </div>
    );
}
