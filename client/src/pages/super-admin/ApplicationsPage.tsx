/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useStore } from '../../store/useStore';
import {
  Loader2, Check, X, Clock, Shield, LogOut, ChevronDown, ChevronUp,
  Building2, Globe, MapPin, Calendar, AlertCircle, Zap,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

interface Application {
  id: string;
  organizationName: string;
  domain: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone: string | null;
  propertyType: string;
  propertySize: string;
  country: string;
  message: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  provisionedAt: string | null;
  tenantId: string | null;
  createdAt: string;
}

const STATUS_TABS = ['ALL', 'PENDING', 'APPROVED', 'PROVISIONED', 'REJECTED'] as const;

const statusColors: Record<string, string> = {
  PENDING: 'bg-tertiary/20 text-tertiary',
  APPROVED: 'bg-secondary/20 text-secondary',
  PROVISIONED: 'bg-secondary/30 text-secondary',
  REJECTED: 'bg-error/20 text-error',
};

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const superAdmin = useStore((s) => s.superAdmin);
  const clearSuperAdmin = useStore((s) => s.clearSuperAdmin);

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reject modal
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!superAdmin.token) {
      navigate('/super-admin/login', { replace: true });
    }
  }, [superAdmin.token, navigate]);

  const api = useCallback(() => {
    return axios.create({
      baseURL: API_URL,
      headers: { Authorization: `Bearer ${superAdmin.token}` },
    });
  }, [superAdmin.token]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (activeTab !== 'ALL') params.status = activeTab;
      const { data } = await api().get('/api/onboarding/applications', { params });
      setApplications(data.applications);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [activeTab, api]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  // Tab counts (from current data — lightweight approach)
  const pendingCount = applications.filter((a) => a.status === 'PENDING').length;

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const { data } = await api().post(`/api/onboarding/applications/${id}/approve`);
      
      if (data.emailSent) {
        toast.success('Tenant provisioned and client notified');
      } else {
        toast.success('Tenant provisioned successfully');
        toast.error('Warning: Failed to send notification email. Please reach out manually.', {
          duration: 6000,
          icon: '⚠️'
        });
      }

      fetchApplications();
      setExpandedId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingId || rejectReason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters');
      return;
    }
    setActionLoading(rejectingId);
    try {
      const { data } = await api().post(`/api/onboarding/applications/${rejectingId}/reject`, {
        reason: rejectReason.trim(),
      });

      if (data.emailSent) {
        toast.success('Application rejected and client notified');
      } else {
        toast.success('Application rejected');
        toast.error('Warning: Failed to send rejection email.', {
          duration: 6000,
          icon: '⚠️'
        });
      }

      setRejectingId(null);
      setRejectReason('');
      fetchApplications();
      setExpandedId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    clearSuperAdmin();
    navigate('/super-admin/login', { replace: true });
  };

  if (!superAdmin.token) return null;

  return (
    <div className="min-h-screen bg-surface">
      <Toaster position="top-right" />

      {/* Rejection modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant/30 p-6 animate-fade-up">
            <h3 className="headline-md text-on-surface mb-2">Reject Application</h3>
            <p className="body-md text-on-surface-variant mb-6">
              You must provide a reason (min. 10 characters).
            </p>
            <textarea
              className="input-field !h-auto min-h-[120px] py-3 resize-none mb-4"
              placeholder="Reason for rejection…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectingId(null); setRejectReason(''); }}
                className="btn-secondary flex-1 !h-12"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectReason.trim().length < 10 || !!actionLoading}
                className="flex-1 !h-12 px-6 bg-error text-white font-semibold rounded-lg transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading === rejectingId ? <Loader2 className="animate-spin" size={18} /> : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface-container border-b border-outline-variant/30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-on-surface text-sm">Super Admin</h1>
              <p className="text-xs text-on-surface-variant">{superAdmin.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="headline-md text-on-surface">Tenant Applications</h2>
            <p className="body-md text-on-surface-variant mt-1">{total} total applications</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap
                ${activeTab === tab
                  ? 'bg-secondary text-white'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                }`}
            >
              {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              {tab === 'PENDING' && activeTab !== 'PENDING' && pendingCount > 0 && (
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-tertiary text-[10px] font-bold text-on-tertiary">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Applications */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-secondary" size={32} />
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle className="mx-auto text-on-surface-variant/40 mb-4" size={48} />
            <p className="body-md text-on-surface-variant">No applications found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => {
              const isExpanded = expandedId === app.id;
              return (
                <div key={app.id} className="card-default !p-0 overflow-hidden">
                  {/* Card Header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : app.id)}
                    className="w-full p-5 flex items-center gap-4 text-left hover:bg-surface-container-high/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                      <Building2 size={20} className="text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-on-surface truncate">{app.organizationName}</h3>
                        <span className={`pill-status ${statusColors[app.status] || 'bg-surface-container-high text-on-surface-variant'}`}>
                          {app.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-on-surface-variant">
                        <span className="flex items-center gap-1"><Globe size={12} />{app.domain}.mumo.app</span>
                        <span className="flex items-center gap-1"><MapPin size={12} />{app.country}</span>
                        <span className="flex items-center gap-1 hidden sm:flex"><Calendar size={12} />{formatDate(app.createdAt)}</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="text-on-surface-variant shrink-0" /> : <ChevronDown size={18} className="text-on-surface-variant shrink-0" />}
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-outline-variant/20 p-5 bg-surface-container-low/50 animate-fade-up">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <Field label="Organization" value={app.organizationName} />
                        <Field label="Domain" value={`${app.domain}.mumo.app`} />
                        <Field label="Property Type" value={app.propertyType} />
                        <Field label="Property Size" value={app.propertySize} />
                        <Field label="Country" value={app.country} />
                        <Field label="Admin Name" value={`${app.adminFirstName} ${app.adminLastName}`} />
                        <Field label="Admin Email" value={app.adminEmail} />
                        <Field label="Admin Phone" value={app.adminPhone || '—'} />
                        <Field label="Submitted" value={formatDate(app.createdAt)} />
                        {app.reviewedAt && <Field label="Reviewed" value={formatDate(app.reviewedAt)} />}
                        {app.provisionedAt && <Field label="Provisioned" value={formatDate(app.provisionedAt)} />}
                        {app.tenantId && <Field label="Tenant ID" value={app.tenantId} />}
                      </div>

                      {app.message && (
                        <div className="mt-4 p-3 rounded-lg bg-surface-container">
                          <p className="label-sm text-on-surface-variant mb-1">MESSAGE</p>
                          <p className="text-sm text-on-surface">{app.message}</p>
                        </div>
                      )}

                      {app.rejectionReason && (
                        <div className="mt-4 p-3 rounded-lg bg-error/10 border border-error/20">
                          <p className="label-sm text-error mb-1">REJECTION REASON</p>
                          <p className="text-sm text-on-error-container">{app.rejectionReason}</p>
                        </div>
                      )}

                      {/* Actions */}
                      {app.status === 'PENDING' && (
                        <div className="flex gap-3 mt-6 pt-4 border-t border-outline-variant/20">
                          <button
                            onClick={() => handleApprove(app.id)}
                            disabled={!!actionLoading}
                            className="btn-primary !h-11 gap-2 flex-1"
                          >
                            {actionLoading === app.id ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <>
                                <Zap size={16} />
                                Approve & Provision
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setRejectingId(app.id)}
                            disabled={!!actionLoading}
                            className="flex-1 !h-11 px-6 bg-error/10 text-error font-semibold rounded-lg border border-error/30 transition-all hover:bg-error/20 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <X size={16} />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-sm text-on-surface-variant !text-[10px] mb-0.5">{label}</p>
      <p className="text-on-surface text-sm font-medium truncate">{value}</p>
    </div>
  );
}
