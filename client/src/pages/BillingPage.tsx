import { useState } from 'react';
import { 
    DollarSign, 
    CreditCard, 
    Building2, 
    TrendingUp, 
    Calendar,
    ArrowRight,
    FileText,
    History,
    CheckCircle2
} from 'lucide-react';

export default function BillingPage() {
    return (
        <div className="h-full flex flex-col bg-surface overflow-y-auto">
            {/* Header */}
            <header className="px-8 pt-10 pb-6 shrink-0">
                <h1 className="display-lg text-on-surface mb-2">Settlement Dashboard</h1>
                <p className="body-lg text-on-surface-variant max-w-2xl">
                    Cross-tenant billing management for Poolside Bar & Grill. Review room charges, direct settlements, and historical payout logs.
                </p>
            </header>

            <div className="p-8 pt-2 space-y-8 max-w-7xl">
                
                {/* Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Unsettled Revenue */}
                    <div className="card-default relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <DollarSign size={64} className="text-secondary" />
                        </div>
                        <div className="space-y-4 relative">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-surface-variant flex items-center justify-center">
                                    <TrendingUp className="text-on-surface" size={20} />
                                </div>
                                <h3 className="body-md font-semibold text-on-surface-variant uppercase tracking-wider">Unsettled Revenue</h3>
                            </div>
                            <div>
                                <div className="display-lg text-secondary">$42,890.50</div>
                                <p className="body-md text-on-surface-variant mt-2 flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-tertiary"></span>
                                    Pending Payout
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Room Charges */}
                    <div className="card-default relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Building2 size={64} className="text-on-surface" />
                        </div>
                        <div className="space-y-4 relative">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-surface-variant flex items-center justify-center">
                                    <FileText className="text-on-surface" size={20} />
                                </div>
                                <h3 className="body-md font-semibold text-on-surface-variant uppercase tracking-wider">Room Charges</h3>
                            </div>
                            <div>
                                <div className="display-lg text-on-surface">$28,140.00</div>
                                <p className="body-md text-on-surface-variant mt-2">65% of total volume</p>
                            </div>
                        </div>
                    </div>

                    {/* Direct Payments */}
                    <div className="card-default relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <CreditCard size={64} className="text-on-surface" />
                        </div>
                        <div className="space-y-4 relative">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-surface-variant flex items-center justify-center">
                                    <CreditCard className="text-on-surface" size={20} />
                                </div>
                                <h3 className="body-md font-semibold text-on-surface-variant uppercase tracking-wider">Direct Payments</h3>
                            </div>
                            <div>
                                <div className="display-lg text-on-surface">$14,750.50</div>
                                <p className="body-md text-on-surface-variant mt-2">35% of total volume</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column */}
                    <div className="space-y-8">
                        {/* Daily Revenue Composition section */}
                        <section className="space-y-4">
                            <h2 className="headline-md flex items-center gap-2">
                                <Calendar size={24} className="text-secondary" />
                                Daily Revenue Composition
                            </h2>
                            <div className="card-default h-64 flex flex-col items-center justify-center border-dashed bg-surface-container-low border-outline-variant/30 text-on-surface-variant">
                                {/* Placeholder for chart based on text description */}
                                <div className="flex gap-4 items-end h-32 w-full px-8 pb-4">
                                    {[60, 40, 80, 50, 90, 70, 100].map((h, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                            <div 
                                                className="w-full bg-secondary/20 rounded-t-sm hover:bg-secondary/40 transition-colors cursor-pointer group relative"
                                                style={{ height: `${h}%` }}
                                            >
                                                <div className="absolute bottom-0 w-full bg-secondary/80 rounded-t-sm" style={{ height: `${h * 0.6}%` }}></div>
                                            </div>
                                            <span className="label-sm text-on-surface-variant/50">D{i+1}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Final Settlement */}
                        <section className="space-y-4">
                            <h2 className="headline-md flex items-center gap-2">
                                <CheckCircle2 size={24} className="text-secondary" />
                                Final Settlement
                            </h2>
                            <div className="card-default flex flex-col gap-6">
                                <div className="space-y-2">
                                    <p className="body-md text-on-surface">Current period ending <strong className="text-secondary">October 31, 2023</strong>.</p>
                                    <p className="body-md text-on-surface-variant">Ready for internal audit and resort payout.</p>
                                </div>
                                <button className="btn-primary w-full md:w-auto h-14 uppercase tracking-widest text-[12px] flex items-center justify-center gap-2">
                                    Initiate Payout <ArrowRight size={16} />
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                        <h2 className="headline-md flex items-center gap-2">
                            <History size={24} className="text-secondary" />
                            Past Settlements History
                        </h2>
                        <div className="card-default p-0 overflow-hidden">
                            <div className="divide-y divide-outline-variant/20">
                                {[
                                    { date: 'Sep 30, 2023', id: 'SET-9201', amount: '$112,450.00', status: 'Completed' },
                                    { date: 'Aug 31, 2023', id: 'SET-8834', amount: '$98,210.50', status: 'Completed' },
                                    { date: 'Jul 31, 2023', id: 'SET-7452', amount: '$105,890.00', status: 'Completed' },
                                    { date: 'Jun 30, 2023', id: 'SET-6109', amount: '$120,340.25', status: 'Completed' },
                                ].map((item, i) => (
                                    <div key={i} className="p-6 flex items-center justify-between hover:bg-surface-variant/50 transition-colors cursor-pointer group">
                                        <div className="space-y-1">
                                            <div className="body-md font-medium text-on-surface">{item.date}</div>
                                            <div className="label-sm text-on-surface-variant">ID: {item.id}</div>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="body-md font-bold text-on-surface">{item.amount}</div>
                                            <div className="label-sm text-secondary uppercase tracking-wider">{item.status}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
