import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import { Plus, Download, Star, Eye, ExternalLink, Pencil, BarChart3 } from 'lucide-react';
import { appStoreWorkerFetch } from '@/lib/api/worker-client';
import { redirect } from 'next/navigation';

export const metadata = {
    title: 'Developer Dashboard — LetBuyy App Store',
    description: 'Manage your published apps and view analytics.',
};

interface DeveloperProfile {
    id: string;
    company_name: string;
    status: string;
    verified: boolean;
}

interface DeveloperApp {
    id: string;
    name: string;
    slug: string;
    tagline?: string | null;
    icon_url?: string | null;
    status: string;
    install_count?: number | null;
    rating_avg?: number | string | null;
    review_count?: number | null;
}

function getRating(app: DeveloperApp): number {
    const rating = Number(app.rating_avg || 0);
    return Number.isFinite(rating) ? rating : 0;
}

export default async function DeveloperDashboardPage() {
    const response = await appStoreWorkerFetch('/app-store/developers/apps', {
        method: 'GET',
        requireSession: true,
    });

    if (response.status === 401 || response.status === 404) redirect('/developers/register');

    const payload = await response.json() as {
        data?: {
            developer: DeveloperProfile;
            apps: DeveloperApp[];
        };
    };

    if (!response.ok || !payload.data?.developer) redirect('/developers/register');

    const developer = payload.data.developer;
    const appList = payload.data.apps || [];

    // Calculate aggregate stats
    const totalInstalls = appList.reduce((sum, app) => sum + (app.install_count || 0), 0);
    const appsWithRatings = appList.filter(a => getRating(a) > 0);
    const avgRating = appsWithRatings.length > 0
        ? (appsWithRatings.reduce((sum, a) => sum + getRating(a), 0) / appsWithRatings.length).toFixed(1)
        : '—';
    const totalReviews = appList.reduce((sum, app) => sum + (app.review_count || 0), 0);
    const publishedCount = appList.filter(a => a.status === 'published').length;

    const statusColors: Record<string, string> = {
        published: '#16a34a',
        draft: '#6b7280',
        in_review: '#d97706',
        suspended: '#dc2626',
        rejected: '#dc2626',
    };

    return (
        <>
            <Header />
            <main className="appstore-main">
                <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Developer Dashboard</h1>
                        <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
                            Welcome back, {developer.company_name}
                            {developer.verified && <span title="Verified Developer" style={{ marginLeft: 6 }}>✅</span>}
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
                        <div className="dev-stat-value">{totalInstalls.toLocaleString()}</div>
                        <div className="dev-stat-change">
                            <Download size={12} style={{ display: 'inline' }} /> Across {publishedCount} published apps
                        </div>
                    </div>
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">Avg Rating</div>
                        <div className="dev-stat-value">{avgRating}</div>
                        <div className="dev-stat-change">
                            <Star size={12} style={{ display: 'inline' }} /> {totalReviews} total reviews
                        </div>
                    </div>
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">Published Apps</div>
                        <div className="dev-stat-value">{publishedCount}</div>
                        <div className="dev-stat-change">
                            <BarChart3 size={12} style={{ display: 'inline' }} /> {appList.length} total
                        </div>
                    </div>
                    <div className="dev-stat-card">
                        <div className="dev-stat-label">Status</div>
                        <div className="dev-stat-value" style={{ color: developer.status === 'approved' ? '#16a34a' : '#d97706', textTransform: 'capitalize' }}>
                            {developer.status}
                        </div>
                        <div className="dev-stat-change">
                            <Eye size={12} style={{ display: 'inline' }} /> Developer account
                        </div>
                    </div>
                </div>

                {/* Apps list */}
                <section style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Your Apps</h2>

                    {appList.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🚀</div>
                            <h3>No apps yet</h3>
                            <p>Submit your first app and start reaching LetBuyy merchants.</p>
                            <Link href="/developers/apps/new" className="dev-portal-cta" style={{ display: 'inline-flex' }}>
                                <Plus size={16} />
                                Submit Your First App
                            </Link>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {appList.map((app) => (
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
                                            : '📦'}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                            <span style={{ fontWeight: 700, fontSize: 15 }}>{app.name}</span>
                                            <span style={{
                                                fontSize: 11, fontWeight: 600,
                                                padding: '2px 8px', borderRadius: 6,
                                                backgroundColor: `${statusColors[app.status] || '#6b7280'}15`,
                                                color: statusColors[app.status] || '#6b7280',
                                                textTransform: 'capitalize',
                                            }}>
                                                {app.status.replace('_', ' ')}
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
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                        {app.status === 'published' && (
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
                            ))}
                        </div>
                    )}
                </section>
            </main>
            <Footer />
        </>
    );
}
