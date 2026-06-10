'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { APP_CATEGORIES } from '@/lib/constants/categories';
import { supportedPricingModelOptions } from '@/lib/marketplace-display';
import { getAppMarketplaceUrl } from '@/lib/site-url';
import { useEffect, useState } from 'react';
import { Button, CheckCircle2, Input, Upload, Globe, Image as ImageIcon, Loader2, MaterialIcon, type MaterialIconName } from '@letbuyy/ui';
import { appRevenueSharePolicy } from '@letbuyy/billing-core';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const DRAFT_KEY = 'letbuyy_app_submission_draft_v1';
const REVENUE_POLICY = appRevenueSharePolicy();
const APP_REVENUE_SHARE_COPY = `App-charge pricing metadata uses the ${REVENUE_POLICY.partner_share_percent}/${REVENUE_POLICY.platform_fee_percent} schema split, but public monetization remains human-approved.`;

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
        price_yearly: '',
        trial_days: '',
        oauth_redirect_uris: '',
        data_handling_summary: '',
        data_collected: '',
        data_retention: '',
        support_sla: '',
        support_sla_response_minutes: '',
        status_url: '',
        works_with: '',
        conflict_app_ids: '',
        type: 'public',
        icon_url: '',
        screenshots: [] as string[],
    });
    const [mediaUploading, setMediaUploading] = useState<'icon' | 'screenshot' | null>(null);
    const [manifestText, setManifestText] = useState('{\n  "schema_version": "2026-06",\n  "extensions": [],\n  "functions": []\n}');
    const [manifestStatus, setManifestStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
    const [manifestMessage, setManifestMessage] = useState<string | null>(null);

    useEffect(() => {
        const saved = window.localStorage.getItem(DRAFT_KEY);
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved) as { formData?: typeof formData; manifestText?: string };
            if (parsed.formData) setFormData((current) => ({ ...current, ...parsed.formData }));
            if (parsed.manifestText) setManifestText(parsed.manifestText);
        } catch {
            window.localStorage.removeItem(DRAFT_KEY);
        }
    }, []);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, manifestText }));
        }, 400);
        return () => window.clearTimeout(handle);
    }, [formData, manifestText]);

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
            const splitList = (value: string) => value
                .split(/[\n,]+/)
                .map((item) => item.trim())
                .filter(Boolean);
            const res = await fetch('/api/developers/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    icon_url: formData.icon_url || null,
                    screenshots: formData.screenshots,
                    manifest: parseManifest(false),
                    oauth_redirect_uris: formData.oauth_redirect_uris
                        .split('\n')
                        .map((uri) => uri.trim())
                        .filter(Boolean),
                    data_handling_summary: formData.data_handling_summary || null,
                    data_collected: splitList(formData.data_collected),
                    data_retention: formData.data_retention || null,
                    support_sla: formData.support_sla || null,
                    support_sla_response_minutes: formData.support_sla_response_minutes || null,
                    status_url: formData.status_url || null,
                    works_with: splitList(formData.works_with),
                    conflict_app_ids: splitList(formData.conflict_app_ids),
                    save_as_draft: saveAsDraft,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Submission failed. Please try again.');
                return;
            }

            window.localStorage.removeItem(DRAFT_KEY);
            router.push('/developers/dashboard');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => submitApp(false);
    const handleSaveDraft = () => submitApp(true);
    const pricingOptions = supportedPricingModelOptions();
    const slugPreviewUrl = getAppMarketplaceUrl(`/apps/${formData.slug || 'your-app'}`);

    const uploadMedia = async (kind: 'icon' | 'screenshot', file: File | null | undefined) => {
        if (!file) return;
        setMediaUploading(kind);
        setError('');
        try {
            const uploadBody = new FormData();
            uploadBody.set('file', file);
            uploadBody.set('folder', `app-marketplace/${kind}s`);
            const response = await fetch('/api/developers/apps', {
                method: 'POST',
                body: uploadBody,
            });
            const payload = await response.json();
            if (!response.ok) {
                setError(payload?.error?.message || payload?.error || 'Media upload failed.');
                return;
            }
            const url = payload?.data?.url;
            if (typeof url !== 'string' || url.length === 0) {
                setError('Media upload did not return a URL.');
                return;
            }
            setFormData((current) => kind === 'icon'
                ? { ...current, icon_url: url }
                : { ...current, screenshots: [...current.screenshots, url].slice(0, 5) });
        } catch {
            setError('Media upload failed. Please try again.');
        } finally {
            setMediaUploading(null);
        }
    };

    const parseManifest = (reportError = true) => {
        try {
            return JSON.parse(manifestText) as Record<string, unknown>;
        } catch {
            if (reportError) {
                setManifestStatus('invalid');
                setManifestMessage('Manifest JSON is invalid.');
            }
            return undefined;
        }
    };

    const validateManifest = async () => {
        const manifest = parseManifest();
        if (!manifest) return;
        setManifestStatus('validating');
        setManifestMessage(null);

        try {
            const response = await fetch('/api/developers/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'validate_manifest', manifest }),
            });
            const payload = await response.json().catch(() => null) as { error?: { message?: string }; data?: { counts?: { extensions?: number; functions?: number } } } | null;
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'Manifest validation failed.');
            }
            const counts = payload?.data?.counts;
            setManifestStatus('valid');
            setManifestMessage(`Manifest valid. Extensions: ${counts?.extensions ?? 0}; functions: ${counts?.functions ?? 0}.`);
        } catch (validationError) {
            setManifestStatus('invalid');
            setManifestMessage(validationError instanceof Error ? validationError.message : 'Manifest validation failed.');
        }
    };

    return (
        <>
            <Header />
            <main className="appstore-main">
                <div className="dev-portal">
                    <div className="marketplace-page-header">
                        <h1 className="marketplace-page-title">Submit New App</h1>
                        <p className="marketplace-page-subtitle">Fill in the details below. Your app will be reviewed before publishing.</p>
                    </div>

                    <div className="marketplace-panel marketplace-panel--large">
                        <h2 className="form-section-title">Basic Information</h2>

                        <div className="form-group">
                            <label className="form-label">App Name *</label>
                            <Input
                                unstyled
                                type="text"
                                className="form-input"
                                placeholder="e.g. Smart Reviews Pro"
                                value={formData.name}
                                onChange={(e) => updateField('name', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Slug</label>
                            <Input
                                unstyled
                                type="text"
                                className="form-input"
                                placeholder="auto-generated"
                                value={formData.slug}
                                onChange={(e) => updateField('slug', e.target.value)}
                            />
                            <span className="form-hint">URL: {slugPreviewUrl}</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Tagline *</label>
                            <Input
                                unstyled
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
                                className="form-textarea form-textarea--tall"
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
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                            {formData.category_id && (
                                <span className="form-hint">
                                    <MaterialIcon
                                        name={(APP_CATEGORIES.find((cat) => cat.slug === formData.category_id)?.icon ?? 'category') as MaterialIconName}
                                        className="inline-icon"
                                    />
                                    {APP_CATEGORIES.find((cat) => cat.slug === formData.category_id)?.name}
                                </span>
                            )}
                        </div>

                        <h2 className="form-section-title form-section-title--spaced">Media</h2>

                        <div className="form-group">
                            <label className="form-label">App Icon</label>
                            <label className="form-upload-box form-upload-box--icon">
                                {formData.icon_url ? (
                                    <Image
                                        src={formData.icon_url}
                                        alt={`${formData.name || 'App'} icon preview`}
                                        width={54}
                                        height={54}
                                        className="form-upload-preview"
                                        unoptimized
                                    />
                                ) : (
                                    <ImageIcon size={24} aria-hidden="true" />
                                )}
                                <span className="form-upload-hint">{mediaUploading === 'icon' ? 'Uploading icon' : 'Upload icon'}</span>
                                <Input
                                    unstyled
                                    className="form-upload-input"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                    onChange={(event) => { void uploadMedia('icon', event.target.files?.[0]); }}
                                />
                            </label>
                            <span className="form-hint">512×512px, PNG, JPG, WebP, or SVG.</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Screenshots</label>
                            <label className="form-upload-box form-upload-box--wide">
                                <Upload size={24} />
                                <span className="form-upload-label">{mediaUploading === 'screenshot' ? 'Uploading screenshot' : 'Upload screenshots'}</span>
                                <span className="form-upload-hint">At least 1 screenshot is required for review.</span>
                                <Input
                                    unstyled
                                    className="form-upload-input"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={(event) => { void uploadMedia('screenshot', event.target.files?.[0]); }}
                                />
                            </label>
                            {formData.screenshots.length > 0 && (
                                <div className="form-media-list">
                                    {formData.screenshots.map((url, index) => (
                                        <div key={url} className="form-media-chip">
                                            <Image src={url} alt={`Screenshot ${index + 1}`} width={68} height={42} unoptimized />
                                            <span>Screenshot {index + 1}</span>
                                            <Button
                                                unstyled
                                                type="button"
                                                className="report-action"
                                                onClick={() => setFormData((current) => ({
                                                    ...current,
                                                    screenshots: current.screenshots.filter((item) => item !== url),
                                                }))}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <h2 className="form-section-title form-section-title--spaced">URLs & Links</h2>

                        <div className="form-group">
                            <label className="form-label">
                                <Globe size={14} className="marketplace-icon-inline" />
                                App URL *
                            </label>
                            <Input
                                unstyled
                                type="url"
                                className="form-input"
                                placeholder="https://yourapp.com"
                                value={formData.app_url}
                                onChange={(e) => updateField('app_url', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Privacy Policy URL *</label>
                            <Input
                                unstyled
                                type="url"
                                className="form-input"
                                placeholder="https://yourapp.com/privacy"
                                value={formData.privacy_url}
                                onChange={(e) => updateField('privacy_url', e.target.value)}
                            />
                        </div>

                        <h2 className="form-section-title form-section-title--spaced">Trust disclosures</h2>

                        <div className="form-group">
                            <label className="form-label">Data handling summary *</label>
                            <textarea
                                className="form-textarea"
                                rows={3}
                                placeholder="Describe what merchant/customer data your app reads, writes, stores, and why."
                                value={formData.data_handling_summary}
                                onChange={(e) => updateField('data_handling_summary', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Data collected</label>
                            <textarea
                                className="form-textarea"
                                rows={3}
                                placeholder="Products, Orders, Customers"
                                value={formData.data_collected}
                                onChange={(e) => updateField('data_collected', e.target.value)}
                            />
                            <span className="form-hint">Comma or line separated.</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Data retention</label>
                            <Input
                                unstyled
                                type="text"
                                className="form-input"
                                placeholder="e.g. Deleted within 30 days after uninstall"
                                value={formData.data_retention}
                                onChange={(e) => updateField('data_retention', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Support SLA</label>
                            <Input
                                unstyled
                                type="text"
                                className="form-input"
                                placeholder="e.g. First response within 1 business day"
                                value={formData.support_sla}
                                onChange={(e) => updateField('support_sla', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Support response minutes</label>
                            <Input
                                unstyled
                                type="number"
                                className="form-input"
                                placeholder="e.g. 1440"
                                value={formData.support_sla_response_minutes}
                                onChange={(e) => updateField('support_sla_response_minutes', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Status URL</label>
                            <Input
                                unstyled
                                type="url"
                                className="form-input"
                                placeholder="https://status.yourapp.com"
                                value={formData.status_url}
                                onChange={(e) => updateField('status_url', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Works with</label>
                            <textarea
                                className="form-textarea"
                                rows={3}
                                placeholder="products, checkout, email-marketing"
                                value={formData.works_with}
                                onChange={(e) => updateField('works_with', e.target.value)}
                            />
                            <span className="form-hint">Compatibility metadata used for recommendations and merchant review.</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Conflicting app IDs</label>
                            <textarea
                                className="form-textarea"
                                rows={2}
                                placeholder="UUIDs of apps that cannot run with this app"
                                value={formData.conflict_app_ids}
                                onChange={(e) => updateField('conflict_app_ids', e.target.value)}
                            />
                            <span className="form-hint">Optional. Declared conflicts are checked before install.</span>
                        </div>

                        <h2 className="form-section-title form-section-title--spaced">Pricing</h2>

                        <div className="form-group">
                            <label className="form-label">Pricing Model *</label>
                            <select
                                className="form-select"
                                value={formData.pricing_model}
                                onChange={(e) => updateField('pricing_model', e.target.value)}
                            >
                                {pricingOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <span className="form-hint">Usage-based pricing is enabled only after usage metering is configured for your app.</span>
                        </div>

                        {formData.pricing_model !== 'free' && (
                            <div className="form-group">
                                <label className="form-label">Monthly Price (₹)</label>
                                <Input
                                    unstyled
                                    type="number"
                                    className="form-input"
                                    placeholder="e.g. 499"
                                    value={formData.price_monthly}
                                    onChange={(e) => updateField('price_monthly', e.target.value)}
                                />
                                <span className="form-hint">In INR. {APP_REVENUE_SHARE_COPY} GST is calculated by LetBuyy billing.</span>
                            </div>
                        )}

                        {formData.pricing_model !== 'free' && (
                            <div className="form-group">
                                <label className="form-label">Annual Price (₹)</label>
                                <Input
                                    unstyled
                                    type="number"
                                    className="form-input"
                                    placeholder="e.g. 4999"
                                    value={formData.price_yearly}
                                    onChange={(e) => updateField('price_yearly', e.target.value)}
                                />
                                <span className="form-hint">Annual billing terms are reviewed before paid app publication.</span>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Trial days</label>
                            <Input
                                unstyled
                                type="number"
                                className="form-input"
                                placeholder="e.g. 14"
                                value={formData.trial_days}
                                onChange={(e) => updateField('trial_days', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">OAuth redirect URIs</label>
                            <textarea
                                className="form-textarea"
                                rows={3}
                                placeholder="https://yourapp.com/oauth/callback"
                                value={formData.oauth_redirect_uris}
                                onChange={(e) => updateField('oauth_redirect_uris', e.target.value)}
                            />
                            <span className="form-hint">One URI per line.</span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Distribution</label>
                            <select
                                className="form-select"
                                value={formData.type}
                                onChange={(e) => updateField('type', e.target.value)}
                            >
                                <option value="public">Public marketplace listing</option>
                                <option value="private">Private app install link</option>
                            </select>
                        </div>

                        <h2 className="form-section-title form-section-title--spaced">Manifest validation</h2>

                        <div className="form-group">
                            <label className="form-label">App manifest JSON</label>
                            <textarea
                                className="form-textarea"
                                rows={8}
                                value={manifestText}
                                onChange={(e) => {
                                    setManifestText(e.target.value);
                                    setManifestStatus('idle');
                                    setManifestMessage(null);
                                }}
                            />
                            <Button
                                unstyled
                                type="button"
                                className="appstore-header-btn"
                                onClick={() => { void validateManifest(); }}
                                disabled={manifestStatus === 'validating'}
                            >
                                {manifestStatus === 'validating' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                Validate manifest
                            </Button>
                            {manifestMessage && (
                                <div className={`marketplace-banner ${manifestStatus === 'valid' ? 'marketplace-banner--success' : 'marketplace-banner--critical'}`}>
                                    <strong>{manifestStatus === 'valid' ? 'Manifest accepted' : 'Manifest issue'}</strong>
                                    <span>{manifestMessage}</span>
                                </div>
                            )}
                        </div>

                        <h2 className="form-section-title form-section-title--spaced">Listing preview</h2>

                        <div className="listing-preview-card">
                            <div className="app-card__top">
                                {formData.icon_url ? (
                                    <Image
                                        src={formData.icon_url}
                                        alt=""
                                        width={56}
                                        height={56}
                                        className="app-card__icon-placeholder app-card__icon-preview"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="app-card__icon-placeholder app-icon-tone-2">
                                        {(formData.name || 'A').charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="app-card__content">
                                    <div className="app-card__badges">
                                        <span className="marketplace-badge marketplace-badge--neutral">
                                            {APP_CATEGORIES.find((cat) => cat.slug === formData.category_id)?.name || 'Category pending'}
                                        </span>
                                    </div>
                                    <h3 className="app-card__name">{formData.name || 'App name'}</h3>
                                    <p className="app-card__tagline">{formData.tagline || 'Tagline preview appears here.'}</p>
                                </div>
                            </div>
                            <p className="form-hint">{formData.description || 'Description preview appears after you enter listing copy.'}</p>
                        </div>

                        <div className="marketplace-button-row marketplace-spaced">
                            <Button
                                unstyled
                                className="appstore-header-btn marketplace-button-fill marketplace-button-padded"
                                onClick={handleSaveDraft}
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : 'Save as Draft'}
                            </Button>
                            <Button
                                unstyled
                                className="dev-portal-cta marketplace-button-fill"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : 'Submit for Review'}
                            </Button>
                        </div>
                        {error && (
                            <div className="form-error">
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
