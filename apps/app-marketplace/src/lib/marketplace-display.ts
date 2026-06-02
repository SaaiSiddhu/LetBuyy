import type { MarketplaceApp, MarketplaceAppExtension } from '@letbuyy/shared-types';

export interface AppPriceDisplay {
    label: string;
    detail: string;
}

export function getAppRating(app: MarketplaceApp): number {
    const rating = Number(app.rating_avg ?? app.avg_rating ?? 0);
    return Number.isFinite(rating) ? rating : 0;
}

export function getReviewCount(app: MarketplaceApp): number {
    return Number(app.review_count ?? 0);
}

export function getInstallCount(app: MarketplaceApp): number {
    return Number(app.install_count ?? 0);
}

export function getDeveloperName(app: MarketplaceApp): string {
    return app.developer_name || app.app_developers?.company_name || 'LetBuyy Partner';
}

export function isVerifiedDeveloper(app: MarketplaceApp): boolean {
    return Boolean(app.app_developers?.verified);
}

export function getCategoryName(app: MarketplaceApp): string {
    return app.app_categories?.name || 'Marketplace app';
}

export function getAppPriceDisplay(app: MarketplaceApp): AppPriceDisplay {
    const price = Number(app.price_monthly ?? app.price_inr ?? 0);
    if (app.pricing_model === 'free') return { label: 'Free', detail: 'No charges' };
    if (app.pricing_model === 'freemium') return { label: 'Free plan', detail: 'Paid features available' };
    if (app.pricing_model === 'usage_based') return { label: 'Usage-based', detail: 'Pay as you grow' };
    if (app.pricing_model === 'one_time' && price > 0) {
        return { label: `₹${price.toLocaleString('en-IN')}`, detail: 'One-time purchase' };
    }
    if (app.pricing_model === 'recurring' && price > 0) {
        return { label: `₹${price.toLocaleString('en-IN')}/mo`, detail: 'Recurring subscription' };
    }
    return { label: 'Free', detail: 'No charges' };
}

export function formatScopeLabel(scope: string): string {
    return scope
        .replace(/^read_/, 'Read ')
        .replace(/^write_/, 'Manage ')
        .replace(/^delete_/, 'Delete ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getAppScopes(app: MarketplaceApp): string[] {
    return app.api_scopes && app.api_scopes.length > 0 ? app.api_scopes : app.scopes || [];
}

export function getAppScreenshots(app: MarketplaceApp): Array<string | null> {
    return app.screenshots && app.screenshots.length > 0 ? app.screenshots : [null, null, null];
}

export function getPrimaryAdminExtension(app: MarketplaceApp): MarketplaceAppExtension | null {
    const extensions = app.app_extensions || app.extensions || [];
    return extensions.find((extension) => extension.type === 'admin_link' || extension.type === 'settings_page') || null;
}

export function getAppLaunchUrl(app: MarketplaceApp): string | null {
    return typeof app.app_url === 'string' && app.app_url.length > 0 ? app.app_url : null;
}

export function getIconTone(name: string): number {
    return name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;
}
