#!/usr/bin/env node
// Run the database-backed suites as a set, each inside infrastructure this runner owns.
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
// is written out in executable-pg-fixture.mjs. Nothing outside the resources this run created is
// touched, and a run that is killed leaves nothing behind that the next run does not reap.
//
// TWO KINDS OF SUITE
//   postgres    tests/**/*.test.mjs that name LETBUYY_EXECUTABLE_PG_CONTAINER. They build whatever schema they need in
//               an empty per-suite database and run under `node --test`.
//   gateway-db  services/api-gateway/src/__tests__/owned-db/*.test.ts, run under `tsx --test`. They need the full
//               schema and the real REST layer the gateway talks to, so for each one the runner: clones a database
//               from the cluster's pristine, fully migrated template; starts a real PostgREST on the cluster's
//               network (bounded memory and cpu, published on 127.0.0.1 only); fronts it with the `/rest/v1` proxy the
//               Supabase client expects; announces all of it through LETBUYY_EXECUTABLE_* / LETBUYY_OWNED_* variables;
//               and proves the announcement true (owned-fixture-guard.mjs) BEFORE it starts the suite. A suite that
//               cannot be proven owned is not started. The suite repeats the proof as its first act, so running it
//               any other way fails closed instead of reaching for a database it was not given. A gateway-db suite
//               may not skip: a skipped or empty suite is a failure, never a pass.
//
// RESOURCES AND CLEANUP
//   Concurrency is bounded (--jobs, default 2 clusters; suites inside one cluster run one at a time). Every container
//   has memory, cpu and pid limits. Each suite's REST sidecar and database are removed when the suite ends; the run's
//   clusters, networks and volumes when the run ends, on a signal, or after an infrastructure failure. Every removal is
//   verified, and a final query by the run's own label must find nothing. Test processes run in their own process group
//   so an interrupted run signals the whole tree, not only the launcher. Anything that cannot be removed is reported with
//   its exact name and exit code 71; a run killed with SIGKILL leaves labeled resources that the next run reaps (only
//   resources labeled by this fixture, whose owner pid is dead and older than the grace period).
//
// Usage:
//   node scripts/governance/run-executable-suites.mjs [--filter <substring>] [--suite <path>]...
//        [--suite-dir <dir>]... [--gateway-db] [--jobs <n>] [--timeout <seconds>] [--log-dir <dir>] [--json]
//        [--json-out <file>] [--list] [--keep-container] [--container <name>] [--kind postgres|gateway-db] [--no-reap]
//        [--reap-only] [--reap-min-age <seconds>]
// --container names the cluster(s); it must be one of this runner's own names (letbuyy-exec-...), and anything else -
// a Supabase development container included - is refused before a single docker command runs. --kind applies to
// explicit --suite/--suite-dir paths that live outside the catalog (the runner's own lifecycle tests use it).
// With no --suite/--suite-dir it runs every database-backed suite the catalog finds: the tests/ suites and the gateway's.
// --gateway-db selects only the gateway's. Exit code: the number of failing suites (capped at 125 so it can never wrap to
// 0), 70 when the infrastructure itself could not start, 71 when cleanup could not be completed, so a lane can consume it.

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { constants as osConstants } from 'node:os';
import { existsSync, mkdirSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    DEFAULT_IMAGE,
    DEFAULT_REST_IMAGE,
    POSTGRES_LIMITS,
    REST_LIMITS,
    createNetwork,
    createVolume,
    docker,
    listRunResources,
    newRunId,
    publishedHostPort,
    reapStaleClusters,
    parseReapRunIds,
    removeContainer,
    removeNetwork,
    removeVolume,
    requireImagePresent,
    signJwtHs256,
    startCluster,
    startPostgrest,
    uniqueContainerName,
    waitUntilAccepting,
} from './executable-pg-fixture.mjs';
import { buildGatewayTemplate, createSuiteDatabase, dropSuiteDatabase } from './owned-database-provision.mjs';
import { OWNED_FIXTURE_ENV, verifyOwnedFixture } from './owned-fixture-guard.mjs';
import { ownedDatabaseNameFor } from './owned-database-name.mjs';
import { startRestProxy } from './owned-rest-proxy.mjs';
import { discoverSuites, isGatewayDatabaseSuite } from './test-suite-catalog.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const values = (name) => args.flatMap((arg, i) => (arg === name && i < args.length - 1 ? [args[i + 1]] : []));
const value = (name, fallback) => values(name)[0] ?? fallback;

const runId = newRunId();
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
const seconds = (since) => Math.round((Date.now() - since) / 100) / 10;

const forcedKind = value('--kind', null);
const kindOf = (suite) => forcedKind ?? (isGatewayDatabaseSuite(suite) ? 'gateway-db' : 'postgres');

// The one shape of cluster name this runner allocates, and the ownership guard accepts. A name a caller supplies is never
// trusted to be safe: it is checked here, before anything is created, against the same pattern.
const OWNED_CLUSTER_NAME = /^letbuyy-exec-[A-Za-z0-9][A-Za-z0-9.-]*$/;

function selectSuites() {
    if (forcedKind !== null && !['postgres', 'gateway-db'].includes(forcedKind)) throw new Error(`--kind must be postgres or gateway-db, not ${forcedKind}`);
    if (forcedKind !== null && values('--suite').length + values('--suite-dir').length === 0) throw new Error('--kind applies only to explicit --suite / --suite-dir paths');
    const explicit = values('--suite').map((suite) => (isAbsolute(suite) ? relative(repoRoot, suite) : suite));
    for (const dir of values('--suite-dir')) {
        const absolute = resolve(repoRoot, dir);
        for (const name of readdirSync(absolute).filter((n) => n.endsWith('.test.mjs') || n.endsWith('.test.ts')).sort()) {
            explicit.push(relative(repoRoot, join(absolute, name)));
        }
    }
    const discovered = discoverSuites(repoRoot);
    const chosen = explicit.length > 0 ? explicit : flag('--gateway-db') ? discovered.gatewayDb : [...discovered.postgres, ...discovered.gatewayDb];
    for (const suite of chosen) {
        if (!existsSync(join(repoRoot, suite))) throw new Error(`suite not found: ${suite}`);
    }
    return chosen.filter((suite) => !filter || suite.includes(filter)).map((path) => ({ path, kind: kindOf(path) }));
}

const psqlOn = (cluster, sql, { allowFailure = false } = {}) =>
    docker(['exec', '-i', cluster.name, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql], { allowFailure });

const running = new Set();
const activeRest = new Set();
const activeProxies = new Set();
const clusters = [];
const cleanupOutcomes = [];
let restCounter = 0;
let shuttingDown = false;
// Whether `docker info` answers. Without a daemon the only docker is the sandbox shim (see startCluster's `plain`).
let realDaemon = true;

// A test process leads its own process group (detached), so a signal reaches everything it started, not just the launcher.
function killGroup(child, signal) {
    try {
        process.kill(-child.pid, signal);
    } catch {
        try { child.kill(signal); } catch { /* already gone */ }
    }
}

/** True while any member of the child's process group is alive. */
function groupAlive(child) {
    try {
        process.kill(-child.pid, 0);
        return true;
    } catch (error) {
        return error.code === 'EPERM';
    }
}

function removeClusters() {
    if (keepContainer) return;
    // Only what this run demonstrably created is removed: each flag is set after its own create call succeeded.
    for (const cluster of clusters) {
        if (cluster.containerStarted) cleanupOutcomes.push(removeContainer(cluster.name));
        if (cluster.networkCreated) cleanupOutcomes.push(removeNetwork(cluster.network));
        if (cluster.volumeCreated) cleanupOutcomes.push(removeVolume(cluster.volume));
    }
}

function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of running) killGroup(child, 'SIGKILL');
    for (const name of activeRest) removeContainer(name);
    for (const proxy of activeProxies) proxy.close();
    removeClusters();
    process.exit(128 + (osConstants.signals[signal] ?? 15));
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => shutdown(signal));

const tsxBin = join(repoRoot, 'node_modules/.bin/tsx');

/** Runs one test command in its own process group and resolves with its combined output. Never rejects. */
function spawnAndCollect(command, commandArgs, env, suite) {
    if(suite)writeLog(suite,'');
    return new Promise((resolveResult) => {
        const child = spawn(command, commandArgs, { cwd: repoRoot, env, detached: true });
        running.add(child);
        let out = '';
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; killGroup(child, 'SIGKILL'); }, perSuiteTimeoutMs);
        const collect=(d)=>{out+=d;if(suite&&logDir)appendFileSync(join(logDir,`${basename(suite.path).replace(/\.test\.(mjs|ts)$/, '')}.log`),d);};
        child.stdout.on('data', collect);
        child.stderr.on('data', collect);
        child.on('error', (error) => { out += `failed to start ${basename(command)}: ${error.code ?? error.message}\n`; });
        child.on('close', (code) => {
            running.delete(child);
            clearTimeout(timer);
            // The launcher has exited; anything still alive in its group is a straggler of this suite and is stopped.
            const stragglers = groupAlive(child);
            if (stragglers) killGroup(child, 'SIGKILL');
            resolveResult({ out, code, timedOut, stragglers });
        });
    });
}

// NODE_TEST_CONTEXT is set by an outer `node --test`. Inherited, it puts the nested runner in
// its "child" mode: no TAP summary, and a failing test exits 0. That reads exactly like a pass,
// so it is removed here and any result without a summary is refused below.
function baseEnv() {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    return env;
}

// A database suite is given its own endpoints and nothing else. Whatever the caller's shell carries that could name
// another database - a Supabase url or key, a connection string, libpq settings, an earlier run's variables - is dropped.
const INHERITED_DATABASE_SETTINGS = /^(SUPABASE_|DATABASE_URL$|POSTGRES_|PG(HOST|PORT|USER|PASSWORD|DATABASE|SERVICE|SSLMODE|OPTIONS)$|INTERNAL_API_SECRET$|LETBUYY_(LOCAL_SUPABASE|EXECUTABLE_PG_CONTAINER|EXECUTABLE_PG_DATABASE|EXECUTABLE_RUN_ID|EXECUTABLE_RUNNER_PID|OWNED_))/;
function gatewayEnv(fixtureEnv) {
    const env = baseEnv();
    for (const key of Object.keys(env)) if (INHERITED_DATABASE_SETTINGS.test(key)) delete env[key];
    return { ...env, ...fixtureEnv };
}

function tapResult(suite, cluster, out, code, timedOut, started, extra = {}) {
    // Node 22's `node --test` TAP output uses `# <label> <n>` and `not ok <n> - <name>`.
    const number = (label) => Number(out.match(new RegExp(`^# ${label} (\\d+)`, 'm'))?.[1] ?? 0);
    const lines = out.split('\n');
    const failures = lines.filter((line) => /^not ok \d+ - /.test(line)).map((line) => line.replace(/ \([0-9.]+ms\)$/, ''));
    const skips = lines.filter((line) => /^ok \d+ - .* # SKIP/.test(line)).map((line) => line.replace(/ \([0-9.]+ms\)$/, ''));
    // Exit status is not trusted alone: a suite is red if the process failed, the TAP summary
    // reports a failure or a cancellation, or there is no summary at all.
    const hasSummary = /^# tests \d+/m.test(out);
    const consistent = hasSummary && number('fail') === 0 && number('cancelled') === 0;
    let resultCode = timedOut ? 124 : (code ?? 1) !== 0 ? (code ?? 1) : consistent ? 0 : 1;
    if (suite.kind === 'gateway-db' && resultCode === 0) {
        // The point of the owned lane is that the database checks RUN. A skipped, todo or empty suite would read as green
        // while proving nothing, so here it is red. Node reports a test file that registers no test as ONE passing "test"
        // named after the file itself, so a count of zero never happens: what has to be found is a test with a name of its own.
        const executed = lines
            .filter((line) => /^ok \d+ - /.test(line) && !/ # (SKIP|TODO)/.test(line))
            .map((line) => line.replace(/^ok \d+ - /, '').replace(/ \([0-9.]+ms\)$/, ''))
            .filter((name) => !/[\\/].+\.test\.(ts|mjs|js)$/.test(name));
        if (number('tests') === 0 || executed.length === 0) { resultCode = 1; failures.push('no tests executed'); }
        if (number('skipped') > 0 || number('todo') > 0) { resultCode = 1; failures.push(`${number('skipped')} skipped / ${number('todo')} todo: a gateway database suite may not skip`); }
    }
    return {
        name: basename(suite.path).replace(/-postgres\.test\.mjs$|\.test\.(mjs|ts)$/, ''),
        path: suite.path,
        kind: suite.kind,
        cluster: cluster.name,
        code: resultCode,
        timedOut,
        hasSummary,
        tests: number('tests'),
        pass: number('pass'),
        fail: number('fail'),
        cancelled: number('cancelled'),
        skipped: number('skipped'),
        todo: number('todo'),
        seconds: seconds(started),
        firstFailure: (failures[0] ?? '').slice(0, 96),
        failures,
        skips,
        out,
        ...extra,
    };
}

function writeLog(suite, out) {
    if (!logDir) return;
    mkdirSync(logDir, { recursive: true });
    writeFileSync(join(logDir, `${basename(suite.path).replace(/\.test\.(mjs|ts)$/, '')}.log`), out);
}

async function runPostgresSuite(suite, cluster) {
    const started = Date.now();
    // Per-suite database. Without it the suites contaminate each other: about twenty share the
    // default `letbuyy_executable` and leave schema and rows behind, so the second suite to touch
    // a table sees the first one's state and fails in a fraction of a second. Run standalone they
    // pass. Two separate psql invocations, not one `-c` with both statements: psql wraps a
    // multi-command -c string in an implicit transaction and CREATE DATABASE cannot run in one.
    const database = ownedDatabaseNameFor(suite.path);
    psqlOn(cluster, `DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`, { allowFailure: true });
    psqlOn(cluster, `CREATE DATABASE "${database}";`);

    const env = { ...baseEnv(), LETBUYY_EXECUTABLE_PG_CONTAINER: cluster.name, LETBUYY_EXECUTABLE_PG_DATABASE: database, LETBUYY_EXECUTABLE_RUN_ID: runId };
    const { out, code, timedOut, stragglers } = await spawnAndCollect('node', ['--test', suite.path], env, suite);
    psqlOn(cluster, `DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`, { allowFailure: true });
    writeLog(suite, out);
    return tapResult(suite, cluster, out, code, timedOut, started, { database, strayProcessesStopped: stragglers });
}

/** Polls the marker through the proxy until the sidecar answers with this run's id, or gives up with its own log. */
async function waitForRest(proxyUrl, serviceKey, restName) {
    const deadline = Date.now() + 60_000;
    let last = 'no answer';
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${proxyUrl}/rest/v1/rpc/run_id`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'content-profile': 'letbuyy_fixture', apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
                body: '{}',
                signal: AbortSignal.timeout(3_000),
            });
            if (response.ok && (await response.json()) === runId) return;
            last = `HTTP ${response.status}`;
        } catch (error) {
            last = error?.cause?.code ?? error?.code ?? 'unreachable';
        }
        await new Promise((done) => setTimeout(done, 250));
    }
    const logs = docker(['logs', '--tail', '6', restName], { allowFailure: true });
    throw new Error(`the REST sidecar ${restName} did not become ready within 60s (${last}): ${`${logs.stdout}${logs.stderr}`.trim().slice(0, 300)}`);
}

async function runGatewaySuite(suite, cluster) {
    const started = Date.now();
    const database = ownedDatabaseNameFor(suite.path);
    const restName = `letbuyy-exec-${runId}-rest-${++restCounter}`;
    const record = { database, templateSeconds: 0, provisionSeconds: 0, rest: null, ownership: 'not verified', cleanup: { rest: null, database: null } };
    let proxy = null;
    let databaseCreated = false;
    let restStarted = false;
    let result;
    try {
        // The template is built once per cluster; a second suite on the cluster waits on the same promise.
        const templateStarted = Date.now();
        cluster.template ??= buildGatewayTemplate(cluster, { repoRoot, restPassword: cluster.restPassword });
        await cluster.template;
        record.templateSeconds = seconds(templateStarted);

        const provisionStarted = Date.now();
        await createSuiteDatabase(cluster, database, runId);
        databaseCreated = true;

        const jwtSecret = randomBytes(32).toString('hex');
        const issuedAt = Math.floor(Date.now() / 1000);
        const serviceKey = signJwtHs256(jwtSecret, { role: 'service_role', iss: 'letbuyy-owned-fixture', iat: issuedAt, exp: issuedAt + 7200 });
        startPostgrest({ name: restName, runId, network: cluster.network, database, dbPassword: cluster.restPassword, jwtSecret });
        restStarted = true;
        activeRest.add(restName);
        const upstreamPort = publishedHostPort(restName, 3000);
        if (!upstreamPort) throw new Error(`the REST sidecar ${restName} published no port`);
        proxy = await startRestProxy({ upstreamPort });
        activeProxies.add(proxy);
        await waitForRest(proxy.url, serviceKey, restName);

        const fixtureEnv = {
            [OWNED_FIXTURE_ENV.runId]: runId,
            [OWNED_FIXTURE_ENV.runnerPid]: String(process.pid),
            [OWNED_FIXTURE_ENV.pgContainer]: cluster.name,
            [OWNED_FIXTURE_ENV.pgDatabase]: database,
            [OWNED_FIXTURE_ENV.restUrl]: proxy.url,
            [OWNED_FIXTURE_ENV.restContainer]: restName,
            [OWNED_FIXTURE_ENV.restUpstreamPort]: String(upstreamPort),
            [OWNED_FIXTURE_ENV.restServiceKey]: serviceKey,
            LETBUYY_OWNED_SQL_PASSWORD: cluster.restPassword,
        };
        // The runner holds itself to the rule it imposes: nothing starts until ownership is proven.
        await verifyOwnedFixture(fixtureEnv);
        record.ownership = 'verified before start';
        record.rest = { container: restName, upstreamPort, proxyPort: proxy.port };
        record.provisionSeconds = seconds(provisionStarted);

        const testStarted = Date.now();
        const { out, code, timedOut, stragglers } = await spawnAndCollect(tsxBin, ['--test', suite.path], gatewayEnv(fixtureEnv), suite);
        writeLog(suite, out);
        result = tapResult(suite, cluster, out, code, timedOut, testStarted, { strayProcessesStopped: stragglers });
    } catch (error) {
        const message = String(error?.message ?? error).slice(0, 400);
        writeLog(suite, `infrastructure failure before the suite started: ${message}\n`);
        result = tapResult(suite, cluster, '', 70, false, started, {});
        result.failures = [`infrastructure: ${message}`];
        result.firstFailure = result.failures[0].slice(0, 96);
    } finally {
        if (proxy) {
            record.proxyRequests = { ...proxy.stats };
            await proxy.close();
            activeProxies.delete(proxy);
        }
        if (restStarted) {
            record.cleanup.rest = removeContainer(restName).removed;
            activeRest.delete(restName);
            cleanupOutcomes.push({ kind: 'container', name: restName, removed: record.cleanup.rest });
        }
        if (databaseCreated) record.cleanup.database = await dropSuiteDatabase(cluster, database);
    }
    result.seconds = seconds(started);
    Object.assign(result, record);
    return result;
}

/** A gateway database suite on a machine with no real Docker daemon: red, with the reason, never skipped and never faked. */
function refusedResult(suite) {
    const result = tapResult(suite, { name: '-' }, '', 70, false, Date.now(), {});
    result.failures = ['infrastructure: no real Docker daemon answers `docker info`; the gateway database lane needs one (the sandbox docker shim models only Postgres run/exec/inspect: no labels, networks, volumes or published ports for a PostgREST sidecar)'];
    result.firstFailure = result.failures[0].slice(0, 96);
    result.ownership = 'not started';
    return result;
}

function runSuite(suite, cluster) {
    return suite.kind === 'gateway-db' ? runGatewaySuite(suite, cluster) : runPostgresSuite(suite, cluster);
}

async function startClusters(count) {
    for (let i = 0; i < count; i += 1) {
        const name = count > 1 ? `${containerBase}-${i + 1}` : containerBase;
        // Network and volume names carry the run id, so they can never collide with something that is not this run's.
        const cluster = {
            name, runId, containerStarted: false, networkCreated: false, volumeCreated: false,
            network: realDaemon ? `letbuyy-exec-${runId}-${i + 1}-net` : null,
            volume: realDaemon ? `letbuyy-exec-${runId}-${i + 1}-data` : null,
            restPassword: randomBytes(24).toString('hex'),
            template: null,
        };
        // Registered before anything is created, so a failure part-way still removes what this run made. The container is
        // only marked started once `docker run` succeeded: a name that was already taken belongs to someone else, and
        // cleanup must never remove a container this run did not create.
        clusters.push(cluster);
        if (realDaemon) {
            createNetwork({ name: cluster.network, runId });
            cluster.networkCreated = true;
            createVolume({ name: cluster.volume, runId });
            cluster.volumeCreated = true;
        }
        startCluster({ name, database: sharedDatabase, runId, network: cluster.network ?? undefined, volume: cluster.volume ?? undefined, plain: !realDaemon, preparedTransactions: value('--prepared-transactions', undefined), disableJit: true });
        cluster.containerStarted = true;
    }
    await Promise.all(clusters.map((cluster) => waitUntilAccepting(cluster.name)));
}

async function main() {
    const reapRunIds = parseReapRunIds(args);
    if (value('--prepared-transactions', undefined) !== undefined && value('--prepared-transactions', undefined) !== '2') throw new Error('--prepared-transactions must be exactly 2');
    const reapMinAgeSeconds = Number(value('--reap-min-age', '120'));
    if (flag('--reap-only')) {
        const { containers, networks, volumes } = reapStaleClusters({ runIds: reapRunIds, minAgeSeconds: reapMinAgeSeconds, log: warn, detail: true });
        process.stdout.write(JSON.stringify({ reaped: containers, reapedNetworks: networks, reapedVolumes: volumes }) + '\n');
        return 0;
    }

    const suites = selectSuites();
    if (flag('--list')) {
        process.stdout.write(asJson ? JSON.stringify(suites.map((suite) => suite.path), null, 2) + '\n' : suites.map((suite) => suite.path).join('\n') + '\n');
        return 0;
    }
    if (suites.length === 0) throw new Error('no suites selected');
    if (!OWNED_CLUSTER_NAME.test(containerBase)) {
        // Refused with no docker command at all: not even an inspect of a container this runner did not name.
        throw new Error(`refusing --container ${containerBase}: a cluster name must be one this runner allocates (letbuyy-exec-...); the Supabase development stack and every other container are never used`);
    }

    // Optional exclusive-create receipt is durable before the first Docker operation.
    // Lifecycle SIGKILL/failure cleanup can select this exact generated run, never guessed names.
    if (args.includes('--run-receipt')) {
        const path = value('--run-receipt', null);
        if (values('--run-receipt').length !== 1 || !path || path.startsWith('--')) throw new Error('--run-receipt requires one new file path');
        writeFileSync(path, JSON.stringify({ runId, runnerPid: process.pid, containerBase }) + '\n', { flag: 'wx', mode: 0o600 });
    }

    // Parallel clusters are only isolated when each container is a real one. The cloud-sandbox docker
    // shim (scripts/dev/docker-shim) maps every container name onto ONE native cluster, so parallel
    // suites there would share roles and race; it does not implement `docker info`, which is the tell.
    realDaemon = docker(['info'], { allowFailure: true }).status === 0;
    // Labels, networks and volumes exist only on a real daemon, so there is nothing for the shim to reap or to count.
    const reaped = flag('--no-reap') || !realDaemon ? [] : reapStaleClusters({ minAgeSeconds: reapMinAgeSeconds, log: warn });
    // The shim cannot host a gateway suite (no PostgREST sidecar, no labels): those are reported red with the reason, and
    // the Postgres suites keep the flow the shim was written for.
    const refused = realDaemon ? [] : suites.filter((suite) => suite.kind === 'gateway-db');
    const runnable = suites.filter((suite) => !refused.includes(suite));
    let jobs = Math.max(1, Math.min(Number.isFinite(requestedJobs) ? requestedJobs : 1, runnable.length));
    if (jobs > 1 && !realDaemon) {
        warn('no real Docker daemon (shim or daemon down): running one suite at a time, parallel clusters would not be isolated');
        jobs = 1;
    }
    const wallStart = Date.now();
    const results = [];
    let infrastructureError = null;
    const report_ = (suite, result) => {
        const detail = suite.kind === 'gateway-db' ? `  [gateway-db${result.rest ? `, rest :${result.rest.upstreamPort}` : ''}]` : '';
        say(`  ${result.name.padEnd(48)} ${String(result.code === 0 ? 'ok' : 'FAIL').padEnd(5)}` +
            ` pass=${String(result.pass).padStart(3)} fail=${String(result.fail).padStart(2)}` +
            ` skip=${String(result.skipped).padStart(2)} ${String(result.seconds).padStart(6)}s${result.timedOut ? '  TIMED OUT' : ''}${detail}`);
    };

    try {
        for (const suite of refused) {
            const result = refusedResult(suite);
            results.push(result);
            report_(suite, result);
        }
        if (runnable.length > 0) {
            if (realDaemon) {
                // An image that is not here is named, never pulled behind the operator's back.
                requireImagePresent(DEFAULT_IMAGE);
                if (runnable.some((suite) => suite.kind === 'gateway-db')) requireImagePresent(DEFAULT_REST_IMAGE);
            }
            await startClusters(jobs);
            const queue = [...runnable];
            await Promise.all(clusters.map(async (cluster) => {
                while (!shuttingDown) {
                    const suite = queue.shift();
                    if (!suite) return;
                    const result = await runSuite(suite, cluster);
                    results.push(result);
                    report_(suite, result);
                }
            }));
        }
    } catch (error) {
        infrastructureError = error;
    } finally {
        removeClusters();
    }

    // What a finished run must have left at zero, asked of docker by the run's own label.
    const remaining = realDaemon ? listRunResources(runId) : { containers: [], networks: [], volumes: [] };
    const leftover = keepContainer ? [] : [...remaining.containers, ...remaining.networks, ...remaining.volumes];
    const cleanupFailures = [...cleanupOutcomes.filter((outcome) => !outcome.removed).map((outcome) => `${outcome.kind} ${outcome.name}`), ...leftover.map((name) => `remaining ${name}`)];
    if (cleanupFailures.length > 0) {
        warn(`cleanup incomplete; these resources carry run id ${runId} and can be removed with \`node scripts/governance/run-executable-suites.mjs --reap-only\` once this process has exited: ${[...new Set(cleanupFailures)].join(', ')}`);
    }

    if (infrastructureError) {
        warn(infrastructureError.message);
        if (asJson) process.stdout.write(JSON.stringify({ runId, infrastructureError: infrastructureError.message, cleanupFailures }) + '\n');
        return 70;
    }

    results.sort((a, b) => a.path.localeCompare(b.path));
    const failed = results.filter((r) => r.code !== 0);
    const sum = (key) => results.reduce((total, r) => total + r[key], 0);
    const wallSeconds = Math.round((Date.now() - wallStart) / 100) / 10;
    const report = {
        runId, image: DEFAULT_IMAGE, restImage: DEFAULT_REST_IMAGE, limits: { postgres: POSTGRES_LIMITS, rest: REST_LIMITS },
        jobs, containers: clusters.map((c) => c.name), reaped,
        suites: results.length, gatewayDbSuites: results.filter((r) => r.kind === 'gateway-db').length, failedSuites: failed.length,
        tests: sum('tests'), assertionsPassed: sum('pass'), assertionsFailed: sum('fail'),
        cancelled: sum('cancelled'), skipped: sum('skipped'), todo: sum('todo'),
        wallSeconds, suiteSeconds: Math.round(sum('seconds') * 10) / 10,
        cleanup: { failures: [...new Set(cleanupFailures)], remaining },
        // The captured output of every suite stays in --log-dir; the report carries the accounting only.
        results: results.map(({ out, ...rest }) => rest),
    };
    if (jsonOutPath) writeFileSync(jsonOutPath, JSON.stringify(report, null, 2));

    if (asJson) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
        process.stdout.write(
            `\nPOSTGRES SUITES  suites=${results.length}  failed=${failed.length}  jobs=${jobs}` +
            `  tests=${sum('tests')} pass=${sum('pass')} fail=${sum('fail')} cancelled=${sum('cancelled')} skipped=${sum('skipped')} todo=${sum('todo')}` +
            `  wall=${wallSeconds}s  image=${DEFAULT_IMAGE}  run=${runId}\n`);
        for (const r of failed) {
            process.stdout.write(`  FAIL ${r.name}${r.timedOut ? ' (timed out)' : ''}\n` + (r.firstFailure ? `       ${r.firstFailure}\n` : ''));
        }
    }
    if (cleanupFailures.length > 0 && failed.length === 0) return 71;
    return Math.min(failed.length, 125);
}

main().then((code) => process.exit(code), (error) => {
    removeClusters();
    warn(error.message);
    process.exit(70);
});
