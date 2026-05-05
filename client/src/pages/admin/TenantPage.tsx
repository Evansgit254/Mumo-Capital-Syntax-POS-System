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
    primaryColor: '#008B8B',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
    taxRate: 16.0,
};

export default function TenantPage() {
    const { session, ui } = useStore();
    const queryClient = useQueryClient();

    const [form, setForm] = useState({ ...DEFAULT_SETTINGS });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const [dirty, setDirty] = useState(false);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const settingsQuery = useQuery({
        queryKey: ['tenant-settings'],
        queryFn: tenantService.getSettings,
    });

    // Populate form from server data
    useEffect(() => {
        if (settingsQuery.data) {
            const d = settingsQuery.data;
            setForm({
                displayName: d.displayName || session.tenantName || '',
                logoUrl: d.logoUrl || '',
                primaryColor: d.primaryColor || '#008B8B',
                currency: d.currency || 'KES',
                timezone: d.timezone || 'Africa/Nairobi',
                taxRate: d.taxRate ?? 16.0,
            });
        }
    }, [settingsQuery.data, session.tenantName]);

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!form.displayName.trim()) errs.displayName = 'Display name is required';
        if (form.displayName.length > 100) errs.displayName = 'Max 100 characters';
        if (form.logoUrl && !/^https?:\/\/.+/i.test(form.logoUrl))
            errs.logoUrl = 'Must be a valid URL starting with http:// or https://';
        if (!/^#[0-9a-fA-F]{6}$/.test(form.primaryColor))
            errs.primaryColor = 'Must be a valid hex color (e.g. #008B8B)';
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
            queryClient.setQueryData(['tenant-settings'], (old: any) => ({ ...old, ...data }));
            // Live-update the CSS variable for primary color
            applyPrimaryColor(data.primaryColor);
            return { previous };
        },
        onError: (err, _vars, context) => {
            queryClient.setQueryData(['tenant-settings'], context?.previous);
            // Rollback color
            if (context?.previous) {
                applyPrimaryColor((context.previous as any).primaryColor || '#008B8B');
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
        // Live preview
        if (/^#[0-9a-fA-F]{6}$/.test(color)) {
            applyPrimaryColor(color);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        saveMutation.mutate(form);
    };

    const updateField = (key: string, value: any) => {
        setForm(f => ({ ...f, [key]: value }));
        setDirty(true);
        if (errors[key]) setErrors(e => ({ ...e, [key]: '' }));
    };

    return (
        <div className="p-6 tablet:p-10 space-y-8 max-w-3xl">
            {/* Toast */}
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

            {/* Header */}
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
                    {Array(5)
                        .fill(0)
                        .map((_, i) => (
                            <div
                                key={i}
                                className="h-[72px] rounded-xl bg-surface-container-low animate-pulse"
                            />
                        ))}
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-10">
                    {/* Identity Section */}
                    <section className="space-y-6">
                        <h2 className="headline-md text-on-surface flex items-center gap-3">
                            <Building2 size={20} className="text-on-surface-variant" />
                            Identity
                        </h2>

                        <FormField label="Display Name" error={errors.displayName}>
                            <input
                                id="tenant-display-name"
                                type="text"
                                value={form.displayName}
                                onChange={e => updateField('displayName', e.target.value)}
                                placeholder="My Restaurant"
                                className="input-field"
                            />
                        </FormField>

                        <FormField
                            label="Logo URL"
                            error={errors.logoUrl}
                            helpText="Provide a direct link to your logo image"
                        >
                            <div className="flex gap-3 items-start">
                                <div className="flex-1">
                                    <div className="relative">
                                        <Image
                                            size={18}
                                            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                                        />
                                        <input
                                            id="tenant-logo-url"
                                            type="text"
                                            value={form.logoUrl}
                                            onChange={e => updateField('logoUrl', e.target.value)}
                                            placeholder="https://example.com/logo.png"
                                            className="input-field !pl-11"
                                        />
                                    </div>
                                </div>
                                {form.logoUrl && /^https?:\/\/.+/i.test(form.logoUrl) && (
                                    <div className="h-14 w-14 rounded-xl border border-outline-variant overflow-hidden shrink-0 bg-surface-container">
                                        <img
                                            src={form.logoUrl}
                                            alt="Logo preview"
                                            className="h-full w-full object-contain"
                                            onError={e => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </FormField>
                    </section>

                    {/* Branding Section */}
                    <section className="space-y-6">
                        <h2 className="headline-md text-on-surface flex items-center gap-3">
                            <Palette size={20} className="text-on-surface-variant" />
                            Branding
                        </h2>

                        <FormField
                            label="Primary Color"
                            error={errors.primaryColor}
                            helpText="This color is applied to the sidebar and accent elements in real-time"
                        >
                            <div className="flex gap-3 items-center">
                                <input
                                    id="tenant-primary-color-picker"
                                    type="color"
                                    value={form.primaryColor}
                                    onChange={e => handleColorChange(e.target.value)}
                                    className="h-14 w-14 rounded-xl border-2 border-outline-variant cursor-pointer bg-transparent"
                                />
                                <input
                                    id="tenant-primary-color-hex"
                                    type="text"
                                    value={form.primaryColor}
                                    onChange={e => handleColorChange(e.target.value)}
                                    placeholder="#008B8B"
                                    className="input-field flex-1 font-mono"
                                    maxLength={7}
                                />
                                <div
                                    className="h-14 w-24 rounded-xl border border-outline-variant"
                                    style={{ backgroundColor: form.primaryColor }}
                                />
                            </div>
                        </FormField>
                    </section>

                    {/* Financial Section */}
                    <section className="space-y-6">
                        <h2 className="headline-md text-on-surface flex items-center gap-3">
                            <DollarSign size={20} className="text-on-surface-variant" />
                            Financial
                        </h2>

                        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-6">
                            <FormField label="Currency Symbol" error={errors.currency}>
                                <div className="relative">
                                    <DollarSign
                                        size={18}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                                    />
                                    <input
                                        id="tenant-currency"
                                        type="text"
                                        value={form.currency}
                                        onChange={e => updateField('currency', e.target.value)}
                                        placeholder="KES"
                                        className="input-field !pl-11"
                                        maxLength={5}
                                    />
                                </div>
                            </FormField>

                            <FormField label="Tax Rate (%)" error={errors.taxRate}>
                                <div className="relative">
                                    <Percent
                                        size={18}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                                    />
                                    <input
                                        id="tenant-tax-rate"
                                        type="number"
                                        value={form.taxRate}
                                        onChange={e =>
                                            updateField('taxRate', parseFloat(e.target.value) || 0)
                                        }
                                        placeholder="16.0"
                                        className="input-field !pl-11"
                                        min={0}
                                        max={100}
                                        step={0.1}
                                    />
                                </div>
                            </FormField>
                        </div>
                    </section>

                    {/* Locale Section */}
                    <section className="space-y-6">
                        <h2 className="headline-md text-on-surface flex items-center gap-3">
                            <Globe size={20} className="text-on-surface-variant" />
                            Locale
                        </h2>

                        <FormField label="Timezone">
                            <select
                                id="tenant-timezone"
                                value={form.timezone}
                                onChange={e => updateField('timezone', e.target.value)}
                                className="input-field cursor-pointer"
                            >
                                {TIMEZONES.map(tz => (
                                    <option key={tz} value={tz}>
                                        {tz}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                    </section>

                    {/* Save */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={!dirty || saveMutation.isPending}
                            className="btn-primary"
                            id="save-tenant-settings"
                        >
                            {saveMutation.isPending ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <Save size={20} />
                            )}
                            Save Changes
                        </button>
                    </div>
                </form>
            )}

            {/* Danger Zone */}
            <div className="card-default !border-red-500/30 !bg-red-500/5 p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className="text-red-400" />
                    <h3 className="body-md font-bold text-red-400">Danger Zone</h3>
                </div>
                <p className="text-sm text-on-surface-variant">
                    Resetting will revert all tenant settings (display name, logo, color, currency,
                    tax rate, timezone) back to factory defaults. This cannot be undone.
                </p>
                <button
                    onClick={() => setShowResetModal(true)}
                    className="h-10 px-6 rounded-lg text-sm font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    id="reset-settings-btn"
                >
                    <RotateCcw size={16} />
                    Reset All Settings
                </button>
            </div>

            {/* Reset Confirmation Modal */}
            {showResetModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="card-default max-w-md w-full mx-4 p-8 space-y-6 !border-red-500/30">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                                <AlertTriangle size={24} className="text-red-400" />
                            </div>
                            <div>
                                <h3 className="headline-md text-on-surface">Confirm Reset</h3>
                                <p className="text-sm text-on-surface-variant">
                                    This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <p className="body-md text-on-surface-variant">
                            Are you sure you want to reset all tenant settings to their default
                            values? This will immediately affect all users.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowResetModal(false)}
                                className="btn-secondary !h-10"
                                id="cancel-reset-btn"
                            >
                                <X size={16} />
                                Cancel
                            </button>
                            <button
                                onClick={() => resetMutation.mutate()}
                                disabled={resetMutation.isPending}
                                className="h-10 px-6 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                                id="confirm-reset-btn"
                            >
                                <Check size={16} />
                                {resetMutation.isPending ? 'Resetting…' : 'Yes, Reset Everything'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
