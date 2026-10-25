import { readProductFactSnapshot } from '@letbuyy/commerce-core';

const nullableString = (row: Record<string, unknown>, key: string) => typeof row[key] === 'string' && (row[key] as string).trim() ? row[key] as string : null;
const number = (row: Record<string, unknown>, key: string) => Number(row[key] ?? 0);
/** Existing merchant display fields plus the approved immutable niche envelope. No catalog hydration. */
export function readOrderLineItems(raw: unknown) {
    if (!Array.isArray(raw)) return [];
    return raw.map((item: unknown) => {
        const row = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {};
        let nicheSnapshot = null;
        try { nicheSnapshot = readProductFactSnapshot(row.niche_snapshot); } catch { /* Malformed historical facts remain unavailable. */ }
        return {
            product_id: nullableString(row, 'product_id'), variant_id: nullableString(row, 'variant_id'),
            title: nullableString(row, 'title') ?? nullableString(row, 'name'), name: nullableString(row, 'name'), sku: nullableString(row, 'sku'),
            quantity: number(row, 'quantity') || 1, unit_price: number(row, 'unit_price') || number(row, 'price'), total: number(row, 'total'),
            variant_title: nullableString(row, 'variant_title'), image_url: nullableString(row, 'image_url') ?? nullableString(row, 'image'),
            niche_snapshot: nicheSnapshot,
        };
    });
}
