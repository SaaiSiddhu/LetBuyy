// The ownership guard in front of every gateway database suite (scripts/governance/owned-fixture-guard.mjs) and the
// suite-side door that calls it (services/api-gateway/src/__tests__/owned-db/owned-db-support.ts).
//
// The guarantee under test is negative: a suite is handed a database only after the guard has PROVEN, from labels the
// runner wrote, that the cluster, the REST sidecar, the volume, the network and the database are this run's - and every
// other input is refused BEFORE a single statement is sent. So each refusal below is asserted three ways: the error code,
// the recorded docker calls (a refusal made on the announcement alone runs no docker command at all; a refusal made on
// labels runs only `inspect`, never `exec`), and, at the end, through real processes with a docker shim on PATH that
// records every call the code under test makes.
//
// No Docker daemon is needed: the guard takes its docker / fetch / process seams as parameters, and the process-level
// tests put a recording `docker` first on PATH.

import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    OWNED_FIXTURE_ENV as ENV,
    OwnershipError,
    parseOwnedFixtureEnv,
    verifyOwnedFixture,
} from '../../scripts/governance/owned-fixture-guard.mjs';
import {
    DEFAULT_IMAGE,
    DEFAULT_REST_IMAGE,
    FIXTURE_LABEL,
    OWNER_PID_LABEL,
    ROLE_LABEL,
    RUN_ID_LABEL,
} from '../../scripts/governance/executable-pg-fixture.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const RUN = 'a1b2c3d4e5f6';
const OTHER_RUN = '0f0f0f0f0f0f';
const RUNNER_PID = 4242;
const PG = 'letbuyy-exec-4242-abc-def123';
const REST = `letbuyy-exec-${RUN}-rest-1`;
const DB = 'letbuyy_exec_some_suite';
const NETWORK = `letbuyy-exec-${RUN}-1-net`;
const VOLUME = `letbuyy-exec-${RUN}-1-data`;
const REST_PORT = 53999;
const PROXY_PORT = 54000;
const DATA_DIR = '/var/lib/postgresql/data';
const RUNNER_COMMAND = 'node scripts/governance/run-executable-suites.mjs --gateway-db';

const goodEnv = () => ({
    [ENV.runId]: RUN,
    [ENV.runnerPid]: String(RUNNER_PID),
    [ENV.pgContainer]: PG,
    [ENV.pgDatabase]: DB,
    [ENV.restUrl]: `http://127.0.0.1:${PROXY_PORT}`,
    [ENV.restContainer]: REST,
    [ENV.restUpstreamPort]: String(REST_PORT),
    [ENV.restServiceKey]: 'not-a-real-key',
});

const labels = (role, overrides = {}) => ({
    [FIXTURE_LABEL]: '1',
    [OWNER_PID_LABEL]: String(RUNNER_PID),
    [RUN_ID_LABEL]: RUN,
    [ROLE_LABEL]: role,
    ...overrides,
});

/** A faithful description of what the runner builds, as `docker inspect` would report it. Mutated per case. */
function newWorld() {
    return {
        pg: {
            Config: { Image: DEFAULT_IMAGE, Labels: labels('postgres') },
            State: { Running: true },
            HostConfig: { Privileged: false, NetworkMode: NETWORK, Binds: [] },
            Mounts: [{ Type: 'volume', Name: VOLUME, Destination: DATA_DIR }],
            NetworkSettings: { Ports: { '5432/tcp': null }, Networks: { [NETWORK]: {} } },
        },
        rest: {
            Config: { Image: DEFAULT_REST_IMAGE, Labels: labels('postgrest') },
            State: { Running: true },
            HostConfig: { Privileged: false, NetworkMode: NETWORK, Binds: [] },
            Mounts: [],
            NetworkSettings: { Ports: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: String(REST_PORT) }] }, Networks: { [NETWORK]: {} } },
        },
        volume: { Labels: labels('volume') },
        network: { Labels: labels('network') },
        databaseMarker: `${DB}|${RUN}`,
        restAnswer: RUN,
        restThrows: false,
        runnerAlive: true,
        runnerCommand: RUNNER_COMMAND,
        listener: RUNNER_PID,
        missing: new Set(),
    };
}

/** The seams the guard takes, over a world, recording every docker call. */
function seamsFor(world) {
    const calls = [];
    const inspected = (name, value) => (world.missing.has(name) ? { status: 1, stdout: '', stderr: 'No such object' } : { status: 0, stdout: JSON.stringify([value]), stderr: '' });
    return {
        calls,
        deps: {
            docker: (args) => {
                calls.push(args);
                if (args[0] === 'container' && args[1] === 'inspect') return args[2] === PG ? inspected(PG, world.pg) : args[2] === REST ? inspected(REST, world.rest) : { status: 1, stdout: '', stderr: 'No such object' };
                if (args[0] === 'volume' && args[1] === 'inspect') return inspected(args[2], world.volume);
                if (args[0] === 'network' && args[1] === 'inspect') return inspected(args[2], world.network);
                if (args[0] === 'exec') return { status: 0, stdout: `${world.databaseMarker}\n`, stderr: '' };
                return { status: 1, stdout: '', stderr: 'unexpected docker call' };
            },
            fetch: async () => {
                if (world.restThrows) throw new Error('connect ECONNREFUSED');
                return { ok: true, json: async () => world.restAnswer };
            },
            processAlive: () => world.runnerAlive,
            processCommand: () => world.runnerCommand,
            listenerPid: () => world.listener,
        },
    };
}

async function refusal(env, world = newWorld()) {
    const { calls, deps } = seamsFor(world);
    let error;
    try {
        await verifyOwnedFixture(env, deps);
    } catch (caught) {
        error = caught;
    }
    return { error, calls };
}

const kinds = (calls) => calls.map((call) => (call[0] === 'exec' ? 'exec' : `${call[0]}:${call[1]}`));

test('control: a database the runner really built is accepted, after every inspection and only then one read-only query', async () => {
    const { calls, deps } = seamsFor(newWorld());
    const fixture = await verifyOwnedFixture(goodEnv(), deps);
    assert.equal(fixture.runId, RUN);
    assert.equal(fixture.pgContainer, PG);
    assert.equal(fixture.database, DB);
    assert.equal(fixture.volume, VOLUME);
    assert.equal(fixture.restUrl, `http://127.0.0.1:${PROXY_PORT}`);
    assert.equal(JSON.stringify(fixture).includes('not-a-real-key'), false, 'the description carries no secret');
    assert.deepEqual(kinds(calls), ['container:inspect', 'volume:inspect', 'container:inspect', 'network:inspect', 'exec'], 'every inspection precedes the one exec');
    const exec = calls.at(-1);
    assert.match(exec.at(-1), /^SELECT current_database\(\)/, 'the only statement the guard ever sends is a SELECT');
    assert.ok(!/insert|update|delete|drop|alter|create|truncate|grant/i.test(exec.at(-1)), 'and it writes nothing');
});

test('an announcement that is incomplete or malformed is refused before any docker command', () => {
    for (const name of Object.values(ENV)) {
        const env = goodEnv();
        delete env[name];
        assert.throws(() => parseOwnedFixtureEnv(env), (error) => error instanceof OwnershipError && error.code === 'ENV_MISSING' && error.message.includes(name), `${name} missing`);
    }
    const malformed = [
        [ENV.runId, 'not-hex', 'ENV_MALFORMED'],
        [ENV.runId, 'A1B2C3D4E5F6', 'ENV_MALFORMED'],
        [ENV.runnerPid, '1', 'ENV_MALFORMED'],
        [ENV.runnerPid, 'abc', 'ENV_MALFORMED'],
        [ENV.restUpstreamPort, '70000', 'ENV_MALFORMED'],
        [ENV.restUrl, 'http://localhost:54000', 'ENV_MALFORMED'],
        [ENV.restUrl, 'http://127.0.0.1', 'ENV_MALFORMED'],
        [ENV.restUrl, 'http://127.0.0.1:54000/rest/v1', 'ENV_MALFORMED'],
        [ENV.restUrl, 'http://0.0.0.0:54000', 'ENV_MALFORMED'],
        [ENV.restUrl, 'https://127.0.0.1:54000', 'ENV_MALFORMED'],
        [ENV.restUrl, 'not a url', 'ENV_MALFORMED'],
        [ENV.pgDatabase, 'postgres', 'NOT_OWNED_NAME'],
        [ENV.pgDatabase, 'letbuyy_executable', 'NOT_OWNED_NAME'],
        [ENV.pgDatabase, 'letbuyy_exec_Upper', 'NOT_OWNED_NAME'],
        [ENV.pgDatabase, `letbuyy_exec_${'x'.repeat(41)}`, 'NOT_OWNED_NAME'],
    ];
    for (const [name, value, code] of malformed) {
        assert.throws(() => parseOwnedFixtureEnv({ ...goodEnv(), [name]: value }), (error) => error instanceof OwnershipError && error.code === code, `${name}=${value} -> ${code}`);
    }
    assert.throws(() => parseOwnedFixtureEnv({ ...goodEnv(), [ENV.restContainer]: PG }), (error) => error.code === 'ENV_MALFORMED', 'one container cannot be both the cluster and the sidecar');
});

test('the restored development stack, named as the cluster or as the REST sidecar, is refused with no docker command', async () => {
    for (const [field, name] of [
        [ENV.pgContainer, 'supabase_db_letbuyy-newmac-20260926'],
        [ENV.restContainer, 'supabase_rest_letbuyy-newmac-20260926'],
        [ENV.restContainer, 'supabase_kong_letbuyy-newmac-20260926'],
    ]) {
        const { error, calls } = await refusal({ ...goodEnv(), [field]: name });
        assert.ok(error instanceof OwnershipError, `${name} must be refused`);
        assert.equal(error.code, 'RESTORED_STACK');
        assert.deepEqual(calls, [], 'refused on the announcement alone: nothing was inspected, let alone executed');
    }
});

test('an unrelated container, another project\'s container or the shared fixture is refused with no docker command', async () => {
    for (const name of ['edynox-local-db', 'letbuyy-executable-pg', 'postgres', 'letbuyy-exec-', 'my letbuyy-exec-1', 'letbuyy-exec-a;rm']) {
        const { error, calls } = await refusal({ ...goodEnv(), [ENV.pgContainer]: name });
        assert.ok(error instanceof OwnershipError, `${name} must be refused`);
        assert.equal(error.code, 'NOT_OWNED_NAME');
        assert.deepEqual(calls, []);
    }
});

test('a hosted url is refused with no docker command, and a loopback address is not accepted on its own', async () => {
    for (const url of ['https://abcdefgh.supabase.co', 'http://db.example.com:54000', 'https://api.supabase.com:443']) {
        const { error, calls } = await refusal({ ...goodEnv(), [ENV.restUrl]: url });
        assert.ok(error instanceof OwnershipError, `${url} must be refused`);
        assert.equal(error.code, 'HOSTED_URL');
        assert.deepEqual(calls, []);
    }

    // `127.0.0.1` is also the address of the restored stack's own API gateway. The url alone proves nothing: it is
    // refused because what answers there is not this run's sidecar.
    const world = newWorld();
    world.restAnswer = 'not-this-run';
    const restored = await refusal({ ...goodEnv(), [ENV.restUrl]: 'http://127.0.0.1:54321' }, world);
    assert.equal(restored.error?.code, 'REST_MARKER', 'something that does not answer with this run\'s marker is not the owned sidecar');

    const foreignListener = newWorld();
    foreignListener.listener = 99999;
    const listened = await refusal(goodEnv(), foreignListener);
    assert.equal(listened.error?.code, 'REST_MARKER', 'a port served by any process other than the runner is refused');
});

test('a stale announcement from an earlier run is refused before any docker command', async () => {
    const dead = newWorld();
    dead.runnerAlive = false;
    const gone = await refusal(goodEnv(), dead);
    assert.equal(gone.error?.code, 'STALE_RUNNER');
    assert.deepEqual(gone.calls, []);

    const reused = newWorld();
    reused.runnerCommand = '/usr/bin/some-unrelated-daemon --flag';
    const other = await refusal(goodEnv(), reused);
    assert.equal(other.error?.code, 'STALE_RUNNER', 'a pid that was reused by another program is not the runner');
    assert.deepEqual(other.calls, []);

    const none = newWorld();
    none.runnerCommand = null;
    assert.equal((await refusal(goodEnv(), none)).error?.code, 'STALE_RUNNER');
});

test('a container the runner did not label is refused on inspection alone, and nothing is executed in it', async () => {
    const cases = [
        ['cluster without the fixture label', (w) => { delete w.pg.Config.Labels[FIXTURE_LABEL]; }, 'LABEL_MISSING'],
        ['cluster without a run id', (w) => { delete w.pg.Config.Labels[RUN_ID_LABEL]; }, 'LABEL_MISSING'],
        ['cluster labeled by an earlier run', (w) => { w.pg.Config.Labels[RUN_ID_LABEL] = OTHER_RUN; }, 'RUN_ID_MISMATCH'],
        ['cluster owned by another pid', (w) => { w.pg.Config.Labels[OWNER_PID_LABEL] = '7777'; }, 'OWNER_PID_MISMATCH'],
        ['cluster with the wrong role', (w) => { w.pg.Config.Labels[ROLE_LABEL] = 'postgrest'; }, 'ROLE_MISMATCH'],
        ['cluster carrying Supabase stack labels', (w) => { w.pg.Config.Labels['com.supabase.cli.project'] = 'letbuyy-newmac-20260926'; }, 'RESTORED_STACK'],
        ['cluster running a Supabase Postgres image', (w) => { w.pg.Config.Image = 'public.ecr.aws/supabase/postgres:17.6.1.156'; }, 'RESTORED_STACK'],
        ['cluster running an unexpected image', (w) => { w.pg.Config.Image = 'postgres:15-alpine'; }, 'IMAGE_MISMATCH'],
        ['cluster that is not running', (w) => { w.pg.State.Running = false; }, 'NOT_RUNNING'],
        ['privileged cluster', (w) => { w.pg.HostConfig.Privileged = true; }, 'PRIVILEGED'],
        ['cluster on the host network', (w) => { w.pg.HostConfig.NetworkMode = 'host'; }, 'NETWORK_NOT_OWNED'],
        ['cluster with a bind mount', (w) => { w.pg.HostConfig.Binds = ['/Users/someone/dev-db:/var/lib/postgresql/data']; }, 'MOUNT_NOT_OWNED'],
        ['cluster whose data is a bind mount', (w) => { w.pg.Mounts = [{ Type: 'bind', Source: '/Users/someone/dev-db', Destination: DATA_DIR }]; }, 'MOUNT_NOT_OWNED'],
        ['cluster with two mounts', (w) => { w.pg.Mounts.push({ Type: 'volume', Name: 'other', Destination: '/mnt' }); }, 'MOUNT_NOT_OWNED'],
        ['cluster on a shared, restored-looking volume', (w) => { w.volume.Labels = { 'com.supabase.cli.project': 'letbuyy-newmac-20260926' }; }, 'RESTORED_STACK'],
        ['cluster on an unlabeled volume', (w) => { w.volume.Labels = {}; }, 'LABEL_MISSING'],
        ['cluster on another run\'s volume', (w) => { w.volume.Labels[RUN_ID_LABEL] = OTHER_RUN; }, 'RUN_ID_MISMATCH'],
        ['cluster that publishes a port', (w) => { w.pg.NetworkSettings.Ports['5432/tcp'] = [{ HostIp: '0.0.0.0', HostPort: '5432' }]; }, 'PORT_PUBLISHED'],
        ['REST sidecar without the fixture label', (w) => { delete w.rest.Config.Labels[FIXTURE_LABEL]; }, 'LABEL_MISSING'],
        ['REST sidecar of another run', (w) => { w.rest.Config.Labels[RUN_ID_LABEL] = OTHER_RUN; }, 'RUN_ID_MISMATCH'],
        ['REST sidecar with the wrong role', (w) => { w.rest.Config.Labels[ROLE_LABEL] = 'postgres'; }, 'ROLE_MISMATCH'],
        ['REST sidecar running the Supabase stack\'s own gateway image', (w) => { w.rest.Config.Image = 'public.ecr.aws/supabase/kong:2.8.1'; }, 'RESTORED_STACK'],
        ['REST sidecar running an unexpected image', (w) => { w.rest.Config.Image = 'nginx:latest'; }, 'IMAGE_MISMATCH'],
        ['REST sidecar publishing another port', (w) => { w.rest.NetworkSettings.Ports['3000/tcp'] = [{ HostIp: '127.0.0.1', HostPort: '54321' }]; }, 'REST_PORT_MISMATCH'],
        ['REST sidecar published on every interface', (w) => { w.rest.NetworkSettings.Ports['3000/tcp'] = [{ HostIp: '0.0.0.0', HostPort: String(REST_PORT) }]; }, 'REST_PORT_MISMATCH'],
        ['REST sidecar publishing nothing', (w) => { w.rest.NetworkSettings.Ports['3000/tcp'] = null; }, 'REST_PORT_MISMATCH'],
        ['REST sidecar with a mount', (w) => { w.rest.Mounts = [{ Type: 'volume', Name: 'x', Destination: '/x' }]; }, 'MOUNT_NOT_OWNED'],
        ['REST sidecar on another network', (w) => { w.rest.NetworkSettings.Networks = { 'letbuyy-exec-other-net': {} }; }, 'NETWORK_NOT_OWNED'],
        ['cluster on two networks', (w) => { w.pg.NetworkSettings.Networks = { [NETWORK]: {}, bridge: {} }; }, 'NETWORK_NOT_OWNED'],
        ['unlabeled network', (w) => { w.network.Labels = {}; }, 'LABEL_MISSING'],
        ['network of another run', (w) => { w.network.Labels[RUN_ID_LABEL] = OTHER_RUN; }, 'RUN_ID_MISMATCH'],
        ['cluster that no longer exists', (w) => { w.missing.add(PG); }, 'CONTAINER_MISSING'],
        ['REST sidecar that no longer exists', (w) => { w.missing.add(REST); }, 'CONTAINER_MISSING'],
    ];
    for (const [what, mutate, code] of cases) {
        const world = newWorld();
        mutate(world);
        const { error, calls } = await refusal(goodEnv(), world);
        assert.ok(error instanceof OwnershipError, `${what}: must be refused`);
        assert.equal(error.code, code, `${what}: ${error?.message}`);
        assert.ok(calls.every((call) => call[1] === 'inspect'), `${what}: only inspections ran, got ${JSON.stringify(kinds(calls))}`);
    }
});

test('a database that does not carry this run\'s marker is refused, and only after every container was verified', async () => {
    for (const marker of [`${DB}|${OTHER_RUN}`, `${DB}|`, `postgres|${RUN}`, '']) {
        const world = newWorld();
        world.databaseMarker = marker;
        const { error, calls } = await refusal(goodEnv(), world);
        assert.equal(error?.code, 'DB_MARKER', `marker "${marker}"`);
        assert.deepEqual(kinds(calls), ['container:inspect', 'volume:inspect', 'container:inspect', 'network:inspect', 'exec'], 'the one exec is the last thing that happened');
    }
});

test('a REST url that does not answer with this run\'s marker, or does not answer, is refused', async () => {
    for (const mutate of [
        (w) => { w.restAnswer = OTHER_RUN; },
        (w) => { w.restAnswer = null; },
        (w) => { w.restAnswer = { run_id: RUN }; },
        (w) => { w.restThrows = true; },
    ]) {
        const world = newWorld();
        mutate(world);
        assert.equal((await refusal(goodEnv(), world)).error?.code, 'REST_MARKER');
    }
});

test('a guard with no listener probe available still applies every other check', async () => {
    const world = newWorld();
    world.listener = null;
    const { calls, deps } = seamsFor(world);
    const fixture = await verifyOwnedFixture(goodEnv(), deps);
    assert.equal(fixture.runId, RUN);
    assert.equal(calls.length, 5);
});

// ---- real processes, with a recording docker first on PATH -----------------------------------------------------------

function withDockerShim(body) {
    const dir = mkdtempSync(join(tmpdir(), 'letbuyy-guard-shim-'));
    const log = join(dir, 'calls.log');
    writeFileSync(join(dir, 'docker'), `#!/bin/sh\necho "$@" >> "${log}"\nexit 1\n`);
    chmodSync(join(dir, 'docker'), 0o755);
    const calls = () => {
        try {
            return readFileSync(log, 'utf8').split('\n').filter(Boolean);
        } catch {
            return [];
        }
    };
    try {
        return body({ dir, calls, env: { PATH: `${dir}:${dirname(process.execPath)}:/usr/bin:/bin`, HOME: process.env.HOME ?? dir } });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test('the guard\'s own command line refuses with exit 3 and touches no docker for the restored stack, an empty environment or a hosted url', () => {
    withDockerShim(({ env, calls }) => {
        const guard = join(repoRoot, 'scripts/governance/owned-fixture-guard.mjs');
        const run = (extra) => spawnSync(process.execPath, [guard, '--verify'], { encoding: 'utf8', env: { ...env, ...extra } });

        const empty = run({});
        assert.equal(empty.status, 3);
        assert.match(empty.stderr, /ENV_MISSING/);

        const restored = run({ ...goodEnv(), [ENV.pgContainer]: 'supabase_db_letbuyy-newmac-20260926' });
        assert.equal(restored.status, 3);
        assert.match(restored.stderr, /RESTORED_STACK/);

        const hosted = run({ ...goodEnv(), [ENV.restUrl]: 'https://abcdefgh.supabase.co' });
        assert.equal(hosted.status, 3);
        assert.match(hosted.stderr, /HOSTED_URL/);

        assert.deepEqual(calls(), [], 'none of the three refusals ran a docker command');
    });
});

test('a gateway suite cannot obtain a database except through the guard: with no announcement, or the restored stack\'s name, it throws and runs no docker command', () => {
    withDockerShim(({ dir, env, calls }) => {
        const support = join(repoRoot, 'services/api-gateway/src/__tests__/owned-db/owned-db-support.ts');
        // CommonJS on purpose: the gateway package is CommonJS, and that is how its suites load this module.
        const probe = join(dir, 'probe.cjs');
        writeFileSync(probe, [
            `const { requireOwnedDatabase } = require(${JSON.stringify(support)});`,
            'try {',
            '    requireOwnedDatabase();',
            "    process.stdout.write('OBTAINED');",
            '} catch (error) {',
            "    process.stderr.write(String(error instanceof Error ? error.message : error));",
            '    process.exit(3);',
            '}',
        ].join('\n'));
        const tsx = join(repoRoot, 'node_modules/.bin/tsx');
        const attempt = (extra) => spawnSync(tsx, [probe], { encoding: 'utf8', env: { ...env, ...extra }, cwd: repoRoot });

        const none = attempt({});
        assert.equal(none.status, 3, `${none.stdout}${none.stderr}`);
        assert.match(none.stderr, /ENV_MISSING/);
        assert.doesNotMatch(none.stdout, /OBTAINED/);

        const restored = attempt({ ...goodEnv(), [ENV.pgContainer]: 'supabase_db_letbuyy-newmac-20260926' });
        assert.equal(restored.status, 3, `${restored.stdout}${restored.stderr}`);
        assert.match(restored.stderr, /RESTORED_STACK/);
        assert.doesNotMatch(restored.stdout, /OBTAINED/);

        assert.deepEqual(calls(), [], 'the restored stack is not even inspected: the suite never got as far as a docker command');
    });
});

test('the runner refuses a cluster name it does not allocate - the restored stack\'s included - before any docker command', () => {
    withDockerShim(({ env, calls }) => {
        const runner = join(repoRoot, 'scripts/governance/run-executable-suites.mjs');
        for (const name of ['supabase_db_letbuyy-newmac-20260926', 'letbuyy-executable-pg', 'edynox-local-db', 'postgres']) {
            const run = spawnSync(process.execPath, [runner, '--container', name, '--suite', 'tests/governance/owned-fixture-guard.test.mjs'], { encoding: 'utf8', env, cwd: repoRoot });
            assert.equal(run.status, 70, `${name}: ${run.stdout}${run.stderr}`);
            assert.match(run.stderr, /refusing --container/);
        }
        assert.deepEqual(calls(), [], 'no docker command ran for any of them');
    });
});
