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
const taxSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/144_executable_tax_gst_invoices.sql'),
  'utf8',
);
const taxRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/144_executable_tax_gst_invoices.rollback.sql'),
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

function psqlError(sql) {
  try {
    psql(sql, { stdio: 'pipe' });
    return '';
  } catch (error) {
    return `${error.stdout || ''}${error.stderr || ''}`;
  }
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
    CREATE TABLE public.orders (
      id uuid PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      order_number text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
  `);
  psql(foundationSql);
  psql(taxSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 008 tax migration applies, isolates immutable GST invoices, and rolls back on real Postgres', () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';
  const orderId = '33333333-3333-4333-8333-333333333333';

  psql(`
    INSERT INTO public.sites (id, name) VALUES (${sqlString(siteId)}::uuid, 'Tax Store'), (${sqlString(otherSiteId)}::uuid, 'Other Store');
    INSERT INTO public.orders (id, store_id, site_id, order_number)
    VALUES (${sqlString(orderId)}::uuid, ${sqlString(siteId)}::uuid, ${sqlString(siteId)}::uuid, 'LB-1001');
    INSERT INTO public.tax_registrations (site_id, legal_name, gstin, state_code)
    VALUES (${sqlString(siteId)}::uuid, 'Tax Store Private Limited', '27ABCDE1234F1Z5', '27');
    INSERT INTO public.hsn_rates (site_id, hsn_code, gst_rate_bps)
    VALUES (${sqlString(siteId)}::uuid, '6204', 1800);
    INSERT INTO public.gst_invoices (
      site_id,
      order_id,
      invoice_number,
      invoice_date,
      supplier,
      recipient,
      place_of_supply_state_code,
      supply_type,
      lines,
      taxable_amount_minor,
      cgst_amount_minor,
      sgst_amount_minor,
      igst_amount_minor,
      tax_amount_minor,
      total_amount_minor,
      marketplace_tcs_bps,
      tcs_amount_minor,
      irn,
      qr_payload,
      provider_ack,
      invoice
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(orderId)}::uuid,
      'LBY-LB-1001',
      now(),
      '{"name":"Tax Store","gstin":"27ABCDE1234F1Z5","state_code":"27"}'::jsonb,
      '{"name":"Buyer","gstin":"29ABCDE1234F1Z5","state_code":"29"}'::jsonb,
      '29',
      'inter_state',
      '[{"description":"Kurta","hsn_code":"6204","tax_amount_minor":1800}]'::jsonb,
      10000,
      0,
      0,
      1800,
      1800,
      11800,
      100,
      100,
      'MOCK-IRN-TAXPROOF',
      'letbuyy://gst-invoice/MOCK-IRN-TAXPROOF',
      '{"mode":"mock"}'::jsonb,
      '{"invoice_number":"LBY-LB-1001","tax_amount_minor":1800}'::jsonb
    );
  `);

  assert.equal(
    psql('SET ROLE app_user; SELECT count(*) FROM public.gst_invoices; RESET ROLE;'),
    '0',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(siteId)}::uuid); SELECT count(*) FROM public.gst_invoices; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid); SELECT count(*) FROM public.gst_invoices; RESET ROLE; COMMIT;`)),
    '0',
  );
  assert.match(psqlError("UPDATE public.gst_invoices SET status = 'voided';"), /immutable/);
  assert.match(psqlError('DELETE FROM public.gst_invoices;'), /immutable/);

  psql(taxRollbackSql);
  assert.equal(psql("SELECT to_regclass('public.gst_invoices') IS NULL;"), 't');
  psql(foundationRollbackSql);
});
