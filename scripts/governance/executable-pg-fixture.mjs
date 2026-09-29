// Owned, disposable Postgres clusters for the executable suites.
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
// CLEANUP IS LIMITED TO WHAT THIS MODULE CREATED
//   Every container carries FIXTURE_LABEL and the owner's pid. The stale-cluster reaper touches only
//   containers with that label whose owner pid is dead and that are older than a grace period. It
//   never touches an unlabeled container, the shared fixture, a Supabase stack or another project's
//   containers.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

export const FIXTURE_LABEL = 'com.letbuyy.executable-fixture';
export const OWNER_PID_LABEL = 'com.letbuyy.executable-fixture.owner-pid';
export const DEFAULT_IMAGE = process.env.LETBUYY_EXECUTABLE_PG_IMAGE || 'postgres:16-alpine';

export function docker(args, { allowFailure = false, input } = {}) {
    const result = spawnSync('docker', args, { encoding: 'utf8', input });
    if (!allowFailure && result.status !== 0) {
        // Only the subcommand is echoed: the argument list carries container environment.
        throw new Error(`docker ${args[0]} failed: ${(result.stderr || result.stdout || '').trim().slice(0, 400)}`);
    }
    return result;
}

export function uniqueContainerName(prefix = 'letbuyy-exec') {
    return `${prefix}-${process.pid}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

export function startCluster({ name, database, image = DEFAULT_IMAGE }) {
    docker([
        'run', '-d', '--name', name,
        '--label', `${FIXTURE_LABEL}=1`,
        '--label', `${OWNER_PID_LABEL}=${process.pid}`,
        '-e', 'POSTGRES_PASSWORD=postgres',
        '-e', `POSTGRES_DB=${database}`,
        image,
    ]);
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

export function removeCluster(name) {
    docker(['rm', '-f', name], { allowFailure: true });
}

function pidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === 'EPERM';
    }
}

export function reapStaleClusters({ minAgeSeconds = 120, log = () => {} } = {}) {
    const listing = docker([
        'ps', '-a', '--filter', `label=${FIXTURE_LABEL}`,
        '--format', `{{.Names}}\t{{.Label "${OWNER_PID_LABEL}"}}`,
    ], { allowFailure: true });
    if (listing.status !== 0) return [];

    const reaped = [];
    for (const line of listing.stdout.split('\n').filter(Boolean)) {
        const [name, pidText] = line.split('\t');
        const pid = Number(pidText);
        if (!name || !Number.isInteger(pid) || pid === process.pid || pidAlive(pid)) continue;
        const created = docker(['inspect', '-f', '{{.Created}}', name], { allowFailure: true });
        const ageSeconds = (Date.now() - Date.parse(created.stdout.trim())) / 1000;
        if (!Number.isFinite(ageSeconds) || ageSeconds < minAgeSeconds) continue;
        removeCluster(name);
        reaped.push(name);
        log(`reaped stale executable fixture ${name} (owner pid ${pid} is gone)`);
    }
    return reaped;
}
