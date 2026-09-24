// APPID-P3 — migration 255, proven on real Postgres: buyer ownership needs a verified buyer, and every
// ownership edge is explicit and audited.
//
// The scenario the migration exists for is played first, end to end: a stranger registers a victim's
// address, never verifies it, and tries every path that used to reach the victim's orders (link the
// store, claim the orders, file a return). Then the same paths are exercised for a verified buyer, and
// the conflict and operator-resolution paths are shown to leave an audit trail. Isolation is checked
// as app_tenant, authenticated and anon, not as the superuser that runs the setup.
//
// DESTRUCTIVE: recreates its own database and replays every migration. Refuses the shared database.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_p3_buyer_ownership';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;

const MIGRATION = 'database/supabase/migrations/255_buyer_verified_ownership_links.sql';
const ROLLBACK = 'database/supabase/rollback/255_buyer_verified_ownership_links.rollback.sql';

const S1 = '11111111-1111-4111-8111-000000000001';
const S2 = '11111111-1111-4111-8111-000000000002';
const S_PORTFOLIO = '11111111-1111-4111-8111-000000000003';
const S_DELETED = '11111111-1111-4111-8111-000000000004';

const ATTACKER = '22222222-2222-4222-8222-00000000000a'; // registered the victim's address, unverified
const BUYER_A = '22222222-2222-4222-8222-00000000000b';  // verified, a@example.com
const BUYER_C = '22222222-2222-4222-8222-00000000000c';  // verified, c@example.com
const BUYER_U = '22222222-2222-4222-8222-00000000000d';  // unverified, u@example.com
const BUYER_OFF = '22222222-2222-4222-8222-00000000000e'; // disabled, verified
const OPERATOR = '99999999-9999-4999-8999-000000000001';

const SC_VICTIM_S1 = '33333333-3333-4333-8333-000000000001';
const SC_C_S2 = '33333333-3333-4333-8333-000000000002';

const O_VICTIM_S1 = '44444444-4444-4444-8444-000000000001';
const O_VICTIM_S2 = '44444444-4444-4444-8444-000000000002';
const O_A_S1 = '44444444-4444-4444-8444-000000000003';
const O_A_S2 = '44444444-4444-4444-8444-000000000004';
const O_GIFT = '44444444-4444-4444-8444-000000000005';   // A's checkout, contact email c@example.com
const O_FRESH = '44444444-4444-4444-8444-000000000006';
const O_STALE = '44444444-4444-4444-8444-000000000007';
const O_U_FRESH = '44444444-4444-4444-8444-000000000008';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ).trim();
}

function psqlError(sql) {
    try {
        psql(sql);
        return null;
    } catch (error) {
        return `${error.stderr || ''}${error.stdout || ''}`;
    }
}

const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (relativePath) => psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));
const lastLine = (out) => out.split('\n').map((l) => l.trim()).filter(Boolean).at(-1) || '';

function listMigrations() {
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((n) => n.endsWith('.sql'))
        .sort((a, b) => {
            const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
            const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
            return na - nb || a.localeCompare(b);
        });
}

function bootstrapDatabase() {
    psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
    for (const name of listMigrations()) {
        try {
            applySqlFile(`database/supabase/migrations/${name}`);
        } catch (error) {
            throw new Error(`migration ${name} failed to apply: ${error.message}`);
        }
    }
}

function order(id, site, email, createdAt = 'now()') {
    return `(${q(id)}::uuid, ${q(site)}::uuid, ${q(site)}::uuid, ${q(`ORD-${id.slice(-4)}`)}, ${q(email)}, '{}'::jsonb, '[]'::jsonb, 1000, 1000, 'paid', ${createdAt})`;
}

function seedFixtures() {
    psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published) VALUES
      (${q(S1)}::uuid, 'Store One', 'Store One', 'store', 'store-one', true),
      (${q(S2)}::uuid, 'Store Two', 'Store Two', 'store', 'store-two', true),
      (${q(S_PORTFOLIO)}::uuid, 'Folio', 'Folio', 'portfolio', 'folio', true),
      (${q(S_DELETED)}::uuid, 'Gone', 'Gone', 'store', 'gone', true);
    UPDATE public.sites SET deleted_at = now() WHERE id = ${q(S_DELETED)}::uuid;

    INSERT INTO public.buyer_accounts (id, email, email_verified, status) VALUES
      (${q(ATTACKER)}::uuid, 'v@example.com', false, 'active'),
      (${q(BUYER_A)}::uuid, 'a@example.com', true, 'active'),
      (${q(BUYER_C)}::uuid, 'c@example.com', true, 'active'),
      (${q(BUYER_U)}::uuid, 'u@example.com', false, 'active'),
      (${q(BUYER_OFF)}::uuid, 'off@example.com', true, 'disabled');

    -- The victim shopped as a guest at both stores, with the case and spacing a real form produces.
    INSERT INTO public.store_customers (id, store_id, email) VALUES
      (${q(SC_VICTIM_S1)}::uuid, ${q(S1)}::uuid, 'V@Example.com'),
      (${q(SC_C_S2)}::uuid, ${q(S2)}::uuid, 'c@example.com');

    INSERT INTO public.orders
      (id, store_id, site_id, order_number, customer_email, shipping_address, items, subtotal, total, payment_status, created_at)
    VALUES
      ${order(O_VICTIM_S1, S1, 'v@example.com', "now() - interval '10 days'")},
      ${order(O_VICTIM_S2, S2, ' V@example.com ', "now() - interval '9 days'")},
      ${order(O_A_S1, S1, 'a@example.com', "now() - interval '8 days'")},
      ${order(O_A_S2, S2, 'A@EXAMPLE.COM', "now() - interval '7 days'")},
      ${order(O_GIFT, S1, 'c@example.com')},
      ${order(O_FRESH, S1, 'a@example.com')},
      ${order(O_STALE, S1, 'a@example.com', "now() - interval '1 hour'")},
      ${order(O_U_FRESH, S2, 'u@example.com')};
  `);
}

const rpc = (fn, args) => JSON.parse(lastLine(psql(`SET ROLE service_role; SELECT public.${fn}(${args})::text;`)));
const returnFor = (buyer, orderId) => lastLine(psql(
    `SET ROLE service_role; SELECT count(*) FROM public.request_order_return(${q(buyer)}::uuid, ${q(orderId)}::uuid, 'defective', NULL);`,
));
const ownerOf = (orderId) => lastLine(psql(`SELECT coalesce(buyer_account_id::text, '') FROM public.buyer_order_links WHERE order_id = ${q(orderId)}::uuid;`));
const auditCount = (action, where = 'true') => Number(lastLine(psql(
    `SELECT count(*) FROM public.audit_logs WHERE action = ${q(action)} AND ${where};`,
)));

after(() => {
    if (!runnable) return;
    try {
        psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres');
    } catch {
        // A cleanup failure must not fail an otherwise passing suite.
    }
});

before(() => {
    if (!runnable) return;
    bootstrapDatabase();
    seedFixtures();
});

const skip = runnable ? false : `refusing to recreate the shared database '${SHARED_DATABASE}'`;

// Reproduce, then fix: on a database stopped at 254 the takeover works exactly as the header of 255
// describes. Then 255 is applied to that same database and the same call is refused. Without the
// first half, the rest of this suite could pass against a defect that never existed.
test('before 255 an unverified stranger files a return on the victim\'s order; after 255 the same call is refused', { skip }, () => {
    const pre = `${databaseName}_pre255`;
    const psqlPre = (sql) => psql(sql, pre);
    psql(`DROP DATABASE IF EXISTS "${pre}"; CREATE DATABASE "${pre}";`, 'postgres');
    try {
        psqlPre(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
        for (const name of listMigrations().filter((n) => parseInt(n, 10) < 255)) {
            psqlPre(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8')));
        }
        psqlPre(`
          INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
          VALUES (${q(S1)}::uuid, 'Store One', 'Store One', 'store', 'store-one', true);
          INSERT INTO public.buyer_accounts (id, email, email_verified, status)
          VALUES (${q(ATTACKER)}::uuid, 'v@example.com', false, 'active');
          INSERT INTO public.store_customers (id, store_id, email)
          VALUES (${q(SC_VICTIM_S1)}::uuid, ${q(S1)}::uuid, 'V@Example.com');
          INSERT INTO public.orders
            (id, store_id, site_id, order_number, customer_email, shipping_address, items, subtotal, total, payment_status, created_at)
          VALUES ${order(O_VICTIM_S1, S1, 'v@example.com')};
          -- Exactly what /buyer/link-store-customer inserted for an unverified buyer before APPID-P3.
          INSERT INTO public.buyer_store_customers (buyer_account_id, store_customer_id, site_id)
          VALUES (${q(ATTACKER)}::uuid, ${q(SC_VICTIM_S1)}::uuid, ${q(S1)}::uuid);
        `);
        const call = `SET ROLE service_role; SELECT count(*) FROM public.request_order_return(${q(ATTACKER)}::uuid, ${q(O_VICTIM_S1)}::uuid, 'defective', NULL);`;
        assert.equal(lastLine(psqlPre(call)), '1', 'the defect did not reproduce at 254; the suite would be proving nothing');
        psqlPre(`DELETE FROM public.return_requests WHERE order_id = ${q(O_VICTIM_S1)}::uuid;`);

        psqlPre(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, MIGRATION), 'utf8')));
        assert.equal(lastLine(psqlPre(call)), '0', 'after 255 the unverified stranger still reached the victim\'s order');
    } finally {
        try { psql(`DROP DATABASE IF EXISTS "${pre}" WITH (FORCE);`, 'postgres'); } catch { /* cleanup only */ }
    }
});

test('an unverified account holding the victim\'s address reaches nothing', { skip }, () => {
    assert.deepEqual(rpc('link_buyer_store_customer', `${q(ATTACKER)}::uuid, ${q(S1)}::uuid`), { outcome: 'unverified' });
    assert.equal(lastLine(psql(`SELECT count(*) FROM public.buyer_store_customers WHERE buyer_account_id = ${q(ATTACKER)}::uuid;`)), '0');
    assert.equal(auditCount('buyer_store_link.refused_unverified', `actor_id = ${q(ATTACKER)}::uuid`), 1);

    assert.deepEqual(rpc('claim_buyer_orders', `${q(ATTACKER)}::uuid, NULL`), { outcome: 'unverified' });
    assert.equal(ownerOf(O_VICTIM_S1), '');
    assert.equal(ownerOf(O_VICTIM_S2), '');

    assert.equal(returnFor(ATTACKER, O_VICTIM_S1), '0', 'a return against the victim\'s order was accepted');
});

test('a link written the pre-255 way is inert: it no longer proves ownership of anything', { skip }, () => {
    // Exactly what /buyer/link-store-customer used to insert for an unverified buyer.
    psql(`INSERT INTO public.buyer_store_customers (buyer_account_id, store_customer_id, site_id)
          VALUES (${q(ATTACKER)}::uuid, ${q(SC_VICTIM_S1)}::uuid, ${q(S1)}::uuid);`);
    assert.equal(lastLine(psql(`SELECT link_basis || '|' || (verified_at IS NULL) FROM public.buyer_store_customers WHERE store_customer_id = ${q(SC_VICTIM_S1)}::uuid;`)), 'legacy_unverified|true');
    assert.equal(returnFor(ATTACKER, O_VICTIM_S1), '0', 'the legacy link still reached the victim\'s order');
});

test('a verified buyer links a store, idempotently, and the link is audited', { skip }, () => {
    const first = rpc('link_buyer_store_customer', `${q(BUYER_A)}::uuid, ${q(S1)}::uuid`);
    assert.equal(first.outcome, 'linked');
    assert.equal(lastLine(psql(`SELECT email FROM public.store_customers WHERE id = ${q(first.store_customer_id)}::uuid;`)), 'a@example.com');
    assert.equal(lastLine(psql(`SELECT link_basis || '|' || (verified_at IS NOT NULL) FROM public.buyer_store_customers WHERE store_customer_id = ${q(first.store_customer_id)}::uuid;`)), 'verified_email|true');
    assert.deepEqual(rpc('link_buyer_store_customer', `${q(BUYER_A)}::uuid, ${q(S1)}::uuid`), { outcome: 'already_linked', store_customer_id: first.store_customer_id });
    assert.equal(auditCount('buyer_store_link.linked', `actor_id = ${q(BUYER_A)}::uuid AND actor_type = 'buyer'`), 1);
    // Audit metadata carries ids, never an address.
    assert.equal(lastLine(psql(`SELECT count(*) FROM public.audit_logs WHERE metadata::text ILIKE '%@example.com%';`)), '0');
});

test('stores that are not live stores cannot be linked, and disabled buyers link nothing', { skip }, () => {
    assert.deepEqual(rpc('link_buyer_store_customer', `${q(BUYER_A)}::uuid, ${q(S_PORTFOLIO)}::uuid`), { outcome: 'store_unavailable' });
    assert.deepEqual(rpc('link_buyer_store_customer', `${q(BUYER_A)}::uuid, ${q(S_DELETED)}::uuid`), { outcome: 'store_unavailable' });
    assert.deepEqual(rpc('link_buyer_store_customer', `${q(BUYER_OFF)}::uuid, ${q(S1)}::uuid`), { outcome: 'buyer_unavailable' });
});

test('a verified claim takes the buyer\'s own orders across stores and nothing else', { skip }, () => {
    const claimed = rpc('claim_buyer_orders', `${q(BUYER_A)}::uuid, NULL`);
    // O_A_S1, O_A_S2, O_FRESH and O_STALE carry a@example.com in some case; nothing else does.
    assert.deepEqual(claimed, { outcome: 'claimed', linked: 4, already_linked: 0, conflicts: 0 });
    for (const id of [O_A_S1, O_A_S2, O_FRESH, O_STALE]) assert.equal(ownerOf(id), BUYER_A);
    for (const id of [O_VICTIM_S1, O_VICTIM_S2, O_GIFT, O_U_FRESH]) assert.equal(ownerOf(id), '');
    assert.deepEqual(rpc('claim_buyer_orders', `${q(BUYER_A)}::uuid, NULL`), { outcome: 'claimed', linked: 0, already_linked: 4, conflicts: 0 });
    assert.equal(returnFor(BUYER_A, O_A_S1), '1');
    assert.equal(returnFor(BUYER_A, O_VICTIM_S1), '0');
});

test('another buyer\'s order is a counted conflict, never a transfer', { skip }, () => {
    // A bought O_GIFT with C's address as the contact. The buyer-session checkout that records this
    // arrives with APPID-P6; the row it will write is seeded here.
    psql(`INSERT INTO public.buyer_order_links (order_id, buyer_account_id, site_id, link_basis)
          VALUES (${q(O_GIFT)}::uuid, ${q(BUYER_A)}::uuid, ${q(S1)}::uuid, 'authenticated_checkout');`);
    const beforeAudit = auditCount('buyer_orders.claimed', `actor_id = ${q(BUYER_C)}::uuid`);
    assert.deepEqual(rpc('claim_buyer_orders', `${q(BUYER_C)}::uuid, NULL`), { outcome: 'claimed', linked: 0, already_linked: 0, conflicts: 1 });
    assert.equal(ownerOf(O_GIFT), BUYER_A);
    assert.equal(auditCount('buyer_orders.claimed', `actor_id = ${q(BUYER_C)}::uuid AND metadata->'conflict_order_ids' ? ${q(O_GIFT)}`), beforeAudit + 1);
});

test('a store link held by another buyer is refused, audited, and resolvable only by an operator', { skip }, () => {
    // Legacy data: C's customer record at S2 linked to A.
    psql(`INSERT INTO public.buyer_store_customers (buyer_account_id, store_customer_id, site_id)
          VALUES (${q(BUYER_A)}::uuid, ${q(SC_C_S2)}::uuid, ${q(S2)}::uuid);`);
    assert.deepEqual(rpc('link_buyer_store_customer', `${q(BUYER_C)}::uuid, ${q(S2)}::uuid`), { outcome: 'conflict' });
    assert.equal(lastLine(psql(`SELECT buyer_account_id FROM public.buyer_store_customers WHERE store_customer_id = ${q(SC_C_S2)}::uuid;`)), BUYER_A);
    assert.equal(auditCount('buyer_store_link.conflict', `resource_id = ${q(SC_C_S2)}::uuid AND metadata->>'linked_buyer_account_id' = ${q(BUYER_A)}`), 1);

    const noReason = psqlError(`SET ROLE service_role; SELECT public.resolve_buyer_store_customer_link(${q(SC_C_S2)}::uuid, ${q(BUYER_C)}::uuid, ${q(OPERATOR)}::uuid, '   ');`);
    assert.match(noReason || '', /reason are required/);

    assert.deepEqual(
        rpc('resolve_buyer_store_customer_link', `${q(SC_C_S2)}::uuid, ${q(BUYER_C)}::uuid, ${q(OPERATOR)}::uuid, 'ticket 1: C proved the address'`),
        { outcome: 'resolved' },
    );
    assert.equal(lastLine(psql(`SELECT buyer_account_id || '|' || link_basis FROM public.buyer_store_customers WHERE store_customer_id = ${q(SC_C_S2)}::uuid;`)), `${BUYER_C}|operator_resolution`);
    assert.equal(auditCount('buyer_store_link.operator_resolved', `actor_id = ${q(OPERATOR)}::uuid AND actor_type = 'employee' AND metadata->>'previous_buyer_account_id' = ${q(BUYER_A)}`), 1);

    assert.deepEqual(
        rpc('resolve_buyer_order_link', `${q(O_GIFT)}::uuid, ${q(BUYER_C)}::uuid, ${q(OPERATOR)}::uuid, 'ticket 2: gift order belongs to C'`),
        { outcome: 'resolved' },
    );
    assert.equal(ownerOf(O_GIFT), BUYER_C);
    assert.equal(auditCount('buyer_order_link.operator_resolved', `resource_id = ${q(O_GIFT)}::uuid AND metadata->>'previous_buyer_account_id' = ${q(BUYER_A)}`), 1);
    // An unverified buyer can never be the target of a resolution.
    assert.deepEqual(
        rpc('resolve_buyer_order_link', `${q(O_GIFT)}::uuid, ${q(BUYER_U)}::uuid, ${q(OPERATOR)}::uuid, 'wrong'`),
        { outcome: 'buyer_unavailable_or_unverified' },
    );
});

test('verifying later upgrades a legacy link for the proven address', { skip }, () => {
    // Suppose the real owner of v@example.com is the one who now proves it.
    psql(`UPDATE public.buyer_accounts SET email_verified = true WHERE id = ${q(ATTACKER)}::uuid;`);
    assert.equal(rpc('link_buyer_store_customer', `${q(ATTACKER)}::uuid, ${q(S1)}::uuid`).outcome, 'linked');
    assert.equal(lastLine(psql(`SELECT link_basis FROM public.buyer_store_customers WHERE store_customer_id = ${q(SC_VICTIM_S1)}::uuid;`)), 'verified_email');
    assert.equal(auditCount('buyer_store_link.verified', `resource_id = ${q(SC_VICTIM_S1)}::uuid`), 1);
    psql(`UPDATE public.buyer_accounts SET email_verified = false WHERE id = ${q(ATTACKER)}::uuid;`);
});

test('the verification time follows the flag, and a changed address is unproven', { skip }, () => {
    assert.equal(lastLine(psql(`SELECT email_verified_at IS NOT NULL FROM public.buyer_accounts WHERE id = ${q(BUYER_A)}::uuid;`)), 't');
    assert.equal(lastLine(psql(`SELECT email_verified_at IS NULL FROM public.buyer_accounts WHERE id = ${q(BUYER_U)}::uuid;`)), 't');
    psql(`UPDATE public.buyer_accounts SET email = 'c2@example.com' WHERE id = ${q(BUYER_C)}::uuid;`);
    assert.equal(lastLine(psql(`SELECT email_verified || '|' || (email_verified_at IS NULL) FROM public.buyer_accounts WHERE id = ${q(BUYER_C)}::uuid;`)), 'false|true');
    psql(`UPDATE public.buyer_accounts SET email = 'c3@example.com', email_verified = true, email_verified_at = now() + interval '1 second' WHERE id = ${q(BUYER_C)}::uuid;`);
    assert.equal(lastLine(psql(`SELECT email_verified FROM public.buyer_accounts WHERE id = ${q(BUYER_C)}::uuid;`)), 't');
});

test('no tenant or API role can read the ownership tables or call the functions', { skip }, () => {
    for (const role of ['app_tenant', 'authenticated', 'anon']) {
        for (const table of ['buyer_order_links', 'buyer_store_customers', 'buyer_accounts']) {
            const denied = psqlError(`BEGIN; SET ROLE ${role}; SELECT set_config('app.site_id', ${q(S1)}, true); SELECT count(*) FROM public.${table}; COMMIT;`);
            assert.match(denied || 'READ SUCCEEDED', /permission denied/, `${role} read ${table}`);
        }
        const exec = psqlError(`BEGIN; SET ROLE ${role}; SELECT set_config('app.site_id', ${q(S1)}, true); SELECT public.claim_buyer_orders(${q(BUYER_A)}::uuid, NULL); COMMIT;`);
        assert.match(exec || 'CALL SUCCEEDED', /permission denied/, `${role} executed claim_buyer_orders`);
    }
    // The merchant's own orders stay readable to the merchant; only the ownership edge is hidden.
    const merchantView = lastLine(psql(`BEGIN; SET ROLE app_tenant; SELECT set_config('app.site_id', ${q(S1)}, true); SELECT count(*) FROM public.orders; COMMIT;`));
    assert.ok(Number(merchantView) > 0, 'app_tenant should still see its own orders');
});

test('the rollback restores the email chain and the migration re-applies', { skip }, () => {
    applySqlFile(ROLLBACK);
    assert.equal(lastLine(psql(`SELECT to_regclass('public.buyer_order_links') IS NULL;`)), 't');
    assert.equal(lastLine(psql(`SELECT count(*) FROM pg_proc WHERE proname = 'request_order_return';`)), '1');
    assert.equal(lastLine(psql(`SELECT count(*) FROM pg_proc WHERE proname IN ('link_buyer_store_customer', 'claim_buyer_orders', 'resolve_buyer_store_customer_link', 'resolve_buyer_order_link');`)), '0');
    // Audit evidence written by 255 survives its rollback.
    assert.ok(auditCount('buyer_store_link.linked') >= 1);
    applySqlFile(MIGRATION);
    assert.equal(lastLine(psql(`SELECT to_regclass('public.buyer_order_links') IS NOT NULL;`)), 't');
    assert.equal(rpc('claim_buyer_orders', `${q(BUYER_A)}::uuid, ${q(S1)}::uuid`).outcome, 'claimed');
});
