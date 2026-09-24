// APPID-SEC1 — migration 256 on real Postgres: SECURITY DEFINER functions are out of reach of the
// Data API roles, and nobody else's access changes.
//
// Reproduce, then fix, on one database: at 255 the anon role mints a gift card through
// issue_gift_card; 256 is applied and the same call is refused. Then the claim that matters as much
// as the fix: app_tenant and service_role keep EXACTLY the EXECUTE privileges they had, function by
// function, and the rollback restores the whole privilege snapshot, not an approximation of it.
//
// DESTRUCTIVE: recreates its own database and replays every migration. Refuses the shared database.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_sec1_definer_roles';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable ? false : `refusing to recreate the shared database '${SHARED_DATABASE}'`;

const MIGRATION = 'database/supabase/migrations/256_definer_functions_off_the_data_api.sql';
const ROLLBACK = 'database/supabase/rollback/256_definer_functions_off_the_data_api.rollback.sql';
const SITE = '11111111-1111-4111-8111-00000000aaaa';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: `SET client_min_messages = warning;\n${sql}`, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
}

function psqlError(sql) {
    try {
        psql(sql);
        return null;
    } catch (error) {
        return `${error.stderr || ''}${error.stdout || ''}`;
    }
}

const lastLine = (out) => out.split('\n').map((l) => l.trim()).filter(Boolean).at(-1) || '';
const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (relativePath) => psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));

function migrationsBefore(number) {
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((n) => n.endsWith('.sql') && parseInt(n, 10) < number)
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
}

// One line per SECURITY DEFINER function: signature and EXECUTE for each role that matters.
const SNAPSHOT_SQL = `
SELECT p.oid::regprocedure::text || '|' ||
       has_function_privilege('anon', p.oid, 'EXECUTE') || '|' ||
       has_function_privilege('authenticated', p.oid, 'EXECUTE') || '|' ||
       has_function_privilege('app_tenant', p.oid, 'EXECUTE') || '|' ||
       has_function_privilege('service_role', p.oid, 'EXECUTE') || '|' ||
       EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.prosecdef
 ORDER BY 1;`;
const snapshot = () => new Map(psql(SNAPSHOT_SQL).split('\n').filter(Boolean).map((line) => {
    const [sig, anon, authenticated, appTenant, serviceRole, viaPublic] = line.split('|');
    return [sig, { anon, authenticated, appTenant, serviceRole, viaPublic }];
}));
const defaultAcl = () => psql(`SELECT coalesce(string_agg(defaclacl::text, ','), 'none') FROM pg_default_acl WHERE defaclobjtype = 'f';`);
const mintAs = (role, code) => psqlError(`BEGIN; SET LOCAL ROLE ${role}; SELECT public.issue_gift_card(p_store_id => '${SITE}'::uuid, p_code => '${code}', p_initial_value => 5000, p_idempotency_key => '${code}'); COMMIT;`);

let before255;
let before255DefaultAcl;

after(() => {
    if (!runnable) return;
    try { psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres'); } catch { /* cleanup only */ }
});

before(() => {
    if (!runnable) return;
    psql(`DROP DATABASE IF EXISTS "${databaseName}";`, 'postgres');
    psql(`CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
    for (const name of migrationsBefore(256)) applySqlFile(`database/supabase/migrations/${name}`);
    psql(`INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published) VALUES ('${SITE}', 'Demo', 'Demo', 'store', 'demo', true);`);
    before255 = snapshot();
    before255DefaultAcl = defaultAcl();
});

test('at 255 the anon role mints a gift card through the Data API role path', { skip }, () => {
    assert.equal(mintAs('anon', 'ANON-MINT-0001'), null, 'the defect did not reproduce; the suite would prove nothing');
    assert.equal(psql(`SELECT count(*) FROM public.gift_card_accounts WHERE site_id = '${SITE}';`), '1');
    const open = [...before255.values()].filter((row) => row.anon === 'true' || row.authenticated === 'true').length;
    assert.ok(open > 100, `expected most definer functions to be open at 255, found ${open}`);
});

test('after 256 neither anon nor authenticated can call any definer function but the policy predicate', { skip }, () => {
    applySqlFile(MIGRATION);
    for (const role of ['anon', 'authenticated']) {
        assert.match(mintAs(role, `${role.toUpperCase()}-MINT-0002`) || 'CALL SUCCEEDED', /permission denied for function issue_gift_card/, `${role} still mints`);
    }
    assert.equal(psql(`SELECT count(*) FROM public.gift_card_accounts WHERE site_id = '${SITE}';`), '1', 'no card may be minted after 256');
    const after256 = snapshot();
    const stillOpen = [...after256.entries()].filter(([, row]) => row.anon === 'true' || row.authenticated === 'true').map(([sig]) => sig);
    assert.deepEqual(stillOpen, ['is_super_admin()'], 'only the function RLS policies call may stay executable');
});

test('app_tenant and service_role keep exactly the access they had, function by function', { skip }, () => {
    const after256 = snapshot();
    assert.equal(after256.size, before255.size);
    const changed = [];
    for (const [sig, was] of before255) {
        const now = after256.get(sig);
        if (!now) { changed.push(`${sig} disappeared`); continue; }
        if (now.appTenant !== was.appTenant) changed.push(`${sig} app_tenant ${was.appTenant} -> ${now.appTenant}`);
        if (now.serviceRole !== was.serviceRole) changed.push(`${sig} service_role ${was.serviceRole} -> ${now.serviceRole}`);
    }
    assert.deepEqual(changed, []);
    // And the gateway's own path still works: service_role mints.
    assert.equal(mintAs('service_role', 'SERVICE-MINT-0003'), null);
});

test('new functions no longer inherit EXECUTE for the Data API roles', { skip }, () => {
    assert.match(before255DefaultAcl, /anon=X/);
    assert.doesNotMatch(defaultAcl(), /anon=X|authenticated=X/);
    psql(`CREATE FUNCTION public.sec1_probe() RETURNS int LANGUAGE sql SECURITY DEFINER AS 'select 1';
          REVOKE ALL ON FUNCTION public.sec1_probe() FROM PUBLIC;`);
    assert.equal(psql(`SELECT has_function_privilege('anon', 'public.sec1_probe()', 'EXECUTE')::text;`), 'false');
    psql(`DROP FUNCTION public.sec1_probe();`);
});

test('the journal is readable by no API or tenant role', { skip }, () => {
    assert.ok(Number(psql(`SELECT count(*) FROM public.migration_privilege_journal WHERE migration = '256';`)) > 100);
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.match(psqlError(`BEGIN; SET LOCAL ROLE ${role}; SELECT count(*) FROM public.migration_privilege_journal; COMMIT;`) || 'READ SUCCEEDED', /permission denied/, role);
    }
});

test('the rollback restores the privilege snapshot exactly, and 256 re-applies', { skip }, () => {
    applySqlFile(ROLLBACK);
    const restored = snapshot();
    const differences = [];
    for (const [sig, was] of before255) {
        const now = restored.get(sig);
        if (JSON.stringify(now) !== JSON.stringify(was)) differences.push(`${sig}: ${JSON.stringify(was)} -> ${JSON.stringify(now)}`);
    }
    assert.deepEqual(differences, []);
    assert.equal(defaultAcl(), before255DefaultAcl);
    assert.equal(lastLine(psql(`SELECT to_regclass('public.migration_privilege_journal') IS NULL;`)), 't');
    applySqlFile(MIGRATION);
    assert.match(mintAs('anon', 'ANON-MINT-0004') || 'CALL SUCCEEDED', /permission denied/);
});
