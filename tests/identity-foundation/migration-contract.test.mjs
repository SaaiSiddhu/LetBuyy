import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('database/supabase/migrations/159_identity_foundation_core.sql', 'utf8');
const rollback = readFileSync('database/supabase/rollback/159_identity_foundation_core.rollback.sql', 'utf8');

test('identity foundation migration creates the dormant target tables without creating stores', () => {
  for (const table of [
    'principals',
    'account_links',
    'credentials',
    'authenticators',
    'recovery_codes',
    'sessions_v2',
    'refresh_chains',
    'refresh_tokens',
    'oauth_clients',
    'oauth_grants',
    'authorization_codes',
    'federation_tokens',
    'organizations',
    'org_memberships',
    'teams',
    'team_memberships',
    'store_memberships',
    'org_store_links',
    'delegations',
    'invitations',
    'ownership_transfers',
    'signing_keys',
    'security_events',
    'audit_events',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`CREATE POLICY ${table}_service_all ON public\\.${table}`));
    assert.match(migration, new RegExp(`CREATE TRIGGER update_${table}_updated_at[\\s\\S]+public\\.update_updated_at\\(\\)`));
  }

  assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS public\.stores\b|CREATE TABLE public\.stores\b/);
});

test('identity foundation rollback removes only dormant foundation rails', () => {
  for (const table of [
    'audit_events',
    'security_events',
    'signing_keys',
    'ownership_transfers',
    'invitations',
    'delegations',
    'org_store_links',
    'store_memberships',
    'team_memberships',
    'teams',
    'org_memberships',
    'organizations',
    'federation_tokens',
    'authorization_codes',
    'oauth_grants',
    'oauth_clients',
    'refresh_tokens',
    'refresh_chains',
    'sessions_v2',
    'recovery_codes',
    'authenticators',
    'credentials',
    'account_links',
    'principals',
  ]) {
    assert.match(rollback, new RegExp(`DROP TABLE IF EXISTS public\\.${table} CASCADE`));
  }

  assert.match(rollback, /ALTER TABLE IF EXISTS public\.verification_tokens[\s\S]+DROP COLUMN IF EXISTS token_hash/);
  assert.match(rollback, /ALTER TABLE IF EXISTS public\.consents[\s\S]+DROP COLUMN IF EXISTS oauth_client_id/);
  assert.match(rollback, /ALTER TABLE IF EXISTS public\.merchant_2fa_factors[\s\S]+DROP COLUMN IF EXISTS principal_id/);
  assert.match(rollback, /ALTER TABLE IF EXISTS public\.devices[\s\S]+DROP COLUMN IF EXISTS principal_id/);
  assert.match(rollback, /ALTER TABLE IF EXISTS public\.site_memberships[\s\S]+DROP COLUMN IF EXISTS org_id/);
  assert.match(rollback, /ALTER TABLE IF EXISTS public\.risk_signals[\s\S]+DROP COLUMN IF EXISTS principal_id/);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS public\.stores\b|DROP TABLE public\.stores\b/);
});

test('identity foundation migration reuses existing tables through additive columns', () => {
  assert.match(migration, /ALTER TABLE public\.verification_tokens[\s\S]+ADD COLUMN IF NOT EXISTS token_hash text/);
  assert.match(migration, /ALTER TABLE public\.consents[\s\S]+ADD COLUMN IF NOT EXISTS oauth_client_id uuid/);
  assert.match(migration, /ALTER TABLE public\.merchant_2fa_factors[\s\S]+ADD COLUMN IF NOT EXISTS principal_id uuid/);
  assert.match(migration, /ALTER TABLE public\.devices[\s\S]+ADD COLUMN IF NOT EXISTS principal_id uuid/);
  assert.match(migration, /ALTER TABLE IF EXISTS public\.risk_signals[\s\S]+ADD COLUMN IF NOT EXISTS principal_id uuid/);
});

test('organization store aliases still point at public.sites', () => {
  assert.match(migration, /store_id uuid NOT NULL REFERENCES public\.sites\(id\)/);
  assert.match(migration, /store_id uuid REFERENCES public\.sites\(id\)/);
});
