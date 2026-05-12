import { useStore } from '../store/useStore';
import FormField from '../components/ui/FormField';
import {
    Settings,
    Printer,
    ScanBarcode,
    Monitor,
    Sun,
    Moon,
    Wifi,
    Check,
    X,
} from 'lucide-react';
import { useState } from 'react';

export default function SettingsPage() {
    const { hardware, setHardware } = useStore();
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [printerIp, setPrinterIp] = useState(hardware.printerIp);
    const [printerPort, setPrinterPort] = useState(hardware.printerPort);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const validatePrinter = (): boolean => {
        const errs: Record<string, string> = {};
        if (printerIp && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(printerIp)) {
            errs.printerIp = 'Must be a valid IPv4 address (e.g. 192.168.1.100)';
        }
        if (printerPort) {
            const port = parseInt(printerPort);
            if (isNaN(port) || port < 1 || port > 65535) {
                errs.printerPort = 'Port must be between 1 and 65535';
            }
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const savePrinter = () => {
        if (!validatePrinter()) return;
        setHardware({ printerIp, printerPort });
        showToast('Printer settings saved', 'success');
    };

    const testPrint = () => {
        if (!printerIp) {
            showToast('Please configure printer IP first', 'error');
            return;
        }
        showToast(`Test print sent to ${printerIp}:${printerPort}`, 'success');
    };

    const toggleTheme = () => {
        const newTheme = hardware.theme === 'dark' ? 'light' : 'dark';
        setHardware({ theme: newTheme });
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const toggleScanner = () => {
        const enabled = !hardware.scannerEnabled;
        setHardware({ scannerEnabled: enabled });
        showToast(
            enabled ? 'Barcode scanner mode enabled' : 'Barcode scanner mode disabled',
            'success'
        );
    };

    // Apply theme on mount
    if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', hardware.theme);
    }

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
                        <Settings size={28} className="text-secondary" />
                    </div>
                    Settings
                </h1>
                <p className="body-lg text-on-surface-variant">
                    Configure hardware peripherals and display preferences.
                </p>
            </div>

            {/* ── Printer Configuration ───────────────────────────────────── */}
            <section className="card-default p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                        <Printer size={20} className="text-secondary" />
                    </div>
                    <div>
                        <h2 className="body-md font-bold text-on-surface">Printer Configuration</h2>
                        <p className="text-sm text-on-surface-variant">
                            Connect to a network receipt printer
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 tablet:grid-cols-2 gap-6">
                    <FormField label="Printer IP Address" error={errors.printerIp}>
                        <div className="relative">
                            <Wifi
                                size={18}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                            />
                            <input
                                id="printer-ip"
                                type="text"
                                value={printerIp}
                                onChange={e => {
                                    setPrinterIp(e.target.value);
                                    if (errors.printerIp) setErrors(e2 => ({ ...e2, printerIp: '' }));
                                }}
                                placeholder="192.168.1.100"
                                className="input-field !pl-11"
                            />
                        </div>
                    </FormField>

                    <FormField label="Port" error={errors.printerPort}>
                        <input
                            id="printer-port"
                            type="text"
                            value={printerPort}
                            onChange={e => {
                                setPrinterPort(e.target.value);
                                if (errors.printerPort) setErrors(e2 => ({ ...e2, printerPort: '' }));
                            }}
                            placeholder="9100"
                            className="input-field"
                        />
                    </FormField>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={savePrinter}
                        className="btn-primary !h-10 !px-5 !text-sm"
                        id="save-printer-btn"
                    >
                        <Check size={16} />
                        Save
                    </button>
                    <button
                        onClick={testPrint}
                        className="btn-secondary !h-10 !px-5 !text-sm"
                        id="test-print-btn"
                    >
                        <Printer size={16} />
                        Test Print
                    </button>
                </div>

                {/* Connection Status */}
                {hardware.printerIp && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-container-low border border-outline-variant">
                        <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
                        <span className="text-sm text-on-surface-variant">
                            Configured: <strong className="text-on-surface">{hardware.printerIp}:{hardware.printerPort}</strong>
                        </span>
                    </div>
                )}
            </section>

            {/* ── Barcode Scanner ─────────────────────────────────────────── */}
            <section className="card-default p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                            <ScanBarcode size={20} className="text-secondary" />
                        </div>
                        <div>
                            <h2 className="body-md font-bold text-on-surface">Barcode Scanner</h2>
                            <p className="text-sm text-on-surface-variant">
                                Enable rapid keyboard input detection for barcode scanners
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={toggleScanner}
                        className={`relative h-8 w-14 rounded-full transition-colors duration-300 shrink-0 ${
                            hardware.scannerEnabled ? 'bg-secondary' : 'bg-surface-container-highest'
                        }`}
                        id="scanner-toggle"
                    >
                        <div
                            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                                hardware.scannerEnabled ? 'translate-x-7' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>

                <div
                    className={`px-4 py-3 rounded-lg border text-sm transition-all ${
                        hardware.scannerEnabled
                            ? 'bg-secondary/5 border-secondary/20 text-secondary'
                            : 'bg-surface-container-low border-outline-variant text-on-surface-variant'
                    }`}
                >
                    {hardware.scannerEnabled ? (
                        <span className="flex items-center gap-2">
                            <Check size={14} />
                            Scanner mode active — listening for rapid key sequences
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <X size={14} />
                            Scanner mode disabled
                        </span>
                    )}
                </div>
            </section>

            {/* ── Display Settings ────────────────────────────────────────── */}
            <section className="card-default p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                            <Monitor size={20} className="text-secondary" />
                        </div>
                        <div>
                            <h2 className="body-md font-bold text-on-surface">Display</h2>
                            <p className="text-sm text-on-surface-variant">
                                Toggle between dark and light mode
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={toggleTheme}
                        className={`relative h-8 w-14 rounded-full transition-colors duration-300 shrink-0 ${
                            hardware.theme === 'dark' ? 'bg-surface-container-highest' : 'bg-secondary'
                        }`}
                        id="theme-toggle"
                    >
                        <div
                            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 flex items-center justify-center ${
                                hardware.theme === 'light' ? 'translate-x-7' : 'translate-x-1'
                            }`}
                        >
                            {hardware.theme === 'dark' ? (
                                <Moon size={12} className="text-surface-container-highest" />
                            ) : (
                                <Sun size={12} className="text-amber-500" />
                            )}
                        </div>
                    </button>
                </div>

                {/* Theme Preview */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => {
                            setHardware({ theme: 'dark' });
                            document.documentElement.setAttribute('data-theme', 'dark');
                        }}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                            hardware.theme === 'dark'
                                ? 'border-secondary bg-secondary/5'
                                : 'border-outline-variant hover:border-outline'
                        }`}
                        id="theme-dark-btn"
                    >
                        <div className="h-16 w-full rounded-lg bg-[var(--surface)] border border-[var(--outline-variant)] flex items-center justify-center">
                            <Moon size={20} className="text-[var(--on-surface-variant)]" />
                        </div>
                        <span className="label-sm text-on-surface-variant">Dark</span>
                    </button>

                    <button
                        onClick={() => {
                            setHardware({ theme: 'light' });
                            document.documentElement.setAttribute('data-theme', 'light');
                        }}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                            hardware.theme === 'light'
                                ? 'border-secondary bg-secondary/5'
                                : 'border-outline-variant hover:border-outline'
                        }`}
                        id="theme-light-btn"
                    >
                        <div className="h-16 w-full rounded-lg bg-[var(--inverse-surface)] border border-[var(--on-surface-variant)] flex items-center justify-center">
                            <Sun size={20} className="text-[var(--on-surface-variant)]" />
                        </div>
                        <span className="label-sm text-on-surface-variant">Light</span>
                    </button>
                </div>
            </section>
        </div>
    );
}
