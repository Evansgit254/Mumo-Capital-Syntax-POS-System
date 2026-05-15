/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Check, X, Clock, Zap, ExternalLink, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;
const publicApi = axios.create({ baseURL: API_URL });

interface AppStatus {
  status: string;
  organizationName: string;
  createdAt: string;
  reviewedAt: string | null;
  provisionedAt: string | null;
  rejectionReason: string | null;
  domain: string;
}

function formatDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ApplicationStatusPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<AppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!applicationId) return;
    publicApi
      .get(`/api/onboarding/status/${applicationId}`)
      .then((res) => setData(res.data))
      .catch(() => setError('Application not found'))
      .finally(() => setLoading(false));
  }, [applicationId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="animate-spin text-secondary" size={40} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-6">
        <div className="text-center animate-fade-up">
          <AlertCircle className="mx-auto text-error mb-4" size={48} />
          <h1 className="headline-md text-on-surface mb-2">{error || 'Not Found'}</h1>
          <p className="body-md text-on-surface-variant mb-6">
            We couldn't find an application with that ID.
          </p>
          <button onClick={() => navigate('/register')} className="btn-primary">
            New Application
          </button>
        </div>
      </div>
    );
  }

  const isRejected = data.status === 'REJECTED';
  const isProvisioned = data.status === 'PROVISIONED';
  const isApproved = data.status === 'APPROVED';
  const isPending = data.status === 'PENDING';

  const steps = [
    {
      label: 'Application Submitted',
      done: true,
      date: data.createdAt,
      icon: Check,
    },
    {
      label: 'Under Review',
      done: !isPending,
      active: isPending,
      date: isPending ? null : data.reviewedAt,
      icon: isPending ? Clock : isRejected ? X : Check,
    },
    {
      label: isRejected ? 'Not Approved' : 'Approved',
      done: isApproved || isProvisioned,
      failed: isRejected,
      date: isRejected ? data.reviewedAt : isApproved || isProvisioned ? data.reviewedAt : null,
      icon: isRejected ? X : isApproved || isProvisioned ? Check : Clock,
    },
    {
      label: 'Live',
      done: isProvisioned,
      date: data.provisionedAt,
      icon: isProvisioned ? Zap : Clock,
    },
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <span className="font-semibold text-on-surface hidden sm:inline">Mumo POS</span>
        </div>
        <button onClick={() => navigate('/login')} className="body-md text-secondary font-semibold hover:opacity-80 transition-opacity">
          Sign In
        </button>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-lg animate-fade-up">
          <h1 className="headline-md text-on-surface mb-1">{data.organizationName}</h1>
          <p className="body-md text-on-surface-variant mb-8">
            Application ID: <code className="text-secondary">{applicationId}</code>
          </p>

          {/* Timeline */}
          <div className="space-y-0">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isLast = i === steps.length - 1;
              return (
                <div key={i} className="flex gap-4">
                  {/* Vertical Line + Circle */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        s.failed
                          ? 'bg-error/20 text-error'
                          : s.done
                          ? 'bg-secondary/20 text-secondary'
                          : s.active
                          ? 'bg-secondary/10 text-secondary animate-pulse'
                          : 'bg-surface-container-high text-on-surface-variant/40'
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 h-12 ${s.done ? 'bg-secondary/40' : 'bg-outline-variant/20'}`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pt-2 pb-6">
                    <p className={`font-semibold text-sm ${
                      s.failed ? 'text-error' : s.done || s.active ? 'text-on-surface' : 'text-on-surface-variant/60'
                    }`}>
                      {s.label}
                    </p>
                    {s.date && (
                      <p className="text-xs text-on-surface-variant mt-1">{formatDate(s.date)}</p>
                    )}
                    {s.active && (
                      <p className="text-xs text-secondary mt-1">Est. within 24 hours</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rejection reason */}
          {isRejected && data.rejectionReason && (
            <div className="mt-4 p-4 rounded-xl bg-error-container/20 border border-error/30">
              <p className="label-sm text-error mb-1">REASON</p>
              <p className="body-md text-on-error-container">{data.rejectionReason}</p>
              <p className="text-sm text-on-surface-variant mt-4">
                Contact <a href="mailto:support@mumo.app" className="text-secondary font-medium">support@mumo.app</a> to appeal
              </p>
            </div>
          )}

          {/* Login button when provisioned */}
          {isProvisioned && (
            <a
              href={`/login`}
              className="btn-primary w-full mt-6 gap-2"
            >
              <ExternalLink size={18} />
              Go to Login
            </a>
          )}

          <button onClick={() => navigate('/register')} className="btn-secondary w-full mt-3">
            New Application
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-outline-variant/20">
        <p className="text-[11px] tracking-wider text-on-surface-variant/40 uppercase font-bold">
          © 2026 MUMO GLOBAL SYSTEMS
        </p>
      </footer>
    </div>
  );
}
