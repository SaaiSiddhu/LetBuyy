import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import {
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    Clock,
    Copy,
    Download,
    ExternalLink,
    IndianRupee,
    Pencil,
    Plus,
    ShieldCheck,
    Star,
    Store,
    Users,
} from '@letbuyy/ui';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { createAppMarketplaceApiClient } from '@/lib/api/client';
import type { MarketplaceApp, MarketplaceReviewRecord, PartnerDashboard } from '@letbuyy/shared-types';
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
    const stores = dashboard.development_stores || [];
    const managedStores = dashboard.collaborator_access.managed_stores || [];
    const appsWithRatings = appList.filter((app) => getRating(app) > 0);
    const avgRating = appsWithRatings.length > 0
        ? (appsWithRatings.reduce((sum, app) => sum + getRating(app), 0) / appsWithRatings.length).toFixed(1)
        : '—';
    const totalReviews = appList.reduce((sum, app) => sum + (app.review_count || 0), 0);

    const statusColors: Record<string, string> = {
        published: '#16a34a',
        draft: '#6b7280',
        in_review: '#d97706',
        suspended: '#dc2626',
        rejected: '#dc2626',
    };
    const reviewStatusColors: Record<string, string> = {
        approved: '#16a34a',
        pending: '#d97706',
        changes_requested: '#d97706',
        rejected: '#dc2626',
    };

    return (
        <>
            <Header />
            <main className="appstore-main">
                <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Partner Console</h1>
                        <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
                            Welcome back, {developer.company_name || 'Developer'}
                            {developer.verified && <ShieldCheck size={14} style={{ marginLeft: 6, display: 'inline', color: '#16a34a' }} />}
                        </p>
                    </div>
                    <Link href="/developers/apps/new" className="dev-portal-cta">
                        <Plus size={16} />
                        Submit New App
                    </Link>
                </div>

                {/* Stats */}
                <div className="dev-stats-grid">
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">Total Installs</div>
                        <div className="dev-stat-value">{analytics.active_installations.toLocaleString('en-IN')}</div>
                        <div className="dev-stat-change">
                            <Download size={12} style={{ display: 'inline' }} /> {analytics.uninstalls.toLocaleString('en-IN')} uninstalls tracked
                        </div>
                    </div>
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">Partner Earnings</div>
                        <div className="dev-stat-value">{formatInrMinor(analytics.partner_earnings_minor)}</div>
                        <div className="dev-stat-change">
                            <IndianRupee size={12} style={{ display: 'inline' }} /> Gross {formatInrMinor(analytics.gross_amount_minor)}
                        </div>
                    </div>
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">Pending Payouts</div>
                        <div className="dev-stat-value">{formatInrMinor(analytics.payout_pending_minor)}</div>
                        <div className="dev-stat-change">
                            <Clock size={12} style={{ display: 'inline' }} /> Released {formatInrMinor(analytics.payout_released_minor)}
                        </div>
                    </div>
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">GST on Earnings</div>
                        <div className="dev-stat-value">{formatInrMinor(analytics.partner_gst_minor)}</div>
                        <div className="dev-stat-change">
                            <BarChart3 size={12} style={{ display: 'inline' }} /> {analytics.published_apps} published of {analytics.total_apps} apps
                        </div>
                    </div>
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">Avg Rating</div>
                        <div className="dev-stat-value">{avgRating}</div>
                        <div className="dev-stat-change">
                            <Star size={12} style={{ display: 'inline' }} /> {totalReviews.toLocaleString('en-IN')} total reviews
                        </div>
                    </div>
                </div>

                <section style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)', padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Payout ledger</h2>
                                <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>INR revenue share, platform fee, and GST evidence from app charges.</p>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>
                                {payouts.length} entries
                            </span>
                        </div>
                        {payouts.length === 0 ? (
                            <div style={{ padding: 24, borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', fontSize: 14 }}>
                                No payout ledger entries yet.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {payouts.slice(0, 5).map((payout) => (
                                    <div key={payout.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 10 }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <span style={{ fontWeight: 700 }}>{formatInrMinor(payout.partner_amount_minor)}</span>
                                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-secondary)', textTransform: 'capitalize' }}>
                                                    {formatStatus(payout.status)}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                Rail {formatStatus(payout.rail)} · fee {formatInrMinor(payout.platform_fee_minor)}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-tertiary)' }}>
                                            {payout.created_at ? new Date(payout.created_at).toLocaleDateString('en-IN') : 'Pending date'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)', padding: 20 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Collaborator access</h2>
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>Short-lived request code for managed store access.</p>
                        <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 14, background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Copy size={14} />
                                <code style={{ fontSize: 14, fontWeight: 800 }}>{dashboard.collaborator_access.request_code}</code>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                Expires {new Date(dashboard.collaborator_access.expires_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>Scopes</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {dashboard.collaborator_access.scopes.map((scope) => (
                                    <span key={scope} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                                        {scope}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)', padding: 18 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Development stores</h2>
                        {stores.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No development stores are linked yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {stores.slice(0, 4).map((store) => (
                                    <div key={store.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13 }}>
                                                <Store size={14} />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.name}</span>
                                            </div>
                                            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{store.subdomain || 'custom domain pending'}</p>
                                        </div>
                                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'var(--bg-secondary)', textTransform: 'capitalize' }}>
                                            {store.managed ? 'managed' : 'owned'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)', padding: 18 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Managed access</h2>
                        {managedStores.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No managed stores are currently attached to this partner account.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {managedStores.slice(0, 4).map((store) => (
                                    <div key={store.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                        <Users size={14} />
                                        <span>{store.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)', padding: 18 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Billing activity</h2>
                        {charges.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No charges have been created yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {charges.slice(0, 4).map((charge) => (
                                    <div key={charge.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{charge.name}</span>
                                        <span style={{ fontWeight: 800 }}>{formatInrMinor(charge.amount_minor)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Apps list */}
                <section style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Listings and review status</h2>

                    {appList.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <Plus size={30} />
                            </div>
                            <h3>No apps yet</h3>
                            <p>Submit your first app and start reaching LetBuyy merchants.</p>
                            <Link href="/developers/apps/new" className="dev-portal-cta" style={{ display: 'inline-flex' }}>
                                <Plus size={16} />
                                Submit Your First App
                            </Link>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {appList.map((app) => {
                                const status = app.status || 'draft';
                                const review = latestReviewForApp(reviews, app.id);
                                const reviewStatus = review?.status || 'not_submitted';
                                return (
                                    <div
                                        key={app.id}
                                        style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 16,
                                        padding: 16,
                                        borderRadius: 12,
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg)',
                                        }}
                                    >
                                    {/* Icon */}
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 10,
                                        background: 'var(--bg-secondary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 24, flexShrink: 0,
                                        overflow: 'hidden',
                                    }}>
                                        {app.icon_url
                                            ? <img src={app.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <Store size={22} />}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                            <span style={{ fontWeight: 700, fontSize: 15 }}>{app.name}</span>
                                            <span style={{
                                                fontSize: 11, fontWeight: 600,
                                                padding: '2px 8px', borderRadius: 6,
                                                backgroundColor: `${statusColors[status] || '#6b7280'}15`,
                                                color: statusColors[status] || '#6b7280',
                                                textTransform: 'capitalize',
                                            }}>
                                                {status.replace('_', ' ')}
                                            </span>
                                            <span style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                padding: '2px 8px',
                                                borderRadius: 6,
                                                backgroundColor: `${reviewStatusColors[reviewStatus] || '#6b7280'}15`,
                                                color: reviewStatusColors[reviewStatus] || '#6b7280',
                                                textTransform: 'capitalize',
                                            }}>
                                                {formatStatus(reviewStatus)}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {app.tagline || 'No tagline'}
                                        </p>
                                    </div>

                                    {/* Stats */}
                                    <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>
                                        <span title="Installs"><Download size={14} style={{ display: 'inline', marginRight: 4 }} />{app.install_count || 0}</span>
                                        <span title="Rating"><Star size={14} style={{ display: 'inline', marginRight: 4 }} />{getRating(app) > 0 ? getRating(app).toFixed(1) : '—'}</span>
                                        <span title="Reviews"><CheckCircle2 size={14} style={{ display: 'inline', marginRight: 4 }} />{app.review_count || 0}</span>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                        {status === 'published' && (
                                            <Link
                                                href={`/apps/${app.slug}`}
                                                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                                            >
                                                <ExternalLink size={12} /> View
                                            </Link>
                                        )}
                                        <Link
                                            href={`/developers/apps/${app.id}/edit`}
                                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                                        >
                                            <Pencil size={12} /> Edit
                                        </Link>
                                    </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {reviews.some((record) => record.status === 'changes_requested' || record.status === 'rejected') && (
                    <section style={{ marginTop: 24, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)', padding: 18 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertTriangle size={16} />
                            Review actions
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {reviews
                                .filter((record) => record.status === 'changes_requested' || record.status === 'rejected')
                                .slice(0, 4)
                                .map((record) => (
                                    <div key={record.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
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
