/**
 * FIX 2 — CODEX-WARN-019: Full-page skeleton fallback for lazy-loaded routes.
 * Uses CSS custom properties from the design system — no hardcoded colors.
 */
export default function PageSkeleton() {
    return (
        <div className="p-6 tablet:p-10 space-y-8 min-h-full animate-pulse">
            {/* Header skeleton */}
            <div className="space-y-3">
                <div
                    className="h-8 w-56 rounded-xl"
                    style={{ backgroundColor: 'var(--surface-container)' }}
                />
                <div
                    className="h-4 w-80 rounded-lg"
                    style={{ backgroundColor: 'var(--surface-bright)' }}
                />
            </div>

            {/* Action bar skeleton */}
            <div className="flex gap-3">
                {[120, 100, 140].map((w, i) => (
                    <div
                        key={i}
                        className="h-11 rounded-xl"
                        style={{
                            width: w,
                            backgroundColor: 'var(--surface-container)',
                        }}
                    />
                ))}
            </div>

            {/* Content grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-2xl"
                        style={{
                            height: 220,
                            backgroundColor: 'var(--surface-container)',
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
