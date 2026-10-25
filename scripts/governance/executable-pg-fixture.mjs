// Owned, disposable database infrastructure for the executable suites.
//
// ISOLATION CONTRACT (why the runner is shaped the way it is)
//   Postgres roles are cluster-global. The suites create, alter and DROP app_tenant, service_role,
//   authenticated, anon and app_user, so two suites that share a cluster interfere in two ways:
//     1. state: whatever an earlier suite left (a role without BYPASSRLS, a grant in a database that
//        was never dropped) changes the next suite's result, and `DROP ROLE` fails cluster-wide while
//        any database still holds a grant (the pg_shdepend problem the suites work around with
//        clearRoleDependenciesInSiblingDatabases);
//     2. time: two suites creating the same role at the same moment fail with a raw
//        `duplicate key value violates unique constraint "pg_authid_rolname_index"` instead of the
//        friendly "role already exists", because the existence check and the CREATE are not atomic.
//   So the rules are: every run gets brand-new clusters (nothing survives from any earlier run);
//   inside one cluster suites run strictly one at a time; parallelism means more clusters, never
//   more suites in one cluster. The shared `letbuyy-executable-pg` container is never used here.
//
// WHAT A RUN OWNS (and therefore what it may remove)
//   A run has an identity (RUN_ID_LABEL). Everything it creates carries FIXTURE_LABEL, the owner's pid,
//   the run id and a role:
//     postgres   the cluster container, on its own network, with its own labeled data volume, memory/cpu/
//                pid limits and no published port
//     postgrest  a per-suite REST sidecar (the real PostgREST the gateway's Supabase client talks to),
//                published on 127.0.0.1 only, on the cluster's network
//     network / volume  the cluster's own
//   The stale-resource reaper touches only containers, networks and volumes with that label whose owner
//   pid is dead and that are older than a grace period. It never touches an unlabeled resource, the
//   shared fixture, a Supabase stack or another project's containers. The data volume is a NAMED, LABELED
//   volume on purpose: the postgres image declares an anonymous volume, and `docker rm` (without -v) leaves
//   one dangling per container, unlabeled and therefore not positively attributable to any run. Removal
//   here is `rm -f -v` plus removal of the labeled network and volume, each verified.
//
// SECRETS
//   The REST sidecar's database password and JWT secret are per-suite random values. They are handed to
//   docker BY NAME (`-e NAME`, the value comes from the docker CLI's own environment) so they never appear
//   in an argument list, and no error path here echoes an argument list.

import { spawn, spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';

export const FIXTURE_LABEL = 'com.letbuyy.executable-fixture';
export const OWNER_PID_LABEL = 'com.letbuyy.executable-fixture.owner-pid';
export const RUN_ID_LABEL = 'com.letbuyy.executable-fixture.run-id';
export const ROLE_LABEL = 'com.letbuyy.executable-fixture.role';
export const DEFAULT_IMAGE = process.env.LETBUYY_EXECUTABLE_PG_IMAGE || 'postgres:16-alpine';
// The image the local Supabase stack itself runs, so the REST layer under test is the real one. A workstation never
// pulls it (or the Postgres image) on its own: a missing image is an infrastructure error naming the image, unless the
// operator opts in with LETBUYY_EXECUTABLE_PULL=missing. CI (CI=true) opts in by itself; a hosted runner starts empty.
// See requireImagePresent.
export const DEFAULT_REST_IMAGE = process.env.LETBUYY_EXECUTABLE_REST_IMAGE || 'public.ecr.aws/supabase/postgrest:v16.2';

// Bounds for a shared workstation. One cluster is at most 2 cores and 1 GiB; a REST sidecar at most 1 core and 256 MiB.
export const POSTGRES_LIMITS = Object.freeze({ memory: '1g', cpus: '2', pids: '512' });
export const REST_LIMITS = Object.freeze({ memory: '256m', cpus: '1', pids: '256' });

const DATA_DIR = '/var/lib/postgresql/data';

export function docker(args, { allowFailure = false, input, env, timeout } = {}) {
    const result = spawnSync('docker', args, { encoding: 'utf8', input, timeout, env: env ? { ...process.env, ...env } : process.env });
    if (!allowFailure && result.status !== 0) {
        // Only the subcommand is echoed: the argument list can carry container environment.
        throw new Error(`docker ${args[0]} failed: ${(result.stderr || result.stdout || '').trim().slice(0, 400)}`);
    }
    return result;
}

/**
 * The same as docker(), without blocking the event loop. The runner serves each gateway suite's REST url from its own
 * process, so anything that takes seconds (replaying the migrations, cloning a database) must yield, or a suite that
 * is running at the time would see its requests stall.
 */
export function dockerAsync(args, { allowFailure = false, input } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', (status) => {
            const result = { status: status ?? 1, stdout, stderr };
            if (!allowFailure && result.status !== 0) {
                reject(new Error(`docker ${args[0]} failed: ${(stderr || stdout).trim().slice(0, 400)}`));
            } else {
                resolve(result);
            }
        });
        child.stdin.on('error', () => {});
        child.stdin.end(input ?? '');
    });
}

export function uniqueContainerName(prefix = 'letbuyy-exec') {
    return `${prefix}-${process.pid}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

/** A run's identity: 12 hex characters, fresh for every runner invocation. */
export function newRunId() {
    return randomBytes(6).toString('hex');
}

export const RUN_ID_PATTERN = /^[0-9a-f]{12}$/;

function ownershipLabels({ runId, role }) {
    return [
        '--label', `${FIXTURE_LABEL}=1`,
        '--label', `${OWNER_PID_LABEL}=${process.pid}`,
        '--label', `${RUN_ID_LABEL}=${runId}`,
        '--label', `${ROLE_LABEL}=${role}`,
    ];
}

/** Whether this environment has said that the runner may pull the two images it names. */
export const pullsAllowed = (env = process.env) => env.LETBUYY_EXECUTABLE_PULL === 'missing' || env.CI === 'true';

/**
 * Fails with a message naming the image, instead of letting `docker run` pull it from the network behind the operator's
 * back. With LETBUYY_EXECUTABLE_PULL=missing (or CI=true) a missing image is pulled here, explicitly, once, bounded in
 * time, and only the image that was asked for; every `docker run` below is told `--pull never` regardless.
 */
export function requireImagePresent(image, { env = process.env, run = docker } = {}) {
    if (run(['image', 'inspect', '--format', '{{.Id}}', image], { allowFailure: true }).status === 0) return;
    if (!pullsAllowed(env)) {
        throw new Error(`image ${image} is not present locally; this runner does not pull an image on its own. Pull it once, deliberately (docker pull ${image}), or set LETBUYY_EXECUTABLE_PULL=missing to let this runner pull the images it names (CI=true does that by itself). Alternatively point LETBUYY_EXECUTABLE_PG_IMAGE / LETBUYY_EXECUTABLE_REST_IMAGE at an image you already have.`);
    }
    const pulled = run(['pull', '--quiet', image], { allowFailure: true, timeout: 600_000 });
    if (pulled.status !== 0) {
        throw new Error(`image ${image} is not present locally and could not be pulled: ${`${pulled.stderr || pulled.stdout || pulled.error?.message || ''}`.trim().slice(0, 300)}`);
    }
}

export function createNetwork({ name, runId }) {
    docker(['network', 'create', '--driver', 'bridge', ...ownershipLabels({ runId, role: 'network' }), name]);
    return name;
}

export function createVolume({ name, runId }) {
    docker(['volume', 'create', ...ownershipLabels({ runId, role: 'volume' }), name]);
    return name;
}

/**
 * Starts one owned Postgres cluster. `network` and `volume` are created by the caller (so a failure here can
 * remove exactly what the caller made); when a caller passes neither, both are created here under the
 * container's own name, so a bare startCluster never leaves an anonymous volume either.
 */
// Test-only startup opt-in, confined to the newly owned PostgreSQL process.
// Validate during module loading, before runner resource creation. Unset keeps
// the historical command byte-for-byte; only the literal bounded value 2 works.
export function preparedTransactionArgs(env = process.env) {
    const value = env.LETBUYY_EXECUTABLE_PREPARED_TRANSACTIONS;
    if (value === undefined) return [];
    if (value !== '2') throw new Error('LETBUYY_EXECUTABLE_PREPARED_TRANSACTIONS must be exactly 2 when explicitly set');
    return ['-c', 'max_prepared_transactions=2'];
}

// Validate ambient opt-in before callers can create any owned resource.
const defaultPreparedServerArgs = preparedTransactionArgs();
export function startCluster({ name, database, image = DEFAULT_IMAGE, runId = newRunId(), network, volume, limits = POSTGRES_LIMITS, plain = false, preparedTransactions, disableJit = false, disableAutovacuum = false }) {
    if(typeof disableJit!=='boolean')throw new Error('owned PostgreSQL JIT option must be boolean');
    if(typeof disableAutovacuum!=='boolean')throw new Error('owned PostgreSQL autovacuum option must be boolean');
    const preparedServerArgs = preparedTransactions === undefined ? defaultPreparedServerArgs : preparedTransactionArgs({ LETBUYY_EXECUTABLE_PREPARED_TRANSACTIONS: preparedTransactions });
    if (plain && preparedServerArgs.length) throw new Error('prepared transaction proof requires a real owned PostgreSQL cluster');
    if (plain) {
        // With no real Docker daemon the only docker on the machine is the cloud-sandbox shim (scripts/dev/docker-shim), which
        // models `run`, `exec` and `inspect` of a Postgres container and nothing else: no named volume, network, resource limit
        // or pull flag exists there. This is the invocation it models, and nothing more.
        docker(['run', '-d', '--pull', 'never', '--name', name, ...ownershipLabels({ runId, role: 'postgres' }), '-e', 'POSTGRES_PASSWORD=postgres', '-e', `POSTGRES_DB=${database}`, image]);
        return { name, runId, network: undefined, volume: undefined };
    }
    const ownVolume = volume ?? createVolume({ name: `${name}-data`, runId });
    try {
        docker([
            'run', '-d', '--pull', 'never', '--name', name,
            ...ownershipLabels({ runId, role: 'postgres' }),
            ...(network ? ['--network', network, '--network-alias', 'pg'] : []),
            '--memory', limits.memory, '--memory-swap', limits.memory, '--cpus', limits.cpus, '--pids-limit', limits.pids,
            '--mount', `type=volume,source=${ownVolume},target=${DATA_DIR}`,
            '-e', 'POSTGRES_PASSWORD=postgres',
            '-e', `POSTGRES_DB=${database}`,
            image, ...preparedServerArgs, ...(disableJit ? ['-c','jit=off'] : []), ...(disableAutovacuum ? ['-c','autovacuum=off'] : []),
        ]);
    } catch (error) {
        // The volume this call made (and only that one) goes with the failed start; the caller owns anything it passed in.
        if (!volume) docker(['volume', 'rm', '-f', ownVolume], { allowFailure: true });
        throw error;
    }
    return { name, runId, network, volume: ownVolume };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The postgres image initialises through a TEMPORARY server that listens on the unix socket only,
// stops it, then starts the real one. `pg_isready` over the socket therefore answers "ready" while
// the temporary server is still up, and a query issued straight after can hit the shutdown (measured
// 2026-09-29 on 6 fresh containers: the socket probe led the real server by ~0.3s in 3 of them and a
// query right after it failed in 1). The temporary server has no TCP listener, so a TCP probe is true
// only for the final server; the socket query then confirms it end to end.
export async function waitUntilAccepting(name, { timeoutMs = 60_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const tcp = docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-q'], { allowFailure: true });
        if (tcp.status === 0) {
            const query = docker(['exec', name, 'psql', '-U', 'postgres', '-d', 'postgres', '-qAt', '-c', 'select 1'], { allowFailure: true });
            if (query.status === 0 && query.stdout.trim() === '1') return;
        } else {
            // A container that has exited will never become ready: say why instead of waiting it out.
            const state = docker(['inspect', '-f', '{{.State.Running}}', name], { allowFailure: true });
            if (state.status === 0 && state.stdout.trim() === 'false') {
                const logs = docker(['logs', '--tail', '5', name], { allowFailure: true });
                throw new Error(`${name} exited before Postgres came up: ${`${logs.stdout}${logs.stderr}`.trim().slice(0, 300)}`);
            }
        }
        await delay(200);
    }
    throw new Error(`Postgres did not accept connections in ${name} within ${Math.round(timeoutMs / 1000)}s`);
}

/** Parsed `docker inspect` of a container, or null when it does not exist. */
export function inspectContainer(name) {
    const result = docker(['inspect', '--type', 'container', name], { allowFailure: true });
    if (result.status !== 0) return null;
    try {
        return JSON.parse(result.stdout)[0] ?? null;
    } catch {
        return null;
    }
}

/** The host port a container publishes for `containerPort`, or null. */
export function publishedHostPort(name, containerPort = 3000) {
    const inspected = inspectContainer(name);
    const bindings = inspected?.NetworkSettings?.Ports?.[`${containerPort}/tcp`];
    const port = Number(bindings?.[0]?.HostPort);
    return Number.isInteger(port) && port > 0 ? port : null;
}

/**
 * The real PostgREST, in front of one database of one owned cluster. `env` carries the database URI (with the
 * per-suite password) and the JWT secret and is passed by NAME; see the header.
 */
export function startPostgrest({ name, runId, network, dbHost = 'pg', database, dbPassword, jwtSecret, image = DEFAULT_REST_IMAGE, limits = REST_LIMITS }) {
    docker([
        'run', '-d', '--pull', 'never', '--name', name,
        ...ownershipLabels({ runId, role: 'postgrest' }),
        '--network', network,
        '--memory', limits.memory, '--memory-swap', limits.memory, '--cpus', limits.cpus, '--pids-limit', limits.pids,
        '--read-only',
        '-p', '127.0.0.1::3000',
        '-e', 'PGRST_DB_URI', '-e', 'PGRST_JWT_SECRET',
        '-e', 'PGRST_DB_SCHEMAS=public,letbuyy_fixture',
        '-e', 'PGRST_DB_ANON_ROLE=anon',
        '-e', 'PGRST_DB_EXTRA_SEARCH_PATH=public,extensions',
        '-e', 'PGRST_DB_MAX_ROWS=1000',
        '-e', 'PGRST_DB_POOL=4',
        '-e', 'PGRST_SERVER_HOST=0.0.0.0',
        '-e', 'PGRST_SERVER_PORT=3000',
        '-e', 'PGRST_LOG_LEVEL=error',
        image,
    ], {
        env: {
            PGRST_DB_URI: `postgres://authenticator:${encodeURIComponent(dbPassword)}@${dbHost}:5432/${database}`,
            PGRST_JWT_SECRET: jwtSecret,
        },
    });
    return { name, runId, network };
}

/** Keep an owned REST credential valid for its bounded suite, including provisioning. */
export function fixtureServiceKeyLifetimeSeconds(suiteTimeoutMs) {
    if (!Number.isFinite(suiteTimeoutMs) || suiteTimeoutMs <= 0) {
        throw new RangeError('an owned fixture requires a finite positive suite timeout');
    }
    return Math.max(7200, Math.ceil(suiteTimeoutMs / 1000) + 300);
}

/** HS256 JWT, for the per-suite service-role and anon keys the REST sidecar verifies. */
export function signJwtHs256(secret, claims) {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`;
    return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

/** Removes a container (with any anonymous volume it made) and proves it is gone. */
export function removeContainer(name) {
    docker(['rm', '-f', '-v', name], { allowFailure: true });
    const stillThere = inspectContainer(name) !== null;
    return { kind: 'container', name, removed: !stillThere };
}

export function removeNetwork(name) {
    docker(['network', 'rm', name], { allowFailure: true });
    const stillThere = docker(['network', 'inspect', name], { allowFailure: true }).status === 0;
    return { kind: 'network', name, removed: !stillThere };
}

export function removeVolume(name) {
    docker(['volume', 'rm', name], { allowFailure: true });
    const stillThere = docker(['volume', 'inspect', name], { allowFailure: true }).status === 0;
    return { kind: 'volume', name, removed: !stillThere };
}

/**
 * Removes one cluster and what it owns, in the only order that works (container, then network, then volume), and
 * returns one verified outcome per resource. A cluster given as a bare name owns the volume `<name>-data`.
 */
export function removeCluster(cluster) {
    const { name, network, volume } = typeof cluster === 'string' ? { name: cluster, volume: `${cluster}-data` } : cluster;
    const outcomes = [removeContainer(name)];
    if (network) outcomes.push(removeNetwork(network));
    if (volume) {
        // Only a volume carrying this fixture's label is ever removed by name (a bare-name caller's guess included).
        const labeled = docker(['volume', 'inspect', '-f', `{{index .Labels "${FIXTURE_LABEL}"}}`, volume], { allowFailure: true });
        if (labeled.status === 0 && labeled.stdout.trim() === '1') outcomes.push(removeVolume(volume));
    }
    return outcomes;
}

/** Everything still labeled with a run id, by kind: what a finished run must have left at zero. */
export function listRunResources(runId) {
    const names = (args) => {
        const result = docker(args, { allowFailure: true });
        return result.status === 0 ? result.stdout.split('\n').map((line) => line.trim()).filter(Boolean) : [];
    };
    const filter = `label=${RUN_ID_LABEL}=${runId}`;
    return {
        containers: names(['ps', '-a', '--filter', filter, '--format', '{{.Names}}']),
        networks: names(['network', 'ls', '--filter', filter, '--format', '{{.Name}}']),
        volumes: names(['volume', 'ls', '--filter', filter, '--format', '{{.Name}}']),
    };
}

function pidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === 'EPERM';
    }
}

/**
 * Removes resources whose owner is gone: containers, then networks, then volumes, each of them labeled with
 * FIXTURE_LABEL, carrying a dead owner pid and older than the grace period. Returns the container names (the
 * historical return value) and, separately, the networks and volumes.
 */
function reapAllStaleClusters({ minAgeSeconds = 120, log = () => {}, detail = false } = {}) {
    const staleEnough = (created) => {
        const ageSeconds = (Date.now() - Date.parse(String(created).trim())) / 1000;
        return Number.isFinite(ageSeconds) && ageSeconds >= minAgeSeconds;
    };
    const ownerGone = (pidText) => {
        const pid = Number(pidText);
        return Number.isInteger(pid) && pid !== process.pid && !pidAlive(pid);
    };

    const reaped = [];
    const reapedNetworks = [];
    const reapedVolumes = [];

    const containers = docker([
        'ps', '-a', '--filter', `label=${FIXTURE_LABEL}`,
        '--format', `{{.Names}}\t{{.Label "${OWNER_PID_LABEL}"}}`,
    ], { allowFailure: true });
    if (containers.status === 0) {
        for (const line of containers.stdout.split('\n').filter(Boolean)) {
            const [name, pidText] = line.split('\t');
            if (!name || !ownerGone(pidText)) continue;
            const created = docker(['inspect', '-f', '{{.Created}}', name], { allowFailure: true });
            if (!staleEnough(created.stdout)) continue;
            if (removeContainer(name).removed) {
                reaped.push(name);
                log(`reaped stale executable fixture ${name} (owner pid ${pidText} is gone)`);
            }
        }
    }

    const labeled = (kind, listArgs, createdFormat) => {
        const listing = docker(listArgs, { allowFailure: true });
        if (listing.status !== 0) return [];
        const found = [];
        for (const name of listing.stdout.split('\n').map((line) => line.trim()).filter(Boolean)) {
            const inspected = docker([kind, 'inspect', '-f', `{{index .Labels "${OWNER_PID_LABEL}"}}\t${createdFormat}`, name], { allowFailure: true });
            if (inspected.status !== 0) continue;
            const [pidText, created] = inspected.stdout.trim().split('\t');
            if (ownerGone(pidText) && staleEnough(created)) found.push({ name, pidText });
        }
        return found;
    };

    // A network still attached to a live container cannot be removed and is simply left (allowFailure, verified).
    for (const { name, pidText } of labeled('network', ['network', 'ls', '--filter', `label=${FIXTURE_LABEL}`, '--format', '{{.Name}}'], '{{.Created}}')) {
        if (removeNetwork(name).removed) {
            reapedNetworks.push(name);
            log(`reaped stale executable network ${name} (owner pid ${pidText} is gone)`);
        }
    }
    for (const { name, pidText } of labeled('volume', ['volume', 'ls', '--filter', `label=${FIXTURE_LABEL}`, '--format', '{{.Name}}'], '{{.CreatedAt}}')) {
        if (removeVolume(name).removed) {
            reapedVolumes.push(name);
            log(`reaped stale executable volume ${name} (owner pid ${pidText} is gone)`);
        }
    }

    return detail ? { containers: reaped, networks: reapedNetworks, volumes: reapedVolumes } : reaped;
}

/** Explicit allowsets are validated before even listing Docker resources. */
export function validateReapRunIds(runIds) {
    if (runIds === undefined) return null; // historical unscoped path, not used by lifecycle fixtures
    if (!Array.isArray(runIds) || runIds.length === 0 || runIds.length > 32 || runIds.some(id => typeof id !== 'string' || !RUN_ID_PATTERN.test(id))) {
        throw new Error('reap run IDs must be a nonempty array of at most32 exact12-character lowercase hex IDs');
    }
    return [...new Set(runIds)];
}

/** CLI is deliberately unambiguous: no missing values or equals-form fallback to global reaping. */
export function parseReapRunIds(args) {
    const selected=[];
    for(let i=0;i<args.length;i++) {
        if(!args[i].startsWith('--reap-run-id'))continue;
        if(args[i]!=='--reap-run-id' || !RUN_ID_PATTERN.test(args[i+1]??''))throw new Error('--reap-run-id requires an exact12-character lowercase hex ID');
        selected.push(args[++i]);
    }
    if(args.includes('--reap-only') && args.includes('--no-reap'))throw new Error('--reap-only and --no-reap cannot be combined');
    if(!selected.length)return undefined;
    if(!args.includes('--reap-only') || args.includes('--no-reap'))throw new Error('--reap-run-id is only valid with --reap-only');
    return validateReapRunIds(selected);
}

// Kept separate so supplying an explicit scope can never fall back to legacy discovery.
export function reapStaleClusters({runIds, minAgeSeconds=120, log=()=>{}, detail=false}={}, deps={}) {
    const allow=validateReapRunIds(runIds);
    if(allow===null) {
        if(Object.keys(deps).length)throw new Error('recording seams require an explicit reap run-ID scope');
        return reapAllStaleClusters({minAgeSeconds,log,detail});
    }
    if(!Number.isFinite(minAgeSeconds) || minAgeSeconds<0)throw new Error('reap minimum age must be finite and nonnegative');
    const run=deps.docker??docker, alive=deps.processAlive??pidAlive, now=deps.now??Date.now;
    const reaped={containers:[],networks:[],volumes:[],failures:[]};
    const ownedName=/^letbuyy-exec-[A-Za-z0-9][A-Za-z0-9.-]*$/;
    const restoredImage=/(^|\/)supabase\/(postgres|gotrue|kong|storage-api|realtime|studio|edge-runtime|postgres-meta|supavisor|mailpit|logflare|vector)(:|@|$)/;
    const inspect=(kind,handle)=>{
        const answer=run([kind,'inspect',handle],{allowFailure:true});
        if(answer.status!==0) {
            // Literal equality binds the whole known response to this exact handle;
            // handles are never interpreted as patterns. Allow one terminal CLI newline.
            const missingNetwork=kind==='network'&&answer.status===1&&(answer.stderr??'').replace(/\r?\n$/,'')===`Error response from daemon: network ${handle} not found`;
            return missingNetwork||/no such (?:object|container|network|volume)/i.test(answer.stderr??'')?{missing:true}:null;
        }
        try {const values=JSON.parse(answer.stdout);return Array.isArray(values)&&values.length===1?values[0]:null;}catch{return null;}
    };
    const safe=(kind,item,runId)=>{
        if(!item || item.missing)return false;
        const labels=item.Config?.Labels??item.Labels??{}, name=String(item.Name??'').replace(/^\//,'');
        if(!ownedName.test(name) || labels[FIXTURE_LABEL]!=='1' || labels[RUN_ID_LABEL]!==runId || !allow.includes(labels[RUN_ID_LABEL]))return false;
        if(Object.keys(labels).some(key=>key.startsWith('com.supabase.') || key.startsWith('com.docker.compose.') && key.endsWith('.project') && /supabase/i.test(String(labels[key]))))return false;
        const role=labels[ROLE_LABEL], expected=kind==='network'?'network':kind==='volume'?'volume':null;
        if(expected ? role!==expected : !['postgres','postgrest'].includes(role))return false;
        if(kind==='container') {
            if(!/^[0-9a-f]{64}$/.test(item.Id??''))return false;
            const image=item.Config?.Image;
            if(restoredImage.test(String(image)) || image!==(role==='postgres'?DEFAULT_IMAGE:DEFAULT_REST_IMAGE))return false;
            if(item.HostConfig?.Privileged || item.HostConfig?.NetworkMode==='host' || (item.HostConfig?.Binds??[]).length || (item.Mounts??[]).some(m=>m.Type==='bind'))return false;
        }
        if(kind==='network' && !/^[0-9a-f]{64}$/.test(item.Id??''))return false;
        const pidText=labels[OWNER_PID_LABEL],pid=Number(pidText);
        if(!Number.isInteger(pid) || pid<=1 || pid>2147483647 || String(pid)!==pidText || pid===process.pid)return false;
        try {if(alive(pid)!==false)return false;}catch{return false;}
        const age=(now()-Date.parse(String(kind==='volume'?item.CreatedAt:item.Created)))/1000;
        return Number.isFinite(age) && age>=minAgeSeconds;
    };
    for(const [kind,plural] of [['container','containers'],['network','networks'],['volume','volumes']])for(const runId of allow) {
        const filters=['--filter',`label=${FIXTURE_LABEL}=1`,'--filter',`label=${RUN_ID_LABEL}=${runId}`];
        const args=kind==='container'?['ps','-a',...filters,'--format','{{.ID}}']: [kind,'ls',...filters,'--format',kind==='network'?'{{.ID}}':'{{.Name}}'];
        const listed=run(args,{allowFailure:true});
        if(listed.status!==0){reaped.failures.push(`${kind} discovery failed for selected run ${runId}`);continue;}
        for(const handle of [...new Set(listed.stdout.split('\n').map(s=>s.trim()).filter(Boolean))]) {
            const item=inspect(kind,handle);if(!safe(kind,item,runId))continue;
            const name=String(item.Name).replace(/^\//,''), identity=kind==='volume'?name:item.Id;
            // Immutable IDs for containers/networks, and exact label/creation revalidation
            // for named volumes. A foreign replacement is never removed by guessed name.
            const check=inspect(kind,identity);
            if(!safe(kind,check,runId) || check.Created!==item.Created || check.CreatedAt!==item.CreatedAt || check.Id!==item.Id)continue;
            const removed=run(kind==='container'?['rm','-f',identity]:[kind,'rm',identity],{allowFailure:true});
            const after=inspect(kind,identity);
            if(removed.status!==0 || !after?.missing){reaped.failures.push(`${kind} ${name} removal not verified`);continue;}
            reaped[plural].push(name);log(`reaped selected stale executable ${kind} ${name}`);
        }
    }
    return detail?reaped:reaped.containers;
}
