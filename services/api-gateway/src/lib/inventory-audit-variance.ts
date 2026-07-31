// ============================================================
// INVENTORY AUDIT VARIANCE — pure, no I/O, exhaustively tested
//
// Three exported functions:
//   computeVariance      — single line: system vs counted → direction + delta
//   reconcileSessionLines — filter non-zero lines → adjustment deltas for RPC
//   summarizeSession      — aggregate stats across all lines
//
// Output of reconcileSessionLines feeds the EXISTING adjust_inventory_level RPC
// (reason='recount'). No DB access here — pure data transformation.
// ============================================================

// ── types ────────────────────────────────────────────────────

export interface AuditLine {
    product_id: string;
    variant_id?: string | null;
    location_id?: string | null;
    system_qty: number;
    counted_qty: number;
}

export type VarianceDirection = 'over' | 'short' | 'match';

export interface VarianceResult {
    variance: number;          // counted_qty − system_qty (positive = over, negative = short)
    direction: VarianceDirection;
}

/**
 * An adjustment delta ready to pass to the adjust_inventory_level RPC.
 * `delta` is the signed quantity change (positive = add stock, negative = remove stock).
 * `reason` is always 'recount' for audit-driven reconciliation.
 */
export interface AdjustmentDelta {
    product_id: string;
    variant_id: string | null;
    location_id: string | null;
    delta: number;              // counted_qty − system_qty (non-zero; zero lines are skipped)
    reason: 'recount';
}

export interface SessionSummary {
    total_lines: number;
    matched: number;
    over: number;
    short: number;
    net_variance: number;       // sum of all (counted_qty − system_qty)
}

// ── internal helpers ─────────────────────────────────────────

/**
 * Coerce a quantity to a safe integer.
 * Null / undefined / NaN are treated as 0. Fractional values are truncated.
 */
function safeQty(v: number | null | undefined): number {
    if (v === null || v === undefined) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : Math.trunc(n);
}

// ── public API ───────────────────────────────────────────────

/**
 * Compute the variance for a single audit line.
 *
 * variance = counted_qty − system_qty
 *   > 0 → 'over'  (more stock on hand than system thought)
 *   < 0 → 'short' (less stock on hand than system thought)
 *   = 0 → 'match'
 *
 * Null / undefined / NaN quantities are treated as 0.
 * Negative counted quantities are allowed (represents a recording error
 * and will produce a 'short' direction so operators can see it).
 */
export function computeVariance(
    systemQty: number | null | undefined,
    countedQty: number | null | undefined,
): VarianceResult {
    const sys = safeQty(systemQty);
    const cnt = safeQty(countedQty);
    const variance = cnt - sys;

    let direction: VarianceDirection;
    if (variance > 0) direction = 'over';
    else if (variance < 0) direction = 'short';
    else direction = 'match';

    return { variance, direction };
}

/**
 * Reconcile audit session lines into adjustment deltas for the RPC.
 *
 * - Lines with zero variance are silently skipped.
 * - Lines with null/undefined quantities use 0.
 * - Preserves original product_id / variant_id / location_id.
 * - `reason` is always 'recount'.
 */
export function reconcileSessionLines(lines: AuditLine[]): AdjustmentDelta[] {
    if (!lines || lines.length === 0) return [];

    const deltas: AdjustmentDelta[] = [];

    for (const line of lines) {
        const { variance } = computeVariance(line.system_qty, line.counted_qty);

        if (variance === 0) continue; // zero-variance lines are a match — no adjustment needed

        deltas.push({
            product_id: line.product_id,
            variant_id: line.variant_id ?? null,
            location_id: line.location_id ?? null,
            delta: variance,
            reason: 'recount',
        });
    }

    return deltas;
}

/**
 * Summarize an audit session across all lines.
 *
 * Returns aggregate counts and the net variance (sum of all individual variances).
 * Useful for displaying a session review screen before committing adjustments.
 */
export function summarizeSession(lines: AuditLine[]): SessionSummary {
    if (!lines || lines.length === 0) {
        return { total_lines: 0, matched: 0, over: 0, short: 0, net_variance: 0 };
    }

    let matched = 0;
    let over = 0;
    let short = 0;
    let net_variance = 0;

    for (const line of lines) {
        const { variance, direction } = computeVariance(line.system_qty, line.counted_qty);
        net_variance += variance;
        if (direction === 'match') matched++;
        else if (direction === 'over') over++;
        else short++;
    }

    return {
        total_lines: lines.length,
        matched,
        over,
        short,
        net_variance,
    };
}
