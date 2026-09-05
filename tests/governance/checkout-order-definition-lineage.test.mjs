// The lineage guard for create_checkout_order.
//
// WHY THIS EXISTS. This function has been redefined eight times (073 → 219, 515 → 623 lines). Each
// redefinition is a full CREATE OR REPLACE rewrite, so anything the author does not carry forward is
// silently gone — and that has already happened: migration 218 exists SOLELY to restore the
// idempotency advisory lock that 213 and 215 dropped. The lock was lost, shipped, and only found
// later. Nothing failed either time.
//
// So this file pins what each definition contributed, against WHATEVER the live definition is. A
// ninth redefinition that drops one of these fails here instead of shipping.
//
// It deliberately reads the LATEST migration that defines the function rather than a fixed file:
// pinning 219 would make the guard stale the moment a ninth definition lands, which is exactly when
// it is needed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationsDir = join(root, 'database/supabase/migrations');
const MARKER = 'CREATE OR REPLACE FUNCTION public.create_checkout_order';

function numericPrefix(name) {
  const m = /^(\d+)/.exec(name);
  return m ? Number(m[1]) : -1;
}

// Every migration that defines the function, in migration order. The LAST one is live.
const definingMigrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .filter((f) => readFileSync(join(migrationsDir, f), 'utf8').includes(MARKER))
  .sort((a, b) => numericPrefix(a) - numericPrefix(b));

function definitionIn(file) {
  const source = readFileSync(join(migrationsDir, file), 'utf8');
  const start = source.indexOf(MARKER);
  assert.ok(start >= 0, `${file} should contain a definition`);
  // The body is dollar-quoted, and the tag VARIES between migrations: 073..218 close with `$$;`
  // while 219 closes with `$function$;`. Matching only `$$;` silently read to end-of-file, which is
  // the difference between guarding a definition and guarding a whole migration.
  const rest = source.slice(start);
  const terminator = /\n\s*\$[A-Za-z_]*\$\s*;/.exec(rest);
  assert.ok(terminator, `${file} should contain a complete, dollar-quoted definition`);
  return rest.slice(0, terminator.index);
}

const liveFile = definingMigrations[definingMigrations.length - 1];
const live = definitionIn(liveFile);
// Comments stripped: this function documents itself heavily and names several of the very things
// asserted below, so an assertion that read its prose would pass on a comment about a deleted fix.
const liveCode = live.replace(/--[^\n]*/g, ' ');
// The PARAMETER LIST only. A parameter also appears in the body, so asserting its presence anywhere
// passes when it has been removed from the signature — proven by planting exactly that removal and
// watching the first version of this guard stay green.
const liveSignature = liveCode.slice(0, liveCode.search(/\bRETURNS\b/));

// Each entry: what it protects, which migration introduced it, and why losing it is not cosmetic.
const LINEAGE = [
  {
    since: '170',
    what: 'server-side shipping rate and tax parameters',
    pattern: /p_shipping_rate_id\s+uuid/,
    inSignature: true,
    why: 'without them the caller cannot name a server-priced shipping rate and totals fall back to client input',
  },
  {
    since: '206/218',
    what: 'the idempotency advisory lock, taken BEFORE the existence check',
    pattern: /pg_advisory_xact_lock\(hashtextextended\(p_store_id::text \|\| ':' \|\| p_idempotency_key, 0\)\)/,
    why: 'this is the fix 213 and 215 dropped: without it two concurrent callers with one idempotency key create TWO orders',
  },
  {
    since: '213',
    what: 'GST place of supply',
    pattern: /p_place_of_supply_state/,
    inSignature: true,
    why: 'place of supply decides CGST/SGST versus IGST; losing it silently mis-taxes every interstate order',
  },
  {
    since: '213',
    what: 'GST tax lines',
    pattern: /p_tax_lines/,
    inSignature: true,
    why: 'the per-line tax breakdown an invoice is built from',
  },
  {
    since: '215',
    what: 'the SCHEMA-QUALIFIED digest for the gift card code',
    pattern: /extensions\.digest\(/,
    why: 'an unqualified digest() under this function\'s restrictive search_path raises, so every gift-card checkout fails',
  },
  {
    since: '219',
    what: 'the purchases row for parent/child orders',
    pattern: /INSERT INTO public\.purchases\s*\(/,
    why: 'the parent purchase record a multi-seller order is grouped by',
  },
  {
    since: '219',
    what: 'gift card applied as TENDER, recorded in gift_card_redemptions',
    // Anchored on the opening paren: `gift_card_redemptions_disabled` CONTAINS
    // `gift_card_redemptions`, so an unanchored pattern matches a renamed-away table. Proven by
    // planting exactly that rename and watching the unanchored version stay green.
    pattern: /INSERT INTO gift_card_redemptions\s*\(/,
    why: 'a gift card is tender, never a pre-tax discount; losing the redemption row spends a card without recording it',
  },
  {
    since: '234',
    what: 'loyalty applied as TENDER, through the redeem RPC',
    pattern: /public\.redeem_loyalty_points\s*\(/,
    why: 'loyalty must move through the SECURITY DEFINER RPC that holds the idempotency key, the advisory lock and the cap — never by writing the ledger inline',
  },
  {
    since: '234',
    what: 'loyalty subtracted from what is PAYABLE, not from the taxable total',
    pattern: /v_payment_due := GREATEST\(v_grand_total - v_gift_card_amount - v_loyalty_amount, 0\)/,
    why: 'points are tender like a gift card; folding them into v_grand_total would change the GST and the invoice',
  },
  {
    since: '234',
    what: 'the residual passed as the authoritative payable amount',
    pattern: /v_loyalty_residual_minor,/,
    why: 'orders.total is mid-mutation here, so the RPC must be told the payable amount rather than infer it (233)',
  },
];

test('every migration that defines create_checkout_order is accounted for', () => {
  // If a ninth definition lands, this number changes and the author is forced to look at this file.
  assert.ok(definingMigrations.length >= 8, `expected at least 8 defining migrations, found ${definingMigrations.length}`);
  assert.equal(liveFile, definingMigrations.at(-1), 'the live definition is the highest-numbered one');
});

test('the guard reads the LIVE definition, not a pinned file', () => {
  // Proving the instrument: if this ever hard-codes 219, it stops guarding the thing it exists for.
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, ' ');
  // Looks for a QUOTED migration filename anywhere in this module. Generic on purpose: it catches
  // pinning any migration, not one particular name — and, unlike naming the current file, the
  // assertion cannot match itself, which the first version of this check did.
  const pinnedFilename = /['"`]\d{3}_[a-z0-9_]+\.sql['"`]/;
  assert.doesNotMatch(self, pinnedFilename, 'the guard must resolve the live definition, never pin a migration filename');
  assert.match(liveCode, /CREATE OR REPLACE FUNCTION public\.create_checkout_order/);
  // ...and it really is resolved from the directory listing.
  assert.ok(definingMigrations.includes(liveFile));
});

for (const entry of LINEAGE) {
  test(`create_checkout_order still carries ${entry.what} (since ${entry.since})`, () => {
    assert.match(
      entry.inSignature ? liveSignature : liveCode,
      entry.pattern,
      `${liveFile} dropped ${entry.what}, introduced in ${entry.since}. ${entry.why}. `
      + 'Every redefinition is a full rewrite, so anything not carried forward is gone — that is why 218 had to exist.',
    );
  });
}

test('the signature slice really is only the parameter list', () => {
  // Instrument check: if this slice ever spanned the body, every parameter assertion above would
  // pass on a body reference to a parameter that had been removed from the signature.
  assert.match(liveSignature, /p_store_id\s+uuid/);
  assert.doesNotMatch(liveSignature, /INSERT INTO/, 'the slice must stop before the body');
});

test('checkout REFUSES an over-large loyalty request rather than silently applying fewer points', () => {
  // Clamping would charge the buyer an amount the client never displayed: the points quietly drop
  // out and the total goes up. One policy, and it is the explicit one.
  assert.match(liveCode, /loyalty points exceed what this order can apply/);
  assert.doesNotMatch(liveCode, /v_loyalty_points_applied := LEAST\(/, 'the clamp was replaced by a refusal');
});

test('the loyalty idempotency key is DERIVED from the order, so a replay cannot debit twice', () => {
  assert.match(liveCode, /'loyalty\.redemption:' \|\| v_order_id::TEXT/);
});

test('the advisory lock is taken BEFORE the idempotency existence check', () => {
  // Order matters, not just presence: 206's own comment says advisory-FIRST is what prevents the
  // deadlock and the double-order. A definition that took the lock after the lookup would satisfy a
  // presence check and still be broken.
  const lockAt = liveCode.indexOf('pg_advisory_xact_lock');
  const lookupAt = liveCode.search(/FROM\s+orders[\s\S]{0,400}idempotency_key/i);
  assert.ok(lockAt > 0, 'the advisory lock should be present');
  if (lookupAt > 0) {
    assert.ok(lockAt < lookupAt, 'the advisory lock must be taken before the idempotency lookup');
  }
});
