import { readProductFactSnapshot, summarizeProductFacts, type ProductFactSnapshot, type ProductVariant } from '@letbuyy/commerce-core';

/** A public readback accepts only the approved field, never a raw product snapshot or current product. */
export function readOrderItemFactSnapshot(value: unknown): ProductFactSnapshot | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    try {
        const field = Object.getOwnPropertyDescriptor(value, 'niche_snapshot');
        return field && 'value' in field ? readProductFactSnapshot(field.value) : null;
    } catch { return null; }
}
export function savedOrderOptions(snapshot: ProductFactSnapshot | null): ProductVariant['options'] {
    return Object.fromEntries((snapshot?.selected_options ?? []).map(option => [option.name, option.value]));
}
/** Scalar presentation survives the unchanged Liquid depth budget; ordinary Liquid output escapes it. */
export function orderItemFactsText(value: unknown): string | null {
    const snapshot = readOrderItemFactSnapshot(value);
    if (!snapshot) return null;
    const sections = summarizeProductFacts(snapshot.facts, snapshot.personalization, savedOrderOptions(snapshot));
    if (sections.length === 1 && sections[0].id === 'unavailable') return null;
    const text = sections.map(section => `${section.title}\n${section.rows.map(row => `${row.label}: ${row.value}`).join('\n')}`).join('\n\n');
    return new TextEncoder().encode(text).byteLength <= 256 * 1024 ? text : 'Saved product details are unavailable in this view.';
}
