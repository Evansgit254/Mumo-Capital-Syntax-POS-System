import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <main className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)] flex items-center justify-center px-6 py-10">
            <section className="w-full max-w-[520px] text-center space-y-8">
                <div className="space-y-4">
                    <h1
                        className="display-lg"
                        style={{ fontFamily: 'var(--font-display)' }}
                    >
                        404
                    </h1>
                    <p className="body-md text-[var(--on-surface-variant)]">
                        This page doesn&apos;t exist or you don&apos;t have access.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => navigate('/dashboard', { replace: true })}
                    className="inline-flex h-12 items-center justify-center rounded-lg bg-[var(--color-secondary)] px-6 label-lg text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
                >
                    Go to Dashboard
                </button>
            </section>
        </main>
    );
}
