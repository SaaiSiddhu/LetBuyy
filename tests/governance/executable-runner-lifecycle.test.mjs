// The Postgres test runner's own contract: what it classifies, what it removes, what it refuses to
// touch, and that a red suite can never read green. These are the guarantees the isolation design
// (scripts/governance/executable-pg-fixture.mjs) rests on, so they are pinned here rather than
// trusted to a comment.
//
// The container tests need a real Docker daemon (they create and remove real containers). Without
// one - the cloud-sandbox docker shim cannot label, list or remove containers - they SKIP with that
// reason on the test line. Nothing else in this file needs Docker.

import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSuites, LIVE_EXTERNAL_SUITES } from '../../scripts/governance/test-suite-catalog.mjs';
import { groupFailed, groupStatus, isHealthy, parseTap, totalOf } from '../../scripts/governance/tap-summary.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runner = join(repoRoot, 'scripts/governance/run-executable-suites.mjs');
const FIXTURE_LABEL = 'com.letbuyy.executable-fixture';
const OWNER_LABEL = 'com.letbuyy.executable-fixture.owner-pid';
// Built by concatenation so this file is not itself classified as a Postgres-backed suite.
const CONTAINER_ENV = 'process.env.' + 'LETBUYY_EXECUTABLE_PG_CONTAINER';

const realDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
const needsDocker = realDocker ? false : 'a real Docker daemon is required (the cloud-sandbox shim cannot label, list or remove containers)';

const docker = (args) => spawnSync('docker', args, { encoding: 'utf8' });
const containerExists = (name) => docker(['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.Names}}']).stdout.trim() === name;
const uniqueName = (label) => `letbuyy-lifecycle-${label}-${process.pid}-${Date.now().toString(36)}`;

function suiteDir(files) {
    const dir = mkdtempSync(join(tmpdir(), 'letbuyy-runner-lifecycle-'));
    for (const [name, source] of Object.entries(files)) writeFileSync(join(dir, name), source);
    return dir;
}

const PASSING_SUITE = `
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
test('the runner hands the suite a live owned cluster and its own database', () => {
  const database = process.env.LETBUYY_EXECUTABLE_PG_DATABASE;
  const out = execFileSync('docker', ['exec', ${CONTAINER_ENV}, 'psql', '-U', 'postgres', '-d', database, '-qAt', '-c', 'select current_database()'], { encoding: 'utf8' }).trim();
  assert.equal(out, database);
});`;
const FAILING_SUITE = `
import test from 'node:test';
import assert from 'node:assert/strict';
test('deliberately failing', () => assert.equal(1, 2));`;
const SLEEPING_SUITE = `
import test from 'node:test';
test('holds the cluster open', async () => { await new Promise((resolve) => setTimeout(resolve, 20000)); });`;

async function until(predicate, timeoutMs, what) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.fail(`timed out waiting for ${what}`);
}

test('the catalog puts every suite in exactly one class, and the live list is the reviewed one', () => {
    const { all, pure, postgres, live } = discoverSuites(repoRoot);
    assert.equal(pure.length + postgres.length + live.length, all.length, 'no suite is in two classes or in none');
    assert.equal(new Set([...pure, ...postgres, ...live]).size, all.length);
    assert.deepEqual(live, LIVE_EXTERNAL_SUITES);
    assert.deepEqual(LIVE_EXTERNAL_SUITES, ['tests/security/theme-tenant-isolation.test.mjs']);
    for (const guarded of [
        'checkout-order-concurrency', 'gift-card-issue-idempotency', 'late-capture-after-release', 'money-rpc-idempotency-sweep',
    ]) {
        assert.ok(postgres.includes(`tests/executable/${guarded}-postgres.test.mjs`), `${guarded} refuses the shared container, so it must get an owned one`);
    }
    assert.ok(postgres.includes('tests/identity-foundation/identity-foundation-postgres.test.mjs'), 'a Postgres suite outside tests/executable is still found');
    assert.ok(pure.includes('tests/executable/human-required-live-paths.test.mjs'), 'the skip-marker file needs no database');
});

test('the catalog derives the class from the source, so a new suite cannot fall back to the shared container', () => {
    const root = mkdtempSync(join(tmpdir(), 'letbuyy-catalog-'));
    try {
        mkdirSync(join(root, 'tests/security'), { recursive: true });
        mkdirSync(join(root, 'tests/newdir'), { recursive: true });
        writeFileSync(join(root, 'tests/security/theme-tenant-isolation.test.mjs'), '// live\n');
        writeFileSync(join(root, 'tests/newdir/db.test.mjs'), `const c = ${CONTAINER_ENV} || 'x';\n`);
        writeFileSync(join(root, 'tests/newdir/plain.test.mjs'), `import test from 'node:test';\n`);
        const { pure, postgres, live } = discoverSuites(root);
        assert.deepEqual(postgres, ['tests/newdir/db.test.mjs']);
        assert.deepEqual(pure, ['tests/newdir/plain.test.mjs']);
        assert.deepEqual(live, ['tests/security/theme-tenant-isolation.test.mjs']);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('neither the runner nor the wrapper nor the fixture can reach the shared container', () => {
    for (const file of ['run-executable-suites.mjs', 'test-behavioral.mjs', 'executable-pg-fixture.mjs']) {
        const code = readFileSync(join(repoRoot, 'scripts/governance', file), 'utf8')
            .split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
        assert.doesNotMatch(code, /letbuyy-executable-pg/, `${file} must never name the shared fixture in code`);
    }
});

test('readiness is a TCP probe plus a query, because the socket probe answers during image init', () => {
    const source = readFileSync(join(repoRoot, 'scripts/governance/executable-pg-fixture.mjs'), 'utf8');
    assert.match(source, /'pg_isready', '-h', '127\.0\.0\.1'/);
    assert.match(source, /'select 1'/);
});

const GREEN_TAP = ['# tests 4', '# suites 1', '# pass 3', '# fail 0', '# cancelled 0', '# skipped 1', '# todo 0'].join('\n');
const green = (overrides = {}) => ({ ...parseTap(GREEN_TAP, 'g'), code: 0, ...overrides });

test('a group is green only when the exit status, the summary, the failures and the cancellations all agree', () => {
    assert.equal(groupFailed(green()), false);
    assert.equal(isHealthy([green(), green()]), true);
    assert.equal(groupFailed(green({ code: 1 })), true, 'a non-zero exit with a clean summary is red');
    assert.equal(groupFailed(green({ fail: 3 })), true, 'failures with exit 0 (a nested runner does this) are red');
    assert.equal(groupFailed(green({ cancelled: 2 })), true, 'cancelled tests are red, they are not passes');
    const silent = { ...green(), hasSummary: false };
    assert.equal(groupFailed(silent), true, 'no summary at all is red, never green');
    assert.equal(groupStatus(silent), 'FAIL (no summary)');
    assert.equal(isHealthy([green(), green({ code: 1 })]), false, 'one red group makes the whole run red');
    assert.equal(isHealthy([]), false, 'a run that ran nothing is not healthy');
});

test('TAP parsing separates failures, todos and skips, and totals add up across groups', () => {
    const tap = [
        'ok 1 - passes', 'not ok 2 - breaks (12.5ms)', 'not ok 3 - open item # TODO tracked elsewhere',
        'ok 4 - human gate # SKIP needs credentials', 'ok 5 - suite # SKIP database absent',
        '# tests 5', '# suites 1', '# pass 1', '# fail 1', '# cancelled 0', '# skipped 2', '# todo 1',
    ].join('\n');
    const stats = parseTap(tap, 'x');
    assert.deepEqual(stats.failing, ['breaks'], 'a `not ok ... # TODO` is a todo, not a failure');
    assert.deepEqual(stats.todos, ['open item']);
    assert.deepEqual(stats.skips, ['human gate (needs credentials)', 'suite (database absent)']);
    assert.equal(stats.hasSummary, true);
    const total = totalOf([{ ...stats, code: 1 }, green()]);
    assert.equal(total.tests, 9);
    assert.equal(total.fail, 1);
    assert.equal(total.skipped, 3);
    assert.deepEqual(total.failing, ['[x] breaks']);
});

test('a failing suite exits non-zero, is reported, and the run leaves no cluster behind', { skip: needsDocker }, async () => {
    const dir = suiteDir({ 'a-pass.test.mjs': PASSING_SUITE, 'b-fail.test.mjs': FAILING_SUITE });
    const base = uniqueName('fail');
    try {
        const run = spawnSync('node', [runner, '--suite-dir', dir, '--jobs', '2', '--json', '--container', base], { cwd: repoRoot, encoding: 'utf8' });
        const report = JSON.parse(run.stdout);
        assert.equal(run.status, 1, 'the exit code is the number of failing suites');
        assert.equal(report.suites, 2);
        assert.equal(report.failedSuites, 1);
        const byName = Object.fromEntries(report.results.map((r) => [r.name, r]));
        assert.equal(byName['a-pass'].code, 0, `the passing suite saw an owned cluster and its own database: ${byName['a-pass'].failures}`);
        assert.notEqual(byName['b-fail'].code, 0);
        assert.equal(byName['b-fail'].fail, 1);
        assert.notEqual(byName['a-pass'].cluster, byName['b-fail'].cluster, 'two jobs run in two clusters, never one');
        for (const name of report.containers) assert.equal(containerExists(name), false, `${name} must be removed`);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('a name that is already taken is an infrastructure error and the other container survives it', { skip: needsDocker }, () => {
    const dir = suiteDir({ 'a-pass.test.mjs': PASSING_SUITE });
    const taken = uniqueName('taken');
    try {
        assert.equal(docker(['run', '-d', '--name', taken, '--entrypoint', 'sleep', 'postgres:16-alpine', '300']).status, 0);
        const run = spawnSync('node', [runner, '--suite-dir', dir, '--jobs', '1', '--json', '--container', taken], { cwd: repoRoot, encoding: 'utf8' });
        assert.equal(run.status, 70, 'infrastructure that cannot start is exit 70, never a count of failing suites');
        assert.match(JSON.parse(run.stdout).infrastructureError, /docker run failed/);
        assert.equal(containerExists(taken), true, 'cleanup removes only what this run created');
    } finally {
        docker(['rm', '-f', taken]);
        rmSync(dir, { recursive: true, force: true });
    }
});

test('SIGTERM removes the run\'s clusters and exits 143', { skip: needsDocker }, async () => {
    const dir = suiteDir({ 'a-sleep.test.mjs': SLEEPING_SUITE });
    const base = uniqueName('term');
    try {
        const child = spawn('node', [runner, '--suite-dir', dir, '--jobs', '1', '--container', base, '--timeout', '60'], { cwd: repoRoot, stdio: 'ignore' });
        const closed = new Promise((resolve) => child.on('close', (code) => resolve(code)));
        await until(() => containerExists(base), 60_000, 'the run\'s cluster to exist');
        child.kill('SIGTERM');
        assert.equal(await closed, 143);
        assert.equal(containerExists(base), false);
    } finally {
        docker(['rm', '-f', base]);
        rmSync(dir, { recursive: true, force: true });
    }
});

test('a run killed with SIGKILL leaves one labeled orphan, and only that kind of orphan is reaped', { skip: needsDocker }, async () => {
    const dir = suiteDir({ 'a-sleep.test.mjs': SLEEPING_SUITE });
    const orphanBase = uniqueName('orphan');
    const live = uniqueName('live');
    const unlabeled = uniqueName('unlabeled');
    const sleeper = (name, labels) => docker(['run', '-d', '--name', name, ...labels, '--entrypoint', 'sleep', 'postgres:16-alpine', '300']);
    try {
        const child = spawn('node', [runner, '--suite-dir', dir, '--jobs', '1', '--container', orphanBase, '--timeout', '60'], { cwd: repoRoot, stdio: 'ignore' });
        const closed = new Promise((resolve) => child.on('close', () => resolve()));
        await until(() => containerExists(orphanBase), 60_000, 'the run\'s cluster to exist');
        child.kill('SIGKILL');
        await closed;
        assert.equal(containerExists(orphanBase), true, 'SIGKILL cannot be handled, so the cluster is left for the next run to reap');
        const labels = docker(['inspect', '-f', `{{index .Config.Labels "${FIXTURE_LABEL}"}} {{index .Config.Labels "${OWNER_LABEL}"}}`, orphanBase]).stdout.trim();
        assert.equal(labels, `1 ${child.pid}`, 'the orphan carries the label and its dead owner\'s pid');

        assert.equal(sleeper(live, ['--label', `${FIXTURE_LABEL}=1`, '--label', `${OWNER_LABEL}=${process.pid}`]).status, 0);
        assert.equal(sleeper(unlabeled, []).status, 0);

        const reap = spawnSync('node', [runner, '--reap-only', '--reap-min-age', '0'], { cwd: repoRoot, encoding: 'utf8' });
        assert.equal(reap.status, 0);
        const { reaped } = JSON.parse(reap.stdout.trim().split('\n').pop());
        assert.ok(reaped.includes(orphanBase), 'the dead owner\'s labeled cluster is reaped');
        assert.equal(reaped.includes(live), false, 'a cluster whose owner is alive is never reaped');
        assert.equal(reaped.includes(unlabeled), false, 'an unlabeled container is never reaped');
        assert.equal(containerExists(orphanBase), false);
        assert.equal(containerExists(live), true);
        assert.equal(containerExists(unlabeled), true);
    } finally {
        for (const name of [orphanBase, live, unlabeled]) docker(['rm', '-f', name]);
        rmSync(dir, { recursive: true, force: true });
    }
});
