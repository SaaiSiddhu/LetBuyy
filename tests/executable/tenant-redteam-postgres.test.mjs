import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const d2MigrationSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/163_d2_live_data_leak_rls.sql'),
  'utf8',
);
const d4MigrationSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/164_d4_tenant_role_guc.sql'),
  'utf8',
);
const guc198MigrationSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/198_tenant_registry_guc_closure.sql'),
  'utf8',
);

const siteA = '11111111-1111-4111-8111-111111111111';
const siteB = '22222222-2222-4222-8222-222222222222';

const RT_CASES = [
  { id: 'RT-2', table: 'orders', ownerWhere: "id = 'aaaaaaaa-0000-4000-8000-000000000001'::uuid", otherWhere: "id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid" },
  { id: 'RT-3', table: 'product_variants', ownerWhere: "id = 'aaaaaaaa-0000-4000-8000-000000000003'::uuid", otherWhere: "id = 'bbbbbbbb-0000-4000-8000-000000000003'::uuid" },
  { id: 'RT-4', table: 'product_options', ownerWhere: "id = 'aaaaaaaa-0000-4000-8000-000000000004'::uuid", otherWhere: "id = 'bbbbbbbb-0000-4000-8000-000000000004'::uuid" },
  { id: 'RT-5', table: 'sites', ownerWhere: `id = '${siteA}'::uuid`, otherWhere: `id = '${siteB}'::uuid` },
  { id: 'RT-6', table: 'store_customers', ownerWhere: "id = 'aaaaaaaa-0000-4000-8000-000000000005'::uuid", otherWhere: "id = 'bbbbbbbb-0000-4000-8000-000000000005'::uuid" },
  { id: 'RT-7', table: 'wishlists', ownerWhere: "id = 'aaaaaaaa-0000-4000-8000-000000000006'::uuid", otherWhere: "id = 'bbbbbbbb-0000-4000-8000-000000000006'::uuid" },
  { id: 'RT-8', table: 'billing_history', ownerWhere: "id = 'aaaaaaaa-0000-4000-8000-000000000007'::uuid", otherWhere: "id = 'bbbbbbbb-0000-4000-8000-000000000007'::uuid" },
];

function psql(sql, options = {}) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: `SET client_min_messages TO warning;\n${sql}`, encoding: 'utf8', ...options },
  ).trim();
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function lastPsqlLine(output) {
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.at(-1) || '';
}

function scopedCount(role, siteId, table, where = 'true') {
  const setSite = siteId ? `SELECT set_config('app.site_id', ${sqlString(siteId)}, true);` : '';
  return lastPsqlLine(psql(`
    BEGIN;
    SET ROLE ${role};
    ${setSite}
    SELECT count(*) FROM public.${table} WHERE ${where};
    RESET ROLE;
    COMMIT;
  `));
}

function assertRawRestParity(table, ownerWhere) {
  const appTenantCount = scopedCount('app_tenant', siteA, table, ownerWhere);
  const rawRestCount = scopedCount('authenticated', siteA, table, ownerWhere);
  assert.equal(rawRestCount, appTenantCount, `${table} raw-REST authenticated policy must match app_tenant for owner scope`);
}

function resetDatabase() {
  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public;
    CREATE SCHEMA auth;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
        REVOKE app_tenant FROM postgres;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          REVOKE app_tenant FROM service_role;
        END IF;
      END IF;
    END
    $$;

    DROP ROLE IF EXISTS app_tenant;
    DROP ROLE IF EXISTS service_role;
    DROP ROLE IF EXISTS authenticated;
    DROP ROLE IF EXISTS anon;
    CREATE ROLE service_role;
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE OR REPLACE FUNCTION public.current_site_id()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('app.site_id', true), '')::uuid;
    $$;

    CREATE OR REPLACE FUNCTION public.is_super_admin()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    AS $$
      SELECT current_setting('app.is_super_admin', true) = 'true';
    $$;

    CREATE TABLE public.sites (
      id uuid PRIMARY KEY,
      name text NOT NULL
    );
    CREATE TABLE public.orders (
      id uuid PRIMARY KEY,
      site_id uuid,
      store_id uuid,
      total_minor integer NOT NULL DEFAULT 0
    );
    CREATE TABLE public.products (
      id uuid PRIMARY KEY,
      site_id uuid,
      store_id uuid,
      title text NOT NULL
    );
    CREATE TABLE public.product_variants (
      id uuid PRIMARY KEY,
      product_id uuid NOT NULL REFERENCES public.products(id),
      sku text
    );
    CREATE TABLE public.product_options (
      id uuid PRIMARY KEY,
      product_id uuid NOT NULL REFERENCES public.products(id),
      name text
    );
    CREATE TABLE public.store_customers (
      id uuid PRIMARY KEY,
      store_id uuid NOT NULL,
      email text
    );
    CREATE TABLE public.customer_activity_log (
      id uuid PRIMARY KEY,
      store_id uuid NOT NULL,
      event_name text
    );
    CREATE TABLE public.wishlists (
      id uuid PRIMARY KEY,
      store_id uuid NOT NULL,
      customer_id uuid
    );
    CREATE TABLE public.customer_wishlists (
      id uuid PRIMARY KEY,
      store_id uuid NOT NULL,
      customer_id uuid
    );
    CREATE TABLE public.subscriptions (
      id uuid PRIMARY KEY,
      site_id uuid NOT NULL,
      status text
    );
    CREATE TABLE public.billing_history (
      id uuid PRIMARY KEY,
      site_id uuid NOT NULL,
      amount_minor integer NOT NULL DEFAULT 0
    );
    CREATE TABLE public.super_admin_allowlist (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL
    );

    ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.store_customers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.customer_activity_log ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.customer_wishlists ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.super_admin_allowlist ENABLE ROW LEVEL SECURITY;

    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;
  `);
}

function seedTenantRows() {
  psql(`
    INSERT INTO public.sites (id, name)
    VALUES (${sqlString(siteA)}::uuid, 'Site A'), (${sqlString(siteB)}::uuid, 'Site B');

    INSERT INTO public.orders (id, site_id, total_minor)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, ${sqlString(siteA)}::uuid, 1000),
      ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, ${sqlString(siteB)}::uuid, 2000);

    INSERT INTO public.products (id, site_id, title)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, ${sqlString(siteA)}::uuid, 'Owner product'),
      ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, ${sqlString(siteB)}::uuid, 'Other product');

    INSERT INTO public.product_variants (id, product_id, sku)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'owner-sku'),
      ('bbbbbbbb-0000-4000-8000-000000000003'::uuid, 'bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'other-sku');

    INSERT INTO public.product_options (id, product_id, name)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000004'::uuid, 'aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'Owner size'),
      ('bbbbbbbb-0000-4000-8000-000000000004'::uuid, 'bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'Other size');

    INSERT INTO public.store_customers (id, store_id, email)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000005'::uuid, ${sqlString(siteA)}::uuid, 'a@example.test'),
      ('bbbbbbbb-0000-4000-8000-000000000005'::uuid, ${sqlString(siteB)}::uuid, 'b@example.test');

    INSERT INTO public.wishlists (id, store_id, customer_id)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000006'::uuid, ${sqlString(siteA)}::uuid, 'aaaaaaaa-0000-4000-8000-000000000005'::uuid),
      ('bbbbbbbb-0000-4000-8000-000000000006'::uuid, ${sqlString(siteB)}::uuid, 'bbbbbbbb-0000-4000-8000-000000000005'::uuid);

    INSERT INTO public.billing_history (id, site_id, amount_minor)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000007'::uuid, ${sqlString(siteA)}::uuid, 500),
      ('bbbbbbbb-0000-4000-8000-000000000007'::uuid, ${sqlString(siteB)}::uuid, 700);

    INSERT INTO public.customer_activity_log (id, store_id, event_name)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000008'::uuid, ${sqlString(siteA)}::uuid, 'owner'),
      ('bbbbbbbb-0000-4000-8000-000000000008'::uuid, ${sqlString(siteB)}::uuid, 'other');

    INSERT INTO public.customer_wishlists (id, store_id, customer_id)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000009'::uuid, ${sqlString(siteA)}::uuid, 'aaaaaaaa-0000-4000-8000-000000000005'::uuid),
      ('bbbbbbbb-0000-4000-8000-000000000009'::uuid, ${sqlString(siteB)}::uuid, 'bbbbbbbb-0000-4000-8000-000000000005'::uuid);

    INSERT INTO public.subscriptions (id, site_id, status)
    VALUES
      ('aaaaaaaa-0000-4000-8000-000000000010'::uuid, ${sqlString(siteA)}::uuid, 'active'),
      ('bbbbbbbb-0000-4000-8000-000000000010'::uuid, ${sqlString(siteB)}::uuid, 'active');

    INSERT INTO public.super_admin_allowlist (email) VALUES ('arb@example.test');
  `);
}

test('CAP-C11 RT-1 through RT-9 pass under app_tenant and raw-REST roles', () => {
  resetDatabase();
  seedTenantRows();
  psql(d2MigrationSql);
  psql(d4MigrationSql);

  assert.equal(psql("SELECT rolbypassrls FROM pg_roles WHERE rolname = 'app_tenant';"), 'f');
  assert.equal(psql("SELECT pg_has_role('postgres', 'app_tenant', 'member');"), 't');
  assert.equal(psql("SELECT pg_has_role('service_role', 'app_tenant', 'member');"), 't');

  assert.equal(scopedCount('service_role', null, 'orders'), '2', 'RT-1 positive control: service role can see service-owned orders');
  assert.equal(scopedCount('anon', siteA, 'orders'), '0', 'RT-1 anon must not inherit service-role order access');

  for (const { id, table, ownerWhere, otherWhere } of RT_CASES) {
    assert.equal(scopedCount('app_tenant', siteA, table, ownerWhere), '1', `${id} positive control must see owner row first`);
    assert.equal(scopedCount('app_tenant', siteA, table, otherWhere), '0', `${id} app_tenant must deny cross-tenant row`);
    assert.equal(scopedCount('app_tenant', null, table, ownerWhere), '0', `${id} missing app.site_id must fail closed`);
    assert.equal(scopedCount('authenticated', siteA, table, ownerWhere), '1', `${id} raw REST authenticated role must see owner row`);
    assert.equal(scopedCount('authenticated', siteA, table, otherWhere), '0', `${id} raw REST authenticated role must deny forged tenant row`);
    assertRawRestParity(table, ownerWhere);
  }

  assert.throws(
    () => psql(`
      BEGIN;
      SET ROLE authenticated;
      SELECT set_config('app.site_id', ${sqlString(siteA)}, true);
      INSERT INTO public.super_admin_allowlist (email) VALUES ('forged@example.test');
      COMMIT;
    `),
    /permission denied|violates row-level security policy/,
    'RT-9 authenticated users must not be able to self-add super admins',
  );

  assert.equal(
    scopedCount('service_role', null, 'super_admin_allowlist'),
    '1',
    'RT-9 positive control: service role retains explicit allowlist administration access',
  );
});

// ── W1 (migration 198): app_tenant GUC coverage for the 4 tables registered
// by 176/184/185, all of which post-date the 164 dynamic policy loop. Creates
// minimal synthetic mirrors of founding_merchant_allocations, site_domains,
// site_domain_verifications and subscription_coupon_redemptions AFTER 164 has
// already run (matching real migration chronology: 164 predates 176/184/185,
// so its dynamic per-table loop never sees these tables), then proves the
// pre-198 gap is real before applying 198 and proving it is closed.

const gucClosureOwnerRow = {
  founding_merchant_allocations: 'aaaaaaaa-0000-4000-8000-0000000000f1',
  site_domains: 'aaaaaaaa-0000-4000-8000-0000000000f2',
  site_domain_verifications: 'aaaaaaaa-0000-4000-8000-0000000000f3',
  subscription_coupon_redemptions: 'aaaaaaaa-0000-4000-8000-0000000000f4',
};
const gucClosureOtherRow = {
  founding_merchant_allocations: 'bbbbbbbb-0000-4000-8000-0000000000f1',
  site_domains: 'bbbbbbbb-0000-4000-8000-0000000000f2',
  site_domain_verifications: 'bbbbbbbb-0000-4000-8000-0000000000f3',
  subscription_coupon_redemptions: 'bbbbbbbb-0000-4000-8000-0000000000f4',
};
// Mutable tables get INSERT/UPDATE/DELETE granted to app_tenant by 198;
// append-only tables (writes only via a SECURITY DEFINER RPC) get SELECT only.
const GUC_CLOSURE_TABLES = [
  { table: 'founding_merchant_allocations', appendOnly: false },
  { table: 'site_domains', appendOnly: false },
  { table: 'site_domain_verifications', appendOnly: true },
  { table: 'subscription_coupon_redemptions', appendOnly: true },
];

function createGucClosureTables() {
  psql(`
    CREATE TABLE public.founding_merchant_allocations (
      id uuid PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id)
    );
    CREATE TABLE public.site_domains (
      id uuid PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id),
      domain text
    );
    CREATE TABLE public.site_domain_verifications (
      id uuid PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id),
      domain text
    );
    CREATE TABLE public.subscription_coupon_redemptions (
      id uuid PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id)
    );

    ALTER TABLE public.founding_merchant_allocations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.founding_merchant_allocations FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.site_domains ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.site_domains FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.site_domain_verifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.site_domain_verifications FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.subscription_coupon_redemptions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.subscription_coupon_redemptions FORCE ROW LEVEL SECURITY;

    GRANT SELECT, INSERT, UPDATE, DELETE ON
      public.founding_merchant_allocations,
      public.site_domains,
      public.site_domain_verifications,
      public.subscription_coupon_redemptions
      TO service_role;

    -- Mirror the real 176/184/185 "service_role (gateway) + SECURITY DEFINER
    -- RPCs only" policies (this fixture's service_role has no BYPASSRLS — see
    -- 163_d2_live_data_leak_rls.sql — so it needs its own FOR ALL policy).
    CREATE POLICY service_role_founding_merchant_allocations ON public.founding_merchant_allocations
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY service_role_site_domains ON public.site_domains
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY service_role_site_domain_verifications ON public.site_domain_verifications
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY service_role_subscription_coupon_redemptions ON public.subscription_coupon_redemptions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  `);
}

function seedGucClosureRows() {
  psql(`
    INSERT INTO public.founding_merchant_allocations (id, site_id) VALUES
      (${sqlString(gucClosureOwnerRow.founding_merchant_allocations)}::uuid, ${sqlString(siteA)}::uuid),
      (${sqlString(gucClosureOtherRow.founding_merchant_allocations)}::uuid, ${sqlString(siteB)}::uuid);
    INSERT INTO public.site_domains (id, site_id, domain) VALUES
      (${sqlString(gucClosureOwnerRow.site_domains)}::uuid, ${sqlString(siteA)}::uuid, 'a.example.test'),
      (${sqlString(gucClosureOtherRow.site_domains)}::uuid, ${sqlString(siteB)}::uuid, 'b.example.test');
    INSERT INTO public.site_domain_verifications (id, site_id, domain) VALUES
      (${sqlString(gucClosureOwnerRow.site_domain_verifications)}::uuid, ${sqlString(siteA)}::uuid, 'a.example.test'),
      (${sqlString(gucClosureOtherRow.site_domain_verifications)}::uuid, ${sqlString(siteB)}::uuid, 'b.example.test');
    INSERT INTO public.subscription_coupon_redemptions (id, site_id) VALUES
      (${sqlString(gucClosureOwnerRow.subscription_coupon_redemptions)}::uuid, ${sqlString(siteA)}::uuid),
      (${sqlString(gucClosureOtherRow.subscription_coupon_redemptions)}::uuid, ${sqlString(siteB)}::uuid);
  `);
}

test('W1 migration 198 closes the app_tenant GUC gap on founding_merchant_allocations, site_domains, site_domain_verifications and subscription_coupon_redemptions', () => {
  resetDatabase();
  seedTenantRows();
  psql(d2MigrationSql);
  psql(d4MigrationSql);

  // Simulate 176/184/185 running AFTER 164 (real chronology): the tables exist,
  // ENABLE+FORCE is set, but 164's dynamic loop never saw them, so app_tenant
  // has zero matching policies yet.
  createGucClosureTables();
  seedGucClosureRows();

  for (const { table } of GUC_CLOSURE_TABLES) {
    const ownerWhere = `id = '${gucClosureOwnerRow[table]}'::uuid`;
    assert.equal(
      scopedCount('app_tenant', siteA, table, ownerWhere),
      '0',
      `pre-198: ${table} must be reachable by neither app_tenant nor anyone else (FORCE RLS + zero policies) — proves the R-1 gap is real`,
    );
    assert.equal(
      scopedCount('service_role', null, table, ownerWhere),
      '1',
      `pre-198: service_role positive control must still see ${table} (bypasses RLS)`,
    );
  }

  // Apply 198.
  psql(guc198MigrationSql);

  for (const { table, appendOnly } of GUC_CLOSURE_TABLES) {
    const ownerWhere = `id = '${gucClosureOwnerRow[table]}'::uuid`;
    const otherWhere = `id = '${gucClosureOtherRow[table]}'::uuid`;

    assert.equal(
      scopedCount('app_tenant', siteA, table, ownerWhere),
      '1',
      `post-198: ${table} positive control — correct GUC must see the site's own row`,
    );
    assert.equal(
      scopedCount('app_tenant', siteA, table, otherWhere),
      '0',
      `post-198: ${table} must deny a row owned by a different site`,
    );
    assert.equal(
      scopedCount('app_tenant', null, table, ownerWhere),
      '0',
      `post-198: ${table} must fail closed when app.site_id is unset`,
    );
    assert.equal(
      scopedCount('app_tenant', siteB, table, ownerWhere),
      '0',
      `post-198: ${table} must fail closed when app.site_id names the wrong site`,
    );

    if (appendOnly) {
      assert.throws(
        () => psql(`
          BEGIN;
          SET ROLE app_tenant;
          SELECT set_config('app.site_id', ${sqlString(siteA)}, true);
          INSERT INTO public.${table} (id, site_id) VALUES (gen_random_uuid(), ${sqlString(siteA)}::uuid);
          COMMIT;
        `),
        /permission denied|violates row-level security policy/,
        `post-198: ${table} is append-only — app_tenant must not have INSERT (writes go through the SECURITY DEFINER RPC only)`,
      );
    } else {
      assert.equal(
        scopedCount('app_tenant', siteB, table, otherWhere),
        '1',
        `post-198: ${table} is mutable — app_tenant with the correct GUC must still see its own site's row after the append-only checks above`,
      );
    }
  }
});
