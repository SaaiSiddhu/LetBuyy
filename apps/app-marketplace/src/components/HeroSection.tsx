import Link from 'next/link';
import { Star, Download } from '@letbuyy/ui';
import type { MarketplaceApp } from '@letbuyy/shared-types';

interface HeroSectionProps {
    app: MarketplaceApp;
}

function getRating(app: MarketplaceApp): number {
    const rating = Number(app.rating_avg ?? app.avg_rating ?? 0);
    return Number.isFinite(rating) ? rating : 0;
}

export function HeroSection({ app }: HeroSectionProps) {
    const price = Number(app.price_monthly ?? app.price_inr ?? 0);

    return (
        <div className="hero-section">
            <div className="hero-content">
                <div className="hero-icon">
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            background: 'rgba(255,255,255,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: 40,
                            fontWeight: 800,
                        }}
                    >
                        {app.name.charAt(0)}
                    </div>
                </div>

                <div className="hero-info">
                    <div className="hero-badge">
                        <Star size={12} fill="white" stroke="white" /> Featured App
                    </div>
                    <h1 className="hero-title">{app.name}</h1>
                    <p className="hero-tagline">{app.tagline}</p>

                    <div className="hero-meta">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Star size={14} fill="white" stroke="white" />
                            {getRating(app).toFixed(1)} ({Number(app.review_count ?? 0).toLocaleString()} reviews)
                        </span>
                        <span className="hero-meta-divider" />
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Download size={14} />
                            {Number(app.install_count ?? 0).toLocaleString()} installs
                        </span>
                        <span className="hero-meta-divider" />
                        <span>
                            {app.pricing_model === 'free' ? 'Free' :
                                app.pricing_model === 'freemium' ? 'Free plan available' :
                                    `₹${price.toLocaleString('en-IN')}/mo`}
                        </span>
                    </div>

                    <Link href={`/apps/${app.slug}`} className="hero-install-btn">
                        View App →
                    </Link>
                </div>
            </div>
        </div>
    );
}
