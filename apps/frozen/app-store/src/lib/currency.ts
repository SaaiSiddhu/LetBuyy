import { formatCurrency, formatInrCurrency } from '@letbuyy/ui/formatting';

export function formatMarketplaceMoney(
    value: number | null | undefined,
    currency = process.env.NEXT_PUBLIC_MP_CURRENCY || 'INR',
): string | null {
    if (currency === 'INR') {
        return formatInrCurrency(value, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 0,
            requirePositive: true,
        });
    }

    if (typeof value !== 'number' || value <= 0) return null;
    return formatCurrency(value, { currency });
}
