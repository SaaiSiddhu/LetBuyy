// LB-11 — Gift cards COMPLETE. The canonical redemption path (create_checkout_order)
// reads gift_card_accounts and projects the balance from gift_card_ledger_entries, but
// issuance wrote the legacy public.gift_cards table the redemption never reads — so an
// issued card could never be redeemed. These tests assert the full lifecycle now lands
// on the canonical model: issue -> store (hashed) -> validate -> redeem -> balance -> fraud.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyAppApiRoute, listAppApiRoutes } from '../../scripts/validators/app-api-route-inventory.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const migration = read('database/supabase/migrations/173_v1_gift_card_issuance_lifecycle.sql');
const rollback = read('database/supabase/rollback/173_v1_gift_card_issuance_lifecycle.rollback.sql');
const checkout = read('database/supabase/migrations/000_baseline.sql');
const giftRoute = read('services/api-gateway/src/routes/gift-cards.ts');
const products = read('services/api-gateway/src/routes/products.ts');
const giftEmail = read('services/api-gateway/src/lib/gift-card-email.ts');
const worker = read('services/queue-workers/src/index.ts');
const commerceCore = read('packages/commerce-core/src/index.ts');
const apiClient = read('packages/typescript/api-client/src/index.ts');
const mcpPage = read('apps/merchant/web/src/app/[store]/products/gift-cards/page.tsx');
const mcpItemRoute = read('apps/merchant/web/src/app/api/stores/[store]/gift-cards/[id]/route.ts');

test('LB-11: migration 173 defines the canonical issuance + lifecycle RPCs (SECURITY DEFINER)', () => {
  for (const fn of [
    'gift_card_available_balance',
    'issue_gift_card',
    'list_gift_cards',
    'check_gift_card_balance',
    'set_gift_card_status',
    'gift_card_transactions',
  ]) {
    assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\b`), `${fn} must be defined`);
  }
  // every function is SECURITY DEFINER with a pinned search_path
  const defs = migration.match(/SECURITY DEFINER/g) || [];
  assert.ok(defs.length >= 6, 'all six functions must be SECURITY DEFINER');
  assert.match(migration, /SET search_path TO 'public'/);
});

test('LB-11: issuance hashes the code the SAME way the checkout redemption looks it up (lifecycle closes)', () => {
  // create_checkout_order (checkout) finds the card by sha256(code)
  assert.match(checkout, /code_hash = encode\(digest\(p_gift_card_code, 'sha256'\), 'hex'\)/);
  // issue_gift_card stores the same sha256(code) hash -> the issued card is redeemable
  assert.match(migration, /v_code_hash := encode\(digest\(p_code, 'sha256'\), 'hex'\)/);
  // and writes the canonical account + an 'issued' ledger entry (not the legacy table)
  assert.match(migration, /INSERT INTO gift_card_accounts/);
  assert.match(migration, /INSERT INTO gift_card_ledger_entries[\s\S]{0,400}'issued'/);
});

test('LB-11: balance is the ledger projection, never a mutable decrement (matches create_checkout_order)', () => {
  // available-balance projection sums the ledger exactly like the redemption path
  assert.match(migration, /WHEN entry_type IN \('issued', 'credit', 'refund_credit', 'release'\) THEN amount/);
  assert.match(migration, /WHEN entry_type IN \('debit', 'hold', 'expire', 'fraud_hold'\) THEN -amount/);
  // issuance never decrements gift_card_accounts.balance (the column stays the issued snapshot)
  assert.doesNotMatch(migration, /SET balance = balance - /);
  // only the issued snapshot is written at creation time
  assert.match(migration, /balance, currency,\n\s*status, expires_at/);
});

test('LB-11: the gateway issues + manages cards via RPC only (no direct canonical-table writes)', () => {
  assert.match(giftRoute, /db\.rpc\('issue_gift_card'/);
  assert.match(giftRoute, /db\.rpc\('list_gift_cards'/);
  assert.match(giftRoute, /db\.rpc\('check_gift_card_balance'/);
  assert.match(giftRoute, /db\.rpc\('gift_card_transactions'/);
  assert.match(giftRoute, /db\.rpc\('set_gift_card_status'/);
  // the canonical-ledger-only validator forbids direct .from('gift_card_accounts').insert/update in TS
  assert.doesNotMatch(giftRoute, /\.from\(\s*['"`]gift_card_accounts['"`]\s*\)[\s\S]{0,400}\.(insert|update|upsert|delete)\b/);
  assert.doesNotMatch(giftRoute, /\.from\(\s*['"`]gift_card_ledger_entries['"`]\s*\)/);
});

test('LB-11: issuance returns the plaintext code exactly once and cuts over off the legacy table', () => {
  // the issued plaintext code is attached to the response (one-time reveal)
  assert.match(giftRoute, /issued = \{ \.\.\.\(data[\s\S]{0,40}\), code \}/);
  // products.ts no longer writes the legacy gift_cards table; it delegates to the module
  assert.match(products, /registerGiftCardRoutes\(router\)/);
  assert.doesNotMatch(products, /\.from\('gift_cards'\)/);
});

test('LB-11: ownership + tenant isolation is enforced on every gift-card route', () => {
  // every handler verifies store ownership before touching the store's cards
  const verifyCount = (giftRoute.match(/verifySiteOwnership\(/g) || []).length;
  assert.ok(verifyCount >= 5, 'each of the five routes must verify store ownership');
  // the RPCs are all site-scoped
  assert.match(migration, /WHERE gca\.site_id = p_store_id/);
  assert.match(migration, /AND site_id = p_site_id/);
});

test('LB-11: fraud control disables redemption (set_gift_card_status + active-only redemption)', () => {
  assert.match(migration, /p_status NOT IN \('active', 'held', 'disabled'\)/);
  // a non-active card cannot be redeemed: create_checkout_order requires status = 'active'
  assert.match(checkout, /gca\.status = 'active'/);
  // disabling writes an audit ledger entry (fraud_hold) without burning balance
  assert.match(migration, /v_entry_type := CASE WHEN p_status = 'active' THEN 'release' ELSE 'fraud_hold' END/);
});

test('LB-11: recipient email dispatch is wired (producer + worker recognises the job)', () => {
  assert.match(giftEmail, /export async function enqueueGiftCardIssuedEmail/);
  assert.match(giftEmail, /jobType: 'email\.gift_card_issued'/);
  assert.match(giftRoute, /enqueueGiftCardIssuedEmail/);
  assert.match(worker, /jobType === 'email\.gift_card_issued'/);
});

test('LB-11: commerce-core + api-client expose the lifecycle surfaces', () => {
  assert.match(commerceCore, /recipient_email: z\.string\(\)\.email\(\)/);
  assert.match(commerceCore, /export const GiftCardStatusUpdateSchema/);
  assert.match(commerceCore, /export const GiftCardBalanceQuerySchema/);
  assert.match(apiClient, /balance: \(query: \{ store_id: string; code: string \}/);
  assert.match(apiClient, /transactions: \(id: string/);
  assert.match(apiClient, /setStatus: \(id: string/);
});

test('LB-11: merchant UI reveals the code once, shows projected balance + fraud control', () => {
  // the issued code is surfaced once (it is never returned by the list again)
  assert.match(mcpPage, /Gift card issued — copy the code now/);
  assert.match(mcpPage, /issuedCard\.code/);
  // the list binds code_last4 (no plaintext) + projected balance + redemptions
  assert.match(mcpPage, /code_last4/);
  assert.match(mcpPage, /Disable|Reactivate/);
  // the new app-api proxy delegates to the gateway (no local DB)
  assert.match(mcpItemRoute, /giftCards\.transactions/);
  assert.match(mcpItemRoute, /giftCards\.setStatus/);
});

// LB-11 added the gift-card lifecycle proxies. What matters about them is ownership, not a route count
// (the count is the validator's ratchet, kept in scripts/validators/app-api-route-inventory.mjs and
// checked in tests/federation/app-api-route-ownership.test.mjs): they must be inventoried and be plain
// gateway proxies, because every gift-card balance change goes through the canonical gateway RPCs.
test('LB-11: the gift-card proxy routes are inventoried as gateway-proxy, and the rollback drops every new function', () => {
  const inventory = listAppApiRoutes();
  for (const route of [
    'apps/merchant/web/src/app/api/stores/[store]/gift-cards/route.ts',
    'apps/merchant/web/src/app/api/stores/[store]/gift-cards/[id]/route.ts',
  ]) {
    assert.ok(inventory.includes(route), `${route} must be in the app-local API route inventory`);
    assert.equal(classifyAppApiRoute(route), 'gateway-proxy', `${route} must be a gateway proxy, never app-local commerce logic`);
  }
  for (const fn of [
    'gift_card_transactions',
    'set_gift_card_status',
    'check_gift_card_balance',
    'list_gift_cards',
    'issue_gift_card',
    'gift_card_available_balance',
  ]) {
    assert.match(rollback, new RegExp(`DROP FUNCTION IF EXISTS public\\.${fn}\\b`), `${fn} must be dropped on rollback`);
  }
});
