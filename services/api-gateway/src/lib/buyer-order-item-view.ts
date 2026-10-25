import { normalizeOrderItemRecord } from '@letbuyy/checkout-core';

const fields = ['id','product_id','variant_id','name','title','sku','quantity','price','unit_price','total','variant_title','image','image_url','variant'] as const;
/** Called only after the existing buyer-link/site authorization and item hydration. */
export function toBuyerOrderItemView(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const item = value as Record<string, unknown>;
    const output = Object.fromEntries(fields.filter(field => Object.hasOwn(item, field)).map(field => [field, item[field]]));
    // The canonical normalizer parses only the immutable product_snapshot.niche.
    // Nothing from the raw snapshot or an arbitrary item.niche_snapshot is copied.
    const snapshot = normalizeOrderItemRecord(item).niche_snapshot;
    return snapshot ? { ...output, niche_snapshot: snapshot } : output;
}
