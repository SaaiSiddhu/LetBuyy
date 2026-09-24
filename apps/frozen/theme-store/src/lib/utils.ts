import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Format price for display */
export function formatPrice(price: number, currency: string = 'USD') {
    if (price === 0) return 'Free';
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(price);
}

export function formatThemePrice(theme: {
    letbuyy_price_inr?: number | null;
    letbuyy_price_usd?: number | null;
}) {
    const inr = typeof theme.letbuyy_price_inr === 'number' ? theme.letbuyy_price_inr : 0;
    const usd = typeof theme.letbuyy_price_usd === 'number' ? theme.letbuyy_price_usd : 0;
    if (inr > 0) return formatPrice(inr, 'INR');
    return formatPrice(usd, 'USD');
}

/** Format large numbers (1200 → "1.2K") */
export function formatCount(count: number) {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
}

export function formatReviewSummary(reviewCount: number, rating: number) {
    if (reviewCount <= 0) return '0 reviews';
    const ratingLabel = Number.isFinite(rating) ? rating.toFixed(1) : 'Unrated';
    return `${ratingLabel} (${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})`;
}

function parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function themeFacetHref(kind: 'tag' | 'feature', value: string) {
    return `/themes?${kind}=${encodeURIComponent(value)}`;
}

export function themeCompareSingleHref(slug: string) {
    return `/themes/compare?themes=${encodeURIComponent(slug)}`;
}

export function themeSandboxPreviewHref(slug: string) {
    return `/preview/${encodeURIComponent(slug)}?theme=${encodeURIComponent(slug)}`;
}

export function themeDetailSharePath(slug: string) {
    return `/themes/${encodeURIComponent(slug)}`;
}

export function getThemeFreshnessBadge(theme: { published_at?: string | null; updated_at?: string | null }, now = new Date()) {
    const publishedAt = parseDate(theme.published_at);
    const updatedAt = parseDate(theme.updated_at);
    const dayMs = 24 * 60 * 60 * 1000;

    if (publishedAt && (now.getTime() - publishedAt.getTime()) / dayMs <= 30) {
        return 'New';
    }

    if (updatedAt && (now.getTime() - updatedAt.getTime()) / dayMs <= 60) {
        return 'Updated';
    }

    return null;
}

export function formatRelativeUpdatedAt(value?: string | null, now = new Date()) {
    const updatedAt = parseDate(value);
    if (!updatedAt) return 'Updated date unavailable';

    const elapsedMs = Math.max(0, now.getTime() - updatedAt.getTime());
    const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
    if (elapsedDays === 0) return 'Updated today';
    if (elapsedDays === 1) return 'Updated 1 day ago';
    if (elapsedDays < 30) return `Updated ${elapsedDays} days ago`;

    const elapsedMonths = Math.floor(elapsedDays / 30);
    if (elapsedMonths <= 1) return 'Updated 1 month ago';
    if (elapsedMonths < 12) return `Updated ${elapsedMonths} months ago`;

    const elapsedYears = Math.floor(elapsedMonths / 12);
    return elapsedYears <= 1 ? 'Updated 1 year ago' : `Updated ${elapsedYears} years ago`;
}

export function isCommandSearchShortcut(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey'>) {
    return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
}

/** Category labels */
export const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
    store: { label: 'Store', icon: 'shopping_bag' },
    portfolio: { label: 'Portfolio', icon: 'palette' },
    resume: { label: 'Resume', icon: 'description' },
    landing: { label: 'Landing', icon: 'rocket_launch' },
    saas: { label: 'SaaS', icon: 'auto_awesome' },
};
