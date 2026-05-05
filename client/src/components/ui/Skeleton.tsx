import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

export default function Skeleton({ className, variant = 'rect' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-surface-container-highest',
        variant === 'circle' && 'rounded-full',
        variant === 'text' && 'h-4 w-3/4 rounded',
        variant === 'rect' && 'rounded-lg',
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="card-default animate-pulse space-y-4">
      <Skeleton className="h-40 w-full" />
      <div className="space-y-2">
        <Skeleton variant="text" className="w-1/2" />
        <Skeleton variant="text" className="w-full" />
      </div>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="h-[72px] border-b border-[#2c2c2c] flex items-center px-4 gap-4 animate-pulse">
      <Skeleton variant="circle" className="h-10 w-10 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-1/4" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
    </div>
  );
}
