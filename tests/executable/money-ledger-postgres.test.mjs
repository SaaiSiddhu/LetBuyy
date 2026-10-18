import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const migrationSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/139_executable_foundation_ledger_core.sql'),
  'utf8',
);
const idempotencyMigrationSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/288_ledger_idempotency_payload_conflict.sql'),
  'utf8',
);
const idempotencyRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/288_ledger_idempotency_payload_conflict.rollback.sql'),
  'utf8',
);
const writerPrivilegesSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/290_canonical_ledger_writer_privileges.sql'),
  'utf8',
);
const writerPrivilegesRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/290_canonical_ledger_writer_privileges.rollback.sql'),
  'utf8',
);
const rollbackSql = readFileSync(
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

async function psqlAsync(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'exec',
      '-i',
      containerName,
      'psql',
      '-U',
      'postgres',
      '-d',
      databaseName,
      '-v',
      'ON_ERROR_STOP=1',
      '-qAt',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `psql exited with ${code}`));
      }
    });
    child.stdin.end(sql);
  });
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function ledgerLines(lines) {
  return sqlString(JSON.stringify(lines));
}

function lastOutputLine(output) {
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.at(-1) || '';
}

function resetDatabase() {
  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;
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
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'executable_app_user') THEN
        CREATE ROLE executable_app_user;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN CREATE ROLE app_tenant; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END;
    $$;
    ALTER ROLE anon NOLOGIN NOBYPASSRLS;
    ALTER ROLE authenticated NOLOGIN NOBYPASSRLS;
    ALTER ROLE app_tenant NOLOGIN NOBYPASSRLS;
    ALTER ROLE service_role NOLOGIN BYPASSRLS;
  `);
  psql(migrationSql);
  psql(idempotencyMigrationSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO executable_app_user;
    GRANT SELECT ON public.ledger_accounts TO executable_app_user;
    GRANT SELECT ON public.ledger_transactions TO executable_app_user;
    GRANT SELECT ON public.ledger_entries TO executable_app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO executable_app_user;
    INSERT INTO public.sites (id, name)
    VALUES
      ('11111111-1111-4111-8111-111111111111', 'Executable Store A'),
      ('22222222-2222-4222-8222-222222222222', 'Executable Store B')
    ON CONFLICT (id) DO NOTHING;
  `);
}

function postTransaction({ siteId, sourceType, sourceId, idempotencyKey, lines, metadata = {}, requestId = `req-${sourceId}` }) {
  return psql(`
    BEGIN;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    SELECT public.post_ledger_transaction(
      ${sqlString(siteId)}::uuid,
      'INR',
      ${sqlString(sourceType)},
      ${sqlString(sourceId)},
      ${sqlString(idempotencyKey)},
      ${ledgerLines(lines)}::jsonb,
      ${ledgerLines(metadata)}::jsonb,
      ${sqlString(requestId)}
    );
    COMMIT;
  `);
}

test('F6 money kernel proof suites pass on a real local Postgres', async () => {
  resetDatabase();
  const siteA = '11111111-1111-4111-8111-111111111111';
  const siteB = '22222222-2222-4222-8222-222222222222';
  const directWriter = 'public.post_ledger_transaction(uuid,text,text,text,text,jsonb,jsonb,text)';
  const anonPostAttempt = `
    BEGIN;
    SET LOCAL ROLE anon;
    SELECT set_config('app.site_id', '${siteA}', true);
    SELECT public.post_ledger_transaction(
      '${siteA}'::uuid, 'INR', 'payment_capture', 'forged-payment', 'forged-key',
      '[{"account_code":"pa_clearing","side":"debit","amount_minor":100},{"account_code":"merchant_payable","side":"credit","amount_minor":100}]'::jsonb,
      '{}'::jsonb, 'forged-request'
    );
    ROLLBACK;
  `;
  const preMigrationAttempt = lastOutputLine(psql(anonPostAttempt));
  assert.match(preMigrationAttempt, /^[0-9a-f-]{36}$/,
    'the pre-fix PUBLIC SECURITY DEFINER grant lets anon fabricate a balanced posting');
  assert.equal(psql("SELECT count(*) FROM public.ledger_transactions WHERE source_id='forged-payment';"), '0',
    'the exploit control is rolled back so the fixture retains no synthetic posting');

  psql(writerPrivilegesSql);
  assert.throws(() => psql(anonPostAttempt), /permission denied/,
    'migration 290 prevents the same anon posting');
  for (const role of ['anon', 'authenticated', 'app_tenant', 'service_role', 'executable_app_user']) {
    assert.equal(psql(`SELECT has_function_privilege('${role}', '${directWriter}', 'EXECUTE');`), 'f', `${role} must not call the low-level ledger writer directly`);
  }

  for (let index = 1; index <= 64; index += 1) {
    const amount = 100 + ((index * 7919) % 25_000);
    const fee = index % 3 === 0 ? Math.floor(amount / 100) : 0;
    const gst = index % 5 === 0 ? Math.floor(fee * 0.18) : 0;
    const merchant = amount - fee - gst;
    const siteId = index % 2 === 0 ? siteA : siteB;
    postTransaction({
      siteId,
      sourceType: 'payment_capture',
      sourceId: `property-${index}`,
      idempotencyKey: `property:${index}`,
      lines: [
        { account_code: 'pa_clearing', side: 'debit', amount_minor: amount },
        { account_code: 'merchant_payable', side: 'credit', amount_minor: merchant },
        ...(fee > 0 ? [{ account_code: 'platform_revenue', side: 'credit', amount_minor: fee }] : []),
        ...(gst > 0 ? [{ account_code: 'gst_payable', side: 'credit', amount_minor: gst }] : []),
      ],
    });
  }

  assert.equal(psql('SELECT count(*) FROM public.ledger_balance_breaks();'), '0');

  postTransaction({
    siteId: siteA,
    sourceType: 'settlement',
    sourceId: 'psp-fixture-001',
    idempotencyKey: 'recon:psp-fixture-001',
    lines: [
      { account_code: 'pa_clearing', side: 'credit', amount_minor: 12_000 },
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 11_500 },
      { account_code: 'platform_revenue', side: 'debit', amount_minor: 500 },
    ],
  });
  postTransaction({
    siteId: siteA,
    sourceType: 'cod_remittance',
    sourceId: 'cod-fixture-001',
    idempotencyKey: 'recon:cod-fixture-001',
    lines: [
      { account_code: 'cod_receivable', side: 'credit', amount_minor: 8_000 },
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 7_700 },
      { account_code: 'platform_revenue', side: 'debit', amount_minor: 300 },
    ],
  });
  assert.equal(psql('SELECT count(*) FROM public.ledger_balance_breaks();'), '0');

  const originalRefund = {
    siteId: siteA,
    sourceType: 'refund',
    sourceId: 'refund-original-001',
    idempotencyKey: 'refund:original-001',
    metadata: { provider_event_id: 'evt-refund-original-001', order_id: 'order-original-001' },
    lines: [
      { account_code: 'refund_clearing', side: 'debit', amount_minor: 1_000 },
      { account_code: 'merchant_payable', side: 'credit', amount_minor: 1_000 },
    ],
  };
  const originalId = lastOutputLine(postTransaction(originalRefund));
  assert.match(originalId, /^[0-9a-f-]{36}$/);
  assert.equal(lastOutputLine(postTransaction({ ...originalRefund, requestId: 'req-refund-retry' })), originalId,
    'an exact financial retry with a fresh request ID replays the original transaction');
  assert.equal(lastOutputLine(postTransaction({
    ...originalRefund,
    metadata: { ...originalRefund.metadata, provider_event_id: 'evt-refund-delivered-again' },
    requestId: 'req-refund-webhook-delivery',
  })), originalId,
  'a second authenticated provider event for the same financial source replays the posting');
  assert.equal(psql(`SELECT metadata->>'provider_event_id' FROM public.ledger_transactions WHERE id=${sqlString(originalId)}::uuid;`),
    'evt-refund-original-001', 'ledger evidence is immutable while separate provider-event rows record subsequent deliveries');
  assert.throws(() => postTransaction({
    ...originalRefund,
    lines: [
      { account_code: 'refund_clearing', side: 'debit', amount_minor: 999 },
      { account_code: 'merchant_payable', side: 'credit', amount_minor: 999 },
    ],
  }), /ledger idempotency key conflicts with a different request payload/);
  assert.throws(() => postTransaction({
    ...originalRefund,
    metadata: { ...originalRefund.metadata, order_id: 'order-different' },
  }), /ledger idempotency key conflicts with a different request payload/);
  postTransaction({
    siteId: siteA,
    sourceType: 'reversal',
    sourceId: 'refund-reversal-001',
    idempotencyKey: 'refund:reversal-001',
    lines: [
      { account_code: 'refund_clearing', side: 'credit', amount_minor: 1_000 },
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 1_000 },
    ],
  });
  assert.equal(psql('SELECT count(*) FROM public.ledger_balance_breaks();'), '0');
  assert.throws(
    () => psql("UPDATE public.ledger_entries SET amount_minor = amount_minor + 1 WHERE id = (SELECT id FROM public.ledger_entries LIMIT 1);"),
    /ledger is append-only/,
  );
  assert.throws(
    () => psql('DELETE FROM public.ledger_entries WHERE id = (SELECT id FROM public.ledger_entries LIMIT 1);'),
    /ledger is append-only/,
  );

  const concurrencySql = `
    BEGIN;
    SELECT public.set_current_site_id(${sqlString(siteB)}::uuid);
    SELECT public.post_ledger_transaction(
      ${sqlString(siteB)}::uuid,
      'INR',
      'payment_capture',
      'parallel-writer-001',
      'parallel:writer:001',
      ${ledgerLines([
        { account_code: 'pa_clearing', side: 'debit', amount_minor: 4_321 },
        { account_code: 'merchant_payable', side: 'credit', amount_minor: 4_321 },
      ])}::jsonb,
      '{}'::jsonb,
      'req-parallel-writer-001'
    );
    COMMIT;
  `;
  await Promise.all(Array.from({ length: 12 }, () => psqlAsync(concurrencySql)));
  assert.equal(
    psql("SELECT count(*) FROM public.ledger_transactions WHERE source_id = 'parallel-writer-001';"),
    '1',
  );
  assert.equal(
    psql(`
      SELECT count(*)
      FROM public.ledger_entries e
      JOIN public.ledger_transactions t ON t.id = e.transaction_id
      WHERE t.source_id = 'parallel-writer-001';
    `),
    '2',
  );

  assert.equal(
    psql(`
      SET ROLE executable_app_user;
      SELECT count(*) FROM public.ledger_entries;
      RESET ROLE;
    `),
    '0',
  );
  assert.notEqual(
    psql(`
      BEGIN;
      SET ROLE executable_app_user;
      SELECT public.set_current_site_id(${sqlString(siteA)}::uuid);
      SELECT count(*) FROM public.ledger_entries;
      RESET ROLE;
      COMMIT;
    `),
    '0',
  );

  psql(idempotencyRollbackSql);
  psql(writerPrivilegesRollbackSql);
  assert.equal(psql(`SELECT has_function_privilege('anon', '${directWriter}', 'EXECUTE');`), 't', 'rollback restores the pre-migration default public privilege');
  assert.equal(
    psql("SELECT position('ledger idempotency key conflicts' IN pg_get_functiondef('public.post_ledger_transaction(uuid,text,text,text,text,jsonb,jsonb,text)'::regprocedure)) = 0;"),
    't',
    'the paired rollback restores the pre-288 writer definition',
  );
  psql(rollbackSql);
  assert.equal(
    psql("SELECT to_regclass('public.ledger_entries') IS NULL;"),
    't',
  );
});
