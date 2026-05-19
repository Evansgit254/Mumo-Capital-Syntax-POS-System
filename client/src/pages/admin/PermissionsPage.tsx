import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService, getErrorMessage } from '../../api/service';
import { useStore } from '../../store/useStore';
import { Role } from '@mumo/types';
import EmptyState from '../../components/ui/EmptyState';
import {
    Shield,
    UserPlus,
    ChevronDown,
    AlertTriangle,
    UserX,
    UserCheck,
    Search,
    Info,
} from 'lucide-react';

const ROLE_OPTIONS = [
    { value: Role.TENANT_ADMIN, label: 'Admin', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    { value: Role.MANAGER, label: 'Manager', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { value: Role.STAFF, label: 'Staff', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
];

function getRoleBadge(role: string) {
    const match = ROLE_OPTIONS.find(r => r.value === role);
    return match || { value: role, label: role, color: 'bg-surface-container-highest text-on-surface-variant' };
}

export default function PermissionsPage() {
    const { session } = useStore();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const usersQuery = useQuery({
        queryKey: ['users'],
        queryFn: () => userService.getAll(),
    });

    const createMutation = useMutation({
        mutationFn: (data: LooseValue) => userService.create(data),
        onSuccess: () => {
            showToast('Staff invited successfully', 'success');
            setShowInviteModal(false);
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: (err) => showToast(getErrorMessage(err), 'error'),
    });

    const roleMutation = useMutation({
        mutationFn: ({ id, role }: { id: string; role: string }) => userService.updateRole(id, role),
        onMutate: async ({ id, role }) => {
            await queryClient.cancelQueries({ queryKey: ['users'] });
            const previous = queryClient.getQueryData(['users']);
            queryClient.setQueryData(['users'], (old: LooseValue[]) =>
                old?.map(u => (u.id === id ? { ...u, role } : u))
            );
            return { previous };
        },
        onError: (err, _vars, context) => {
            queryClient.setQueryData(['users'], context?.previous);
            showToast(getErrorMessage(err), 'error');
        },
        onSuccess: () => {
            showToast('Role updated successfully', 'success');
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => userService.updateStatus(id, status),
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ['users'] });
            const previous = queryClient.getQueryData(['users']);
            queryClient.setQueryData(['users'], (old: LooseValue[]) =>
                old?.map(u => (u.id === id ? { ...u, status } : u))
            );
            return { previous };
        },
        onError: (err, _vars, context) => {
            queryClient.setQueryData(['users'], context?.previous);
            showToast(getErrorMessage(err), 'error');
        },
        onSuccess: (_data, vars) => {
            showToast(
                vars.status === 'INACTIVE' ? 'Account deactivated' : 'Account reactivated',
                'success'
            );
            setConfirmDeactivate(null);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    });

    const users = usersQuery.data?.data || [];
    const filtered = users.filter(
        (u: LooseValue) =>
            u.firstName?.toLowerCase().includes(search.toLowerCase()) ||
            u.lastName?.toLowerCase().includes(search.toLowerCase()) ||
            u.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6 tablet:p-10 space-y-8 max-w-5xl">
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all animate-slide-in ${
                        toast.type === 'success'
                            ? 'bg-secondary text-white'
                            : 'bg-red-600 text-white'
                    }`}
                >
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="display-lg text-on-surface flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                            <Shield size={28} className="text-secondary" />
                        </div>
                        Staff Permissions
                    </h1>
                    <p className="body-lg text-on-surface-variant">
                        Manage staff accounts and role assignments for your organization.
                    </p>
                </div>
                <button 
                    onClick={() => setShowInviteModal(true)}
                    className="btn-primary"
                >
                    <UserPlus size={20} />
                    Invite Staff
                </button>
            </div>

            {/* Search + Stats */}
            <div className="flex flex-col tablet:flex-row gap-4 items-start tablet:items-center justify-between">
                <div className="relative w-full tablet:w-80">
                    <Search
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                    />
                    <input
                        id="staff-search"
                        type="text"
                        placeholder="Search staff…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="input-field !pl-11"
                    />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 tablet:pb-0 w-full tablet:w-auto">
                    {ROLE_OPTIONS.map(r => {
                        const count = users.filter((u: LooseValue) => u.role === r.value).length;
                        return (
                            <div
                                key={r.value}
                                className={`pill-status border shrink-0 ${r.color}`}
                            >
                                {r.label}: {count}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* User List */}
            {usersQuery.isLoading ? (
                <div className="space-y-4">
                    {Array(4)
                        .fill(0)
                        .map((_, i) => (
                            <div
                                key={i}
                                className="card-default h-[88px] animate-pulse bg-surface-container-low"
                            />
                        ))}
                </div>
            ) : filtered.length === 0 && search === '' ? (
                <EmptyState
                    icon={<Shield size={32} />}
                    title="No staff accounts found"
                    description="Invite team members to start managing your POS."
                    action={
                        <button 
                            onClick={() => setShowInviteModal(true)}
                            className="btn-primary" 
                            id="invite-staff-btn-empty"
                        >
                            <UserPlus size={20} />
                            Invite Staff
                        </button>
                    }
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={<Search size={32} />}
                    title="No results"
                    description={`No staff matching "${search}"`}
                />
            ) : (
                <div className="space-y-3">
                    {filtered.map((user: LooseValue) => {
                        const isSelf = user.id === session.userId;
                        const isInactive = user.status === 'INACTIVE';
                        const badge = getRoleBadge(user.role);

                        return (
                            <div
                                key={user.id}
                                id={`user-row-${user.id}`}
                                className={`card-default flex flex-col tablet:flex-row tablet:items-center gap-4 tablet:gap-6 p-5 transition-all ${
                                    isInactive ? 'opacity-50' : ''
                                }`}
                            >
                                {/* Avatar + Info */}
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div
                                        className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 text-lg font-bold uppercase ${
                                            isInactive
                                                ? 'bg-surface-container-highest text-on-surface-variant'
                                                : 'bg-secondary/10 text-secondary'
                                        }`}
                                    >
                                        {user.firstName?.[0]}
                                        {user.lastName?.[0]}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="body-md font-bold text-on-surface truncate">
                                                {user.firstName} {user.lastName}
                                            </h3>
                                            {isSelf && (
                                                <span className="pill-status bg-secondary/10 text-secondary border border-secondary/20 !text-[10px]">
                                                    YOU
                                                </span>
                                            )}
                                            {isInactive && (
                                                <span className="pill-status bg-red-500/10 text-red-400 border border-red-500/20 !text-[10px]">
                                                    INACTIVE
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-on-surface-variant truncate">
                                            {user.email}
                                        </p>
                                    </div>
                                </div>

                                {/* Role Dropdown */}
                                <div className="relative shrink-0">
                                    <select
                                        id={`role-select-${user.id}`}
                                        value={user.role}
                                        disabled={roleMutation.isPending || isInactive}
                                        onChange={e =>
                                            roleMutation.mutate({
                                                id: user.id,
                                                role: e.target.value,
                                            })
                                        }
                                        className={`appearance-none h-10 pl-4 pr-10 rounded-lg border text-sm font-semibold cursor-pointer transition-colors focus:outline-none focus:border-secondary ${badge.color}`}
                                    >
                                        {ROLE_OPTIONS.map(r => (
                                            <option key={r.value} value={r.value}>
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown
                                        size={16}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant"
                                    />
                                </div>

                                {/* Deactivate / Reactivate */}
                                <div className="shrink-0 relative">
                                    {isSelf ? (
                                        <div className="group relative">
                                            <button
                                                disabled
                                                className="h-10 px-4 rounded-lg text-sm font-semibold text-on-surface-variant/40 border border-outline-variant/30 cursor-not-allowed flex items-center gap-2"
                                                id={`deactivate-btn-${user.id}`}
                                            >
                                                <UserX size={16} />
                                                Deactivate
                                            </button>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-container-highest text-on-surface text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
                                                <Info size={12} className="inline mr-1" />
                                                You cannot deactivate your own account
                                            </div>
                                        </div>
                                    ) : isInactive ? (
                                        <button
                                            onClick={() =>
                                                statusMutation.mutate({
                                                    id: user.id,
                                                    status: 'ACTIVE',
                                                })
                                            }
                                            disabled={statusMutation.isPending}
                                            className="h-10 px-4 rounded-lg text-sm font-semibold text-secondary border border-secondary/30 hover:bg-secondary/10 transition-colors flex items-center gap-2"
                                            id={`reactivate-btn-${user.id}`}
                                        >
                                            <UserCheck size={16} />
                                            Reactivate
                                        </button>
                                    ) : confirmDeactivate === user.id ? (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() =>
                                                    statusMutation.mutate({
                                                        id: user.id,
                                                        status: 'INACTIVE',
                                                    })
                                                }
                                                disabled={statusMutation.isPending}
                                                className="h-10 px-4 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                                                id={`confirm-deactivate-${user.id}`}
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeactivate(null)}
                                                className="h-10 px-4 rounded-lg text-sm font-semibold text-on-surface-variant border border-outline-variant hover:bg-white/5 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmDeactivate(user.id)}
                                            className="h-10 px-4 rounded-lg text-sm font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                                            id={`deactivate-btn-${user.id}`}
                                        >
                                            <UserX size={16} />
                                            Deactivate
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Danger Zone Info */}
            <div className="card-default !border-red-500/30 !bg-red-500/5 p-6 space-y-3">
                <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className="text-red-400" />
                    <h3 className="body-md font-bold text-red-400">Danger Zone</h3>
                </div>
                <p className="text-sm text-on-surface-variant">
                    Deactivating an account sets the user's status to <strong>INACTIVE</strong>.
                    They will no longer be able to log in. This action does not delete the account
                    — it can be reactivated at any time.
                </p>
            </div>

            {/* Invite Staff Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-surface/90 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="w-full max-w-lg card-default shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="headline-md">Invite Team Member</h2>
                            <button 
                                onClick={() => setShowInviteModal(false)}
                                className="h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center"
                            >
                                <ChevronDown size={24} className="rotate-90" />
                            </button>
                        </div>
                        
                        <form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                const fd = new FormData(e.currentTarget);
                                createMutation.mutate(Object.fromEntries(fd));
                            }}
                            className="space-y-6"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="label-sm text-on-surface-variant">First Name</label>
                                    <input name="firstName" required className="input-field" placeholder="John" />
                                </div>
                                <div className="space-y-2">
                                    <label className="label-sm text-on-surface-variant">Last Name</label>
                                    <input name="lastName" required className="input-field" placeholder="Doe" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="label-sm text-on-surface-variant">Email Address</label>
                                <input name="email" type="email" required className="input-field" placeholder="john@example.com" />
                            </div>

                            <div className="space-y-2">
                                <label className="label-sm text-on-surface-variant">Role</label>
                                <select name="role" required className="input-field cursor-pointer">
                                    <option value={Role.STAFF}>Staff / Waiter</option>
                                    <option value={Role.MANAGER}>Manager</option>
                                    <option value={Role.TENANT_ADMIN}>Administrator</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="label-sm text-on-surface-variant">Initial Password</label>
                                <input name="password" type="password" required className="input-field" placeholder="••••••••" minLength={8} />
                                <p className="text-[11px] text-on-surface-variant">User should change this after first login.</p>
                            </div>

                            <div className="flex gap-3 justify-end pt-4">
                                <button type="button" onClick={() => setShowInviteModal(false)} className="btn-secondary !h-12">Cancel</button>
                                <button type="submit" disabled={createMutation.isPending} className="btn-primary !h-12 !px-10">
                                    {createMutation.isPending ? 'Inviting...' : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
