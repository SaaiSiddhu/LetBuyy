import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { AppCard } from '@/components/AppCard';
import { AppInstallConsentPanel } from '@/components/AppInstallConsentPanel';
import { StarRating } from '@/components/StarRating';
import { APP_CATEGORIES } from '@/lib/constants/categories';
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
    getReviewCount,
    isVerifiedDeveloper,
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
    Star,
    Tag,
} from '@letbuyy/ui';
import type { MarketplaceApp } from '@letbuyy/shared-types';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface AppDetailPageProps {
    params: Promise<{ slug: string }>;
}

type MarketplaceAppVersionFields = MarketplaceApp & {
    version?: string | null;
    documentation_url?: string | null;
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

function formatDate(value: string | null | undefined): string {
    return new Date(value || '1970-01-01T00:00:00.000Z').toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function renderDescription(description: string | null | undefined) {
    const lines = (description || 'No description has been provided for this app yet.').split('\n');
    return lines.map((line, index) => {
        if (line.startsWith('## ')) return <h2 key={`${line}-${index}`}>{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={`${line}-${index}`}>{line.slice(4)}</h3>;
        if (line.startsWith('- ')) return <li key={`${line}-${index}`}>{line.slice(2)}</li>;
        if (line.trim() === '') return <br key={`blank-${index}`} />;
        return <p key={`${line}-${index}`}>{line}</p>;
    });
}

function getInitials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');
}

function formatCurrency(value: number | null | undefined, suffix = ''): string | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
    return `₹${value.toLocaleString('en-IN')}${suffix}`;
}

function formatPricingModel(model: string | null | undefined): string {
    if (!model) return 'Free';
    return model
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPricingRows(app: MarketplaceApp, price: ReturnType<typeof getAppPriceDisplay>): PricingRow[] {
    const monthly = formatCurrency(app.price_monthly, '/mo');
    const yearly = formatCurrency(app.price_yearly, '/yr');
    const oneTime = formatCurrency(app.price_inr);
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
            value: monthly,
            detail: 'Billed monthly after merchant approval.',
        });
    }

    if (yearly) {
        rows.push({
            label: 'Annual plan',
            value: yearly,
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

    if (app.pricing_model === 'usage_based') {
        rows.push({
            label: 'Usage charges',
            value: 'Usage-based',
            detail: 'Charges depend on app usage and must be approved in billing.',
        });
    }

    return rows;
}

export default async function AppDetailPage({ params }: AppDetailPageProps) {
    const { slug } = await params;
    const app = await AppService.getAppBySlug(slug);
    if (!app) notFound();

    const appWithVersion = app as MarketplaceAppVersionFields;
    const { reviews } = await AppService.getAppReviews(app.id, 10);
    const category = APP_CATEGORIES.find((item) => item.slug === app.app_categories?.slug) || app.app_categories;
    const price = getAppPriceDisplay(app);
    const { apps: relatedApps } = await AppService.listApps({ category: app.app_categories?.slug, limit: 4 });
    const filteredRelated = relatedApps.filter((item) => item.id !== app.id).slice(0, 3);
    const screenshots = getAppScreenshots(app);
    const scopes = getAppScopes(app);
    const rating = getAppRating(app);
    const reviewCount = getReviewCount(app);
    const installCount = getInstallCount(app);
    const verified = isVerifiedDeveloper(app);
    const iconTone = getIconTone(app.name);
    const launchUrl = getAppLaunchUrl(app);
    const developerName = getDeveloperName(app);
    const version = app.current_version || appWithVersion.version || '1.0.0';
    const privacyUrl = app.privacy_policy_url || app.privacy_url || null;
    const termsUrl = app.terms_url || null;
    const pricingRows = getPricingRows(app, price);

    return (
        <>
            <Header />
            <main className="appstore-main app-detail-page">
                <section className="app-detail-hero">
                    <div className="app-detail-hero__icon">
                        {app.icon_url ? (
                            <img src={app.icon_url} alt={app.name} />
                        ) : (
                            <div className={`app-detail-icon-placeholder app-icon-tone-${iconTone}`}>
                                {app.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="app-detail-hero__content">
                        <div className="app-detail-hero__badges">
                            <span className="marketplace-badge marketplace-badge--success">
                                <ShieldCheck size={12} aria-hidden="true" />
                                Built for LetBuyy
                            </span>
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
                        </div>
                        <h1>{app.name}</h1>
                        <p>{app.tagline}</p>
                        <div className="app-detail-hero__meta">
                            <span>
                                <Star size={14} fill="currentColor" stroke="currentColor" aria-hidden="true" />
                                {rating.toFixed(1)} ({reviewCount.toLocaleString()} reviews)
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

                <div className="app-detail">
                    <div className="app-detail-main">
                        <section className="marketplace-card marketplace-section">
                            <div className="marketplace-section-header">
                                <h2>Preview</h2>
                                <p>Review screenshots and expected merchant surfaces before granting access.</p>
                            </div>
                            <div className="app-preview-carousel" aria-label={`${app.name} screenshots`}>
                                <div className="app-screenshots">
                                    {screenshots.map((item, index) => (
                                        <figure
                                            id={`screenshot-${index + 1}`}
                                            key={`${item || 'placeholder'}-${index}`}
                                            className="app-screenshot"
                                        >
                                            {typeof item === 'string' ? (
                                                <img src={item} alt={`${app.name} screenshot ${index + 1}`} />
                                            ) : (
                                                <div className="app-screenshot-placeholder">
                                                    <ImageIcon size={28} aria-hidden="true" />
                                                    <span>Screenshot {index + 1}</span>
                                                    <small>Awaiting approved media from the app partner.</small>
                                                </div>
                                            )}
                                            <figcaption>
                                                <span>Preview {index + 1}</span>
                                                <span>{typeof item === 'string' ? 'Partner media' : 'Media pending'}</span>
                                            </figcaption>
                                        </figure>
                                    ))}
                                </div>
                                <div className="app-carousel-controls" aria-label="Screenshot navigation">
                                    {screenshots.map((item, index) => (
                                        <a key={`control-${item || 'placeholder'}-${index}`} href={`#screenshot-${index + 1}`}>
                                            <span>{index + 1}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </section>

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
                            <div className="marketplace-banner marketplace-banner--info">
                                <strong>Billing approval required</strong>
                                <span>Paid app charges are not activated until the merchant reviews and approves the billing terms.</span>
                            </div>
                        </section>

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
                                <h2>Reviews ({reviews.length})</h2>
                                <p>Store owner feedback and implementation notes.</p>
                            </div>
                            {reviews.length > 0 ? (
                                <div className="review-list">
                                    {reviews.map((review) => (
                                        <article key={review.id} className="review-card">
                                            <div className="review-header">
                                                <div className="marketplace-avatar">{getInitials(review.user_name || 'Anonymous')}</div>
                                                <div>
                                                    <div className="review-author">{review.user_name || 'Anonymous'}</div>
                                                    <StarRating rating={review.rating} size={12} showValue={false} />
                                                </div>
                                                <span className="review-date">{formatDate(review.created_at)}</span>
                                            </div>
                                            <p className="review-body">
                                                <strong>{review.title}</strong>
                                                <br />
                                                {review.body}
                                            </p>
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
                                launchUrl={launchUrl}
                                privacyUrl={privacyUrl}
                                termsUrl={termsUrl}
                            />
                        </section>

                        <section className="marketplace-card marketplace-section">
                            <div className="marketplace-section-header">
                                <h2>Trust and details</h2>
                            </div>
                            <div className="app-trust-list">
                                <div className="app-trust-row">
                                    <ShieldCheck size={15} aria-hidden="true" />
                                    <span>Built for LetBuyy</span>
                                </div>
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
                                    <span className="app-sidebar-info-value">{formatDate(app.updated_at || app.created_at)}</span>
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
                    </aside>
                </div>

                {filteredRelated.length > 0 && (
                    <section className="marketplace-card marketplace-section">
                        <div className="marketplace-section-header">
                            <h2>You might also like</h2>
                        </div>
                        <div className="app-card-grid">
                            {filteredRelated.map((item) => (
                                <AppCard key={item.id} app={item} />
                            ))}
                        </div>
                    </section>
                )}
            </main>
            <Footer />
        </>
    );
}
