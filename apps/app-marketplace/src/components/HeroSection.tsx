import Link from 'next/link';
import { BadgeCheck, Download, ShieldCheck, Star } from '@letbuyy/ui';
import type { MarketplaceApp } from '@letbuyy/shared-types';
import {
    getAppPriceDisplay,
    getAppRating,
    getDeveloperName,
    getIconTone,
    getInstallCount,
    getReviewCount,
    isVerifiedDeveloper,
} from '@/lib/marketplace-display';

interface HeroSectionProps {
    app: MarketplaceApp;
}

export function HeroSection({ app }: HeroSectionProps) {
    const rating = getAppRating(app);
    const reviewCount = getReviewCount(app);
    const installCount = getInstallCount(app);
    const price = getAppPriceDisplay(app);
    const verified = isVerifiedDeveloper(app);
    const iconTone = getIconTone(app.name);

    return (
        <div className="hero-section">
            <div className="hero-content">
                <div className="hero-icon">
                    {app.icon_url ? (
                        <img src={app.icon_url} alt={app.name} />
                    ) : (
                        <div className={`hero-icon-placeholder app-icon-tone-${iconTone}`}>
                            {app.name.charAt(0)}
                        </div>
                    )}
                </div>

                <div className="hero-info">
                    <div className="hero-badge-row">
                        <span className="marketplace-badge marketplace-badge--info">
                            <Star size={12} aria-hidden="true" />
                            Staff pick
                        </span>
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
                    </div>
                    <h1 className="hero-title">{app.name}</h1>
                    <p className="hero-tagline">{app.tagline}</p>

                    <div className="hero-meta">
                        <span>
                            <Star size={14} fill="currentColor" stroke="currentColor" />
                            {rating.toFixed(1)} ({reviewCount.toLocaleString()} reviews)
                        </span>
                        <span className="hero-meta-divider" />
                        <span>
                            <Download size={14} />
                            {installCount.toLocaleString()} installs
                        </span>
                        <span className="hero-meta-divider" />
                        <span>
                            {price.label}
                        </span>
                        <span className="hero-meta-divider" />
                        <span>
                            {verified ? <ShieldCheck size={14} /> : <BadgeCheck size={14} />}
                            {getDeveloperName(app)}
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
