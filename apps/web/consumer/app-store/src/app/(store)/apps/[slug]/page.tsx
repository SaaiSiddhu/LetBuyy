import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { StarRating } from '@/components/StarRating';
import { AppCard } from '@/components/AppCard';
import { AppService } from '@/lib/app-service';
import { APP_CATEGORIES } from '@/lib/constants/categories';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Download, Shield, Globe, Calendar, Star } from 'lucide-react';

interface AppDetailPageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AppDetailPageProps) {
    const { slug } = await params;
    const app = await AppService.getAppBySlug(slug);
    if (!app) return { title: 'App Not Found' };
    return {
        title: `${app.name} — LetBuyy App Store`,
        description: app.tagline as string,
    };
}

function formatPrice(model: string, priceUsd?: number, priceInr?: number): { main: string; sub: string } {
    if (model === 'free') return { main: 'Free', sub: 'No charges' };
    if (model === 'freemium') return { main: 'Free', sub: 'Paid features available' };
    if (model === 'usage_based') return { main: 'Usage-based', sub: 'Pay as you grow' };
    if (model === 'recurring' && priceInr) return { main: `₹${Number(priceInr).toLocaleString('en-IN')}/mo`, sub: 'Recurring subscription' };
    if (model === 'one_time' && priceInr) return { main: `₹${Number(priceInr).toLocaleString('en-IN')}`, sub: 'One-time purchase' };
    return { main: 'Free', sub: '' };
}

export default async function AppDetailPage({ params }: AppDetailPageProps) {
    const { slug } = await params;
    const app = await AppService.getAppBySlug(slug) as any;
    if (!app) notFound();

    const { reviews } = await AppService.getAppReviews(app.id, 10);
    const category = APP_CATEGORIES.find(c => c.slug === app.app_categories?.slug) || app.app_categories;
    const price = formatPrice(app.pricing_model, app.price_usd, app.price_inr);
    const { apps: relatedApps } = await AppService.listApps({ category: app.app_categories?.slug, limit: 3 });
    const filteredRelated = relatedApps.filter((a: any) => a.id !== app.id).slice(0, 3);

    return (
        <>
            <Header />
            <main className="appstore-main">
                {/* Breadcrumb */}
                <div style={{ fontSize: 13, color: 'var(--text-hint)', marginBottom: 20 }}>
                    <Link href="/" style={{ color: 'var(--text-hint)', textDecoration: 'none' }}>Home</Link>
                    {' › '}
                    {category && (
                        <>
                            <Link href={`/categories/${category.slug}`} style={{ color: 'var(--text-hint)', textDecoration: 'none' }}>
                                {category.name}
                            </Link>
                            {' › '}
                        </>
                    )}
                    <span style={{ color: 'var(--text-primary)' }}>{app.name}</span>
                </div>

                <div className="app-detail">
                    {/* Left column — Main content */}
                    <div className="app-detail-main">
                        {/* Header */}
                        <div className="app-detail-header">
                            <div className="app-detail-icon">
                                {app.icon_url ? (
                                    <img src={app.icon_url} alt={app.name} style={{ width: '100%', height: '100%', borderRadius: 20, objectFit: 'cover' }} />
                                ) : (
                                    <div style={{
                                        width: '100%', height: '100%',
                                        background: 'linear-gradient(135deg, var(--primary), var(--accent-cyan))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: 36, fontWeight: 800, borderRadius: 20,
                                    }}>
                                        {app.name.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h1 className="app-detail-title">{app.name}</h1>
                                <p className="app-detail-tagline">{app.tagline}</p>
                                <div className="app-detail-meta">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Star size={14} fill="#F59E0B" stroke="#F59E0B" />
                                        {Number(app.rating_avg).toFixed(1)} ({Number(app.review_count).toLocaleString()} reviews)
                                    </span>
                                    <span>•</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Download size={14} />
                                        {Number(app.install_count).toLocaleString()} installs
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Screenshots */}
                        <div className="app-screenshots">
                            {(app.screenshots?.length > 0 ? app.screenshots : [1, 2, 3]).map((item: any, i: number) => (
                                <div key={i} className="app-screenshot">
                                    {typeof item === 'string' ? (
                                        <img src={item} alt={`Screenshot ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{
                                            width: '100%', height: '100%',
                                            background: `linear-gradient(135deg, var(--bg-tertiary), var(--border))`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'var(--text-hint)', fontSize: 14,
                                        }}>
                                            Screenshot {i + 1}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Description */}
                        <div className="app-description">
                            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>About this app</h2>
                            {(app.description || '').split('\n').map((line: string, i: number) => {
                                if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
                                if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>;
                                if (line.startsWith('- ')) return <li key={i}>{line.slice(2)}</li>;
                                if (line.trim() === '') return <br key={i} />;
                                return <p key={i}>{line}</p>;
                            })}
                        </div>

                        {/* Reviews */}
                        <section style={{ marginTop: 40 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                                Reviews ({reviews.length})
                            </h2>

                            {reviews.length > 0 ? (
                                reviews.map((review: any) => (
                                    <div key={review.id} className="review-card">
                                        <div className="review-header">
                                            <div className="review-avatar">
                                                {(review.user_name || 'U').charAt(0)}
                                            </div>
                                            <div>
                                                <div className="review-author">{review.user_name || 'Anonymous'}</div>
                                                <StarRating rating={review.rating} size={12} showValue={false} />
                                            </div>
                                            <span className="review-date">
                                                {new Date(review.created_at).toLocaleDateString('en-IN', {
                                                    month: 'short', day: 'numeric', year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                        <p className="review-body" style={{ marginTop: 8 }}>
                                            <strong>{review.title}</strong><br />
                                            {review.body}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state" style={{ padding: '32px 0' }}>
                                    <p style={{ color: 'var(--text-hint)' }}>No reviews yet. Be the first to review this app!</p>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right column — Sidebar */}
                    <div className="app-detail-sidebar">
                        {/* Pricing card */}
                        <div className="app-sidebar-card">
                            <div className="app-sidebar-price">{price.main}</div>
                            <div className="app-sidebar-price-sub">{price.sub}</div>
                            <button className="app-sidebar-install-btn">
                                <Download size={16} />
                                Install App
                            </button>

                            <div className="app-sidebar-info">
                                <div className="app-sidebar-info-row">
                                    <span className="app-sidebar-info-label">Category</span>
                                    <span className="app-sidebar-info-value">
                                        {category ? `${category.icon || ''} ${category.name}` : 'Uncategorized'}
                                    </span>
                                </div>
                                <div className="app-sidebar-info-row">
                                    <span className="app-sidebar-info-label">Version</span>
                                    <span className="app-sidebar-info-value">{app.version || '1.0.0'}</span>
                                </div>
                                <div className="app-sidebar-info-row">
                                    <span className="app-sidebar-info-label">Updated</span>
                                    <span className="app-sidebar-info-value">
                                        {new Date(app.updated_at).toLocaleDateString('en-IN', {
                                            month: 'short', day: 'numeric', year: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Permissions */}
                        {app.api_scopes?.length > 0 && (
                            <div className="app-sidebar-card">
                                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                                    <Shield size={14} style={{ display: 'inline', marginRight: 6 }} />
                                    Permissions
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {app.api_scopes.map((scope: string) => (
                                        <span key={scope} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            • {scope.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Developer */}
                        <Link href={`/developers/${app.app_developers?.slug || '#'}`} className="app-developer-card">
                            <div className="app-developer-avatar">
                                {(app.app_developers?.company_name || app.name).charAt(0)}
                            </div>
                            <div>
                                <span className="app-developer-label">Developer</span>
                                <span className="app-developer-name">{app.app_developers?.company_name || 'Unknown'}</span>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Related apps */}
                {filteredRelated.length > 0 && (
                    <section className="appstore-section" style={{ marginTop: 48 }}>
                        <div className="appstore-section-header">
                            <h2 className="appstore-section-title">You might also like</h2>
                        </div>
                        <div className="app-card-grid">
                            {filteredRelated.map((a: any) => (
                                <AppCard key={a.id} app={a} />
                            ))}
                        </div>
                    </section>
                )}
            </main>
            <Footer />
        </>
    );
}
