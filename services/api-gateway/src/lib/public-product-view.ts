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
    'id,store_id,name,slug,description,price,compare_price,product_type,tags,images,thumbnail_url,stock,track_inventory,is_active,is_featured,weight,seo_title,seo_description,created_at,updated_at,variants';

// Same list without `variants`, for the path that hydrates variants from product_variants instead of
// reading the products row's own column.
export const PUBLIC_PRODUCT_SELECT_RELATIONAL: string = PUBLIC_PRODUCT_SELECT.replace(',variants', '');

// The complete set of keys a public product response may carry: the select above, plus the second
// key variant hydration attaches alongside `variants`.
export const PUBLIC_PRODUCT_FIELDS: ReadonlySet<string> = new Set([
    ...PUBLIC_PRODUCT_SELECT.split(','),
    'product_variants',
]);

/** Drops every key that is not public. Applied after hydration, immediately before serialisation. */
export function toPublicProduct<T extends Record<string, unknown>>(product: T): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(product)) {
        if (PUBLIC_PRODUCT_FIELDS.has(key)) result[key] = value;
    }
    return result;
}
