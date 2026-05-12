import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantService, getErrorMessage } from '../../api/service';
import { useStore } from '../../store/useStore';
import FormField from '../../components/ui/FormField';
import {
    Building2,
    Palette,
    Globe,
    DollarSign,
    Percent,
    Image,
    RotateCcw,
    AlertTriangle,
    Save,
    Check,
    X,
    Loader2
} from 'lucide-react';

const TIMEZONES = [
    'Africa/Nairobi',
    'Africa/Lagos',
    'Africa/Cairo',
    'Africa/Johannesburg',
    'Europe/London',
    'Europe/Berlin',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Dubai',
    'Asia/Singapore',
];

const DEFAULT_SETTINGS = {
    displayName: '',
    logoUrl: '',
    primaryColor: 'var(--color-secondary)',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
    taxRate: 0,
    outletType: 'RESTAURANT',
    operatingHours: {
        Mon: { open: '08:00', close: '22:00' },
        Tue: { open: '08:00', close: '22:00' },
        Wed: { open: '08:00', close: '22:00' },
        Thu: { open: '08:00', close: '22:00' },
        Fri: { open: '08:00', close: '23:00' },
        Sat: { open: '09:00', close: '23:00' },
        Sun: { open: '09:00', close: '21:00' }
    },
    receiptConfig: {
        header: 'Welcome to Mumo POS',
        footer: 'Thank you for your visit!',
        showTax: true,
        showLogo: true
    }
};

const OUTLET_TYPES = ['RESTAURANT', 'BAR', 'CAFE', 'ROOM_SERVICE', 'POOL_BAR'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TenantPage() {
    const { session, ui } = useStore();
    const queryClient = useQueryClient();

    const [form, setForm] = useState({ ...DEFAULT_SETTINGS });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [activeTab, setActiveTab] = useState<'BASIC' | 'DETAILED'>('BASIC');

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const settingsQuery = useQuery({
        queryKey: ['tenant-settings'],
        queryFn: tenantService.getSettings,
    });

    useEffect(() => {
        if (settingsQuery.data) {
            const d = settingsQuery.data;
            setForm({
                displayName: d.displayName || session.tenantName || '',
                logoUrl: d.logoUrl || '',
                primaryColor: d.primaryColor || 'var(--color-secondary)',
                currency: d.currency || 'KES',
                timezone: d.timezone || 'Africa/Nairobi',
                taxRate: d.taxRate ?? 0,
                outletType: d.outletType || 'RESTAURANT',
                operatingHours: d.operatingHours as typeof DEFAULT_SETTINGS.operatingHours || DEFAULT_SETTINGS.operatingHours,
                receiptConfig: d.receiptConfig as typeof DEFAULT_SETTINGS.receiptConfig || DEFAULT_SETTINGS.receiptConfig,
            });
        }
    }, [settingsQuery.data, session.tenantName]);

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!form.displayName.trim()) errs.displayName = 'Display name is required';
        if (form.displayName.length > 100) errs.displayName = 'Max 100 characters';
        if (form.logoUrl && !/^https?:\/\/.+/i.test(form.logoUrl))
            errs.logoUrl = 'Must be a valid URL starting with http:// or https://';
        if (!/^#[0-9a-fA-F]{6}$/.test(form.primaryColor) && !/^var\(--[a-z0-9-]+\)$/.test(form.primaryColor))
            errs.primaryColor = 'Must be a valid theme color token or hex color';
        if (!form.currency.trim()) errs.currency = 'Currency is required';
        if (form.currency.length > 5) errs.currency = 'Max 5 characters';
        if (isNaN(form.taxRate) || form.taxRate < 0 || form.taxRate > 100)
            errs.taxRate = 'Tax rate must be between 0 and 100';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const saveMutation = useMutation({
        mutationFn: (data: typeof form) => tenantService.updateSettings(data),
        onMutate: async (data) => {
            await queryClient.cancelQueries({ queryKey: ['tenant-settings'] });
            const previous = queryClient.getQueryData(['tenant-settings']);
            queryClient.setQueryData(['tenant-settings'], (old: LooseValue) => ({ ...old, ...data }));
            applyPrimaryColor(data.primaryColor);
            return { previous };
        },
        onError: (err, _vars, context) => {
            queryClient.setQueryData(['tenant-settings'], context?.previous);
            if (context?.previous) {
                applyPrimaryColor((context.previous as any).primaryColor || 'var(--color-secondary)');
            }
            showToast(getErrorMessage(err), 'error');
        },
        onSuccess: () => {
            showToast('Settings saved successfully', 'success');
            setDirty(false);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['tenant-settings'] }),
    });

    const resetMutation = useMutation({
        mutationFn: () => tenantService.updateSettings(DEFAULT_SETTINGS),
        onSuccess: () => {
            setForm({ ...DEFAULT_SETTINGS });
            applyPrimaryColor(DEFAULT_SETTINGS.primaryColor);
            ui.setPrimaryColor(DEFAULT_SETTINGS.primaryColor);
            showToast('Settings reset to defaults', 'success');
            setShowResetModal(false);
            setDirty(false);
        },
        onError: (err) => showToast(getErrorMessage(err), 'error'),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['tenant-settings'] }),
    });

    const applyPrimaryColor = (color: string) => {
        document.documentElement.style.setProperty('--color-secondary', color);
        ui.setPrimaryColor(color);
    };

    const handleColorChange = (color: string) => {
        setForm(f => ({ ...f, primaryColor: color }));
        setDirty(true);
        if (/^#[0-9a-fA-F]{6}$/.test(color) || /^var\(--[a-z0-9-]+\)$/.test(color)) {
            applyPrimaryColor(color);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        saveMutation.mutate(form);
    };

    const updateField = (key: string, value: LooseValue) => {
        setForm(f => ({ ...f, [key]: value }));
        setDirty(true);
        if (errors[key]) setErrors(e => ({ ...e, [key]: '' }));
    };

    const cn = (...inputs: LooseValue[]) => inputs.filter(Boolean).join(' ');

    return (
        <div className="p-6 tablet:p-10 space-y-8 max-w-3xl">
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all ${
                        toast.type === 'success'
                            ? 'bg-secondary text-white'
                            : 'bg-red-600 text-white'
                    }`}
                >
                    {toast.message}
                </div>
            )}

            <div className="flex flex-col gap-1">
                <h1 className="display-lg text-on-surface flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                        <Building2 size={28} className="text-secondary" />
                    </div>
                    Tenant Settings
                </h1>
                <p className="body-lg text-on-surface-variant">
                    Configure your organization's identity, branding, and financial settings.
                </p>
            </div>

            {settingsQuery.isLoading ? (
                <div className="space-y-6">
                    {Array(5).fill(0).map((_, i) => (
                        <div key={i} className="h-[72px] rounded-xl bg-surface-container-low animate-pulse" />
                    ))}
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="flex gap-1 bg-surface-container rounded-2xl p-1 border border-outline-variant/30">
                        <button 
                            type="button"
                            onClick={() => setActiveTab('BASIC')}
                            className={cn(
                                "flex-1 h-12 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                activeTab === 'BASIC' ? "bg-secondary text-white shadow-lg" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                            )}
                        >
                            Basic Configuration
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('DETAILED')}
                            className={cn(
                                "flex-1 h-12 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                activeTab === 'DETAILED' ? "bg-secondary text-white shadow-lg" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                            )}
                        >
                            Detailed Customization
                        </button>
                    </div>

                    {activeTab === 'BASIC' ? (
                        <section className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <section className="space-y-6">
                                <h2 className="headline-md text-on-surface flex items-center gap-3 border-b border-outline-variant/20 pb-4">
                                    <Building2 size={20} className="text-secondary" /> Organization Identity
                                </h2>
                                <div className="grid grid-cols-1 tablet:grid-cols-2 gap-6">
                                    <FormField label="Outlet Name" error={errors.displayName}>
                                        <input 
                                            value={form.displayName} 
                                            onChange={e => updateField('displayName', e.target.value)} 
                                            className="input-field" 
                                        />
                                    </FormField>
                                    <FormField label="Outlet Type">
                                        <select 
                                            value={form.outletType} 
                                            onChange={e => updateField('outletType', e.target.value)} 
                                            className="input-field uppercase tracking-wider font-bold"
                                        >
                                            {OUTLET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </FormField>
                                </div>
                                <FormField label="Logo Reference URL" error={errors.logoUrl}>
                                    <input 
                                        value={form.logoUrl} 
                                        onChange={e => updateField('logoUrl', e.target.value)} 
                                        className="input-field" 
                                        placeholder="https://brand.mumo.pos/logo.png"
                                    />
                                </FormField>
                            </section>

                            <section className="space-y-6">
                                <h2 className="headline-md text-on-surface flex items-center gap-3 border-b border-outline-variant/20 pb-4">
                                    <Palette size={20} className="text-secondary" /> Brand Aesthetic
                                </h2>
                                <FormField label="Primary Accent Color" error={errors.primaryColor}>
                                    <div className="flex gap-4 items-center">
                                        <input 
                                            type="color" 
                                            value={form.primaryColor} 
                                            onChange={e => handleColorChange(e.target.value)} 
                                            className="h-16 w-16 rounded-2xl cursor-pointer bg-transparent border-2 border-outline-variant p-1 shadow-sm" 
                                        />
                                        <input 
                                            type="text" 
                                            value={form.primaryColor} 
                                            onChange={e => handleColorChange(e.target.value)} 
                                            className="input-field flex-1 font-mono uppercase" 
                                        />
                                    </div>
                                </FormField>
                            </section>

                            <section className="space-y-6">
                                <h2 className="headline-md text-on-surface flex items-center gap-3 border-b border-outline-variant/20 pb-4">
                                    <Globe size={20} className="text-secondary" /> Regional & Financial
                                </h2>
                                <div className="grid grid-cols-1 tablet:grid-cols-3 gap-6">
                                    <FormField label="Currency" error={errors.currency}>
                                        <input value={form.currency} onChange={e => updateField('currency', e.target.value)} className="input-field" />
                                    </FormField>
                                    <FormField label="Tax Rate %" error={errors.taxRate}>
                                        <input type="number" step="0.01" value={form.taxRate || ''} onChange={e => updateField('taxRate', parseFloat(e.target.value) || 0)} className="input-field" />
                                    </FormField>
                                    <FormField label="System Timezone">
                                        <select value={form.timezone} onChange={e => updateField('timezone', e.target.value)} className="input-field text-sm">
                                            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                        </select>
                                    </FormField>
                                </div>
                            </section>
                        </section>
                    ) : (
                        <section className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <section className="space-y-6">
                                <h2 className="headline-md text-on-surface flex items-center gap-3 border-b border-outline-variant/20 pb-4">
                                    <RotateCcw size={20} className="text-secondary" /> Operating Schedule
                                </h2>
                                <div className="card-default p-6 space-y-4">
                                    {DAYS.map(day => (
                                        <div key={day} className="flex items-center justify-between py-2 border-b border-outline-variant last:border-0">
                                            <span className="body-md font-black w-24">{day}</span>
                                            <div className="flex gap-4 items-center">
                                                <input 
                                                    type="time" 
                                                    value={(form.operatingHours as any)[day]?.open} 
                                                    onChange={e => updateField('operatingHours', { ...form.operatingHours, [day]: { ...(form.operatingHours as any)[day], open: e.target.value } })}
                                                    className="h-10 px-4 bg-surface-container rounded-lg border border-outline-variant text-sm font-bold"
                                                />
                                                <span className="text-on-surface-variant text-xs font-bold">—</span>
                                                <input 
                                                    type="time" 
                                                    value={(form.operatingHours as any)[day]?.close} 
                                                    onChange={e => updateField('operatingHours', { ...form.operatingHours, [day]: { ...(form.operatingHours as any)[day], close: e.target.value } })}
                                                    className="h-10 px-4 bg-surface-container rounded-lg border border-outline-variant text-sm font-bold"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-6">
                                <h2 className="headline-md text-on-surface flex items-center gap-3 border-b border-outline-variant/20 pb-4">
                                    <Image size={20} className="text-secondary" /> Digital Receipt Branding
                                </h2>
                                <div className="space-y-6">
                                    <FormField label="Receipt Header Text">
                                        <textarea 
                                            value={(form.receiptConfig as any).header}
                                            onChange={e => updateField('receiptConfig', { ...form.receiptConfig, header: e.target.value })}
                                            className="input-field h-24"
                                        />
                                    </FormField>
                                    <FormField label="Receipt Footer Text">
                                        <textarea 
                                            value={(form.receiptConfig as any).footer}
                                            onChange={e => updateField('receiptConfig', { ...form.receiptConfig, footer: e.target.value })}
                                            className="input-field h-24"
                                        />
                                    </FormField>
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex items-center gap-4 p-4 card-default cursor-pointer group">
                                            <input 
                                                type="checkbox" 
                                                checked={(form.receiptConfig as any).showTax}
                                                onChange={e => updateField('receiptConfig', { ...form.receiptConfig, showTax: e.target.checked })}
                                                className="h-6 w-6 rounded border-outline-variant checked:bg-secondary"
                                            />
                                            <span className="body-md font-bold group-hover:text-secondary transition-colors">Itemized Tax Breakdown</span>
                                        </label>
                                        <label className="flex items-center gap-4 p-4 card-default cursor-pointer group">
                                            <input 
                                                type="checkbox" 
                                                checked={(form.receiptConfig as any).showLogo}
                                                onChange={e => updateField('receiptConfig', { ...form.receiptConfig, showLogo: e.target.checked })}
                                                className="h-6 w-6 rounded border-outline-variant checked:bg-secondary"
                                            />
                                            <span className="body-md font-bold group-hover:text-secondary transition-colors">Digital Logo Header</span>
                                        </label>
                                    </div>
                                </div>
                            </section>
                        </section>
                    )}

                    <div className="flex gap-4 pt-8 sticky bottom-0 bg-surface/90 backdrop-blur-md pb-4 border-t border-outline-variant/30 mt-8 z-10">
                        <button
                            type="submit"
                            disabled={!dirty || saveMutation.isPending}
                            className="btn-primary h-14 px-10 shadow-xl shadow-secondary/20"
                        >
                            {saveMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            Settle Final Settings
                        </button>
                    </div>
                </form>
            )}

            <div className="card-default !border-red-500/30 !bg-red-500/5 p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className="text-red-400" />
                    <h3 className="body-md font-bold text-red-400">Danger Zone</h3>
                </div>
                <button
                    onClick={() => setShowResetModal(true)}
                    className="h-10 px-6 rounded-lg text-sm font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                    <RotateCcw size={16} />
                    Reset All Settings
                </button>
            </div>

            {showResetModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="card-default max-w-md w-full mx-4 p-8 space-y-6 !border-red-500/30">
                        <div className="flex items-center gap-3">
                            <AlertTriangle size={24} className="text-red-400" />
                            <h3 className="headline-md text-on-surface">Confirm Reset</h3>
                        </div>
                        <p className="body-md text-on-surface-variant">Are you sure you want to reset all tenant settings? This cannot be undone.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowResetModal(false)} className="btn-secondary !h-10">Cancel</button>
                            <button
                                onClick={() => resetMutation.mutate()}
                                disabled={resetMutation.isPending}
                                className="h-10 px-6 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
                            >
                                {resetMutation.isPending ? 'Resetting…' : 'Yes, Reset Everything'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
