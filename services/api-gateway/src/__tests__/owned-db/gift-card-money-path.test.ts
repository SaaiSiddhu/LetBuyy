import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { before, afterEach } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { Gateway, gatewayEnv, newIdentityKeys, restJson, signedIdentityHeaders, tapRest } from './gateway-harness';

// T15 (CAP-C50): the gift-card subsystem had never run a single operation. W0 found the real
// cause live (executed check_gift_card_balance / issue_gift_card / create_checkout_order's
// gift-card branch directly): all three called the unqualified pgcrypto function `digest()`
// under `SET search_path TO 'public'`, but pgcrypto is installed in the `extensions` schema on
// this database -- identical defect class to T14's issue_gst_invoice bug. Migration 215
// qualifies each call site as `extensions.digest(...)` (narrower than widening the whole
// function's search_path, matching T14's precedent).
//
// This file proves, with real database figures, that a gift card can now be issued, its
// balance is a genuine ledger PROJECTION (summed, never a mutated column), redeemed as TENDER
// at a real checkout order, restored append-only on refund, refused once disabled, capped on
// over-redemption, refused under genuine concurrent double-redemption, replay-safe for all
// three money RPCs, and refused across tenants.
//
// Money-table discipline: no gift-card row is ever DELETEd by this file.
//
// The source-level check of migration 215 that used to sit in this file stays in the fast unit lane, in
// ../gift-card-money-path.test.ts (it needs no database).
//
// Runs only in the owned database lane (scripts/governance/run-executable-suites.mjs): every statement below goes to a
// database the runner cloned for this suite alone, so the gift-card ledger, the checkout sessions and the orders this
// file creates are never written to a developer's own database, and there is no skip path.

const owned = requireOwnedDatabase();
const { psql, psqlAsync, psqlExpectError } = owned;

// The store under test, and an unrelated tenant for the cross-tenant check, are built inside this suite's own database.
const tenant = newSyntheticTenant('gc');
const otherTenant = newSyntheticTenant('gc-other');
const STORE_ID = tenant.siteId;
const OTHER_STORE_ID = otherTenant.siteId;
const LOCATION_ID = tenant.locationId;
const ownerId = randomUUID();
const ownerEmail = `syn-gift-owner-${ownerId}@example.invalid`;
let gateway: Gateway;

before(async () => {
    seedSyntheticTenant(psql, tenant, { gst: true, taxRates: true });
    psql(`UPDATE sites SET tax_inclusive=false WHERE id='${STORE_ID}';`);
    seedSyntheticTenant(psql, otherTenant);
    psql(`INSERT INTO users_custom(id,email,email_verified) VALUES ('${ownerId}','${ownerEmail}',true);
          UPDATE sites SET custom_user_id='${ownerId}' WHERE id='${STORE_ID}';`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
});
afterEach(async () => { await gateway.settle(); });

test('gift-card read and status RPC outages are unavailable, never empty or raw database errors', async () => {
    const missing = new Set(['list_gift_cards', 'check_gift_card_balance', 'gift_card_transactions', 'set_gift_card_status']);
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        const name = call.resource.startsWith('rpc/') ? call.resource.slice(4) : '';
        if (!missing.has(name)) return forward();
        return restJson(404, {
            code: 'PGRST202',
            message: `Could not find the function public.${name} in the schema cache`,
            details: 'synthetic-private-db-detail',
        });
    });
    try {
        const accountId = randomUUID();
        const requests = [
            async () => gateway.request(`/v1/products/gift-cards?store_id=${STORE_ID}`, {
                headers: await signedIdentityHeaders(ownerId, ownerEmail, STORE_ID),
            }),
            async () => gateway.request(`/v1/products/gift-cards/balance?store_id=${STORE_ID}&code=TEST-CODE`, {
                headers: await signedIdentityHeaders(ownerId, ownerEmail, STORE_ID),
            }),
            async () => gateway.request(`/v1/products/gift-cards/${accountId}/transactions?store_id=${STORE_ID}`, {
                headers: await signedIdentityHeaders(ownerId, ownerEmail, STORE_ID),
            }),
            async () => gateway.request(`/v1/products/gift-cards/${accountId}/status`, {
                method: 'POST', headers: { ...await signedIdentityHeaders(ownerId, ownerEmail, STORE_ID), 'Content-Type': 'application/json', 'X-Idempotency-Key': randomUUID() },
                body: JSON.stringify({ store_id: STORE_ID, status: 'held', reason: 'Synthetic outage check' }),
            }),
        ];
        for (const request of requests) {
            const response = await request();
            assert.equal(response.status, 503, response.text);
            assert.equal(response.json?.error?.code, 'GIFT_CARD_SCHEMA_MISSING');
            assert.equal(response.text.includes('synthetic-private-db-detail'), false);
        }
        for (const name of missing) assert.ok(tap.calls.some((call) => call.resource === `rpc/${name}`), `${name} was reached`);
    } finally {
        tap.restore();
    }
});

test('a malformed successful gift-card read cannot be presented as no cards or no match', async () => {
    const malformed = new Set(['list_gift_cards', 'check_gift_card_balance', 'gift_card_transactions']);
    const tap = tapRest(owned.restUrl, async (call, forward) =>
        malformed.has(call.resource.slice(4)) && call.resource.startsWith('rpc/')
            ? restJson(200, null)
            : forward());
    try {
        const accountId = randomUUID();
        const requests = [
            `/v1/products/gift-cards?store_id=${STORE_ID}`,
            `/v1/products/gift-cards/balance?store_id=${STORE_ID}&code=TEST-CODE`,
            `/v1/products/gift-cards/${accountId}/transactions?store_id=${STORE_ID}`,
        ];
        for (const path of requests) {
            const response = await gateway.request(path, { headers: await signedIdentityHeaders(ownerId, ownerEmail, STORE_ID) });
            assert.equal(response.status, 502, response.text);
            assert.equal(response.json?.error?.code, 'INCOMPLETE_UPSTREAM_RESPONSE');
        }
        for (const name of malformed) assert.ok(tap.calls.some((call) => call.resource === `rpc/${name}`), `${name} was reached`);
    } finally {
        tap.restore();
    }
});

test('mounted merchant issue route returns a code only on first commit and refuses cross-store or changed intent', async () => {
    const key = `gift_card.issue:${STORE_ID}:${randomUUID()}`;
    const request = async (storeId: string, amount: number) => gateway.request('/v1/products/gift-cards', {
        method: 'POST', headers: { ...await signedIdentityHeaders(ownerId, ownerEmail, STORE_ID), 'X-Idempotency-Key': key },
        body: JSON.stringify({ store_id: storeId, initial_value: amount, idempotency_key: key }),
    });
    const denied = await request(OTHER_STORE_ID, 75);
    assert.equal(denied.status, 403, denied.text);
    const first = await request(STORE_ID, 75);
    assert.equal(first.status, 201, first.text);
    assert.equal(typeof first.json?.data?.code, 'string');
    assert.equal(first.json?.data?.replayed, false);
    const replay = await request(STORE_ID, 75);
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.json?.data?.id, first.json?.data?.id);
    assert.equal(replay.json?.data?.replayed, true);
    assert.equal('code' in replay.json.data, false, 'a new random code must never be presented for an existing card');
    const changed = await request(STORE_ID, 125);
    assert.equal(changed.status, 409, changed.text);
    const mismatchedKeys = await gateway.request('/v1/products/gift-cards', {
        method: 'POST',
        headers: { ...await signedIdentityHeaders(ownerId, ownerEmail, STORE_ID), 'X-Idempotency-Key': `${key}-header` },
        body: JSON.stringify({ store_id: STORE_ID, initial_value: 75, idempotency_key: `${key}-body` }),
    });
    assert.equal(mismatchedKeys.status, 400, mismatchedKeys.text);
    assert.equal(mismatchedKeys.json?.error?.code, 'IDEMPOTENCY_KEY_CONFLICT');
    assert.equal(psql(`SELECT count(*) FROM gift_card_accounts WHERE site_id='${STORE_ID}' AND metadata->>'issue_idempotency_key'='${key}-body';`), '0');
    assert.equal(psql(`SELECT count(*) FROM gift_card_accounts WHERE site_id='${STORE_ID}' AND metadata->>'issue_idempotency_key'='${key}';`), '1');
    const directDuplicate = psqlExpectError(`INSERT INTO gift_card_accounts
        (site_id, code_hash, code_last4, initial_value, balance, currency, status, metadata)
        VALUES ('${STORE_ID}', encode(extensions.digest('${randomUUID()}', 'sha256'), 'hex'),
            'TEST', 75, 75, 'INR', 'active', jsonb_build_object('issue_idempotency_key', '${key}'));`);
    assert.match(directDuplicate, /gift_card_accounts_site_issue_key_unique/);
    const rollback = readFileSync('database/supabase/rollback/415_gift_card_issue_replay_integrity.rollback.sql', 'utf8');
    assert.match(psqlExpectError(rollback), /Cannot restore the unsafe gift-card issue RPC while cards exist/);
});

test(
    'issue -> balance is a derived ledger projection, redemption is tender (not a discount) at a real checkout order, and refund restore is append-only',
    async () => {
        const suffix = Date.now().toString(36);
        const code = `T15-GC-${suffix}`;

        // --- Issue: 500.00, via the now-fixed issue_gift_card RPC ---
        const issued = psql(`
            SELECT issue_gift_card('${STORE_ID}'::uuid, '${code}', 500.00, 'INR', NULL, '{}'::jsonb, NULL, 't15-issue-req-${suffix}', 't15-issue-idem-${suffix}');
        `);
        const issuedJson = JSON.parse(issued);
        assert.equal(issuedJson.balance, 500, 'newly issued card must expose the full initial value as balance');
        const accountId = issuedJson.id as string;

        // --- Ledger-projection proof: gift_card_accounts.balance is written once at issuance
        // and never independently mutated; the authoritative figure is always the SUM over
        // gift_card_ledger_entries. Prove both facts live. ---
        const projected = psql(`SELECT gift_card_available_balance('${accountId}'::uuid, '${STORE_ID}'::uuid);`);
        assert.equal(Number(projected), 500, 'gift_card_available_balance must derive the same figure as the issuance response');
        const mutators = psql(`
            SELECT count(*) FROM pg_proc p
             WHERE p.prokind = 'f'
               AND pg_get_functiondef(p.oid) ~ 'UPDATE\\s+gift_card_accounts\\s+SET[^;]*\\bbalance\\s*='
        `);
        assert.equal(mutators, '0', 'no function may UPDATE gift_card_accounts.balance -- it must stay a write-once mirror of the ledger');

        // --- Idempotency: a same-payload retry returns the original card without a new
        // code. A changed-payload retry is a conflict, not a second issue. ---
        const replayIssue = psql(`
            SELECT issue_gift_card('${STORE_ID}'::uuid, '${code}-DIFFERENT', 500.00, 'INR', NULL, '{}'::jsonb, NULL, 't15-issue-req-${suffix}-replay', 't15-issue-idem-${suffix}');
        `);
        const replayJson = JSON.parse(replayIssue);
        assert.equal(replayJson.id, accountId, 'replayed issue idempotency key must return the same account');
        assert.equal(replayJson.balance, 500, 'replay must not apply the different amount from the retried call');
        assert.equal(replayJson.replayed, true, 'replay must be explicitly marked so no fresh code is disclosed');
        const conflict = psqlExpectError(`
            SELECT issue_gift_card('${STORE_ID}'::uuid, '${code}-CHANGED', 999.00, 'INR', NULL, '{}'::jsonb, NULL, 't15-issue-req-${suffix}-conflict', 't15-issue-idem-${suffix}');
        `);
        assert.match(conflict, /gift card issue intent conflict/);
        const cardCount = psql(`SELECT count(*) FROM gift_card_accounts WHERE id = '${accountId}'::uuid;`);
        assert.equal(cardCount, '1', 'idempotent replay must not create a second row');

        // --- Redeem as TENDER at a real checkout order (create_checkout_order), on a product
        // taxed at 18% GST, proving GST is computed on the pre-gift-card grand total. ---
        const productId = randomUUID();
        psql(`
            INSERT INTO products (id, store_id, name, price, sku, is_active, created_at, updated_at)
            VALUES ('${productId}', '${STORE_ID}', 'T15 Autotest Product ${suffix}', 1000.00, 'T15-AUTOTEST-${suffix}', true, now(), now());
        `);
        psql(`
            INSERT INTO inventory_levels (id, store_id, product_id, variant_id, location_id, available, reserved, committed_quantity, available_quantity, reserved_quantity, on_hand_quantity, created_at, updated_at)
            VALUES (gen_random_uuid(), '${STORE_ID}', '${productId}', NULL, '${LOCATION_ID}', 10, 0, 0, 10, 0, 10, now(), now());
        `);

        const orderResult = psql(`
            SELECT create_checkout_order(
                '${STORE_ID}'::uuid, 'T15 Autotest', 't15-autotest-${suffix}@example.invalid', '9000000060',
                '{"line1":"Test","city":"Test","state":"Karnataka","state_code":"29"}'::jsonb,
                '[{"product_id":"${productId}","quantity":1}]'::jsonb,
                'cod', NULL, NULL, '${code}', 'standard',
                't15-redeem-idem-${suffix}', NULL, 't15-redeem-req-${suffix}',
                NULL, 180.00, '29',
                '[{"title":"CGST","rate":9,"amount":90,"jurisdiction":{"supply_type":"intra_state"}},{"title":"SGST","rate":9,"amount":90,"jurisdiction":{"supply_type":"intra_state"}}]'::jsonb
            );
        `);
        const orderJson = JSON.parse(orderResult);
        const orderId = orderJson.id as string;
        const session = psql(`
            SELECT tax_total, discount_total, gift_card_total, grand_total, metadata->>'payment_due'
            FROM checkout_sessions WHERE order_id = '${orderId}'::uuid;
        `);
        const [sessTax, sessDiscount, sessGiftCardTotal, sessGrandTotal, sessPaymentDue] = session.split('|');
        // grand_total = 1000 + 180 tax = 1180; gift card covers 500 of it -> payment_due 680.
        assert.equal(sessTax, '180.00');
        assert.equal(sessGrandTotal, '1180.00', 'GST must be computed on the pre-gift-card grand total (tender, not discount)');
        assert.equal(sessGiftCardTotal, '500.00', 'the full available balance must be redeemed as tender when it does not exceed the total');
        assert.equal(sessPaymentDue, '680.00', 'payment due must be grand_total minus the gift card tender');
        assert.equal(orderJson.total, 680, 'orders.total mirrors payment_due, the amount still payable');
        // Confirm the tender-vs-discount treatment: discount_total (coupon path) is untouched by
        // the gift card -- the gift card is not folded into `discount`.
        assert.equal(sessDiscount, '0.00');

        const balanceAfterRedeem = psql(`SELECT gift_card_available_balance('${accountId}'::uuid, '${STORE_ID}'::uuid);`);
        assert.equal(Number(balanceAfterRedeem), 0, 'balance must be fully consumed after redeeming the whole card value');

        // --- Idempotency: replaying the exact same order idempotency key must return the same
        // order and must not double-debit the gift card. ---
        const replayOrder = psql(`
            SELECT create_checkout_order(
                '${STORE_ID}'::uuid, 'T15 Autotest', 't15-autotest-${suffix}@example.invalid', '9000000060',
                '{"line1":"Test","city":"Test","state":"Karnataka","state_code":"29"}'::jsonb,
                '[{"product_id":"${productId}","quantity":1}]'::jsonb,
                'cod', NULL, NULL, '${code}', 'standard',
                't15-redeem-idem-${suffix}', NULL, 't15-redeem-req-${suffix}-replay',
                NULL, 180.00, '29',
                '[{"title":"CGST","rate":9,"amount":90,"jurisdiction":{"supply_type":"intra_state"}},{"title":"SGST","rate":9,"amount":90,"jurisdiction":{"supply_type":"intra_state"}}]'::jsonb
            );
        `);
        const replayOrderJson = JSON.parse(replayOrder);
        assert.equal(replayOrderJson.id, orderId, 'replayed order idempotency key must return the same order');
        const debitCount = psql(`
            SELECT count(*) FROM gift_card_ledger_entries
             WHERE gift_card_account_id = '${accountId}'::uuid AND entry_type = 'debit';
        `);
        assert.equal(debitCount, '1', 'idempotency replay must not create a second debit entry');

        // --- Refund restore: append-only, never an in-place reversal of the debit row. ---
        const restore = psql(`SELECT restore_gift_card_on_refund('${STORE_ID}'::uuid, '${orderId}'::uuid, NULL, 't15-restore-req-${suffix}');`);
        const restoreJson = JSON.parse(restore);
        assert.equal(restoreJson.restored_total, 500);
        const balanceAfterRestore = psql(`SELECT gift_card_available_balance('${accountId}'::uuid, '${STORE_ID}'::uuid);`);
        assert.equal(Number(balanceAfterRestore), 500, 'balance must be fully restored after refund');
        const ledgerRows = psql(`
            SELECT count(*) FROM gift_card_ledger_entries WHERE gift_card_account_id = '${accountId}'::uuid;
        `);
        assert.equal(ledgerRows, '3', 'issued + debit + refund_credit -- the debit row itself must never be updated or deleted');
        const debitStillThere = psql(`
            SELECT amount FROM gift_card_ledger_entries
             WHERE gift_card_account_id = '${accountId}'::uuid AND entry_type = 'debit';
        `);
        assert.equal(debitStillThere, '500.00', 'the original debit entry must remain unchanged, proving restore is additive');

        // --- Idempotency: replaying the restore call must not double-credit. ---
        const replayRestore = psql(`SELECT restore_gift_card_on_refund('${STORE_ID}'::uuid, '${orderId}'::uuid, NULL, 't15-restore-req-${suffix}-replay');`);
        const replayRestoreJson = JSON.parse(replayRestore);
        assert.equal(replayRestoreJson.restored_count, 0, 'a redemption already released must not be restored twice');
        const balanceAfterReplayRestore = psql(`SELECT gift_card_available_balance('${accountId}'::uuid, '${STORE_ID}'::uuid);`);
        assert.equal(Number(balanceAfterReplayRestore), 500, 'balance must remain at 500, not 1000, after the replayed restore');
    },
);

test('concurrent issue requests with one intent create one account and one issue entry', async () => {
    const suffix = Date.now().toString(36) + 'issue';
    const key = `t15-concurrent-issue-${suffix}`;
    const issueSql = (label: string) => `SELECT issue_gift_card('${STORE_ID}'::uuid, 'T15-${label}-${suffix}', 125.00, 'INR', NULL, '{}'::jsonb, NULL, 't15-${label}-${suffix}', '${key}');`;

    const [first, second] = await Promise.all([psqlAsync(issueSql('one')), psqlAsync(issueSql('two'))]);
    const a = JSON.parse(first);
    const b = JSON.parse(second);
    assert.equal(a.id, b.id, 'both callers must resolve to one card');
    assert.deepEqual([a.replayed, b.replayed].sort(), [false, true]);
    assert.equal(psql(`SELECT count(*) FROM gift_card_accounts WHERE site_id='${STORE_ID}' AND metadata->>'issue_idempotency_key'='${key}';`), '1');
    assert.equal(psql(`SELECT count(*) FROM gift_card_ledger_entries WHERE gift_card_account_id='${a.id}' AND entry_type='issued';`), '1');
});

test(
    'a disabled card is refused, over-redemption is capped at the order total, and cross-tenant redemption sees nothing',
    async () => {
        const suffix = Date.now().toString(36) + 'b';
        const productId = randomUUID();
        psql(`
            INSERT INTO products (id, store_id, name, price, sku, is_active, created_at, updated_at)
            VALUES ('${productId}', '${STORE_ID}', 'T15 Autotest Product B ${suffix}', 200.00, 'T15-AUTOTEST-B-${suffix}', true, now(), now());
            UPDATE products SET charge_tax=false WHERE id='${productId}';
        `);
        psql(`
            INSERT INTO inventory_levels (id, store_id, product_id, variant_id, location_id, available, reserved, committed_quantity, available_quantity, reserved_quantity, on_hand_quantity, created_at, updated_at)
            VALUES (gen_random_uuid(), '${STORE_ID}', '${productId}', NULL, '${LOCATION_ID}', 10, 0, 0, 10, 0, 10, now(), now());
        `);

        function placeOrder(code: string, idemSuffix: string): string {
            return psql(`
                SELECT create_checkout_order(
                    '${STORE_ID}'::uuid, 'T15 Autotest', 't15-autotest-b-${idemSuffix}@example.invalid', '9000000061',
                    '{"line1":"Test","city":"Test","state":"Karnataka","state_code":"29"}'::jsonb,
                    '[{"product_id":"${productId}","quantity":1}]'::jsonb,
                    'cod', NULL, NULL, '${code}', 'standard',
                    't15-order-idem-${idemSuffix}', NULL, 't15-order-req-${idemSuffix}',
                    NULL, 0, '29', '[]'::jsonb
                );
            `);
        }

        // --- Disabled card is refused ---
        const disabledCode = `T15-DIS-${suffix}`;
        const disabledIssued = JSON.parse(psql(`
            SELECT issue_gift_card('${STORE_ID}'::uuid, '${disabledCode}', 100.00, 'INR', NULL, '{}'::jsonb, NULL, 't15-issue-dis-req-${suffix}', 't15-issue-dis-idem-${suffix}');
        `));
        psql(`SELECT set_gift_card_status('${STORE_ID}'::uuid, '${disabledIssued.id}'::uuid, 'disabled', 't15 test', NULL, 't15-disable-req-${suffix}');`);
        const disabledOrderErr = psqlExpectError(`
            SELECT create_checkout_order(
                '${STORE_ID}'::uuid, 'T15 Autotest', 't15-autotest-dis-${suffix}@example.invalid', '9000000062',
                '{"line1":"Test","city":"Test","state":"Karnataka","state_code":"29"}'::jsonb,
                '[{"product_id":"${productId}","quantity":1}]'::jsonb,
                'cod', NULL, NULL, '${disabledCode}', 'standard',
                't15-order-dis-idem-${suffix}', NULL, 't15-order-dis-req-${suffix}',
                NULL, 0, '29', '[]'::jsonb
            );
        `);
        assert.match(disabledOrderErr, /gift card is invalid or unavailable/);
        const disabledOrderCount = psql(`SELECT count(*) FROM checkout_sessions WHERE idempotency_key = 't15-order-dis-idem-${suffix}';`);
        assert.equal(disabledOrderCount, '0', 'a refused gift card must not leave a partial checkout session behind');

        // --- Over-redemption is capped at the order total, never negative and never more than
        // the card is worth ---
        const bigCode = `T15-BIG-${suffix}`;
        JSON.parse(psql(`
            SELECT issue_gift_card('${STORE_ID}'::uuid, '${bigCode}', 5000.00, 'INR', NULL, '{}'::jsonb, NULL, 't15-issue-big-req-${suffix}', 't15-issue-big-idem-${suffix}');
        `));
        const overOrder = JSON.parse(placeOrder(bigCode, `over-${suffix}`));
        const overSession = psql(`
            SELECT gift_card_total FROM checkout_sessions WHERE order_id = '${overOrder.id}'::uuid;
        `);
        assert.equal(overSession, '200.00', 'redemption must cap at the order total (200), not the card face value (5000)');
        assert.equal(overOrder.total, 0);

        // --- Cross-tenant: the same code, redeemed against a DIFFERENT site_id, must see
        // nothing and refuse (site-scoped code_hash lookup) ---
        const crossProductId = randomUUID();
        psql(`
            INSERT INTO products (id, store_id, name, price, sku, is_active, created_at, updated_at)
            VALUES ('${crossProductId}', '${OTHER_STORE_ID}', 'T15 Cross-tenant Product ${suffix}', 50.00, 'T15-CROSS-${suffix}', true, now(), now());
        `);
        const crossLocation = psql(`SELECT id FROM inventory_locations WHERE store_id = '${OTHER_STORE_ID}' AND deleted_at IS NULL LIMIT 1;`);
        if (crossLocation) {
            psql(`
                INSERT INTO inventory_levels (id, store_id, product_id, variant_id, location_id, available, reserved, committed_quantity, available_quantity, reserved_quantity, on_hand_quantity, created_at, updated_at)
                VALUES (gen_random_uuid(), '${OTHER_STORE_ID}', '${crossProductId}', NULL, '${crossLocation}', 10, 0, 0, 10, 0, 10, now(), now());
            `);
            const crossErr = psqlExpectError(`
                SELECT create_checkout_order(
                    '${OTHER_STORE_ID}'::uuid, 'T15 Cross', 't15-cross-${suffix}@example.invalid', '9000000063',
                    '{"line1":"Test","city":"Test","state":"Karnataka","state_code":"29"}'::jsonb,
                    '[{"product_id":"${crossProductId}","quantity":1}]'::jsonb,
                    'cod', NULL, NULL, '${bigCode}', 'standard',
                    't15-cross-idem-${suffix}', NULL, 't15-cross-req-${suffix}',
                    NULL, 0, '29', '[]'::jsonb
                );
            `);
            assert.match(crossErr, /gift card is invalid or unavailable/, 'a card issued for one tenant must be invisible to a checkout on another tenant');
        }
        const crossRedemptionRows = psql(`
            SELECT count(*) FROM gift_card_redemptions gcr
            JOIN gift_card_accounts gca ON gca.id = gcr.gift_card_account_id
            WHERE gca.site_id = '${STORE_ID}'::uuid AND gcr.site_id = '${OTHER_STORE_ID}'::uuid;
        `);
        assert.equal(crossRedemptionRows, '0', 'no redemption row may ever cross a tenant boundary');
    },
);

test(
    'genuine concurrent double-redemption of the same gift card is refused by the FOR UPDATE lock, not by application luck',
    async () => {
        const suffix = Date.now().toString(36) + 'c';
        const code = `T15-RACE-${suffix}`;
        const issued = JSON.parse(psql(`
            SELECT issue_gift_card('${STORE_ID}'::uuid, '${code}', 150.00, 'INR', NULL, '{}'::jsonb, NULL, 't15-issue-race-req-${suffix}', 't15-issue-race-idem-${suffix}');
        `));
        const accountId = issued.id as string;

        const productAId = randomUUID();
        const productBId = randomUUID();
        for (const [pid, label] of [[productAId, 'A'], [productBId, 'B']] as const) {
            psql(`
                INSERT INTO products (id, store_id, name, price, sku, is_active, created_at, updated_at)
                VALUES ('${pid}', '${STORE_ID}', 'T15 Race ${label} ${suffix}', 150.00, 'T15-RACE-${label}-${suffix}', true, now(), now());
                UPDATE products SET charge_tax=false WHERE id='${pid}';
            `);
            psql(`
                INSERT INTO inventory_levels (id, store_id, product_id, variant_id, location_id, available, reserved, committed_quantity, available_quantity, reserved_quantity, on_hand_quantity, created_at, updated_at)
                VALUES (gen_random_uuid(), '${STORE_ID}', '${pid}', NULL, '${LOCATION_ID}', 10, 0, 0, 10, 0, 10, now(), now());
            `);
        }

        function orderSql(pid: string, label: string): string {
            return `
                SELECT create_checkout_order(
                    '${STORE_ID}'::uuid, 'T15 Race ${label}', 't15-race-${label}-${suffix}@example.invalid', '900000006${label === 'A' ? 4 : 5}',
                    '{"line1":"Test","city":"Test","state":"Karnataka","state_code":"29"}'::jsonb,
                    '[{"product_id":"${pid}","quantity":1}]'::jsonb,
                    'cod', NULL, NULL, '${code}', 'standard',
                    't15-race-idem-${label}-${suffix}', NULL, 't15-race-req-${label}-${suffix}',
                    NULL, 0, '29', '[]'::jsonb
                );
            `;
        }

        // Two real, concurrent OS processes launched via spawn (not sequential awaits), racing
        // the SAME gift_card_accounts FOR UPDATE lock inside Postgres for the same 150-balance
        // card against two DIFFERENT orders, each worth exactly 150.
        const results = await Promise.allSettled([
            psqlAsync(orderSql(productAId, 'A')),
            psqlAsync(orderSql(productBId, 'B')),
        ]);

        const succeeded = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<string>[];
        // The lock serializes the two transactions; both may succeed (first drains the balance
        // to 0, second then redeems 0 and is rejected by "no redeemable balance") but the total
        // redeemed across both must never exceed the card's 150 balance.
        const redemptions = psql(`
            SELECT COALESCE(SUM(amount), 0) FROM gift_card_redemptions
             WHERE gift_card_account_id = '${accountId}'::uuid AND status = 'committed';
        `);
        assert.equal(Number(redemptions), 150, 'total redeemed across the concurrent race must equal exactly the card balance, never double-spent');

        const finalBalance = psql(`SELECT gift_card_available_balance('${accountId}'::uuid, '${STORE_ID}'::uuid);`);
        assert.equal(Number(finalBalance), 0, 'balance must never go negative under concurrent redemption');
        assert.ok(succeeded.length >= 1, 'at least one of the two concurrent orders must succeed');
    },
);
