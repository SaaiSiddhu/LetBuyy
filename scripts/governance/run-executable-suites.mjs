#!/usr/bin/env node
// Run the executable Postgres suites as a set, against a container this runner owns.
//
// WHY THIS EXISTS (CAP-C66)
// No gate lane runs tests/executable, so the only way anyone learns those suites are red is by
// remembering to run them one at a time. Two were red on develop for some time while every phase
// reported a clean gate; chasing them found a latent checkout outage (CAP-C65).
//
// WHY IT CREATES ITS OWN CONTAINER
// Several suites drop and recreate databases and replay every migration, and three refuse to run at
// all unless LETBUYY_EXECUTABLE_PG_CONTAINER names a dedicated throwaway — a sensible guard, since
// the shared `letbuyy-executable-pg` container carries other sessions' in-progress state. Rather
// than working around that guard, this runner satisfies it: it starts a uniquely-named container,
// runs everything inside it, and removes it. Nothing outside that container is touched.
//
// It sits in scripts/governance/ beside foundation-ephemeral-postgres.mjs, which is the same class
// of thing — a test-execution tool, not a migration or a build step.
//
// Usage:
//   node scripts/governance/run-executable-suites.mjs [--filter <substring>] [--list] [--json]
//                                          [--keep-container] [--timeout <seconds>]
// Exit code is the number of failing suites, so it composes with a gate lane.

import { spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const suiteDir = join(repoRoot, 'tests/executable');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
    const i = args.indexOf(name);
    return i === -1 || i === args.length - 1 ? fallback : args[i + 1];
};

const filter = value('--filter', null);
const asJson = flag('--json');
const keepContainer = flag('--keep-container');
const perSuiteTimeoutMs = Number(value('--timeout', '600')) * 1000;
const image = process.env.LETBUYY_EXECUTABLE_PG_IMAGE || 'postgres:16-alpine';
// The database name the suites share by default; suites needing isolation pick their own.
const sharedDatabase = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';

// Unique per run: a name that can never collide with the shared container or with a parallel run.
const container = value('--container', `letbuyy-exec-${process.pid}-${Math.floor(process.uptime() * 1000)}`);

function docker(dockerArgs, { allowFailure = false } = {}) {
    const result = spawnSync('docker', dockerArgs, { encoding: 'utf8' });
    if (!allowFailure && result.status !== 0) {
        throw new Error(`docker ${dockerArgs.join(' ')} failed:\n${result.stderr || result.stdout}`);
    }
    return result;
}

function suites() {
    return readdirSync(suiteDir)
        .filter((name) => name.endsWith('.test.mjs'))
        .filter((name) => !filter || name.includes(filter))
        .sort();
}

function startContainer() {
    // POSTGRES_DB matters: roughly half the suites default LETBUYY_EXECUTABLE_PG_DATABASE to
    // `letbuyy_executable` and expect it to exist, which is why
    // scripts/governance/foundation-ephemeral-postgres.mjs creates the container with it. Without
    // this, those suites fail in ~0.3s with a connection error that looks exactly like a red test —
    // the first run of this runner reported 22 "failures" that were all this one line.
    docker(['run', '-d', '--name', container,
        '-e', 'POSTGRES_PASSWORD=postgres',
        '-e', `POSTGRES_DB=${sharedDatabase}`,
        image]);
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        if (docker(['exec', container, 'pg_isready', '-U', 'postgres'], { allowFailure: true }).status === 0) return;
        spawnSync('sleep', ['1']);
    }
    throw new Error(`Postgres did not become ready in ${container} within 60s`);
}

function removeContainer() {
    if (keepContainer) return;
    docker(['rm', '-f', container], { allowFailure: true });
}

// Postgres identifiers cap at 63 bytes; suite names are long, so trim from the front and keep the
// distinctive tail.
function databaseNameFor(suiteName) {
    const slug = suiteName.replace(/\.test\.mjs$/, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    return `letbuyy_exec_${slug}`.slice(0, 63);
}

function runSuite(name) {
    return new Promise((resolve) => {
        const started = Date.now();
        // Per-suite database. Without it the suites contaminate each other: about twenty share the
        // default `letbuyy_executable` and leave schema and rows behind, so the second suite to touch
        // a table sees the first one's state and fails in a fraction of a second. Run standalone they
        // pass. That mutual contamination is why this set has never been run as a set, and it has to
        // be fixed in the runner rather than in twenty suites.
        const database = databaseNameFor(name);
        // Two separate psql invocations, not one `-c` with both statements: psql wraps a multi-command
        // -c string in an implicit transaction and CREATE DATABASE cannot run inside one. Doing it the
        // short way failed silently under allowFailure, the database never existed, and every suite
        // then died in ~0.2s looking exactly like a red test.
        docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres',
                '-c', `DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`], { allowFailure: true });
        docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
                '-c', `CREATE DATABASE "${database}";`]);

        const child = spawn('node', ['--test', join('tests/executable', name)], {
            cwd: repoRoot,
            encoding: 'utf8',
            env: {
                ...process.env,
                LETBUYY_EXECUTABLE_PG_CONTAINER: container,
                LETBUYY_EXECUTABLE_PG_DATABASE: database,
            },
        });
        let out = '';
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, perSuiteTimeoutMs);
        child.stdout.on('data', (d) => { out += d; });
        child.stderr.on('data', (d) => { out += d; });
        child.on('close', (code) => {
            clearTimeout(timer);
            docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres',
                    '-c', `DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`], { allowFailure: true });
            const number = (label) => Number(out.match(new RegExp(`^ℹ ${label} (\\d+)`, 'm'))?.[1] ?? 0);
            const firstFailure = out.split('\n').find((line) => line.startsWith('✖ ')) ?? '';
            resolve({
                name: name.replace(/-postgres\.test\.mjs$|\.test\.mjs$/, ''),
                code: timedOut ? 124 : code,
                timedOut,
                pass: number('pass'),
                fail: number('fail'),
                skipped: number('skipped'),
                seconds: Math.round((Date.now() - started) / 100) / 10,
                firstFailure: firstFailure.replace(/ \([0-9.]+ms\)$/, '').slice(0, 96),
                output: out,
            });
        });
    });
}

const results = [];
let startupError = null;
try {
    startContainer();
    for (const name of suites()) {
        const result = await runSuite(name);
        results.push(result);
        if (!asJson) {
            process.stdout.write(
                `  ${result.name.padEnd(48)} ${String(result.code === 0 ? 'ok' : 'FAIL').padEnd(5)}` +
                ` pass=${String(result.pass).padStart(3)} fail=${String(result.fail).padStart(2)}` +
                ` ${String(result.seconds).padStart(6)}s${result.timedOut ? '  TIMED OUT' : ''}\n`);
        }
    }
} catch (error) {
    startupError = error;
} finally {
    removeContainer();
}

if (startupError) {
    process.stderr.write(`run-executable-suites: ${startupError.message}\n`);
    process.exit(2);
}

const failed = results.filter((r) => r.code !== 0);
const totalSeconds = Math.round(results.reduce((sum, r) => sum + r.seconds, 0) * 10) / 10;
const totalPass = results.reduce((sum, r) => sum + r.pass, 0);
const totalFail = results.reduce((sum, r) => sum + r.fail, 0);

if (asJson) {
    process.stdout.write(JSON.stringify({
        container, image, suites: results.length, failedSuites: failed.length,
        assertionsPassed: totalPass, assertionsFailed: totalFail, seconds: totalSeconds,
        results: results.map(({ output, ...rest }) => rest),
    }, null, 2) + '\n');
} else {
    process.stdout.write(
        `\nEXECUTABLE SUITES  suites=${results.length}  failed=${failed.length}` +
        `  assertions=${totalPass} passed / ${totalFail} failed  wall=${totalSeconds}s  image=${image}\n`);
    for (const r of failed) {
        process.stdout.write(`  FAIL ${r.name}${r.timedOut ? ' (timed out)' : ''}\n` +
                             (r.firstFailure ? `       ${r.firstFailure}\n` : ''));
    }
}

process.exit(failed.length);
