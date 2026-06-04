import Link from 'next/link';
import { BadgeCheck, Download, ShieldCheck, Star, Tag } from '@letbuyy/ui';
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

function getInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || 'A';
}

function getFilledStarCount(rating: number): number {
    return Math.max(0, Math.min(5, Math.round(rating)));
}

export function AppCard({ app }: AppCardProps) {
    const rating = getAppRating(app);
    const reviewCount = getReviewCount(app);
    const installCount = getInstallCount(app);
    const price = getAppPriceDisplay(app);
    const verified = isVerifiedDeveloper(app);
    const iconTone = getIconTone(app.name);
    const categoryName = getCategoryName(app);
    const developerName = getDeveloperName(app);
    const filledStars = getFilledStarCount(rating);
    const ratingLabel = `${rating.toFixed(1)} out of 5 stars from ${reviewCount.toLocaleString()} ${reviewCount === 1 ? 'review' : 'reviews'}`;

    return (
        <Link
            href={`/apps/${app.slug}`}
            className="app-card"
            aria-label={`${app.name}. ${categoryName}. ${price.label}. ${ratingLabel}.`}
        >
            <div className="app-card__top">
                <div className="app-card__icon" aria-hidden="true">
                    {app.icon_url ? (
                        <img
                            src={app.icon_url}
                            alt=""
                            className="app-card__icon-img"
                        />
                    ) : (
                        <div className={`app-card__icon-placeholder app-icon-tone-${iconTone}`}>
                            {getInitial(app.name)}
                        </div>
                    )}
                </div>

                <div className="app-card__content">
                    <div className="app-card__badges">
                        <span className="marketplace-badge marketplace-badge--success">
                            <ShieldCheck size={12} aria-hidden="true" />
                            Built for LetBuyy
                        </span>
                        <span className="marketplace-badge marketplace-badge--neutral app-card__category-tag">
                            <Tag size={12} aria-hidden="true" />
                            {categoryName}
                        </span>
                        {verified && (
                            <span className="marketplace-badge marketplace-badge--info">
                                <BadgeCheck size={12} aria-hidden="true" />
                                Verified
                            </span>
                        )}
                    </div>
                    <h3 className="app-card__name">{app.name}</h3>
                    <p className="app-card__tagline">{app.tagline || 'No app summary has been provided yet.'}</p>
                </div>
            </div>

            <div className="app-card__details">
                <div className="app-card__rating" aria-label={ratingLabel}>
                    <span className="app-card__stars" aria-hidden="true">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                                key={index}
                                size={13}
                                className={index < filledStars ? 'app-card__star app-card__star--filled' : 'app-card__star'}
                                fill="currentColor"
                                stroke="currentColor"
                            />
                        ))}
                    </span>
                    <span className="app-card__rating-value">{rating.toFixed(1)}</span>
                    <span className="app-card__review-count">
                        ({reviewCount.toLocaleString()})
                    </span>
                </div>

                <div className="app-card__pricing-line">
                    <span className="app-card__pricing">{price.label}</span>
                    <span className="app-card__pricing-detail">{price.detail}</span>
                </div>

                <div className="app-card__footer">
                    <span className="app-card__developer">
                        {verified ? <ShieldCheck size={12} aria-hidden="true" /> : <BadgeCheck size={12} aria-hidden="true" />}
                        {developerName}
                    </span>
                    <span className="app-card__meta-item">
                        <Download size={13} aria-hidden="true" />
                        {installCount.toLocaleString()}
                    </span>
                </div>
            </div>
        </Link>
    );
}
