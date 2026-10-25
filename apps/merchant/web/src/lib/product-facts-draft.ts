import { ApparelFactsSchema, GiftFactsSchema, PRODUCT_NICHE_FACT_SCHEMAS, ProductMetadataSchema, rebindGiftMediaRoles } from '@letbuyy/commerce-core';

export const PRODUCT_FACT_NAMESPACES = Object.keys(PRODUCT_NICHE_FACT_SCHEMAS) as Array<keyof typeof PRODUCT_NICHE_FACT_SCHEMAS>;
const known = new Set<string>(PRODUCT_FACT_NAMESPACES);
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

/** Raw merchant draft, including invalid historical values so they can be repaired deliberately. */
export function captureProductFacts(metadata: unknown): Record<string, unknown> {
    const input = record(metadata);
    return Object.fromEntries(PRODUCT_FACT_NAMESPACES.flatMap(namespace => {
        const field = Object.getOwnPropertyDescriptor(input, namespace);
        return field && 'value' in field ? [[namespace, field.value]] : [];
    }));
}

/** Empty string denotes an older retained draft with no intent to modify new fact namespaces. */
export function readProductFactsDraft(value: string, metadata?: unknown): Record<string, unknown> {
    if (value === '') return captureProductFacts(metadata);
    let input: unknown;
    try { input = JSON.parse(value); } catch { throw new Error('The product facts draft could not be read. Reload or recover your draft before saving.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(namespace => !known.has(namespace))) {
        throw new Error('The product facts draft contains unsupported fields. Your draft is kept.');
    }
    return input as Record<string, unknown>;
}

export function updateProductFactsDraft(value: string, metadata: unknown, namespace: string, next: unknown | null): string {
    if (!known.has(namespace)) throw new Error('Unsupported product facts.');
    const draft = { ...readProductFactsDraft(value, metadata) };
    if (next === null) delete draft[namespace];
    else draft[namespace] = next;
    return JSON.stringify(draft);
}

/** UI draft identity only; an empty string deliberately marks an older, unassociated draft. */
export function readGiftImageOrder(value: string): string[] | null {
    if (value === '') return null;
    try {
        const images: unknown = JSON.parse(value);
        return Array.isArray(images) && images.length <= 20 && images.every(image => typeof image === 'string') ? images : null;
    } catch { return null; }
}

/** Rebase only image roles. Malformed facts/unknown fields remain editable and fail canonical validation. */
export function resolveProductGiftImages(value: string, metadata: unknown, imageOrder: string, images: readonly string[]): {
    value: string; imageOrder: string; issue?: string;
} {
    let facts: Record<string, unknown>;
    try { facts = readProductFactsDraft(value, metadata); }
    catch (error) { return { value, imageOrder, issue: error instanceof Error ? error.message : 'The product facts draft could not be read.' }; }
    const gift = record(facts.gifts);
    const draftValue = value === '' && Object.keys(facts).length ? JSON.stringify(facts) : value;
    const roles = record(gift.mediaRoles);
    const validRoles = (['openBox', 'closedBox'] as const).filter(role => roles[role] !== undefined && GiftFactsSchema.shape.mediaRoles.safeParse({ [role]: roles[role] }).success);
    const currentOrder = JSON.stringify(images);
    if (!validRoles.length) return { value: draftValue, imageOrder: currentOrder };
    const previous = readGiftImageOrder(imageOrder);
    if (!previous) return { value: draftValue, imageOrder, issue: 'Review the gift image views against the current product images before saving this restored draft.' };
    if (JSON.stringify(previous) === currentOrder) return { value: draftValue, imageOrder: currentOrder };

    const nextRoles = { ...roles };
    const known = Object.fromEntries(validRoles.map(role => [role, roles[role]]));
    const combined = GiftFactsSchema.safeParse({ mediaRoles: known });
    if (combined.success) {
        const rebound = rebindGiftMediaRoles(combined.data, previous, images);
        for (const role of validRoles) {
            delete nextRoles[role];
            if (rebound?.mediaRoles?.[role] !== undefined) nextRoles[role] = rebound.mediaRoles[role];
        }
    } else {
        // Keep an invalid duplicate-role draft invalid, with each proven reference rebased.
        for (const role of validRoles) {
            const single = GiftFactsSchema.parse({ mediaRoles: { [role]: roles[role] } });
            const rebound = rebindGiftMediaRoles(single, previous, images);
            delete nextRoles[role];
            if (rebound?.mediaRoles?.[role] !== undefined) nextRoles[role] = rebound.mediaRoles[role];
        }
    }
    const nextGift = { ...gift };
    if (Object.keys(nextRoles).length) nextGift.mediaRoles = nextRoles;
    else delete nextGift.mediaRoles;
    const next = { ...facts };
    if (Object.keys(nextGift).some(key => key !== 'schemaVersion')) next.gifts = nextGift;
    else delete next.gifts;
    return { value: JSON.stringify(next), imageOrder: currentOrder };
}

/** Single canonical metadata validation; caller retains its existing version/idempotency command. */
export function composeProductMetadata(metadata: unknown, apparelJson: string, factsJson: string): Record<string, unknown> {
    let apparel: unknown;
    try { apparel = JSON.parse(apparelJson); } catch { throw new Error('Check garment details before saving. Your draft is kept.'); }
    const garment = ApparelFactsSchema.safeParse(apparel);
    if (!garment.success) throw new Error(`Check garment details: ${garment.error.issues[0].message}`);
    const merged: Record<string, unknown> = { ...record(metadata) };
    // An untouched optional editor has no garment intent. Schema defaults must
    // not create a namespace; existing garments and explicit edits still write.
    if (Object.keys(record(apparel)).length || Object.hasOwn(merged, 'apparel')) merged.apparel = garment.data;
    const facts = readProductFactsDraft(factsJson, metadata);
    for (const namespace of PRODUCT_FACT_NAMESPACES) delete merged[namespace];
    Object.assign(merged, facts);
    const parsed = ProductMetadataSchema.safeParse(merged);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(`Check product facts${issue.path.length ? ` (${issue.path.join(' → ')})` : ''}: ${issue.message}`);
    }
    return parsed.data;
}
