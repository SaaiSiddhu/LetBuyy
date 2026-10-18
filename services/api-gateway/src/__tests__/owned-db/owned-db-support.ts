// The one door through which a gateway database suite reaches its database.
//
// Until the owned lane existed, the suites in this directory found "the local Supabase Postgres" for themselves: a
// hardcoded (later discovered) `supabase_db_*` container, and `.dev.vars` for a REST url and a service key. Both point at
// the developer's own restored stack, so a gateway test run wrote products, orders, GST invoices and gift-card ledgers
// into it. This module removes every one of those paths.
//
// A suite reaches its database only through requireOwnedDatabase(), which:
//   1. asks scripts/governance/owned-fixture-guard.mjs to prove, from what the runner wrote and not from any name, that
//      the announced cluster, database and REST endpoint were created by THIS run of scripts/governance/
//      run-executable-suites.mjs (labels, run id, image, mounts, network, database marker, REST marker). Anything else
//      throws before a single statement has been sent;
//   2. returns handles bound to the VERIFIED description, never to raw environment values;
//   3. arms a watchdog that ends the suite if the runner that owns the database disappears (a SIGKILLed runner cannot
//      clean up, and a suite must not keep writing to infrastructure nobody is going to remove).
//
// There is deliberately no fallback: no environment means no database, and a suite that cannot get one FAILS. The lane's
// runner also fails a suite that skips.
//
// Nothing here logs a credential. The service-role key is a per-suite JWT for a REST sidecar that exists only for this
// suite; it is returned to the caller for the caller's own client and never printed.

import { execFileSync, spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import {createServer,type Socket} from 'node:net';

const GUARD = fileURLToPath(new URL('../../../../../scripts/governance/owned-fixture-guard.mjs', import.meta.url));

interface VerifiedFixture {
    runId: string;
    runnerPid: number;
    pgContainer: string;
    database: string;
    restContainer: string;
    restUrl: string;
}

export interface OwnedDatabase {
    readonly runId: string;
    readonly container: string;
    readonly database: string;
    readonly restUrl: string;
    /** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for a gateway Env or a Supabase client: the owned REST endpoint. */
    restEnv(): { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string };
    /** One statement (or several, in one implicit transaction) as the superuser, `-At -F '|'`. Throws on an SQL error. */
    psql(sql: string): string;
    /** The same, as a separate process, for genuinely concurrent statements. */
    psqlAsync(sql: string): Promise<string>;
    /** The error text of a statement that must fail, or '' if it unexpectedly succeeded. */
    psqlExpectError(sql: string): string;
    /** A script through stdin with ON_ERROR_STOP: its output, or null when it failed. */
    exec(sql: string): string | null;
    /** The same script, but a failure throws with the database's own error (fixtures must never fail quietly). */
    script(sql: string): string;
    /** Same verified owned stdin script; bounded64MiB raw catalog/data conservation, never a new process/host seam. */
    scriptLarge(sql: string): string;
}

let cached: OwnedDatabase | undefined;
let watchdogArmed = false;
let clientFixtureEnv: Record<string, string> | undefined;

function armWatchdog(runnerPid: number): void {
    if (watchdogArmed) return;
    watchdogArmed = true;
    const timer = setInterval(() => {
        try {
            process.kill(runnerPid, 0);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
                process.stderr.write(`owned database: the runner (pid ${runnerPid}) is gone; ending this suite so nothing keeps writing to infrastructure that will not be cleaned up\n`);
                process.exit(97);
            }
        }
    }, 3000);
    timer.unref();
}

export function requireOwnedDatabase(): OwnedDatabase {
    if (cached) return cached;

    let verified: VerifiedFixture;
    try {
        verified = JSON.parse(execFileSync(process.execPath, [GUARD, '--verify'], {
            env: process.env,
            encoding: 'utf8',
            timeout: 30_000,
            stdio: ['ignore', 'pipe', 'pipe'],
        })) as VerifiedFixture;
    } catch (error) {
        const stderr = String((error as { stderr?: Buffer | string }).stderr ?? '').trim();
        throw new Error(stderr || 'the owned database could not be verified; run this suite through scripts/governance/run-executable-suites.mjs (pnpm --filter @letbuyy/api-gateway run test:db)');
    }
    const serviceRoleKey = process.env.LETBUYY_OWNED_REST_SERVICE_KEY ?? '';
    if (!serviceRoleKey) throw new Error('owned database: no REST service key was announced');
    armWatchdog(verified.runnerPid);
    clientFixtureEnv = Object.fromEntries([
        'LETBUYY_EXECUTABLE_RUN_ID', 'LETBUYY_EXECUTABLE_RUNNER_PID', 'LETBUYY_EXECUTABLE_PG_CONTAINER',
        'LETBUYY_EXECUTABLE_PG_DATABASE', 'LETBUYY_OWNED_REST_URL', 'LETBUYY_OWNED_REST_CONTAINER',
        'LETBUYY_OWNED_REST_UPSTREAM_PORT', 'LETBUYY_OWNED_REST_SERVICE_KEY',
    ].map(name => [name, process.env[name] ?? '']));

    const psqlBase = ['exec', verified.pgContainer, 'psql', '-U', 'postgres', '-d', verified.database];
    const scriptArgs = ['exec', '-i', verified.pgContainer, 'psql', '-U', 'postgres', '-d', verified.database, '-v', 'ON_ERROR_STOP=1', '-qAt'];

    cached = Object.freeze({
        runId: verified.runId,
        container: verified.pgContainer,
        database: verified.database,
        restUrl: verified.restUrl,
        restEnv: () => ({ SUPABASE_URL: verified.restUrl, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey }),
        psql: (sql: string) => execFileSync('docker', [...psqlBase, '-At', '-F', '|', '-c', sql], { encoding: 'utf8', timeout: 15_000 }).trim(),
        psqlAsync: (sql: string) => new Promise<string>((resolvePromise, rejectPromise) => {
            const proc = spawn('docker', [...psqlBase, '-At', '-c', sql]);
            let out = '';
            let err = '';
            proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
            proc.stderr.on('data', (d: Buffer) => { err += d.toString(); });
            proc.on('close', (code) => {
                if (code !== 0) rejectPromise(new Error(err || `psql exited ${code}`));
                else resolvePromise(out.trim());
            });
        }),
        psqlExpectError: (sql: string) => {
            try {
                execFileSync('docker', [...psqlBase, '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] });
                return '';
            } catch (error) {
                return String((error as { stderr?: Buffer | string }).stderr ?? '').trim();
            }
        },
        exec: (sql: string) => {
            try {
                return execFileSync('docker', scriptArgs, { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
            } catch {
                return null;
            }
        },
        script: (sql: string) => {
            try {
                return execFileSync('docker', scriptArgs, { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 }).trim();
            } catch (error) {
                const stderr = String((error as { stderr?: Buffer | string }).stderr ?? '').trim();
                throw new Error(`owned database script failed: ${stderr.split('\n').find((line) => /ERROR|FATAL/.test(line)) ?? (stderr.slice(0, 300) || 'unknown error')}`);
            }
        },
        scriptLarge: (sql: string) => {
            try {
                return execFileSync('docker', scriptArgs, { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 45_000, maxBuffer: 64 * 1024 * 1024 }).trim();
            } catch (error) {
                const stderr = String((error as { stderr?: Buffer | string }).stderr ?? '').trim();
                throw new Error(`owned database large script failed: ${stderr.split('\n').find((line) => /ERROR|FATAL/.test(line)) ?? (stderr.slice(0, 300) || 'unknown error')}`);
            }
        },
    });
    return cached;
}

export type OwnedClientProcess = ChildProcessByStdio<Writable, Readable, Readable>;
type ClientKind = 'commerce-next' | 'identity-next' | 'merchant-next' | 'console-next' | 'commerce-next-production' | 'identity-next-production' | 'merchant-next-production' | 'commerce-session-smoke' | 'marketplace-flutter' | 'buyer-orders-dart' | 'lifecycle-probe';
const CLIENT_KINDS = new Set<ClientKind>(['commerce-next','identity-next','merchant-next','console-next','commerce-next-production','identity-next-production','merchant-next-production','commerce-session-smoke','marketplace-flutter','buyer-orders-dart','lifecycle-probe']);
const LAUNCHER = fileURLToPath(new URL('../../../../../scripts/governance/owned-client-launcher.mjs', import.meta.url));
const clients = new Map<OwnedClientProcess, { closed:Promise<void>; clientPid?:number }>();

/** Launch only a named test client after database ownership is proven; no raw command/cwd seam. */
export function startOwnedClientRuntime(owned:OwnedDatabase, kind:ClientKind, options:{ port?:number; env:Record<string,string|undefined> }):OwnedClientProcess {
    if (!CLIENT_KINDS.has(kind)) throw new Error('unapproved owned client runtime kind');
    if (owned !== requireOwnedDatabase() || !clientFixtureEnv) throw new Error('owned client runtime requires the verified database handle');
    if ((kind.endsWith('-next') || kind.endsWith('-next-production')) && (!Number.isInteger(options.port) || options.port! < 1024 || options.port! > 65535)) throw new Error('invalid local Next port');
    if (Object.keys(options.env).some(name => /^(NODE_OPTIONS|NODE_PATH|BASH_ENV|ENV|PATH|HOME|PNPM_HOME|FLUTTER_ROOT|PUB_CACHE|PLAYWRIGHT_BROWSERS_PATH|LD_PRELOAD|DYLD_.*)$/.test(name))) {
        throw new Error('owned client runtime refuses executable or loader overrides');
    }
    // Only OS/tool paths cross implicitly. Provider/database credentials and
    // ambient app settings must not leak from the shell into a synthetic journey.
    const base:Record<string,string> = {};
    for (const name of ['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL','PNPM_HOME','FLUTTER_ROOT','PUB_CACHE','PLAYWRIGHT_BROWSERS_PATH']) {
        if (process.env[name]) base[name] = process.env[name]!;
    }
    const env = { ...base, ...Object.fromEntries(Object.entries(options.env).filter((entry):entry is [string,string] => typeof entry[1] === 'string')) };
    const child = spawn(process.execPath,[LAUNCHER,kind,String(process.pid),process.cwd(),String(options.port ?? 0)],{
        cwd:process.cwd(), env:{ ...base, ...clientFixtureEnv }, stdio:['pipe','pipe','pipe','ipc'], detached:true,
    }) as OwnedClientProcess; // All three pipes are fixed above; the fourth channel is private IPC.
    const record:{ closed:Promise<void>; clientPid?:number } = { closed:new Promise(resolveClosed => child.once('close',() => resolveClosed())) };
    clients.set(child,record);
    child.on('message', message => {
        const value = message as {type?:string;pid?:number};
        if (value.type === 'owned-client-started' && Number.isInteger(value.pid) && value.pid! > 1) record.clientPid=value.pid;
    });
    child.once('exit',() => {
        // A killed supervisor cannot run its own cleanup; its launching owner
        // still knows exactly which child group it created via the private IPC.
        if (record.clientPid) { try { process.kill(-record.clientPid,'SIGKILL'); } catch { /* group already stopped */ } }
    });
    child.stdout.on('data',() => {});
    child.stderr.on('data',() => {});
    child.stdin.on('error',() => {}); // An early refusal may close stdin before its bounded payload is read.
    child.stdin.end(JSON.stringify(env));
    return child;
}

/** Stop and await only a process this helper created. Its supervisor cleans descendants. */
export async function stopOwnedClientRuntime(child:OwnedClientProcess|undefined):Promise<void> {
    if (!child) return;
    const record=clients.get(child);
    if (!record) throw new Error('refusing to stop a client this helper did not create');
    if (child.exitCode===null && child.signalCode===null) child.kill('SIGTERM');
    let timeout:NodeJS.Timeout|undefined;
    try {
        await Promise.race([record.closed,new Promise<never>((_,reject) => {
            timeout=setTimeout(() => { child.kill('SIGKILL'); reject(new Error('owned client supervisor did not stop')); },8000);
        })]);
    } finally {
        if (timeout) clearTimeout(timeout);
        clients.delete(child);
    }
}

export interface OwnedPooledSqlProxy {
    env(): {HYPERDRIVE:{connectionString:string}; STOREFRONT_POOLED_SQL:'on'};
    stop():Promise<void>;
    lastRelayError():string|null;
}

/** Actual PostgreSQL wire transport, fixed to the freshly verified owned cluster/database.
 * The cluster publishes no port. Each loopback connection relays raw bytes through
 * its own fixed byte relay inside that cluster. No hosted/ambient connection seam.
 */
export async function startOwnedPooledSqlProxy(owned:OwnedDatabase):Promise<OwnedPooledSqlProxy> {
    if(owned!==requireOwnedDatabase()||!clientFixtureEnv)throw new Error('owned SQL proxy requires the verified database handle');
    const guardEnv:Record<string,string>={...clientFixtureEnv};
    for(const name of ['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL'])if(process.env[name])guardEnv[name]=process.env[name]!;
    const verified=JSON.parse(execFileSync(process.execPath,[GUARD,'--verify'],{
        env:guardEnv,encoding:'utf8',timeout:30_000,stdio:['ignore','pipe','pipe'],
    })) as VerifiedFixture;
    if(verified.pgContainer!==owned.container||verified.database!==owned.database||verified.runId!==owned.runId) {
        throw new Error('owned SQL proxy refuses a changed fixture binding');
    }
    const role=`letbuyy_test_sql_${randomUUID().replaceAll('-','')}`;
    const password=randomBytes(32).toString('hex');
    // Use stdin, never a command argument or log carrying the ephemeral credential.
    owned.script(`CREATE ROLE "${role}" LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';
        GRANT app_tenant TO "${role}"; GRANT CONNECT ON DATABASE "${verified.database}" TO "${role}";`);
    const sockets=new Set<Socket>();
    const children=new Set<OwnedClientProcess>();
    const closed=new Set<Promise<void>>();
    let stopping=false;
    let relayError:string|null=null;
    const killChildren=()=>{for(const child of children)if(child.pid){try{process.kill(-child.pid,'SIGKILL');}catch{/* already stopped */}}};
    process.once('exit',killChildren);
    const server=createServer(socket=>{
        if(stopping){socket.destroy();return;}
        try{process.kill(verified.runnerPid,0);}catch{socket.destroy();return;}
        sockets.add(socket);socket.on('error',()=>{});
        // BusyBox nc keeps stdout open after the PostgreSQL peer closes until its
        // stdin ends. Forward real peer EOF immediately instead: the reader's end
        // stops the writer and exits the fixed relay, preserving raw wire bytes.
        const relay=`set -e
exec 3<>/dev/tcp/127.0.0.1/5432
exec 4<&0
dd bs=65536 status=none <&3 &
letbuyy_reader_pid=$!
dd bs=65536 status=none <&4 >&3 &
letbuyy_writer_pid=$!
trap 'kill "$letbuyy_reader_pid" "$letbuyy_writer_pid" 2>/dev/null || true' EXIT
wait "$letbuyy_reader_pid" || true
kill "$letbuyy_writer_pid" 2>/dev/null || true
wait "$letbuyy_writer_pid" 2>/dev/null || true`;
        const child=spawn('docker',['exec','-i',verified.pgContainer,'bash','-c',relay],{
            stdio:['pipe','pipe','pipe'],detached:true,
        }) as OwnedClientProcess;
        children.add(child);
        const completion=new Promise<void>(resolve=>child.once('close',()=>{
            children.delete(child);socket.destroy();resolve();
        }));
        closed.add(completion);void completion.then(()=>closed.delete(completion));
        child.on('error',error=>{relayError=error.message.slice(0,300);socket.destroy();});
        child.stderr.on('data',(data:Buffer)=>{relayError=data.toString().slice(0,300);});
        child.stdin.on('error',()=>socket.destroy());child.stdout.on('error',()=>socket.destroy());
        socket.pipe(child.stdin);child.stdout.pipe(socket);
        socket.once('close',()=>{
            sockets.delete(socket);child.stdin.end();
            if(child.pid){try{process.kill(-child.pid,'SIGTERM');}catch{/* already stopped */}}
        });
    });
    try {
        await new Promise<void>((resolve,reject)=>{
            server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});
        });
    } catch(error) {
        process.removeListener('exit',killChildren);owned.script(`REVOKE CONNECT ON DATABASE "${verified.database}" FROM "${role}"; DROP ROLE "${role}";`);throw error;
    }
    const address=server.address();
    if(!address||typeof address==='string')throw new Error('owned SQL proxy has no loopback port');
    const connectionString=`postgresql://${role}:${password}@127.0.0.1:${address.port}/${verified.database}`;
    let stopped:Promise<void>|undefined;
    return Object.freeze({
        env:()=>({HYPERDRIVE:{connectionString},STOREFRONT_POOLED_SQL:'on' as const}),
        lastRelayError:()=>relayError,
        stop:()=>stopped??=(async()=>{
            stopping=true;
            const serverClosed=new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
            for(const socket of sockets)socket.destroy();killChildren();
            await serverClosed;await Promise.all([...closed]);process.removeListener('exit',killChildren);
            owned.script(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
                WHERE usename='${role}' AND datname='${verified.database}' AND pid<>pg_backend_pid();`);
            owned.script(`REVOKE CONNECT ON DATABASE "${verified.database}" FROM "${role}"; DROP ROLE "${role}";`);
        })(),
    });
}
