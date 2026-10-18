// Phase 6.1 — approval follows the exact material marketplace revision on owned Postgres.
// Exercises canonical products, product_variants, product_options and listing terms. Stock and
// sellability controls are operational and must not trigger review; material edits must.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const sharedDatabase = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const databaseName = `${sharedDatabase}_review_revision`;
const runnable = databaseName !== 'letbuyy_executable';
const skip = runnable ? false : 'refusing to recreate the shared executable database';
const historicalDatabase = 'letbuyy_review_revision_at275';
const REVISION_MIGRATION = '275_marketplace_revision_bound_approval.sql';
const SITE = 'a1111111-1111-4111-8111-111111111111';
const OTHER_SITE = 'b1111111-1111-4111-8111-111111111111';
const PRODUCT = 'a2222222-2222-4222-8222-222222222222';
const LISTING = 'a3333333-3333-4333-8333-333333333333';
const VARIANT = 'a4444444-4444-4444-8444-444444444444';
const CATEGORY = 'a5555555-5555-4555-8555-555555555555';
const CATEGORY_NEXT = 'a6666666-6666-4666-8666-666666666666';
const OPERATOR = 'a7777777-7777-4777-8777-777777777777';
const MERCHANT_ACTOR = 'a9999999-9999-4999-8999-999999999999';
let revisionMigrationApplied = false;

function psql(sql, targetDatabase = databaseName) {
  return execFileSync('docker', [
    'exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase,
    '-v', 'ON_ERROR_STOP=1', '-qAt',
  ], { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const applySql = (relativePath,targetDatabase=databaseName) => psql(readFileSync(join(repoRoot, relativePath), 'utf8'),targetDatabase);

function listMigrations() {
  return readdirSync(join(repoRoot, 'database/supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => Number(a.match(/^\d+/)?.[0] ?? 0) - Number(b.match(/^\d+/)?.[0] ?? 0) || a.localeCompare(b));
}

function bootstrap() {
  psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
  psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
  for (const name of listMigrations().filter((name) => parseInt(name,10)<275)) {
    const source = readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8')
      .replace(/^SET transaction_timeout = 0;\s*$/m, '');
    try { psql(source); } catch (error) { throw new Error(`migration ${name} failed: ${error.message}`); }
  }
  psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published, status)
    VALUES (${sqlString(SITE)}::uuid, 'Review Test', 'Review Test', 'store', 'review-test', true, 'published');
    INSERT INTO public.marketplace_categories (id, slug, name) VALUES
      (${sqlString(CATEGORY)}::uuid, 'review-test', 'Review Test'),
      (${sqlString(CATEGORY_NEXT)}::uuid, 'review-test-next', 'Review Test Next');
    INSERT INTO public.products
      (id, site_id, store_id, name, slug, description, price, stock, is_active, status)
    VALUES (${sqlString(PRODUCT)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(SITE)}::uuid,
      'Review product', 'review-product', 'Original description', 120, 5, true, 'active');
    INSERT INTO public.product_variants
      (id, product_id, title, price, inventory_qty, option1, position)
    VALUES (${sqlString(VARIANT)}::uuid, ${sqlString(PRODUCT)}::uuid, 'Blue / Small', 120, 5, 'Blue', 0);
    INSERT INTO public.product_options (product_id, name, "values", "position")
    VALUES (${sqlString(PRODUCT)}::uuid, 'Color', '["Blue"]'::jsonb, 0);
    INSERT INTO public.channel_listings
      (id, site_id, product_id, channel, marketplace_category_id)
    VALUES (${sqlString(LISTING)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(PRODUCT)}::uuid,
      'marketplace', ${sqlString(CATEGORY)}::uuid);
  `);
  transition('pending_review', 'merchant', 'submit-initial');
  transition('approved', 'operator', 'approve-initial', 'Review passed.');
  applySql(`database/supabase/migrations/${REVISION_MIGRATION}`);
  revisionMigrationApplied = true;
  assert.equal(listingStatus(), 'draft', 'legacy approvals without a historical fingerprint are withdrawn');
  assert.equal(psql(`SELECT submitted_product_snapshot IS NOT NULL FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), 'f');
  assert.equal(psql(`SELECT reason FROM public.channel_listing_moderation_events
    WHERE listing_id=${sqlString(LISTING)}::uuid AND actor_realm='system' ORDER BY created_at DESC LIMIT 1;`),
    'Historical approval has no bound product revision; merchant resubmission is required.');
  transition('pending_review', 'merchant', 'submit-after-baseline');
  assert.equal(psql(`SELECT submitted_product_snapshot->'product'->>'name' FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), 'Review product');
  transition('approved', 'operator', 'approve-after-baseline', 'Review passed.');
  assert.equal(psql(`SELECT approved_product_snapshot->'product'->>'name' FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), 'Review product');
  assert.equal(psql(`SELECT submitted_product_snapshot = approved_product_snapshot FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), 't');
  assert.equal(psql(`SELECT submitted_product_snapshot ? 'product' AND submitted_product_snapshot ? 'variants' AND submitted_product_snapshot ? 'options' FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), 't');
  // Retain275 for its historical rollback. Later ABI fences must observe275
  // in real order, rather than being applied before their own prerequisite.
  psql(`DROP DATABASE IF EXISTS "${historicalDatabase}"; CREATE DATABASE "${historicalDatabase}" TEMPLATE "${databaseName}";`,'postgres');
  for(const name of listMigrations().filter(name=>parseInt(name,10)>275)) {
    psql(readFileSync(join(repoRoot,'database/supabase/migrations',name),'utf8').replace(/^SET transaction_timeout = 0;\s*$/m,''));
  }

}

function transition(toStatus, realm, key, reason = null, operatorId = OPERATOR) {
  if (revisionMigrationApplied && realm === 'operator' && ['approved', 'rejected'].includes(toStatus)
      && listingStatus() === 'pending_review'
      && psql(`SELECT assigned_reviewer_id IS NULL FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`) === 't') {
    claimListing('Fixture reviewer will inspect this product.', `fixture-claim:${key}`);
  }
  const siteContext = realm === 'merchant'
    ? `SELECT set_config('app.site_id', ${sqlString(SITE)}, true);`
    : `SELECT set_config('app.site_id', '', true);`;
  const actor = realm === 'operator' ? `${sqlString(operatorId)}::uuid` : 'NULL';
  return psql(`BEGIN;
    ${siteContext}
    SELECT to_status FROM public.transition_channel_listing(
      ${sqlString(SITE)}::uuid, ${sqlString(LISTING)}::uuid, ${sqlString(toStatus)},
      ${sqlString(realm)}, ${actor}, ${reason === null ? 'NULL' : sqlString(reason)}, ${sqlString(key)}
    );
    COMMIT;`);
}

function claimListing(reason, key, reviewer = OPERATOR) {
  const version = Number(psql(`SELECT version FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`));
  return psql(`SELECT listing_id::text || '|' || assigned_reviewer_id::text || '|' || version::text || '|' || replayed::text
    FROM public.claim_marketplace_listing_review(
      ${sqlString(SITE)}::uuid, ${sqlString(LISTING)}::uuid, ${sqlString(reviewer)}::uuid,
      ${sqlString(reason)}, ${sqlString(key)}, ${version}
    );`);
}

function assignReviewer(reviewer, reason, key, assigningOperator = OPERATOR) {
  const version = Number(psql(`SELECT version FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`));
  return psql(`SELECT listing_id::text || '|' || COALESCE(previous_reviewer_id::text, 'none') || '|'
      || assigned_reviewer_id::text || '|' || version::text || '|' || replayed::text
    FROM public.assign_marketplace_listing_reviewer(
      ${sqlString(SITE)}::uuid, ${sqlString(LISTING)}::uuid, ${sqlString(assigningOperator)}::uuid,
      ${sqlString(reviewer)}::uuid, ${sqlString(reason)}, ${sqlString(key)}, ${version}
    );`);
}

function resubmitListing(reason, key, siteId = SITE, listingId = LISTING, actorId = MERCHANT_ACTOR) {
  return asTenant(siteId, `SELECT listing_id::text || '|' || from_status || '|' || to_status || '|' || replayed::text
    FROM public.resubmit_rejected_marketplace_listing(
      ${sqlString(siteId)}::uuid, ${sqlString(listingId)}::uuid, ${sqlString(actorId)}::uuid,
      ${sqlString(reason)}, ${sqlString(key)}
  );`);
}

function asTenant(siteId, sql) {
  const setSite = siteId ? `SELECT set_config('app.site_id', ${sqlString(siteId)}, true);` : '';
  return psql(`BEGIN; SET LOCAL ROLE app_tenant; ${setSite} ${sql} COMMIT;`)
    .split('\n').at(-1);
}

const listingStatus = () => psql(`SELECT status FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`);
const eventCount = (reason) => psql(`SELECT count(*) FROM public.channel_listing_moderation_events
  WHERE listing_id=${sqlString(LISTING)}::uuid AND actor_realm='system' AND reason=${sqlString(reason)};`);

before(() => { if (runnable) bootstrap(); });
after(() => {
  if (!runnable) return;
  try { psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE); DROP DATABASE IF EXISTS "${historicalDatabase}" WITH (FORCE);`, 'postgres'); } catch { /* runner owns recovery */ }
});

test('stock, inventory and activation changes preserve the reviewed material revision', { skip }, () => {
  const approvedFingerprint = psql(`SELECT approved_product_fingerprint FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`);
  psql(`UPDATE public.products SET stock=stock+1, is_active=false WHERE id=${sqlString(PRODUCT)}::uuid;
        UPDATE public.products SET stock=stock+1, is_active=true WHERE id=${sqlString(PRODUCT)}::uuid;
        UPDATE public.product_variants SET inventory_qty=inventory_qty+1 WHERE id=${sqlString(VARIANT)}::uuid;`);
  assert.equal(listingStatus(), 'approved');
  assert.equal(psql(`SELECT approved_product_fingerprint FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), approvedFingerprint);
  assert.equal(eventCount('Material product details changed; merchant resubmission is required.'), '0');
});

test('revision fingerprints and saved snapshots cannot be rewritten without a valid transition', { skip }, () => {
  const refused = (() => {
    try {
      psql(`UPDATE public.channel_listings SET submitted_product_snapshot='{"forged":true}'::jsonb
        WHERE id=${sqlString(LISTING)}::uuid;`);
      return null;
    } catch (error) { return `${error.stderr || ''}${error.stdout || ''}`; }
  })();
  assert.ok(refused, 'a direct revision snapshot write must fail');
  assert.match(refused, /review fingerprints change only with a valid listing transition/);
  assert.equal(psql(`SELECT submitted_product_snapshot ? 'forged' FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), 'f');
});

test('material product edits withdraw the listing and remove marketplace read access', { skip }, () => {
  psql(`UPDATE public.products SET description='Edited description' WHERE id=${sqlString(PRODUCT)}::uuid;`);
  assert.equal(listingStatus(), 'draft');
  assert.equal(psql(`SELECT submitted_product_fingerprint IS NULL FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), 't');
  assert.equal(psql(`SELECT submitted_product_snapshot IS NULL FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), 't');
  assert.equal(psql(`SELECT approved_product_snapshot IS NOT NULL FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), 't');
  assert.equal(eventCount('Material product details changed; merchant resubmission is required.'), '1');
  assert.equal(psql(`SELECT actor_realm || '|' || reason FROM public.channel_listing_moderation_events
    WHERE listing_id=${sqlString(LISTING)}::uuid AND actor_realm='system' ORDER BY created_at DESC LIMIT 1;`),
    'system|Material product details changed; merchant resubmission is required.');
  assert.equal(psql(`SELECT count(*) FROM public.marketplace_feed(NULL,NULL,20,NULL,NULL)
    WHERE listing_id=${sqlString(LISTING)}::uuid;`), '0');
  assert.equal(psql(`SELECT count(*) FROM public.marketplace_listing_detail(${sqlString(LISTING)}::uuid);`), '0');
});

test('submission binds a fingerprint; reviewer claims are atomic/idempotent; material edits require resubmission', { skip }, () => {
  transition('pending_review', 'merchant', 'submit-edited-product');
  const reason = 'I will review this product submission.';
  const claimed = claimListing(reason, 'claim-first');
  assert.match(claimed, new RegExp(`${LISTING}\\|${OPERATOR}\\|\\d+\\|f`));
  const replayed = claimListing(reason, 'claim-first');
  assert.match(replayed, new RegExp(`${LISTING}\\|${OPERATOR}\\|\\d+\\|t`));
  const competingClaim = (() => {
    try { claimListing(reason, 'claim-second', 'a8888888-8888-4888-8888-888888888888'); return null; }
    catch (error) { return `${error.stderr || ''}${error.stdout || ''}`; }
  })();
  assert.ok(competingClaim, 'a second reviewer must not take an already claimed listing');
  assert.match(competingClaim, /listing_already_claimed/);
  const submitted = psql(`SELECT submitted_product_fingerprint FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`);
  assert.match(submitted, /^[0-9a-f]{64}$/);
  transition('approved', 'operator', 'approve-edited-product', 'Review passed.');
  assert.equal(listingStatus(), 'approved');
  assert.equal(psql(`SELECT approved_product_fingerprint FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), submitted);

  psql(`UPDATE public.product_variants SET price=125 WHERE id=${sqlString(VARIANT)}::uuid;`);
  assert.equal(listingStatus(), 'draft', 'a variant price change is material');
  assert.equal(eventCount('Material product variant changed; merchant resubmission is required.'), '1');

  transition('pending_review', 'merchant', 'submit-variant-change');
  transition('approved', 'operator', 'approve-variant-change', 'Review passed.');
  psql(`UPDATE public.product_options SET "values"='["Blue","Green"]'::jsonb WHERE product_id=${sqlString(PRODUCT)}::uuid;`);
  assert.equal(listingStatus(), 'draft', 'a variant option definition change is material');

  transition('pending_review', 'merchant', 'submit-option-change');
  transition('approved', 'operator', 'approve-option-change', 'Review passed.');
  psql(`UPDATE public.channel_listings SET marketplace_category_id=${sqlString(CATEGORY_NEXT)}::uuid
    WHERE id=${sqlString(LISTING)}::uuid;`);
  assert.equal(listingStatus(), 'draft', 'marketplace category changes require re-review');

  transition('pending_review', 'merchant', 'submit-category-change');
  transition('approved', 'operator', 'approve-category-change', 'Review passed.');
  psql(`UPDATE public.channel_listings SET pricing_policy='{"marketplace_price":"fixed"}'::jsonb
    WHERE id=${sqlString(LISTING)}::uuid;`);
  assert.equal(listingStatus(), 'draft', 'pricing-policy changes require re-review');

  transition('pending_review', 'merchant', 'submit-pricing-change');
  transition('approved', 'operator', 'approve-pricing-change', 'Review passed.');
  psql(`UPDATE public.channel_listings SET compliance_flags='{"requires_age_check":true}'::jsonb
    WHERE id=${sqlString(LISTING)}::uuid;`);
  assert.equal(listingStatus(), 'draft', 'compliance changes require re-review');
});

test('a previously assigned reviewer cannot decide after the assignment changes under the listing lock', { skip }, () => {
  // The owned database fixture is shared across tests; make the previous approved state stale first.
  psql(`UPDATE public.products SET description='Preparing the reviewer reassignment fixture' WHERE id=${sqlString(PRODUCT)}::uuid;`);
  transition('pending_review', 'merchant', 'submit-for-reassignment-race');
  const claimReason = 'The assigned reviewer will inspect this product.';
  claimListing(claimReason, 'claim-before-reassignment-race', OPERATOR);
  const replacementReviewer = 'a8888888-8888-4888-8888-888888888888';

  // The real assignment RPC commits between the gateway's listing read and transition call.
  const reassigned = assignReviewer(replacementReviewer, 'On-call rotation changed for this review.', 'reassign-race-key');
  assert.match(reassigned, new RegExp(`${LISTING}\\|${OPERATOR}\\|${replacementReviewer}\\|\\d+\\|f`));
  assert.match(assignReviewer(replacementReviewer, 'On-call rotation changed for this review.', 'reassign-race-key'), /\|true$/,
    'a retry returns the same assignment event');

  const staleDecision = (() => {
    try { transition('approved', 'operator', 'stale-reviewer-after-reassignment', 'Review passed.'); return null; }
    catch (error) { return `${error.stderr || ''}${error.stdout || ''}`; }
  })();
  assert.ok(staleDecision, 'the old assignee must lose decision authority after reassignment');
  assert.match(staleDecision, /marketplace_review_assignment_required/);
  assert.equal(listingStatus(), 'pending_review');
  assert.equal(psql(`SELECT count(*) FROM public.channel_listing_moderation_events
    WHERE listing_id=${sqlString(LISTING)}::uuid AND idempotency_key='stale-reviewer-after-reassignment';`), '0');
  const staleRejection = (() => {
    try { transition('rejected', 'operator', 'stale-rejection-after-reassignment', 'Needs changes.'); return null; }
    catch (error) { return `${error.stderr || ''}${error.stdout || ''}`; }
  })();
  assert.ok(staleRejection, 'the old assignee must not reject after reassignment either');
  assert.match(staleRejection, /marketplace_review_assignment_required/);
  assert.equal(listingStatus(), 'pending_review');

  transition('approved', 'operator', 'replacement-reviewer-approves', 'Review passed.', replacementReviewer);
  assert.equal(listingStatus(), 'approved', 'the current assigned reviewer retains the positive path');
  psql(`UPDATE public.products SET description='Reassignment race fixture reset' WHERE id=${sqlString(PRODUCT)}::uuid;`);
  assert.equal(listingStatus(), 'draft', 'restore the shared fixture to the next test’s expected state');
});

test('a submitted product edit returns to draft before an operator can approve stale content', { skip }, () => {
  transition('pending_review', 'merchant', 'submit-after-compliance-change');
  psql(`UPDATE public.products SET name='Changed while pending' WHERE id=${sqlString(PRODUCT)}::uuid;`);
  assert.equal(listingStatus(), 'draft');
  const refused = (() => {
    try { transition('approved', 'operator', 'stale-review-attempt', 'Review passed.'); return null; }
    catch (error) { return `${error.stderr || ''}${error.stdout || ''}`; }
  })();
  assert.ok(refused, 'an operator cannot approve a stale submission');
  assert.match(refused, /invalid_transition/);
});

test('merchant correction resubmission is tenant-bound, atomic, revision-bound, and idempotent', { skip }, () => {
  // The preceding test intentionally leaves a rejected submission. Restore a current
  // revision through the same merchant path, then prepare the rejection under test.
  if (listingStatus() === 'rejected') {
    resubmitListing('Restoring the owned fixture before the correction acceptance test.', 'merchant-correction-fixture-restore');
  }
  psql(`UPDATE public.products SET description='Preparing merchant correction acceptance' WHERE id=${sqlString(PRODUCT)}::uuid;`);
  assert.equal(listingStatus(), 'draft', 'prepare a fresh revision before submitting the correction fixture');
  transition('pending_review', 'merchant', 'submit-for-merchant-correction');
  claimListing('Reviewer will inspect the corrected product.', 'claim-for-merchant-correction');
  transition('rejected', 'operator', 'reject-for-merchant-correction', 'Please add the missing safety and product details.');
  assert.equal(listingStatus(), 'rejected');

  const crossTenant = (() => {
    try {
      asTenant(OTHER_SITE, `SELECT * FROM public.resubmit_rejected_marketplace_listing(
        ${sqlString(SITE)}::uuid, ${sqlString(LISTING)}::uuid, ${sqlString(MERCHANT_ACTOR)}::uuid,
        'I corrected the rejected product details for review.', 'cross-tenant-resubmit-attempt'
      );`);
      return null;
    } catch (error) { return `${error.stderr || ''}${error.stdout || ''}`; }
  })();
  assert.ok(crossTenant, 'a different tenant cannot resubmit this listing');
  assert.match(crossTenant, /tenant context required for merchant resubmission/);
  assert.equal(listingStatus(), 'rejected', 'wrong-tenant attempts leave the listing rejected');

  const response = 'Added the missing safety details and updated the product description.';
  const accepted = resubmitListing(response, 'merchant-correction-resubmit-1');
  assert.match(accepted, new RegExp(`${LISTING}\\|draft\\|pending_review\\|false`));
  assert.equal(listingStatus(), 'pending_review');
  assert.equal(psql(`SELECT submitted_product_snapshot->'product'->>'description' FROM public.channel_listings WHERE id=${sqlString(LISTING)}::uuid;`), 'Preparing merchant correction acceptance');
  assert.equal(psql(`SELECT reason FROM public.channel_listing_moderation_events WHERE listing_id=${sqlString(LISTING)}::uuid AND idempotency_key='merchant-correction-resubmit-1';`), response);
  assert.match(resubmitListing(response, 'merchant-correction-resubmit-1'), /\\|true$/,
    'a lost-response retry returns the same event');

  const conflict = (() => {
    try { resubmitListing('Changed response for a previous request.', 'merchant-correction-resubmit-1'); return null; }
    catch (error) { return `${error.stderr || ''}${error.stdout || ''}`; }
  })();
  assert.ok(conflict, 'same key with a different response must conflict');
  assert.match(conflict, /idempotency_key_conflict/);
  assert.equal(listingStatus(), 'pending_review');

  // Fail on the second transition edge after rejected→draft. The enclosing RPC transaction must
  // roll the draft edge back, preserving the rejection and allowing a corrected retry.
  psql(`UPDATE public.products SET description='Correction rollback fixture' WHERE id=${sqlString(PRODUCT)}::uuid;`);
  assert.equal(listingStatus(), 'draft', 'material edit withdraws the pending review before the rollback check');
  transition('pending_review', 'merchant', 'submit-again-before-correction-rollback');
  claimListing('Reviewer will inspect the rollback fixture.', 'claim-before-correction-rollback');
  transition('rejected', 'operator', 'reject-before-correction-rollback', 'Please include required marketplace details.');
  psql(`UPDATE public.channel_listings SET marketplace_category_id=NULL WHERE id=${sqlString(LISTING)}::uuid;`);
  const category = (() => {
    try { resubmitListing('I corrected all requested listing details.', 'merchant-correction-retry-after-failure'); return null; }
    catch (error) { return `${error.stderr || ''}${error.stdout || ''}`; }
  })();
  assert.ok(category, 'submission must fail without its required marketplace category');
  assert.match(category, /marketplace_category_id/);
  assert.equal(listingStatus(), 'rejected', 'the failed pending edge does not leave a draft row');
  psql(`UPDATE public.channel_listings SET marketplace_category_id=${sqlString(CATEGORY)}::uuid WHERE id=${sqlString(LISTING)}::uuid;`);
  assert.match(resubmitListing('I corrected all requested listing details.', 'merchant-correction-retry-after-failure'), /\\|false$/,
    'the exact request key remains usable after the rolled-back attempt');
  assert.equal(listingStatus(), 'pending_review');
  psql(`UPDATE public.products SET description='Restored draft after correction verification' WHERE id=${sqlString(PRODUCT)}::uuid;`);
  assert.equal(listingStatus(), 'draft', 'leave the shared fixture in the next test’s expected draft state');
});

test('direct inserts cannot create an already-approved listing and rollback revokes active approvals', { skip }, () => {
  const bypass = (() => {
    try {
      psql(`INSERT INTO public.channel_listings (site_id, product_id, channel, status, marketplace_category_id)
        VALUES (${sqlString(SITE)}::uuid, ${sqlString(PRODUCT)}::uuid, 'marketplace', 'approved', ${sqlString(CATEGORY)}::uuid);`);
      return null;
    } catch (error) { return `${error.stderr || ''}${error.stdout || ''}`; }
  })();
  assert.ok(bypass);
  assert.match(bypass, /must be created as an unreviewed draft/);

  transition('pending_review', 'merchant', 'submit-before-rollback');
  transition('approved', 'operator', 'approve-before-rollback', 'Review passed.');
  const currentWriter=psql("SELECT md5(pg_get_functiondef('public.transition_channel_listing(uuid,uuid,text,text,uuid,text,text)'::regprocedure));");
  applySql('database/supabase/rollback/275_marketplace_revision_bound_approval.rollback.sql',historicalDatabase);
  assert.equal(psql(`SELECT status FROM channel_listings WHERE id=${sqlString(LISTING)};`,historicalDatabase), 'draft', 'historical rollback is fail-closed and requires resubmission');
  assert.equal(psql("SELECT md5(pg_get_functiondef('public.transition_channel_listing(uuid,uuid,text,text,uuid,text,text)'::regprocedure));"),currentWriter,'historical recovery cannot replace the current writer');
  assert.equal(psql("SELECT to_regprocedure('public.marketplace_listing_review_fingerprint(uuid)') IS NULL;",historicalDatabase), 't');
  assert.equal(psql("SELECT count(*) FROM information_schema.columns WHERE table_name='channel_listings' AND column_name='approved_product_fingerprint';",historicalDatabase), '0');
  assert.equal(psql("SELECT count(*) FROM information_schema.columns WHERE table_name='channel_listings' AND column_name IN ('submitted_product_snapshot','approved_product_snapshot');",historicalDatabase), '0');
  assert.equal(psql("SELECT to_regprocedure('public.marketplace_listing_review_snapshot(uuid)') IS NULL;",historicalDatabase), 't');
});
