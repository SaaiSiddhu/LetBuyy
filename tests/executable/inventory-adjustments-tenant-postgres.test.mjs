// F-TENANT-INV-1 — inventory_adjustments gets a tenant column and a DATABASE backstop.
//
// The claim under test is the Constitution's, not this migration's: missing tenant context must
// produce ZERO ROWS AND NO MUTATION, enforced by RLS + FORCE RLS + the transaction-local
// `app.site_id` GUC — not by a predicate in a route handler that a later edit can drop.
//
// So the shape of this suite is: roll 245 back, show a tenant reading another tenant's adjustment
// history straight out of the database; re-apply, show it cannot. A fence you have never seen
// absent is not a fence you have tested.
//
// It bootstraps pgcrypto into `extensions` (the Supabase layout) rather than `public` like the other
// executable suites — see CAP-C62 and F-SEARCHPATH-1. Nothing here depends on that; it is simply the
// layout production has, and 245 has to apply under it.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_inventory_adjustments_tenant';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/245_inventory_adjustments_tenant_column.sql';
const ROLLBACK = 'database/supabase/rollback/245_inventory_adjustments_tenant_column.rollback.sql';

const SITE_A = '11111111-1111-4111-8111-1111111111a1';
const SITE_B = '22222222-2222-4222-8222-2222222222b2';
const PRODUCT_A = '33333333-3333-4333-8333-3333333333a3';
const PRODUCT_B = '44444444-4444-4444-8444-4444444444b4';
const LOCATION_A = '55555555-5555-4555-8555-5555555555a5';
const LOCATION_B = '66666666-6666-4666-8666-6666666666b6';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    ).trim();
}

function psqlExpectingFailure(sql) {
    try {
        psql(sql);
        return null;
    } catch (error) {
        return `${error.stderr || ''}${error.stdout || ''}`;
    }
}

const sqlString = (v) => `'${String(v).replaceAll("'", "''")}'`;
const lastLine = (out) => out.split('\n').map((l) => l.trim()).filter(Boolean).at(-1) || '';
const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (relativePath) => psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));

// The tenant probe: run as a non-superuser role, with the transaction-local GUC either set or not.
function scopedCount(role, siteId, where = 'true') {
    const setSite = siteId ? `SELECT set_config('app.site_id', ${sqlString(siteId)}, true);` : '';
    return lastLine(psql(`
        BEGIN;
        SET ROLE ${role};
        ${setSite}
        SELECT count(*) FROM public.inventory_adjustments WHERE ${where};
        RESET ROLE;
        COMMIT;
    `));
}

function scopedMutation(role, siteId, statement) {
    const setSite = siteId ? `SELECT set_config('app.site_id', ${sqlString(siteId)}, true);` : '';
    return psqlExpectingFailure(`
        BEGIN;
        SET ROLE ${role};
        ${setSite}
        ${statement}
        RESET ROLE;
        COMMIT;
    `);
}

function listMigrations() {
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((n) => n.endsWith('.sql'))
        .sort((a, b) => {
            const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
            const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
            return na - nb || a.localeCompare(b);
        });
}

// F-TENANT-INV-1 wrote this bootstrap faithfully by hand; F-HARNESS-1 moved the same three
// fixes into a shared module, so this suite consumes it rather than keeping a second copy.
const BOOTSTRAP_SQL = SUPABASE_FAITHFUL_BOOTSTRAP_SQL;

function bootstrapDatabase() {
    psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(BOOTSTRAP_SQL);
    for (const name of listMigrations()) {
        const sql = stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8'));
        try {
            psql(sql);
        } catch (error) {
            throw new Error(`migration ${name} failed to apply: ${error.message}`);
        }
    }
}

// Seeded BEFORE 245 is rolled back and re-applied, so these rows also exercise the backfill.
function seedFixtures() {
    psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain) VALUES
        (${sqlString(SITE_A)}::uuid, 'Tenant A', 'Tenant A', 'store', 'tenant-a'),
        (${sqlString(SITE_B)}::uuid, 'Tenant B', 'Tenant B', 'store', 'tenant-b');
    INSERT INTO public.products (id, store_id, name, price) VALUES
        (${sqlString(PRODUCT_A)}::uuid, ${sqlString(SITE_A)}::uuid, 'A widget', 100),
        (${sqlString(PRODUCT_B)}::uuid, ${sqlString(SITE_B)}::uuid, 'B widget', 100);
    INSERT INTO public.inventory_locations (id, store_id, name) VALUES
        (${sqlString(LOCATION_A)}::uuid, ${sqlString(SITE_A)}::uuid, 'A warehouse'),
        (${sqlString(LOCATION_B)}::uuid, ${sqlString(SITE_B)}::uuid, 'B warehouse');
    INSERT INTO public.inventory_adjustments (product_id, location_id, quantity_change, reason, note)
    VALUES
        (${sqlString(PRODUCT_A)}::uuid, ${sqlString(LOCATION_A)}::uuid, 5, 'recount', 'A private note'),
        (${sqlString(PRODUCT_B)}::uuid, ${sqlString(LOCATION_B)}::uuid, 7, 'recount', 'B private note');
    `);
}

before(() => {
    if (skip) return;
    bootstrapDatabase();
    seedFixtures();
});

after(() => {
    if (skip) return;
    try { psql(`DROP DATABASE IF EXISTS "${databaseName}";`, 'postgres'); } catch { /* leave it for inspection */ }
});

test('BEFORE: the database imposes no tenant boundary at all on this table', { skip }, () => {
    applySqlFile(ROLLBACK);

    // There is no tenant column to filter on, and RLS is not even forced.
    assert.equal(
        psql(`SELECT count(*) FROM information_schema.columns
              WHERE table_schema='public' AND table_name='inventory_adjustments' AND column_name='store_id';`),
        '0',
    );
    assert.equal(
        psql(`SELECT relforcerowsecurity::text FROM pg_class WHERE oid='public.inventory_adjustments'::regclass;`),
        'false',
    );

    // The role the gateway actually connects as, correctly declaring itself as tenant A, reads
    // tenant B's adjustment note straight out of the database. Nothing but the route's own
    // `.in('products.store_id', ownedStoreIds)` predicate stands between the two tenants.
    assert.equal(scopedCount('service_role', SITE_A), '2');
    assert.equal(
        scopedCount('service_role', SITE_A, `note = ${sqlString('B private note')}`),
        '1',
        'the gateway\'s own role can read another tenant\'s adjustment note',
    );

    // And the table is OUTSIDE the tenant model rather than badly inside it: not one policy on it
    // references the tenant GUC. Migration 164's sweep, which gave every sibling its
    // `app_tenant_guc_*` policy, only covers tables that already have a site_id/store_id column —
    // so it skipped this one, and nothing since has added it back.
    assert.equal(
        psql(`SELECT count(*) FROM pg_policies
              WHERE schemaname='public' AND tablename='inventory_adjustments'
                AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%current_site_id%';`),
        '0',
        'no pre-245 policy references the tenant GUC',
    );

    applySqlFile(MIGRATION);
});

test('AFTER: service_role is still unconstrained — say so rather than over-claim', { skip }, () => {
    // 245 does NOT constrain the gateway's service-role client, and neither does any sibling table's
    // policy set: service_role is BYPASSRLS. What 245 changes is that the tenant-scoped path
    // (SET ROLE app_tenant + app.site_id) now exists for this table and is enforced. The route
    // predicate stays exactly where it was, and it is still doing real work on the service-role path
    // — which is the point of writing this down instead of claiming the leak is closed everywhere.
    assert.equal(psql(`SELECT rolbypassrls::text FROM pg_roles WHERE rolname='service_role';`), 'true');
    assert.equal(scopedCount('service_role', SITE_A), '2', 'service_role still sees both tenants, by design');
});

test('AFTER: each tenant sees only its own rows, and the backfill attributed the pre-existing ones', { skip }, () => {
    // The two rows were inserted before 245 was re-applied, so their store_id came from the backfill.
    assert.equal(psql(`SELECT count(*) FROM public.inventory_adjustments WHERE store_id IS NULL;`), '0');
    assert.equal(
        psql(`SELECT store_id::text FROM public.inventory_adjustments WHERE note = ${sqlString('A private note')};`),
        SITE_A,
    );

    assert.equal(scopedCount('app_tenant', SITE_A), '1');
    assert.equal(scopedCount('app_tenant', SITE_B), '1');
    assert.equal(
        scopedCount('app_tenant', SITE_A, `note = ${sqlString('B private note')}`),
        '0',
        'the cross-tenant read the BEFORE test just demonstrated must now return nothing',
    );
});

test('missing tenant context produces ZERO ROWS AND NO MUTATION', { skip }, () => {
    // The Constitution's wording, tested as two separate claims rather than one.
    assert.equal(scopedCount('app_tenant', null), '0', 'no GUC must read nothing');

    const insertError = scopedMutation('app_tenant', null, `
        INSERT INTO public.inventory_adjustments (product_id, location_id, quantity_change, reason)
        VALUES (${sqlString(PRODUCT_A)}::uuid, ${sqlString(LOCATION_A)}::uuid, 1, 'adjustment');`);
    assert.ok(insertError, 'no GUC must not be able to insert');
    assert.match(insertError, /row-level security/i);

    // A DELETE with no context is the quiet one: it raises nothing, it simply matches no rows.
    scopedMutation('app_tenant', null, `DELETE FROM public.inventory_adjustments;`);
    assert.equal(psql(`SELECT count(*) FROM public.inventory_adjustments;`), '2', 'nothing may be deleted without context');
});

test('a tenant cannot write a row attributed to another tenant', { skip }, () => {
    const error = scopedMutation('app_tenant', SITE_A, `
        INSERT INTO public.inventory_adjustments (store_id, product_id, location_id, quantity_change, reason)
        VALUES (${sqlString(SITE_B)}::uuid, ${sqlString(PRODUCT_B)}::uuid, ${sqlString(LOCATION_B)}::uuid, 1, 'adjustment');`);
    assert.ok(error, 'WITH CHECK must refuse a foreign store_id');
    assert.match(error, /row-level security/i);
    assert.equal(psql(`SELECT count(*) FROM public.inventory_adjustments;`), '2');
});

test('the fill trigger means no writer has to know about store_id', { skip }, () => {
    // All four SQL writers insert without naming store_id. This is why none of them was edited.
    psql(`
        INSERT INTO public.inventory_adjustments (product_id, location_id, quantity_change, reason, note)
        VALUES (${sqlString(PRODUCT_A)}::uuid, ${sqlString(LOCATION_A)}::uuid, 3, 'adjustment', 'trigger filled');`);
    assert.equal(
        psql(`SELECT store_id::text FROM public.inventory_adjustments WHERE note = ${sqlString('trigger filled')};`),
        SITE_A,
    );

    // And the real writer, unmodified by this migration, still produces an attributed row.
    psql(`SELECT public.adjust_inventory_level(
            ${sqlString(PRODUCT_A)}::uuid, NULL, ${sqlString(LOCATION_A)}::uuid, 2, NULL, 'recount', 'via rpc');`);
    assert.equal(
        psql(`SELECT store_id::text FROM public.inventory_adjustments WHERE note = ${sqlString('via rpc')};`),
        SITE_A,
    );

    psql(`DELETE FROM public.inventory_adjustments WHERE note IN (${sqlString('trigger filled')}, ${sqlString('via rpc')});`);
});

test('the app_tenant policy carries migration 164\'s own name, so re-running its sweep is a no-op', { skip }, () => {
    // 164 names its policies 'app_tenant_guc_' || substr(md5(table_name), 1, 16) and skips any table
    // without a site_id/store_id column — which is exactly why this table never got one. If 245 had
    // invented a different name, 164's sweep would later add a SECOND policy beside it.
    const expected = psql(`SELECT 'app_tenant_guc_' || substr(md5('inventory_adjustments'), 1, 16);`);
    const policies = psql(`
        SELECT policyname FROM pg_policies
        WHERE schemaname='public' AND tablename='inventory_adjustments' AND policyname LIKE 'app_tenant_guc_%'
        ORDER BY 1;`).split('\n').filter(Boolean);
    assert.deepEqual(policies, [expected]);

    assert.equal(
        psql(`SELECT relrowsecurity::text || ' ' || relforcerowsecurity::text
              FROM pg_class WHERE oid='public.inventory_adjustments'::regclass;`),
        'true true',
    );
});

test('the migration REFUSES a row it cannot attribute, instead of leaving a NULL tenant', { skip }, () => {
    // products.store_id is nullable, so an adjustment can exist that belongs to no store. Under the
    // new policies such a row would be invisible to every tenant and deletable by none, so 245 stops.
    applySqlFile(ROLLBACK);
    const ORPHAN_PRODUCT = '77777777-7777-4777-8777-777777777777';
    psql(`
        INSERT INTO public.products (id, store_id, name, price) VALUES (${sqlString(ORPHAN_PRODUCT)}::uuid, NULL, 'Storeless', 100);
        INSERT INTO public.inventory_adjustments (product_id, location_id, quantity_change, reason, note)
        VALUES (${sqlString(ORPHAN_PRODUCT)}::uuid, ${sqlString(LOCATION_A)}::uuid, 1, 'adjustment', 'orphan');`);

    const error = psqlExpectingFailure(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, MIGRATION), 'utf8')));
    assert.ok(error, 'migration 245 must refuse to apply while an unattributable row exists');
    assert.match(error, /cannot be attributed to a store/);
    assert.match(error, /^.*migration 245: 1 inventory_adjustments rows/m);

    // The refusal is a transaction, so it left nothing behind: no column, no half-applied policies.
    assert.equal(
        psql(`SELECT count(*) FROM information_schema.columns
              WHERE table_schema='public' AND table_name='inventory_adjustments' AND column_name='store_id';`),
        '0',
        'the failed migration must not leave a partially added column',
    );

    psql(`DELETE FROM public.inventory_adjustments WHERE note = ${sqlString('orphan')};
          DELETE FROM public.products WHERE id = ${sqlString(ORPHAN_PRODUCT)}::uuid;`);
    applySqlFile(MIGRATION);
    assert.equal(scopedCount('app_tenant', SITE_A), '1');
});

test('245 is replayable and its self-verification is load-bearing', { skip }, () => {
    applySqlFile(MIGRATION);
    assert.equal(scopedCount('app_tenant', SITE_A), '1');
    assert.equal(scopedCount('app_tenant', null), '0');

    // Strip FORCE out of a copy and the migration must refuse itself, or the verification block is
    // decoration and a future edit could silently ship an unforced table again. The rollback has to
    // run first: FORCE is already set from the previous apply, so without un-forcing the table the
    // decoy would pass for a reason that has nothing to do with the line removed from it.
    applySqlFile(ROLLBACK);
    assert.equal(
        psql(`SELECT relforcerowsecurity::text FROM pg_class WHERE oid='public.inventory_adjustments'::regclass;`),
        'false',
        'the decoy is only meaningful against an unforced table',
    );
    const decoy = readFileSync(join(repoRoot, MIGRATION), 'utf8')
        .replace('ALTER TABLE public.inventory_adjustments FORCE ROW LEVEL SECURITY;', '');
    const error = psqlExpectingFailure(stripUnsupportedPg17Guc(decoy));
    assert.ok(error, 'a copy of 245 without FORCE must fail its own verification');
    assert.match(error, /RLS enabled AND forced/);

    applySqlFile(MIGRATION);
    assert.equal(scopedCount('app_tenant', SITE_B), '1');
});
