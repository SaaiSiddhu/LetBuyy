'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState } from 'react';
import { Button, CheckCircle, Circle, Input, User, Globe, FileText, Loader2 } from '@letbuyy/ui';
import { appRevenueSharePolicy } from '@letbuyy/billing-core';
import { useRouter } from 'next/navigation';

type Step = 1 | 2 | 3;
const REVENUE_POLICY = appRevenueSharePolicy();

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
                    tax_id: formData.tax_id,
                    agreed_tos: formData.agreed_tos,
                    agreed_privacy: formData.agreed_privacy,
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
                    <div className="marketplace-page-header marketplace-page-header--center">
                        <h1 className="marketplace-page-title">Become a Developer</h1>
                        <p className="marketplace-page-subtitle">Register your developer account to start building apps.</p>
                    </div>

                    <div className="step-indicator step-indicator--center">
                        {steps.map((s, i) => (
                            <div key={s.num} className="step-indicator-segment">
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

                    <div className="marketplace-panel marketplace-panel--large marketplace-panel--narrow">
                        {step === 1 && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Company / Developer Name *</label>
                                    <Input
                                        unstyled
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. ReviewTech Labs"
                                        value={formData.company_name}
                                        onChange={(e) => updateField('company_name', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Contact Email *</label>
                                    <Input
                                        unstyled
                                        type="email"
                                        className="form-input"
                                        placeholder="dev@yourcompany.com"
                                        value={formData.contact_email}
                                        onChange={(e) => updateField('contact_email', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Website</label>
                                    <Input
                                        unstyled
                                        type="url"
                                        className="form-input"
                                        placeholder="https://yourcompany.com"
                                        value={formData.website}
                                        onChange={(e) => updateField('website', e.target.value)}
                                    />
                                    <span className="form-hint">Optional — helps us verify your identity.</span>
                                </div>
                                <Button
                                    unstyled
                                    className="dev-portal-cta marketplace-button-fill marketplace-spaced-sm"
                                    onClick={() => formData.company_name && formData.contact_email ? setStep(2) : null}
                                >
                                    Continue →
                                </Button>
                            </>
                        )}

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
                                    <Input
                                        unstyled
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
                                        <option value="IN">India</option>
                                    </select>
                                    <span className="form-hint">Marketplace payouts are currently supported for India-based partners only.</span>
                                </div>
                                <div className="marketplace-button-row">
                                    <Button
                                        unstyled
                                        className="appstore-header-btn marketplace-button-fill"
                                        onClick={() => setStep(1)}
                                    >
                                        ← Back
                                    </Button>
                                    <Button
                                        unstyled
                                        className="dev-portal-cta marketplace-button-fill"
                                        onClick={() => setStep(3)}
                                    >
                                        Continue →
                                    </Button>
                                </div>
                            </>
                        )}

                        {step === 3 && (
                            <>
                                <div className="agreement-summary">
                                    <h3>Developer Agreement Summary</h3>
                                    <ul>
                                        <li>You retain full ownership of your app&apos;s code and IP.</li>
                                        <li>Paid app payouts use the {REVENUE_POLICY.partner_share_percent}% partner share and {REVENUE_POLICY.platform_fee_percent}% LetBuyy platform fee.</li>
                                        <li>Apps must comply with our security and quality guidelines.</li>
                                        <li>India payouts use supported bank transfer or UPI rails after approval.</li>
                                        <li>You are responsible for providing support to merchants using your app.</li>
                                    </ul>
                                </div>
                                <div className="form-group">
                                    <label className="form-checkbox-label">
                                        <Input
                                            unstyled
                                            type="checkbox"
                                            checked={formData.agreed_tos}
                                            onChange={(e) => updateField('agreed_tos', e.target.checked)}
                                        />
                                        I agree to the Developer Terms of Service *
                                    </label>
                                </div>
                                <div className="form-group">
                                    <label className="form-checkbox-label">
                                        <Input
                                            unstyled
                                            type="checkbox"
                                            checked={formData.agreed_privacy}
                                            onChange={(e) => updateField('agreed_privacy', e.target.checked)}
                                        />
                                        I agree to the Privacy Policy *
                                    </label>
                                </div>
                                <div className="marketplace-button-row marketplace-spaced-sm">
                                    <Button
                                        unstyled
                                        className="appstore-header-btn marketplace-button-fill"
                                        onClick={() => setStep(2)}
                                    >
                                        ← Back
                                    </Button>
                                    <Button
                                        unstyled
                                        className="dev-portal-cta marketplace-button-fill"
                                        onClick={handleSubmit}
                                        disabled={!formData.agreed_tos || !formData.agreed_privacy || loading}
                                    >
                                        {loading ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : 'Submit Registration'}
                                    </Button>
                                </div>
                                {error && (
                                    <div className="form-error">
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
