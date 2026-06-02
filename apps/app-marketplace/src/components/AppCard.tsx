import Link from 'next/link';
import { Star } from '@letbuyy/ui';
import type { MarketplaceApp } from '@letbuyy/shared-types';

interface AppCardProps {
    app: MarketplaceApp;
}

function getRating(app: MarketplaceApp): number {
    const rating = Number(app.rating_avg ?? app.avg_rating ?? 0);
    return Number.isFinite(rating) ? rating : 0;
}

function formatPrice(app: MarketplaceApp): string {
    if (app.pricing_model === 'free') return 'Free';
    if (app.pricing_model === 'freemium') return 'Free plan available';
    if (app.pricing_model === 'usage_based') return 'Usage-based';
    const price = Number(app.price_monthly ?? app.price_inr ?? 0);
    if (app.pricing_model === 'one_time' && price > 0) return `₹${price.toLocaleString('en-IN')}`;
    if (app.pricing_model === 'recurring' && price > 0) return `₹${price.toLocaleString('en-IN')}/mo`;
    return 'Free';
}

// Generate a consistent icon color based on app name
function getIconColor(name: string): string {
    const colors = [
        'linear-gradient(135deg, #8B5CF6, #06B6D4)',
        'linear-gradient(135deg, #EC4899, #F59E0B)',
        'linear-gradient(135deg, #3B82F6, #06B6D4)',
        'linear-gradient(135deg, #22C55E, #06B6D4)',
        'linear-gradient(135deg, #F59E0B, #EF4444)',
        'linear-gradient(135deg, #6366F1, #EC4899)',
        'linear-gradient(135deg, #14B8A6, #3B82F6)',
        'linear-gradient(135deg, #F97316, #F59E0B)',
    ];
    const idx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
    return colors[idx];
}

export function AppCard({ app }: AppCardProps) {
    return (
        <Link href={`/apps/${app.slug}`} className="app-card">
            <div className="app-card__icon">
                {app.icon_url ? (
                    <img
                        src={app.icon_url}
                        alt={app.name}
                        className="app-card__icon-img"
                    />
                ) : (
                    <div
                        className="app-card__icon-placeholder"
                        style={{
                            width: '100%',
                            height: '100%',
                            background: getIconColor(app.name),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: 22,
                            fontWeight: 800,
                            borderRadius: 14,
                        }}
                    >
                        {app.name.charAt(0)}
                    </div>
                )}
            </div>

            <div className="app-card__content">
                <h3 className="app-card__name">{app.name}</h3>
                <p className="app-card__tagline">{app.tagline}</p>

                <div className="app-card__meta">
                    <div className="app-card__rating">
                        <Star size={13} fill="#F59E0B" stroke="#F59E0B" />
                        <span>{getRating(app).toFixed(1)}</span>
                        <span className="app-card__review-count">
                            ({Number(app.review_count ?? 0).toLocaleString()})
                        </span>
                    </div>

                    <span className="app-card__pricing">{formatPrice(app)}</span>
                </div>

                <p className="app-card__developer">{app.developer_name || app.app_developers?.company_name || 'LetBuyy Partner'}</p>
            </div>
        </Link>
    );
}
