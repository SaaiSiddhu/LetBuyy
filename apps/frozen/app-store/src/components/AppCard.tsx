import Link from 'next/link';
import Image from 'next/image';
import { BadgeCheck, Download, ShieldCheck, Sparkles, Tag } from '@letbuyy/ui';
import type { MarketplaceApp } from '@letbuyy/shared-types';
import { PricingTag } from './PricingTag';
import { QualityBadge } from './QualityBadge';
import { StarRating } from './StarRating';
import {
    getAppRating,
    getCategoryName,
    getDeveloperName,
    getIconTone,
    getInstallCount,
    getRecencyLabel,
    getReviewCount,
    isBuiltForLetbuyy,
    isVerifiedDeveloper,
} from '@/lib/marketplace-display';

interface AppCardProps {
    app: MarketplaceApp;
    onClick?: () => void;
    variant?: 'grid' | 'row';
}

function getInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || 'A';
}

export function AppCard({ app, onClick, variant = 'grid' }: AppCardProps) {
    const rating = getAppRating(app);
    const reviewCount = getReviewCount(app);
    const installCount = getInstallCount(app);
    const verified = isVerifiedDeveloper(app);
    const iconTone = getIconTone(app.name);
    const categoryName = getCategoryName(app);
    const developerName = getDeveloperName(app);
    const builtForLetbuyy = isBuiltForLetbuyy(app);
    const recencyLabel = getRecencyLabel(app);
    const firstPartyDemo = Boolean(app.is_first_party_demo);
    const ratingLabel = `${rating.toFixed(1)} out of 5 stars from ${reviewCount.toLocaleString()} ${reviewCount === 1 ? 'review' : 'reviews'}`;
    const cardClassName = `app-card app-card--${variant}`;

    return (
        <Link
            href={`/apps/${app.slug}`}
            className={cardClassName}
            aria-label={`${app.name}. ${categoryName}. ${ratingLabel}.`}
            onClick={onClick}
        >
            <div className="app-card__top">
                <div className="app-card__icon" aria-hidden="true">
                    {app.icon_url ? (
                        <Image
                            src={app.icon_url}
                            alt=""
                            className="app-card__icon-img"
                            width={112}
                            height={112}
                            sizes="56px"
                        />
                    ) : (
                        <div className={`app-card__icon-placeholder app-icon-tone-${iconTone}`}>
                            {getInitial(app.name)}
                        </div>
                    )}
                </div>

                <div className="app-card__content">
                    <div className="app-card__badges">
                        <QualityBadge compact show={builtForLetbuyy} />
                        {firstPartyDemo && (
                            <span className="marketplace-badge marketplace-badge--neutral">
                                <Sparkles size={12} aria-hidden="true" />
                                First-party demo
                            </span>
                        )}
                        {recencyLabel && (
                            <span className="marketplace-badge marketplace-badge--info">
                                <Sparkles size={12} aria-hidden="true" />
                                {recencyLabel}
                            </span>
                        )}
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
                <div className="app-card__rating">
                    <StarRating rating={rating} reviewCount={reviewCount} size={13} />
                </div>

                <div className="app-card__pricing-line">
                    <PricingTag app={app} className="app-card__pricing" />
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
