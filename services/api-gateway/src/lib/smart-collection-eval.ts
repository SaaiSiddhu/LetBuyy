// ============================================================
// SMART COLLECTION EVALUATOR — pure, no I/O, exhaustively tested
//
// Supported condition vocabulary:
//   field:   title | product_type | vendor | tag | price | inventory_quantity
//   op:      equals | not_equals | contains | starts_with | ends_with | gt | lt
//   combine: match_type 'all' (AND) | 'any' (OR)
// ============================================================

export type SmartConditionField =
    | 'title'
    | 'product_type'
    | 'vendor'
    | 'tag'
    | 'price'
    | 'inventory_quantity';

export type SmartConditionOp =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'starts_with'
    | 'ends_with'
    | 'gt'
    | 'lt';

export interface SmartCondition {
    field: SmartConditionField;
    op: SmartConditionOp;
    value: string; // always stored as string; numeric fields parsed at eval time
}

export type SmartMatchType = 'all' | 'any';

/**
 * Minimal product shape needed by the evaluator.
 * All numeric fields are stored as `number | null | undefined` in the DB
 * but may arrive as strings from JSON; we coerce defensively.
 */
export interface EvalProduct {
    id: string;
    title?: string | null;
    name?: string | null;       // alias used in some DB columns
    product_type?: string | null;
    vendor?: string | null;
    tags?: string | string[] | null; // DB can store as text[] or csv string
    price?: number | string | null;
    stock?: number | string | null;     // "stock" column alias for inventory_quantity
    inventory_quantity?: number | string | null;
}

// ── internal helpers ─────────────────────────────────────────

function normalize(v: string | null | undefined): string {
    return String(v ?? '').toLowerCase().trim();
}

function toNumber(v: number | string | null | undefined): number {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
}

/**
 * Resolve a product's `tag` field into a flat string array.
 * The DB may store tags as a postgres text[] (arriving as JS array) or as a
 * comma-separated string.
 */
function resolveTags(product: EvalProduct): string[] {
    const raw = product.tags;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((t) => String(t).toLowerCase().trim());
    return String(raw)
        .split(',')
        .map((t) => t.toLowerCase().trim())
        .filter(Boolean);
}

/**
 * Evaluate a single condition against a product.
 * Returns true if the product satisfies the condition.
 */
export function evaluateCondition(product: EvalProduct, cond: SmartCondition): boolean {
    const { field, op, value } = cond;

    // ── tag field — operates on array membership ─────────────
    if (field === 'tag') {
        const tags = resolveTags(product);
        const needle = normalize(value);
        switch (op) {
            case 'equals':      return tags.includes(needle);
            case 'not_equals':  return !tags.includes(needle);
            case 'contains':    return tags.some((t) => t.includes(needle));
            case 'starts_with': return tags.some((t) => t.startsWith(needle));
            case 'ends_with':   return tags.some((t) => t.endsWith(needle));
            // gt / lt are not meaningful for tags; treat as false
            default:            return false;
        }
    }

    // ── numeric fields ────────────────────────────────────────
    if (field === 'price' || field === 'inventory_quantity') {
        const productVal = field === 'price'
            ? toNumber(product.price)
            : toNumber(product.inventory_quantity ?? product.stock);
        const condVal = toNumber(value);

        switch (op) {
            case 'equals':      return productVal === condVal;
            case 'not_equals':  return productVal !== condVal;
            case 'gt':          return productVal > condVal;
            case 'lt':          return productVal < condVal;
            // string ops on numeric fields fall through to string comparison
            case 'contains':    return String(productVal).includes(String(condVal));
            case 'starts_with': return String(productVal).startsWith(String(condVal));
            case 'ends_with':   return String(productVal).endsWith(String(condVal));
            default:            return false;
        }
    }

    // ── string fields: title, product_type, vendor ────────────
    let productStr: string;
    switch (field) {
        case 'title':        productStr = normalize(product.title ?? product.name); break;
        case 'product_type': productStr = normalize(product.product_type); break;
        case 'vendor':       productStr = normalize(product.vendor); break;
        default:             productStr = ''; break;
    }

    const condStr = normalize(value);

    switch (op) {
        case 'equals':      return productStr === condStr;
        case 'not_equals':  return productStr !== condStr;
        case 'contains':    return productStr.includes(condStr);
        case 'starts_with': return productStr.startsWith(condStr);
        case 'ends_with':   return productStr.endsWith(condStr);
        // numeric ops on string fields: try number parse, else false
        case 'gt':          return toNumber(productStr) > toNumber(condStr);
        case 'lt':          return toNumber(productStr) < toNumber(condStr);
        default:            return false;
    }
}

/**
 * Evaluate whether a product belongs to a smart collection.
 *
 * - Empty conditions array → always matches (include all products).
 * - match_type 'all' → every condition must pass (AND).
 * - match_type 'any' → at least one condition must pass (OR).
 */
export function evaluateSmartCollection(
    product: EvalProduct,
    conditions: SmartCondition[],
    matchType: SmartMatchType,
): boolean {
    if (!conditions || conditions.length === 0) return true;
    if (matchType === 'all') return conditions.every((c) => evaluateCondition(product, c));
    return conditions.some((c) => evaluateCondition(product, c));
}

/**
 * Filter an array of products to those that match the smart collection rules.
 */
export function filterProducts(
    products: EvalProduct[],
    conditions: SmartCondition[],
    matchType: SmartMatchType,
): EvalProduct[] {
    return products.filter((p) => evaluateSmartCollection(p, conditions, matchType));
}
