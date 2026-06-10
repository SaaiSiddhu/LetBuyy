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

function jsonSql(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
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
    CREATE TABLE public.outbox_events (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      store_id uuid,
      site_id uuid,
      event_id uuid DEFAULT gen_random_uuid(),
      aggregate_type text NOT NULL,
      aggregate_id text NOT NULL,
      event_type text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      idempotency_key text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'queued',
      attempts integer NOT NULL DEFAULT 0,
      schema_version integer NOT NULL DEFAULT 1,
      request_id text,
      trace_id text,
      actor_id uuid,
      available_at timestamptz NOT NULL DEFAULT now(),
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz,
      dispatched_at timestamptz,
      published_at timestamptz,
      dispatch_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.audit_activity_events (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      store_id uuid,
      actor_id uuid,
      actor_type text NOT NULL DEFAULT 'system',
      action text NOT NULL,
      resource_type text NOT NULL,
      resource_id text,
      request_id text,
      before_state jsonb,
      after_state jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'executable_app_user') THEN
        CREATE ROLE executable_app_user;
      END IF;
    END;
    $$;
  `);
  psql(migrationSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO executable_app_user;
    GRANT SELECT ON public.compensation_actions TO executable_app_user;
    GRANT SELECT ON public.outbox_consumptions TO executable_app_user;
    GRANT SELECT ON public.ledger_accounts TO executable_app_user;
    GRANT SELECT ON public.ledger_transactions TO executable_app_user;
    GRANT SELECT ON public.ledger_entries TO executable_app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO executable_app_user;
    INSERT INTO public.sites (id, name)
    VALUES ('11111111-1111-4111-8111-111111111111', 'Executable Reference Store')
    ON CONFLICT (id) DO NOTHING;
  `);
}

test('Task 001 reference slice is atomic, idempotent, balanced, traced, audited, and fail-closed', async () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const aggregateId = '33333333-3333-4333-8333-333333333333';
  const requestId = 'req-reference-slice-001';
  const traceId = 'trace-reference-slice-001';

  psql(`
    BEGIN;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    INSERT INTO public.compensation_actions (
      site_id,
      flow,
      aggregate_type,
      aggregate_id,
      idempotency_key,
      action,
      payload,
      request_id
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      'checkout_confirm',
      'order',
      ${sqlString(aggregateId)}::uuid,
      'checkout:${aggregateId}',
      'refund_payment_capture_on_order_failure',
      ${jsonSql({ payment_id: 'pay_sandbox_reference' })},
      ${sqlString(requestId)}
    );
    INSERT INTO public.outbox_events (
      store_id,
      site_id,
      aggregate_type,
      aggregate_id,
      event_type,
      payload,
      idempotency_key,
      request_id,
      trace_id,
      schema_version,
      status
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'order',
      ${sqlString(aggregateId)},
      'order.created.v1',
      ${jsonSql({ order_id: aggregateId, channel: 'web', total_minor: 2500 })},
      'outbox:order.created:${aggregateId}',
      ${sqlString(requestId)},
      ${sqlString(traceId)},
      1,
      'queued'
    );
    COMMIT;
  `);

  psql(`
    BEGIN;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    INSERT INTO public.compensation_actions (
      site_id,
      flow,
      aggregate_type,
      aggregate_id,
      idempotency_key,
      action,
      request_id
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      'checkout_confirm',
      'order',
      gen_random_uuid(),
      'checkout:rolled-back',
      'refund_payment_capture_on_order_failure',
      'req-rolled-back'
    );
    INSERT INTO public.outbox_events (
      store_id,
      site_id,
      aggregate_type,
      aggregate_id,
      event_type,
      payload,
      idempotency_key,
      request_id,
      trace_id
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'order',
      'rolled-back',
      'order.created.v1',
      ${jsonSql({ order_id: 'rolled-back' })},
      'outbox:rolled-back',
      'req-rolled-back',
      'trace-rolled-back'
    );
    ROLLBACK;
  `);

  assert.equal(
    psql("SELECT count(*) FROM public.outbox_events WHERE idempotency_key = 'outbox:rolled-back';"),
    '0',
  );

  const eventId = psql(`
    UPDATE public.outbox_events
       SET status = 'processed',
           processed_at = now(),
           dispatched_at = now(),
           published_at = now(),
           dispatch_metadata = jsonb_build_object('relay', 'foundation-reference')
     WHERE idempotency_key = 'outbox:order.created:${aggregateId}'
     RETURNING event_id;
  `);
  assert.match(eventId, /^[0-9a-f-]{36}$/);
  assert.equal(
    psql("SELECT published_at IS NOT NULL FROM public.outbox_events WHERE idempotency_key = 'outbox:order.created:33333333-3333-4333-8333-333333333333';"),
    't',
  );

  const consumerSql = `
    BEGIN;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    INSERT INTO public.outbox_consumptions (
      site_id,
      event_id,
      consumer,
      idempotency_key,
      result
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(eventId)}::uuid,
      'settlement-ledger-reference',
      'consumer:${eventId}',
      ${jsonSql({ trace_id: traceId, channel: 'web' })}
    ) ON CONFLICT DO NOTHING;
    SELECT public.post_ledger_transaction(
      ${sqlString(siteId)}::uuid,
      'INR',
      'payment_capture',
      'reference-payment-001',
      'ledger:reference-payment-001',
      ${jsonSql([
        { account_code: 'pa_clearing', side: 'debit', amount_minor: 2500 },
        { account_code: 'merchant_payable', side: 'credit', amount_minor: 2500 },
      ])},
      ${jsonSql({ event_id: eventId, trace_id: traceId, channel: 'web' })},
      ${sqlString(requestId)}
    );
    INSERT INTO public.audit_activity_events (
      store_id,
      actor_type,
      action,
      resource_type,
      resource_id,
      request_id,
      metadata
    )
    SELECT
      ${sqlString(siteId)}::uuid,
      'system',
      'order.created',
      'orders',
      ${sqlString(aggregateId)},
      ${sqlString(requestId)},
      ${jsonSql({ trace_id: traceId, channel: 'web', replayable: false })}
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.audit_activity_events
      WHERE request_id = ${sqlString(requestId)}
        AND action = 'order.created'
        AND resource_id = ${sqlString(aggregateId)}
    );
    COMMIT;
  `;
  const transactionId = lastOutputLine(await psqlAsync(consumerSql));
  assert.match(transactionId, /^[0-9a-f-]{36}$/);

  const replayTransactionId = lastOutputLine(await psqlAsync(consumerSql));
  assert.equal(replayTransactionId, transactionId);
  assert.equal(
    psql("SELECT count(*) FROM public.ledger_transactions WHERE source_id = 'reference-payment-001';"),
    '1',
  );
  assert.equal(
    psql(`
      SELECT count(*)
      FROM public.ledger_entries e
      JOIN public.ledger_transactions t ON t.id = e.transaction_id
      WHERE t.source_id = 'reference-payment-001';
    `),
    '2',
  );
  assert.equal(psql('SELECT count(*) FROM public.ledger_balance_breaks();'), '0');
  assert.equal(
    psql("SELECT count(*) FROM public.outbox_consumptions WHERE consumer = 'settlement-ledger-reference';"),
    '1',
  );
  assert.equal(
    psql(`SELECT count(*) FROM public.audit_activity_events WHERE request_id = ${sqlString(requestId)} AND action = 'order.created';`),
    '1',
  );
  assert.equal(
    psql(`SELECT metadata->>'trace_id' FROM public.audit_activity_events WHERE request_id = ${sqlString(requestId)} LIMIT 1;`),
    traceId,
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
      SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
      SELECT count(*) FROM public.ledger_entries;
      RESET ROLE;
      COMMIT;
    `),
    '0',
  );

  psql(rollbackSql);
  assert.equal(psql("SELECT to_regclass('public.ledger_entries') IS NULL;"), 't');
  assert.equal(psql("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'outbox_events' AND column_name = 'published_at';"), '');
});
