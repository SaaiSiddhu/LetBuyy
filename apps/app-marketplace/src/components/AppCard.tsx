import Link from 'next/link';
import { BadgeCheck, Download, ShieldCheck, Star } from '@letbuyy/ui';
import type { MarketplaceApp } from '@letbuyy/shared-types';
import {
    getAppPriceDisplay,
    getAppRating,
    getCategoryName,
    getDeveloperName,
    getIconTone,
    getInstallCount,
    getReviewCount,
    isVerifiedDeveloper,
} from '@/lib/marketplace-display';

interface AppCardProps {
    app: MarketplaceApp;
}

export function AppCard({ app }: AppCardProps) {
    const rating = getAppRating(app);
    const reviewCount = getReviewCount(app);
    const installCount = getInstallCount(app);
    const price = getAppPriceDisplay(app);
    const verified = isVerifiedDeveloper(app);
    const iconTone = getIconTone(app.name);

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
                    <div className={`app-card__icon-placeholder app-icon-tone-${iconTone}`}>
                        {app.name.charAt(0)}
                    </div>
                )}
            </div>

            <div className="app-card__content">
                <div className="app-card__badges">
                    <span className="marketplace-badge marketplace-badge--success">
                        <ShieldCheck size={12} aria-hidden="true" />
                        Built for LetBuyy
                    </span>
                    {verified && (
                        <span className="marketplace-badge marketplace-badge--info">
                            <BadgeCheck size={12} aria-hidden="true" />
                            Verified
                        </span>
                    )}
                </div>
                <h3 className="app-card__name">{app.name}</h3>
                <p className="app-card__tagline">{app.tagline}</p>

                <div className="app-card__meta">
                    <div className="app-card__rating">
                        <Star size={13} fill="currentColor" stroke="currentColor" />
                        <span>{rating.toFixed(1)}</span>
                        <span className="app-card__review-count">
                            ({reviewCount.toLocaleString()})
                        </span>
                    </div>

                    <span className="app-card__meta-item">
                        <Download size={13} aria-hidden="true" />
                        {installCount.toLocaleString()}
                    </span>
                </div>

                <div className="app-card__footer">
                    <span className="app-card__developer">
                        {verified ? <ShieldCheck size={12} aria-hidden="true" /> : <BadgeCheck size={12} aria-hidden="true" />}
                        {getDeveloperName(app)}
                    </span>
                    <span className="app-card__pricing">{price.label}</span>
                </div>
                <p className="app-card__category">{getCategoryName(app)}</p>
            </div>
        </Link>
    );
}
