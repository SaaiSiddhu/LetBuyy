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
    if (app.pricing_model === 'usage') {
        return { label: 'Usage-based', detail: 'Metered usage charges' };
    }
    if (app.pricing_model === 'one_time' && price > 0) {
        return { label: `₹${price.toLocaleString('en-IN')}`, detail: 'One-time purchase' };
    }
    if (app.pricing_model === 'recurring' && price > 0) {
        return { label: `₹${price.toLocaleString('en-IN')}/mo`, detail: 'Recurring subscription' };
    }
    return { label: 'Free', detail: 'No charges' };
}

export function isBuiltForLetbuyy(app: MarketplaceApp): boolean {
    return (app as MarketplaceApp & { built_for_letbuyy?: boolean }).built_for_letbuyy === true;
}

export function getLastUpdatedDate(app: MarketplaceApp): Date | null {
    const raw = app.updated_at || app.published_at || app.created_at;
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getUTCFullYear() <= 2000) return null;
    return date;
}

export function getRecencyLabel(app: MarketplaceApp, now = new Date()): 'New' | 'Updated' | null {
    const created = app.created_at ? new Date(app.created_at) : null;
    const updated = getLastUpdatedDate(app);
    const dayMs = 24 * 60 * 60 * 1000;

    if (created && !Number.isNaN(created.getTime()) && now.getTime() - created.getTime() <= 30 * dayMs) {
        return 'New';
    }

    if (updated && now.getTime() - updated.getTime() <= 45 * dayMs) {
        return 'Updated';
    }

    return null;
}

export function sanitizeMarketplaceSearchQuery(value: string, maxLength = 80): string {
    return value
        .normalize('NFKC')
        .replace(/[(),"%]/g, ' ')
        .replace(/[^\p{L}\p{N}\s._+#&-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

export function sanitizeMarkdownText(value: string, maxLength = 4000): string {
    return value
        .normalize('NFKC')
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/javascript:/gi, '')
        .trim()
        .slice(0, maxLength);
}

export function supportedPricingModelOptions() {
    return [
        { value: 'free', label: 'Free' },
        { value: 'freemium', label: 'Freemium (Free + paid features)' },
        { value: 'recurring', label: 'Recurring (monthly/yearly)' },
        { value: 'one_time', label: 'One-time purchase' },
        { value: 'usage', label: 'Usage-based metering' },
    ] as const;
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

export function getAppScreenshots(app: MarketplaceApp): string[] {
    return app.screenshots && app.screenshots.length > 0 ? app.screenshots : [];
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
