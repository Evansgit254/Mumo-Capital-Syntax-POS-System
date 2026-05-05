import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Search, 
    Plus, 
    UserPlus,
    Tag,
    Star,
    Award,
    Zap,
    TrendingUp,
    Filter,
    ChevronRight,
    ArrowRight,
    Gift,
    Calendar,
    Phone,
    Mail
} from 'lucide-react';
import { customerService, getErrorMessage } from '../api/service';
import { useStore } from '../store/useStore';
import Skeleton from '../components/ui/Skeleton';
import { toast } from 'react-hot-toast';

const LoyaltyPage: React.FC = () => {
    const { session } = useStore();
    const [searchQuery, setSearchQuery] = useState('');

    const { data: customers, isLoading } = useQuery({
        queryKey: ['customers', searchQuery],
        queryFn: () => customerService.getAll(searchQuery),
    });

    const stats = useMemo(() => {
        if (!customers) return { total: 0, premium: 0, points: 0 };
        return {
            total: customers.length,
            premium: customers.filter((c: any) => c.loyaltyPoints > 500).length,
            points: customers.reduce((sum: number, c: any) => sum + c.loyaltyPoints, 0),
        };
    }, [customers]);

    if (isLoading) {
        return (
            <div className="p-6 tablet:p-10 space-y-10">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-12 w-32 rounded-xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
                <Skeleton className="h-[500px] w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="p-6 tablet:p-10 space-y-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="display-lg text-on-surface">Loyalty & Guests</h1>
                    <p className="body-lg text-on-surface-variant">Manage customer relationships and reward programs for {session.tenantName}.</p>
                </div>
                <div className="flex gap-3">
                     <button className="btn-secondary flex items-center gap-2 group self-start md:self-center">
                        <Tag size={20} />
                        Discounts
                    </button>
                    <button className="btn-primary flex items-center gap-2 group self-start md:self-center">
                        <UserPlus size={20} />
                        New Guest
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-default p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-secondary/10 text-secondary rounded-xl">
                            <Zap size={24} />
                        </div>
                        <span className="label-sm text-on-surface-variant font-bold uppercase tracking-wider">Active Guests</span>
                    </div>
                    <div className="space-y-1">
                        <div className="display-sm">{stats.total}</div>
                        <p className="body-sm text-on-surface-variant">Profiled guests in directory</p>
                    </div>
                </div>

                <div className="card-default p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-tertiary/10 text-tertiary rounded-xl">
                            <Award size={24} />
                        </div>
                        <span className="label-sm text-on-surface-variant font-bold uppercase tracking-wider">Premium Tier</span>
                    </div>
                    <div className="space-y-1">
                        <div className="display-sm">{stats.premium}</div>
                        <p className="body-sm text-on-surface-variant">Guests with &gt; 500 points</p>
                    </div>
                </div>

                <div className="card-default p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-primary/10 text-primary rounded-xl">
                            <Star size={24} />
                        </div>
                        <span className="label-sm text-on-surface-variant font-bold uppercase tracking-wider">Total Points</span>
                    </div>
                    <div className="space-y-1">
                        <div className="display-sm">{stats.points.toLocaleString()}</div>
                        <p className="body-sm text-on-surface-variant">Circulating loyalty points</p>
                    </div>
                </div>
            </div>

            {/* Loyalty Tiers / Program Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Guest Directory */}
                <div className="lg:col-span-2 space-y-6">
                     <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <h2 className="headline-md">Guest Directory</h2>
                        <div className="relative w-full md:w-80 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={18} />
                            <input 
                                type="text"
                                placeholder="Search guests..."
                                className="input-field pl-12 bg-surface-container-low"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="card-default overflow-hidden">
                        <div className="divide-y divide-outline-variant bg-surface-container-lowest">
                            {customers?.map((customer: any) => (
                                <div key={customer.id} className="p-6 hover:bg-surface-container-low/50 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center text-xl font-bold text-on-surface border border-outline-variant">
                                            {customer.name.charAt(0)}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="body-lg font-bold text-on-surface">{customer.name}</h3>
                                                {customer.loyaltyPoints > 500 && (
                                                    <span className="p-1 bg-tertiary/10 text-tertiary rounded-lg">
                                                        <Award size={14} />
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-4 text-on-surface-variant">
                                                <div className="flex items-center gap-1.5 label-sm">
                                                    <Phone size={14} className="text-on-hint" />
                                                    {customer.phone || 'No phone'}
                                                </div>
                                                <div className="flex items-center gap-1.5 label-sm">
                                                    <Mail size={14} className="text-on-hint" />
                                                    {customer.email || 'No email'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:flex items-center gap-6 md:gap-10">
                                        <div className="space-y-1 md:text-center">
                                            <div className="label-sm text-on-hint uppercase tracking-widest">Points</div>
                                            <div className="body-lg font-bold text-primary">{customer.loyaltyPoints}</div>
                                        </div>
                                        <div className="space-y-1 md:text-center">
                                            <div className="label-sm text-on-hint uppercase tracking-widest">Total Spend</div>
                                            <div className="body-lg font-bold text-on-surface">KES {customer.totalSpend.toLocaleString()}</div>
                                        </div>
                                        <div className="hidden md:block">
                                             <div className="p-2 rounded-xl bg-surface-container-high text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary transition-all duration-300">
                                                <ChevronRight size={20} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Rewards Program Details */}
                <div className="space-y-10">
                    <section className="space-y-6">
                        <h2 className="headline-md">Reward Tiers</h2>
                        <div className="space-y-4">
                            <div className="card-default p-5 border-l-4 border-l-primary/30 space-y-4 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
                                    <Zap size={80} />
                                </div>
                                <div className="flex justify-between items-start">
                                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                        <Tag size={18} />
                                    </div>
                                    <span className="label-sm text-primary font-bold">SILVER</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="body-lg font-bold">10% Off Dessert</div>
                                    <p className="body-sm text-on-surface-variant">Requires 200 Points</p>
                                </div>
                                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-primary h-full rounded-full" style={{ width: '45%' }}></div>
                                </div>
                            </div>

                            <div className="card-default p-5 border-l-4 border-l-tertiary/30 space-y-4 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
                                    <Star size={80} />
                                </div>
                                <div className="flex justify-between items-start">
                                    <div className="p-2 bg-tertiary/10 text-tertiary rounded-lg">
                                        <Award size={18} />
                                    </div>
                                    <span className="label-sm text-tertiary font-bold">GOLD</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="body-lg font-bold">Free Pool Access</div>
                                    <p className="body-sm text-on-surface-variant">Requires 1000 Points</p>
                                </div>
                                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-tertiary h-full rounded-full" style={{ width: '15%' }}></div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="card-default p-6 bg-gradient-to-br from-secondary/10 to-primary/5 space-y-6">
                        <div className="flex items-center gap-3">
                            <Gift className="text-secondary" />
                            <h3 className="body-lg font-bold">Promotions</h3>
                        </div>
                        <p className="body-md text-on-surface-variant">Run seasonal campaigns and send personalized offers to your loyal guests.</p>
                        <button className="btn-secondary w-full flex items-center justify-center gap-2 group">
                            Create Campaign
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default LoyaltyPage;
