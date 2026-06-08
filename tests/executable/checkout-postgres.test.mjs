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
const checkoutSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/146_executable_checkout_state_machine.sql'),
  'utf8',
);
const checkoutRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/146_executable_checkout_state_machine.rollback.sql'),
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

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function lastPsqlLine(output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.at(-1) || '';
}

function resetDatabase() {
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
    CREATE TABLE public.carts (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      session_id text,
      items jsonb DEFAULT '[]'::jsonb NOT NULL,
      coupon_code text,
      status text DEFAULT 'active',
      buyer_email text,
      channel text DEFAULT 'web',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.checkout_sessions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      order_id uuid,
      customer_email text,
      status text DEFAULT 'completed' NOT NULL,
      idempotency_key text NOT NULL,
      subtotal numeric(12,2) DEFAULT 0 NOT NULL,
      shipping_total numeric(12,2) DEFAULT 0 NOT NULL,
      tax_total numeric(12,2) DEFAULT 0 NOT NULL,
      discount_total numeric(12,2) DEFAULT 0 NOT NULL,
      gift_card_total numeric(12,2) DEFAULT 0 NOT NULL,
      grand_total numeric(12,2) DEFAULT 0 NOT NULL,
      currency text DEFAULT 'INR' NOT NULL,
      shipping_method text,
      payment_method text,
      request_id text,
      metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
      created_by uuid,
      updated_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      UNIQUE (site_id, idempotency_key),
      CONSTRAINT checkout_sessions_status_check CHECK (status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'expired'::text]))
    );
    CREATE TABLE public.inventory_reservations (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      status text DEFAULT 'active' NOT NULL,
      deleted_at timestamptz
    );
    CREATE TABLE public.coupons (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      code text NOT NULL,
      is_active boolean DEFAULT true,
      deleted_at timestamptz
    );
  `);
  psql(foundationSql);
  psql(checkoutSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 003 checkout migration applies, isolates sessions/branding, rejects executable branding, and rolls back on real Postgres', () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';
  const cartId = '33333333-3333-4333-8333-333333333333';
  const reservationId = '44444444-4444-4444-8444-444444444444';

  psql(`
    INSERT INTO public.sites (id, name) VALUES (${sqlString(siteId)}::uuid, 'Checkout Store'), (${sqlString(otherSiteId)}::uuid, 'Other Store');
    INSERT INTO public.carts (id, store_id, session_id, items, coupon_code, buyer_email, channel)
    VALUES (
      ${sqlString(cartId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'cart-token-001',
      '[{"product_id":"55555555-5555-4555-8555-555555555555","quantity":1}]'::jsonb,
      'SAVE10',
      'buyer@example.test',
      'web'
    );
    INSERT INTO public.inventory_reservations (id, store_id, status)
    VALUES (${sqlString(reservationId)}::uuid, ${sqlString(siteId)}::uuid, 'active');
    INSERT INTO public.coupons (store_id, code, is_active)
    VALUES (${sqlString(siteId)}::uuid, 'SAVE10', true);
    INSERT INTO public.checkout_sessions (
      site_id, cart_id, cart_token, channel, status, checkout_state, idempotency_key,
      customer_email, buyer_name, inventory_reservation_ids, discount_codes, payment_intent
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(cartId)}::uuid,
      'cart-token-001',
      'web',
      'payment_intent',
      'payment_intent',
      'checkout-proof-001',
      'buyer@example.test',
      'Buyer',
      ARRAY[${sqlString(reservationId)}::uuid],
      ARRAY['SAVE10'],
      '{"payment_intent_id":"cod_mock_001","provider":"cod","mode":"mock"}'::jsonb
    );
    INSERT INTO public.store_branding (site_id, primary_color, accent_color, checkout_theme, tokens)
    VALUES (${sqlString(siteId)}::uuid, '#111827', '#2563EB', 'system', '{"radius":8}'::jsonb);
  `);

  assert.equal(psql("SELECT checkout_state FROM public.checkout_sessions WHERE site_id = '11111111-1111-4111-8111-111111111111'::uuid;"), 'payment_intent');
  assert.equal(
    psql('SET ROLE app_user; SELECT count(*) FROM public.checkout_sessions; RESET ROLE;'),
    '0',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(siteId)}::uuid); SELECT count(*) FROM public.checkout_sessions; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid); SELECT count(*) FROM public.store_branding; RESET ROLE; COMMIT;`)),
    '0',
  );

  assert.throws(() => psql(`
    INSERT INTO public.store_branding (site_id, tokens)
    VALUES (${sqlString(otherSiteId)}::uuid, '{"bad":"<script>alert(1)</script>"}'::jsonb);
  `), /store_branding_data_only_check/);

  psql(checkoutRollbackSql);
  assert.equal(psql("SELECT to_regclass('public.store_branding') IS NULL;"), 't');
  assert.equal(psql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_sessions' AND column_name='checkout_state';"), '0');
  assert.equal(psql("SELECT status FROM public.checkout_sessions WHERE id IS NOT NULL LIMIT 1;"), 'processing');
  psql(foundationRollbackSql);
});
