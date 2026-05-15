/// <reference types="vite/client" />
import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Check, Copy, ArrowLeft, ArrowRight, Building2, TreePalm, UtensilsCrossed, Wine, Coffee, Globe, ChevronDown } from 'lucide-react';
import FormField from '../../components/ui/FormField';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;
const publicApi = axios.create({ baseURL: API_URL });

// ── Country data ─────────────────────────────────────────
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Angola','Argentina','Australia','Austria','Bangladesh',
  'Belgium','Botswana','Brazil','Cameroon','Canada','Chile','China','Colombia','Congo',
  'Costa Rica','Croatia','Czech Republic','Denmark','Egypt','Ethiopia','Finland','France',
  'Germany','Ghana','Greece','India','Indonesia','Ireland','Israel','Italy','Jamaica','Japan',
  'Jordan','Kenya','Kuwait','Lebanon','Libya','Madagascar','Malawi','Malaysia','Mali','Mexico',
  'Morocco','Mozambique','Myanmar','Namibia','Nepal','Netherlands','New Zealand','Nigeria',
  'Norway','Oman','Pakistan','Panama','Peru','Philippines','Poland','Portugal','Qatar',
  'Romania','Rwanda','Saudi Arabia','Senegal','Singapore','South Africa','South Korea','Spain',
  'Sri Lanka','Sudan','Sweden','Switzerland','Tanzania','Thailand','Tunisia','Turkey','UAE',
  'Uganda','Ukraine','United Kingdom','United States','Uruguay','Vietnam','Zambia','Zimbabwe',
];

const PROPERTY_TYPES = [
  { value: 'HOTEL',      label: 'Hotel',       icon: Building2 },
  { value: 'RESORT',     label: 'Resort',      icon: TreePalm },
  { value: 'RESTAURANT', label: 'Restaurant',  icon: UtensilsCrossed },
  { value: 'BAR',        label: 'Bar',         icon: Wine },
  { value: 'CAFE',       label: 'Café',        icon: Coffee },
];

const PROPERTY_SIZES = [
  { value: 'SMALL',      label: 'Small',      desc: '1–10 staff' },
  { value: 'MEDIUM',     label: 'Medium',     desc: '11–50 staff' },
  { value: 'LARGE',      label: 'Large',      desc: '51–200 staff' },
  { value: 'ENTERPRISE', label: 'Enterprise', desc: '200+ staff' },
];

interface FormData {
  organizationName: string;
  propertyType: string;
  propertySize: string;
  country: string;
  domain: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone: string;
  message: string;
  agreedToTerms: boolean;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const [copied, setCopied] = useState(false);

  // Domain check
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [domainChecking, setDomainChecking] = useState(false);

  // Country dropdown
  const [countrySearch, setCountrySearch] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormData>({
    organizationName: '',
    propertyType: '',
    propertySize: '',
    country: '',
    domain: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPhone: '',
    message: '',
    agreedToTerms: false,
  });

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ── Domain availability check ──────────────────────────
  useEffect(() => {
    if (form.domain.length < 3) {
      setDomainAvailable(null);
      return;
    }
    setDomainChecking(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await publicApi.get('/api/onboarding/check-domain', {
          params: { domain: form.domain },
        });
        setDomainAvailable(data.available);
      } catch {
        setDomainAvailable(null);
      } finally {
        setDomainChecking(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.domain]);

  // ── Step validation ────────────────────────────────────
  const validateStep = useCallback((s: number): boolean => {
    const errors: Record<string, string> = {};
    if (s === 1) {
      if (!form.organizationName.trim()) errors.organizationName = 'Organization name is required';
      if (!form.propertyType) errors.propertyType = 'Select a property type';
      if (!form.propertySize) errors.propertySize = 'Select a property size';
      if (!form.country) errors.country = 'Select a country';
    }
    if (s === 2) {
      if (form.domain.length < 3) errors.domain = 'Domain must be at least 3 characters';
      if (!/^[a-z0-9-]+$/.test(form.domain)) errors.domain = 'Only lowercase letters, numbers, hyphens';
      if (domainAvailable === false) errors.domain = 'This domain is already taken';
    }
    if (s === 3) {
      if (!form.adminFirstName.trim()) errors.adminFirstName = 'First name is required';
      if (!form.adminLastName.trim()) errors.adminLastName = 'Last name is required';
      if (!form.adminEmail.trim() || !/\S+@\S+\.\S+/.test(form.adminEmail)) errors.adminEmail = 'Valid email is required';
      if (!form.agreedToTerms) errors.agreedToTerms = 'You must agree to the terms';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, domainAvailable]);

  const handleNext = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, 3));
  };
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  // ── Submit ─────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;
    setIsSubmitting(true);
    try {
      const { data } = await publicApi.post('/api/onboarding/apply', {
        organizationName: form.organizationName,
        domain: form.domain,
        adminFirstName: form.adminFirstName,
        adminLastName: form.adminLastName,
        adminEmail: form.adminEmail,
        adminPhone: form.adminPhone || undefined,
        propertyType: form.propertyType,
        propertySize: form.propertySize,
        country: form.country,
        message: form.message || undefined,
      });
      setApplicationId(data.applicationId);
      setSubmitted(true);
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Something went wrong';
      if (message.includes('domain')) {
        setFieldErrors((prev) => ({ ...prev, domain: message }));
        setStep(2);
      } else if (message.includes('email')) {
        setFieldErrors((prev) => ({ ...prev, adminEmail: message }));
        setStep(3);
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(applicationId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // ── Success Screen ─────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-6">
        <Toaster position="top-right" />
        <div className="w-full max-w-lg text-center animate-fade-up">
          <div className="mx-auto w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center mb-8">
            <Check className="text-secondary" size={40} />
          </div>
          <h1 className="headline-md text-on-surface mb-3">Application Submitted!</h1>
          <p className="body-md text-on-surface-variant mb-8">
            We'll review your application and respond within <strong className="text-on-surface">24 hours</strong>.
          </p>
          <div className="card-default text-left mb-8">
            <p className="label-sm text-on-surface-variant mb-2">APPLICATION ID</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-secondary body-md font-mono truncate">{applicationId}</code>
              <button
                onClick={handleCopy}
                className="shrink-0 h-10 w-10 rounded-lg bg-surface-container-high flex items-center justify-center hover:bg-surface-container-highest transition-colors"
              >
                {copied ? <Check size={16} className="text-secondary" /> : <Copy size={16} className="text-on-surface-variant" />}
              </button>
            </div>
          </div>
          <button
            onClick={() => navigate(`/register/status/${applicationId}`)}
            className="btn-primary w-full"
          >
            Track Application Status
          </button>
          <button
            onClick={() => navigate('/login')}
            className="btn-secondary w-full mt-3"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Steps ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <span className="font-semibold text-on-surface hidden sm:inline">Mumo POS</span>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="body-md text-secondary font-semibold hover:opacity-80 transition-opacity"
        >
          Sign In
        </button>
      </header>

      {/* Progress */}
      <div className="flex items-center justify-center gap-4 py-8 px-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                step > s
                  ? 'bg-secondary text-white'
                  : step === s
                  ? 'bg-secondary text-white ring-4 ring-secondary/20'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {step > s ? <Check size={16} /> : s}
            </div>
            {s < 3 && (
              <div className={`hidden sm:block w-16 h-0.5 transition-colors ${step > s ? 'bg-secondary' : 'bg-outline-variant/30'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="flex-1 flex items-start justify-center px-6 pb-12">
        <div className="w-full max-w-xl animate-fade-up" key={step}>

          {/* ── STEP 1: Property Details ──────────────────── */}
          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h2 className="headline-md text-on-surface mb-1">Property Details</h2>
                <p className="body-md text-on-surface-variant">
                  Tell us about your business
                </p>
              </div>

              <FormField label="Organization Name" error={fieldErrors.organizationName}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Grand Horizon Resort"
                  value={form.organizationName}
                  onChange={(e) => updateField('organizationName', e.target.value)}
                />
              </FormField>

              {/* Property Type Cards */}
              <div>
                <p className="label-sm text-on-surface-variant mb-3">PROPERTY TYPE</p>
                {fieldErrors.propertyType && <p className="label-sm !text-error !normal-case mb-2">{fieldErrors.propertyType}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {PROPERTY_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateField('propertyType', value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 cursor-pointer
                        ${form.propertyType === value
                          ? 'border-secondary bg-secondary/10 text-secondary'
                          : 'border-outline-variant/30 bg-surface-container text-on-surface-variant hover:border-outline hover:bg-surface-container-high'
                        }`}
                    >
                      <Icon size={24} />
                      <span className="text-xs font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Property Size Cards */}
              <div>
                <p className="label-sm text-on-surface-variant mb-3">PROPERTY SIZE</p>
                {fieldErrors.propertySize && <p className="label-sm !text-error !normal-case mb-2">{fieldErrors.propertySize}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PROPERTY_SIZES.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateField('propertySize', value)}
                      className={`flex flex-col items-center gap-1 p-4 rounded-xl border transition-all duration-200 cursor-pointer
                        ${form.propertySize === value
                          ? 'border-secondary bg-secondary/10 text-secondary'
                          : 'border-outline-variant/30 bg-surface-container text-on-surface-variant hover:border-outline hover:bg-surface-container-high'
                        }`}
                    >
                      <span className="text-sm font-semibold">{label}</span>
                      <span className="text-[11px] opacity-60">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Country Dropdown */}
              <div className="relative">
                <p className="label-sm text-on-surface-variant mb-2">COUNTRY</p>
                {fieldErrors.country && <p className="label-sm !text-error !normal-case mb-2">{fieldErrors.country}</p>}
                <button
                  type="button"
                  onClick={() => setCountryOpen((p) => !p)}
                  className="input-field flex items-center justify-between text-left cursor-pointer"
                >
                  <span className={form.country ? 'text-on-surface' : 'text-on-surface-variant'}>
                    {form.country || 'Select country…'}
                  </span>
                  <ChevronDown size={18} className={`transition-transform ${countryOpen ? 'rotate-180' : ''}`} />
                </button>
                {countryOpen && (
                  <div className="absolute z-50 w-full mt-2 bg-surface-container-high border border-outline-variant/30 rounded-xl shadow-2xl max-h-64 overflow-hidden">
                    <div className="p-2 border-b border-outline-variant/20">
                      <input
                        type="text"
                        className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface placeholder:text-on-surface-variant text-sm focus:outline-none"
                        placeholder="Search countries…"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-48">
                      {filteredCountries.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { updateField('country', c); setCountryOpen(false); setCountrySearch(''); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-secondary/10
                            ${form.country === c ? 'text-secondary font-semibold bg-secondary/5' : 'text-on-surface-variant'}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: Domain ────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h2 className="headline-md text-on-surface mb-1">Your Domain</h2>
                <p className="body-md text-on-surface-variant">
                  Choose a unique subdomain for your workspace
                </p>
              </div>

              <FormField label="Subdomain" error={fieldErrors.domain}>
                <div className="relative">
                  <input
                    type="text"
                    className="input-field pr-32"
                    placeholder="my-hotel"
                    value={form.domain}
                    onChange={(e) => updateField('domain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none">
                    .mumo.app
                  </span>
                </div>
              </FormField>

              {/* Availability indicator */}
              {form.domain.length >= 3 && (
                <div className="flex items-center gap-2 -mt-4">
                  {domainChecking ? (
                    <Loader2 className="animate-spin text-on-surface-variant" size={16} />
                  ) : domainAvailable === true ? (
                    <>
                      <Check size={16} className="text-secondary" />
                      <span className="text-sm text-secondary font-medium">Available</span>
                    </>
                  ) : domainAvailable === false ? (
                    <span className="text-sm text-error font-medium">✗ This domain is taken</span>
                  ) : null}
                </div>
              )}

              {/* Live preview */}
              {form.domain.length >= 3 && (
                <div className="card-default flex items-center gap-3">
                  <Globe size={18} className="text-secondary shrink-0" />
                  <div>
                    <p className="label-sm text-on-surface-variant mb-1">YOUR WORKSPACE URL</p>
                    <p className="body-md text-on-surface font-medium">
                      <span className="text-secondary">{form.domain}</span>.mumo.app
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Admin Account ─────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="headline-md text-on-surface mb-1">Admin Account</h2>
                <p className="body-md text-on-surface-variant">
                  This will be the primary administrator
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="First Name" error={fieldErrors.adminFirstName}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="John"
                    value={form.adminFirstName}
                    onChange={(e) => updateField('adminFirstName', e.target.value)}
                  />
                </FormField>
                <FormField label="Last Name" error={fieldErrors.adminLastName}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Doe"
                    value={form.adminLastName}
                    onChange={(e) => updateField('adminLastName', e.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="Email Address" error={fieldErrors.adminEmail}>
                <input
                  type="email"
                  className="input-field"
                  placeholder="admin@yourproperty.com"
                  value={form.adminEmail}
                  onChange={(e) => updateField('adminEmail', e.target.value)}
                />
              </FormField>

              <FormField label="Phone Number (Optional)">
                <input
                  type="tel"
                  className="input-field"
                  placeholder="+254 712 345 678"
                  value={form.adminPhone}
                  onChange={(e) => updateField('adminPhone', e.target.value)}
                />
              </FormField>

              <FormField label={`Message to Mumo Team (Optional) — ${form.message.length}/500`}>
                <textarea
                  className="input-field !h-auto min-h-[100px] py-3 resize-none"
                  placeholder="Tell us about your needs or any questions…"
                  maxLength={500}
                  value={form.message}
                  onChange={(e) => updateField('message', e.target.value)}
                />
              </FormField>

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center transition-all shrink-0
                    ${form.agreedToTerms
                      ? 'bg-secondary border-secondary'
                      : 'border-outline-variant hover:border-outline'
                    }`}
                  onClick={() => updateField('agreedToTerms', !form.agreedToTerms)}
                >
                  {form.agreedToTerms && <Check size={12} className="text-white" />}
                </div>
                <span className="text-sm text-on-surface-variant leading-relaxed">
                  I agree to the{' '}
                  <span className="text-secondary font-medium">Terms of Service</span>{' '}
                  and{' '}
                  <span className="text-secondary font-medium">Privacy Policy</span>
                </span>
              </label>
              {fieldErrors.agreedToTerms && <p className="label-sm !text-error !normal-case -mt-4">{fieldErrors.agreedToTerms}</p>}
            </div>
          )}

          {/* ── Navigation ────────────────────────────────── */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-outline-variant/20">
            {step > 1 ? (
              <button type="button" onClick={handleBack} className="btn-secondary !h-12 gap-2">
                <ArrowLeft size={18} /> Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button type="button" onClick={handleNext} className="btn-primary !h-12 gap-2">
                Next <ArrowRight size={18} />
              </button>
            ) : (
              <button type="submit" disabled={isSubmitting} className="btn-primary !h-12 gap-2 min-w-[160px]">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-outline-variant/20">
        <p className="text-[11px] tracking-wider text-on-surface-variant/40 uppercase font-bold">
          © 2026 MUMO GLOBAL SYSTEMS
        </p>
      </footer>
    </div>
  );
}
