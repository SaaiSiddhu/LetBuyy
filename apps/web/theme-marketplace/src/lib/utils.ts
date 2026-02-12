import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Format price for display */
export function formatPrice(price: number, currency: string = 'USD') {
    if (price === 0) return 'Free';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(price);
}

/** Format large numbers (1200 → "1.2K") */
export function formatCount(count: number) {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
}

/** Render star rating as string */
export function renderStars(rating: number) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

/** Category labels */
export const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
    store: { label: 'Store', icon: '🛒' },
    portfolio: { label: 'Portfolio', icon: '🎨' },
    resume: { label: 'Resume', icon: '📄' },
    landing: { label: 'Landing', icon: '🚀' },
    saas: { label: 'SaaS', icon: '⚡' },
};
