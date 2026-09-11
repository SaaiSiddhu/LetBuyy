// F-PENDINGCOD-1 (CAP-C59) — the Pending filter must include pending_cod.
//
// `pending_cod` is not a separate kind of order: migration 074 added the status and a trigger assigns
// it to every COD order at creation. An exact `.eq('status', 'pending')` therefore hid the majority of
// a merchant's pending orders — 46 of 65 on the reference store — while the "All" tab showed them, so
// nothing looked broken. The Analytics "Orders by status" card already sums both buckets; this pins
// the list endpoint to the same meaning.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ordersSource = readFileSync(new URL('../routes/orders.ts', import.meta.url), 'utf8');
const analyticsSource = readFileSync(
    new URL('../../../../apps/merchant_web/src/app/[store]/analytics/page.tsx', import.meta.url), 'utf8');
const ordersPageSource = readFileSync(
    new URL('../../../../apps/merchant_web/src/app/[store]/orders/page.tsx', import.meta.url), 'utf8');

test('the orders list expands pending to include pending_cod', () => {
    assert.match(
        ordersSource,
        /query\.status === 'pending'[\s\S]{0,200}\.in\('status', \['pending', 'pending_cod'\]\)/,
        "status=pending must query both buckets, or the Pending tab hides every COD order",
    );
});

test('pending_cod remains exactly queryable on its own', () => {
    // Expanding 'pending' must not swallow the specific bucket — a caller asking for pending_cod
    // should still get only those.
    assert.match(ordersSource, /\}\s*else if \(query\.status !== 'all'\)\s*\{[\s\S]{0,120}\.eq\('status', query\.status\)/);
});

test('the draft_orders query is untouched — pending_cod is not one of its statuses', () => {
    // draft_orders is a different table with its own lifecycle; expanding its filter would be wrong.
    const draftSection = ordersSource.slice(ordersSource.indexOf("from('draft_orders')"));
    assert.match(draftSection, /draftQuery = draftQuery\.eq\('status', query\.status\)/);
    assert.doesNotMatch(draftSection.slice(0, 600), /pending_cod/);
});

test('the list endpoint and the analytics card agree on what "pending" means', () => {
    // The precedent this fix follows. If analytics ever stops summing both, these have diverged and
    // one of the two surfaces is lying to the merchant again.
    assert.match(analyticsSource, /ordersByStatus\.pending \|\| 0\) \+ \(data\.ordersByStatus\.pending_cod \|\| 0/);
});

test('a partial bulk skip is reported, not silent', () => {
    // With the Pending tab now listing pending_cod orders, "Confirm" applies to a subset: a plain
    // status change cannot confirm a COD order. Acting on 19 of 65 selected rows without saying so
    // would be a worse failure than the filter gap this phase fixes.
    assert.match(ordersPageSource, /const skippedCount = rows\.length - eligibleRows\.length/);
    assert.match(ordersPageSource, /skippedCount > 0 && failures === 0/);
    assert.match(ordersPageSource, /not eligible and/);
});
