// F-HARNESS-1/F-HARNESS-2 — the executable suites' bootstraps, policed where it actually matters.
//
// WHAT CHANGED IN F-HARNESS-2, AND WHY
// The first version of this file listed 25 suites as "still to convert" to the shared
// Supabase-faithful bootstrap. Measurement showed that was the wrong target. The suites divide by
// what they DO, not by how they look:
//
//   * FULL REPLAY — the suite enumerates database/supabase/migrations and applies all of it. Here the
//     bootstrap decides whether a result means anything: pgcrypto in `public` rather than
//     `extensions` makes an unqualified digest()/gen_random_bytes() under a narrow search_path
//     resolve when production raises. These must use the shared module.
//
//   * NAMED SUBSET / FIXTURE — the suite builds a bespoke schema (`tax-postgres` opens with
//     DROP SCHEMA public CASCADE and hand-rolls its own tables) and applies named migrations onto it,
//     or none. The shared module presumes migrations follow it, so forcing it here would be wrong,
//     not merely unnecessary. And the defect it guards against cannot reach them: not one calls a
//     pgcrypto-only function, and the two defining SECURITY DEFINER functions set no search_path.
//     Their `CREATE EXTENSION pgcrypto` is vestigial — presumably left from wanting
//     gen_random_uuid(), which has been in pg_catalog since PG13 and resolves under any search_path.
//
// So this file no longer carries a backlog. It asserts a classification, and polices the class where
// fidelity is load-bearing.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const executableDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'executable');

// Builds a database each way ON PURPOSE — it exists to prove the difference between the two schema
// layouts, so routing both halves through the shared module would delete the thing it tests.
const BOOTSTRAP_EXCEPTIONS = ['extension-schema-qualification-postgres.test.mjs'];

// Roles are CLUSTER-global: `CREATE ROLE ... IF NOT EXISTS` inherits whatever an earlier suite left,
// so a suite that creates one of the Supabase roles without dropping it or stating its attributes is
// asserting against a role it did not define. Remove a name when you fix it; do not add one.
const LEGACY_UNSTATED_ROLES = [
    // Empty as of F-HARNESS-2: every suite that creates a Supabase role now either drops it
    // first or states its attributes. Adding a name here is a regression, not a workaround.
];

const suiteNames = () => readdirSync(executableDir).filter((n) => n.endsWith('.test.mjs')).sort();
const read = (name) => readFileSync(join(executableDir, name), 'utf8');

function replaysEveryMigration(source) {
    return Boolean(/readdirSync\(\s*join\([^)]*migrations/.test(source) || source.includes('function listMigrations'));
}

const PGCRYPTO_ONLY = ['digest', 'gen_random_bytes', 'crypt', 'gen_salt', 'hmac', 'pgp_sym_encrypt', 'armor'];

test('every suite that replays all migrations uses the shared Supabase-faithful bootstrap', () => {
    const offenders = suiteNames().filter((name) =>
        replaysEveryMigration(read(name))
        && !read(name).includes('SUPABASE_FAITHFUL_BOOTSTRAP_SQL')
        && !BOOTSTRAP_EXCEPTIONS.includes(name));
    assert.deepEqual(
        offenders,
        [],
        "import SUPABASE_FAITHFUL_BOOTSTRAP_SQL from './supabase-faithful-bootstrap.mjs'. A suite that " +
        'replays every migration against pgcrypto in the wrong schema cannot fail on a schema-layout ' +
        'defect — which is how the gift-card outage stayed invisible from baseline to migration 215.',
    );
});

test('the classification is not vacuous — full-replay suites exist and are the majority of the risk', () => {
    // If replaysEveryMigration() ever stops matching, the test above would pass by finding nothing.
    const full = suiteNames().filter((name) => replaysEveryMigration(read(name)));
    assert.ok(full.length >= 15, `expected the full-replay set to be substantial, found ${full.length}`);
    assert.ok(full.includes('rollback-signature-precondition-postgres.test.mjs'));
    assert.ok(full.includes('gift-card-issue-idempotency-postgres.test.mjs'));
});

test('a fixture suite that starts using pgcrypto must move to the faithful bootstrap', () => {
    // The premise for leaving fixture suites alone is that the defect cannot reach them. That premise
    // has to be enforced, or it silently expires the first time someone writes digest() in one.
    const offenders = [];
    for (const name of suiteNames()) {
        const source = read(name);
        if (replaysEveryMigration(source) || source.includes('SUPABASE_FAITHFUL_BOOTSTRAP_SQL')) continue;
        for (const fn of PGCRYPTO_ONLY) {
            if (new RegExp(`(^|[^.\\w"])${fn}\\s*\\(`, 'm').test(source)) {
                offenders.push(`${name}: calls ${fn}()`);
            }
        }
    }
    assert.deepEqual(
        offenders.sort(),
        [],
        'this suite now depends on where pgcrypto lives, so it must use the shared bootstrap (or ' +
        'qualify the call as extensions.<fn>)',
    );
});

test('the role register may only shrink — a suite that states its role attributes must leave it', () => {
    const stale = LEGACY_UNSTATED_ROLES.filter((name) => {
        const source = read(name);
        const creates = [...source.matchAll(/CREATE ROLE (?:IF NOT EXISTS )?(service_role|authenticated|anon|app_tenant)/g)]
            .map((m) => m[1]);
        return !creates.some((role) =>
            !source.includes(`DROP ROLE IF EXISTS ${role}`) && !new RegExp(`ALTER ROLE ${role}\\b`).test(source));
    });
    assert.deepEqual(stale, [], 'delete these from LEGACY_UNSTATED_ROLES in the commit that fixed them');
});

test('no NEW suite may create a Supabase role without stating its attributes', () => {
    const offenders = [];
    for (const name of suiteNames()) {
        if (LEGACY_UNSTATED_ROLES.includes(name)) continue;
        const source = read(name);
        for (const role of new Set([...source.matchAll(/CREATE ROLE (?:IF NOT EXISTS )?(service_role|authenticated|anon|app_tenant)/g)].map((m) => m[1]))) {
            const dropped = source.includes(`DROP ROLE IF EXISTS ${role}`);
            const stated = new RegExp(`ALTER ROLE ${role}\\b`).test(source);
            if (!dropped && !stated) offenders.push(`${name}: creates ${role} without dropping it or stating its attributes`);
        }
    }
    assert.deepEqual(offenders.sort(), [], 'roles are cluster-global; inherit nothing you then assert on');
});

test('every registered name exists, so the lists cannot decay into fiction', () => {
    const present = new Set(suiteNames());
    const missing = [...LEGACY_UNSTATED_ROLES, ...BOOTSTRAP_EXCEPTIONS].filter((n) => !present.has(n));
    assert.deepEqual(missing, [], 'a renamed or deleted suite must leave these lists');
});

test('the shared module still carries all three fidelity fixes', () => {
    const module = readFileSync(join(executableDir, 'supabase-faithful-bootstrap.mjs'), 'utf8');
    assert.match(module, /CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions/);
    assert.match(module, /ALTER DATABASE %I SET search_path = public, extensions/);
    assert.match(module, /ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role/);
    assert.match(module, /ALTER ROLE service_role NOLOGIN BYPASSRLS/);
    // And it must not reinstate the shim that made the old bootstrap look faithful while it was not.
    assert.doesNotMatch(module, /CREATE FUNCTION extensions\.gen_random_bytes\(integer\) RETURNS/);
});
