#!/usr/bin/env node
// Run the Postgres-backed suites as a set, each inside a cluster this runner owns.
//
// WHY THIS EXISTS (CAP-C66)
// No gate lane ran tests/executable, so the only way anyone learned those suites were red was by
// remembering to run them one at a time. Chasing that found a latent checkout outage (CAP-C65).
//
// WHY IT OWNS ITS CLUSTERS
// Several suites drop and recreate databases and replay every migration, and four refuse to run at
// all unless LETBUYY_EXECUTABLE_PG_CONTAINER names a dedicated throwaway - a sensible guard, since
// the shared `letbuyy-executable-pg` container carries other sessions' in-progress state. Rather
// than working around that guard, this runner satisfies it. The isolation contract (roles are
// cluster-global, so one cluster per worker, one suite at a time inside it, fresh clusters every run)
// is written out in executable-pg-fixture.mjs. Nothing outside the containers this run created is
// touched, and a run that is killed leaves nothing behind that the next run does not reap.
//
// Usage:
//   node scripts/governance/run-executable-suites.mjs [--filter <substring>] [--suite <path>]...
//        [--suite-dir <dir>]... [--jobs <n>] [--timeout <seconds>] [--log-dir <dir>] [--json]
//        [--json-out <file>] [--list] [--keep-container] [--container <name>] [--no-reap] [--reap-only]
//        [--reap-min-age <seconds>]
// With no --suite/--suite-dir it runs every Postgres-backed suite the catalog finds under tests/.
// Exit code: the number of failing suites (capped at 125 so it can never wrap to 0), 70 when the
// infrastructure itself could not start, so a lane can consume it.

import { spawn } from 'node:child_process';
import { constants as osConstants } from 'node:os';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    DEFAULT_IMAGE,
    docker,
    reapStaleClusters,
    removeCluster,
    startCluster,
    uniqueContainerName,
    waitUntilAccepting,
} from './executable-pg-fixture.mjs';
import { discoverSuites } from './test-suite-catalog.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const values = (name) => args.flatMap((arg, i) => (arg === name && i < args.length - 1 ? [args[i + 1]] : []));
const value = (name, fallback) => values(name)[0] ?? fallback;

const filter = value('--filter', null);
const asJson = flag('--json');
const keepContainer = flag('--keep-container');
const perSuiteTimeoutMs = Number(value('--timeout', '600')) * 1000;
const requestedJobs = Number(value('--jobs', process.env.LETBUYY_EXECUTABLE_PG_JOBS || '2'));
const logDir = value('--log-dir', null);
const jsonOutPath = value('--json-out', null);
// The database the suites share by default; suites needing isolation pick their own.
const sharedDatabase = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const containerBase = value('--container', uniqueContainerName());
const say = (message) => { if (!asJson) process.stdout.write(`${message}\n`); };
const warn = (message) => process.stderr.write(`run-executable-suites: ${message}\n`);

function selectSuites() {
    const explicit = values('--suite').map((suite) => (isAbsolute(suite) ? relative(repoRoot, suite) : suite));
    for (const dir of values('--suite-dir')) {
        const absolute = resolve(repoRoot, dir);
        for (const name of readdirSync(absolute).filter((n) => n.endsWith('.test.mjs')).sort()) {
            explicit.push(relative(repoRoot, join(absolute, name)));
        }
    }
    const chosen = explicit.length > 0 ? explicit : discoverSuites(repoRoot).postgres;
    for (const suite of chosen) {
        if (!existsSync(join(repoRoot, suite))) throw new Error(`suite not found: ${suite}`);
    }
    return chosen.filter((suite) => !filter || suite.includes(filter));
}

// Postgres identifiers cap at 63 bytes; suite names are long, so trim from the front and keep the
// distinctive tail.
function databaseNameFor(suite) {
    const slug = basename(suite).replace(/\.test\.mjs$/, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    return `letbuyy_exec_${slug}`.slice(0, 63);
}

const psqlOn = (cluster, sql, { allowFailure = false } = {}) =>
    docker(['exec', '-i', cluster, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql], { allowFailure });

const running = new Set();
const clusters = [];
let shuttingDown = false;

function removeClusters() {
    if (keepContainer) return;
    for (const cluster of clusters) removeCluster(cluster.name);
}

function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of running) child.kill('SIGKILL');
    removeClusters();
    process.exit(128 + (osConstants.signals[signal] ?? 15));
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => shutdown(signal));

function runSuite(suite, cluster) {
    return new Promise((resolveResult) => {
        const started = Date.now();
        // Per-suite database. Without it the suites contaminate each other: about twenty share the
        // default `letbuyy_executable` and leave schema and rows behind, so the second suite to touch
        // a table sees the first one's state and fails in a fraction of a second. Run standalone they
        // pass. Two separate psql invocations, not one `-c` with both statements: psql wraps a
        // multi-command -c string in an implicit transaction and CREATE DATABASE cannot run inside one.
        const database = databaseNameFor(suite);
        psqlOn(cluster.name, `DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`, { allowFailure: true });
        psqlOn(cluster.name, `CREATE DATABASE "${database}";`);

        // NODE_TEST_CONTEXT is set by an outer `node --test`. Inherited, it puts the nested runner in
        // its "child" mode: no TAP summary, and a failing test exits 0. That reads exactly like a pass,
        // so it is removed here and any result without a summary is refused below.
        const env = { ...process.env, LETBUYY_EXECUTABLE_PG_CONTAINER: cluster.name, LETBUYY_EXECUTABLE_PG_DATABASE: database };
        delete env.NODE_TEST_CONTEXT;
        const child = spawn('node', ['--test', suite], { cwd: repoRoot, env });
        running.add(child);
        let out = '';
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, perSuiteTimeoutMs);
        child.stdout.on('data', (d) => { out += d; });
        child.stderr.on('data', (d) => { out += d; });
        child.on('close', (code) => {
            running.delete(child);
            clearTimeout(timer);
            psqlOn(cluster.name, `DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`, { allowFailure: true });
            // Node 22's `node --test` TAP output uses `# <label> <n>` and `not ok <n> - <name>`.
            const number = (label) => Number(out.match(new RegExp(`^# ${label} (\\d+)`, 'm'))?.[1] ?? 0);
            const lines = out.split('\n');
            const failures = lines.filter((line) => /^not ok \d+ - /.test(line)).map((line) => line.replace(/ \([0-9.]+ms\)$/, ''));
            const skips = lines.filter((line) => /^ok \d+ - .* # SKIP/.test(line)).map((line) => line.replace(/ \([0-9.]+ms\)$/, ''));
            if (logDir) {
                mkdirSync(logDir, { recursive: true });
                writeFileSync(join(logDir, `${basename(suite, '.test.mjs')}.log`), out);
            }
            // Exit status is not trusted alone: a suite is red if the process failed, the TAP summary
            // reports a failure or a cancellation, or there is no summary at all.
            const hasSummary = /^# tests \d+/m.test(out);
            const consistent = hasSummary && number('fail') === 0 && number('cancelled') === 0;
            resolveResult({
                name: basename(suite).replace(/-postgres\.test\.mjs$|\.test\.mjs$/, ''),
                path: suite,
                cluster: cluster.name,
                code: timedOut ? 124 : (code ?? 1) !== 0 ? (code ?? 1) : consistent ? 0 : 1,
                timedOut,
                hasSummary,
                tests: number('tests'),
                pass: number('pass'),
                fail: number('fail'),
                cancelled: number('cancelled'),
                skipped: number('skipped'),
                todo: number('todo'),
                seconds: Math.round((Date.now() - started) / 100) / 10,
                firstFailure: (failures[0] ?? '').slice(0, 96),
                failures,
                skips,
            });
        });
    });
}

async function startClusters(count) {
    for (let i = 0; i < count; i += 1) {
        const name = count > 1 ? `${containerBase}-${i + 1}` : containerBase;
        // Registered only once `docker run` succeeded: a name that was already taken belongs to
        // someone else, and cleanup must never remove a container this run did not create.
        startCluster({ name, database: sharedDatabase });
        clusters.push({ name });
    }
    await Promise.all(clusters.map((cluster) => waitUntilAccepting(cluster.name)));
}

async function main() {
    const reapMinAgeSeconds = Number(value('--reap-min-age', '120'));
    if (flag('--reap-only')) {
        const reaped = reapStaleClusters({ minAgeSeconds: reapMinAgeSeconds, log: warn });
        process.stdout.write(JSON.stringify({ reaped }) + '\n');
        return 0;
    }

    const suites = selectSuites();
    if (flag('--list')) {
        process.stdout.write(asJson ? JSON.stringify(suites, null, 2) + '\n' : suites.join('\n') + '\n');
        return 0;
    }
    if (suites.length === 0) throw new Error('no suites selected');

    const reaped = flag('--no-reap') ? [] : reapStaleClusters({ minAgeSeconds: reapMinAgeSeconds, log: warn });
    let jobs = Math.max(1, Math.min(Number.isFinite(requestedJobs) ? requestedJobs : 1, suites.length));
    // Parallel clusters are only isolated when each container is a real one. The cloud-sandbox docker
    // shim (scripts/dev/docker-shim) maps every container name onto ONE native cluster, so parallel
    // suites there would share roles and race; it does not implement `docker info`, which is the tell.
    if (jobs > 1 && docker(['info'], { allowFailure: true }).status !== 0) {
        warn('no real Docker daemon (shim or daemon down): running one suite at a time, parallel clusters would not be isolated');
        jobs = 1;
    }
    const wallStart = Date.now();
    const results = [];
    let infrastructureError = null;

    try {
        await startClusters(jobs);
        const queue = [...suites];
        await Promise.all(clusters.map(async (cluster) => {
            while (!shuttingDown) {
                const suite = queue.shift();
                if (!suite) return;
                const result = await runSuite(suite, cluster);
                results.push(result);
                say(`  ${result.name.padEnd(48)} ${String(result.code === 0 ? 'ok' : 'FAIL').padEnd(5)}` +
                    ` pass=${String(result.pass).padStart(3)} fail=${String(result.fail).padStart(2)}` +
                    ` skip=${String(result.skipped).padStart(2)} ${String(result.seconds).padStart(6)}s${result.timedOut ? '  TIMED OUT' : ''}`);
            }
        }));
    } catch (error) {
        infrastructureError = error;
    } finally {
        removeClusters();
    }

    if (infrastructureError) {
        warn(infrastructureError.message);
        if (asJson) process.stdout.write(JSON.stringify({ infrastructureError: infrastructureError.message }) + '\n');
        return 70;
    }

    results.sort((a, b) => a.path.localeCompare(b.path));
    const failed = results.filter((r) => r.code !== 0);
    const sum = (key) => results.reduce((total, r) => total + r[key], 0);
    const wallSeconds = Math.round((Date.now() - wallStart) / 100) / 10;
    const report = {
        image: DEFAULT_IMAGE, jobs, containers: clusters.map((c) => c.name), reaped,
        suites: results.length, failedSuites: failed.length,
        tests: sum('tests'), assertionsPassed: sum('pass'), assertionsFailed: sum('fail'),
        cancelled: sum('cancelled'), skipped: sum('skipped'), todo: sum('todo'),
        wallSeconds, suiteSeconds: Math.round(sum('seconds') * 10) / 10,
        results,
    };
    if (jsonOutPath) writeFileSync(jsonOutPath, JSON.stringify(report, null, 2));

    if (asJson) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
        process.stdout.write(
            `\nPOSTGRES SUITES  suites=${results.length}  failed=${failed.length}  jobs=${jobs}` +
            `  tests=${sum('tests')} pass=${sum('pass')} fail=${sum('fail')} cancelled=${sum('cancelled')} skipped=${sum('skipped')} todo=${sum('todo')}` +
            `  wall=${wallSeconds}s  image=${DEFAULT_IMAGE}\n`);
        for (const r of failed) {
            process.stdout.write(`  FAIL ${r.name}${r.timedOut ? ' (timed out)' : ''}\n` + (r.firstFailure ? `       ${r.firstFailure}\n` : ''));
        }
    }
    return Math.min(failed.length, 125);
}

main().then((code) => process.exit(code), (error) => {
    removeClusters();
    warn(error.message);
    process.exit(70);
});
