// ============================================================
// AUTOMATION RULE EVALUATOR — pure, no I/O, exhaustively tested
//
// Trigger vocab:
//   order.placed | order.paid | order.fulfilled | order.cancelled
//   inventory.low_stock | customer.created
//
// Condition vocab:
//   field:   any dot-path into event.payload
//   op:      equals | not_equals | contains | gt | lt | gte | lte
//   combine: match_type 'all' (AND) | 'any' (OR)
//
// Action vocab (returned, never executed):
//   type: 'send_notification' | 'add_tag' | 'webhook'
// ============================================================

export type AutomationTrigger =
    | 'order.placed'
    | 'order.paid'
    | 'order.fulfilled'
    | 'order.cancelled'
    | 'inventory.low_stock'
    | 'customer.created';

export type ConditionOp =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'gt'
    | 'lt'
    | 'gte'
    | 'lte';

export interface Condition {
    field: string;   // dot-path into event.payload, e.g. "order.total" or "customer.email"
    op: ConditionOp;
    value: string;   // always stored as string; numeric fields parsed at eval time
}

export type ActionType = 'send_notification' | 'add_tag' | 'webhook';

export interface AutomationAction {
    type: ActionType;
    [key: string]: unknown; // arbitrary params (e.g. template_id, tag, url)
}

export interface AutomationEvent {
    type: string;
    payload: Record<string, unknown>;
}

export interface AutomationRule {
    trigger: string;
    conditions: Condition[];
    match_type: 'all' | 'any';
    actions: AutomationAction[];
    is_active: boolean;
}

export interface EvaluationResult {
    matched: boolean;
    actions: AutomationAction[];
}

// ── internal helpers ─────────────────────────────────────────

/**
 * Resolve a dot-path into a nested object.
 * Returns `undefined` if any segment is missing or the path is empty.
 * Example: resolvePath({ order: { total: 500 } }, 'order.total') → 500
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
    if (!path || !obj) return undefined;
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined;
        }
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

function normalize(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).toLowerCase().trim();
}

function toNumber(v: unknown): number {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
}

/**
 * Determine if a value looks numeric (used to decide whether to use numeric ops).
 * Both the resolved value AND the condition value must be numeric for numeric ops.
 */
function isNumericish(v: unknown): boolean {
    if (v === null || v === undefined || v === '') return false;
    return !isNaN(Number(v));
}

// ── core condition evaluator ─────────────────────────────────

/**
 * Evaluate a single condition against a resolved field value from the event payload.
 * Exported so tests can call it directly.
 */
export function evaluateCondition(
    payload: Record<string, unknown>,
    cond: Condition,
): boolean {
    const raw = resolvePath(payload, cond.field);
    const { op, value } = cond;

    // For numeric operators, coerce both sides to number
    if (op === 'gt' || op === 'lt' || op === 'gte' || op === 'lte') {
        const fieldNum = toNumber(raw);
        const condNum = toNumber(value);
        switch (op) {
            case 'gt':  return fieldNum > condNum;
            case 'lt':  return fieldNum < condNum;
            case 'gte': return fieldNum >= condNum;
            case 'lte': return fieldNum <= condNum;
        }
    }

    // For equals/not_equals: if both sides are numeric, compare numerically
    if (op === 'equals' || op === 'not_equals') {
        if (isNumericish(raw) && isNumericish(value)) {
            const eq = toNumber(raw) === toNumber(value);
            return op === 'equals' ? eq : !eq;
        }
        const eq = normalize(raw) === normalize(value);
        return op === 'equals' ? eq : !eq;
    }

    // contains: string substring check
    if (op === 'contains') {
        return normalize(raw).includes(normalize(value));
    }

    return false;
}

// ── public API ───────────────────────────────────────────────

/**
 * Evaluate an automation rule against an event.
 *
 * Returns `{ matched: false, actions: [] }` if:
 *   - rule.is_active is false
 *   - rule.trigger !== event.type
 *   - conditions fail to pass (given match_type)
 *
 * Returns `{ matched: true, actions: rule.actions }` when all gates pass.
 * Empty conditions always pass (include-all semantics, same as smart collections).
 */
export function evaluateAutomationRule(
    event: AutomationEvent,
    rule: AutomationRule,
): EvaluationResult {
    const NO_MATCH: EvaluationResult = { matched: false, actions: [] };

    // Gate 1: rule must be active
    if (!rule.is_active) return NO_MATCH;

    // Gate 2: trigger must match event type
    if (rule.trigger !== event.type) return NO_MATCH;

    // Gate 3: conditions
    const payload = event.payload ?? {};
    const conditions = rule.conditions ?? [];

    if (conditions.length === 0) {
        // Empty conditions → pass (include all events for this trigger)
        return { matched: true, actions: rule.actions ?? [] };
    }

    const pass =
        rule.match_type === 'all'
            ? conditions.every((c) => evaluateCondition(payload, c))
            : conditions.some((c) => evaluateCondition(payload, c));

    if (!pass) return NO_MATCH;

    return { matched: true, actions: rule.actions ?? [] };
}
