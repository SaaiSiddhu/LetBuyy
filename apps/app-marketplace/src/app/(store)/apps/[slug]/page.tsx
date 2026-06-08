import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { AppCard } from '@/components/AppCard';
import { AppDemoSessionButton } from '@/components/AppDemoSessionButton';
import {
    BuiltForLetbuyySentence,
    FeatureTagGroups,
    MetaStrip,
    WhatMerchantsThink,
    WorksWithChips,
} from '@/components/AppDetailParity';
import { AppInstallConsentPanel } from '@/components/AppInstallConsentPanel';
import { MarketplaceBreadcrumbs } from '@/components/MarketplaceBreadcrumbs';
import { RecentlyViewedApps } from '@/components/RecentlyViewedApps';
import { ReportActionButton } from '@/components/ReportActionButton';
import { SaveAppButton } from '@/components/SaveAppButton';
import { ScreenshotGallery } from '@/components/ScreenshotGallery';
import { StarRating } from '@/components/StarRating';
import { APP_CATEGORIES } from '@/lib/constants/categories';
import { formatMarketplaceMoney } from '@/lib/currency';
import { t } from '@/lib/i18n/messages';
import { AppService } from '@/lib/app-service';
import {
    formatScopeLabel,
    getAppLaunchUrl,
    getAppPriceDisplay,
    getAppRating,
    getAppScopes,
    getAppScreenshots,
    getCategoryName,
    getDeveloperName,
    getIconTone,
    getInstallCount,
    getLastUpdatedDate,
    getRecencyLabel,
    getReviewCount,
    isBuiltForLetbuyy,
    isVerifiedDeveloper,
    sanitizeMarkdownText,
} from '@/lib/marketplace-display';
import {
    BadgeCheck,
    CheckCircle2,
    CreditCard,
    Download,
    ExternalLink,
    Image as ImageIcon,
    IndianRupee,
    ListChecks,
    ShieldCheck,
    Sparkles,
    Star,
    Tag,
} from '@letbuyy/ui';
import { formatIndiaDate, formatInrCurrency } from '@letbuyy/ui/formatting';
import type { AppPricingPlan, AppVersion, MarketplaceApp, MarketplaceAppAward, MarketplaceAppCollection, MarketplaceAppFeatureGroup, MarketplaceAppFeatureTag, MarketplaceAppReviewSummary } from '@letbuyy/shared-types';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';

interface AppDetailPageProps {
    params: Promise<{ slug: string }>;
}

type MarketplaceAppVersionFields = MarketplaceApp & {
    version?: string | null;
    documentation_url?: string | null;
    data_handling?: { summary?: string; data_collected?: string[]; retention?: string } | null;
    changelog?: string[] | null;
    release_notes?: string[] | null;
    support_sla?: string | null;
    status_url?: string | null;
    health_status?: string | null;
    built_for_letbuyy_awarded_at?: string | null;
    works_with?: string[] | null;
    category_tags?: string[] | null;
    merchant_review_summary?: string | null;
    what_merchants_think?: string | null;
    feature_groups?: MarketplaceAppFeatureGroup[] | null;
    feature_tags?: MarketplaceAppFeatureTag[] | null;
    awards?: MarketplaceAppAward[] | null;
    app_awards?: MarketplaceAppAward[] | null;
    app_review_summary?: MarketplaceAppReviewSummary | null;
    featured_in?: MarketplaceAppCollection[] | null;
    currency?: string | null;
    video_captions_url?: string | null;
    app_versions?: AppVersion[] | null;
};

interface PricingRow {
    label: string;
    value: string;
    detail: string;
}

export async function generateMetadata({ params }: AppDetailPageProps) {
    const { slug } = await params;
    const app = await AppService.getAppBySlug(slug);
    if (!app) return { title: 'App Not Found' };
    return {
        title: `${app.name} - LetBuyy App Store`,
        description: app.tagline as string,
    };
}

function renderDescription(description: string | null | undefined) {
    const lines = sanitizeMarkdownText(description || 'No description has been provided for this app yet.').split('\n');
    return lines.map((line, index) => {
        if (line.startsWith('## ')) return <h2 key={`${line}-${index}`}>{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={`${line}-${index}`}>{line.slice(4)}</h3>;
        if (line.startsWith('- ')) return <li key={`${line}-${index}`}>{line.slice(2)}</li>;
        if (line.trim() === '') return <br key={`blank-${index}`} />;
        return <p key={`${line}-${index}`}>{line}</p>;
    });
}

function reviewDistribution(reviews: Array<{ rating: number }>) {
    return [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: reviews.filter((review) => review.rating === star).length,
    }));
}

function getInitials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');
}

function formatPricingModel(model: string | null | undefined): string {
    if (!model) return 'Free';
    return model
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAppMoney(value: number | null | undefined, currency = process.env.NEXT_PUBLIC_MP_CURRENCY || 'INR'): string | null {
    if (currency === 'INR') {
        return formatInrCurrency(value, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 0,
            requirePositive: true,
        });
    }
    return formatMarketplaceMoney(value, currency);
}

function getPricingRows(app: MarketplaceApp, price: ReturnType<typeof getAppPriceDisplay>): PricingRow[] {
    const currency = app.currency || process.env.NEXT_PUBLIC_MP_CURRENCY || 'INR';
    const monthly = formatAppMoney(app.price_monthly, currency);
    const yearly = formatAppMoney(app.price_yearly, currency);
    const oneTime = formatAppMoney(app.price_inr, currency);
    const trialDays = typeof app.trial_days === 'number' && app.trial_days > 0 ? app.trial_days : null;

    const rows: PricingRow[] = [
        {
            label: 'Listed price',
            value: price.label,
            detail: price.detail,
        },
        {
            label: 'Billing model',
            value: formatPricingModel(app.pricing_model),
            detail: trialDays ? `${trialDays} day trial available` : 'Merchant approval required before paid charges.',
        },
    ];

    if (monthly) {
        rows.push({
            label: 'Monthly plan',
            value: `${monthly}/mo`,
            detail: 'Billed monthly after merchant approval.',
        });
    }

    if (yearly) {
        rows.push({
            label: 'Annual plan',
            value: `${yearly}/yr`,
            detail: 'Billed yearly after merchant approval.',
        });
    }

    if (!monthly && !yearly && oneTime && app.pricing_model === 'one_time') {
        rows.push({
            label: 'One-time charge',
            value: oneTime,
            detail: 'Single charge after merchant approval.',
        });
    }

    return rows;
}

function getActivePricingPlans(app: MarketplaceApp): AppPricingPlan[] {
    return (app.app_pricing_plans || [])
        .filter((plan) => plan.status === 'active')
        .sort((a, b) => {
            if (a.is_default && !b.is_default) return -1;
            if (!a.is_default && b.is_default) return 1;
            return Number(a.sort_order || 0) - Number(b.sort_order || 0);
        });
}

function formatPlanPrice(plan: AppPricingPlan): string {
    const amount = formatAppMoney(Number(plan.amount_minor || plan.usage_unit_amount_minor || 0) / 100, plan.currency || 'INR');
    const suffix = plan.interval === 'monthly' ? '/mo' : plan.interval === 'yearly' ? '/yr' : '';
    if (!amount) return 'Free';
    return `${amount}${suffix}`;
}

export default async function AppDetailPage({ params }: AppDetailPageProps) {
    const { slug } = await params;
    const app = await AppService.getAppBySlug(slug);
    if (!app) notFound();

    const appWithVersion = app as MarketplaceAppVersionFields;
    const reviewResult = await AppService.getAppReviews(app.id, 10);
    const { reviews } = reviewResult;
    const category = APP_CATEGORIES.find((item) => item.slug === app.app_categories?.slug) || app.app_categories;
    const price = getAppPriceDisplay(app);
    const recommendations = await AppService.getRecommendations(app.id);
    const alternatives = recommendations?.alternatives || [];
    const alsoInstalled = recommendations?.also_installed || [];
    const screenshots = getAppScreenshots(app);
    const scopes = getAppScopes(app);
    const rating = getAppRating(app);
    const reviewCount = getReviewCount(app);
    const totalReviewCount = reviewResult.total || reviewCount;
    const installCount = getInstallCount(app);
    const verified = isVerifiedDeveloper(app);
    const recencyLabel = getRecencyLabel(app);
    const lastUpdated = getLastUpdatedDate(app);
    const iconTone = getIconTone(app.name);
    const launchUrl = getAppLaunchUrl(app);
    const developerName = getDeveloperName(app);
    const version = app.current_version || appWithVersion.version || '1.0.0';
    const appAwards = appWithVersion.awards || appWithVersion.app_awards || [];
    const builtForAward = appAwards.find((award) => award.award_key === 'built_for_letbuyy') || null;
    const builtForLetbuyy = isBuiltForLetbuyy(app) || Boolean(builtForAward);
    const privacyUrl = app.privacy_policy_url || app.privacy_url || null;
    const termsUrl = app.terms_url || null;
    const listingCurrency = appWithVersion.currency || process.env.NEXT_PUBLIC_MP_CURRENCY || 'INR';
    const pricingRows = getPricingRows(app, price);
    const pricingPlans = getActivePricingPlans(app);
    const videoCaptionsUrl = appWithVersion.video_captions_url;
    const dataHandling = appWithVersion.data_handling;
    const versionHistory = (appWithVersion.app_versions || [])
        .filter((item) => item.status !== 'rejected' && item.status !== 'rolled_back')
        .sort((a, b) => {
            const left = new Date(b.released_at || b.submitted_at || b.created_at || 0).getTime();
            const right = new Date(a.released_at || a.submitted_at || a.created_at || 0).getTime();
            return left - right;
        });
    const changelog = versionHistory.flatMap((item) => {
        const items = Array.isArray(item.changelog) && item.changelog.length > 0
            ? item.changelog
            : (item.release_notes ? [item.release_notes] : []);
        return items.map((entry) => `${item.version}: ${entry}`);
    });
    const worksWith = recommendations?.works_with?.length
        ? recommendations.works_with
        : (appWithVersion.works_with || appWithVersion.category_tags || app.tags || []);
    const categorySlug = category?.slug || app.app_categories?.slug || null;
    const featureGroups = appWithVersion.feature_groups || [];
    const featureTags = Array.from(new Set([
        ...(appWithVersion.feature_tags || []).map((tag) => tag.label),
        ...(Array.isArray(app.tags) ? app.tags : []),
        ...((app as MarketplaceApp & { features?: string[] | null }).features || []),
    ])).slice(0, 16);
    const merchantSummary = appWithVersion.app_review_summary?.summary || appWithVersion.what_merchants_think || appWithVersion.merchant_review_summary || null;
    const featuredIn = appWithVersion.featured_in || [];
    const distribution = reviewDistribution(reviews);
    const appStructuredData = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: app.name,
        applicationCategory: category?.name || getCategoryName(app),
        operatingSystem: 'Web',
        description: app.tagline || app.description || `${app.name} on LetBuyy App Store`,
        offers: {
            '@type': 'Offer',
            priceCurrency: listingCurrency,
            price: Number(app.price_monthly || app.price_inr || 0),
            availability: 'https://schema.org/InStock',
        },
        aggregateRating: totalReviewCount > 0 ? {
            '@type': 'AggregateRating',
            ratingValue: rating.toFixed(1),
            reviewCount: totalReviewCount,
        } : undefined,
        author: {
            '@type': 'Organization',
            name: developerName,
        },
    };

    return (
        <>
            <Header />
            <main className="appstore-main app-detail-page">
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(appStructuredData).replace(/</g, '\\u003c') }}
                />
                <MarketplaceBreadcrumbs
                    items={[
                        { label: t('marketplace.breadcrumb.home'), href: '/' },
                        { label: t('marketplace.breadcrumb.apps'), href: '/search' },
                        category ? { label: category.name, href: `/categories/${category.slug}` } : { label: 'Category' },
                        { label: app.name },
                    ]}
                />
                <section className="app-detail-hero">
                    <div className="app-detail-hero__icon">
                        {app.icon_url ? (
                            <Image src={app.icon_url} alt={app.name} width={208} height={208} sizes="104px" />
                        ) : (
                            <div className={`app-detail-icon-placeholder app-icon-tone-${iconTone}`}>
                                {app.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="app-detail-hero__content">
                        <div className="app-detail-hero__badges">
                            {builtForLetbuyy && (
                                <span className="marketplace-badge marketplace-badge--success">
                                    <ShieldCheck size={12} aria-hidden="true" />
                                    Built for LetBuyy
                                </span>
                            )}
                            {recencyLabel && (
                                <span className="marketplace-badge marketplace-badge--info">
                                    <Sparkles size={12} aria-hidden="true" />
                                    {recencyLabel}
                                </span>
                            )}
                            {verified && (
                                <span className="marketplace-badge marketplace-badge--info">
                                    <BadgeCheck size={12} aria-hidden="true" />
                                    Verified partner
                                </span>
                            )}
                            {category && (
                                <span className="marketplace-badge marketplace-badge--neutral">
                                    <Tag size={12} aria-hidden="true" />
                                    {category.name}
                                </span>
                            )}
                            {appAwards.filter((award) => award.award_key !== 'built_for_letbuyy').slice(0, 2).map((award) => (
                                <span key={award.id} className="marketplace-badge marketplace-badge--success">
                                    <BadgeCheck size={12} aria-hidden="true" />
                                    {award.label}
                                </span>
                            ))}
                        </div>
                        <h1>{app.name}</h1>
                        <p>{app.tagline}</p>
                        <div className="app-detail-hero__meta">
                            <span>
                                <Star size={14} fill="currentColor" stroke="currentColor" aria-hidden="true" />
                                {rating.toFixed(1)} ({totalReviewCount.toLocaleString()} reviews)
                            </span>
                            <span>
                                <Download size={14} aria-hidden="true" />
                                {installCount.toLocaleString()} installs
                            </span>
                            <span>
                                <BadgeCheck size={14} aria-hidden="true" />
                                {developerName}
                            </span>
                        </div>
                    </div>
                </section>

                <MetaStrip
                    items={[
                        { label: 'Pricing', value: price.label, detail: price.detail },
                        { label: 'Popularity', value: installCount.toLocaleString('en-IN'), detail: 'installs' },
                        { label: 'Rating', value: rating.toFixed(1), detail: `${totalReviewCount.toLocaleString('en-IN')} reviews` },
                        { label: 'Developer', value: developerName, detail: verified ? 'Verified partner' : 'Partner listing' },
                    ]}
                />

                {builtForLetbuyy ? (
                    <BuiltForLetbuyySentence
                        award={builtForAward}
                        awardedAt={appWithVersion.built_for_letbuyy_awarded_at ? formatIndiaDate(appWithVersion.built_for_letbuyy_awarded_at) : null}
                    />
                ) : null}

                {app.is_first_party_demo && (
                    <div className="marketplace-banner marketplace-banner--info">
                        <strong>First-party demo app</strong>
                        <span>This listing is seeded by LetBuyy to exercise marketplace flows before launch-partner inventory is onboarded.</span>
                    </div>
                )}

                <div className="app-detail">
                    <div className="app-detail-main">
                        <section className="marketplace-card marketplace-section">
                            <div className="marketplace-section-header">
                                <h2>Preview</h2>
                                <p>Review screenshots and expected merchant surfaces before granting access.</p>
                            </div>
                            {screenshots.length > 0 ? (
                                <ScreenshotGallery appName={app.name} screenshots={screenshots} />
                            ) : (
                                <div className="app-screenshot-empty">
                                    <ImageIcon size={24} aria-hidden="true" />
                                    <span>No screenshots have been approved for this listing yet.</span>
                                </div>
                            )}
                            {app.video_url && (
                                <div className="app-demo-video">
                                    {videoCaptionsUrl ? (
                                        <video controls preload="metadata" src={app.video_url}>
                                            <track kind="captions" src={videoCaptionsUrl} srcLang="en" label="English" default />
                                        </video>
                                    ) : (
                                        <div className="app-demo-video__missing-captions">
                                            <ImageIcon size={18} aria-hidden="true" />
                                            <span>{t('marketplace.media.videoCaptionsMissing')}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        <WorksWithChips categorySlug={categorySlug} items={worksWith} />
                        <FeatureTagGroups categorySlug={categorySlug} features={featureTags} groups={featureGroups} />

                        <section className="marketplace-card marketplace-section">
                            <div className="marketplace-section-header">
                                <h2>Pricing</h2>
                                <p>Charges are shown from the app listing and still require merchant approval before billing.</p>
                            </div>
                            <div className="app-pricing-grid">
                                {pricingRows.map((row) => (
                                    <article key={row.label} className="app-pricing-card">
                                        <div className="app-pricing-card__icon">
                                            {row.label.includes('Billing') ? (
                                                <CreditCard size={16} aria-hidden="true" />
                                            ) : (
                                                <IndianRupee size={16} aria-hidden="true" />
                                            )}
                                        </div>
                                        <div>
                                            <span>{row.label}</span>
                                            <strong>{row.value}</strong>
                                            <p>{row.detail}</p>
                                        </div>
                                    </article>
                                ))}
                            </div>
                            {pricingPlans.length > 0 && (
                                <div className="app-plan-grid">
                                    {pricingPlans.map((plan) => (
                                        <article key={plan.id} className={`app-plan-card${plan.is_default ? ' app-plan-card--default' : ''}`}>
                                            <div className="app-plan-card__header">
                                                <div>
                                                    <h3>{plan.name}</h3>
                                                    <p>{plan.description || formatPricingModel(plan.pricing_model)}</p>
                                                </div>
                                                {plan.is_default && <span className="marketplace-badge marketplace-badge--success">Default</span>}
                                            </div>
                                            <strong>{formatPlanPrice(plan)}</strong>
                                            {typeof plan.trial_days === 'number' && plan.trial_days > 0 && (
                                                <span className="marketplace-badge marketplace-badge--info">{plan.trial_days}-day trial</span>
                                            )}
                                            {Array.isArray(plan.features) && plan.features.length > 0 && (
                                                <ul>
                                                    {plan.features.slice(0, 5).map((feature) => (
                                                        <li key={feature}>
                                                            <CheckCircle2 size={13} aria-hidden="true" />
                                                            {feature}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            )}
                            <div className="marketplace-banner marketplace-banner--info">
                                <strong>Billing approval required</strong>
                                <span>Paid app charges are not activated until the merchant reviews and approves the billing terms.</span>
                            </div>
                        </section>

                        <WhatMerchantsThink summary={merchantSummary} />

                        <section className="marketplace-card marketplace-section">
                            <div className="marketplace-section-header">
                                <h2>Permission review</h2>
                                <p>Confirm the API access this app is requesting before installation.</p>
                            </div>
                            <div className="app-permission-review-grid">
                                <article className="app-permission-summary">
                                    <div className="app-permission-summary__icon">
                                        <ShieldCheck size={18} aria-hidden="true" />
                                    </div>
                                    <div>
                                        <span>Requested permissions</span>
                                        <strong>{scopes.length}</strong>
                                        <p>{scopes.length > 0 ? 'Grant only if these permissions match the app use case.' : 'This app does not request API permissions.'}</p>
                                    </div>
                                </article>
                                <div className="app-permission-checklist">
                                    {(scopes.length > 0 ? scopes : ['No API permissions requested']).map((scope) => (
                                        <span key={scope}>
                                            <CheckCircle2 size={14} aria-hidden="true" />
                                            {scopes.length > 0 ? formatScopeLabel(scope) : scope}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="app-permission-note">
                                <ListChecks size={15} aria-hidden="true" />
                                <span>Installation uses the consent panel in the sidebar and sends the approved scope list to the app install endpoint.</span>
                            </div>
                        </section>

                        {(dataHandling || worksWith.length > 0 || appWithVersion.support_sla || appWithVersion.status_url) && (
                            <section className="marketplace-card marketplace-section">
                                <div className="marketplace-section-header">
                                    <h2>Trust disclosures</h2>
                                    <p>Partner-provided compatibility, data-handling, and support signals.</p>
                                </div>
                                {dataHandling && (
                                    <div className="marketplace-banner marketplace-banner--info">
                                        <strong>Data handling</strong>
                                        <span>{dataHandling.summary || 'Data handling summary provided by the partner.'}</span>
                                        {Array.isArray(dataHandling.data_collected) && dataHandling.data_collected.length > 0 && (
                                            <span>Data: {dataHandling.data_collected.join(', ')}</span>
                                        )}
                                    </div>
                                )}
                                {worksWith.length > 0 && (
                                    <div className="app-permission-checklist">
                                        {worksWith.map((item) => (
                                            <span key={item}>
                                                <CheckCircle2 size={14} aria-hidden="true" />
                                                Works with {item}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {appWithVersion.support_sla && (
                                    <div className="app-sidebar-info-row">
                                        <span className="app-sidebar-info-label">Support SLA</span>
                                        <span className="app-sidebar-info-value">{appWithVersion.support_sla}</span>
                                    </div>
                                )}
                                {appWithVersion.health_status && appWithVersion.health_status !== 'unknown' && (
                                    <div className="app-sidebar-info-row">
                                        <span className="app-sidebar-info-label">App health</span>
                                        <span className="app-sidebar-info-value">{appWithVersion.health_status}</span>
                                    </div>
                                )}
                                {appWithVersion.status_url && (
                                    <a className="app-install-secondary-link" href={appWithVersion.status_url} target="_blank" rel="noreferrer">
                                        Status page
                                        <ExternalLink size={13} aria-hidden="true" />
                                    </a>
                                )}
                            </section>
                        )}

                        <section className="marketplace-card marketplace-section">
                            <div className="marketplace-section-header">
                                <h2>About this app</h2>
                            </div>
                            <div className="app-description">
                                {renderDescription(app.description)}
                            </div>
                        </section>

                        <section className="marketplace-card marketplace-section">
                            <div className="marketplace-section-header">
                                <h2>Reviews ({totalReviewCount.toLocaleString()})</h2>
                                <p>Store owner feedback and implementation notes.</p>
                            </div>
                            {reviews.length > 0 && (
                                <div className="rating-histogram" aria-label="Rating distribution from loaded reviews">
                                    {distribution.map((item) => (
                                        <div key={item.star} className="rating-histogram__row">
                                            <span>{item.star} star</span>
                                            <meter min={0} max={reviews.length} value={item.count} />
                                            <span>{item.count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {reviews.length > 0 ? (
                                <div className="review-list">
                                    {reviews.map((review) => (
                                        <article key={review.id} className="review-card">
                                            <div className="review-header">
                                                <div className="marketplace-avatar">{getInitials(review.user_name || 'Anonymous')}</div>
                                                <div>
                                                    <div className="review-author">{review.user_name || 'Anonymous'}</div>
                                                    <StarRating rating={review.rating} size={12} showValue={false} />
                                                    <div className="review-provenance">
                                                        {review.store_name ? <span>{review.store_name}</span> : null}
                                                        {((review as typeof review & { country?: string | null; store_country?: string | null }).country || (review as typeof review & { store_country?: string | null }).store_country) ? (
                                                            <span>{(review as typeof review & { country?: string | null; store_country?: string | null }).country || (review as typeof review & { store_country?: string | null }).store_country}</span>
                                                        ) : null}
                                                        {((review as typeof review & { usage_duration?: string | null; duration_using_app?: string | null }).usage_duration || (review as typeof review & { duration_using_app?: string | null }).duration_using_app) ? (
                                                            <span>{(review as typeof review & { usage_duration?: string | null; duration_using_app?: string | null }).usage_duration || (review as typeof review & { duration_using_app?: string | null }).duration_using_app}</span>
                                                        ) : null}
                                                    </div>
                                                    {(review.app_review_proofs?.some((proof) => proof.proof_status === 'verified') || review.verified_installation_id) && (
                                                        <span className="review-proof-badge">
                                                            <ShieldCheck size={12} aria-hidden="true" />
                                                            Verified install
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="review-date">{review.created_at ? formatIndiaDate(review.created_at) : '—'}</span>
                                            </div>
                                            <p className="review-body">
                                                <strong>{review.title}</strong>
                                                <br />
                                                {review.body}
                                            </p>
                                            {review.developer_reply && (
                                                <div className="developer-review-reply">
                                                    <strong>Developer response</strong>
                                                    <p>{review.developer_reply}</p>
                                                    {review.developer_replied_at && <span>{formatIndiaDate(review.developer_replied_at)}</span>}
                                                </div>
                                            )}
                                            <ReportActionButton appId={app.id} reviewId={review.id} kind="review" label="Report review" />
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="app-review-empty">
                                    <div className="app-review-empty__icon">
                                        <Star size={18} aria-hidden="true" />
                                    </div>
                                    <h3>No reviews yet</h3>
                                    <p>This app has not received merchant reviews yet. Install only after reviewing permissions and support details.</p>
                                </div>
                            )}
                        </section>

                        {changelog.length > 0 && (
                            <section className="marketplace-card marketplace-section">
                                <div className="marketplace-section-header">
                                    <h2>Changelog</h2>
                                </div>
                                <ul className="app-changelog">
                                    {changelog.map((item) => (
                                        <li key={item}>{sanitizeMarkdownText(item, 500)}</li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>

                    <aside className="app-detail-sidebar">
                        <section className="marketplace-card marketplace-section">
                            <div className="marketplace-section-header">
                                <h2>Install</h2>
                            </div>
                            <AppInstallConsentPanel
                                appId={app.id}
                                appName={app.name}
                                priceLabel={price.label}
                                priceDetail={price.detail}
                                scopes={scopes}
                                pricingPlans={pricingPlans}
                                launchUrl={launchUrl}
                                privacyUrl={privacyUrl}
                                termsUrl={termsUrl}
                            />
                            {launchUrl && <AppDemoSessionButton appId={app.id} />}
                            {launchUrl && (
                                <a className="app-install-secondary-link" href={launchUrl} target="_blank" rel="noreferrer">
                                    View demo store
                                    <ExternalLink size={13} aria-hidden="true" />
                                </a>
                            )}
                            <SaveAppButton appId={app.id} appName={app.name} />
                        </section>

                        <section className="marketplace-card marketplace-section">
                            <div className="marketplace-section-header">
                                <h2>Trust and details</h2>
                            </div>
                            <div className="app-trust-list">
                                {builtForLetbuyy && (
                                    <div className="app-trust-row">
                                        <ShieldCheck size={15} aria-hidden="true" />
                                        <span>
                                            Built for LetBuyy
                                            {appWithVersion.built_for_letbuyy_awarded_at ? ` awarded ${formatIndiaDate(appWithVersion.built_for_letbuyy_awarded_at)}` : ''}
                                        </span>
                                    </div>
                                )}
                                <div className="app-trust-row">
                                    <BadgeCheck size={15} aria-hidden="true" />
                                    <span>{verified ? 'Verified partner' : 'Partner listing'}</span>
                                </div>
                                <div className="app-trust-row">
                                    <Tag size={15} aria-hidden="true" />
                                    <span>{getCategoryName(app)}</span>
                                </div>
                            </div>
                            <div className="app-sidebar-info">
                                <div className="app-sidebar-info-row">
                                    <span className="app-sidebar-info-label">Version</span>
                                    <span className="app-sidebar-info-value">{version}</span>
                                </div>
                                <div className="app-sidebar-info-row">
                                    <span className="app-sidebar-info-label">Updated</span>
                                    <span className="app-sidebar-info-value">{lastUpdated ? formatIndiaDate(lastUpdated.toISOString()) : '—'}</span>
                                </div>
                                <div className="app-sidebar-info-row">
                                    <span className="app-sidebar-info-label">Launched</span>
                                    <span className="app-sidebar-info-value">{app.published_at || app.created_at ? formatIndiaDate(app.published_at || app.created_at || '') : '—'}</span>
                                </div>
                                <div className="app-sidebar-info-row">
                                    <span className="app-sidebar-info-label">Pricing</span>
                                    <span className="app-sidebar-info-value">{price.label}</span>
                                </div>
                            </div>
                        </section>

                        <section className="marketplace-card marketplace-section">
                            <div className="marketplace-section-header">
                                <h2>Permissions</h2>
                            </div>
                            <div className="app-permissions-panel">
                                {scopes.length > 0 ? (
                                    scopes.map((scope) => (
                                        <span key={scope}>
                                            <ShieldCheck size={14} aria-hidden="true" />
                                            {formatScopeLabel(scope)}
                                        </span>
                                    ))
                                ) : (
                                    <span>
                                        <ShieldCheck size={14} aria-hidden="true" />
                                        No API permissions requested
                                    </span>
                                )}
                            </div>
                        </section>

                        <Link href={`/developers/${app.app_developers?.slug || '#'}`} className="app-developer-card">
                            <div className="marketplace-avatar marketplace-avatar--md">{getInitials(developerName)}</div>
                            <div>
                                <span className="app-developer-label">Developer</span>
                                <span className="app-developer-name">{developerName}</span>
                                {app.app_developers?.website_url && (
                                    <span className="app-developer-link">
                                        Website
                                        <ExternalLink size={12} aria-hidden="true" />
                                    </span>
                                )}
                            </div>
                        </Link>

                        {!launchUrl && (
                            <div className="marketplace-banner marketplace-banner--warning">
                                <strong>Direct launch URL not declared</strong>
                                <span>This listing does not yet expose a direct app URL for marketplace auto-launch.</span>
                            </div>
                        )}
                        <ReportActionButton appId={app.id} kind="listing" label="Report listing" />
                    </aside>
                </div>

                <section className="marketplace-card marketplace-section">
                    <div className="marketplace-section-header">
                        <h2>Featured in</h2>
                        <p>Published collection and story placements that reference this app.</p>
                    </div>
                    {featuredIn.length > 0 ? (
                        <div className="featured-in-grid">
                            {featuredIn.slice(0, 4).map((collection) => (
                                <Link key={collection.id} href={`/${(collection.curation_type || '').includes('editorial') ? 'stories' : 'collections'}/${collection.slug}`} className="featured-in-card">
                                    <span>{collection.curation_type || 'Collection'}</span>
                                    <strong>{collection.name}</strong>
                                    {collection.description ? <p>{collection.description}</p> : null}
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="app-review-empty">
                            <div className="app-review-empty__icon">
                                <Sparkles size={18} aria-hidden="true" />
                            </div>
                            <h3>No published story placement yet</h3>
                            <p>This app is not attached to a published marketplace story in the current catalog.</p>
                        </div>
                    )}
                </section>

                {alternatives.length > 0 && (
                    <section className="marketplace-card marketplace-section">
                        <div className="marketplace-section-header">
                            <h2>More apps like this</h2>
                            <p>Comparable apps from the same marketplace category.</p>
                        </div>
                        <div className="app-card-grid">
                            {alternatives.map((item) => (
                                <AppCard key={item.id} app={item} />
                            ))}
                        </div>
                    </section>
                )}

                {alsoInstalled.length > 0 && (
                    <section className="marketplace-card marketplace-section">
                        <div className="marketplace-section-header">
                            <h2>Also installed with this app</h2>
                            <p>Apps with overlapping compatibility metadata.</p>
                        </div>
                        <div className="app-card-grid">
                            {alsoInstalled.map((item) => (
                                <AppCard key={item.id} app={item} />
                            ))}
                        </div>
                    </section>
                )}

                <RecentlyViewedApps currentApp={appWithVersion} />
            </main>
            <Footer />
        </>
    );
}
