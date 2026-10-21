// The gateway database lane's lifecycle, against a real Docker daemon: what it provisions, what a red, a skipping or an
// empty suite reads as, what happens when a run is interrupted or killed, and that nothing this run made is ever left
// behind (and nothing it did not make is ever removed).
//
// Each case runs the real runner on tiny suites written into a temporary directory and marked --kind gateway-db, so they
// get exactly what a real gateway suite gets: a database cloned from the migrated template, a real PostgREST, the ownership
// proof. Where a case needs the real thing (the concurrency and repeat case) it runs a real gateway suite.
//
// Every claim about cleanup is checked by asking docker directly, by the run's own labels, and never by reading the
// runner's report of itself.
//
// These tests need a real Docker daemon and the two images the runner names (a hosted or sandboxed shim cannot label,
// publish or remove anything); without one they SKIP with that reason on the test line. Nothing else in this file needs it.

import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pullsAllowed, requireImagePresent } from '../../scripts/governance/executable-pg-fixture.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runner = join(repoRoot, 'scripts/governance/run-executable-suites.mjs');
const SUPPORT = join(repoRoot, 'services/api-gateway/src/__tests__/owned-db/owned-db-support.ts');
const FIXTURE_LABEL = 'com.letbuyy.executable-fixture';
const OWNER_LABEL = 'com.letbuyy.executable-fixture.owner-pid';
const RUN_LABEL = 'com.letbuyy.executable-fixture.run-id';
const PG_IMAGE = process.env.LETBUYY_EXECUTABLE_PG_IMAGE || 'postgres:16-alpine';
const REST_IMAGE = process.env.LETBUYY_EXECUTABLE_REST_IMAGE || 'public.ecr.aws/supabase/postgrest:v16.2';

const docker = (args) => spawnSync('docker', args, { encoding: 'utf8' });
const hasImage = (image) => docker(['image', 'inspect', '--format', '{{.Id}}', image]).status === 0;
const realDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
// Where the environment has said the runner may pull (CI=true, or LETBUYY_EXECUTABLE_PULL=missing) these tests pull the two images it
// names, exactly as the runner would, so a hosted runner that starts empty runs them instead of skipping. A workstation never pulls.
if (realDocker && pullsAllowed()) {
    for (const image of [PG_IMAGE, REST_IMAGE]) {
        try {
            requireImagePresent(image);
        } catch {
            /* reported below, on every test line, by needsDocker */
        }
    }
}
const needsDocker = !realDocker
    ? 'a real Docker daemon is required (the cloud-sandbox shim cannot label, publish or remove containers)'
    : !hasImage(PG_IMAGE) || !hasImage(REST_IMAGE)
        ? `the images ${PG_IMAGE} and ${REST_IMAGE} must be present locally (the runner never pulls one on a workstation)`
        : false;

const lines = (result) => result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
const labeled = (label) => ({
    containers: lines(docker(['ps', '-a', '--filter', `label=${label}`, '--format', '{{.Names}}'])),
    networks: lines(docker(['network', 'ls', '--filter', `label=${label}`, '--format', '{{.Name}}'])),
    volumes: lines(docker(['volume', 'ls', '--filter', `label=${label}`, '--format', '{{.Name}}'])),
});
const resourcesOfRun = (runId) => labeled(`${RUN_LABEL}=${runId}`);
const resourcesOfOwner = (pid) => labeled(`${OWNER_LABEL}=${pid}`);
const everything = (found) => [...found.containers, ...found.networks, ...found.volumes];
const allFixtureResources = () => everything(labeled(FIXTURE_LABEL)).sort();

async function until(predicate, timeoutMs, what) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.fail(`timed out waiting for ${what}`);
}

const processAlive = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === 'EPERM';
    }
};

/** Tiny gateway suites in a temporary directory. CommonJS, as the gateway's own suites are when tsx loads them. */
function suiteDir(files) {
    const dir = mkdtempSync(join(tmpdir(), 'letbuyy-gateway-lifecycle-'));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    return dir;
}

const HEAD = `
const test = require('node:test');
const assert = require('node:assert/strict');
const { requireOwnedDatabase } = require(${JSON.stringify(SUPPORT)});
const owned = requireOwnedDatabase();
const key = owned.restEnv().SUPABASE_SERVICE_ROLE_KEY;
`;

const WRITES = `${HEAD}
test('writes a tenant into its own database, through the same statements a real suite uses', async () => {
  assert.match(owned.database, /^letbuyy_exec_/);
  assert.equal(owned.psql('select current_database()'), owned.database);
  assert.equal(owned.psql("select current_setting('letbuyy.fixture_run_id', true)"), owned.runId);
  owned.script("insert into sites (id, name, store_name, site_type, subdomain) values (gen_random_uuid(), 'lifecycle', 'Lifecycle', 'store', 'lifecycle-' || gen_random_uuid()::text)");
  assert.equal(owned.psql('select count(*) from sites'), '1');
  const response = await fetch(owned.restUrl + '/rest/v1/sites?select=id', { headers: { apikey: key, authorization: 'Bearer ' + key } });
  assert.equal(response.status, 200, 'the real REST layer sees the row the suite just wrote');
  assert.equal((await response.json()).length, 1);
});`;

const PRISTINE = `${HEAD}
test('starts from a pristine clone: the row the previous suite wrote is not here, and the schema is', async () => {
  assert.equal(owned.psql('select count(*) from sites'), '0', 'a suite gets a fresh database, not the last one\\'s leftovers');
  assert.equal(owned.psql("select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('orders','gst_invoices','products')"), '3', 'and the fully migrated schema');
  assert.notEqual(owned.psql("select count(*) from pg_trigger where tgname = 'reject_delete' or tgname like '%reject%'"), '0', 'with its protection triggers in place');
});`;

const FAILING = `${HEAD}
test('deliberately failing', () => assert.equal(1, 2));`;

const SKIPPING = `${HEAD}
test('skips itself', { skip: 'no database, apparently' }, () => {});`;

const EMPTY = `${HEAD}
`;

const SLEEPING = `${HEAD}
const { writeFileSync } = require('node:fs');
test('holds the owned database open', async () => {
  owned.psql('select 1');
  writeFileSync(process.env.LETBUYY_TEST_MARKER, String(process.pid));
  await new Promise((resolve) => setTimeout(resolve, 120000));
});`;

const run = (args, options = {}) => spawnSync(process.execPath, [runner, ...args], { cwd: repoRoot, encoding: 'utf8', ...options });

test('owned Next output is removed after normal shutdown and a killed registered supervisor', { skip:needsDocker, timeout:420000 }, () => {
    const body=`${HEAD}
const { startOwnedClientRuntime, stopOwnedClientRuntime } = require(${JSON.stringify(SUPPORT)});
const { createServer } = require('node:net');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
test('both owned Next lifecycle endings remove only their own directory', {timeout:360000}, async () => {
  for (const killed of [false,true]) {
    const server=createServer();
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const port=server.address().port;await new Promise(done=>server.close(done));
    const child=startOwnedClientRuntime(owned,'commerce-next',{port,env:{NODE_ENV:'test'}});
    let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
    const directory=join(process.cwd(),'apps/commerce/web','.next-session-runtime-'+child.pid+'-commerce-next');
    const marker=directory+'.owner.json';
    try {
      const deadline=Date.now()+150000;let ready=false;
      while(Date.now()<deadline) {
        assert.equal(child.exitCode,null,output.slice(-2000));
        try {const response=await fetch('http://localhost:'+port+'/api/buyer-auth/session',{signal:AbortSignal.timeout(20000)});
          const payload=await response.json();if(response.status===200 && payload.buyer===null){ready=true;break;}
        } catch {}
        await new Promise(done=>setTimeout(done,200));
      }
      assert.ok(ready,output.slice(-2000));assert.ok(existsSync(directory));assert.ok(existsSync(marker));
      const receipt=JSON.parse(readFileSync(marker,'utf8'));
      assert.equal(receipt.supervisorPid,child.pid);assert.equal(receipt.parentPid,process.pid);assert.equal(receipt.runId,owned.runId);
      console.log('OWNED_NEXT_LIFECYCLE',killed?'forced':'normal',child.pid);
      if(killed)child.kill('SIGKILL');
    } finally {await stopOwnedClientRuntime(child);}
    if(killed)assert.equal(child.signalCode,'SIGKILL');else assert.equal(child.exitCode,0,output.slice(-2000));
    assert.equal(existsSync(directory),false,'completed Next output must not accumulate');
    assert.equal(existsSync(marker),false,'the adjacent ownership receipt is removed too');
  }
});`;
    const dir=suiteDir({'next-output.test.ts':body});
    try {
        const logs=join(dir,'logs');
        const result=run(['--suite-dir',dir,'--kind','gateway-db','--jobs','1','--no-reap','--json','--log-dir',logs,'--timeout','370'],{timeout:400000});
        const output=join(logs,'next-output.log');
        assert.equal(result.status,0,`${result.stderr}\n${existsSync(output)?readFileSync(output,'utf8').slice(-8000):result.stdout.slice(-6000)}`);
        const report=JSON.parse(result.stdout);
        assert.equal(report.suites,1);assert.equal(report.failedSuites,0);
        assert.equal(report.results[0].pass,1);assert.equal(report.results[0].skipped,0);
        assert.deepEqual(everything(resourcesOfRun(report.runId)),[]);
    } finally {rmSync(dir,{recursive:true,force:true});}
});

test('a red suite, a skipping suite and an empty suite are all red; a suite starts from a pristine clone; and the run leaves nothing behind', { skip: needsDocker }, () => {
    const dir = suiteDir({
        'a-writes.test.ts': WRITES,
        'b-pristine.test.ts': PRISTINE,
        'c-fails.test.ts': FAILING,
        'd-skips.test.ts': SKIPPING,
        'e-empty.test.ts': EMPTY,
    });
    const before = allFixtureResources();
    try {
        const result = run(['--suite-dir', dir, '--kind', 'gateway-db', '--jobs', '1', '--json', '--timeout', '120']);
        const report = JSON.parse(result.stdout);
        const by = Object.fromEntries(report.results.map((entry) => [entry.name, entry]));

        assert.equal(result.status, 3, `three suites are red: ${result.stderr}`);
        assert.equal(report.suites, 5);
        assert.equal(report.failedSuites, 3);
        assert.equal(report.jobs, 1, 'one cluster, so the second suite proves the clone is pristine');
        for (const entry of report.results) assert.equal(entry.kind, 'gateway-db');

        assert.equal(by['a-writes'].code, 0, `${by['a-writes'].failures}`);
        assert.equal(by['a-writes'].pass, 1);
        assert.equal(by['b-pristine'].code, 0, `the second suite saw a database the first had not touched: ${by['b-pristine'].failures}`);

        assert.notEqual(by['c-fails'].code, 0);
        assert.equal(by['c-fails'].fail, 1, 'a failing assertion is a failing suite');

        assert.notEqual(by['d-skips'].code, 0, 'a suite that skips proved nothing, so it is red, never green');
        assert.equal(by['d-skips'].skipped, 1);
        assert.match(by['d-skips'].failures.join(' '), /may not skip/);

        assert.notEqual(by['e-empty'].code, 0, 'a suite that runs no test is red');
        assert.match(by['e-empty'].failures.join(' '), /no tests executed/);

        for (const entry of report.results) {
            assert.equal(entry.ownership, 'verified before start', `${entry.name}: ownership is proven before the suite starts`);
            assert.equal(entry.cleanup.rest, true, `${entry.name}: its REST sidecar is removed`);
            assert.equal(entry.cleanup.database, true, `${entry.name}: its database is dropped`);
            assert.ok(entry.rest.upstreamPort > 0 && entry.rest.proxyPort > 0);
        }
        assert.equal(report.cleanup.failures.length, 0);

        // Asked of docker itself, by the run's own label.
        assert.deepEqual(everything(resourcesOfRun(report.runId)), []);
        assert.deepEqual(allFixtureResources(), before, 'the set of fixture resources on this machine is what it was before the run');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('a REST image that is not present is an infrastructure error naming the image, and nothing at all is created', { skip: needsDocker }, () => {
    const dir = suiteDir({ 'a-writes.test.ts': WRITES });
    const before = allFixtureResources();
    try {
        const result = run(['--suite-dir', dir, '--kind', 'gateway-db', '--jobs', '1', '--json'], {
            env: { ...process.env, LETBUYY_EXECUTABLE_REST_IMAGE: 'letbuyy-no-such-image.invalid/postgrest:0', CI: '', LETBUYY_EXECUTABLE_PULL: '' },
        });
        assert.equal(result.status, 70);
        const report = JSON.parse(result.stdout);
        assert.match(report.infrastructureError, /letbuyy-no-such-image\.invalid\/postgrest:0 is not present locally; this runner does not pull an image on its own/);
        assert.deepEqual(report.cleanupFailures, []);
        assert.deepEqual(allFixtureResources(), before, 'not even a network or a volume was created');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('a cluster name that is already taken is an infrastructure error; what this run created is removed and what it did not create survives', { skip: needsDocker }, () => {
    const dir = suiteDir({ 'a-writes.test.ts': WRITES });
    const taken = `letbuyy-exec-lifecycle-taken-${process.pid}-${Date.now().toString(36)}`;
    const before = allFixtureResources();
    try {
        assert.equal(docker(['run', '-d', '--pull', 'never', '--name', taken, '--entrypoint', 'sleep', PG_IMAGE, '300']).status, 0);
        const result = run(['--suite-dir', dir, '--kind', 'gateway-db', '--jobs', '1', '--json', '--container', taken]);
        assert.equal(result.status, 70);
        assert.match(JSON.parse(result.stdout).infrastructureError, /docker run failed/);
        assert.equal(docker(['ps', '-a', '--filter', `name=^/${taken}$`, '--format', '{{.Names}}']).stdout.trim(), taken, 'a container this run did not create is never removed');
        assert.deepEqual(allFixtureResources(), before, 'the network and the volume this run had already created are gone again');
    } finally {
        docker(['rm', '-f', '-v', taken]);
        rmSync(dir, { recursive: true, force: true });
    }
});

async function startSleeper(marker, extraArgs = []) {
    const dir = suiteDir({ 'a-sleeps.test.ts': SLEEPING });
    const child = spawn(process.execPath, [runner, '--suite-dir', dir, '--kind', 'gateway-db', '--jobs', '1', '--timeout', '150', ...extraArgs], {
        cwd: repoRoot,
        stdio: 'ignore',
        env: { ...process.env, LETBUYY_TEST_MARKER: marker },
    });
    const closed = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
    await until(() => existsSync(marker), 240_000, 'the suite to hold its owned database');
    return { dir, child, closed, suitePid: Number(readFileSync(marker, 'utf8')) };
}

test('SIGTERM mid-suite: exit 143, the suite\'s whole process group is gone, and every resource of the run is removed', { skip: needsDocker }, async () => {
    const markerDir = mkdtempSync(join(tmpdir(), 'letbuyy-gateway-marker-'));
    const marker = join(markerDir, 'suite.pid');
    let started;
    try {
        started = await startSleeper(marker);
        const { child, closed, suitePid } = started;
        const owned = resourcesOfOwner(child.pid);
        assert.equal(owned.containers.length, 2, `the run holds a cluster and a REST sidecar: ${owned.containers}`);
        assert.equal(owned.networks.length, 1);
        assert.equal(owned.volumes.length, 1);
        assert.ok(processAlive(suitePid), 'the suite is running');

        child.kill('SIGTERM');
        const { code } = await closed;
        assert.equal(code, 143);
        assert.deepEqual(everything(resourcesOfOwner(child.pid)), [], 'containers, network and volume are all removed on SIGTERM');
        await until(() => !processAlive(suitePid), 15_000, 'the suite process to be stopped with the run');
    } finally {
        if (started) {
            started.child.kill('SIGKILL');
            rmSync(started.dir, { recursive: true, force: true });
            for (const name of everything(resourcesOfOwner(started.child.pid))) docker(['rm', '-f', '-v', name]);
        }
        rmSync(markerDir, { recursive: true, force: true });
    }
});

test('SIGKILL leaves the run\'s labeled orphans, the suite ends itself when its runner is gone, and only those orphans are reaped', { skip: needsDocker }, async () => {
    const markerDir = mkdtempSync(join(tmpdir(), 'letbuyy-gateway-marker-'));
    const marker = join(markerDir, 'suite.pid');
    const aliveNetwork = `letbuyy-exec-lifecycle-alive-net-${process.pid}-${Date.now().toString(36)}`;
    const aliveVolume = `letbuyy-exec-lifecycle-alive-vol-${process.pid}-${Date.now().toString(36)}`;
    const plainNetwork = `letbuyy-exec-lifecycle-plain-net-${process.pid}-${Date.now().toString(36)}`;
    const plainVolume = `letbuyy-exec-lifecycle-plain-vol-${process.pid}-${Date.now().toString(36)}`;
    let started;
    try {
        started = await startSleeper(marker);
        const { child, closed, suitePid } = started;
        const runnerPid = child.pid;

        child.kill('SIGKILL');
        await closed;
        const orphans = resourcesOfOwner(runnerPid);
        assert.equal(orphans.containers.length, 2, 'SIGKILL cannot be handled: the cluster and the REST sidecar are left for the next run to reap');
        assert.equal(orphans.networks.length, 1);
        assert.equal(orphans.volumes.length, 1);
        await until(() => !processAlive(suitePid), 20_000, 'the orphaned suite to end itself: it must not keep writing to infrastructure nobody will remove');

        // Neighbours the reaper must leave alone: labeled but owned by a live process (this one), and unlabeled.
        assert.equal(docker(['network', 'create', '--label', `${FIXTURE_LABEL}=1`, '--label', `${OWNER_LABEL}=${process.pid}`, aliveNetwork]).status, 0);
        assert.equal(docker(['volume', 'create', '--label', `${FIXTURE_LABEL}=1`, '--label', `${OWNER_LABEL}=${process.pid}`, aliveVolume]).status, 0);
        assert.equal(docker(['network', 'create', plainNetwork]).status, 0);
        assert.equal(docker(['volume', 'create', plainVolume]).status, 0);

        const reap = run(['--reap-only', '--reap-min-age', '0']);
        assert.equal(reap.status, 0, reap.stderr);
        const reaped = JSON.parse(reap.stdout.trim().split('\n').pop());
        for (const name of orphans.containers) assert.ok(reaped.reaped.includes(name), `${name} is reaped`);
        for (const name of orphans.networks) assert.ok(reaped.reapedNetworks.includes(name), `${name} is reaped`);
        for (const name of orphans.volumes) assert.ok(reaped.reapedVolumes.includes(name), `${name} is reaped`);
        assert.deepEqual(everything(resourcesOfOwner(runnerPid)), [], 'nothing of the killed run remains');

        for (const [kind, name] of [['network', aliveNetwork], ['volume', aliveVolume], ['network', plainNetwork], ['volume', plainVolume]]) {
            assert.equal(docker([kind, 'inspect', name]).status, 0, `${kind} ${name} is not the reaper's to remove`);
        }
        assert.equal(reaped.reapedNetworks.includes(aliveNetwork) || reaped.reapedVolumes.includes(aliveVolume), false);
        assert.equal(reaped.reapedNetworks.includes(plainNetwork) || reaped.reapedVolumes.includes(plainVolume), false);
    } finally {
        if (started) {
            started.child.kill('SIGKILL');
            rmSync(started.dir, { recursive: true, force: true });
            for (const name of everything(resourcesOfOwner(started.child.pid))) docker(['rm', '-f', '-v', name]);
        }
        for (const name of [aliveNetwork, plainNetwork]) docker(['network', 'rm', name]);
        for (const name of [aliveVolume, plainVolume]) docker(['volume', 'rm', name]);
        rmSync(markerDir, { recursive: true, force: true });
    }
});

test('two runs at once are isolated from each other, and an immediate repeat is as clean as the first', { skip: needsDocker }, async () => {
    const suite = 'services/api-gateway/src/__tests__/owned-db/verification-token-redemption.postgres.test.ts';
    const out = mkdtempSync(join(tmpdir(), 'letbuyy-gateway-concurrent-'));
    let neighbour;
    const launch = (label) => new Promise((resolveRun) => {
        const child = spawn(process.execPath, [runner, '--suite', suite, '--jobs', '1', '--json-out', join(out, `${label}.json`), '--timeout', '240'], { cwd: repoRoot, stdio: 'ignore' });
        child.on('close', (code) => resolveRun({ code, report: JSON.parse(readFileSync(join(out, `${label}.json`), 'utf8')) }));
    });
    try {
        // A machine-wide before/after inventory races legitimate neighbours
        // finishing and cleaning themselves up. Hold a real, known live run
        // instead: it must survive both concurrent runners, then may end before
        // the repeat. Each tested run must still leave zero resources of its own.
        neighbour = await startSleeper(join(out, 'neighbour.pid'), ['--no-reap']);
        const neighbourResources = resourcesOfOwner(neighbour.child.pid);
        assert.equal(neighbourResources.containers.length, 2);
        assert.equal(neighbourResources.networks.length, 1);
        assert.equal(neighbourResources.volumes.length, 1);
        const [first, second] = await Promise.all([launch('first'), launch('second')]);
        for (const finished of [first, second]) {
            assert.equal(finished.code, 0, JSON.stringify(finished.report.results.map((entry) => entry.failures)));
            assert.equal(finished.report.failedSuites, 0);
            assert.equal(finished.report.tests, 2);
            assert.equal(finished.report.skipped, 0);
            assert.equal(finished.report.cleanup.failures.length, 0);
            assert.deepEqual(everything(resourcesOfRun(finished.report.runId)), []);
        }
        assert.notEqual(first.report.runId, second.report.runId, 'each run has its own identity');
        assert.notDeepEqual(first.report.containers, second.report.containers, 'and its own cluster');
        assert.notEqual(first.report.results[0].rest.upstreamPort, second.report.results[0].rest.upstreamPort, 'and its own REST endpoint');
        // Either run may reap a dead run's leftovers from before (that is what the reaper is for); neither may reap the other.
        for (const [mine, theirs] of [[first, second], [second, first]]) {
            assert.deepEqual(mine.report.reaped.filter((name) => theirs.report.containers.includes(name) || name.includes(theirs.report.runId)), [], 'a run never reaps another live run\'s resources');
        }
        assert.ok(processAlive(neighbour.suitePid), 'the unrelated suite remains alive');
        assert.deepEqual(resourcesOfOwner(neighbour.child.pid), neighbourResources, 'neither concurrent runner removes a live neighbour');
        neighbour.child.kill('SIGTERM');
        assert.equal((await neighbour.closed).code, 143);
        assert.deepEqual(everything(resourcesOfOwner(neighbour.child.pid)), [], 'the neighbour may finish and clean up before the repeat');

        const repeat = await launch('repeat');
        assert.equal(repeat.code, 0);
        assert.equal(repeat.report.tests, 2);
        assert.equal(repeat.report.skipped, 0);
        assert.equal(repeat.report.cleanup.failures.length, 0);
        assert.deepEqual(everything(resourcesOfRun(repeat.report.runId)), []);
    } finally {
        if (neighbour) {
            neighbour.child.kill('SIGTERM');
            await neighbour.closed;
            rmSync(neighbour.dir, { recursive: true, force: true });
        }
        rmSync(out, { recursive: true, force: true });
    }
});
