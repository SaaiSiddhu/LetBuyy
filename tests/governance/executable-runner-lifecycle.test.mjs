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
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSuites, LIVE_EXTERNAL_SUITES } from '../../scripts/governance/test-suite-catalog.mjs';
import { DEFAULT_IMAGE, POSTGRES_LIMITS, RUN_ID_LABEL, ROLE_LABEL, RUN_ID_PATTERN, newRunId } from '../../scripts/governance/executable-pg-fixture.mjs';
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
// A cluster name given to --container must be one the runner allocates (letbuyy-exec-...); it refuses any other before a docker command runs.
const uniqueName = (label) => `letbuyy-exec-lifecycle-${label}-${process.pid}-${Date.now().toString(36)}`;

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

// Case receipts retain exact allocation evidence even when the outer process cannot run finally.
function lifecycleCase(dir) {
    const runners=[], containers=[], allocationLabel='com.letbuyy.lifecycle-test-allocation';
    const caseId=newRunId(), journalRoot=process.env.LETBUYY_LIFECYCLE_RECEIPTS_DIR??dir;
    mkdirSync(journalRoot,{recursive:true,mode:0o700});
    const journal=join(journalRoot,basename(dir)+'.ownership.json');
    let receiptCounter=0,status='active',failures=[],cleanupPromise;
    const persist=(initial=false)=>{
        const data=JSON.stringify({schema_version:1,caseId,casePid:process.pid,status,dir,
            runners:runners.map(r=>({pid:r.pid??null,receipt:r.receipt,runId:r.runId??null,containerBase:r.containerBase??null,closed:r.closed})),
            containers:containers.map(f=>({...f})),failures},null,2)+'\n';
        if(initial)writeFileSync(journal,data,{flag:'wx',mode:0o600});
        else {const next=journal+'.next';writeFileSync(next,data,{flag:'wx',mode:0o600});renameSync(next,journal);}
    };
    persist(true); // before any create/spawn can lose its acknowledgement
    const args=(extra)=>{
        const receipt=join(journalRoot,`${basename(dir)}.run-${++receiptCounter}.json`),record={receipt,pid:null,closed:false};
        runners.push(record);persist();
        return {record,args:[runner,'--no-reap','--run-receipt',receipt,...extra]};
    };
    const track=(child,record)=>{
        Object.assign(record,{child,pid:child.pid,closed:child.status!==undefined});persist();
        if(!record.closed)record.exit=new Promise(resolve=>child.once('close',()=>{record.closed=true;persist();resolve();}));
        return child;
    };
    const sync=extra=>{const next=args(extra);return track(spawnSync('node',next.args,{cwd:repoRoot,encoding:'utf8',timeout:120000,killSignal:'SIGTERM'}),next.record);};
    const asyncRun=extra=>{const next=args(extra);return track(spawn('node',next.args,{cwd:repoRoot,stdio:'ignore'}),next.record);};
    const missing=result=>result.status!==0&&/no such (?:object|container|volume)/i.test(result.stderr??'');
    const volumeIdentity=name=>{
        assert.match(name,/^[0-9a-f]{64}$/,'only captured image-created anonymous volume identities belong to direct fixtures');
        const result=docker(['volume','inspect',name]);
        if(missing(result))return null;
        assert.equal(result.status,0,'own anonymous volume inspection must succeed');
        const values=JSON.parse(result.stdout);assert.equal(values.length,1);
        const item=values[0];assert.equal(item.Name,name);assert.equal(item.Driver,'local');assert.equal(item.Scope,'local');
        assert.ok(Number.isFinite(Date.parse(item.CreatedAt)));
        const labels=item.Labels??{},keys=Object.keys(labels);
        assert.ok(typeof labels==='object'&&!Array.isArray(labels)&&(keys.length===0||keys.length===1&&keys[0]==='com.docker.volume.anonymous'&&labels[keys[0]]===''),'unknown anonymous volume labels');
        assert.deepEqual(item.Options??{},{});
        return {Name:item.Name,CreatedAt:item.CreatedAt,Driver:item.Driver,Scope:item.Scope,Labels:item.Labels??{},Options:item.Options??{}};
    };
    const identify=fixture=>{
        const inspected=docker(['container','inspect',fixture.id??fixture.name]);
        if(missing(inspected))return null;
        assert.equal(inspected.status,0,'own fixture identity inspection must succeed');
        const info=JSON.parse(inspected.stdout)[0];assert.ok(info);
        assert.match(info.Id,/^[0-9a-f]{64}$/);
        if(fixture.id)assert.equal(info.Id,fixture.id);
        assert.equal(String(info.Name).replace(/^\//,''),fixture.name);
        assert.equal(info.Config?.Labels?.[allocationLabel],fixture.allocation,'a matching name alone is not ownership');
        assert.equal(info.Config?.Image,DEFAULT_IMAGE);
        fixture.id=info.Id;
        const volumes=(info.Mounts??[]).filter(m=>m.Type==='volume').map(m=>{
            const identity=volumeIdentity(m.Name);assert.ok(identity,'captured anonymous volume must exist');return identity;
        });
        if(fixture.mountsVerified)assert.deepEqual(volumes,fixture.volumes,'captured anonymous volume metadata changed');
        else {fixture.volumes=volumes;fixture.mountsVerified=true;persist();}
        return info;
    };
    const sleeper=(name,labels)=>{
        const fixture={name,allocation:`${caseId}-${containers.length+1}`,id:null,volumes:[],mountsVerified:false,creationAcknowledged:false};
        containers.push(fixture);persist();
        const result=docker(['run','-d','--pull','never','--name',name,...labels,'--label',`${allocationLabel}=${fixture.allocation}`,
            '--memory',POSTGRES_LIMITS.memory,'--memory-swap',POSTGRES_LIMITS.memory,'--cpus',POSTGRES_LIMITS.cpus,'--pids-limit',POSTGRES_LIMITS.pids,
            '--network','none','--entrypoint','sleep',DEFAULT_IMAGE,'300']);
        if(result.status===0) {
            fixture.id=result.stdout.trim();assert.match(fixture.id,/^[0-9a-f]{64}$/);fixture.creationAcknowledged=true;persist();
            assert.ok(identify(fixture),'acknowledged fixture must exist');
        }
        return result;
    };
    const receiptFor=pid=>{
        const record=runners.find(r=>r.pid===pid);assert.ok(record,'only this case owns the runner');
        const receipt=JSON.parse(readFileSync(record.receipt,'utf8'));
        assert.equal(receipt.runnerPid,pid);assert.match(receipt.runId,RUN_ID_PATTERN);
        if(record.runId)assert.equal(receipt.runId,record.runId,'runner identity cannot change after observation');
        record.runId=receipt.runId;record.containerBase=receipt.containerBase;persist();return receipt;
    };
    const reap=runIds=>spawnSync('node',[runner,'--reap-only','--reap-min-age','0',...runIds.flatMap(id=>['--reap-run-id',id])],{cwd:repoRoot,encoding:'utf8',timeout:30000});
    const cleanup=()=>cleanupPromise??=(async()=>{
        status='cleanup_started';persist();
        for(const record of runners) {
            try {
                if(!record.child)throw Error('spawn acknowledgement missing; retained receipt plan requires owner recovery');
                if(!record.closed) {
                    record.child.kill('SIGTERM');
                    try{await until(()=>record.closed,10000,'this case runner to close');}catch{
                        receiptFor(record.pid);record.child.kill('SIGKILL');await until(()=>record.closed,5000,'this case runner after SIGKILL');
                    }
                }
                const receipt=receiptFor(record.pid),result=reap([receipt.runId]);
                assert.equal(result.status,0,'selected own-run cleanup failed');
                for(const [kind,args] of [['container',['ps','-a']],['network',['network','ls']],['volume',['volume','ls']]]) {
                    const left=docker([...args,'--filter',`label=${RUN_ID_LABEL}=${receipt.runId}`,'--format',kind==='container'?'{{.Names}}':'{{.Name}}']);
                    assert.equal(left.status,0,`exact own-run ${kind} readback must succeed`);assert.equal(left.stdout.trim(),'');
                }
            }catch(error){failures.push(error.message);}
        }
        for(const fixture of containers) {
            try {
                const info=identify(fixture);
                if(info)assert.equal(docker(['rm','-f',fixture.id]).status,0,'own container removal must succeed');
                else if(!fixture.creationAcknowledged)throw Error('unacknowledged create remains for exact allocation recovery');
                const inspected=docker(['container','inspect',fixture.id]);
                assert.ok(missing(inspected),`owned container ${fixture.id} absence not proved`);
                assert.ok(fixture.mountsVerified,'anonymous volume identities were not captured');
                for(const volume of fixture.volumes) {
                    const current=volumeIdentity(volume.Name);
                    if(current) {
                        assert.deepEqual(current,volume,'anonymous volume replacement is not owned');
                        assert.equal(docker(['volume','rm',volume.Name]).status,0,'exact captured anonymous volume removal must succeed');
                    }
                    assert.ok(missing(docker(['volume','inspect',volume.Name])),`owned anonymous volume ${volume.Name} absence not proved`);
                }
            }catch(error){failures.push(error.message);}
        }
        status=failures.length?'cleanup_failed':'cleaned';persist();
        assert.deepEqual(failures,[],'only exact case-owned handles may be cleaned; every failure stays red');
    })();
    return {sync,asyncRun,sleeper,receiptFor,reap,cleanup,journal};
}

test('the catalog puts every suite in exactly one class, and the live list is the reviewed one', () => {
    const { all, pure, postgres, live } = discoverSuites(repoRoot);
    assert.equal(pure.length + postgres.length + live.length, all.length, 'no suite is in two classes or in none');
    assert.equal(new Set([...pure, ...postgres, ...live]).size, all.length);
    assert.deepEqual(live, LIVE_EXTERNAL_SUITES);
    assert.deepEqual(LIVE_EXTERNAL_SUITES, [], 'no suite is left that reads a database it did not build; adding one is a reviewed decision');
    assert.ok(
        postgres.includes('tests/security/theme-tenant-isolation.test.mjs'),
        'the theme isolation proof builds its own database in an owned cluster, so it can neither skip itself nor touch anyone else\'s',
    );
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
        writeFileSync(join(root, 'tests/security/reads-a-live-database.test.mjs'), '// live\n');
        writeFileSync(join(root, 'tests/newdir/db.test.mjs'), `const c = ${CONTAINER_ENV} || 'x';\n`);
        writeFileSync(join(root, 'tests/newdir/plain.test.mjs'), `import test from 'node:test';\n`);
        // The real list is empty, so the live class is exercised through the reviewed-list parameter.
        const { pure, postgres, live } = discoverSuites(root, ['tests/security/reads-a-live-database.test.mjs']);
        assert.deepEqual(postgres, ['tests/newdir/db.test.mjs']);
        assert.deepEqual(pure, ['tests/newdir/plain.test.mjs']);
        assert.deepEqual(live, ['tests/security/reads-a-live-database.test.mjs']);
        assert.deepEqual(discoverSuites(root).live, [], 'with the real (empty) list nothing is live');
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('a live-external entry must exist on disk and must not also target the owned container', () => {
    const root = mkdtempSync(join(tmpdir(), 'letbuyy-catalog-'));
    try {
        mkdirSync(join(root, 'tests/security'), { recursive: true });
        writeFileSync(join(root, 'tests/security/both.test.mjs'), `const c = ${CONTAINER_ENV} || 'x';\n`);
        assert.throws(() => discoverSuites(root, ['tests/security/both.test.mjs']), /also targets the owned Postgres container/);
        assert.throws(() => discoverSuites(root, ['tests/security/gone.test.mjs']), /catalog is stale/);
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
    const owned = lifecycleCase(dir);
    try {
        const run = owned.sync(['--suite-dir', dir, '--jobs', '2', '--json', '--container', base]);
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
        await owned.cleanup();
        rmSync(dir, { recursive: true, force: true });
    }
});

test('a name that is already taken is an infrastructure error and the other container survives it', { skip: needsDocker }, async () => {
    const dir = suiteDir({ 'a-pass.test.mjs': PASSING_SUITE });
    const taken = uniqueName('taken');
    const owned = lifecycleCase(dir);
    try {
        assert.equal(owned.sleeper(taken, []).status, 0);
        const run = owned.sync(['--suite-dir', dir, '--jobs', '1', '--json', '--container', taken]);
        assert.equal(run.status, 70, 'infrastructure that cannot start is exit 70, never a count of failing suites');
        assert.match(JSON.parse(run.stdout).infrastructureError, /docker run failed/);
        assert.equal(containerExists(taken), true, 'cleanup removes only what this run created');
    } finally {
        await owned.cleanup();

        rmSync(dir, { recursive: true, force: true });
    }
});

test('SIGTERM removes the run\'s clusters and exits 143', { skip: needsDocker }, async () => {
    const dir = suiteDir({ 'a-sleep.test.mjs': SLEEPING_SUITE });
    const base = uniqueName('term');
    const owned = lifecycleCase(dir);
    try {
        const child = owned.asyncRun(['--suite-dir', dir, '--jobs', '1', '--container', base, '--timeout', '60']);
        const closed = new Promise((resolve) => child.on('close', (code) => resolve(code)));
        await until(() => containerExists(base), 60_000, 'the run\'s cluster to exist');
        child.kill('SIGTERM');
        assert.equal(await closed, 143);
        assert.equal(containerExists(base), false);
    } finally {
        await owned.cleanup();

        rmSync(dir, { recursive: true, force: true });
    }
});

test('a run killed with SIGKILL leaves one labeled orphan, and only that kind of orphan is reaped', { skip: needsDocker }, async () => {
    const dir = suiteDir({ 'a-sleep.test.mjs': SLEEPING_SUITE });
    const orphanBase = uniqueName('orphan');
    const live = uniqueName('live');
    const unlabeled = uniqueName('unlabeled');
    const owned = lifecycleCase(dir);
    const liveRunId = newRunId();
    const sleeper = owned.sleeper;
    try {
        const child = owned.asyncRun(['--suite-dir', dir, '--jobs', '1', '--container', orphanBase, '--timeout', '60']);
        const closed = new Promise((resolve) => child.on('close', () => resolve()));
        await until(() => containerExists(orphanBase), 60_000, 'the run\'s cluster to exist');
        child.kill('SIGKILL');
        await closed;
        assert.equal(containerExists(orphanBase), true, 'SIGKILL cannot be handled, so the cluster is left for the next run to reap');
        const labels = docker(['inspect', '-f', `{{index .Config.Labels "${FIXTURE_LABEL}"}} {{index .Config.Labels "${OWNER_LABEL}"}}`, orphanBase]).stdout.trim();
        assert.equal(labels, `1 ${child.pid}`, 'the orphan carries the label and its dead owner\'s pid');

        assert.equal(sleeper(live, ['--label', `${FIXTURE_LABEL}=1`, '--label', `${OWNER_LABEL}=${process.pid}`, '--label', `${RUN_ID_LABEL}=${liveRunId}`, '--label', `${ROLE_LABEL}=postgres`]).status, 0);
        assert.equal(sleeper(unlabeled, []).status, 0);

        const orphanRunId = owned.receiptFor(child.pid).runId;
        const reap = owned.reap([orphanRunId, liveRunId]);
        assert.equal(reap.status, 0, 'intentional scoped reap result: '+String(reap.stdout??'').replace(/[^\x20-\x7e]/g,' ').slice(0,1200));
        const { reaped } = JSON.parse(reap.stdout.trim().split('\n').pop());
        assert.ok(reaped.includes(orphanBase), 'the dead owner\'s labeled cluster is reaped');
        assert.equal(reaped.includes(live), false, 'a cluster whose owner is alive is never reaped');
        assert.equal(reaped.includes(unlabeled), false, 'an unlabeled container is never reaped');
        assert.equal(containerExists(orphanBase), false);
        assert.equal(containerExists(live), true);
        assert.equal(containerExists(unlabeled), true);
    } finally {
        await owned.cleanup();

        rmSync(dir, { recursive: true, force: true });
    }
});


test('an explicit run allowset reaps its own dead fixture and preserves a different dead run', { skip: needsDocker }, async () => {
    const dir = suiteDir({});
    const owned = lifecycleCase(dir), selected = newRunId(), foreign = newRunId();
    const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    const selectedName = uniqueName('selected-dead'), foreignName = uniqueName('foreign-dead');
    const labels = id => ['--label', `${FIXTURE_LABEL}=1`, '--label', `${OWNER_LABEL}=${dead.pid}`, '--label', `${RUN_ID_LABEL}=${id}`, '--label', `${ROLE_LABEL}=postgres`];
    try {
        assert.equal(dead.status, 0);
        assert.equal(owned.sleeper(selectedName, labels(selected)).status, 0);
        assert.equal(owned.sleeper(foreignName, labels(foreign)).status, 0);
        const reap = owned.reap([selected]);
        assert.equal(reap.status, 0, reap.stderr);
        const result = JSON.parse(reap.stdout);
        assert.ok(result.reaped.includes(selectedName));
        assert.ok(!result.reaped.includes(foreignName));
        assert.equal(containerExists(selectedName), false);
        assert.equal(containerExists(foreignName), true);
    } finally {
        await owned.cleanup();
        rmSync(dir, { recursive: true, force: true });
    }
});

// ---- no real Docker daemon: the cloud-sandbox shim (scripts/dev/docker-shim) ---------------------------------------------
//
// The shim models `run`, `exec` and `inspect` of one Postgres container and nothing else: no `info`, no image, network or
// volume subcommand. The runner must keep working there for Postgres suites (the flow the shim was written for), must never
// ask it for something it cannot do, and must report a gateway database suite red with the reason rather than skip or fake
// it. A recording docker that answers exactly like the shim stands in for it, so this needs no daemon and runs everywhere.

function withShimDocker(body) {
    const dir = mkdtempSync(join(tmpdir(), 'letbuyy-shim-docker-'));
    const log = join(dir, 'calls.log');
    writeFileSync(join(dir, 'docker'), [
        '#!/bin/sh',
        `echo "$@" >> "${log}"`,
        'case "$1" in',
        '  info) exit 1 ;;',
        '  run) echo fake-container-id; exit 0 ;;',
        '  inspect) exit 0 ;;',
        '  exec)',
        '    shift; [ "$1" = "-i" ] && shift; shift',
        '    case "$1" in pg_isready) exit 0 ;; psql) echo 1; exit 0 ;; *) exit 1 ;; esac ;;',
        '  *) echo "docker-shim: unsupported command $1" >&2; exit 1 ;;',
        'esac',
        '',
    ].join('\n'), { mode: 0o755 });
    const calls = () => {
        try {
            return readFileSync(log, 'utf8').split('\n').filter(Boolean);
        } catch {
            return [];
        }
    };
    try {
        return body({ dir, calls, env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

const TRIVIAL_SUITE = `import test from 'node:test';\ntest('ok', () => {});\n`;

test('with no Docker daemon a Postgres suite still runs through the shim-compatible flow, and the runner asks the shim for nothing it cannot do', () => {
    const suites = suiteDir({ 'a-ok.test.mjs': TRIVIAL_SUITE });
    try {
        withShimDocker(({ calls, env }) => {
            const run = spawnSync('node', [runner, '--suite-dir', suites, '--json', '--jobs', '2', '--no-reap'], { cwd: repoRoot, encoding: 'utf8', env });
            const report = JSON.parse(run.stdout);
            assert.equal(run.status, 0, `${run.stderr}${run.stdout}`);
            assert.equal(report.suites, 1);
            assert.equal(report.failedSuites, 0);
            assert.equal(report.results[0].code, 0);
            const log = calls();
            assert.ok(log.some((line) => line.startsWith('run -d --pull never --name letbuyy-exec-')), 'the cluster was started with the invocation the shim models (the shim ignores the pull flag, and no docker run may pull)');
            for (const forbidden of [/\bnetwork\b/, /\bvolume\b/, /\bimage\b/, /^pull /, /--mount/, /--network/, /--memory/, /--pids-limit/, /--read-only/]) {
                assert.equal(log.filter((line) => forbidden.test(line) && !/^rm /.test(line)).length, 0, `the shim has no ${forbidden}, so it is never asked: ${log.filter((line) => forbidden.test(line)).join(' | ')}`);
            }
        });
    } finally {
        rmSync(suites, { recursive: true, force: true });
    }
});

test('with no Docker daemon a gateway database suite is red with the reason, never skipped, and no cluster is started for it', () => {
    const gateway = suiteDir({ 'a-gateway.test.ts': `import test from 'node:test';\ntest('never runs', () => {});\n` });
    const postgres = suiteDir({ 'b-ok.test.mjs': TRIVIAL_SUITE });
    try {
        withShimDocker(({ calls, env }) => {
            const alone = spawnSync('node', [runner, '--suite-dir', gateway, '--kind', 'gateway-db', '--json', '--no-reap'], { cwd: repoRoot, encoding: 'utf8', env });
            const aloneReport = JSON.parse(alone.stdout);
            assert.equal(alone.status, 1, 'one failing suite');
            assert.equal(aloneReport.results[0].kind, 'gateway-db');
            assert.notEqual(aloneReport.results[0].code, 0);
            assert.equal(aloneReport.results[0].skipped, 0, 'refused, not skipped');
            assert.match(aloneReport.results[0].failures.join(' '), /no real Docker daemon answers `docker info`; the gateway database lane needs one/);
            assert.equal(aloneReport.results[0].ownership, 'not started');
            assert.equal(calls().some((line) => line.startsWith('run ')), false, 'no cluster was started for a run that has nothing to run');

            // Mixed selection: the Postgres suite keeps its flow, the gateway suite is refused beside it.
            const mixed = spawnSync('node', [runner, '--suite', join(postgres, 'b-ok.test.mjs'), '--suite', 'services/api-gateway/src/__tests__/owned-db/gst-tax-computation.test.ts', '--json', '--no-reap'], { cwd: repoRoot, encoding: 'utf8', env });
            const mixedReport = JSON.parse(mixed.stdout);
            assert.equal(mixed.status, 1);
            const byKind = Object.fromEntries(mixedReport.results.map((entry) => [entry.kind, entry]));
            assert.equal(byKind.postgres.code, 0);
            assert.notEqual(byKind['gateway-db'].code, 0);
        });
    } finally {
        rmSync(gateway, { recursive: true, force: true });
        rmSync(postgres, { recursive: true, force: true });
    }
});
