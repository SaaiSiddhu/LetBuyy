'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { APP_CATEGORIES } from '@/lib/constants/categories';
import { useState } from 'react';
import { Upload, Globe, Image, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NewAppPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        tagline: '',
        description: '',
        category_id: '',
        app_url: '',
        privacy_url: '',
        pricing_model: 'free',
        price_monthly: '',
    });

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value,
            // Auto-generate slug from name
            ...(field === 'name' ? { slug: value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') } : {}),
        }));
        setError('');
    };

    const submitApp = async (saveAsDraft: boolean) => {
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/developers/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, save_as_draft: saveAsDraft }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Submission failed. Please try again.');
                return;
            }

            router.push('/developers/dashboard');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => submitApp(false);
    const handleSaveDraft = () => submitApp(true);

    return (
        <>
            <Header />
            <main className="appstore-main">
                <div className="dev-portal">
                    <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Submit New App</h1>
                    <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 32 }}>
                        Fill in the details below. Your app will be reviewed before publishing.
                    </p>

                    <div style={{
                        padding: 32,
                        borderRadius: 20,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                    }}>
                        {/* Basic info */}
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
                            Basic Information
                        </h2>

                        <div className="form-group">
                            <label className="form-label">App Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. Smart Reviews Pro"
                                value={formData.name}
                                onChange={(e) => updateField('name', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Slug</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="auto-generated"
                                value={formData.slug}
                                onChange={(e) => updateField('slug', e.target.value)}
                            />
                            <span className="form-hint">URL: apps.letbuyy.store/apps/{formData.slug || 'your-app'}</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Tagline *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="A short description of your app (max 80 characters)"
                                maxLength={80}
                                value={formData.tagline}
                                onChange={(e) => updateField('tagline', e.target.value)}
                            />
                            <span className="form-hint">{formData.tagline.length}/80 characters</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description *</label>
                            <textarea
                                className="form-textarea"
                                style={{ minHeight: 180 }}
                                placeholder="Describe your app in detail. You can use markdown for formatting."
                                value={formData.description}
                                onChange={(e) => updateField('description', e.target.value)}
                            />
                            <span className="form-hint">Markdown supported. Include features, how it works, and setup instructions.</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Category *</label>
                            <select
                                className="form-select"
                                value={formData.category_id}
                                onChange={(e) => updateField('category_id', e.target.value)}
                            >
                                <option value="">Select a category</option>
                                {APP_CATEGORIES.map(cat => (
                                    <option key={cat.slug} value={cat.slug}>
                                        {cat.icon} {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Media */}
                        <h2 style={{
                            fontSize: 16, fontWeight: 700,
                            marginTop: 32, marginBottom: 16,
                            color: 'var(--text-primary)',
                            borderTop: '1px solid var(--border)',
                            paddingTop: 24,
                        }}>
                            Media
                        </h2>

                        <div className="form-group">
                            <label className="form-label">App Icon</label>
                            <div style={{
                                width: 120, height: 120,
                                borderRadius: 20, border: '2px dashed var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'var(--text-hint)',
                                flexDirection: 'column', gap: 4,
                            }}>
                                <Image size={24} />
                                <span style={{ fontSize: 11 }}>Upload icon</span>
                            </div>
                            <span className="form-hint">512×512px, PNG or SVG.</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Screenshots</label>
                            <div style={{
                                padding: 32, borderRadius: 12,
                                border: '2px dashed var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'var(--text-hint)',
                                flexDirection: 'column', gap: 8,
                            }}>
                                <Upload size={24} />
                                <span style={{ fontSize: 13 }}>Drag & drop screenshots here</span>
                                <span style={{ fontSize: 11 }}>3-5 screenshots, 1280×800px recommended</span>
                            </div>
                        </div>

                        {/* URLs */}
                        <h2 style={{
                            fontSize: 16, fontWeight: 700,
                            marginTop: 32, marginBottom: 16,
                            color: 'var(--text-primary)',
                            borderTop: '1px solid var(--border)',
                            paddingTop: 24,
                        }}>
                            URLs & Links
                        </h2>

                        <div className="form-group">
                            <label className="form-label">
                                <Globe size={14} style={{ display: 'inline', marginRight: 4 }} />
                                App URL *
                            </label>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="https://yourapp.com"
                                value={formData.app_url}
                                onChange={(e) => updateField('app_url', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Privacy Policy URL *</label>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="https://yourapp.com/privacy"
                                value={formData.privacy_url}
                                onChange={(e) => updateField('privacy_url', e.target.value)}
                            />
                        </div>

                        {/* Pricing */}
                        <h2 style={{
                            fontSize: 16, fontWeight: 700,
                            marginTop: 32, marginBottom: 16,
                            color: 'var(--text-primary)',
                            borderTop: '1px solid var(--border)',
                            paddingTop: 24,
                        }}>
                            Pricing
                        </h2>

                        <div className="form-group">
                            <label className="form-label">Pricing Model *</label>
                            <select
                                className="form-select"
                                value={formData.pricing_model}
                                onChange={(e) => updateField('pricing_model', e.target.value)}
                            >
                                <option value="free">Free</option>
                                <option value="freemium">Freemium (Free + paid features)</option>
                                <option value="recurring">Recurring (monthly/yearly)</option>
                                <option value="one_time">One-time purchase</option>
                                <option value="usage_based">Usage-based</option>
                            </select>
                        </div>

                        {formData.pricing_model !== 'free' && (
                            <div className="form-group">
                                <label className="form-label">Monthly Price (₹)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="e.g. 499"
                                    value={formData.price_monthly}
                                    onChange={(e) => updateField('price_monthly', e.target.value)}
                                />
                                <span className="form-hint">In INR. LetBuyy takes a 15% commission.</span>
                            </div>
                        )}

                        {/* Submit */}
                        <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                            <button
                                className="appstore-header-btn"
                                style={{ flex: 1, justifyContent: 'center', padding: '12px 20px' }}
                                onClick={handleSaveDraft}
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : 'Save as Draft'}
                            </button>
                            <button
                                className="dev-portal-cta"
                                style={{ flex: 1, justifyContent: 'center' }}
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : 'Submit for Review'}
                            </button>
                        </div>
                        {error && (
                            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, backgroundColor: '#fef2f2', color: '#dc2626', fontSize: 13 }}>
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
