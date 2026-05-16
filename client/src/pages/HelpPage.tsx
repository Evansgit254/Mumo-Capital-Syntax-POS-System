import { useState } from 'react';
import {
    BookOpen,
    ShoppingCart,
    BarChart3,
    Shield,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    MessageSquarePlus,
    Zap,
    Monitor,
    Keyboard,
    HelpCircle,
    Utensils,
    CreditCard,
    Package,
    Calendar,
    Users,
    Settings,
    ClipboardCheck,
    ArrowRight,
    Sparkles,
    Info,
    FileText,
} from 'lucide-react';
import { cn } from '../lib/utils';

const APP_VERSION = '1.1.0-gold';
const BUILD_DATE = '2026-05-16';

// ── Quick Start Flows ────────────────────────────────────────────────────────

interface FlowStep {
    icon: typeof ShoppingCart;
    title: string;
    description: string;
}

interface QuickStartFlow {
    id: string;
    title: string;
    subtitle: string;
    icon: typeof ShoppingCart;
    color: string;
    steps: FlowStep[];
}

const QUICK_START_FLOWS: QuickStartFlow[] = [
    {
        id: 'waitstaff',
        title: 'Waitstaff Flow',
        subtitle: 'Place orders, manage tables, and settle bills',
        icon: Utensils,
        color: 'text-secondary',
        steps: [
            { icon: Utensils, title: '1. Open a Table', description: 'Navigate to Tables → tap an available table to open it.' },
            { icon: ShoppingCart, title: '2. Place an Order', description: 'Go to POS → select menu items → assign to the open table → Send to Kitchen.' },
            { icon: Monitor, title: '3. Track on KDS', description: 'The Kitchen Display System shows all active orders. Items move from PENDING → READY when the kitchen marks them.' },
            { icon: CreditCard, title: '4. Settle the Bill', description: 'From the table view, tap "Settle" → choose payment method (Cash / M-Pesa / Card) → confirm.' },
        ],
    },
    {
        id: 'manager',
        title: 'Manager Flow',
        subtitle: 'Inventory, reports, and workforce oversight',
        icon: BarChart3,
        color: 'text-tertiary',
        steps: [
            { icon: Package, title: '1. Check Inventory', description: 'Navigate to Inventory → review stock levels. Items below the minimum threshold appear as CRITICAL alerts on the dashboard.' },
            { icon: BarChart3, title: '2. View Reports', description: 'Go to Reports → see today\'s revenue, order trends, and category breakdown charts.' },
            { icon: Calendar, title: '3. Manage Reservations', description: 'Navigate to Reservations → confirm, check-in, or waitlist guests.' },
            { icon: Users, title: '4. Monitor Workforce', description: 'Go to Workforce → view staff shifts, clock-in/out events, and attendance records.' },
        ],
    },
    {
        id: 'admin',
        title: 'Admin Flow',
        subtitle: 'Tenant setup, permissions, and analytics',
        icon: Shield,
        color: 'text-primary',
        steps: [
            { icon: Settings, title: '1. Configure Tenant', description: 'Go to Admin → Tenant → set your business name, currency, tax rate, and timezone.' },
            { icon: Shield, title: '2. Set Permissions', description: 'Navigate to Admin → Permissions → customize which actions each role (Staff, Manager) can perform.' },
            { icon: BarChart3, title: '3. Executive Insights', description: 'Access Admin → Executive Insights for advanced revenue analytics and performance dashboards.' },
            { icon: Users, title: '4. Manage Users', description: 'Go to Workforce → add new staff members, assign roles, and set hourly rates.' },
        ],
    },
];

// ── FAQ ──────────────────────────────────────────────────────────────────────

interface FAQItem {
    question: string;
    answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
    {
        question: 'How do I transfer an order to a different table?',
        answer: 'Open the source table → tap the order → select "Transfer" → choose the destination table. The order and all its items will move instantly.',
    },
    {
        question: 'Can I merge two tables together?',
        answer: 'Yes. Go to Table Management → select the tables you want to merge → tap "Merge Tables". All orders will be consolidated under the primary table.',
    },
    {
        question: 'How do discount codes work?',
        answer: 'During checkout, enter a discount code (e.g., WELCOME10) in the discount field. The system supports both percentage and flat-amount discounts. Contact your admin to set up custom codes.',
    },
    {
        question: 'What happens if the internet goes down?',
        answer: 'The POS is currently designed for online operation. If connectivity drops, orders will not be submitted until the connection is restored. We recommend maintaining a stable network for transaction integrity.',
    },
    {
        question: 'How do I export reports?',
        answer: 'Navigate to Reports → click the "Export CSV" button at the top of the report section. The system generates a multi-section CSV file that can be opened in Excel or Google Sheets.',
    },
    {
        question: 'Who can access inventory management?',
        answer: 'Only users with the Manager or Admin role can access Inventory, Forecasting, and Vendor Management. Staff members can view the menu but cannot modify stock levels.',
    },
];

// ── Keyboard Shortcuts ──────────────────────────────────────────────────────

const SHORTCUTS = [
    { keys: ['Alt', 'D'], action: 'Go to Dashboard' },
    { keys: ['Alt', 'P'], action: 'Open POS' },
    { keys: ['Alt', 'T'], action: 'View Tables' },
    { keys: ['Alt', 'R'], action: 'View Reports' },
    { keys: ['Esc'], action: 'Close modal / drawer' },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function HelpPage() {
    const [expandedFlow, setExpandedFlow] = useState<string | null>('waitstaff');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    return (
        <div className="p-6 tablet:p-10 space-y-10 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary">
                        <BookOpen size={28} />
                    </div>
                    <div>
                        <h1 className="display-lg text-on-surface" style={{ fontSize: 36, lineHeight: '44px' }}>Help & Quick Start</h1>
                        <p className="body-md text-on-surface-variant">Everything you need to get started with Mumo POS</p>
                    </div>
                </div>
            </div>

            {/* UAT Notice Banner */}
            <div className="card-default !bg-secondary/5 !border-secondary/20 flex items-start gap-4">
                <div className="h-10 w-10 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary shrink-0 mt-1">
                    <ClipboardCheck size={22} />
                </div>
                <div className="space-y-2 flex-1">
                    <h3 className="body-md font-bold text-on-surface">User Acceptance Testing (UAT) Phase</h3>
                    <p className="body-md text-on-surface-variant leading-relaxed">
                        You are currently testing <strong className="text-secondary">Mumo POS v{APP_VERSION}</strong>. 
                        Your feedback is critical in shaping the final product. Please test all workflows thoroughly 
                        and report any issues using the feedback button below.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-2">
                        <a
                            href="https://forms.google.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-lg font-semibold text-sm hover:brightness-110 transition-all"
                        >
                            <MessageSquarePlus size={16} />
                            Submit UAT Feedback
                            <ExternalLink size={14} className="opacity-60" />
                        </a>
                        <a
                            href="/Mumo_POS_UAT_Manual.docx"
                            download
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-container-highest text-on-surface rounded-lg font-semibold text-sm hover:bg-white/10 transition-all border border-outline-variant/30"
                        >
                            <FileText size={16} />
                            Download Manual
                        </a>
                    </div>
                </div>
            </div>

            {/* Quick Start Flows */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <Zap size={20} className="text-tertiary" />
                    <h2 className="headline-md">Quick Start Guides</h2>
                </div>

                <div className="space-y-4">
                    {QUICK_START_FLOWS.map((flow) => {
                        const isExpanded = expandedFlow === flow.id;
                        return (
                            <div key={flow.id} className="card-default !p-0 overflow-hidden">
                                <button
                                    onClick={() => setExpandedFlow(isExpanded ? null : flow.id)}
                                    className="w-full flex items-center gap-4 p-5 px-6 hover:bg-white/5 transition-all text-left"
                                >
                                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", 
                                        flow.id === 'waitstaff' && 'bg-secondary/10',
                                        flow.id === 'manager' && 'bg-tertiary/10',
                                        flow.id === 'admin' && 'bg-primary/10',
                                    )}>
                                        <flow.icon size={22} className={flow.color} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="body-md font-bold text-on-surface">{flow.title}</h3>
                                        <p className="body-sm text-on-surface-variant">{flow.subtitle}</p>
                                    </div>
                                    <div className="text-on-surface-variant/40">
                                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-6 pb-6 space-y-4 animate-fade-up border-t border-outline-variant/30 pt-4">
                                        {flow.steps.map((step, idx) => (
                                            <div key={idx} className="flex items-start gap-4 group">
                                                <div className="h-8 w-8 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-secondary/10 transition-colors">
                                                    <step.icon size={16} className="text-on-surface-variant group-hover:text-secondary transition-colors" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="body-sm font-bold text-on-surface">{step.title}</h4>
                                                    <p className="body-sm text-on-surface-variant">{step.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* FAQ */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <HelpCircle size={20} className="text-secondary" />
                    <h2 className="headline-md">Frequently Asked Questions</h2>
                </div>

                <div className="space-y-3">
                    {FAQ_ITEMS.map((faq, idx) => {
                        const isExpanded = expandedFaq === idx;
                        return (
                            <div key={idx} className="card-default !p-0 overflow-hidden">
                                <button
                                    onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                                    className="w-full flex items-center gap-4 p-4 px-6 hover:bg-white/5 transition-all text-left"
                                >
                                    <span className="flex-1 body-md font-semibold text-on-surface">{faq.question}</span>
                                    <div className="text-on-surface-variant/40 shrink-0">
                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                    </div>
                                </button>
                                {isExpanded && (
                                    <div className="px-6 pb-5 animate-fade-up border-t border-outline-variant/30 pt-3">
                                        <p className="body-md text-on-surface-variant leading-relaxed">{faq.answer}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Bottom Grid: Shortcuts + System Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Keyboard Shortcuts */}
                <section className="card-default space-y-4">
                    <div className="flex items-center gap-3">
                        <Keyboard size={18} className="text-on-surface-variant" />
                        <h3 className="body-md font-bold text-on-surface">Keyboard Shortcuts</h3>
                    </div>
                    <div className="space-y-3">
                        {SHORTCUTS.map((s, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <span className="body-sm text-on-surface-variant">{s.action}</span>
                                <div className="flex items-center gap-1.5">
                                    {s.keys.map((key, ki) => (
                                        <span key={ki}>
                                            <kbd className="px-2 py-1 bg-surface-container-highest border border-outline-variant rounded text-xs font-mono font-bold text-on-surface-variant">
                                                {key}
                                            </kbd>
                                            {ki < s.keys.length - 1 && <span className="text-on-surface-variant/30 mx-1">+</span>}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* System Info */}
                <section className="card-default space-y-4">
                    <div className="flex items-center gap-3">
                        <Info size={18} className="text-on-surface-variant" />
                        <h3 className="body-md font-bold text-on-surface">System Information</h3>
                    </div>
                    <div className="space-y-3">
                        {[  
                            { label: 'Version', value: `v${APP_VERSION}` },
                            { label: 'Build Date', value: BUILD_DATE },
                            { label: 'Release Phase', value: 'UAT (Public Beta)' },
                            { label: 'Frontend', value: 'React 18 + Vite' },
                            { label: 'Backend', value: 'Node.js + Express + Prisma' },
                            { label: 'Database', value: 'PostgreSQL' },
                        ].map((info, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <span className="body-sm text-on-surface-variant">{info.label}</span>
                                <span className="body-sm font-semibold text-on-surface">{info.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="pt-3 border-t border-outline-variant/30">
                        <p className="text-xs text-on-surface-variant/50 text-center">
                            © 2026 Mumo Capital & Syntax. All rights reserved.
                        </p>
                    </div>
                </section>
            </div>

            {/* Feedback CTA */}
            <div className="card-default !bg-gradient-to-r !from-secondary/5 !to-tertiary/5 !border-secondary/15 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                <div className="h-16 w-16 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary shrink-0">
                    <Sparkles size={32} />
                </div>
                <div className="flex-1 space-y-1">
                    <h3 className="body-lg font-bold text-on-surface">Found a bug or have a suggestion?</h3>
                    <p className="body-md text-on-surface-variant">
                        Your feedback drives our roadmap. Let us know what works and what needs improvement.
                    </p>
                </div>
                <a
                    href="https://forms.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary !h-12 !px-6 shrink-0"
                >
                    Send Feedback
                    <ArrowRight size={16} />
                </a>
            </div>
        </div>
    );
}
