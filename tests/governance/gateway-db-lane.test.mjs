// The gateway's database lane, pinned: which suites are in it, how they reach a database, and which lane can never run them.
//
// Before P2-HERMETIC-GATEWAY-DB the gateway's real-database suites lived among its unit tests and found "the local Supabase
// Postgres" for themselves - a hardcoded (later discovered) `supabase_db_*` container plus `.dev.vars` - so an ordinary
// `pnpm test` wrote products, orders, GST invoices and gift-card ledgers into the developer's restored stack, and a stale
// container name or a stopped stack turned the same tests into silent skips. These tests keep that from coming back. They
// read files and run the runner's --list; none needs Docker (the behaviour behind them is proved in
// gateway-db-lifecycle.test.mjs and owned-fixture-guard.test.mjs).

import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATEWAY_DB_SUITE_DIR, discoverSuites, isGatewayDatabaseSuite } from '../../scripts/governance/test-suite-catalog.mjs';
import { pullsAllowed, requireImagePresent } from '../../scripts/governance/executable-pg-fixture.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const testsDir = join(repoRoot, 'services/api-gateway/src/__tests__');
const ownedDir = join(repoRoot, GATEWAY_DB_SUITE_DIR);
const runner = join(repoRoot, 'scripts/governance/run-executable-suites.mjs');

const read = (path) => readFileSync(path, 'utf8');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
const ownedSuites = () => readdirSync(ownedDir).filter((name) => name.endsWith('.test.ts')).sort();
const ownedFiles = () => readdirSync(ownedDir).filter((name) => name.endsWith('.ts')).sort();
const unitTests = () => readdirSync(testsDir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts')).map((entry) => entry.name).sort();

test('the lane holds the fourteen gateway suites that need a real database, and the catalog finds exactly the files that are there', () => {
    assert.deepEqual(
        ownedSuites(),
        [
            'backfill-and-target-shadow.postgres.test.ts',
            'buyer-privacy-intake.postgres.test.ts',
            'gift-card-money-path.test.ts',
            'gst-invoice-issuance.test.ts',
            'gst-tax-computation.test.ts',
            'inventory-reservation-lifecycle.test.ts',
            'merchant-tenant-predicate.test.ts',
            'operator-mutation-integrity.postgres.test.ts',
            'operator-queue-correctness.postgres.test.ts',
            'privacy-support-visibility.postgres.test.ts',
            'real-http-shadow-rehearsal.postgres.test.ts',
            'real-staff-product-journey.postgres.test.ts',
            'storefront-buyer-data.postgres.test.ts',
            'verification-token-redemption.postgres.test.ts',
        ],
        'a suite added to or removed from the lane is a decision: name it here',
    );
    const { gatewayDb, all, pure, postgres, live } = discoverSuites(repoRoot);
    assert.deepEqual(gatewayDb, ownedSuites().map((name) => `${GATEWAY_DB_SUITE_DIR}/${name}`));
    assert.ok(gatewayDb.every(isGatewayDatabaseSuite));
    // The lane is a separate partition: it does not disturb the tests/*/*.test.mjs one.
    assert.equal(pure.length + postgres.length + live.length, all.length);
    assert.ok(all.every((suite) => !suite.startsWith('services/')));
});

test('the runner selects the lane by itself with --gateway-db, and adds it to every other database-backed suite by default', () => {
    const list = (...extra) => JSON.parse(spawnSync(process.execPath, [runner, '--list', '--json', ...extra], { cwd: repoRoot, encoding: 'utf8' }).stdout);
    const { postgres, gatewayDb } = discoverSuites(repoRoot);
    assert.deepEqual(list('--gateway-db'), gatewayDb);
    assert.deepEqual(list(), [...postgres, ...gatewayDb], 'a bare run of the runner is the whole database-backed surface');
    assert.deepEqual(list('--filter', 'gift-card-money-path'), [...postgres.filter((suite) => suite.includes('gift-card-money-path')), ...gatewayDb.filter((suite) => suite.includes('gift-card-money-path'))]);
});

test('a lane suite reaches a database only through requireOwnedDatabase(), and through nothing else', () => {
    const forbidden = [
        [/local-postgres-support/, 'the retired auto-discovery helper'],
        [/resolveLocalSupabaseContainer|readLocalSupabaseConfig|isLocalPostgresReachable/, 'discovering a local Supabase container or config'],
        [/\.dev\.vars/, 'the developer\'s environment file'],
        [/supabase_db_|supabase_rest_|supabase_kong_/, 'a Supabase development container name'],
        [/LETBUYY_LOCAL_SUPABASE_CONTAINER/, 'the retired container override'],
        [/process\.env\.SUPABASE_(URL|SERVICE_ROLE_KEY)|process\.env\.DATABASE_URL|process\.env\.PG/, 'an inherited database setting'],
        [/supabase\.co|supabase\.com|localhost:5432\d|127\.0\.0\.1:5432\d/, 'a hosted or well-known development endpoint'],
        [/child_process/, 'running processes directly (only the support module may, and only against the owned container)'],
        [/['"]docker['"]/, 'naming docker directly'],
        [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, 'a hard-coded id: a suite builds its own tenant and depends on no existing row'],
    ];
    for (const name of ownedSuites()) {
        const source = stripComments(read(join(ownedDir, name)));
        assert.match(source, /requireOwnedDatabase\s*\(\s*\)/, `${name} must obtain its database through requireOwnedDatabase()`);
        for (const [pattern, what] of forbidden) assert.doesNotMatch(source, pattern, `${name} uses ${what}`);
    }
});

test('a lane suite cannot skip: it has no skip, todo or conditional-execution construct', () => {
    const skipping = /\bskip\s*:|\.skip\s*\(|\btodo\s*:|\.todo\s*\(|\bxit\s*\(|\bxtest\s*\(|\bxdescribe\s*\(|\bonly\s*:|\.only\s*\(|t\.diagnostic\(\s*['"`]skip/;
    for (const name of ownedSuites()) {
        assert.doesNotMatch(stripComments(read(join(ownedDir, name))), skipping, `${name} must always run or fail`);
    }
    // The support module has no "no database, so skip" branch either: without an announcement it throws.
    const support = stripComments(read(join(ownedDir, 'owned-db-support.ts')));
    assert.doesNotMatch(support, skipping);
    assert.match(support, /throw new Error/);
    assert.doesNotMatch(support, /return\s+(null|undefined)\s*;?\s*\n\s*}\s*\n\s*let verified/, 'no early return without a database');
});

test('the privacy and operator-queue suites drive the real worker through the shared harness; only the harness touches the HTTP hop, and the staff-side visibility suite taps nothing', () => {
    const harness = stripComments(read(join(ownedDir, 'gateway-harness.ts')));
    assert.match(harness, /import worker from '\.\.\/\.\.\/index'/, 'the harness calls the worker\'s own entry point');
    assert.match(harness, /worker\.fetch\(/);
    assert.doesNotMatch(harness, /process\.env|\.dev\.vars|supabase\.co|supabase\.com/, 'the harness reaches a database only through the handles it is given');
    for (const name of ['buyer-privacy-intake.postgres.test.ts', 'privacy-support-visibility.postgres.test.ts', 'operator-queue-correctness.postgres.test.ts']) {
        const source = stripComments(read(join(ownedDir, name)));
        assert.match(source, /from '\.\/gateway-harness'/, `${name} goes through the harness`);
        assert.doesNotMatch(source, /globalThis\.fetch\s*=|fake-postgrest|installFakePostgrest|mock\.method|\.mock\(/, `${name} replaces nothing by hand: the tap in the harness is the only seam`);
    }
    assert.doesNotMatch(stripComments(read(join(ownedDir, 'privacy-support-visibility.postgres.test.ts'))), /tapRest\(/, 'the staff-side suite taps nothing');
});

test('only the support module may run docker, and only the guard may decide what is owned', () => {
    for (const name of ownedFiles().filter((file) => file !== 'owned-db-support.ts')) {
        assert.doesNotMatch(stripComments(read(join(ownedDir, name))), /child_process|['"]docker['"]/, `${name} must not run processes`);
    }
    const support = stripComments(read(join(ownedDir, 'owned-db-support.ts')));
    assert.match(support, /owned-fixture-guard\.mjs/, 'the support module asks the guard, in a separate process');
    assert.match(support, /'--verify'/);
    assert.match(support, /exec', verified\.pgContainer/, 'every statement goes to the container the guard verified, never to a name from the environment');
    assert.doesNotMatch(support, /process\.env\.LETBUYY_EXECUTABLE_PG_CONTAINER/, 'the container is the verified one, not the raw environment value');
});

test('the synthetic tenant is built from random ids, with plainly synthetic identities', () => {
    const source = stripComments(read(join(ownedDir, 'synthetic-tenant.ts')));
    assert.match(source, /randomUUID\(\)/);
    assert.match(source, /\.invalid/, 'no address a real person could receive');
    assert.doesNotMatch(source, /DELETE\s+FROM|TRUNCATE|DISABLE\s+TRIGGER|session_replication_role/i, 'the fixture removes nothing by hand and disables no protection');
});

test('the gateway\'s fast unit lane cannot reach a database, and the retired helper is gone', () => {
    assert.equal(existsSync(join(testsDir, 'local-postgres-support.ts')), false, 'the auto-discovery helper is retired');
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
    for (const file of walk(join(repoRoot, 'services/api-gateway/src'))) {
        assert.ok(!/local-postgres-support/.test(file), `${relative(repoRoot, file)} must not exist`);
    }
    const patterns = [
        [/child_process|spawnSync|execFileSync|execSync/, 'running a process'],
        [/['"]docker['"]/, 'naming docker'],
        [/\.dev\.vars/, 'reading the developer\'s environment file'],
        [/supabase_db_|LETBUYY_LOCAL_SUPABASE_CONTAINER|LETBUYY_EXECUTABLE|LETBUYY_OWNED_REST/, 'naming a database container or the lane\'s environment'],
        [/requireOwnedDatabase/, 'the lane\'s door'],
    ];
    for (const name of unitTests()) {
        const source = stripComments(read(join(testsDir, name)));
        for (const [pattern, what] of patterns) assert.doesNotMatch(source, pattern, `unit-lane test ${name} must not reach a database (${what}); a database test belongs in owned-db/`);
    }
});

test('the package scripts keep three lanes apart: unit (fast, no database), database (owned), and the acceptance that needs both, every tsx stage run from the repository root', () => {
    const gateway = JSON.parse(read(join(repoRoot, 'services/api-gateway/package.json'))).scripts;
    const root = JSON.parse(read(join(repoRoot, 'package.json'))).scripts;
    assert.equal(gateway['test:unit'], 'cd ../.. && tsx --test services/api-gateway/src/__tests__/*.test.ts', 'the unit glob does not descend, so owned-db/ is outside it');
    assert.equal(gateway['test:db'], 'cd ../.. && node scripts/governance/run-executable-suites.mjs --gateway-db');
    // `test` is the acceptance: the unit lane, the database lane, then the canonical contracts runner (the root's own
    // `test:contracts`, the command the root suite runs) from the repository root.
    assert.deepEqual(
        gateway.test.split('&&').map((stage) => stage.trim()),
        ['pnpm run test:unit', 'pnpm run test:db', 'cd ../..', root['test:contracts']],
    );
    assert.doesNotMatch(gateway['test:unit'], /owned-db/);

    // No gateway script runs tsx from services/api-gateway. That directory's tsconfig.json is a TYPE-CHECK configuration: its
    // `paths` send hono/factory and hono/cors to hono's declaration files (dist/types/.../index.d.ts) and every other bare import
    // into pnpm's store. tsx applies the tsconfig of its working directory at runtime, so from the package it loads a .d.ts for
    // hono/factory, `createMiddleware` is undefined, and a test that imports middleware/buyer-session.ts dies on import: the
    // acceptance's contract stage did exactly that until P2-OPERATOR-QUEUE-GATE-AND-ACCEPTANCE. (The bundler, esbuild, skips a
    // .d.ts target and is not affected; the repository root has no tsconfig.)
    for (const [name, script] of Object.entries(gateway)) {
        let atRoot = false;
        for (const stage of script.split('&&').map((part) => part.trim())) {
            if (stage === 'cd ../..') atRoot = true;
            else if (/\btsx\b/.test(stage)) assert.ok(atRoot, `${name}: "${stage}" would run tsx under the gateway's type-check tsconfig`);
        }
    }

    assert.equal(root['test:unit:gateway'], 'pnpm --filter @letbuyy/api-gateway run test:unit');
    assert.equal(root['test:db:gateway'], 'pnpm --filter @letbuyy/api-gateway run test:db');
    assert.equal(root['test:gateway'], 'pnpm --filter @letbuyy/api-gateway run test');
});

test('the root behavioral wrapper reports the gateway suites as their own group, from the same owned clusters', () => {
    const wrapper = read(join(repoRoot, 'scripts/governance/test-behavioral.mjs'));
    assert.match(wrapper, /'gateway database \(owned\)'/);
    assert.match(wrapper, /kind: 'gateway-db'/);
    assert.match(wrapper, /discoverSuites\(repoRoot\)/);
    assert.match(wrapper, /gatewayDb/);
    assert.equal((wrapper.match(/run-executable-suites\.mjs/g) ?? []).length >= 1, true);
    assert.equal((wrapper.match(/spawn\('node', \['scripts\/governance\/run-executable-suites\.mjs'/g) ?? []).length, 1, 'one runner invocation, one set of clusters, two groups');
});

test('an image is never pulled behind the operator\'s back: a workstation refuses, an explicit opt-in or CI pulls exactly the image named', () => {
    const recorder = (present) => {
        const calls = [];
        return {
            calls,
            run: (args) => {
                calls.push(args);
                if (args[0] === 'image') return { status: present ? 0 : 1, stdout: '', stderr: '' };
                return { status: 0, stdout: '', stderr: '' };
            },
        };
    };

    const have = recorder(true);
    requireImagePresent('postgres:16-alpine', { env: {}, run: have.run });
    assert.deepEqual(have.calls.map((call) => call[0]), ['image'], 'an image that is there is never pulled');

    const refused = recorder(false);
    assert.throws(() => requireImagePresent('public.ecr.aws/supabase/postgrest:v16.2', { env: {}, run: refused.run }), /public\.ecr\.aws\/supabase\/postgrest:v16\.2 is not present locally; this runner does not pull an image on its own/);
    assert.deepEqual(refused.calls.map((call) => call[0]), ['image'], 'a workstation run pulls nothing');

    for (const env of [{ LETBUYY_EXECUTABLE_PULL: 'missing' }, { CI: 'true' }]) {
        const pulling = recorder(false);
        requireImagePresent('postgres:16-alpine', { env, run: pulling.run });
        assert.deepEqual(pulling.calls.map((call) => call.slice(0, 3)), [['image', 'inspect', '--format'], ['pull', '--quiet', 'postgres:16-alpine']], 'the one image asked for, once');
    }
    assert.equal(pullsAllowed({}), false);
    assert.equal(pullsAllowed({ CI: 'false' }), false);
    assert.equal(pullsAllowed({ LETBUYY_EXECUTABLE_PULL: 'never' }), false);

    const failing = { calls: [], run: (args) => ({ status: args[0] === 'image' ? 1 : 1, stdout: '', stderr: 'unauthorized', error: undefined }) };
    assert.throws(() => requireImagePresent('postgres:16-alpine', { env: { CI: 'true' }, run: failing.run }), /postgres:16-alpine is not present locally and could not be pulled: unauthorized/);
});

test('every docker run the fixture makes is told never to pull, whatever the environment', () => {
    const source = read(join(repoRoot, 'scripts/governance/executable-pg-fixture.mjs'));
    const runs = source.match(/'run', '-d', [^\n]*/g) ?? [];
    assert.equal(runs.length, 3, 'the cluster (in its two forms: real daemon and the sandbox shim\'s) and the REST sidecar are the only containers the fixture starts');
    for (const line of runs) assert.match(line, /'--pull', 'never'/);
});
