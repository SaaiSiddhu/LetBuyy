import { readApparelFacts, readProductNicheFacts, readVariantNicheFacts } from '@letbuyy/commerce-core';
// SEC-1 — what an anonymous caller may learn about a product.
//
// The storefront public router is mounted BEFORE authMiddleware, so the column list below is served
// to whoever asks. It previously named cost_price, sku and barcode, nothing stripped them, and the
// product-detail handler returned the row as read — every storefront product page handed any visitor
// the merchant's margin data. With PRODUCT_VARIANTS_RELATIONAL_READS off the select was `'*'`, which
// additionally exposed cost_per_item, deleted_at, created_by, updated_by and version.
//
// Two controls, deliberately separate:
//   1. PUBLIC_PRODUCT_SELECT is what is asked of PostgREST — the primary control, and the reason a
//      public read must never use `'*'`: a future migration would silently widen it.
//   2. toPublicProduct re-filters the row immediately before serialisation — the backstop, which
//      still holds when a hydration step attaches keys the select never named.
//
// Column names are verified against the live `products` table (see EXECUTION_LEDGER PHASE-T3: an
// earlier list named columns that do not exist, and PostgREST rejected every call with 42703).
// Guarded by tests/contracts/public-product-exposure-contract.test.ts.

// Everything a storefront needs to render a product page. Nothing here is commercially sensitive.
export const PUBLIC_PRODUCT_SELECT: string =
    'id,store_id,name,slug,description,price,compare_price,category,product_type,tags,images,thumbnail_url,stock,catalog_available_quantity,track_inventory,is_active,is_featured,weight,country_of_origin,importer_details,seo_title,seo_description,created_at,updated_at,variants,metadata';

// Same list without `variants`, for the path that hydrates variants from product_variants instead of
// reading the products row's own column.
export const PUBLIC_PRODUCT_SELECT_RELATIONAL: string = PUBLIC_PRODUCT_SELECT.replace(',variants', '');

// The complete set of keys a public product response may carry: the select above, plus the second
// key variant hydration attaches alongside `variants`.
export const PUBLIC_PRODUCT_FIELDS: ReadonlySet<string> = new Set([
    ...PUBLIC_PRODUCT_SELECT.split(','),
    'product_variants',
    'product_options',
    'prior_lowest_price_30d',
    'prior_price_coverage_complete',
    'price_observed_at',
]);

// SEC-2: the public shape of a VARIANT. Two paths produce variants and both carried stock-keeping
// identifiers to anonymous callers: the relational path mapped `sku` and `barcode` in explicitly
// (storefront.ts's publicProductVariantView), and the non-relational path returns products.variants,
// a jsonb column whose contents migration 086 builds with 'sku' and 'barcode' inside it. Nothing in
// any storefront renders either. This set is the single definition both paths now use, so they
// cannot drift apart the way the two product selects did.
export const PUBLIC_VARIANT_FIELDS: ReadonlySet<string> = new Set([
    'id',
    'product_id',
    'title',
    'price',
    'compare_price',
    'prior_lowest_price_30d',
    'prior_price_coverage_complete',
    'price_observed_at',
    'stock',
    'inventory_qty',
    'weight',
    'weight_unit',
    'option1',
    'option2',
    'option3',
    'image_url',
    'position',
    'metadata',
]);

export type PublicPriceObservation = {
    current_price: number | string | null;
    prior_lowest_price_30d: number | string | null;
    prior_coverage_complete: boolean;
    price_observed_at: string | null;
};

type PublicPriceAnnotated<T> = Omit<T, 'price' | 'compare_price' | 'prior_lowest_price_30d' | 'prior_price_coverage_complete' | 'price_observed_at'> & {
    price: number | null;
    compare_price: number | null;
    prior_lowest_price_30d: number | null;
    prior_price_coverage_complete: boolean;
    price_observed_at: string | null;
};

/** Apply recorded reference-price evidence and suppress unsupported compare-at claims. */
export function withPublicPriceObservation<T extends Record<string, unknown>>(
    item: T,
    observation: PublicPriceObservation | undefined,
): PublicPriceAnnotated<T> {
    if (!observation) return item as unknown as PublicPriceAnnotated<T>;
    const currentPrice = observation.current_price === null ? null : Number(observation.current_price);
    const priorLowest = observation.prior_lowest_price_30d === null
        ? null
        : Number(observation.prior_lowest_price_30d);
    const complete = observation.prior_coverage_complete === true;
    const supportedComparePrice = complete
        && currentPrice !== null && Number.isFinite(currentPrice)
        && priorLowest !== null && Number.isFinite(priorLowest)
        && priorLowest > currentPrice
        ? priorLowest
        : null;
    return {
        ...item,
        price: currentPrice !== null && Number.isFinite(currentPrice) ? currentPrice : null,
        compare_price: supportedComparePrice,
        prior_lowest_price_30d: priorLowest !== null && Number.isFinite(priorLowest) ? priorLowest : null,
        prior_price_coverage_complete: complete,
        price_observed_at: observation.price_observed_at,
    };
}

/** Drops every key that is not public from one variant, whichever path produced it. */
export function toPublicVariant(variant: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(variant)) {
        if (key !== 'metadata' && PUBLIC_VARIANT_FIELDS.has(key)) result[key] = value;
    }
    const facts = readVariantNicheFacts(variant.metadata);
    if (Object.keys(facts).length) result.metadata = facts;
    return result;
}

const VARIANT_KEYS = ['variants', 'product_variants'] as const;

/**
 * Drops every key that is not public. Applied after hydration, immediately before serialisation.
 *
 * SEC-2: this recurses into the variant arrays. SEC-1's version filtered top-level keys only and
 * `variants` is on the allowlist, so the array was copied through untouched and the identifiers it
 * carries stayed public — the same defect one level down. An allowlist that stops at the top level
 * is not a projection of the response, only of its first layer.
 */
export function toPublicProduct<T extends Record<string, unknown>>(product: T): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(product)) {
        if (!PUBLIC_PRODUCT_FIELDS.has(key)) continue;
        if (key === 'catalog_available_quantity') {
            // Pooled PostgreSQL returns int8 as text; PostgREST uses JSON numbers.
            const quantity = typeof value === 'number' ? value
                : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null;
            result[key] = quantity !== null && Number.isSafeInteger(quantity) && quantity >= 0 ? quantity : null;
            continue;
        }
        if (key === 'metadata') {
            const apparel = readApparelFacts(value);
            result.metadata = { ...readProductNicheFacts(value), ...(apparel ? { apparel } : {}) };
            continue;
        }
        if (key === 'product_options') {
            result[key] = Array.isArray(value) ? value.filter(option => option && typeof option === 'object' && typeof (option as Record<string, unknown>).name === 'string').map(option => {
                const row = option as Record<string, unknown>;
                return { name: row.name, position: typeof row.position === 'number' && Number.isFinite(row.position) ? row.position : 0, values: Array.isArray(row.values) ? row.values.filter(entry => typeof entry === 'string') : [] };
            }) : [];
            continue;
        }
        if ((VARIANT_KEYS as readonly string[]).includes(key) && Array.isArray(value)) {
            result[key] = value.map((variant) => (
                variant && typeof variant === 'object' ? toPublicVariant(variant as Record<string, unknown>) : variant
            ));
            continue;
        }
        result[key] = value;
    }
    return result;
}
