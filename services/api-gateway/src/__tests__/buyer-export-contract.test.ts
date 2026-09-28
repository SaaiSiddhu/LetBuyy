// Phase 2 / D05 independent preparation (Mandate 6, Section 12) -- contract tests for the DRAFT
// buyer export generator. Synthetic fixtures only; no database. Confirms the module itself stays
// disconnected (BUYER_EXPORT_GENERATION_AVAILABLE === false) so this cannot be mistaken for a
// shipped capability.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUYER_EXPORT_GENERATION_AVAILABLE,
  BUYER_EXPORT_CONTRACT,
  generateBuyerExport,
  allEmittableFieldNames,
  type SyntheticSourceData,
} from '../identity-foundation/buyer-export-contract';

const BUYER_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const BUYER_B = 'bbbbbbbb-0000-4000-8000-00000000000b';

test('the generator is not available for use -- this is a draft contract, not a shipped feature', () => {
  assert.equal(BUYER_EXPORT_GENERATION_AVAILABLE, false);
});

test('no field spec uses SELECT * -- every field names its own exact source column', () => {
  for (const section of BUYER_EXPORT_CONTRACT) {
    for (const field of section.fields) {
      assert.doesNotMatch(field.canonicalSource, /\*/, `${section.section}.${field.field} must name an exact column`);
      assert.ok(field.canonicalSource.length > 0);
    }
  }
});

test('every omitted field states a rationale -- "omitted" alone is not a spec', () => {
  for (const section of BUYER_EXPORT_CONTRACT) {
    for (const field of section.fields) {
      if (field.transformation === 'omitted') {
        assert.ok(field.rationale && field.rationale.length > 0, `${section.section}.${field.field} is omitted without a stated rationale`);
      }
    }
  }
});

test('credentials/security material (password_hash, session_epoch) are never emittable', () => {
  const emittable = allEmittableFieldNames();
  assert.ok(!emittable.includes('password_hash'));
  assert.ok(!emittable.includes('session_epoch'));
});

test('Buyer A receives only Buyer A\'s data -- Buyer B\'s rows in the same source are excluded, not merely unlabeled', () => {
  const source: SyntheticSourceData = {
    profile: { id: BUYER_A, email: 'a@shop.test', full_name: 'Buyer A', phone: null, status: 'active', created_at: '2026-01-01T00:00:00Z' },
    addresses: [
      { buyer_account_id: BUYER_A, label: 'home', full_name: 'Buyer A', address_line1: '1 A St', city: 'Mumbai', state: 'MH', postal_code: '400001', country: 'IN', is_default: true },
      { buyer_account_id: BUYER_B, label: 'home', full_name: 'Buyer B', address_line1: '1 B St', city: 'Delhi', state: 'DL', postal_code: '110001', country: 'IN', is_default: true },
    ],
    orders: [
      { buyer_account_id: BUYER_A, order_number: 'ORD-A-1', status: 'paid', total_minor: 10000, created_at: '2026-01-02T00:00:00Z', items: [] },
      { buyer_account_id: BUYER_B, order_number: 'ORD-B-1', status: 'paid', total_minor: 20000, created_at: '2026-01-03T00:00:00Z', items: [] },
    ],
  };
  const result = generateBuyerExport({ requestingBuyerAccountId: BUYER_A, requestId: 'req-1' }, source);
  assert.equal(result.sections.addresses.length, 1);
  assert.equal(result.sections.addresses[0].city, 'Mumbai');
  assert.equal(result.sections.orders.length, 1);
  assert.equal(result.sections.orders[0].order_reference, 'ORD-A-1');
});

test('a mismatched profile row (belongs to someone else) is excluded and marked incomplete, never silently substituted', () => {
  const source: SyntheticSourceData = {
    profile: { id: BUYER_B, email: 'b@shop.test', full_name: 'Buyer B', phone: null, status: 'active', created_at: '2026-01-01T00:00:00Z' },
  };
  const result = generateBuyerExport({ requestingBuyerAccountId: BUYER_A, requestId: 'req-2' }, source);
  assert.equal(result.sections.profile.length, 0);
  assert.equal(result.complete, false);
  assert.deepEqual(result.incompleteSections, ['profile']);
});

test('a complete export (nothing mismatched) reports complete: true with no incompleteSections key', () => {
  const result = generateBuyerExport({ requestingBuyerAccountId: BUYER_A, requestId: 'req-3' }, {});
  assert.equal(result.complete, true);
  assert.equal('incompleteSections' in result, false);
});

test('deterministic serialization: two calls with identical input produce identical field ordering', () => {
  const source: SyntheticSourceData = {
    profile: { id: BUYER_A, email: 'a@shop.test', full_name: 'Buyer A', phone: '9999999999', status: 'active', created_at: '2026-01-01T00:00:00Z' },
  };
  const now = new Date('2026-09-28T00:00:00Z');
  const first = generateBuyerExport({ requestingBuyerAccountId: BUYER_A, requestId: 'req-4' }, source, now);
  const second = generateBuyerExport({ requestingBuyerAccountId: BUYER_A, requestId: 'req-4' }, source, now);
  assert.deepEqual(Object.keys(first.sections.profile[0]), Object.keys(second.sections.profile[0]));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test('agent-authored internal ticket notes are never included, even if present in the raw source', () => {
  const source: SyntheticSourceData = {
    authoredRequests: [
      { requester_user_id: BUYER_A, ticket_ref: 'PRIV-1', topic: 'privacy', created_at: '2026-01-01T00:00:00Z', body: 'please export my data', agent_notes: 'internal: verify identity first' },
    ],
  };
  const result = generateBuyerExport({ requestingBuyerAccountId: BUYER_A, requestId: 'req-5' }, source);
  assert.equal(result.sections.authored_requests[0].authored_messages, 'please export my data');
  assert.equal('agent_notes' in result.sections.authored_requests[0], false);
});

test('a null optional field follows its declared nullBehavior (null_value keeps the key, omit_key drops it)', () => {
  const source: SyntheticSourceData = {
    profile: { id: BUYER_A, email: 'a@shop.test', full_name: null, phone: null, status: 'active', created_at: null },
  };
  const result = generateBuyerExport({ requestingBuyerAccountId: BUYER_A, requestId: 'req-6' }, source);
  const profile = result.sections.profile[0];
  assert.equal(profile.full_name, null, 'full_name is nullBehavior: null_value');
  assert.equal('created_at' in profile, false, 'created_at is nullBehavior: omit_key');
});

test('every export result carries its contract version -- a future contract change is distinguishable from this one', () => {
  const result = generateBuyerExport({ requestingBuyerAccountId: BUYER_A, requestId: 'req-7' }, {});
  assert.match(result.contractVersion, /^v1-draft/);
});
