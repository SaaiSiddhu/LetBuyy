import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const taskSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/154_executable_analytics_media_ai_seam.sql'),
  'utf8',
);
const rollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/154_executable_analytics_media_ai_seam.rollback.sql'),
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

function resetDatabase() {
  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public;
    CREATE SCHEMA auth;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;
    DROP ROLE IF EXISTS app_user;
    DROP ROLE IF EXISTS service_role;
    DROP ROLE IF EXISTS authenticated;
    CREATE ROLE app_user;
    CREATE ROLE service_role;
    CREATE ROLE authenticated;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE OR REPLACE FUNCTION public.current_site_id()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('app.site_id', true), '')::uuid;
    $$;
    CREATE OR REPLACE FUNCTION public.set_current_site_id(p_site_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM set_config('app.site_id', p_site_id::text, true);
    END;
    $$;
    CREATE OR REPLACE FUNCTION public.update_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
    CREATE TABLE public.users_custom (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.sites (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      site_type text NOT NULL DEFAULT 'store',
      user_id uuid REFERENCES public.users_custom(id) ON DELETE CASCADE,
      custom_user_id uuid REFERENCES public.users_custom(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'published',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.analytics_rollups_daily (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      metric_name text NOT NULL,
      rollup_date date NOT NULL,
      dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
      metric_value numeric(16,4) NOT NULL DEFAULT 0,
      created_by uuid,
      updated_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      UNIQUE (site_id, metric_name, rollup_date, dimensions)
    );
    CREATE TABLE public.media_assets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      asset_type text NOT NULL,
      storage_provider text NOT NULL DEFAULT 'r2',
      storage_path text NOT NULL,
      public_url text,
      filename text NOT NULL,
      content_type text,
      size_bytes bigint,
      width integer,
      height integer,
      alt_text text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT media_assets_asset_type_check CHECK (asset_type IN ('image', 'video', 'file', 'font', 'icon'))
    );
  `);
  psql(taskSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 016 migration builds commerce MV, media signed-upload metadata, AI seam RLS, and rolls back', () => {
  resetDatabase();

  const userId = '11111111-1111-4111-8111-111111111111';
  const siteId = '22222222-2222-4222-8222-222222222222';
  const otherSiteId = '33333333-3333-4333-8333-333333333333';

  psql(`
    INSERT INTO public.users_custom (id, email)
    VALUES (${sqlString(userId)}::uuid, 'analytics@example.test');
    INSERT INTO public.sites (id, name, user_id, site_type)
    VALUES
      (${sqlString(siteId)}::uuid, 'Analytics Store', ${sqlString(userId)}::uuid, 'store'),
      (${sqlString(otherSiteId)}::uuid, 'Other Store', ${sqlString(userId)}::uuid, 'store');

    INSERT INTO public.analytics_rollups_daily (site_id, metric_name, rollup_date, dimensions, metric_value)
    VALUES
      (${sqlString(siteId)}::uuid, 'orders.created', current_date, '{}'::jsonb, 2),
      (${sqlString(siteId)}::uuid, 'orders.paid', current_date, '{}'::jsonb, 1),
      (${sqlString(siteId)}::uuid, 'revenue.paid_minor', current_date, '{"currency":"INR"}'::jsonb, 123450),
      (${sqlString(siteId)}::uuid, 'media.processed', current_date, '{"content_type":"image/png"}'::jsonb, 1),
      (${sqlString(siteId)}::uuid, 'media.size_bytes', current_date, '{}'::jsonb, 2048),
      (${sqlString(otherSiteId)}::uuid, 'orders.created', current_date, '{}'::jsonb, 9);

    SELECT public.refresh_commerce_analytics_daily_mv();

    INSERT INTO public.media_assets (
      store_id, site_id, asset_type, storage_provider, storage_path, object_key,
      public_url, filename, content_type, size_bytes, upload_token_hash,
      upload_intent_expires_at, processing_status, processed_at, source_channel
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'image',
      'r2',
      'media/site/proof.png',
      'media/site/proof.png',
      'https://assets.example/media/site/proof.png',
      'proof.png',
      'image/png',
      2048,
      repeat('a', 64),
      now() + interval '15 minutes',
      'processed',
      now(),
      'web'
    );

    INSERT INTO public.ai_capability_seams (site_id, feature_key, mode, status, provider)
    VALUES (${sqlString(siteId)}::uuid, 'analytics_context', 'mock', 'ready_for_interface', 'none');
  `);

  const mvRow = psql(`
    SELECT orders_created::int || ':' || orders_paid::int || ':' || revenue_paid_minor::int || ':' || media_processed::int || ':' || media_size_bytes::int
    FROM public.commerce_analytics_daily_mv
    WHERE site_id = ${sqlString(siteId)}::uuid
      AND rollup_date = current_date;
  `);
  assert.equal(mvRow, '2:1:123450:1:2048');

  assert.throws(
    () => psql(`
      INSERT INTO public.ai_capability_seams (site_id, feature_key, mode, status, provider, model_calls_enabled)
      VALUES (${sqlString(siteId)}::uuid, 'live_model', 'live', 'human_required', 'human_required', true);
    `),
    /ai_capability_seams_no_model_calls_check/,
  );

  const failClosed = psql(`
    SET ROLE app_user;
    SELECT count(*) FROM public.media_assets;
    RESET ROLE;
  `);
  assert.equal(failClosed, '0');

  const tenantScoped = psql(`
    BEGIN;
    SET ROLE app_user;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    SELECT count(*) FROM public.media_assets;
    SELECT count(*) FROM public.ai_capability_seams;
    RESET ROLE;
    COMMIT;
  `).split('\n').filter(Boolean);
  assert.deepEqual(tenantScoped, ['1', '1']);

  psql(rollbackSql);
  const rolledBack = psql(`
    SELECT
      to_regclass('public.commerce_analytics_daily_mv') IS NULL,
      to_regclass('public.ai_capability_seams') IS NULL,
      NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'media_assets'
          AND column_name = 'site_id'
      );
  `);
  assert.equal(rolledBack, 't|t|t');
});
