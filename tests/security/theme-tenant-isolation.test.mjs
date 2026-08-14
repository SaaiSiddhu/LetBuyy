/**
 * Theme tenant isolation — live two-site proof (AGENTS.md TEST-R4, ART-08/09, SEC-R1).
 *
 * Migration 196 replaced the baseline `USING (true)` catalog policy on public.themes and
 * completed FORCE ROW LEVEL SECURITY across the theme tables. A migration-text assertion
 * cannot show that the resulting policies actually deny anything, so this suite runs the
 * real policies against the real schema: two sites, each with its own theme state, read
 * back through the non-BYPASSRLS `app_tenant` role the gateway assumes for tenant traffic.
 *
 * Every negative assertion is paired with a positive control taken in the same session,
 * so an empty database or a broken fixture cannot make the suite green.
 *
 * Private state lives on unpublished (draft) sites. That is deliberate: the storefront
 * policies (theme_instances_public_active_read, theme_releases_public_current_read) grant
 * anyone the *active/current* rows of a **published** site by design, so isolation of
 * tenant-private state has to be measured where the tenant GUC policy is the only gate.
 *
 * Fixtures live inside one transaction that always ends in ROLLBACK, so nothing survives
 * the run even when an assertion or the connection fails; `after` re-checks that from a
 * fresh session.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const container = process.env.LETBUYY_SUPABASE_PG_CONTAINER || 'supabase_db_Letbuyy_Store';
const database = process.env.LETBUYY_SUPABASE_PG_DATABASE || 'postgres';

const SITE_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const SITE_B = 'bbbbbbbb-0000-4000-8000-000000000001';
const OWNER_A = 'aaaaaaaa-0000-4000-8000-00000000000f';
const OWNER_B = 'bbbbbbbb-0000-4000-8000-00000000000f';
const PACKAGE_ID = 'cccccccc-0000-4000-8000-000000000001';
const PACKAGE_VERSION_ID = 'cccccccc-0000-4000-8000-000000000002';
const THEME_A = 'aaaaaaaa-0000-4000-8000-000000000010';
const THEME_B = 'bbbbbbbb-0000-4000-8000-000000000010';
const THEME_CATALOG = 'cccccccc-0000-4000-8000-000000000010';
const INSTANCE_A = 'aaaaaaaa-0000-4000-8000-000000000020';
const INSTANCE_B = 'bbbbbbbb-0000-4000-8000-000000000020';
const RELEASE_A = 'aaaaaaaa-0000-4000-8000-000000000030';
const RELEASE_B = 'bbbbbbbb-0000-4000-8000-000000000030';
const DRAFT_A = 'aaaaaaaa-0000-4000-8000-000000000040';
const DRAFT_B = 'bbbbbbbb-0000-4000-8000-000000000040';
const PREVIEW_A = 'aaaaaaaa-0000-4000-8000-000000000050';
const PREVIEW_B = 'bbbbbbbb-0000-4000-8000-000000000050';

const FORCED_THEME_TABLES = ['themes', 'theme_instances', 'theme_releases', 'theme_editor_drafts', 'theme_preview_sessions'];

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-qAt', '-F', '|'],
    { input: `SET client_min_messages TO warning;\n${sql}`, encoding: 'utf8' },
  ).trim();
}

function databaseReachable() {
  try {
    return psql('SELECT 1;') === '1';
  } catch {
    return false;
  }
}

/** Parses `check|value` lines into a Map so each assertion can name what it reads. */
function parseChecks(output) {
  const checks = new Map();
  for (const line of output.split('\n')) {
    const [name, value] = line.trim().split('|');
    if (name && value !== undefined) checks.set(name, Number(value));
  }
  return checks;
}

/**
 * The whole scenario in one transaction: seed both tenants, then read them back under
 * the merchant identity (auth.uid), under the tenant GUC, and with no tenant context.
 */
const SCENARIO_SQL = `
BEGIN;

INSERT INTO public.users (id, email) VALUES
  ('${OWNER_A}', 'lb-theme-iso-owner-a@example.invalid'),
  ('${OWNER_B}', 'lb-theme-iso-owner-b@example.invalid');

INSERT INTO public.theme_packages (id, slug, name)
VALUES ('${PACKAGE_ID}', 'lb-theme-iso-package', 'LB Theme Isolation Package');

INSERT INTO public.theme_package_versions (id, theme_package_id, version)
VALUES ('${PACKAGE_VERSION_ID}', '${PACKAGE_ID}', '1.0.0');

INSERT INTO public.sites (id, user_id, name, store_name, site_type, subdomain, status) VALUES
  ('${SITE_A}', '${OWNER_A}', 'LB Theme Isolation A', 'lb-theme-iso-a', 'store', 'lb-theme-iso-a', 'draft'),
  ('${SITE_B}', '${OWNER_B}', 'LB Theme Isolation B', 'lb-theme-iso-b', 'store', 'lb-theme-iso-b', 'draft');

INSERT INTO public.themes (id, name, slug, is_active, is_site_private, owned_by_site_id) VALUES
  ('${THEME_A}', 'LB Theme Iso A Private', 'lb-theme-iso-a-private', true, true, '${SITE_A}'),
  ('${THEME_B}', 'LB Theme Iso B Private', 'lb-theme-iso-b-private', true, true, '${SITE_B}'),
  ('${THEME_CATALOG}', 'LB Theme Iso Catalog', 'lb-theme-iso-catalog', true, false, NULL);

INSERT INTO public.theme_instances (id, store_id, theme_package_id, theme_package_version_id, theme_slug, instance_status) VALUES
  ('${INSTANCE_A}', '${SITE_A}', '${PACKAGE_ID}', '${PACKAGE_VERSION_ID}', 'lb-theme-iso-a-private', 'installed'),
  ('${INSTANCE_B}', '${SITE_B}', '${PACKAGE_ID}', '${PACKAGE_VERSION_ID}', 'lb-theme-iso-b-private', 'installed');

-- Superseded, not current: a historical release is tenant-private state, so the
-- storefront's public current-release policy cannot account for its visibility.
INSERT INTO public.theme_releases (id, store_id, theme_id, release_version, release_status, is_current) VALUES
  ('${RELEASE_A}', '${SITE_A}', 'lb-theme-iso-a-private', 1, 'superseded', false),
  ('${RELEASE_B}', '${SITE_B}', 'lb-theme-iso-b-private', 1, 'superseded', false);

INSERT INTO public.theme_editor_drafts (id, store_id, theme_id) VALUES
  ('${DRAFT_A}', '${SITE_A}', 'lb-theme-iso-a-private'),
  ('${DRAFT_B}', '${SITE_B}', 'lb-theme-iso-b-private');

INSERT INTO public.theme_preview_sessions (id, store_id, theme_id, token_hash, expires_at) VALUES
  ('${PREVIEW_A}', '${SITE_A}', 'lb-theme-iso-a-private', 'lb-theme-iso-token-a', now() + interval '1 hour'),
  ('${PREVIEW_B}', '${SITE_B}', 'lb-theme-iso-b-private', 'lb-theme-iso-token-b', now() + interval '1 hour');

-- Seed proof, read as the BYPASSRLS owner: every later zero must mean "denied",
-- never "the fixture was not created".
SELECT 'fixture.sites' AS check, count(*) AS value FROM public.sites WHERE id IN ('${SITE_A}','${SITE_B}')
UNION ALL SELECT 'fixture.themes', count(*) FROM public.themes WHERE id IN ('${THEME_A}','${THEME_B}','${THEME_CATALOG}')
UNION ALL SELECT 'fixture.theme_instances', count(*) FROM public.theme_instances WHERE id IN ('${INSTANCE_A}','${INSTANCE_B}')
UNION ALL SELECT 'fixture.theme_releases', count(*) FROM public.theme_releases WHERE id IN ('${RELEASE_A}','${RELEASE_B}')
UNION ALL SELECT 'fixture.theme_editor_drafts', count(*) FROM public.theme_editor_drafts WHERE id IN ('${DRAFT_A}','${DRAFT_B}')
UNION ALL SELECT 'fixture.theme_preview_sessions', count(*) FROM public.theme_preview_sessions WHERE id IN ('${PREVIEW_A}','${PREVIEW_B}')
UNION ALL SELECT 'posture.baseline_themes_policy', count(*) FROM pg_policies WHERE tablename = 'themes' AND policyname = 'Themes are viewable by everyone'
UNION ALL SELECT 'posture.forced.' || relname, relforcerowsecurity::int FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relname IN (${FORCED_THEME_TABLES.map((table) => `'${table}'`).join(',')});

-- Merchant identity: site A's owner.
SET LOCAL request.jwt.claims = '{"sub":"${OWNER_A}","role":"authenticated"}';
SET LOCAL ROLE app_tenant;
SELECT 'owner_a.themes.own_private' AS check, count(*) AS value FROM public.themes WHERE id = '${THEME_A}'
UNION ALL SELECT 'owner_a.themes.other_private', count(*) FROM public.themes WHERE id = '${THEME_B}';
RESET ROLE;

-- Mirrored, so isolation is proven in both directions rather than for one lucky tenant.
SET LOCAL request.jwt.claims = '{"sub":"${OWNER_B}","role":"authenticated"}';
SET LOCAL ROLE app_tenant;
SELECT 'owner_b.themes.own_private' AS check, count(*) AS value FROM public.themes WHERE id = '${THEME_B}'
UNION ALL SELECT 'owner_b.themes.other_private', count(*) FROM public.themes WHERE id = '${THEME_A}';
RESET ROLE;
RESET request.jwt.claims;

-- Tenant context: gateway traffic scoped to site A.
SET LOCAL app.site_id = '${SITE_A}';
SET LOCAL ROLE app_tenant;
SELECT 'guc_a.themes.catalog' AS check, count(*) AS value FROM public.themes WHERE id = '${THEME_CATALOG}'
UNION ALL SELECT 'guc_a.theme_instances.own', count(*) FROM public.theme_instances WHERE id = '${INSTANCE_A}'
UNION ALL SELECT 'guc_a.theme_instances.other', count(*) FROM public.theme_instances WHERE id = '${INSTANCE_B}'
UNION ALL SELECT 'guc_a.theme_releases.own', count(*) FROM public.theme_releases WHERE id = '${RELEASE_A}'
UNION ALL SELECT 'guc_a.theme_releases.other', count(*) FROM public.theme_releases WHERE id = '${RELEASE_B}'
UNION ALL SELECT 'guc_a.theme_editor_drafts.own', count(*) FROM public.theme_editor_drafts WHERE id = '${DRAFT_A}'
UNION ALL SELECT 'guc_a.theme_editor_drafts.other', count(*) FROM public.theme_editor_drafts WHERE id = '${DRAFT_B}'
UNION ALL SELECT 'guc_a.theme_preview_sessions.own', count(*) FROM public.theme_preview_sessions WHERE id = '${PREVIEW_A}'
UNION ALL SELECT 'guc_a.theme_preview_sessions.other', count(*) FROM public.theme_preview_sessions WHERE id = '${PREVIEW_B}';
RESET ROLE;

SET LOCAL app.site_id = '${SITE_B}';
SET LOCAL ROLE app_tenant;
SELECT 'guc_b.theme_instances.own' AS check, count(*) AS value FROM public.theme_instances WHERE id = '${INSTANCE_B}'
UNION ALL SELECT 'guc_b.theme_instances.other', count(*) FROM public.theme_instances WHERE id = '${INSTANCE_A}'
UNION ALL SELECT 'guc_b.theme_releases.own', count(*) FROM public.theme_releases WHERE id = '${RELEASE_B}'
UNION ALL SELECT 'guc_b.theme_releases.other', count(*) FROM public.theme_releases WHERE id = '${RELEASE_A}'
UNION ALL SELECT 'guc_b.theme_editor_drafts.own', count(*) FROM public.theme_editor_drafts WHERE id = '${DRAFT_B}'
UNION ALL SELECT 'guc_b.theme_editor_drafts.other', count(*) FROM public.theme_editor_drafts WHERE id = '${DRAFT_A}'
UNION ALL SELECT 'guc_b.theme_preview_sessions.own', count(*) FROM public.theme_preview_sessions WHERE id = '${PREVIEW_B}'
UNION ALL SELECT 'guc_b.theme_preview_sessions.other', count(*) FROM public.theme_preview_sessions WHERE id = '${PREVIEW_A}';
RESET ROLE;

-- SEC-R1 / ART-08: no tenant context at all must resolve to zero rows.
RESET app.site_id;
SET LOCAL ROLE app_tenant;
SELECT 'no_guc.themes.private_a' AS check, count(*) AS value FROM public.themes WHERE id = '${THEME_A}'
UNION ALL SELECT 'no_guc.themes.private_b', count(*) FROM public.themes WHERE id = '${THEME_B}'
UNION ALL SELECT 'no_guc.themes.catalog', count(*) FROM public.themes WHERE id = '${THEME_CATALOG}'
UNION ALL SELECT 'no_guc.theme_instances', count(*) FROM public.theme_instances WHERE id IN ('${INSTANCE_A}','${INSTANCE_B}')
UNION ALL SELECT 'no_guc.theme_releases', count(*) FROM public.theme_releases WHERE id IN ('${RELEASE_A}','${RELEASE_B}')
UNION ALL SELECT 'no_guc.theme_editor_drafts', count(*) FROM public.theme_editor_drafts WHERE id IN ('${DRAFT_A}','${DRAFT_B}')
UNION ALL SELECT 'no_guc.theme_preview_sessions', count(*) FROM public.theme_preview_sessions WHERE id IN ('${PREVIEW_A}','${PREVIEW_B}');
RESET ROLE;

ROLLBACK;
`;

const RESIDUE_SQL = `
SELECT 'residue.users' AS check, count(*) AS value FROM public.users WHERE id IN ('${OWNER_A}','${OWNER_B}')
UNION ALL SELECT 'residue.theme_packages', count(*) FROM public.theme_packages WHERE id = '${PACKAGE_ID}'
UNION ALL SELECT 'residue.theme_package_versions', count(*) FROM public.theme_package_versions WHERE id = '${PACKAGE_VERSION_ID}'
UNION ALL SELECT 'residue.sites', count(*) FROM public.sites WHERE id IN ('${SITE_A}','${SITE_B}')
UNION ALL SELECT 'residue.themes', count(*) FROM public.themes WHERE id IN ('${THEME_A}','${THEME_B}','${THEME_CATALOG}')
UNION ALL SELECT 'residue.theme_instances', count(*) FROM public.theme_instances WHERE id IN ('${INSTANCE_A}','${INSTANCE_B}')
UNION ALL SELECT 'residue.theme_releases', count(*) FROM public.theme_releases WHERE id IN ('${RELEASE_A}','${RELEASE_B}')
UNION ALL SELECT 'residue.theme_editor_drafts', count(*) FROM public.theme_editor_drafts WHERE id IN ('${DRAFT_A}','${DRAFT_B}')
UNION ALL SELECT 'residue.theme_preview_sessions', count(*) FROM public.theme_preview_sessions WHERE id IN ('${PREVIEW_A}','${PREVIEW_B}');
`;

const reachable = databaseReachable();
const skip = reachable
  ? false
  : `Supabase Postgres container "${container}" is not reachable; theme RLS behaviour cannot be observed without it (start the local Supabase stack, or set LETBUYY_SUPABASE_PG_CONTAINER)`;

describe('theme tenant isolation (migration 196 RLS, live schema)', { skip }, () => {
  let checks;

  before(() => {
    checks = parseChecks(psql(SCENARIO_SQL));
  });

  after(() => {
    const residue = parseChecks(psql(RESIDUE_SQL));
    assert.ok(residue.size > 0, 'the residue query must return rows');
    for (const [name, value] of residue) {
      assert.equal(value, 0, `${name} must be empty after the scenario rolls back`);
    }
  });

  it('seeds both tenants before any isolation claim is made', () => {
    assert.equal(checks.get('fixture.sites'), 2);
    assert.equal(checks.get('fixture.themes'), 3);
    assert.equal(checks.get('fixture.theme_instances'), 2);
    assert.equal(checks.get('fixture.theme_releases'), 2);
    assert.equal(checks.get('fixture.theme_editor_drafts'), 2);
    assert.equal(checks.get('fixture.theme_preview_sessions'), 2);
  });

  it('keeps the theme tables ENABLE + FORCE with the baseline catalog policy gone', () => {
    assert.equal(
      checks.get('posture.baseline_themes_policy'),
      0,
      'the USING (true) baseline policy migration 196 replaced must not be back',
    );
    for (const table of FORCED_THEME_TABLES) {
      assert.equal(checks.get(`posture.forced.${table}`), 1, `${table} must FORCE row level security`);
    }
  });

  it('shows a merchant its own site-private theme and not the other tenant\'s', () => {
    // Positive control first: without it, a policy that denies everything would pass.
    assert.equal(checks.get('owner_a.themes.own_private'), 1, 'site A owner must read site A\'s private theme');
    assert.equal(checks.get('owner_a.themes.other_private'), 0, 'site A owner must not read site B\'s private theme');
    assert.equal(checks.get('owner_b.themes.own_private'), 1, 'site B owner must read site B\'s private theme');
    assert.equal(checks.get('owner_b.themes.other_private'), 0, 'site B owner must not read site A\'s private theme');
  });

  it('scopes every theme read to the tenant named by app.site_id', () => {
    assert.equal(checks.get('guc_a.themes.catalog'), 1, 'the marketplace catalog must stay readable');

    for (const table of ['theme_instances', 'theme_releases', 'theme_editor_drafts', 'theme_preview_sessions']) {
      assert.equal(checks.get(`guc_a.${table}.own`), 1, `site A must read its own ${table} row`);
      assert.equal(checks.get(`guc_a.${table}.other`), 0, `site A must not read site B's ${table} row`);
      assert.equal(checks.get(`guc_b.${table}.own`), 1, `site B must read its own ${table} row`);
      assert.equal(checks.get(`guc_b.${table}.other`), 0, `site B must not read site A's ${table} row`);
    }
  });

  it('returns zero rows from every forced theme table when no tenant context is set', () => {
    assert.equal(checks.get('no_guc.theme_instances'), 0);
    assert.equal(checks.get('no_guc.theme_releases'), 0);
    assert.equal(checks.get('no_guc.theme_editor_drafts'), 0);
    assert.equal(checks.get('no_guc.theme_preview_sessions'), 0);

    // themes has no tenant GUC policy: it fails closed on the discriminator instead.
    assert.equal(checks.get('no_guc.themes.private_a'), 0, 'a site-private theme must never surface on a public read');
    assert.equal(checks.get('no_guc.themes.private_b'), 0, 'a site-private theme must never surface on a public read');
    assert.equal(checks.get('no_guc.themes.catalog'), 1, 'the public catalog row proves the read itself is alive');
  });

  it('matches the policies migration 196 declares', () => {
    // Ties the observed behaviour to its source, so a silent policy edit outside the
    // migration cannot leave the suite green.
    const migration = readFileSync(join(repoRoot, 'database/supabase/migrations/196_theme_rls_tenant_hardening.sql'), 'utf8');
    assert.match(migration, /DROP POLICY IF EXISTS "Themes are viewable by everyone" ON public\.themes;/);
    assert.match(migration, /CREATE POLICY themes_public_catalog_read[\s\S]*?is_active = true AND COALESCE\(is_site_private, false\) = false/);
    assert.match(migration, /CREATE POLICY themes_site_owner_read[\s\S]*?sites\.id = themes\.owned_by_site_id/);
    // 196 forces `themes` itself; the store-scoped theme tables were already forced by
    // 164_d4_tenant_role_guc, which is why the runtime posture check above covers all five.
    assert.match(migration, /ALTER TABLE IF EXISTS public\.themes FORCE ROW LEVEL SECURITY;/);
    assert.match(
      readFileSync(join(repoRoot, 'database/supabase/migrations/164_d4_tenant_role_guc.sql'), 'utf8'),
      /ALTER TABLE public\.%I FORCE ROW LEVEL SECURITY/,
    );
  });
});
