/**
 * SymptomService — unit tests.
 *
 * Fixed clock: '2026-07-04T00:00:00.000Z' (not used by SymptomService itself,
 * declared here for consistency with LRAS test conventions).
 *
 * Coverage matrix:
 *  - Each of the 6 kinds via multiple distinct phrasings            (tests 01..24)
 *  - Case-insensitivity                                             (tests 25..30)
 *  - Multi-match: kind = first, domains/anchors = union            (tests 31..37)
 *  - Unknown fallback: gibberish + empty string                    (tests 38..42)
 *  - Determinism: same text → identical output, twice              (tests 43..44)
 *  - matchedTerms exactness                                        (tests 45..48)
 *  - Taxonomy invariants (6 kinds covered, term uniqueness)        (tests 49..52)
 *  - Edge cases (whitespace, numeric strings, partial substrings)  (tests 53..56)
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { SymptomService } from '../src/symptom/SymptomService';
import { SYMPTOM_TAXONOMY } from '../src/shared/taxonomy';
import type { SymptomKind } from '../src/shared/types';

const svc = new SymptomService();

// ─── 01..06  orders-failing — six distinct phrasings ────────────────────────

test('01 orders-failing via "orders failing"', () => {
  const s = svc.classify('orders failing in production');
  assert.equal(s.kind, 'orders-failing');
  assert.ok(s.domains.includes('orders'));
  assert.ok(s.matchedTerms.includes('orders failing'));
});

test('02 orders-failing via "order failing"', () => {
  const s = svc.classify('order failing after deploy');
  assert.equal(s.kind, 'orders-failing');
  assert.ok(s.matchedTerms.includes('order failing'));
});

test('03 orders-failing via "orders fail"', () => {
  const s = svc.classify('orders fail completely');
  assert.equal(s.kind, 'orders-failing');
  assert.ok(s.matchedTerms.includes('orders fail'));
});

test('04 orders-failing via "order creation"', () => {
  const s = svc.classify('order creation is broken');
  assert.equal(s.kind, 'orders-failing');
  assert.ok(s.matchedTerms.includes('order creation'));
});

test('05 orders-failing via "cannot place order"', () => {
  const s = svc.classify('user cannot place order from app');
  assert.equal(s.kind, 'orders-failing');
  assert.ok(s.matchedTerms.includes('cannot place order'));
});

test('06 orders-failing via "order error"', () => {
  const s = svc.classify('got an order error on checkout');
  assert.equal(s.kind, 'orders-failing');
  assert.ok(s.matchedTerms.includes('order error'));
});

// ─── 07..11  checkout-broken — five phrasings ───────────────────────────────

test('07 checkout-broken via "checkout broken"', () => {
  const s = svc.classify('checkout broken for all users');
  assert.equal(s.kind, 'checkout-broken');
  assert.ok(s.domains.includes('payments'));
  assert.ok(s.matchedTerms.includes('checkout broken'));
});

test('08 checkout-broken via "checkout failing"', () => {
  const s = svc.classify('the checkout failing on mobile');
  assert.equal(s.kind, 'checkout-broken');
  assert.ok(s.matchedTerms.includes('checkout failing'));
});

test('09 checkout-broken via "checkout error"', () => {
  const s = svc.classify('seeing checkout error 500');
  assert.equal(s.kind, 'checkout-broken');
  assert.ok(s.matchedTerms.includes('checkout error'));
});

test('10 checkout-broken via "cannot checkout"', () => {
  const s = svc.classify('users cannot checkout');
  assert.equal(s.kind, 'checkout-broken');
  assert.ok(s.matchedTerms.includes('cannot checkout'));
});

test('11 checkout-broken via "razorpay"', () => {
  const s = svc.classify('razorpay is returning errors');
  assert.equal(s.kind, 'checkout-broken');
  assert.ok(s.matchedTerms.includes('razorpay'));
  assert.ok(s.anchors.includes('rpc:confirm_order_payment_with_ledger'));
});

// ─── 12..15  queue-backlog — four phrasings ─────────────────────────────────

test('12 queue-backlog via "queue backlog"', () => {
  const s = svc.classify('there is a queue backlog of 10k messages');
  assert.equal(s.kind, 'queue-backlog');
  assert.ok(s.domains.includes('operations'));
  assert.ok(s.anchors.includes('queue:order-events'));
  assert.ok(s.matchedTerms.includes('queue backlog'));
});

test('13 queue-backlog via "queue backed up"', () => {
  const s = svc.classify('queue backed up since midnight');
  assert.equal(s.kind, 'queue-backlog');
  assert.ok(s.matchedTerms.includes('queue backed up'));
});

test('14 queue-backlog via "jobs stuck"', () => {
  const s = svc.classify('jobs stuck and not processing');
  assert.equal(s.kind, 'queue-backlog');
  assert.ok(s.matchedTerms.includes('jobs stuck'));
});

test('15 queue-backlog via "consumer lag"', () => {
  const s = svc.classify('consumer lag is climbing');
  assert.equal(s.kind, 'queue-backlog');
  assert.ok(s.matchedTerms.includes('consumer lag'));
});

// ─── 16..19  high-latency — four phrasings ──────────────────────────────────

test('16 high-latency via "high latency"', () => {
  const s = svc.classify('observing high latency on the API');
  assert.equal(s.kind, 'high-latency');
  assert.ok(s.domains.includes('operations'));
  assert.ok(s.matchedTerms.includes('high latency'));
});

test('17 high-latency via "slow response"', () => {
  const s = svc.classify('slow response times across services');
  assert.equal(s.kind, 'high-latency');
  assert.ok(s.matchedTerms.includes('slow response'));
});

test('18 high-latency via "timeout"', () => {
  const s = svc.classify('gateway is returning a timeout error');
  assert.equal(s.kind, 'high-latency');
  assert.ok(s.matchedTerms.includes('timeout'));
});

test('19 high-latency via "p95"', () => {
  const s = svc.classify('p95 is above 3s');
  assert.equal(s.kind, 'high-latency');
  assert.ok(s.matchedTerms.includes('p95'));
});

// ─── 20..22  deployment-failed — three phrasings ────────────────────────────

test('20 deployment-failed via "deployment failed"', () => {
  const s = svc.classify('deployment failed on Vercel');
  assert.equal(s.kind, 'deployment-failed');
  assert.ok(s.domains.includes('operations'));
  assert.ok(s.matchedTerms.includes('deployment failed'));
});

test('21 deployment-failed via "build failed"', () => {
  const s = svc.classify('CI build failed for main branch');
  assert.equal(s.kind, 'deployment-failed');
  assert.ok(s.matchedTerms.includes('build failed'));
});

test('22 deployment-failed via "rollout failed"', () => {
  const s = svc.classify('rollout failed after migration');
  assert.equal(s.kind, 'deployment-failed');
  assert.ok(s.matchedTerms.includes('rollout failed'));
});

// ─── 23..24  worker-crashed — two phrasings ─────────────────────────────────

test('23 worker-crashed via "worker crashed"', () => {
  const s = svc.classify('worker crashed with OOM');
  assert.equal(s.kind, 'worker-crashed');
  assert.ok(s.domains.includes('operations'));
  assert.ok(s.anchors.includes('worker:queue-worker'));
  assert.ok(s.matchedTerms.includes('worker crashed'));
});

test('24 worker-crashed via "cron failed"', () => {
  const s = svc.classify('the nightly cron failed to run');
  assert.equal(s.kind, 'worker-crashed');
  assert.ok(s.matchedTerms.includes('cron failed'));
});

// ─── 25..30  case-insensitivity ─────────────────────────────────────────────

test('25 case-insensitive: ORDERS FAILING', () => {
  const s = svc.classify('ORDERS FAILING');
  assert.equal(s.kind, 'orders-failing');
});

test('26 case-insensitive: Checkout Broken', () => {
  const s = svc.classify('Checkout Broken right now');
  assert.equal(s.kind, 'checkout-broken');
});

test('27 case-insensitive: QUEUE BACKLOG', () => {
  const s = svc.classify('QUEUE BACKLOG detected');
  assert.equal(s.kind, 'queue-backlog');
});

test('28 case-insensitive: High Latency', () => {
  const s = svc.classify('High Latency on dashboard');
  assert.equal(s.kind, 'high-latency');
});

test('29 case-insensitive: Deployment Failed', () => {
  const s = svc.classify('Deployment Failed in production');
  assert.equal(s.kind, 'deployment-failed');
});

test('30 case-insensitive: Worker CRASHED', () => {
  const s = svc.classify('Worker CRASHED at 03:00');
  assert.equal(s.kind, 'worker-crashed');
});

// ─── 31..37  multi-match: kind = first match, domains/anchors = union ────────

test('31 "checkout broken and queue backlog" → kind checkout-broken (first in taxonomy)', () => {
  const s = svc.classify('checkout broken and queue backlog reported');
  // checkout-broken appears before queue-backlog in SYMPTOM_TAXONOMY
  assert.equal(s.kind, 'checkout-broken');
});

test('32 multi-match domains union: checkout-broken + queue-backlog', () => {
  const s = svc.classify('checkout broken and queue backlog reported');
  assert.ok(s.domains.includes('payments'), 'payments from checkout-broken');
  assert.ok(s.domains.includes('orders'), 'orders from checkout-broken');
  assert.ok(s.domains.includes('operations'), 'operations from queue-backlog');
});

test('33 multi-match anchors union: checkout-broken + queue-backlog', () => {
  const s = svc.classify('checkout broken and queue backlog reported');
  assert.ok(s.anchors.includes('domain:payments'), 'checkout anchor');
  assert.ok(s.anchors.includes('rpc:create_checkout_order'), 'checkout anchor');
  assert.ok(s.anchors.includes('queue:order-events'), 'queue anchor');
});

test('34 multi-match matchedTerms contains both matched terms', () => {
  const s = svc.classify('checkout broken and queue backlog reported');
  assert.ok(s.matchedTerms.includes('checkout broken'));
  assert.ok(s.matchedTerms.includes('queue backlog'));
});

test('35 "orders failing and high latency" → kind orders-failing (first in taxonomy)', () => {
  const s = svc.classify('orders failing and high latency spikes');
  assert.equal(s.kind, 'orders-failing');
  assert.ok(s.domains.includes('orders'));
  assert.ok(s.domains.includes('operations'));
});

test('36 "worker crashed after deploy failed" → kind deployment-failed (comes first)', () => {
  // deployment-failed (index 4) comes before worker-crashed (index 5) in SYMPTOM_TAXONOMY
  const s = svc.classify('worker crashed after deploy failed');
  assert.equal(s.kind, 'deployment-failed');
  assert.ok(s.matchedTerms.includes('deploy failed'));
  assert.ok(s.matchedTerms.includes('worker crashed'));
});

test('37 anchors dedup: two entries both provide domain:payments → appears once', () => {
  // orders-failing has 'domain:orders'; checkout-broken has 'domain:payments'
  // order creation matches orders-failing; payment failing matches checkout-broken
  const s = svc.classify('order creation blocked: payment failing');
  // Both entries match; union of anchors should not contain duplicates
  const counts: Record<string, number> = {};
  for (const a of s.anchors) counts[a] = (counts[a] ?? 0) + 1;
  for (const [anchor, count] of Object.entries(counts)) {
    assert.equal(count, 1, `anchor "${anchor}" appeared ${count} times, expected 1`);
  }
});

// ─── 38..42  unknown fallback ───────────────────────────────────────────────

test('38 unknown: pure gibberish', () => {
  const s = svc.classify('xkcd quux florp 12345');
  assert.equal(s.kind, 'unknown');
  assert.deepEqual(s.domains, []);
  assert.deepEqual(s.anchors, []);
  assert.deepEqual(s.matchedTerms, []);
});

test('39 unknown: empty string', () => {
  const s = svc.classify('');
  assert.equal(s.kind, 'unknown');
  assert.deepEqual(s.domains, []);
  assert.deepEqual(s.anchors, []);
  assert.deepEqual(s.matchedTerms, []);
});

test('40 unknown: text property preserved verbatim', () => {
  const s = svc.classify('some random noise');
  assert.equal(s.text, 'some random noise');
});

test('41 unknown: whitespace-only string', () => {
  const s = svc.classify('   ');
  assert.equal(s.kind, 'unknown');
});

test('42 unknown: numeric-only string', () => {
  const s = svc.classify('404 500 503');
  assert.equal(s.kind, 'unknown');
});

// ─── 43..44  determinism ────────────────────────────────────────────────────

test('43 determinism: same input yields identical output on two calls', () => {
  const input = 'checkout broken and queue backlog reported';
  const a = svc.classify(input);
  const b = svc.classify(input);
  assert.deepEqual(a, b);
});

test('44 determinism: two separate SymptomService instances produce same result', () => {
  const svc2 = new SymptomService();
  const input = 'worker crashed after deploy failed';
  const a = svc.classify(input);
  const b = svc2.classify(input);
  assert.deepEqual(a, b);
});

// ─── 45..48  matchedTerms exactness ─────────────────────────────────────────

test('45 matchedTerms contains exactly the matching term, not a superset', () => {
  const s = svc.classify('high latency detected');
  // Only 'high latency' should match, not 'slow response' etc.
  assert.deepEqual(s.matchedTerms, ['high latency']);
});

test('46 matchedTerms: multiple terms from same entry both appear', () => {
  // "timeouts" matches 'timeouts'; "slow api" matches 'slow api'
  const s = svc.classify('experiencing timeouts and slow api calls');
  assert.ok(s.matchedTerms.includes('timeouts'));
  assert.ok(s.matchedTerms.includes('slow api'));
});

test('47 matchedTerms: order follows taxonomy declaration order across entries', () => {
  // orders-failing entry comes before checkout-broken in taxonomy.
  // 'order error' is in orders-failing; 'razorpay' is in checkout-broken.
  const s = svc.classify('order error and razorpay failing');
  const idxOrderError = s.matchedTerms.indexOf('order error');
  const idxRazorpay = s.matchedTerms.indexOf('razorpay');
  assert.ok(idxOrderError !== -1, 'order error should be in matchedTerms');
  assert.ok(idxRazorpay !== -1, 'razorpay should be in matchedTerms');
  // orders-failing comes first in taxonomy, so its terms come first in matchedTerms
  assert.ok(idxOrderError < idxRazorpay, 'taxonomy order should be respected in matchedTerms');
});

test('48 matchedTerms: no duplicates for a term matched once', () => {
  const s = svc.classify('queue backlog queue backlog queue backlog');
  const count = s.matchedTerms.filter((t) => t === 'queue backlog').length;
  assert.equal(count, 1, 'term should appear exactly once even if text repeats it');
});

// ─── 49..52  taxonomy invariants ────────────────────────────────────────────

const ALL_KINDS: Exclude<import('../src/shared/types').SymptomKind, 'unknown'>[] = [
  'orders-failing',
  'checkout-broken',
  'queue-backlog',
  'high-latency',
  'deployment-failed',
  'worker-crashed',
];

test('49 taxonomy covers exactly the 6 mandated non-unknown kinds', () => {
  const kindsInTaxonomy = new Set(SYMPTOM_TAXONOMY.map((e) => e.kind));
  assert.equal(kindsInTaxonomy.size, 6, `expected 6 unique kinds, got ${kindsInTaxonomy.size}`);
  for (const k of ALL_KINDS) {
    assert.ok(kindsInTaxonomy.has(k), `missing kind: ${k}`);
  }
});

test('50 taxonomy: every entry has at least one term, one domain, non-empty kind', () => {
  for (const entry of SYMPTOM_TAXONOMY) {
    assert.ok(entry.terms.length > 0, `entry kind=${entry.kind} has no terms`);
    assert.ok(entry.domains.length > 0, `entry kind=${entry.kind} has no domains`);
    assert.ok(typeof entry.kind === 'string' && entry.kind.length > 0, 'kind must be a non-empty string');
  }
});

test('51 taxonomy: no duplicate terms within any single entry', () => {
  for (const entry of SYMPTOM_TAXONOMY) {
    const seen = new Set<string>();
    for (const term of entry.terms) {
      assert.ok(!seen.has(term), `duplicate term "${term}" in entry kind=${entry.kind}`);
      seen.add(term);
    }
  }
});

test('52 taxonomy: each kind appears at least once (all 6 reachable)', () => {
  // Each kind must be triggerable by at least one of its own terms.
  for (const entry of SYMPTOM_TAXONOMY) {
    const s = svc.classify(entry.terms[0]!);
    assert.equal(
      s.kind,
      entry.kind,
      `first term "${entry.terms[0]}" of entry ${entry.kind} should yield that kind`,
    );
  }
});

// ─── 53..56  edge cases ──────────────────────────────────────────────────────

test('53 text property is always the ORIGINAL (un-lowercased) text', () => {
  const s = svc.classify('Orders FAILING right now');
  assert.equal(s.text, 'Orders FAILING right now');
});

test('54 partial substring match: term appears embedded in a longer word-like string', () => {
  // 'timeout' is a term; 'timeouts' is also a separate term — test the primary term
  const s = svc.classify('the request timed out with a timeout error');
  assert.equal(s.kind, 'high-latency');
  assert.ok(s.matchedTerms.includes('timeout'));
});

test('55 leading/trailing whitespace in input does not prevent matching', () => {
  const s = svc.classify('  worker crashed  ');
  assert.equal(s.kind, 'worker-crashed');
});

test('56 domains array contains no duplicates for single-entry match', () => {
  const s = svc.classify('deployment failed');
  const seen = new Set<string>();
  for (const d of s.domains) {
    assert.ok(!seen.has(d), `duplicate domain "${d}"`);
    seen.add(d);
  }
});
