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
    return `${rating.toFixed(1)} / 5`;
}

/** Category labels */
export const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
    store: { label: 'Store', icon: 'shopping_bag' },
    portfolio: { label: 'Portfolio', icon: 'palette' },
    resume: { label: 'Resume', icon: 'description' },
    landing: { label: 'Landing', icon: 'rocket_launch' },
    saas: { label: 'SaaS', icon: 'auto_awesome' },
};
