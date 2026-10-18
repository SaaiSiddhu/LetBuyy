import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const foundationSql = readFileSync(join(repoRoot, 'database/supabase/migrations/139_executable_foundation_ledger_core.sql'), 'utf8');
const orderSql = readFileSync(join(repoRoot, 'database/supabase/migrations/147_executable_order_state_risk.sql'), 'utf8');
const orderRollbackSql = readFileSync(join(repoRoot, 'database/supabase/rollback/147_executable_order_state_risk.rollback.sql'), 'utf8');
const orderItemSnapshotSql = readFileSync(join(repoRoot, 'database/supabase/migrations/289_checkout_order_item_snapshot_integrity.sql'), 'utf8');
const orderItemSnapshotRollbackSql = readFileSync(join(repoRoot, 'database/supabase/rollback/289_checkout_order_item_snapshot_integrity.rollback.sql'), 'utf8');
const foundationRollbackSql = readFileSync(join(repoRoot, 'database/supabase/rollback/139_executable_foundation_ledger_core.rollback.sql'), 'utf8');

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
      console.warn(`order-postgres: could not pre-clean role dependencies in ${database}: ${(err instanceof Error ? err.message : String(err)).split('\n')[0]}`);
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
    CREATE TABLE public.checkout_sessions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      idempotency_key text NOT NULL,
      status text DEFAULT 'completed' NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.orders (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      order_number text NOT NULL,
      customer_email text NOT NULL,
      customer_name text,
      customer_phone text,
      shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
      billing_address jsonb,
      items jsonb NOT NULL DEFAULT '[]'::jsonb,
      subtotal numeric(10,2) NOT NULL DEFAULT 0,
      shipping_cost numeric(10,2) DEFAULT 0,
      tax numeric(10,2) DEFAULT 0,
      discount numeric(10,2) DEFAULT 0,
      total numeric(10,2) NOT NULL DEFAULT 0,
      status text DEFAULT 'pending',
      payment_status text DEFAULT 'pending',
      payment_method text,
      currency text DEFAULT 'INR',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text, 'refunded'::text]))
    );
    CREATE TABLE public.fulfillment_orders (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      status text DEFAULT 'open' NOT NULL,
      idempotency_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.order_items (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      product_id uuid,
      variant_id text,
      name text NOT NULL,
      sku text,
      quantity integer NOT NULL,
      price numeric(10,2) NOT NULL,
      total numeric(10,2) NOT NULL,
      title text,
      variant_title text,
      unit_price numeric(10,2),
      discount_amount numeric(10,2) DEFAULT 0,
      tax_amount numeric(10,2) DEFAULT 0,
      product_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
      hsn_code text,
      gst_rate numeric(5,2) DEFAULT 0,
      taxable_amount numeric(10,2) DEFAULT 0,
      cgst_amount numeric(10,2) DEFAULT 0,
      sgst_amount numeric(10,2) DEFAULT 0,
      igst_amount numeric(10,2) DEFAULT 0,
      fulfillment_status text DEFAULT 'unfulfilled',
      fulfilled_quantity integer DEFAULT 0,
      returned_quantity integer DEFAULT 0 NOT NULL,
      refunded_quantity integer DEFAULT 0 NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL,
      deleted_at timestamptz
    );
    CREATE TABLE public.returns (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      status text DEFAULT 'requested' NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
  `);
  psql(foundationSql);
  psql(orderSql);
  psql(orderItemSnapshotSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 005 order migration applies, enforces immutable checkout fields, isolates risk/COD rows, and rolls back on real Postgres', () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';
  const orderId = '33333333-3333-4333-8333-333333333333';

  psql(`
    INSERT INTO public.sites (id, name) VALUES (${sqlString(siteId)}::uuid, 'Order Store'), (${sqlString(otherSiteId)}::uuid, 'Other Store');
    INSERT INTO public.orders (
      id, store_id, site_id, order_number, customer_email, customer_name, customer_phone,
      shipping_address, items, subtotal, total, payment_method, order_source, channel,
      order_locked_at, immutable_snapshot, status
    ) VALUES (
      ${sqlString(orderId)}::uuid,
      ${sqlString(siteId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'LBY-1001',
      'buyer@example.test',
      'Buyer',
      '9999999999',
      '{"zip":"560001"}'::jsonb,
      '[{"quantity":1}]'::jsonb,
      1200.00,
      1200.00,
      'cod',
      'checkout',
      'web',
      now(),
      '{"locked":true}'::jsonb,
      'pending_cod'
    );
    INSERT INTO public.orders (
      id, store_id, site_id, order_number, customer_email, shipping_address, items,
      subtotal, total, order_source
    ) VALUES (
      '66666666-6666-4666-8666-666666666666', ${sqlString(siteId)}::uuid,
      ${sqlString(siteId)}::uuid, 'LBY-DRAFT-1', 'draft@example.test', '{}'::jsonb,
      '[]'::jsonb, 10.00, 10.00, 'draft'
    );
    INSERT INTO public.order_items (
      id, order_id, product_id, variant_id, name, sku, quantity, price, total,
      title, variant_title, unit_price, discount_amount, tax_amount,
      product_snapshot, hsn_code, gst_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount
    ) VALUES (
      '44444444-4444-4444-8444-444444444444', ${sqlString(orderId)}::uuid,
      '55555555-5555-4555-8555-555555555555', 'variant-a', 'Synthetic item', 'SYN-1', 2, 600.00, 1200.00,
      'Synthetic item', 'Large', 600.00, 0, 0,
      '{"product_id":"55555555-5555-4555-8555-555555555555","title":"Synthetic item"}'::jsonb,
      '12345678', 0, 1200.00, 0, 0, 0
    );
    INSERT INTO public.order_risk_assessments (
      site_id, order_id, risk_score, risk_level, reasons, actions, input, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(orderId)}::uuid,
      70,
      'high',
      ARRAY['cod_payment','prior_rto'],
      ARRAY['request_cod_confirmation','hold_fulfillment'],
      '{"payment_method":"cod"}'::jsonb,
      'risk-proof-001'
    );
    INSERT INTO public.cod_confirmation_requests (
      site_id, order_id, idempotency_key, status, provider
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(orderId)}::uuid,
      'cod-proof-001',
      'requested',
      'letbuyy_sandbox'
    );
    INSERT INTO public.fulfillment_orders (site_id, order_id, idempotency_key)
    VALUES (${sqlString(siteId)}::uuid, ${sqlString(orderId)}::uuid, 'fulfillment-proof-001');
  `);

  assert.throws(() => psql(`UPDATE public.orders SET total = 100.00 WHERE id = ${sqlString(orderId)}::uuid;`), /immutable/);
  assert.throws(() => psql("UPDATE public.order_items SET unit_price = 1.00 WHERE id = '44444444-4444-4444-8444-444444444444';"), /immutable/);
  assert.throws(() => psql("UPDATE public.order_items SET product_snapshot = '{\"title\":\"changed\"}'::jsonb WHERE id = '44444444-4444-4444-8444-444444444444';"), /immutable/);
  assert.throws(() => psql("DELETE FROM public.order_items WHERE id = '44444444-4444-4444-8444-444444444444';"), /immutable/);
  psql("UPDATE public.order_items SET fulfillment_status = 'partial', fulfilled_quantity = 1 WHERE id = '44444444-4444-4444-8444-444444444444';");
  assert.equal(psql("SELECT fulfillment_status || ':' || fulfilled_quantity::text FROM public.order_items WHERE id = '44444444-4444-4444-8444-444444444444';"), 'partial:1');
  psql(`INSERT INTO public.order_items (id, order_id, name, quantity, price, total, unit_price)
    VALUES ('77777777-7777-4777-8777-777777777777', '66666666-6666-4666-8666-666666666666', 'Draft item', 1, 10.00, 10.00, 10.00);
    UPDATE public.order_items SET unit_price = 12.00 WHERE id = '77777777-7777-4777-8777-777777777777';`);
  assert.equal(psql("SELECT unit_price::text FROM public.order_items WHERE id = '77777777-7777-4777-8777-777777777777';"), '12.00');
  assert.equal(psql('SET ROLE app_user; SELECT count(*) FROM public.order_risk_assessments; RESET ROLE;'), '0');
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(siteId)}::uuid); SELECT count(*) FROM public.cod_confirmation_requests; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid); SELECT count(*) FROM public.fulfillment_orders; RESET ROLE; COMMIT;`)),
    '0',
  );

  psql(orderItemSnapshotRollbackSql);
  assert.equal(psql("SELECT to_regprocedure('public.prevent_checkout_order_item_snapshot_update()') IS NULL;"), 't');
  psql(orderRollbackSql);
  assert.equal(psql("SELECT to_regclass('public.order_risk_assessments') IS NULL;"), 't');
  assert.equal(psql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='order_source';"), '0');
  assert.equal(psql(`SELECT status FROM public.orders WHERE id = ${sqlString(orderId)}::uuid;`), 'pending');
  psql(foundationRollbackSql);
});
