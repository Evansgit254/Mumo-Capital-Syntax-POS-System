/// <reference types="vite/client" />
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useStore } from '../../store/useStore';
import { Loader2, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import FormField from '../../components/ui/FormField';

const API_URL = import.meta.env.VITE_API_URL;
const publicApi = axios.create({ baseURL: API_URL });

export default function SuperAdminLoginPage() {
    const navigate = useNavigate();
    const setSuperAdmin = useStore((s) => s.setSuperAdmin);

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
            const { data } = await publicApi.post('/api/super-admin/login', { email, password });
            setSuperAdmin({
                token: data.token,
                id: data.superAdmin.id,
                email: data.superAdmin.email,
                name: data.superAdmin.name,
            });
            navigate('/super-admin/applications', { replace: true });
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Authentication failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col sm:flex-row bg-surface overflow-hidden">
            {/* Left Panel */}
            <div className="hidden sm:flex sm:w-[60%] relative flex-col items-center justify-center p-12 overflow-hidden bg-gradient-to-br from-surface to-surface-container-low border-r border-outline-variant/30">
                <div
                    className="absolute inset-0 opacity-[0.05]"
                    style={{
                        backgroundImage: `radial-gradient(var(--color-secondary) 1px, transparent 1px)`,
                        backgroundSize: '24px 24px',
                    }}
                />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-secondary/10 blur-[120px] rounded-full pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center text-center max-w-lg animate-fade-up">
                    <div className="h-20 w-20 rounded-2xl bg-secondary/10 flex items-center justify-center mb-8">
                        <ShieldAlert className="text-secondary" size={40} />
                    </div>
                    <h1 className="text-[48px] font-bold tracking-[-0.04em] leading-none text-on-surface">
                        Super Admin<span className="text-secondary">.</span>
                    </h1>
                    <p className="mt-4 text-[14px] font-bold tracking-[0.2em] text-secondary/80">
                        PLATFORM ADMINISTRATION
                    </p>
                    <div className="mt-8 px-6 py-3 rounded-xl bg-tertiary/10 border border-tertiary/30">
                        <p className="text-sm text-tertiary font-semibold">
                            ⚠ Restricted Access — Authorized Personnel Only
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="flex-1 sm:w-[40%] bg-surface-container flex flex-col items-center justify-center p-8 sm:p-12 relative">
                {/* Mobile header */}
                <div className="sm:hidden absolute top-12 left-0 right-0 flex flex-col items-center">
                    <div className="h-12 w-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
                        <ShieldAlert className="text-secondary" size={24} />
                    </div>
                    <p className="text-[12px] font-bold tracking-[0.15em] text-secondary/80">
                        SUPER ADMIN PORTAL
                    </p>
                </div>

                <div className="w-full max-w-[400px] animate-fade-up" style={{ animationDelay: '400ms' }}>
                    <div className="hidden sm:flex h-8 w-8 rounded-lg bg-secondary items-center justify-center mb-12">
                        <span className="text-sm font-bold text-white">M</span>
                    </div>

                    <div className="mb-10">
                        <h2 className="headline-md text-on-surface mb-2">Super Admin Portal</h2>
                        <p className="body-md text-on-surface-variant">Sign in to manage tenant applications</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <FormField label="Email Address" error={error && error.includes('email') ? error : undefined}>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field"
                                placeholder="super@mumo.app"
                                autoComplete="username"
                            />
                        </FormField>

                        <FormField label="Password" error={error && !error.includes('email') ? error : undefined}>
                            <div className="relative group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-field !pr-12"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/70 hover:text-secondary transition-colors focus:outline-none"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </FormField>

                        <div className="pt-4">
                            <button type="submit" disabled={isSubmitting} className="btn-primary w-full group overflow-hidden relative">
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

                    <div className="mt-12 pt-12 border-t border-outline-variant/30 text-center">
                        <p className="text-[11px] tracking-wider text-on-surface-variant/40 uppercase font-bold">
                            © 2026 MUMO GLOBAL SYSTEMS
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
