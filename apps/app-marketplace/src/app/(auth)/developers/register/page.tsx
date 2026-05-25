'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState } from 'react';
import { CheckCircle, Circle, User, Globe, FileText, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Step = 1 | 2 | 3;

export default function DeveloperRegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        company_name: '',
        website: '',
        contact_email: '',
        bio: '',
        tax_id: '',
        country: 'IN',
        agreed_tos: false,
        agreed_privacy: false,
    });

    const updateField = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError('');
    };

    const steps = [
        { num: 1, label: 'Company Info', icon: <User size={16} /> },
        { num: 2, label: 'Business Details', icon: <Globe size={16} /> },
        { num: 3, label: 'Agreements', icon: <FileText size={16} /> },
    ];

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/developers/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_name: formData.company_name,
                    website_url: formData.website,
                    support_email: formData.contact_email,
                    description: formData.bio,
                    country: formData.country,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Registration failed. Please try again.');
                return;
            }

            router.push('/developers/dashboard');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Header />
            <main className="appstore-main">
                <div className="dev-portal">
                    <h1 style={{ fontSize: 26, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>
                        Become a Developer
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 32 }}>
                        Register your developer account to start building apps.
                    </p>

                    {/* Step indicator */}
                    <div className="step-indicator" style={{ justifyContent: 'center', marginBottom: 36 }}>
                        {steps.map((s, i) => (
                            <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className={`step-indicator-item ${step === s.num ? 'active' : step > s.num ? 'completed' : ''}`}>
                                    {step > s.num ? <CheckCircle size={16} /> : <Circle size={16} />}
                                    {s.label}
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={`step-indicator-connector ${step > s.num ? 'active' : ''}`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Form card */}
                    <div style={{
                        maxWidth: 520,
                        margin: '0 auto',
                        padding: 32,
                        borderRadius: 20,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                    }}>
                        {/* Step 1 — Company Info */}
                        {step === 1 && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Company / Developer Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. ReviewTech Labs"
                                        value={formData.company_name}
                                        onChange={(e) => updateField('company_name', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Contact Email *</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        placeholder="dev@yourcompany.com"
                                        value={formData.contact_email}
                                        onChange={(e) => updateField('contact_email', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Website</label>
                                    <input
                                        type="url"
                                        className="form-input"
                                        placeholder="https://yourcompany.com"
                                        value={formData.website}
                                        onChange={(e) => updateField('website', e.target.value)}
                                    />
                                    <span className="form-hint">Optional — helps us verify your identity.</span>
                                </div>
                                <button
                                    className="dev-portal-cta"
                                    style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                                    onClick={() => formData.company_name && formData.contact_email ? setStep(2) : null}
                                >
                                    Continue →
                                </button>
                            </>
                        )}

                        {/* Step 2 — Business Details */}
                        {step === 2 && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">About Your Company</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder="Tell us about what you build and your experience..."
                                        value={formData.bio}
                                        onChange={(e) => updateField('bio', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tax ID / GSTIN</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. 29ABCDE1234F1Z5"
                                        value={formData.tax_id}
                                        onChange={(e) => updateField('tax_id', e.target.value)}
                                    />
                                    <span className="form-hint">Required for payouts in India.</span>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Country</label>
                                    <select
                                        className="form-select"
                                        value={formData.country}
                                        onChange={(e) => updateField('country', e.target.value)}
                                    >
                                        <option value="IN">India 🇮🇳</option>
                                        <option value="US">United States 🇺🇸</option>
                                        <option value="GB">United Kingdom 🇬🇧</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button
                                        className="appstore-header-btn"
                                        style={{ flex: 1, justifyContent: 'center' }}
                                        onClick={() => setStep(1)}
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        className="dev-portal-cta"
                                        style={{ flex: 1, justifyContent: 'center' }}
                                        onClick={() => setStep(3)}
                                    >
                                        Continue →
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Step 3 — Agreements */}
                        {step === 3 && (
                            <>
                                <div style={{
                                    padding: 20, borderRadius: 12,
                                    background: 'var(--bg-secondary)', marginBottom: 20,
                                    fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
                                }}>
                                    <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                                        Developer Agreement Summary
                                    </h3>
                                    <ul style={{ paddingLeft: 16 }}>
                                        <li>You retain full ownership of your app&apos;s code and IP.</li>
                                        <li>LetBuyy takes a 15% commission on paid app sales (net-85 revenue share).</li>
                                        <li>Apps must comply with our security and quality guidelines.</li>
                                        <li>We pay out monthly via bank transfer or UPI for Indian developers.</li>
                                        <li>You are responsible for providing support to merchants using your app.</li>
                                    </ul>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.agreed_tos}
                                            onChange={(e) => updateField('agreed_tos', e.target.checked)}
                                        />
                                        I agree to the Developer Terms of Service *
                                    </label>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.agreed_privacy}
                                            onChange={(e) => updateField('agreed_privacy', e.target.checked)}
                                        />
                                        I agree to the Privacy Policy *
                                    </label>
                                </div>
                                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                    <button
                                        className="appstore-header-btn"
                                        style={{ flex: 1, justifyContent: 'center' }}
                                        onClick={() => setStep(2)}
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        className="dev-portal-cta"
                                        style={{ flex: 1, justifyContent: 'center' }}
                                        onClick={handleSubmit}
                                        disabled={!formData.agreed_tos || !formData.agreed_privacy || loading}
                                    >
                                        {loading ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : 'Submit Registration'}
                                    </button>
                                </div>
                                {error && (
                                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, backgroundColor: '#fef2f2', color: '#dc2626', fontSize: 13 }}>
                                        {error}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
