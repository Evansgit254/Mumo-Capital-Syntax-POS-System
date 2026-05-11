/// <reference types="vite/client" />
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import axios from 'axios';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const setSession = useStore((state) => state.setSession);
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const res = await axios.post(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth/login`,
                { email, password },
                { withCredentials: true } // FIX 11: Accept httpOnly cookie from server
            );
            
            const { accessToken, user } = res.data;
            
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
        } catch (err: any) {
            const message = err.response?.data?.error || 'Authentication failed';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary/10 blur-[120px] rounded-full" />

            <div className="w-full max-w-[480px] px-6 relative z-10">
                {/* Logo & Header */}
                <div className="mb-12 flex flex-col items-center text-center">
                    <div className="h-16 w-16 bg-secondary rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-secondary/20">
                        <span className="text-3xl font-bold text-white">M</span>
                    </div>
                    <h1 className="display-lg text-on-surface mb-2">Mumo POS</h1>
                    <p className="body-lg text-on-surface-variant">The future of hospitality management.</p>
                </div>

                {/* Login Card */}
                <div className="bg-surface-container-high/50 backdrop-blur-xl rounded-3xl border border-outline-variant p-8 shadow-2xl">
                    {/* Error State */}
                    {error && (
                        <div className="mb-8 p-4 bg-error/10 border border-error/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="text-error shrink-0 mt-0.5" size={18} />
                            <p className="text-sm font-medium text-error leading-snug">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="label-sm text-on-surface-variant ml-1">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field"
                                placeholder="johndoe@mumo.com"
                                autoComplete="username"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="label-sm text-on-surface-variant ml-1">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field"
                                placeholder="••••••••"
                                autoComplete="current-password"
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="btn-primary w-full group relative overflow-hidden"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <span className="relative z-10">Access Dashboard</span>
                                        <LogIn size={18} className="relative z-10 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                <p className="mt-8 text-center body-md text-on-surface-variant/40">
                    &copy; 2026 Mumo Capital & Syntax POS. All rights reserved.
                </p>
            </div>
        </div>
    );
}
