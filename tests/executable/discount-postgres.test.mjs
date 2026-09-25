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
const discountSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/143_executable_discount_stack.sql'),
  'utf8',
);
const discountRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/143_executable_discount_stack.rollback.sql'),
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
      console.warn(`discount-postgres: could not pre-clean role dependencies in ${database}: ${(err instanceof Error ? err.message : String(err)).split('\n')[0]}`);
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
    CREATE TABLE public.coupons (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      site_id uuid,
      code text NOT NULL,
      discount_type text,
      discount_value numeric(10,2),
      is_active boolean DEFAULT true,
      usage_count integer DEFAULT 0,
      starts_at timestamptz,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
  `);
  psql(foundationSql);
  psql(discountSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 007 discount stack migration applies, isolates allocations, and rolls back on real Postgres', () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';
  const orderId = '33333333-3333-4333-8333-333333333333';
  const couponId = '44444444-4444-4444-8444-444444444444';

  psql(`
    INSERT INTO public.sites (id, name) VALUES (${sqlString(siteId)}::uuid, 'Discount Store'), (${sqlString(otherSiteId)}::uuid, 'Other Store');
    INSERT INTO public.orders (id, store_id, site_id) VALUES (${sqlString(orderId)}::uuid, ${sqlString(siteId)}::uuid, ${sqlString(siteId)}::uuid);
    INSERT INTO public.coupons (
      id, store_id, site_id, code, discount_type, discount_value, discount_class, combines_with, automatic, priority
    ) VALUES (
      ${sqlString(couponId)}::uuid,
      ${sqlString(siteId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'STACK10',
      'fixed',
      100,
      'order',
      '{"product":true,"order":false,"shipping":true}'::jsonb,
      false,
      50
    );
    INSERT INTO public.discount_allocations (
      site_id, order_id, discount_id, discount_code, allocation_class, source_type, amount_minor, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(orderId)}::uuid,
      ${sqlString(couponId)}::uuid,
      'STACK10',
      'order',
      'code',
      10000,
      'discount-allocation-proof'
    );
  `);

  assert.equal(
    psql('SET ROLE app_user; SELECT count(*) FROM public.discount_allocations; RESET ROLE;'),
    '0',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(siteId)}::uuid); SELECT count(*) FROM public.discount_allocations; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid); SELECT count(*) FROM public.discount_allocations; RESET ROLE; COMMIT;`)),
    '0',
  );
  assert.equal(
    psql(`SELECT discount_class || ':' || (combines_with->>'product') FROM public.coupons WHERE id = ${sqlString(couponId)}::uuid;`),
    'order:true',
  );

  psql('DELETE FROM public.discount_allocations; DELETE FROM public.coupons;');
  psql(discountRollbackSql);
  assert.equal(psql("SELECT to_regclass('public.discount_allocations') IS NULL;"), 't');
  psql(foundationRollbackSql);
});
