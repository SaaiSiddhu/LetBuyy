/**
 * Theme tenant isolation — two-tenant proof of the theme RLS (AGENTS.md TEST-R4, ART-08/09, SEC-R1).
 *
 * Migration 196 replaced the baseline `USING (true)` catalog policy on public.themes and completed FORCE ROW
 * LEVEL SECURITY across the theme tables. A migration-text assertion cannot show that the resulting policies
 * deny anything, so this suite builds a database from the real migrations (in an owned, disposable cluster:
 * scripts/governance/run-executable-suites.mjs) and reads two tenants' theme state back through the roles
 * that could ever reach it.
 *
 * THREE ACCESS PATHS, KEPT APART (the earlier version of this suite mixed them, and so proved neither)
 *   identity path   the Data API roles, `authenticated` and `anon`, carrying request.jwt.claims. public.themes is
 *                   guarded by the caller's identity: themes_site_owner_read matches auth.uid() against the site's
 *                   owner, themes_public_catalog_read shows live catalog rows to anyone. There is no tenant-GUC
 *                   policy on `themes`, so `app.site_id` is not an identity for a site-private theme.
 *   tenant path     `app_tenant` with `app.site_id`, the role the gateway assumes for tenant traffic. It is the
 *                   role of the store-scoped theme tables (theme_instances, theme_releases, theme_editor_drafts,
 *                   theme_preview_sessions), each behind a GUC policy from migration 164.
 *   backend path    `service_role` (BYPASSRLS). Every gateway read of public.themes is made through it.
 *
 * WHAT IS PROVED, AND WHAT IS NOT
 * The suite proves the POLICY layer: for a role that holds privileges on the table, the policies alone decide
 * who sees and writes which row. Migration 196 names exactly that threat ("any role holding SELECT on the
 * table"), so the scenario grants the three non-backend roles SELECT and DML on public.themes inside its own
 * transaction. That grant is rolled back with everything else and is NOT a claim about production: which roles
 * hold privileges is decided by grants, not by policies, and no migration gives `app_tenant` anything on
 * public.themes (a table older than migration 164's default privileges). That fact is pinned separately
 * (posture.app_tenant.themes_select, measured before the scenario grants) so a later blanket grant shows up.
 *
 * The caller's identity comes from the fixture's claims-derived auth.uid() (supabase-faithful-bootstrap.mjs,
 * verified on its own in supabase-faithful-auth-uid-postgres.test.mjs). Under the old NULL stub the
 * site-owner policy could never match and its positive control could not be shown.
 *
 * SHAPE
 * Every negative is paired with a positive control read in the same scenario, so an empty database, a broken
 * fixture or a policy that denies everything cannot make the suite green. Each expectation lives in a table
 * (reader x theme, writer x attempt) and is checked by one function, `violations`, that the negative-control
 * tests reuse: eight deliberately broken policy sets must each be reported by the check written to catch them.
 * The scenario runs in one transaction that always ends in ROLLBACK (`after` re-checks that from a fresh
 * session, ACL included), and a second script proves an identity and a tenant context end with the
 * transaction that set them.
 *
 * A database that cannot be reached is a FAILURE here, never a skip: FBR-44 recorded this suite passing by
 * running nothing. Run it through `pnpm run test:behavioral`, or point LETBUYY_EXECUTABLE_PG_CONTAINER at a
 * throwaway Postgres 16.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from '../executable/supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_theme_tenant_isolation';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
  ? false
  : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
    'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const OWNER_A = 'aaaaaaaa-0000-4000-8000-00000000000f';
const OWNER_B = 'bbbbbbbb-0000-4000-8000-00000000000f';
const CUSTOM_C = 'dddddddd-0000-4000-8000-00000000000f';
const SITE_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const SITE_B = 'bbbbbbbb-0000-4000-8000-000000000001';
const SITE_C = 'dddddddd-0000-4000-8000-000000000001';
const SITE_D = 'eeeeeeee-0000-4000-8000-000000000001';
const PACKAGE_ID = 'cccccccc-0000-4000-8000-000000000001';
const PACKAGE_VERSION_ID = 'cccccccc-0000-4000-8000-000000000002';
const THEME_A = 'aaaaaaaa-0000-4000-8000-000000000010';
const THEME_B = 'bbbbbbbb-0000-4000-8000-000000000010';
const THEME_C = 'dddddddd-0000-4000-8000-000000000010';
const THEME_D = 'eeeeeeee-0000-4000-8000-000000000010';
const THEME_CATALOG = 'cccccccc-0000-4000-8000-000000000010';
const THEME_CATALOG_INACTIVE = 'cccccccc-0000-4000-8000-000000000011';
const THEME_ORPHAN = 'cccccccc-0000-4000-8000-000000000012';
const INSTANCE_A = 'aaaaaaaa-0000-4000-8000-000000000020';
const INSTANCE_B = 'bbbbbbbb-0000-4000-8000-000000000020';
const RELEASE_A = 'aaaaaaaa-0000-4000-8000-000000000030';
const RELEASE_B = 'bbbbbbbb-0000-4000-8000-000000000030';
const DRAFT_A = 'aaaaaaaa-0000-4000-8000-000000000040';
const DRAFT_B = 'bbbbbbbb-0000-4000-8000-000000000040';
const PREVIEW_A = 'aaaaaaaa-0000-4000-8000-000000000050';
const PREVIEW_B = 'bbbbbbbb-0000-4000-8000-000000000050';

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const nullable = (value) => (value === null || value === undefined ? 'NULL' : q(value));

function psql(sql, targetDatabase = databaseName) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt', '-F', '|'],
    { input: `SET client_min_messages TO warning;\n${sql}`, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}

/** `name|value` lines to a Map, so every assertion names the fact it reads. */
function parseChecks(output) {
  const checks = new Map();
  for (const line of output.split('\n')) {
    const [name, value] = line.trim().split('|');
    if (name && value !== undefined) checks.set(name, value);
  }
  return checks;
}

const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');

function listMigrations() {
  return readdirSync(join(repoRoot, 'database/supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => {
      const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
      const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
      return na - nb || a.localeCompare(b);
    });
}

function buildDatabase() {
  try {
    psql('SELECT 1;', 'postgres');
  } catch (error) {
    const reason = String(error.stderr || error.message).split('\n').find(Boolean) ?? 'unknown error';
    throw new Error(
      `Postgres container "${containerName}" is not reachable (${reason}). This suite proves the theme RLS on a database it builds ` +
        'itself and cannot be skipped: run it through `pnpm run test:behavioral` (owned clusters), or point ' +
        'LETBUYY_EXECUTABLE_PG_CONTAINER at a throwaway Postgres 16.',
    );
  }
  psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE); CREATE DATABASE "${databaseName}";`, 'postgres');
  psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
  for (const name of listMigrations()) {
    try {
      psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8')));
    } catch (error) {
      throw new Error(`migration ${name} failed to apply: ${String(error.stderr || error.message).split('\n').find(Boolean)}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Fixtures: two merchants with private state, a custom-auth merchant, a soft-deleted site, a catalog theme.
// Private state lives on unpublished (draft) sites on purpose: the storefront policies
// (theme_instances_public_active_read, theme_releases_public_current_read) grant anyone the active/current
// rows of a PUBLISHED site by design, so isolation of tenant-private state is measured where the identity or
// tenant policy is the only gate. Site C is published because a custom-auth owner's identity can only reach a
// site row that its role can see (see the note on `custom_site` below).
// ---------------------------------------------------------------------------------------------------------

const FIXTURE_SQL = `
INSERT INTO public.users (id, email) VALUES
  (${q(OWNER_A)}, 'lb-theme-iso-owner-a@example.invalid'),
  (${q(OWNER_B)}, 'lb-theme-iso-owner-b@example.invalid');
INSERT INTO public.users_custom (id, email) VALUES (${q(CUSTOM_C)}, 'lb-theme-iso-custom-c@example.invalid');

INSERT INTO public.theme_packages (id, slug, name) VALUES (${q(PACKAGE_ID)}, 'lb-theme-iso-package', 'LB Theme Isolation Package');
INSERT INTO public.theme_package_versions (id, theme_package_id, version) VALUES (${q(PACKAGE_VERSION_ID)}, ${q(PACKAGE_ID)}, '1.0.0');

INSERT INTO public.sites (id, user_id, custom_user_id, name, store_name, site_type, subdomain, status, deleted_at) VALUES
  (${q(SITE_A)}, ${q(OWNER_A)}, NULL, 'LB Theme Isolation A', 'lb-theme-iso-a', 'store', 'lb-theme-iso-a', 'draft', NULL),
  (${q(SITE_B)}, ${q(OWNER_B)}, NULL, 'LB Theme Isolation B', 'lb-theme-iso-b', 'store', 'lb-theme-iso-b', 'draft', NULL),
  (${q(SITE_C)}, NULL, ${q(CUSTOM_C)}, 'LB Theme Isolation C', 'lb-theme-iso-c', 'store', 'lb-theme-iso-c', 'published', NULL),
  (${q(SITE_D)}, ${q(OWNER_A)}, NULL, 'LB Theme Isolation D (deleted)', 'lb-theme-iso-d', 'store', 'lb-theme-iso-d', 'draft', now());

INSERT INTO public.themes (id, name, slug, is_active, is_site_private, owned_by_site_id) VALUES
  (${q(THEME_A)}, 'LB Theme Iso A Private', 'lb-theme-iso-a-private', true, true, ${q(SITE_A)}),
  (${q(THEME_B)}, 'LB Theme Iso B Private', 'lb-theme-iso-b-private', true, true, ${q(SITE_B)}),
  (${q(THEME_C)}, 'LB Theme Iso C Private', 'lb-theme-iso-c-private', true, true, ${q(SITE_C)}),
  (${q(THEME_D)}, 'LB Theme Iso D Private', 'lb-theme-iso-d-private', true, true, ${q(SITE_D)}),
  (${q(THEME_CATALOG)}, 'LB Theme Iso Catalog', 'lb-theme-iso-catalog', true, false, NULL),
  (${q(THEME_CATALOG_INACTIVE)}, 'LB Theme Iso Catalog Inactive', 'lb-theme-iso-catalog-inactive', false, false, NULL),
  (${q(THEME_ORPHAN)}, 'LB Theme Iso Orphan Private', 'lb-theme-iso-orphan', true, true, NULL);

INSERT INTO public.theme_instances (id, store_id, theme_package_id, theme_package_version_id, theme_slug, instance_status) VALUES
  (${q(INSTANCE_A)}, ${q(SITE_A)}, ${q(PACKAGE_ID)}, ${q(PACKAGE_VERSION_ID)}, 'lb-theme-iso-a-private', 'installed'),
  (${q(INSTANCE_B)}, ${q(SITE_B)}, ${q(PACKAGE_ID)}, ${q(PACKAGE_VERSION_ID)}, 'lb-theme-iso-b-private', 'installed');

-- Superseded, not current: a historical release is tenant-private state, so the storefront's public
-- current-release policy cannot account for its visibility.
INSERT INTO public.theme_releases (id, store_id, theme_id, release_version, release_status, is_current) VALUES
  (${q(RELEASE_A)}, ${q(SITE_A)}, 'lb-theme-iso-a-private', 1, 'superseded', false),
  (${q(RELEASE_B)}, ${q(SITE_B)}, 'lb-theme-iso-b-private', 1, 'superseded', false);

INSERT INTO public.theme_editor_drafts (id, store_id, theme_id) VALUES
  (${q(DRAFT_A)}, ${q(SITE_A)}, 'lb-theme-iso-a-private'),
  (${q(DRAFT_B)}, ${q(SITE_B)}, 'lb-theme-iso-b-private');

INSERT INTO public.theme_preview_sessions (id, store_id, theme_id, token_hash, expires_at) VALUES
  (${q(PREVIEW_A)}, ${q(SITE_A)}, 'lb-theme-iso-a-private', 'lb-theme-iso-token-a', now() + interval '1 hour'),
  (${q(PREVIEW_B)}, ${q(SITE_B)}, 'lb-theme-iso-b-private', 'lb-theme-iso-token-b', now() + interval '1 hour');
`;

const THEME_IDS = [THEME_A, THEME_B, THEME_C, THEME_D, THEME_CATALOG, THEME_CATALOG_INACTIVE, THEME_ORPHAN];
const FORCED_THEME_TABLES = ['themes', 'theme_instances', 'theme_releases', 'theme_editor_drafts', 'theme_preview_sessions'];
const STORE_SCOPED = {
  theme_instances: [INSTANCE_A, INSTANCE_B],
  theme_releases: [RELEASE_A, RELEASE_B],
  theme_editor_drafts: [DRAFT_A, DRAFT_B],
  theme_preview_sessions: [PREVIEW_A, PREVIEW_B],
};

/**
 * The privilege precondition of the POLICY proof, granted inside the scenario transaction and rolled back with
 * it: the three non-backend roles hold SELECT and DML on public.themes, and the Data API roles can read sites
 * (the owner policy reads it, as the caller, through sites' own RLS). Nothing here is a production claim.
 */
const PRIVILEGE_SQL = `
GRANT SELECT ON public.sites TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.themes TO anon, authenticated, app_tenant;
`;

/**
 * Runs one statement as a caller: the role, the request claims and the tenant GUC are set for that statement
 * alone and restored after. It answers a count, 'rows:<n>' for a write, or 'error:<sqlstate>', so a denial is
 * an observed outcome and cannot be mistaken for an empty table or hide inside an aborted transaction.
 */
const CALLER_HELPER_SQL = `
CREATE FUNCTION pg_temp.as_caller(p_role text, p_claims text, p_guc text, p_sql text, p_count boolean)
RETURNS text LANGUAGE plpgsql AS $helper$
DECLARE
  affected bigint;
  outcome text;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  PERFORM set_config('request.jwt.claims', coalesce(p_claims, ''), true);
  PERFORM set_config('app.site_id', coalesce(p_guc, ''), true);
  BEGIN
    IF p_count THEN
      EXECUTE 'SELECT count(*) FROM ' || p_sql INTO affected;
      outcome := affected::text;
    ELSE
      EXECUTE p_sql;
      GET DIAGNOSTICS affected = ROW_COUNT;
      outcome := 'rows:' || affected;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    outcome := 'error:' || SQLSTATE;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('app.site_id', '', true);
  RETURN outcome;
END
$helper$;
`;

// ---------------------------------------------------------------------------------------------------------
// Callers
// ---------------------------------------------------------------------------------------------------------

const READERS = {
  owner_a: { role: 'authenticated', claims: JSON.stringify({ sub: OWNER_A, role: 'authenticated' }) },
  owner_b: { role: 'authenticated', claims: JSON.stringify({ sub: OWNER_B, role: 'authenticated' }) },
  owner_c_custom_auth: { role: 'authenticated', claims: JSON.stringify({ sub: CUSTOM_C, role: 'authenticated' }) },
  authenticated_no_claims: { role: 'authenticated' },
  authenticated_no_sub: { role: 'authenticated', claims: JSON.stringify({ role: 'authenticated' }) },
  anon: { role: 'anon', claims: JSON.stringify({ role: 'anon' }) },
  tenant_a_no_identity: { role: 'app_tenant', guc: SITE_A },
  tenant_b_no_identity: { role: 'app_tenant', guc: SITE_B },
  tenant_no_context: { role: 'app_tenant' },
  service_role: { role: 'service_role' },
  // An identity that does not parse must never read as somebody: the statement may fail (Supabase's own
  // expression raises 22P02) or return nothing private, but it must not return a private row.
  authenticated_bad_sub: { role: 'authenticated', claims: '{"sub":"not-a-uuid"}' },
  authenticated_bad_document: { role: 'authenticated', claims: 'not json' },
};
const MALFORMED_READERS = ['authenticated_bad_sub', 'authenticated_bad_document'];

// What each reader sees of public.themes, one row per reader, one column per theme.
//   a, b              the two merchants' private themes
//   catalog           live and not private: the marketplace catalog
//   catalog_inactive  a catalog row that is switched off
//   orphan            private with no owning site: nobody's
//   deleted_site      private, owned by a soft-deleted site of owner A
//   custom_site       private, owned by a published site whose owner signs in as a custom-auth user
// `custom_site` is deliberately the published site. themes_site_owner_read reads public.sites AS THE CALLER, so an
// identity reaches a site row only through sites' own policies; for a draft site owned through custom_user_id
// none of them matches (users_manage_own_stores keys on user_id), which is recorded as an observation in the
// evidence and not asserted here.
const THEME_COLUMNS = ['a', 'b', 'catalog', 'catalog_inactive', 'orphan', 'deleted_site', 'custom_site'];
const THEME_ID_OF = {
  a: THEME_A,
  b: THEME_B,
  catalog: THEME_CATALOG,
  catalog_inactive: THEME_CATALOG_INACTIVE,
  orphan: THEME_ORPHAN,
  deleted_site: THEME_D,
  custom_site: THEME_C,
};
const THEME_VISIBILITY = {
  //                          a  b  cat off orph del cust
  owner_a:                  [1, 0, 1, 0, 0, 0, 0],
  owner_b:                  [0, 1, 1, 0, 0, 0, 0],
  owner_c_custom_auth:      [0, 0, 1, 0, 0, 0, 1],
  authenticated_no_claims:  [0, 0, 1, 0, 0, 0, 0],
  authenticated_no_sub:     [0, 0, 1, 0, 0, 0, 0],
  anon:                     [0, 0, 1, 0, 0, 0, 0],
  tenant_a_no_identity:     [0, 0, 1, 0, 0, 0, 0],
  tenant_b_no_identity:     [0, 0, 1, 0, 0, 0, 0],
  tenant_no_context:        [0, 0, 1, 0, 0, 0, 0],
  service_role:             [1, 1, 1, 1, 1, 1, 1],
};

// Writes attempted against public.themes by roles that hold blanket DML on it (PRIVILEGE_SQL). No policy grants a
// write, so every INSERT is refused by RLS and every UPDATE/DELETE finds no row it may touch.
const THEME_WRITERS = ['owner_a', 'anon', 'tenant_a_no_identity'];
const THEME_WRITE_ATTEMPTS = {
  insert_private_own_site: [
    `INSERT INTO public.themes (id, name, slug, is_active, is_site_private, owned_by_site_id) VALUES (gen_random_uuid(), 'lb iso attempt', 'lb-theme-iso-attempt-' || gen_random_uuid(), true, true, ${q(SITE_A)})`,
    'error:42501',
  ],
  insert_catalog: [
    `INSERT INTO public.themes (id, name, slug, is_active, is_site_private, owned_by_site_id) VALUES (gen_random_uuid(), 'lb iso attempt', 'lb-theme-iso-attempt-' || gen_random_uuid(), true, false, NULL)`,
    'error:42501',
  ],
  update_own_private: [`UPDATE public.themes SET name = 'lb iso hijacked' WHERE id = ${q(THEME_A)}`, 'rows:0'],
  update_other_private: [`UPDATE public.themes SET name = 'lb iso hijacked' WHERE id = ${q(THEME_B)}`, 'rows:0'],
  update_catalog: [`UPDATE public.themes SET name = 'lb iso hijacked' WHERE id = ${q(THEME_CATALOG)}`, 'rows:0'],
  delete_own_private: [`DELETE FROM public.themes WHERE id = ${q(THEME_A)}`, 'rows:0'],
  delete_other_private: [`DELETE FROM public.themes WHERE id = ${q(THEME_B)}`, 'rows:0'],
  delete_catalog: [`DELETE FROM public.themes WHERE id = ${q(THEME_CATALOG)}`, 'rows:0'],
};

// Writes to a store-scoped table under the tenant GUC. The own-store rows are positive controls: the same role
// and the same table accept a write for their own tenant, so the refusals are the policy and not a missing
// privilege.
const TENANT_WRITE_TABLE = 'theme_preview_sessions';
const newPreview = (store, theme) =>
  `INSERT INTO public.theme_preview_sessions (id, store_id, theme_id, token_hash, expires_at) VALUES (gen_random_uuid(), ${q(store)}, ${q(theme)}, 'lb-theme-iso-token-' || gen_random_uuid(), now() + interval '1 hour')`;
const TENANT_WRITE_ATTEMPTS = {
  tenant_a_no_identity: {
    insert_own_store: [newPreview(SITE_A, 'lb-theme-iso-a-private'), 'rows:1'],
    insert_other_store: [newPreview(SITE_B, 'lb-theme-iso-b-private'), 'error:42501'],
    update_own_store: [`UPDATE public.theme_preview_sessions SET theme_id = 'lb-theme-iso-a-private' WHERE id = ${q(PREVIEW_A)}`, 'rows:1'],
    update_other_store: [`UPDATE public.theme_preview_sessions SET theme_id = 'lb-theme-iso-hijacked' WHERE id = ${q(PREVIEW_B)}`, 'rows:0'],
    move_own_row_to_other_store: [`UPDATE public.theme_preview_sessions SET store_id = ${q(SITE_B)} WHERE id = ${q(PREVIEW_A)}`, 'error:42501'],
    delete_other_store: [`DELETE FROM public.theme_preview_sessions WHERE id = ${q(PREVIEW_B)}`, 'rows:0'],
  },
  tenant_no_context: {
    insert: [newPreview(SITE_A, 'lb-theme-iso-a-private'), 'error:42501'],
    update_a: [`UPDATE public.theme_preview_sessions SET theme_id = 'lb-theme-iso-hijacked' WHERE id = ${q(PREVIEW_A)}`, 'rows:0'],
    update_b: [`UPDATE public.theme_preview_sessions SET theme_id = 'lb-theme-iso-hijacked' WHERE id = ${q(PREVIEW_B)}`, 'rows:0'],
    delete_a: [`DELETE FROM public.theme_preview_sessions WHERE id = ${q(PREVIEW_A)}`, 'rows:0'],
    delete_b: [`DELETE FROM public.theme_preview_sessions WHERE id = ${q(PREVIEW_B)}`, 'rows:0'],
  },
};

// ---------------------------------------------------------------------------------------------------------
// The scenario: one transaction, always rolled back
// ---------------------------------------------------------------------------------------------------------

function asReader(name, readerKey, sql, counting) {
  const reader = READERS[readerKey];
  return `INSERT INTO lb_iso VALUES (${q(name)}, pg_temp.as_caller(${q(reader.role)}, ${nullable(reader.claims)}, ${nullable(reader.guc)}, ${q(sql)}, ${counting}));`;
}
const countAs = (name, readerKey, from) => asReader(name, readerKey, from, true);
const writeAs = (name, readerKey, statement) => asReader(name, readerKey, statement, false);

function checksSql() {
  // A negative control's broken policy goes in first: the posture rows below must describe the set that is about
  // to be exercised, so a posture regression is reported like any other.
  const lines = [PREAMBLE_MARKER];

  // Seed proof and posture, read as the owner BEFORE any grant: every later zero must mean "denied", never
  // "the fixture was not created", and the posture rows describe what the migrations built.
  lines.push(`INSERT INTO lb_iso VALUES ('fixture.sites', (SELECT count(*) FROM public.sites WHERE id IN (${[SITE_A, SITE_B, SITE_C, SITE_D].map(q)})));`);
  lines.push(`INSERT INTO lb_iso VALUES ('fixture.themes', (SELECT count(*) FROM public.themes WHERE id IN (${THEME_IDS.map(q)})));`);
  for (const [table, ids] of Object.entries(STORE_SCOPED)) {
    lines.push(`INSERT INTO lb_iso VALUES (${q(`fixture.${table}`)}, (SELECT count(*) FROM public.${table} WHERE id IN (${ids.map(q)})));`);
  }
  lines.push(`INSERT INTO lb_iso VALUES ('posture.baseline_themes_policy', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'themes' AND policyname = 'Themes are viewable by everyone'));`);
  lines.push(`INSERT INTO lb_iso VALUES ('posture.themes_policies', (SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'themes'));`);
  lines.push(`INSERT INTO lb_iso VALUES ('posture.app_tenant.themes_select', has_table_privilege('app_tenant', 'public.themes', 'SELECT')::text);`);
  for (const table of FORCED_THEME_TABLES) {
    lines.push(`INSERT INTO lb_iso VALUES (${q(`posture.forced.${table}`)}, (SELECT relforcerowsecurity::text FROM pg_class WHERE oid = ${q(`public.${table}`)}::regclass));`);
  }

  lines.push(PRIVILEGE_SQL);

  // public.themes, reader x theme.
  for (const readerKey of [...Object.keys(THEME_VISIBILITY), ...MALFORMED_READERS]) {
    for (const column of THEME_COLUMNS) {
      lines.push(countAs(`themes.${readerKey}.${column}`, readerKey, `public.themes WHERE id = ${q(THEME_ID_OF[column])}`));
    }
  }

  // The store-scoped theme tables, under the tenant GUC.
  for (const readerKey of ['tenant_a_no_identity', 'tenant_b_no_identity', 'tenant_no_context']) {
    for (const [table, [idA, idB]] of Object.entries(STORE_SCOPED)) {
      lines.push(countAs(`guc.${readerKey}.${table}.a`, readerKey, `public.${table} WHERE id = ${q(idA)}`));
      lines.push(countAs(`guc.${readerKey}.${table}.b`, readerKey, `public.${table} WHERE id = ${q(idB)}`));
    }
  }
  for (const [table, ids] of Object.entries(STORE_SCOPED)) {
    lines.push(countAs(`guc.service_role.${table}.both`, 'service_role', `public.${table} WHERE id IN (${ids.map(q)})`));
  }

  // Forbidden writes.
  for (const writer of THEME_WRITERS) {
    for (const [attempt, [statement]] of Object.entries(THEME_WRITE_ATTEMPTS)) {
      lines.push(writeAs(`write.themes.${writer}.${attempt}`, writer, statement));
    }
  }
  for (const [writer, attempts] of Object.entries(TENANT_WRITE_ATTEMPTS)) {
    for (const [attempt, [statement]] of Object.entries(attempts)) {
      lines.push(writeAs(`write.${TENANT_WRITE_TABLE}.${writer}.${attempt}`, writer, statement));
    }
  }

  // What is left, read as the owner: the writes above changed nothing that was not the caller's own.
  lines.push(`INSERT INTO lb_iso VALUES ('after.themes.fixture_rows', (SELECT count(*) FROM public.themes WHERE id IN (${THEME_IDS.map(q)})));`);
  lines.push(`INSERT INTO lb_iso VALUES ('after.themes.renamed', (SELECT count(*) FROM public.themes WHERE name = 'lb iso hijacked'));`);
  lines.push(`INSERT INTO lb_iso VALUES ('after.themes.inserted', (SELECT count(*) FROM public.themes WHERE slug LIKE 'lb-theme-iso-attempt-%'));`);
  lines.push(`INSERT INTO lb_iso VALUES ('after.preview_b.intact', (SELECT count(*) FROM public.theme_preview_sessions WHERE id = ${q(PREVIEW_B)} AND store_id = ${q(SITE_B)} AND theme_id = 'lb-theme-iso-b-private'));`);
  lines.push(`INSERT INTO lb_iso VALUES ('after.preview_a.still_site_a', (SELECT count(*) FROM public.theme_preview_sessions WHERE id = ${q(PREVIEW_A)} AND store_id = ${q(SITE_A)}));`);
  lines.push(`INSERT INTO lb_iso VALUES ('after.preview_site_b.rows', (SELECT count(*) FROM public.theme_preview_sessions WHERE store_id = ${q(SITE_B)}));`);
  return lines.join('\n');
}

// Where a negative control's broken policy is applied: after the fixtures, before anything is read or granted.
const PREAMBLE_MARKER = '/* preamble */';

function scenarioSql(preamble = '') {
  return `
BEGIN;
CREATE TEMP TABLE lb_iso (name text PRIMARY KEY, value text NOT NULL);
${CALLER_HELPER_SQL}
${FIXTURE_SQL}
${checksSql().replace(PREAMBLE_MARKER, () => preamble)}
SELECT name || '|' || value FROM lb_iso ORDER BY name;
ROLLBACK;
`;
}

// ---------------------------------------------------------------------------------------------------------
// Expectations: the one table `violations` reads, used for the real run and for every negative control
// ---------------------------------------------------------------------------------------------------------

function expectations() {
  const expected = new Map();
  const expect = (name, value) => expected.set(name, value);

  expect('fixture.sites', '4');
  expect('fixture.themes', String(THEME_IDS.length));
  for (const table of Object.keys(STORE_SCOPED)) expect(`fixture.${table}`, '2');
  expect('posture.baseline_themes_policy', '0');
  // Exactly the two SELECT policies of migration 196: no policy of any other command, so nothing grants a write.
  expect('posture.themes_policies', 'themes_public_catalog_read:SELECT,themes_site_owner_read:SELECT');
  expect('posture.app_tenant.themes_select', 'false');
  for (const table of FORCED_THEME_TABLES) expect(`posture.forced.${table}`, 'true');

  for (const [readerKey, row] of Object.entries(THEME_VISIBILITY)) {
    THEME_COLUMNS.forEach((column, index) => expect(`themes.${readerKey}.${column}`, String(row[index])));
  }
  for (const readerKey of MALFORMED_READERS) {
    for (const column of THEME_COLUMNS) {
      // The catalog row may still be answered (the catalog policy can be evaluated first); a private row never is.
      expect(`themes.${readerKey}.${column}`, column === 'catalog' ? ['1', 'error:22P02'] : ['0', 'error:22P02']);
    }
  }

  const ownRows = { tenant_a_no_identity: [1, 0], tenant_b_no_identity: [0, 1], tenant_no_context: [0, 0] };
  for (const [readerKey, [seesA, seesB]] of Object.entries(ownRows)) {
    for (const table of Object.keys(STORE_SCOPED)) {
      expect(`guc.${readerKey}.${table}.a`, String(seesA));
      expect(`guc.${readerKey}.${table}.b`, String(seesB));
    }
  }
  for (const table of Object.keys(STORE_SCOPED)) expect(`guc.service_role.${table}.both`, '2');

  for (const writer of THEME_WRITERS) {
    for (const [attempt, [, outcome]] of Object.entries(THEME_WRITE_ATTEMPTS)) expect(`write.themes.${writer}.${attempt}`, outcome);
  }
  for (const [writer, attempts] of Object.entries(TENANT_WRITE_ATTEMPTS)) {
    for (const [attempt, [, outcome]] of Object.entries(attempts)) expect(`write.${TENANT_WRITE_TABLE}.${writer}.${attempt}`, outcome);
  }

  expect('after.themes.fixture_rows', String(THEME_IDS.length));
  expect('after.themes.renamed', '0');
  expect('after.themes.inserted', '0');
  expect('after.preview_b.intact', '1');
  expect('after.preview_a.still_site_a', '1');
  expect('after.preview_site_b.rows', '1');
  return expected;
}

/** Every expectation the result does not meet, as 'name: expected X, got Y' (an absent check is a violation). */
function violations(checks, only = () => true) {
  const found = [];
  for (const [name, expected] of expectations()) {
    if (!only(name)) continue;
    const allowed = Array.isArray(expected) ? expected : [expected];
    const actual = checks.get(name);
    if (!allowed.includes(actual)) found.push(`${name}: expected ${allowed.join(' or ')}, got ${actual}`);
  }
  return found;
}

const startsWithAny = (...prefixes) => (name) => prefixes.some((prefix) => name.startsWith(prefix));

// ---------------------------------------------------------------------------------------------------------
// Context never crosses a transaction: an identity and a tenant context set with SET LOCAL end with the
// transaction that set them, however it ends, and a later transaction on the same session starts with neither.
// ---------------------------------------------------------------------------------------------------------

function crossTransactionSql() {
  const claims = q(JSON.stringify({ sub: OWNER_A, role: 'authenticated' }));
  const round = (label, ending) => `
BEGIN;
SET LOCAL request.jwt.claims = ${claims};
SET LOCAL app.site_id = ${q(SITE_A)};
SELECT '${label}.first.uid|' || coalesce(auth.uid()::text, 'NULL');
SELECT '${label}.first.site|' || coalesce(current_site_id()::text, 'NULL');
${ending};

BEGIN;
${FIXTURE_SQL}
${PRIVILEGE_SQL}
SELECT '${label}.second.uid|' || coalesce(auth.uid()::text, 'NULL');
SELECT '${label}.second.site|' || coalesce(current_site_id()::text, 'NULL');
SET LOCAL ROLE authenticated;
SELECT '${label}.second.authenticated.theme_a|' || count(*) FROM public.themes WHERE id = ${q(THEME_A)};
RESET ROLE;
SET LOCAL ROLE app_tenant;
SELECT '${label}.second.app_tenant.instance_a|' || count(*) FROM public.theme_instances WHERE id = ${q(INSTANCE_A)};
RESET ROLE;
-- Positive control in the same transaction: the identity and the context work when they are set again.
SET LOCAL request.jwt.claims = ${claims};
SET LOCAL app.site_id = ${q(SITE_A)};
SET LOCAL ROLE authenticated;
SELECT '${label}.second.authenticated.theme_a.set_again|' || count(*) FROM public.themes WHERE id = ${q(THEME_A)};
RESET ROLE;
SET LOCAL ROLE app_tenant;
SELECT '${label}.second.app_tenant.instance_a.set_again|' || count(*) FROM public.theme_instances WHERE id = ${q(INSTANCE_A)};
RESET ROLE;
ROLLBACK;
`;
  return round('commit', 'COMMIT') + round('rollback', 'ROLLBACK');
}

// ---------------------------------------------------------------------------------------------------------
// Negative controls: policy sets that are wrong on purpose. Each is applied inside the (rolled-back) scenario
// before the callers read, and the named check must report it.
// ---------------------------------------------------------------------------------------------------------

const ownerPolicy = (using) =>
  `DROP POLICY themes_site_owner_read ON public.themes; CREATE POLICY themes_site_owner_read ON public.themes FOR SELECT USING (${using});`;
const dropTenantPolicy = (table) =>
  `DO $broken$ BEGIN EXECUTE format('DROP POLICY %I ON public.${table}', 'app_tenant_guc_' || substr(md5('${table}'), 1, 16)); END $broken$;`;

const BROKEN_POLICY_SETS = [
  {
    name: 'the site-owner policy stops comparing the caller to the owner',
    sql: ownerPolicy('true'),
    reportedBy: 'themes.owner_a.b',
  },
  {
    name: 'the catalog policy stops excluding site-private themes',
    sql: `DROP POLICY themes_public_catalog_read ON public.themes; CREATE POLICY themes_public_catalog_read ON public.themes FOR SELECT USING (is_active = true);`,
    reportedBy: 'themes.anon.a',
  },
  {
    name: 'the site-owner policy stops excluding deleted sites',
    sql: ownerPolicy('EXISTS (SELECT 1 FROM public.sites WHERE sites.id = themes.owned_by_site_id AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())))'),
    reportedBy: 'themes.owner_a.deleted_site',
  },
  {
    name: 'the site-owner policy forgets custom-auth owners (too strict: a positive control must catch it)',
    sql: ownerPolicy('EXISTS (SELECT 1 FROM public.sites WHERE sites.id = themes.owned_by_site_id AND sites.user_id = auth.uid() AND sites.deleted_at IS NULL)'),
    reportedBy: 'themes.owner_c_custom_auth.custom_site',
  },
  {
    name: 'a write policy appears on public.themes',
    sql: 'CREATE POLICY lb_iso_open_write ON public.themes FOR ALL USING (true) WITH CHECK (true);',
    reportedBy: 'write.themes.owner_a.insert_catalog',
  },
  {
    name: 'FORCE ROW LEVEL SECURITY is dropped from public.themes',
    sql: 'ALTER TABLE public.themes NO FORCE ROW LEVEL SECURITY;',
    reportedBy: 'posture.forced.themes',
  },
  {
    name: 'a store-scoped table\'s tenant policy opens up to every tenant',
    sql: `${dropTenantPolicy(TENANT_WRITE_TABLE)} CREATE POLICY lb_iso_open ON public.${TENANT_WRITE_TABLE} FOR ALL TO app_tenant USING (true) WITH CHECK (true);`,
    reportedBy: `guc.tenant_a_no_identity.${TENANT_WRITE_TABLE}.b`,
  },
  {
    name: 'a store-scoped table\'s tenant policy is removed (deny all: a positive control must catch it)',
    sql: dropTenantPolicy(TENANT_WRITE_TABLE),
    reportedBy: `guc.tenant_a_no_identity.${TENANT_WRITE_TABLE}.a`,
  },
];

// ---------------------------------------------------------------------------------------------------------

const RESIDUE_SQL = `
SELECT 'residue.users|' || count(*) FROM public.users WHERE id IN (${[OWNER_A, OWNER_B].map(q)})
UNION ALL SELECT 'residue.users_custom|' || count(*) FROM public.users_custom WHERE id = ${q(CUSTOM_C)}
UNION ALL SELECT 'residue.theme_packages|' || count(*) FROM public.theme_packages WHERE id = ${q(PACKAGE_ID)}
UNION ALL SELECT 'residue.theme_package_versions|' || count(*) FROM public.theme_package_versions WHERE id = ${q(PACKAGE_VERSION_ID)}
UNION ALL SELECT 'residue.sites|' || count(*) FROM public.sites WHERE id IN (${[SITE_A, SITE_B, SITE_C, SITE_D].map(q)})
UNION ALL SELECT 'residue.themes|' || count(*) FROM public.themes WHERE id IN (${THEME_IDS.map(q)}) OR slug LIKE 'lb-theme-iso-%'
${Object.entries(STORE_SCOPED).map(([table, ids]) => `UNION ALL SELECT 'residue.${table}|' || count(*) FROM public.${table} WHERE id IN (${ids.map(q)}) OR store_id IN (${[SITE_A, SITE_B].map(q)})`).join('\n')};
`;

describe('theme tenant isolation (theme RLS, database built from the migrations)', { skip }, () => {
  let checks;

  before(() => {
    buildDatabase();
    checks = parseChecks(psql(scenarioSql()));
  });

  after(() => {
    const residue = parseChecks(psql(RESIDUE_SQL));
    assert.ok(residue.size > 0, 'the residue query must return rows');
    for (const [name, value] of residue) assert.equal(value, '0', `${name} must be empty after the scenario rolls back`);
    // The scenario's GRANTs are rolled back too: a role that could read public.themes only inside it must not afterwards.
    assert.equal(psql("SELECT has_table_privilege('app_tenant', 'public.themes', 'SELECT')::text;"), 'false', 'a grant made inside the rolled-back scenario outlived it');
  });

  it('seeds both tenants, the custom-auth merchant and the catalog before any isolation claim is made', () => {
    assert.deepEqual(violations(checks, startsWithAny('fixture.')), []);
    // The backend role reads all of it: the runtime path exists, and every zero below is a denial of a real row.
    assert.deepEqual(violations(checks, startsWithAny('themes.service_role.', 'guc.service_role.')), []);
  });

  it('keeps FORCE ROW LEVEL SECURITY, exactly the two SELECT policies and no privilege for the tenant role on public.themes', () => {
    assert.deepEqual(violations(checks, startsWithAny('posture.')), []);
  });

  it('shows a merchant its own site-private themes and not another tenant\'s (positive control first, both directions)', () => {
    assert.deepEqual(violations(checks, startsWithAny('themes.owner_a.', 'themes.owner_b.')), []);
    // Named, so a failure reads as a sentence: the controls that make the denials mean something.
    assert.equal(checks.get('themes.owner_a.a'), '1', 'the owner of site A must read site A\'s private theme');
    assert.equal(checks.get('themes.owner_b.b'), '1', 'the owner of site B must read site B\'s private theme');
    assert.equal(checks.get('themes.owner_a.b'), '0', 'the owner of site A must not read site B\'s private theme');
    assert.equal(checks.get('themes.owner_b.a'), '0', 'the owner of site B must not read site A\'s private theme');
  });

  it('honours a custom-auth owner on a site it can see, no one else\'s claim on it, and stops at a soft-deleted site', () => {
    assert.deepEqual(violations(checks, startsWithAny('themes.owner_c_custom_auth.')), []);
    assert.equal(checks.get('themes.owner_c_custom_auth.custom_site'), '1');
    assert.equal(checks.get('themes.owner_a.custom_site'), '0');
    assert.equal(checks.get('themes.owner_a.deleted_site'), '0', 'a deleted site\'s owner must lose its private themes');
  });

  it('shows the live marketplace catalog to every reader, and neither an inactive catalog row nor an ownerless private one', () => {
    for (const readerKey of Object.keys(THEME_VISIBILITY).filter((key) => key !== 'service_role')) {
      assert.equal(checks.get(`themes.${readerKey}.catalog`), '1', `${readerKey} must read the public catalog`);
      assert.equal(checks.get(`themes.${readerKey}.catalog_inactive`), '0', `${readerKey} must not read an inactive catalog row`);
      assert.equal(checks.get(`themes.${readerKey}.orphan`), '0', `${readerKey} must not read a private theme that has no owner`);
    }
  });

  it('exposes nothing private when the identity is absent or carries no subject', () => {
    assert.deepEqual(violations(checks, startsWithAny('themes.authenticated_no_claims.', 'themes.authenticated_no_sub.', 'themes.anon.')), []);
  });

  it('does not treat the tenant context as an identity for a site-private theme, whichever tenant it names', () => {
    // public.themes has no tenant-GUC policy. If one is ever added for a tenant's own theme, this expectation is
    // the one to change on purpose; the other tenant's theme must stay hidden either way.
    assert.deepEqual(violations(checks, startsWithAny('themes.tenant_a_no_identity.', 'themes.tenant_b_no_identity.', 'themes.tenant_no_context.')), []);
    assert.equal(checks.get('themes.tenant_a_no_identity.b'), '0');
    assert.equal(checks.get('themes.tenant_b_no_identity.a'), '0');
  });

  it('fails safe on an identity that does not parse: an error or no private row, never somebody\'s row', () => {
    assert.deepEqual(violations(checks, startsWithAny('themes.authenticated_bad_')), []);
  });

  it('scopes every store-scoped theme table to the tenant named by app.site_id, and to no rows without one', () => {
    assert.deepEqual(violations(checks, startsWithAny('guc.')), []);
    for (const table of Object.keys(STORE_SCOPED)) {
      assert.equal(checks.get(`guc.tenant_a_no_identity.${table}.a`), '1', `site A must read its own ${table} row`);
      assert.equal(checks.get(`guc.tenant_b_no_identity.${table}.b`), '1', `site B must read its own ${table} row`);
      assert.equal(checks.get(`guc.tenant_a_no_identity.${table}.b`), '0', `site A must not read site B's ${table} row`);
      assert.equal(checks.get(`guc.tenant_b_no_identity.${table}.a`), '0', `site B must not read site A's ${table} row`);
      assert.equal(checks.get(`guc.tenant_no_context.${table}.a`), '0', `${table}: no tenant context must resolve to zero rows`);
      assert.equal(checks.get(`guc.tenant_no_context.${table}.b`), '0', `${table}: no tenant context must resolve to zero rows`);
    }
  });

  it('refuses every write to public.themes from a role that holds blanket DML on it, and changes nothing', () => {
    assert.deepEqual(violations(checks, startsWithAny('write.themes.')), []);
    assert.deepEqual(violations(checks, startsWithAny('after.themes.')), []);
  });

  it('refuses a cross-tenant write on a store-scoped table, accepts the tenant\'s own, and leaves the other tenant intact', () => {
    assert.deepEqual(violations(checks, startsWithAny(`write.${TENANT_WRITE_TABLE}.`)), []);
    assert.deepEqual(violations(checks, startsWithAny('after.preview')), []);
    // The positive controls: the same role and table take a write for their own tenant.
    assert.equal(checks.get(`write.${TENANT_WRITE_TABLE}.tenant_a_no_identity.insert_own_store`), 'rows:1');
    assert.equal(checks.get(`write.${TENANT_WRITE_TABLE}.tenant_a_no_identity.update_own_store`), 'rows:1');
  });

  for (const ending of ['commit', 'rollback']) {
    it(`leaves no identity and no tenant context behind when the transaction that set them ends in ${ending.toUpperCase()}`, () => {
      const seen = parseChecks(psql(crossTransactionSql()));
      // While set, both were in force ...
      assert.equal(seen.get(`${ending}.first.uid`), OWNER_A);
      assert.equal(seen.get(`${ending}.first.site`), SITE_A);
      // ... and in the next transaction of the same session neither is, so nothing private is visible.
      assert.equal(seen.get(`${ending}.second.uid`), 'NULL', `${ending}: the identity outlived its transaction`);
      assert.equal(seen.get(`${ending}.second.site`), 'NULL', `${ending}: the tenant context outlived its transaction`);
      assert.equal(seen.get(`${ending}.second.authenticated.theme_a`), '0');
      assert.equal(seen.get(`${ending}.second.app_tenant.instance_a`), '0');
      // Same transaction, identity and context set again: both rows are there, so the zeros were the missing context.
      assert.equal(seen.get(`${ending}.second.authenticated.theme_a.set_again`), '1');
      assert.equal(seen.get(`${ending}.second.app_tenant.instance_a.set_again`), '1');
    });
  }

  it('matches the policies migration 196 declares', () => {
    // Ties the observed behaviour to its source, so a silent policy edit outside the migration cannot leave the
    // suite green. The database above is built from these files, so the text and the behaviour are one thing.
    const migration = readFileSync(join(repoRoot, 'database/supabase/migrations/196_theme_rls_tenant_hardening.sql'), 'utf8');
    assert.match(migration, /DROP POLICY IF EXISTS "Themes are viewable by everyone" ON public\.themes;/);
    assert.match(migration, /CREATE POLICY themes_public_catalog_read[\s\S]*?is_active = true AND COALESCE\(is_site_private, false\) = false/);
    assert.match(migration, /CREATE POLICY themes_site_owner_read[\s\S]*?sites\.id = themes\.owned_by_site_id/);
    // 196 forces `themes` itself; the store-scoped theme tables were already forced by 164_d4_tenant_role_guc.
    assert.match(migration, /ALTER TABLE IF EXISTS public\.themes FORCE ROW LEVEL SECURITY;/);
    assert.match(
      readFileSync(join(repoRoot, 'database/supabase/migrations/164_d4_tenant_role_guc.sql'), 'utf8'),
      /ALTER TABLE public\.%I FORCE ROW LEVEL SECURITY/,
    );
  });

  describe('a broken policy set fails the suite (negative controls)', () => {
    it('reports nothing on the real policies, so what follows is not noise', () => {
      assert.deepEqual(violations(checks), []);
    });

    for (const broken of BROKEN_POLICY_SETS) {
      it(`reports it when ${broken.name}`, () => {
        const found = violations(parseChecks(psql(scenarioSql(broken.sql))));
        assert.ok(
          found.some((line) => line.startsWith(`${broken.reportedBy}:`)),
          `${broken.reportedBy} must be reported. Reported instead: ${found.length === 0 ? 'nothing' : found.slice(0, 6).join(' | ')}`,
        );
      });
    }
  });
});
