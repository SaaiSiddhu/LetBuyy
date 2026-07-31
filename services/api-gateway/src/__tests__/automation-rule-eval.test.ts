// ============================================================
// Unit tests for the automation rule evaluator
// Run: npx tsx --test services/api-gateway/src/__tests__/automation-rule-eval.test.ts
// ============================================================

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    evaluateCondition,
    evaluateAutomationRule,
    type AutomationEvent,
    type AutomationRule,
    type Condition,
} from '../lib/automation-rule-eval';

// ── fixtures ─────────────────────────────────────────────────────────────────

const ORDER_PLACED_EVENT: AutomationEvent = {
    type: 'order.placed',
    payload: {
        order: { id: 'ord_1', total: 1500, status: 'pending' },
        customer: { id: 'cust_1', email: 'buyer@example.com', tags: 'vip' },
        items_count: 3,
    },
};

const LOW_STOCK_EVENT: AutomationEvent = {
    type: 'inventory.low_stock',
    payload: {
        product_id: 'prod_99',
        quantity: 2,
        threshold: 5,
        location: 'warehouse-a',
    },
};

const CUSTOMER_CREATED_EVENT: AutomationEvent = {
    type: 'customer.created',
    payload: {
        customer: { id: 'cust_2', email: 'new@store.com' },
    },
};

const NOTIFY_ACTION = { type: 'send_notification' as const, template_id: 'tmpl_order' };
const TAG_ACTION    = { type: 'add_tag' as const, tag: 'high-value' };
const WEBHOOK_ACTION = { type: 'webhook' as const, url: 'https://hooks.example.com/order' };

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
    return {
        trigger: 'order.placed',
        conditions: [],
        match_type: 'all',
        actions: [NOTIFY_ACTION],
        is_active: true,
        ...overrides,
    };
}

// ── evaluateCondition: op 'equals' ───────────────────────────────────────────

test('equals — numeric match via dot-path', () => {
    const payload = ORDER_PLACED_EVENT.payload;
    const c: Condition = { field: 'order.total', op: 'equals', value: '1500' };
    assert.equal(evaluateCondition(payload, c), true);
});

test('equals — numeric mismatch', () => {
    const payload = ORDER_PLACED_EVENT.payload;
    const c: Condition = { field: 'order.total', op: 'equals', value: '999' };
    assert.equal(evaluateCondition(payload, c), false);
});

test('equals — string match (case-insensitive)', () => {
    const payload = ORDER_PLACED_EVENT.payload;
    const c: Condition = { field: 'order.status', op: 'equals', value: 'PENDING' };
    assert.equal(evaluateCondition(payload, c), true);
});

test('equals — string mismatch', () => {
    const payload = ORDER_PLACED_EVENT.payload;
    const c: Condition = { field: 'order.status', op: 'equals', value: 'paid' };
    assert.equal(evaluateCondition(payload, c), false);
});

// ── evaluateCondition: op 'not_equals' ───────────────────────────────────────

test('not_equals — numeric diverges', () => {
    const payload = ORDER_PLACED_EVENT.payload;
    const c: Condition = { field: 'order.total', op: 'not_equals', value: '999' };
    assert.equal(evaluateCondition(payload, c), true);
});

test('not_equals — numeric same returns false', () => {
    const payload = ORDER_PLACED_EVENT.payload;
    const c: Condition = { field: 'order.total', op: 'not_equals', value: '1500' };
    assert.equal(evaluateCondition(payload, c), false);
});

// ── evaluateCondition: op 'contains' ─────────────────────────────────────────

test('contains — substring present', () => {
    const payload = ORDER_PLACED_EVENT.payload;
    const c: Condition = { field: 'customer.email', op: 'contains', value: '@example' };
    assert.equal(evaluateCondition(payload, c), true);
});

test('contains — substring absent', () => {
    const payload = ORDER_PLACED_EVENT.payload;
    const c: Condition = { field: 'customer.email', op: 'contains', value: '@store' };
    assert.equal(evaluateCondition(payload, c), false);
});

// ── evaluateCondition: op 'gt' / 'lt' / 'gte' / 'lte' ───────────────────────

test('gt — quantity above threshold', () => {
    const payload = LOW_STOCK_EVENT.payload;
    const c: Condition = { field: 'quantity', op: 'gt', value: '1' };
    assert.equal(evaluateCondition(payload, c), true);
});

test('gt — quantity not above threshold', () => {
    const payload = LOW_STOCK_EVENT.payload;
    const c: Condition = { field: 'quantity', op: 'gt', value: '5' };
    assert.equal(evaluateCondition(payload, c), false);
});

test('lt — quantity below threshold', () => {
    const payload = LOW_STOCK_EVENT.payload;
    const c: Condition = { field: 'quantity', op: 'lt', value: '5' };
    assert.equal(evaluateCondition(payload, c), true);
});

test('lt — quantity not below threshold', () => {
    const payload = LOW_STOCK_EVENT.payload;
    const c: Condition = { field: 'quantity', op: 'lt', value: '1' };
    assert.equal(evaluateCondition(payload, c), false);
});

test('gte — exact match qualifies', () => {
    const payload = LOW_STOCK_EVENT.payload;
    const c: Condition = { field: 'quantity', op: 'gte', value: '2' };
    assert.equal(evaluateCondition(payload, c), true);
});

test('gte — below threshold fails', () => {
    const payload = LOW_STOCK_EVENT.payload;
    const c: Condition = { field: 'quantity', op: 'gte', value: '3' };
    assert.equal(evaluateCondition(payload, c), false);
});

test('lte — exact match qualifies', () => {
    const payload = LOW_STOCK_EVENT.payload;
    const c: Condition = { field: 'quantity', op: 'lte', value: '2' };
    assert.equal(evaluateCondition(payload, c), true);
});

test('lte — above threshold fails', () => {
    const payload = LOW_STOCK_EVENT.payload;
    const c: Condition = { field: 'quantity', op: 'lte', value: '1' };
    assert.equal(evaluateCondition(payload, c), false);
});

// ── evaluateCondition: missing / null fields ──────────────────────────────────

test('missing dot-path returns false for equals', () => {
    const payload = ORDER_PLACED_EVENT.payload;
    const c: Condition = { field: 'nonexistent.deep.field', op: 'equals', value: 'x' };
    assert.equal(evaluateCondition(payload, c), false);
});

test('missing dot-path returns 0 for numeric ops', () => {
    const payload = ORDER_PLACED_EVENT.payload;
    // field does not exist → resolved to undefined → toNumber = 0
    const c: Condition = { field: 'missing.qty', op: 'gt', value: '0' };
    assert.equal(evaluateCondition(payload, c), false); // 0 > 0 = false
});

test('missing dot-path with equals 0 — string compare: empty string != "0" → false', () => {
    // A missing field resolves to undefined. isNumericish(undefined) = false,
    // so the evaluator falls through to string compare: '' === '0' → false.
    // This is intentional: a missing field is not the same as "the number zero".
    const payload = ORDER_PLACED_EVENT.payload;
    const c: Condition = { field: 'missing.qty', op: 'equals', value: '0' };
    assert.equal(evaluateCondition(payload, c), false);
});

test('null payload field — contains returns false without throwing', () => {
    const payload: Record<string, unknown> = { name: null };
    const c: Condition = { field: 'name', op: 'contains', value: 'anything' };
    assert.equal(evaluateCondition(payload, c), false);
});

// ── evaluateAutomationRule: inactive rule ─────────────────────────────────────

test('inactive rule — never matches regardless of trigger/conditions', () => {
    const rule = makeRule({ is_active: false });
    const result = evaluateAutomationRule(ORDER_PLACED_EVENT, rule);
    assert.equal(result.matched, false);
    assert.deepEqual(result.actions, []);
});

// ── evaluateAutomationRule: trigger mismatch ──────────────────────────────────

test('trigger mismatch — does not match', () => {
    const rule = makeRule({ trigger: 'order.paid' });
    const result = evaluateAutomationRule(ORDER_PLACED_EVENT, rule);
    assert.equal(result.matched, false);
    assert.deepEqual(result.actions, []);
});

// ── evaluateAutomationRule: empty conditions ──────────────────────────────────

test('empty conditions — matches any event with correct trigger', () => {
    const rule = makeRule({ conditions: [], actions: [NOTIFY_ACTION] });
    const result = evaluateAutomationRule(ORDER_PLACED_EVENT, rule);
    assert.equal(result.matched, true);
    assert.deepEqual(result.actions, [NOTIFY_ACTION]);
});

// ── evaluateAutomationRule: match_type 'all' ─────────────────────────────────

test('match_type all — all conditions pass → matched', () => {
    const rule = makeRule({
        conditions: [
            { field: 'order.total', op: 'gt', value: '1000' },
            { field: 'order.status', op: 'equals', value: 'pending' },
        ],
        match_type: 'all',
        actions: [TAG_ACTION],
    });
    const result = evaluateAutomationRule(ORDER_PLACED_EVENT, rule);
    assert.equal(result.matched, true);
    assert.deepEqual(result.actions, [TAG_ACTION]);
});

test('match_type all — one condition fails → not matched', () => {
    const rule = makeRule({
        conditions: [
            { field: 'order.total', op: 'gt', value: '1000' },
            { field: 'order.status', op: 'equals', value: 'paid' }, // fails
        ],
        match_type: 'all',
    });
    const result = evaluateAutomationRule(ORDER_PLACED_EVENT, rule);
    assert.equal(result.matched, false);
});

// ── evaluateAutomationRule: match_type 'any' ─────────────────────────────────

test('match_type any — at least one condition passes → matched', () => {
    const rule = makeRule({
        conditions: [
            { field: 'order.total', op: 'gt', value: '9999' }, // fails
            { field: 'order.status', op: 'equals', value: 'pending' }, // passes
        ],
        match_type: 'any',
        actions: [WEBHOOK_ACTION],
    });
    const result = evaluateAutomationRule(ORDER_PLACED_EVENT, rule);
    assert.equal(result.matched, true);
    assert.deepEqual(result.actions, [WEBHOOK_ACTION]);
});

test('match_type any — all conditions fail → not matched', () => {
    const rule = makeRule({
        conditions: [
            { field: 'order.total', op: 'gt', value: '9999' },  // fails
            { field: 'order.status', op: 'equals', value: 'paid' }, // fails
        ],
        match_type: 'any',
    });
    const result = evaluateAutomationRule(ORDER_PLACED_EVENT, rule);
    assert.equal(result.matched, false);
});

// ── evaluateAutomationRule: multiple actions returned ─────────────────────────

test('multiple actions are all returned when matched', () => {
    const rule = makeRule({
        actions: [NOTIFY_ACTION, TAG_ACTION, WEBHOOK_ACTION],
    });
    const result = evaluateAutomationRule(ORDER_PLACED_EVENT, rule);
    assert.equal(result.matched, true);
    assert.equal(result.actions.length, 3);
    assert.equal(result.actions[0].type, 'send_notification');
    assert.equal(result.actions[1].type, 'add_tag');
    assert.equal(result.actions[2].type, 'webhook');
});

// ── evaluateAutomationRule: each trigger type ─────────────────────────────────

test('trigger order.paid — matches correctly', () => {
    const event: AutomationEvent = { type: 'order.paid', payload: { order_id: 'o1' } };
    const rule = makeRule({ trigger: 'order.paid', conditions: [] });
    assert.equal(evaluateAutomationRule(event, rule).matched, true);
});

test('trigger order.fulfilled — matches correctly', () => {
    const event: AutomationEvent = { type: 'order.fulfilled', payload: {} };
    const rule = makeRule({ trigger: 'order.fulfilled', conditions: [] });
    assert.equal(evaluateAutomationRule(event, rule).matched, true);
});

test('trigger order.cancelled — matches correctly', () => {
    const event: AutomationEvent = { type: 'order.cancelled', payload: {} };
    const rule = makeRule({ trigger: 'order.cancelled', conditions: [] });
    assert.equal(evaluateAutomationRule(event, rule).matched, true);
});

test('trigger inventory.low_stock — matches with quantity condition', () => {
    const rule: AutomationRule = {
        trigger: 'inventory.low_stock',
        conditions: [{ field: 'quantity', op: 'lte', value: '5' }],
        match_type: 'all',
        actions: [NOTIFY_ACTION],
        is_active: true,
    };
    const result = evaluateAutomationRule(LOW_STOCK_EVENT, rule);
    assert.equal(result.matched, true);
});

test('trigger customer.created — matches with empty conditions', () => {
    const rule: AutomationRule = {
        trigger: 'customer.created',
        conditions: [],
        match_type: 'all',
        actions: [TAG_ACTION],
        is_active: true,
    };
    const result = evaluateAutomationRule(CUSTOMER_CREATED_EVENT, rule);
    assert.equal(result.matched, true);
    assert.deepEqual(result.actions, [TAG_ACTION]);
});

// ── evaluateAutomationRule: dot-path conditions ───────────────────────────────

test('deep dot-path — customer.email contains condition', () => {
    const rule = makeRule({
        conditions: [{ field: 'customer.email', op: 'contains', value: 'buyer' }],
    });
    const result = evaluateAutomationRule(ORDER_PLACED_EVENT, rule);
    assert.equal(result.matched, true);
});

test('deep dot-path — items_count gte condition', () => {
    const rule = makeRule({
        conditions: [{ field: 'items_count', op: 'gte', value: '3' }],
    });
    const result = evaluateAutomationRule(ORDER_PLACED_EVENT, rule);
    assert.equal(result.matched, true);
});

// ── evaluateAutomationRule: numeric-as-string in payload ─────────────────────

test('numeric-as-string in payload — gt still works', () => {
    const event: AutomationEvent = {
        type: 'order.placed',
        payload: { order: { total: '2000' } }, // string from JSON
    };
    const rule = makeRule({
        conditions: [{ field: 'order.total', op: 'gt', value: '1500' }],
    });
    assert.equal(evaluateAutomationRule(event, rule).matched, true);
});
