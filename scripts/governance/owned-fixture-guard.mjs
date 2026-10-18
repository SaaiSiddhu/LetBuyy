// The fail-closed ownership check in front of every write a database suite makes.
//
// A suite that is about to create tenants, orders and ledger rows must be able to show that the database it was
// handed is one THIS run built, and not a database that merely has a plausible name. Nothing here trusts a name, a
// hostname or a port on its own: a host called localhost is also the restored development stack. Ownership is
// established from what the runner wrote and the suite cannot forge cheaply:
//
//   1. the environment names a run, the runner's pid, two containers, a database and one REST url, all well-formed,
//      and the url is exactly http://127.0.0.1:<port> (a hosted url fails here, before anything else runs);
//   2. the runner is alive, and is the runner (a stale environment from an earlier run names a dead pid);
//   3. each container carries the fixture label, THIS run's id, the right role and the runner's pid; is the expected
//      image; is running; is privileged nowhere and on no host network; the cluster publishes no port; the REST
//      sidecar publishes exactly the announced port on 127.0.0.1; the cluster's only mount is a volume the run
//      labeled (never a bind mount: nothing the restored stack could own); both sit on one network the run labeled;
//   4. the database itself carries the run's marker (set by the runner when it cloned the database);
//   5. the REST url, asked for the marker through PostgREST, answers with the same run id and reaches the same
//      database.
//
// The check is read-only: docker inspect, one SELECT and one STABLE rpc. It refuses the restored stack by name AND by
// its labels and image, and it never executes SQL in a container before that container's labels have been verified.
// Any failure throws an OwnershipError carrying a code; the caller stops.
//
// Used three ways: by the runner as a pre-flight before it starts a suite, by each suite (through the CLI below) as its
// first act, and by tests, which inject the docker / fetch / process seams to prove each refusal without a daemon.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { DEFAULT_IMAGE, DEFAULT_REST_IMAGE, FIXTURE_LABEL, OWNER_PID_LABEL, RUN_ID_LABEL, ROLE_LABEL, RUN_ID_PATTERN } from './executable-pg-fixture.mjs';
import { isOwnedDatabaseName } from './owned-database-name.mjs';

export const OWNED_FIXTURE_ENV = Object.freeze({
    runId: 'LETBUYY_EXECUTABLE_RUN_ID',
    runnerPid: 'LETBUYY_EXECUTABLE_RUNNER_PID',
    pgContainer: 'LETBUYY_EXECUTABLE_PG_CONTAINER',
    pgDatabase: 'LETBUYY_EXECUTABLE_PG_DATABASE',
    restUrl: 'LETBUYY_OWNED_REST_URL',
    restContainer: 'LETBUYY_OWNED_REST_CONTAINER',
    restUpstreamPort: 'LETBUYY_OWNED_REST_UPSTREAM_PORT',
    restServiceKey: 'LETBUYY_OWNED_REST_SERVICE_KEY',
});

export class OwnershipError extends Error {
    constructor(code, message) {
        super(`owned fixture refused [${code}]: ${message}`);
        this.name = 'OwnershipError';
        this.code = code;
    }
}

const CONTAINER_NAME = /^letbuyy-exec-[A-Za-z0-9][A-Za-z0-9.-]*$/;
const REST_URL = /^http:\/\/127\.0\.0\.1:(\d{2,5})$/;
const RUNNER_COMMAND = 'run-executable-suites';
const DATA_DIR = '/var/lib/postgresql/data';
// The images a local Supabase stack is made of, matched by exact repository so that the PostgREST image the REST sidecar is
// SUPPOSED to run (supabase/postgrest, which begins with the same letters as supabase/postgres) is not mistaken for one.
const SUPABASE_STACK_IMAGE = /(^|\/)supabase\/(postgres|gotrue|kong|storage-api|realtime|studio|edge-runtime|postgres-meta|supavisor|mailpit|logflare|vector)(:|@|$)/;

function defaultDocker(args, { input } = {}) {
    const result = spawnSync('docker', args, { encoding: 'utf8', input, timeout: 15_000 });
    return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function defaultProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === 'EPERM';
    }
}

function defaultProcessCommand(pid) {
    const result = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8', timeout: 5_000 });
    return result.status === 0 ? result.stdout.trim() : null;
}

/** The pid listening on a loopback port, or null when it cannot be told (no lsof): that one check is then skipped. */
function defaultListenerPid(port) {
    const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], { encoding: 'utf8', timeout: 5_000 });
    if (result.error || result.status !== 0) return null;
    const pid = Number(result.stdout.split('\n').find((line) => line.startsWith('p'))?.slice(1));
    return Number.isInteger(pid) ? pid : null;
}

/** Pure: validates the environment and the shape of every value. Touches nothing. */
export function parseOwnedFixtureEnv(env) {
    const read = (name) => (env[name] ?? '').trim();
    const missing = Object.values(OWNED_FIXTURE_ENV).filter((name) => read(name) === '');
    if (missing.length > 0) {
        throw new OwnershipError('ENV_MISSING', `${missing.join(', ')} not set: a database suite runs only through scripts/governance/run-executable-suites.mjs, which provisions and announces its own database`);
    }

    const restUrl = read(OWNED_FIXTURE_ENV.restUrl);
    const urlMatch = REST_URL.exec(restUrl);
    if (!urlMatch) {
        // A url on any other host is a hosted (or at least a foreign) endpoint; a loopback url that is not exactly the sidecar's
        // address is malformed. Neither is accepted: `localhost` is also where the restored development stack listens.
        let host = '';
        try { host = new URL(restUrl).hostname.toLowerCase(); } catch { /* not a url at all */ }
        const loopback = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(host);
        throw new OwnershipError(/^https?:\/\//i.test(restUrl) && !loopback ? 'HOSTED_URL' : 'ENV_MALFORMED', `the REST url must be exactly http://127.0.0.1:<port> (the owned sidecar), not ${new URL(restUrl, 'http://invalid.invalid').origin}`);
    }

    const runId = read(OWNED_FIXTURE_ENV.runId);
    if (!RUN_ID_PATTERN.test(runId)) throw new OwnershipError('ENV_MALFORMED', 'the run id is not 12 hex characters');

    const runnerPid = Number(read(OWNED_FIXTURE_ENV.runnerPid));
    if (!Number.isInteger(runnerPid) || runnerPid <= 1) throw new OwnershipError('ENV_MALFORMED', 'the runner pid is not a process id');

    const upstreamPort = Number(read(OWNED_FIXTURE_ENV.restUpstreamPort));
    if (!Number.isInteger(upstreamPort) || upstreamPort <= 0 || upstreamPort > 65535) throw new OwnershipError('ENV_MALFORMED', 'the REST upstream port is not a port');

    const pgContainer = read(OWNED_FIXTURE_ENV.pgContainer);
    const restContainer = read(OWNED_FIXTURE_ENV.restContainer);
    for (const [label, name] of [['cluster', pgContainer], ['REST', restContainer]]) {
        // The development stack is named explicitly so the refusal says what it is; everything else that is not one
        // of this runner's names is refused by the same pattern.
        if (/^supabase_/.test(name)) throw new OwnershipError('RESTORED_STACK', `${label} container "${name}" is a Supabase development stack container`);
        if (!CONTAINER_NAME.test(name)) throw new OwnershipError('NOT_OWNED_NAME', `${label} container "${name}" is not a name this runner allocates`);
    }
    if (pgContainer === restContainer) throw new OwnershipError('ENV_MALFORMED', 'the cluster and the REST sidecar cannot be one container');

    const database = read(OWNED_FIXTURE_ENV.pgDatabase);
    if (!isOwnedDatabaseName(database)) throw new OwnershipError('NOT_OWNED_NAME', `database "${database}" is not a name this runner allocates`);

    return { runId, runnerPid, pgContainer, restContainer, database, restUrl, restPort: Number(urlMatch[1]), upstreamPort, serviceKey: read(OWNED_FIXTURE_ENV.restServiceKey) };
}

function inspectOne(docker, kind, name) {
    const result = docker([kind, 'inspect', name]);
    if (result.status !== 0) throw new OwnershipError('CONTAINER_MISSING', `${kind} "${name}" does not exist`);
    try {
        return JSON.parse(result.stdout)[0];
    } catch {
        throw new OwnershipError('CONTAINER_MISSING', `${kind} "${name}" could not be inspected`);
    }
}

function requireLabels(inspected, { runId, role, runnerPid, what }) {
    const labels = inspected?.Config?.Labels ?? inspected?.Labels ?? {};
    if (Object.keys(labels).some((key) => key.startsWith('com.supabase.') || key.startsWith('com.docker.compose.') && key.endsWith('.project') && /supabase/i.test(String(labels[key])))) {
        throw new OwnershipError('RESTORED_STACK', `${what} carries Supabase stack labels`);
    }
    if (labels[FIXTURE_LABEL] !== '1') throw new OwnershipError('LABEL_MISSING', `${what} does not carry ${FIXTURE_LABEL}: it was not created by this runner`);
    if (labels[RUN_ID_LABEL] === undefined) throw new OwnershipError('LABEL_MISSING', `${what} does not carry a run id`);
    if (labels[RUN_ID_LABEL] !== runId) throw new OwnershipError('RUN_ID_MISMATCH', `${what} belongs to run ${labels[RUN_ID_LABEL]}, not ${runId}`);
    if (role && labels[ROLE_LABEL] !== role) throw new OwnershipError('ROLE_MISMATCH', `${what} has role ${labels[ROLE_LABEL] ?? 'none'}, expected ${role}`);
    if (runnerPid && labels[OWNER_PID_LABEL] !== String(runnerPid)) throw new OwnershipError('OWNER_PID_MISMATCH', `${what} is owned by pid ${labels[OWNER_PID_LABEL] ?? 'none'}, not the runner ${runnerPid}`);
}

function requireSafeContainer(inspected, { image, what }) {
    if (inspected.State?.Running !== true) throw new OwnershipError('NOT_RUNNING', `${what} is not running`);
    if (SUPABASE_STACK_IMAGE.test(String(inspected.Config?.Image))) throw new OwnershipError('RESTORED_STACK', `${what} runs a Supabase stack image`);
    if (inspected.Config?.Image !== image) throw new OwnershipError('IMAGE_MISMATCH', `${what} runs ${inspected.Config?.Image}, expected ${image}`);
    if (inspected.HostConfig?.Privileged) throw new OwnershipError('PRIVILEGED', `${what} is privileged`);
    if (inspected.HostConfig?.NetworkMode === 'host') throw new OwnershipError('NETWORK_NOT_OWNED', `${what} is on the host network`);
    if ((inspected.HostConfig?.Binds ?? []).length > 0) throw new OwnershipError('MOUNT_NOT_OWNED', `${what} has bind mounts`);
    if ((inspected.Mounts ?? []).some((mount) => mount.Type === 'bind')) throw new OwnershipError('MOUNT_NOT_OWNED', `${what} has a bind mount: ${inspected.Mounts.find((mount) => mount.Type === 'bind').Destination}`);
}

function networkNameOf(inspected, what) {
    const names = Object.keys(inspected.NetworkSettings?.Networks ?? {});
    if (names.length !== 1) throw new OwnershipError('NETWORK_NOT_OWNED', `${what} must be on exactly one network, found ${names.length}`);
    return names[0];
}

/**
 * Proves the announced database is this run's, or throws an OwnershipError. Resolves to a description with no secrets in
 * it (the service key is returned separately by the caller's own environment, never by this function).
 */
export async function verifyOwnedFixture(env = process.env, deps = {}) {
    const seams = {
        docker: defaultDocker,
        fetch: globalThis.fetch,
        processAlive: defaultProcessAlive,
        processCommand: defaultProcessCommand,
        listenerPid: defaultListenerPid,
        pgImage: DEFAULT_IMAGE,
        restImage: DEFAULT_REST_IMAGE,
        ...deps,
    };

    // 1. Everything that can be refused without touching anything.
    const cfg = parseOwnedFixtureEnv(env);

    // 2. A stale environment names a runner that no longer exists (or a pid that was reused for something else).
    if (!seams.processAlive(cfg.runnerPid)) throw new OwnershipError('STALE_RUNNER', `the runner (pid ${cfg.runnerPid}) is not running: this environment is left over from an earlier run`);
    const command = seams.processCommand(cfg.runnerPid);
    if (!command || !command.includes(RUNNER_COMMAND)) throw new OwnershipError('STALE_RUNNER', `pid ${cfg.runnerPid} is not the fixture runner`);

    // 3. The containers, by their own labels. Nothing is executed inside either before both are verified.
    const pg = inspectOne(seams.docker, 'container', cfg.pgContainer);
    requireLabels(pg, { runId: cfg.runId, role: 'postgres', runnerPid: cfg.runnerPid, what: `cluster ${cfg.pgContainer}` });
    requireSafeContainer(pg, { image: seams.pgImage, what: `cluster ${cfg.pgContainer}` });
    if (Object.values(pg.NetworkSettings?.Ports ?? {}).some((bindings) => Array.isArray(bindings) && bindings.length > 0)) {
        throw new OwnershipError('PORT_PUBLISHED', `cluster ${cfg.pgContainer} publishes a port; an owned cluster is reachable only through docker exec and its network`);
    }
    const mounts = pg.Mounts ?? [];
    if (mounts.length !== 1 || mounts[0].Type !== 'volume' || mounts[0].Destination !== DATA_DIR) {
        throw new OwnershipError('MOUNT_NOT_OWNED', `cluster ${cfg.pgContainer} must have exactly one mount, its own data volume`);
    }
    requireLabels(inspectOne(seams.docker, 'volume', mounts[0].Name), { runId: cfg.runId, role: 'volume', runnerPid: cfg.runnerPid, what: `volume ${mounts[0].Name}` });

    const rest = inspectOne(seams.docker, 'container', cfg.restContainer);
    requireLabels(rest, { runId: cfg.runId, role: 'postgrest', runnerPid: cfg.runnerPid, what: `REST sidecar ${cfg.restContainer}` });
    requireSafeContainer(rest, { image: seams.restImage, what: `REST sidecar ${cfg.restContainer}` });
    const restBindings = rest.NetworkSettings?.Ports?.['3000/tcp'] ?? [];
    if (restBindings.length !== 1 || restBindings[0].HostIp !== '127.0.0.1' || Number(restBindings[0].HostPort) !== cfg.upstreamPort) {
        throw new OwnershipError('REST_PORT_MISMATCH', `REST sidecar ${cfg.restContainer} does not publish exactly 127.0.0.1:${cfg.upstreamPort}`);
    }
    if ((rest.Mounts ?? []).length > 0) throw new OwnershipError('MOUNT_NOT_OWNED', `REST sidecar ${cfg.restContainer} has mounts`);

    const network = networkNameOf(pg, `cluster ${cfg.pgContainer}`);
    if (networkNameOf(rest, `REST sidecar ${cfg.restContainer}`) !== network) throw new OwnershipError('NETWORK_NOT_OWNED', 'the cluster and its REST sidecar are not on one network');
    requireLabels(inspectOne(seams.docker, 'network', network), { runId: cfg.runId, role: 'network', runnerPid: cfg.runnerPid, what: `network ${network}` });

    // 4. The database's own marker: a read-only query, in a container whose labels were just verified.
    const marker = seams.docker(
        ['exec', cfg.pgContainer, 'psql', '-U', 'postgres', '-d', cfg.database, '-qAt', '-c', "SELECT current_database() || '|' || coalesce(current_setting('letbuyy.fixture_run_id', true), '')"],
    );
    if (marker.status !== 0 || marker.stdout.trim() !== `${cfg.database}|${cfg.runId}`) {
        throw new OwnershipError('DB_MARKER', `database ${cfg.database} does not carry this run's marker`);
    }

    // 5. The REST url, asked through PostgREST for the same marker.
    if (typeof seams.fetch !== 'function') throw new OwnershipError('REST_MARKER', 'no fetch available to verify the REST url');
    let answer;
    try {
        const response = await seams.fetch(`${cfg.restUrl}/rest/v1/rpc/run_id`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'content-profile': 'letbuyy_fixture', apikey: cfg.serviceKey, authorization: `Bearer ${cfg.serviceKey}` },
            body: '{}',
            signal: AbortSignal.timeout(5_000),
        });
        answer = response.ok ? await response.json() : null;
    } catch {
        answer = null;
    }
    if (answer !== cfg.runId) throw new OwnershipError('REST_MARKER', `${cfg.restUrl} does not answer with this run's marker`);

    // The listener on the announced port is the runner's own proxy. Skipped only where the OS cannot say (no lsof).
    const listener = seams.listenerPid(cfg.restPort);
    if (listener !== null && listener !== cfg.runnerPid) throw new OwnershipError('REST_MARKER', `port ${cfg.restPort} is served by pid ${listener}, not the runner`);

    return Object.freeze({
        runId: cfg.runId,
        runnerPid: cfg.runnerPid,
        pgContainer: cfg.pgContainer,
        database: cfg.database,
        restContainer: cfg.restContainer,
        restUrl: cfg.restUrl,
        network,
        volume: mounts[0].Name,
        pgImage: pg.Config.Image,
        restImage: rest.Config.Image,
    });
}

// CLI: `node owned-fixture-guard.mjs --verify` prints the description as JSON and exits 0, or prints the refusal to
// stderr and exits 3. Suites call it first, before any statement.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href && process.argv.includes('--verify')) {
    verifyOwnedFixture(process.env).then(
        (fixture) => process.stdout.write(`${JSON.stringify(fixture)}\n`),
        (error) => {
            process.stderr.write(`${error instanceof OwnershipError ? error.message : `owned fixture check failed: ${error?.message ?? error}`}\n`);
            process.exit(error instanceof OwnershipError ? 3 : 1);
        },
    );
}
