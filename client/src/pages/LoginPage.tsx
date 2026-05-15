/// <reference types="vite/client" />
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { authService, getErrorMessage } from '../api/service';
import { Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import FormField from '../components/ui/FormField';

export default function LoginPage() {
    const setSession = useStore((state) => state.setSession);
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const { accessToken, user } = await authService.login({ email, password });
            
            setSession({
                token: accessToken,
                tenantId: user.tenantId,
                tenantName: user.tenantName,
                role: user.role,
                userId: user.id,
                email: user.email,
                firstName: user.firstName,
            });

            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(getErrorMessage(err) || 'Authentication failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col sm:flex-row bg-surface overflow-hidden">
            {/* Left Panel - Brand & Proposition (Hidden on Mobile) */}
            <div className="hidden sm:flex sm:w-[60%] relative flex-col items-center justify-center p-12 overflow-hidden bg-gradient-to-br from-surface to-surface-container-low border-r border-outline-variant/30">
                {/* Dot Grid Texture */}
                <div 
                    className="absolute inset-0 opacity-[0.05]"
                    style={{
                        backgroundImage: `radial-gradient(var(--color-secondary) 1px, transparent 1px)`,
                        backgroundSize: '24px 24px'
                    }}
                />
                
                {/* Ambient Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-secondary/10 blur-[120px] rounded-full pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
                    {/* Wordmark */}
                    <div className="mb-8 animate-fade-up" style={{ animationDelay: '100ms' }}>
                        <h1 className="text-[64px] font-bold tracking-[-0.04em] leading-none text-on-surface">
                            MUMO<span className="text-secondary">.</span>
                        </h1>
                        <p className="mt-4 text-[14px] font-bold tracking-[0.2em] text-secondary/80">
                            HOSPITALITY. REDEFINED.
                        </p>
                    </div>

                    {/* Value Propositions */}
                    <div className="space-y-6 mt-12 text-left">
                        {[
                            "Institutional-grade stability and security",
                            "Real-time guest and inventory intelligence",
                            "Effortless multi-outlet orchestration"
                        ].map((bullet, idx) => (
                            <div 
                                key={idx}
                                className="flex items-center gap-4 animate-fade-up"
                                style={{ animationDelay: `${200 + idx * 100}ms` }}
                            >
                                <div className="h-6 w-6 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="text-secondary" size={14} />
                                </div>
                                <span className="body-md text-on-surface-variant font-medium">
                                    {bullet}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 sm:w-[40%] bg-surface-container flex flex-col items-center justify-center p-8 sm:p-12 relative">
                {/* Mobile Top Bar */}
                <div className="sm:hidden absolute top-12 left-0 right-0 flex flex-col items-center">
                    <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center mb-4">
                        <span className="text-xl font-bold text-white">M</span>
                    </div>
                    <p className="text-[12px] font-bold tracking-[0.15em] text-secondary/80">HOSPITALITY. REDEFINED.</p>
                </div>

                <div className="w-full max-w-[400px] animate-fade-up" style={{ animationDelay: '400ms' }}>
                    {/* Desktop Logo Mark */}
                    <div className="hidden sm:flex h-8 w-8 rounded-lg bg-secondary items-center justify-center mb-12">
                        <span className="text-sm font-bold text-white">M</span>
                    </div>

                    <div className="mb-10">
                        <h2 className="headline-md text-on-surface mb-2">Welcome back</h2>
                        <p className="body-md text-on-surface-variant">Sign in to your workspace</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <FormField 
                            label="Email Address"
                            error={error && error.includes('email') ? error : undefined}
                        >
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field"
                                placeholder="name@workspace.com"
                                autoComplete="username"
                            />
                        </FormField>

                        <FormField 
                            label="Password"
                            error={error && !error.includes('email') ? error : undefined}
                        >
                            <div className="relative group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-field !pr-28"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-on-surface-variant/70 hover:text-secondary transition-colors focus:outline-none"
                                        title={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                    <div className="h-4 w-[1px] bg-outline-variant/30" />
                                    <button
                                        type="button"
                                        className="text-secondary body-md font-semibold hover:opacity-80 transition-opacity"
                                    >
                                        Forgot?
                                    </button>
                                </div>
                            </div>
                        </FormField>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="btn-primary w-full group overflow-hidden relative"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <div className="absolute inset-0 shimmer-effect pointer-events-none" />
                                        <span className="relative z-10">Sign In</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-12 space-y-4 pt-12 border-t border-outline-variant/30">
                        <p className="body-md text-on-surface-variant/60 text-center">
                            Don't have an account?{' '}
                            <span 
                                className="text-secondary font-semibold cursor-pointer hover:underline underline-offset-4 transition-all"
                                onClick={() => navigate('/register')}
                            >
                                Register your property
                            </span>
                        </p>
                        <p className="text-[11px] text-center tracking-wider text-on-surface-variant/40 uppercase font-bold">
                            &copy; 2026 MUMO GLOBAL SYSTEMS
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

