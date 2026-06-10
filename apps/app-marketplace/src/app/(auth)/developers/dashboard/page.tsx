import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ApiKeyPanel } from '@/components/ApiKeyPanel';
import { CollaboratorCodePanel } from '@/components/CollaboratorCodePanel';
import { DeveloperPricingPlanManager } from '@/components/DeveloperPricingPlanManager';
import { DeveloperUsageMeterPanel } from '@/components/DeveloperUsageMeterPanel';
import { DeveloperApiUsagePanel } from '@/components/DeveloperApiUsagePanel';
import { DeveloperAnalyticsChart } from '@/components/DeveloperAnalyticsChart';
import { DeveloperAppVersionManager } from '@/components/DeveloperAppVersionManager';
import { DeveloperReviewReplyPanel } from '@/components/DeveloperReviewReplyPanel';
import { DeveloperWebhookManager } from '@/components/DeveloperWebhookManager';
import { PartnerTierPanel } from '@/components/PartnerTierPanel';
import { SandboxStorePanel } from '@/components/SandboxStorePanel';
import Link from 'next/link';
import {
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    Clock,
    Download,
    IndianRupee,
    Plus,
    ShieldCheck,
    Star,
    Store,
    Users,
} from '@letbuyy/ui';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { createAppMarketplaceApiClient } from '@/lib/api/client';
import type {
    AppSandboxStore,
    AppVersion,
    MarketplaceApp,
    MarketplaceAppReview,
    MarketplaceReviewRecord,
    PartnerAnalyticsTimeseries,
    PartnerDashboard,
    PartnerTier,
} from '@letbuyy/shared-types';
import Image from 'next/image';
import { redirect } from 'next/navigation';

export const metadata = {
    title: 'Partner Console - LetBuyy App Store',
    description: 'Manage partner apps, payouts, stores, collaborator access, and analytics.',
};

function getRating(app: MarketplaceApp): number {
    const rating = Number(app.rating_avg ?? app.avg_rating ?? 0);
    return Number.isFinite(rating) ? rating : 0;
}

function formatInrMinor(value: number | null | undefined): string {
    const amount = Math.max(0, Number(value || 0)) / 100;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatStatus(value: string | null | undefined): string {
    return String(value || 'unknown').replace(/_/g, ' ');
}

function statusBadgeClass(value: string | null | undefined): string {
    const status = String(value || '').toLowerCase();
    if (status === 'published' || status === 'approved' || status === 'active') return 'marketplace-badge marketplace-badge--success';
    if (status === 'trialing') return 'marketplace-badge marketplace-badge--info';
    if (status === 'rejected' || status === 'suspended') return 'marketplace-badge marketplace-badge--critical';
    if (status === 'pending' || status === 'changes_requested' || status === 'in_review') return 'marketplace-badge marketplace-badge--warning';
    return 'marketplace-badge marketplace-badge--neutral';
}

function latestReviewForApp(records: MarketplaceReviewRecord[], appId: string): MarketplaceReviewRecord | undefined {
    return records.find((record) => record.submission_type === 'app' && record.resource_id === appId);
}

export default async function DeveloperDashboardPage() {
    const dashboard: PartnerDashboard = await createAppMarketplaceApiClient({ requireSession: true })
        .then((api) => api.appStore.partnerDashboard())
        .catch((error) => {
            if (error instanceof LetbuyyApiError && (error.status === 401 || error.status === 404)) {
                redirect('/developers/register');
            }
            redirect('/developers/register');
        });

    const developer = dashboard.developer;
    const appList = dashboard.apps || [];
    const analytics = dashboard.analytics;
    const reviews = dashboard.review_records || [];
    const payouts = dashboard.payouts || [];
    const charges = dashboard.charges || [];
    const pricingPlans = dashboard.pricing_plans || [];
    const appVersions = (dashboard.app_versions || []) as AppVersion[];
    const stores = dashboard.development_stores || [];
    const managedStores = dashboard.collaborator_access.managed_stores || [];
    const appsWithRatings = appList.filter((app) => getRating(app) > 0);
    const avgRating = appsWithRatings.length > 0
        ? (appsWithRatings.reduce((sum, app) => sum + getRating(app), 0) / appsWithRatings.length).toFixed(1)
        : '—';
    const totalReviews = appList.reduce((sum, app) => sum + (app.review_count || 0), 0);
    const actionableReviews = reviews
        .filter((record) => record.status === 'changes_requested' || record.status === 'rejected')
        .slice(0, 4);
    const partnerTooling = await createAppMarketplaceApiClient({ requireSession: true })
        .then(async (api) => {
            const [timeseries, tierResult, sandboxResult] = await Promise.all([
                api.appStore.partnerAnalytics({ days: 30 }).catch(() => null),
                api.appStore.partnerTiers().catch(() => null),
                api.appStore.sandboxStores().catch(() => null),
            ]);
            return {
                timeseries: timeseries as PartnerAnalyticsTimeseries | null,
                tiers: (tierResult?.tiers || []) as PartnerTier[],
                sandboxStores: (sandboxResult?.stores || []) as AppSandboxStore[],
            };
        })
        .catch(() => ({
            timeseries: {
                points: dashboard.analytics_timeseries || [],
                totals: dashboard.analytics,
            } as PartnerAnalyticsTimeseries,
            tiers: (dashboard.partner_tiers || []) as PartnerTier[],
            sandboxStores: (dashboard.sandbox_stores || []) as AppSandboxStore[],
        }));
    const reviewsByApp = await createAppMarketplaceApiClient({ requireSession: true })
        .then(async (api) => {
            const pairs = await Promise.all(appList.map(async (app) => {
                const result = await api.appStore.reviews(app.id, { limit: 3 }).catch(() => null);
                return [app.id, result?.data || []] as const;
            }));
            return Object.fromEntries(pairs) as Record<string, MarketplaceAppReview[]>;
        })
        .catch(() => ({} as Record<string, MarketplaceAppReview[]>));

    return (
        <>
            <Header />
            <main className="appstore-main">
                <div className="dashboard-header">
                    <div>
                        <h1 className="marketplace-page-title">Partner Console</h1>
                        <p className="marketplace-page-subtitle">
                            Welcome back, {developer.company_name || 'Developer'}
                            {developer.verified && <ShieldCheck size={14} className="marketplace-icon-success" aria-hidden="true" />}
                        </p>
                    </div>
                    <Link href="/developers/apps/new" className="dev-portal-cta">
                        <Plus size={16} />
                        Submit New App
                    </Link>
                </div>

                {developer.status !== 'approved' && (
                    <section className="dashboard-section dashboard-section--compact marketplace-panel">
                        <h2 className="marketplace-panel-title marketplace-row">
                            <Clock size={16} />
                            Applicant status
                        </h2>
                        <p className="marketplace-panel-copy">
                            Your developer profile is {formatStatus(developer.status)}. You can prepare drafts, but app submissions require approval.
                        </p>
                    </section>
                )}

                <div className="dev-stats-grid">
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">Total Installs</div>
                        <div className="dev-stat-value">{analytics.active_installations.toLocaleString('en-IN')}</div>
                        <div className="dev-stat-change">
                            <Download size={12} /> {analytics.uninstalls.toLocaleString('en-IN')} uninstalls tracked
                        </div>
                    </div>
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">Partner Earnings</div>
                        <div className="dev-stat-value">{formatInrMinor(analytics.partner_earnings_minor)}</div>
                        <div className="dev-stat-change">
                            <IndianRupee size={12} /> Gross {formatInrMinor(analytics.gross_amount_minor)}
                        </div>
                    </div>
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">Pending Payouts</div>
                        <div className="dev-stat-value">{formatInrMinor(analytics.payout_pending_minor)}</div>
                        <div className="dev-stat-change">
                            <Clock size={12} /> Released {formatInrMinor(analytics.payout_released_minor)}
                        </div>
                    </div>
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">GST on Earnings</div>
                        <div className="dev-stat-value">{formatInrMinor(analytics.partner_gst_minor)}</div>
                        <div className="dev-stat-change">
                            <BarChart3 size={12} /> {analytics.published_apps} published of {analytics.total_apps} apps
                        </div>
                    </div>
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">Avg Rating</div>
                        <div className="dev-stat-value">{avgRating}</div>
                        <div className="dev-stat-change">
                            <Star size={12} /> {totalReviews.toLocaleString('en-IN')} total reviews
                        </div>
                    </div>
                </div>

                <DeveloperAnalyticsChart timeseries={partnerTooling.timeseries} />

                <section className="dashboard-section marketplace-grid marketplace-grid--two">
                    <div className="marketplace-panel">
                        <div className="marketplace-panel-header">
                            <div>
                                <h2 className="marketplace-panel-title">Payout metadata</h2>
                                <p className="marketplace-panel-copy">Pricing, tax, and payout evidence metadata for approval-gated app-charge flows.</p>
                            </div>
                            <span className="marketplace-badge marketplace-badge--neutral">{payouts.length} entries</span>
                        </div>
                        {payouts.length === 0 ? (
                            <div className="dashboard-empty">No payout ledger entries yet.</div>
                        ) : (
                            <div className="marketplace-stack">
                                {payouts.slice(0, 5).map((payout) => (
                                    <div key={payout.id} className="dashboard-entry">
                                        <div>
                                            <div className="marketplace-row">
                                                <span className="dashboard-entry__amount">{formatInrMinor(payout.partner_amount_minor)}</span>
                                                <span className={statusBadgeClass(payout.status)}>{formatStatus(payout.status)}</span>
                                            </div>
                                            <p className="marketplace-panel-copy">
                                                Rail {formatStatus(payout.rail)} · fee {formatInrMinor(payout.platform_fee_minor)}
                                            </p>
                                        </div>
                                        <div className="dashboard-entry__date">
                                            {payout.created_at ? new Date(payout.created_at).toLocaleDateString('en-IN') : 'Pending date'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="marketplace-panel">
                        <h2 className="marketplace-panel-title">Collaborator access</h2>
                        <p className="marketplace-panel-copy">Short-lived request code for managed store access.</p>
                        <div className="marketplace-spaced-sm">
                            <CollaboratorCodePanel initialAccess={dashboard.collaborator_access} />
                        </div>
                        <div className="marketplace-spaced-sm">
                            <div className="dev-stat-label">Scopes</div>
                            <div className="marketplace-row marketplace-row--wrap">
                                {dashboard.collaborator_access.scopes.map((scope) => (
                                    <span key={scope} className="marketplace-badge marketplace-badge--neutral">{scope}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="dashboard-section marketplace-grid marketplace-grid--two">
                    <div className="marketplace-panel">
                        <PartnerTierPanel tiers={partnerTooling.tiers} />
                    </div>
                    <div className="marketplace-panel">
                        <SandboxStorePanel initialStores={partnerTooling.sandboxStores} defaultName={developer.company_name || 'Partner'} />
                    </div>
                </section>

                <section className="dashboard-section marketplace-grid marketplace-grid--three">
                    <div className="marketplace-panel">
                        <h2 className="marketplace-panel-title marketplace-panel-title--sm">Development stores</h2>
                        {stores.length === 0 ? (
                            <p className="marketplace-panel-copy">No development stores are linked yet.</p>
                        ) : (
                            <div className="marketplace-stack">
                                {stores.slice(0, 4).map((store) => (
                                    <div key={store.id} className="dashboard-store-row">
                                        <div className="dashboard-store-copy">
                                            <div className="dashboard-store-title">
                                                <Store size={14} />
                                                <span className="dashboard-truncate">{store.name}</span>
                                            </div>
                                            <p className="dashboard-store-subtitle">{store.subdomain || 'custom domain pending'}</p>
                                        </div>
                                        <span className="marketplace-badge marketplace-badge--neutral">
                                            {store.managed ? 'managed' : 'owned'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="marketplace-panel">
                        <h2 className="marketplace-panel-title marketplace-panel-title--sm">Managed access</h2>
                        {managedStores.length === 0 ? (
                            <p className="marketplace-panel-copy">No managed stores are currently attached to this partner account.</p>
                        ) : (
                            <div className="marketplace-stack">
                                {managedStores.slice(0, 4).map((store) => (
                                    <div key={store.id} className="dashboard-managed-row">
                                        <Users size={14} />
                                        <span>{store.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="marketplace-panel">
                        <h2 className="marketplace-panel-title marketplace-panel-title--sm">Billing activity</h2>
                        {charges.length === 0 ? (
                            <p className="marketplace-panel-copy">No charges have been created yet.</p>
                        ) : (
                            <div className="marketplace-stack">
                                {charges.slice(0, 4).map((charge) => (
                                    <div key={charge.id} className="dashboard-charge-row">
                                        <span className="dashboard-charge-name dashboard-truncate">{charge.name}</span>
                                        <span className="dashboard-charge-amount">{formatInrMinor(charge.amount_minor)}</span>
                                        <span className={statusBadgeClass(charge.status)}>{formatStatus(charge.status)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="dashboard-section">
                    <h2 className="marketplace-panel-title">Listings and review status</h2>

                    {appList.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <Plus size={30} />
                            </div>
                            <h3>No apps yet</h3>
                            <p>Submit your first app and start reaching LetBuyy merchants.</p>
                            <Link href="/developers/apps/new" className="dev-portal-cta marketplace-inline-action">
                                <Plus size={16} />
                                Submit Your First App
                            </Link>
                        </div>
                    ) : (
                        <div className="dashboard-listing-list marketplace-spaced-sm">
                            {appList.map((app) => {
                                const status = app.status || 'draft';
                                const review = latestReviewForApp(reviews, app.id);
                                const reviewStatus = review?.status || 'not_submitted';
                                const appPricingPlans = pricingPlans.filter((plan) => plan.app_id === app.id);
                                return (
                                    <div key={app.id} className="dashboard-listing-row">
                                        <div className="dashboard-listing-icon">
                                            {app.icon_url
                                                ? <Image src={app.icon_url} alt="" width={96} height={96} sizes="48px" />
                                                : <Store size={22} />}
                                        </div>

                                        <div className="dashboard-listing-main">
                                            <div className="dashboard-listing-title-row">
                                                <span className="dashboard-listing-title">{app.name}</span>
                                                <span className={statusBadgeClass(status)}>{formatStatus(status)}</span>
                                                <span className={statusBadgeClass(reviewStatus)}>{formatStatus(reviewStatus)}</span>
                                            </div>
                                            <p className="dashboard-listing-subtitle">{app.tagline || 'No tagline'}</p>
                                        </div>

                                        <div className="dashboard-listing-stats">
                                            <span className="dashboard-listing-stat" title="Installs">
                                                <Download size={14} />{app.install_count || 0}
                                            </span>
                                            <span className="dashboard-listing-stat" title="Rating">
                                                <Star size={14} />{getRating(app) > 0 ? getRating(app).toFixed(1) : '—'}
                                            </span>
                                            <span className="dashboard-listing-stat" title="Reviews">
                                                <CheckCircle2 size={14} />{app.review_count || 0}
                                            </span>
                                        </div>

                                        <div className="dashboard-listing-actions">
                                            {status === 'published' && (
                                                <Link href={`/apps/${app.slug}`} className="dashboard-link-button">
                                                    View
                                                </Link>
                                            )}
                                            <ApiKeyPanel appId={app.id} />
                                        </div>
                                        <DeveloperAppVersionManager
                                            app={app}
                                            initialVersions={appVersions.filter((version) => version.app_id === app.id)}
                                            latestReview={review || null}
                                        />
                                        <div className="dashboard-listing-plan-panel">
                                            <DeveloperPricingPlanManager appId={app.id} initialPlans={appPricingPlans} />
                                            <DeveloperUsageMeterPanel appId={app.id} />
                                            <DeveloperApiUsagePanel appId={app.id} />
                                            <DeveloperWebhookManager appId={app.id} />
                                            <DeveloperReviewReplyPanel appId={app.id} reviews={reviewsByApp[app.id] || []} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {actionableReviews.length > 0 && (
                    <section className="dashboard-section dashboard-section--compact marketplace-panel">
                        <h2 className="marketplace-panel-title marketplace-row">
                            <AlertTriangle size={16} />
                            Review actions
                        </h2>
                        <div className="marketplace-stack marketplace-spaced-sm">
                            {actionableReviews.map((record) => (
                                <div key={record.id} className="review-action-row">
                                    <strong>{record.resource_name}</strong>: {formatStatus(record.status)}
                                    {record.review_notes ? ` - ${record.review_notes}` : ''}
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
            <Footer />
        </>
    );
}
