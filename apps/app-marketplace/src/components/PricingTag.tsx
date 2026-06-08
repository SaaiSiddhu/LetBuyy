import type { MarketplaceApp } from '@letbuyy/shared-types';
import { getAppPriceDisplay } from '@/lib/marketplace-display';

type PricingTagVariant = 'free' | 'free_plan' | 'free_install' | 'free_trial' | 'monthly' | 'from_monthly' | 'usage';

interface PricingTagProps {
    app?: MarketplaceApp;
    caption?: string;
    className?: string;
    prefixSeparator?: boolean;
    variant?: PricingTagVariant;
}

export function getPricingTagLabel(app: MarketplaceApp): string {
    const price = getAppPriceDisplay(app);
    const monthly = Number(app.price_monthly ?? app.price_inr ?? 0);

    if (app.pricing_model === 'free') return 'Free';
    if (app.pricing_model === 'freemium') return 'Free plan available';
    if (app.pricing_model === 'usage') return 'Usage-based pricing';
    if (app.pricing_model === 'one_time' && monthly > 0) return price.label;
    if (app.pricing_model === 'recurring' && monthly > 0) return `From ${price.label.replace('/mo', '/month')}`;
    return price.label || 'Pricing not listed';
}

function getVariantLabel(variant: PricingTagVariant): string {
    switch (variant) {
        case 'free':
            return 'Free';
        case 'free_plan':
            return 'Free plan available';
        case 'free_install':
            return 'Free to install';
        case 'free_trial':
            return 'Free trial available';
        case 'monthly':
            return 'Paid monthly';
        case 'from_monthly':
            return 'From monthly pricing';
        case 'usage':
            return 'Usage-based pricing';
    }
}

export function PricingTag({ app, caption, className = '', prefixSeparator = true, variant }: PricingTagProps) {
    const label = caption ?? (app ? getPricingTagLabel(app) : variant ? getVariantLabel(variant) : 'Pricing not listed');

    return (
        <span className={`pricing-tag ${className}`.trim()}>
            {prefixSeparator ? <span aria-hidden="true">•</span> : null}
            <span>{label}</span>
        </span>
    );
}

