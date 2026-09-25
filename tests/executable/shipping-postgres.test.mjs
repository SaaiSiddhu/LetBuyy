import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const foundationSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/139_executable_foundation_ledger_core.sql'),
  'utf8',
);
const shippingSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/145_executable_shipping_serviceability.sql'),
  'utf8',
);
const shippingRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/145_executable_shipping_serviceability.rollback.sql'),
  'utf8',
);
const foundationRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/139_executable_foundation_ledger_core.rollback.sql'),
  'utf8',
);

function psql(sql, options = {}) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8', ...options },
  ).trim();
}

function psqlInDatabase(database, sql, options = {}) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: `SET client_min_messages TO warning;\n${sql}`, encoding: 'utf8', ...options },
  ).trim();
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function lastPsqlLine(output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.at(-1) || '';
}

// SUSTAINED-I -- same cross-suite role/database contamination
// tenant-redteam-postgres.test.mjs's own clearRoleDependenciesInSiblingDatabases fixed
// (letbuyy-executable-suites-contaminate-each-other, EXECUTION_LEDGER.md's F-HANDOFF-1 row):
// app_user are CLUSTER-WIDE roles, but every *-postgres.test.mjs suite gets its own
// DATABASE, left standing. Postgres's DROP ROLE refuses if the role still has a grant or owns
// an object in ANY database on the cluster (pg_shdepend, cluster-wide), so once a sibling
// suite's database has granted anything to these roles, this file's own DROP ROLE fails with
// "cannot be dropped because some objects depend on it" even though nothing in THIS database
// still depends on it. First observed for this file by SUSTAINED-I's completed full
// test:behavioral run; same fix as SUSTAINED-H already ported to two other files.
function clearRoleDependenciesInSiblingDatabases(roles) {
  const others = psqlInDatabase('postgres', "SELECT datname FROM pg_database WHERE datname LIKE 'letbuyy\\_%' ESCAPE '\\';")
    .split('\n')
    .map((line) => line.trim())
    .filter((name) => name && name !== databaseName);
  const roleList = roles.join(', ');
  for (const database of others) {
    try {
      psqlInDatabase(database, `
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN (${roles.map(sqlString).join(', ')})) THEN
            EXECUTE 'REASSIGN OWNED BY ${roleList} TO postgres';
            EXECUTE 'DROP OWNED BY ${roleList}';
          END IF;
        END
        $$;
      `);
    } catch (err) {
      console.warn(`shipping-postgres: could not pre-clean role dependencies in ${database}: ${(err instanceof Error ? err.message : String(err)).split('\n')[0]}`);
    }
  }
}

function resetDatabase() {
  clearRoleDependenciesInSiblingDatabases(["app_user"]);

  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;
    DROP ROLE IF EXISTS app_user;
    CREATE ROLE app_user;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE OR REPLACE FUNCTION public.update_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
    CREATE TABLE public.sites (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.orders (
      id uuid PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.shipping_zones (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      name text NOT NULL,
      countries text[] DEFAULT '{}'::text[],
      states text[] DEFAULT '{}'::text[],
      zip_codes text[] DEFAULT '{}'::text[],
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.shipping_rates (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      zone_id uuid NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
      name text NOT NULL,
      type text,
      price numeric(10,2) DEFAULT 0,
      is_active boolean DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.shipments (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'label_created',
      carrier text,
      tracking_number text,
      tracking_url text,
      idempotency_key text NOT NULL,
      metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
  `);
  psql(foundationSql);
  psql(shippingSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 009 shipping migration applies, isolates serviceability and shipment rows, and rolls back on real Postgres', () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';
  const orderId = '33333333-3333-4333-8333-333333333333';

  psql(`
    INSERT INTO public.sites (id, name) VALUES (${sqlString(siteId)}::uuid, 'Shipping Store'), (${sqlString(otherSiteId)}::uuid, 'Other Store');
    INSERT INTO public.orders (id, store_id, site_id) VALUES (${sqlString(orderId)}::uuid, ${sqlString(siteId)}::uuid, ${sqlString(siteId)}::uuid);
    WITH zone AS (
      INSERT INTO public.shipping_zones (store_id, site_id, name, countries, zip_codes)
      VALUES (${sqlString(siteId)}::uuid, ${sqlString(siteId)}::uuid, 'South India', ARRAY['IN'], ARRAY['560001'])
      RETURNING id
    )
    INSERT INTO public.shipping_rates (zone_id, site_id, name, type, price)
    SELECT id, ${sqlString(siteId)}::uuid, 'Standard', 'flat', 60 FROM zone;
    INSERT INTO public.shipping_profiles (site_id, name, is_default)
    VALUES (${sqlString(siteId)}::uuid, 'Default', true);
    INSERT INTO public.shipping_serviceability_rules (
      site_id, provider, pincode, serviceable, cod_available, min_cod_amount_minor, max_cod_amount_minor
    ) VALUES (
      ${sqlString(siteId)}::uuid, 'shiprocket', '560001', true, true, 100, 20000000
    );
    INSERT INTO public.shipments (
      site_id, order_id, status, carrier, tracking_number, idempotency_key, provider, provider_shipment_id, awb, cod_eligible
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(orderId)}::uuid,
      'label_created',
      'Shiprocket',
      'SR1001',
      'ship-proof-001',
      'shiprocket',
      'shiprocket_1001',
      'AWB1001',
      true
    );
  `);

  assert.equal(psql("SELECT count(*) FROM public.shipping_rates WHERE site_id IS NOT NULL;"), '1');
  assert.equal(
    psql('SET ROLE app_user; SELECT count(*) FROM public.shipping_serviceability_rules; RESET ROLE;'),
    '0',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(siteId)}::uuid); SELECT count(*) FROM public.shipping_serviceability_rules; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid); SELECT count(*) FROM public.shipments; RESET ROLE; COMMIT;`)),
    '0',
  );

  psql('DELETE FROM public.shipments; DELETE FROM public.shipping_serviceability_rules; DELETE FROM public.shipping_rates; DELETE FROM public.shipping_zones; DELETE FROM public.shipping_profiles;');
  psql(shippingRollbackSql);
  assert.equal(psql("SELECT to_regclass('public.shipping_serviceability_rules') IS NULL;"), 't');
  psql(foundationRollbackSql);
});
