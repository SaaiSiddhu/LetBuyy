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
import {createServer,type Socket} from 'node:net';
import {chmodSync,mkdtempSync,readFileSync,readdirSync,rmSync,lstatSync,realpathSync,openSync,fstatSync,closeSync,readSync,writeFileSync,constants as fsConstants} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,X509Certificate,randomBytes,createPrivateKey} from 'node:crypto';
import {createVolume,docker,newRunId,removeCluster,requireImagePresent,waitUntilAccepting,FIXTURE_LABEL,OWNER_PID_LABEL,RUN_ID_LABEL,ROLE_LABEL} from '../../../../../scripts/governance/executable-pg-fixture.mjs';
import {SUPABASE_FAITHFUL_BOOTSTRAP_SQL} from '../../../../../scripts/governance/supabase-faithful-bootstrap.mjs';
import {removeOwnedNextDirectory,validateOwnedNextDirectoryReceipt} from '../../../../../scripts/governance/owned-next-directory.mjs';

const GUARD = fileURLToPath(new URL('../../../../../scripts/governance/owned-fixture-guard.mjs', import.meta.url));

/** Fixed read-only source inventory for the owned Merchant profile browser.
 * Callers cannot select an executable, arguments or filesystem roots. */
export function listOwnedMerchantProfileSourcePaths(): string[] {
    requireOwnedDatabase();
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--',
        'apps/merchant/web', 'apps/platform/identity', 'services/api-gateway', 'packages', 'database/supabase',
        'scripts/governance', 'tests/fixtures', 'tests/owned-db/merchant-store-profile-browser.postgres.test.ts'], {
        cwd: fileURLToPath(new URL('../../../../../', import.meta.url)), encoding: 'utf8', timeout: 10000,
        maxBuffer: 16 * 1024 * 1024,
    }).split('\0').filter(Boolean).sort();
}

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
    restEnv(): { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string; SUPABASE_ANON_KEY: string };
    /** One statement (or several, in one implicit transaction) as the superuser, `-At -F '|'`. Throws on an SQL error. */
    psql(sql: string): string;
    /** The same, as a separate process, for genuinely concurrent statements. */
    psqlAsync(sql: string): Promise<string>;
    /** The error text of a statement that must fail, or '' if it unexpectedly succeeded. */
    psqlExpectError(sql: string): string;
    /** Error text of a script sent on stdin; callers own explicit transaction boundaries. */
    psqlScriptExpectError(sql: string): string;
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
    const anonKey = process.env.LETBUYY_OWNED_REST_ANON_KEY ?? '';
    if (!serviceRoleKey) throw new Error('owned database: no REST service key was announced');
    armWatchdog(verified.runnerPid);
    clientFixtureEnv = Object.fromEntries([
        'LETBUYY_EXECUTABLE_RUN_ID', 'LETBUYY_EXECUTABLE_RUNNER_PID', 'LETBUYY_EXECUTABLE_PG_CONTAINER',
        'LETBUYY_EXECUTABLE_PG_DATABASE', 'LETBUYY_OWNED_REST_URL', 'LETBUYY_OWNED_REST_CONTAINER',
        'LETBUYY_OWNED_REST_UPSTREAM_PORT', 'LETBUYY_OWNED_REST_SERVICE_KEY',
    ].map(name => [name, process.env[name] ?? '']));
    // Rechecks must use the same exact image configuration that passed above.
    // CI uses a digest-pinned official mirror; dropping that configuration makes
    // child guards compare the mirror container with the default registry name.
    for (const name of ['LETBUYY_EXECUTABLE_PG_IMAGE', 'LETBUYY_EXECUTABLE_REST_IMAGE']) {
        if (process.env[name] !== undefined) clientFixtureEnv[name] = process.env[name]!;
    }
    Object.freeze(clientFixtureEnv);

    const psqlBase = ['exec', verified.pgContainer, 'psql', '-U', 'postgres', '-d', verified.database];
    const scriptArgs = ['exec', '-i', verified.pgContainer, 'psql', '-U', 'postgres', '-d', verified.database, '-v', 'ON_ERROR_STOP=1', '-qAt'];

    cached = Object.freeze({
        runId: verified.runId,
        container: verified.pgContainer,
        database: verified.database,
        restUrl: verified.restUrl,
        restEnv: () => ({ SUPABASE_URL: verified.restUrl, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey, SUPABASE_ANON_KEY: anonKey }),
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
        psqlScriptExpectError: (sql: string) => {
            try {
                execFileSync('docker', scriptArgs, { input: sql, encoding: 'utf8', timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'] });
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

/** Only fixed private preissued leaf paths; no certificate issuance or trust installation. */
function requirePrivateCheckoutTlsPath(path:string, directory:boolean, uid:number) {
    const info=lstatSync(path);
    if(realpathSync(path)!==path||info.isSymbolicLink()||info.uid!==uid
        ||(info.mode&0o777)!==(directory?0o700:0o600)
        ||(directory?!info.isDirectory():!info.isFile()||info.nlink!==1||info.size<1||info.size>65536)) {
        throw new Error('owned manual checkout TLS requires fixed private owned files');
    }
    return info;
}
function readPrivateCheckoutTlsLeaf(path:string,uid:number):Buffer {
    const expected=requirePrivateCheckoutTlsPath(path,false,uid);
    const fd=openSync(path,fsConstants.O_RDONLY|fsConstants.O_NOFOLLOW);
    const buffer=Buffer.alloc(65537);
    try {
        const actual=fstatSync(fd);
        if(actual.dev!==expected.dev||actual.ino!==expected.ino||actual.uid!==uid
            ||!actual.isFile()||actual.nlink!==1||(actual.mode&0o777)!==0o600
            ||actual.size<1||actual.size>65536)throw new Error('owned manual checkout TLS file changed');
        const count=readSync(fd,buffer,0,buffer.length,0),after=fstatSync(fd);
        if(count<1||count>65536||count!==actual.size||after.size!==actual.size
            ||after.mtimeMs!==actual.mtimeMs||after.ctimeMs!==actual.ctimeMs) {
            throw new Error('owned manual checkout TLS file changed during read');
        }
        return Buffer.from(buffer.subarray(0,count));
    } finally {buffer.fill(0);closeSync(fd);}
}
function createManualOwnedCheckoutTls(toolEnv:Record<string,string>):{key:Buffer;cert:Buffer;spki:string} {
    let key:Buffer|undefined,verifyDirectory:string|undefined;
    try {
        if(process.platform!=='darwin'||process.env.LETBUYY_THEME_EDITOR_BROWSER_HOLD!=='1'
            ||process.env.LETBUYY_THREADLINE_QA==='1'||!process.getuid)throw new Error('manual Editor-only');
        const uid=process.getuid(),directory=`/private/tmp/letbuyy-owned-checkout-manual-${uid}`;
        requirePrivateCheckoutTlsPath(directory,true,uid);
        const cert=readPrivateCheckoutTlsLeaf(join(directory,'cert.pem'),uid);
        key=readPrivateCheckoutTlsLeaf(join(directory,'key.pem'),uid);
        // Exactly one leaf PEM, with no ignored chain, private payload or trailing certificate.
        if(!/^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(cert.toString('ascii'))) {
            throw new Error('one leaf certificate required');
        }
        const certificate=new X509Certificate(cert);
        const from=Date.parse(certificate.validFrom),to=Date.parse(certificate.validTo),now=Date.now();
        if(certificate.subjectAltName!=='DNS:checkout.localhost'||certificate.ca
            ||certificate.checkHost('checkout.localhost',{subject:'never',wildcards:false})!=='checkout.localhost'
            ||!Number.isFinite(from)||!Number.isFinite(to)||from>now||to<=now
            ||certificate.keyUsage?.length!==1||certificate.keyUsage[0]!=='1.3.6.1.5.5.7.3.1'
            ||!certificate.checkPrivateKey(createPrivateKey(key)))throw new Error('invalid leaf identity, validity or key');
        // Verify the same immutable bytes parsed above, not a mutable input path.
        verifyDirectory=mkdtempSync('/private/tmp/letbuyy-owned-checkout-verify-');
        chmodSync(verifyDirectory,0o700);
        const verifyPath=join(verifyDirectory,'cert.pem');
        writeFileSync(verifyPath,cert,{mode:0o600,flag:'wx'});
        execFileSync('/usr/bin/security',['verify-cert','-c',verifyPath,'-p','ssl','-n','checkout.localhost','-L','-q'],{
            env:toolEnv,timeout:15_000,stdio:['ignore','pipe','pipe'],maxBuffer:65536,
        });
        const publicDer=certificate.publicKey.export({type:'spki',format:'der'});
        return Object.freeze({key,cert,spki:createHash('sha256').update(publicDer).digest('base64')});
    } catch {
        key?.fill(0);
        throw new Error('owned manual checkout TLS unavailable; owner must provision trusted leaf files separately');
    } finally {
        // Preissued inputs remain private and intact; delete only this call's public verification snapshot.
        if(verifyDirectory)rmSync(verifyDirectory,{recursive:true,force:true});
    }
}

/** checkout.localhost TLS material only for a freshly verified owned fixture.
 * Native generation removes its temporary key files; manual mode consumes and preserves private preissued inputs.
 * No caller-selected command, hostname, file path or certificate-trust override is accepted.
 */
export function createOwnedCheckoutTlsCertificate(owned:OwnedDatabase,mode:'native-ephemeral'|'manual-os-trusted'='native-ephemeral'):{key:Buffer;cert:Buffer;spki:string} {
    if(owned!==requireOwnedDatabase()||!clientFixtureEnv)throw new Error('owned checkout TLS requires the verified database handle');
    const toolEnv:Record<string,string>={};
    for(const name of ['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL'])if(process.env[name])toolEnv[name]=process.env[name]!;
    const verified=JSON.parse(execFileSync(process.execPath,[GUARD,'--verify'],{
        env:{...toolEnv,...clientFixtureEnv},encoding:'utf8',timeout:30_000,stdio:['ignore','pipe','pipe'],
    })) as VerifiedFixture;
    if(verified.pgContainer!==owned.container||verified.database!==owned.database||verified.runId!==owned.runId) {
        throw new Error('owned checkout TLS refuses a changed fixture binding');
    }
    if(mode!=='native-ephemeral'&&mode!=='manual-os-trusted')throw new Error('unapproved checkout TLS mode');
    if(mode==='manual-os-trusted')return createManualOwnedCheckoutTls(toolEnv);
    const directory=mkdtempSync(join(tmpdir(),'letbuyy-owned-checkout-tls-'));
    try {
        chmodSync(directory,0o700);
        const keyPath=join(directory,'key.pem'),certPath=join(directory,'cert.pem');
        execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1',
            '-keyout',keyPath,'-out',certPath,'-subj','/CN=checkout.localhost',
            '-addext','subjectAltName=DNS:checkout.localhost'],{
            env:{...toolEnv,RANDFILE:join(directory,'random-state')},timeout:15_000,stdio:['ignore','pipe','pipe'],
        });
        chmodSync(keyPath,0o600);
        const key=readFileSync(keyPath),cert=readFileSync(certPath);
        const certificate=new X509Certificate(cert);
        if(certificate.checkHost('checkout.localhost')!=='checkout.localhost')throw new Error('owned checkout TLS certificate name mismatch');
        const publicDer=certificate.publicKey.export({type:'spki',format:'der'});
        return Object.freeze({key,cert,spki:createHash('sha256').update(publicDer).digest('base64')});
    } finally {
        rmSync(directory,{recursive:true,force:true});
    }
}

type ClientKind = 'commerce-next' | 'identity-next' | 'merchant-next' | 'console-next' | 'commerce-next-production' | 'identity-next-production' | 'merchant-next-production' | 'commerce-session-smoke' | 'marketplace-flutter' | 'buyer-orders-dart' | 'lifecycle-probe' | 'money-ledger-scheduled-probe' | 'subscription-restart';
const CLIENT_KINDS = new Set<ClientKind>(["commerce-next", "identity-next", "merchant-next", "console-next", "commerce-next-production", "identity-next-production", "merchant-next-production", "commerce-session-smoke", "marketplace-flutter", "buyer-orders-dart", "lifecycle-probe", "money-ledger-scheduled-probe", "subscription-restart"]);
const LAUNCHER = fileURLToPath(new URL('../../../../../scripts/governance/owned-client-launcher.mjs', import.meta.url));
type NextDirectoryReceipt = Parameters<typeof removeOwnedNextDirectory>[0];
interface ClientRecord { closed:Promise<void>; clientPid?:number; nextDirectory?:NextDirectoryReceipt; cleanupError?:Error }
const clients = new Map<OwnedClientProcess, ClientRecord>();

async function finishClientDirectory(record:ClientRecord):Promise<void> {
    if (!record.nextDirectory) return;
    const groupAlive = () => {
        if (!record.clientPid) return false;
        try { process.kill(-record.clientPid,0); return true; }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
            // macOS can briefly refuse group inspection during forced teardown.
            // Treat that as still present and retry; never authorize deletion.
            if ((error as NodeJS.ErrnoException).code === 'EPERM') return true;
            throw new Error(`owned Next group ${record.clientPid} inspection failed: ${(error as NodeJS.ErrnoException).code}`);
        }
    };
    const deadline=Date.now()+2500;
    while(groupAlive() && Date.now()<deadline) await new Promise(done=>setTimeout(done,40));
    if(groupAlive()) throw new Error('owned Next process group still alive; directory preserved');
    removeOwnedNextDirectory(record.nextDirectory);
}

/** Launch only a named test client after database ownership is proven; no raw command/cwd seam. */
export function startOwnedClientRuntime(owned:OwnedDatabase, kind:ClientKind, options:{ port?:number; env:Record<string,string|undefined>; hostMode?:'canonical-storefront-loopback'; providerFixture?:{kind:'turnstile-local-v1';origin:string;capability:string} }):OwnedClientProcess {
    if (!CLIENT_KINDS.has(kind)) throw new Error('unapproved owned client runtime kind');
    if (owned !== requireOwnedDatabase() || !clientFixtureEnv) throw new Error('owned client runtime requires the verified database handle');
    if ((kind.endsWith('-next') || kind.endsWith('-next-production')) && (!Number.isInteger(options.port) || options.port! < 1024 || options.port! > 65535)) throw new Error('invalid local Next port');
    if (Object.keys(options.env).some(name => /^(NODE_OPTIONS|NODE_PATH|BASH_ENV|ENV|PATH|HOME|PNPM_HOME|FLUTTER_ROOT|PUB_CACHE|PLAYWRIGHT_BROWSERS_PATH|LD_PRELOAD|DYLD_.*|__NEXT_PRIVATE_.*)$/.test(name))) {
        throw new Error('owned client runtime refuses executable or loader overrides');
    }
    // Only OS/tool paths cross implicitly. Provider/database credentials and
    // ambient app settings must not leak from the shell into a synthetic journey.
    if (options.env.LETBUYY_OWNED_CLIENT_HOST_MODE !== undefined) throw new Error('owned host mode must use the verified helper option');
    if (Object.keys(options.env).some(name=>name.startsWith('LETBUYY_OWNED_PROVIDER_'))) throw new Error('owned provider mode must use the verified helper option');
    if (options.providerFixture && !kind.startsWith('identity-next')) throw new Error('owned provider fixture is limited to Identity clients');
    if (options.hostMode && (!kind.endsWith('-next-production') || options.hostMode !== 'canonical-storefront-loopback')) throw new Error('invalid owned host mode');
    const base:Record<string,string> = {};
    for (const name of ['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL','PNPM_HOME','FLUTTER_ROOT','PUB_CACHE','PLAYWRIGHT_BROWSERS_PATH']) {
        if (process.env[name]) base[name] = process.env[name]!;
    }
    const env = { ...base, ...Object.fromEntries(Object.entries(options.env).filter((entry):entry is [string,string] => typeof entry[1] === 'string')), ...(options.hostMode ? { LETBUYY_OWNED_CLIENT_HOST_MODE: options.hostMode } : {}), ...(options.providerFixture?{LETBUYY_OWNED_PROVIDER_PROFILE:JSON.stringify(options.providerFixture)}:{}) };
    const child = spawn(process.execPath,[LAUNCHER,kind,String(process.pid),process.cwd(),String(options.port ?? 0)],{
        cwd:process.cwd(), env:{ ...base, ...clientFixtureEnv }, stdio:['pipe','pipe','pipe','ipc'], detached:true,
    }) as OwnedClientProcess; // All three pipes are fixed above; the fourth channel is private IPC.
    const record:ClientRecord = { closed:Promise.resolve() };
    record.closed=new Promise(resolveClosed => child.once('close',() => {
        void finishClientDirectory(record).catch(error=>{record.cleanupError=error;}).finally(resolveClosed);
    }));
    clients.set(child,record);
    child.on('message', message => {
        const value = message as {type?:string;pid?:number;receipt?:NextDirectoryReceipt};
        if (value.type === 'owned-client-started' && Number.isInteger(value.pid) && value.pid! > 1) record.clientPid=value.pid;
        if (value.type === 'owned-next-directory') {
            try {
                record.nextDirectory=validateOwnedNextDirectoryReceipt(value.receipt,{
                    root:process.cwd(),kind,runId:owned.runId,supervisorPid:child.pid!,parentPid:process.pid,
                });
            } catch(error) { record.cleanupError=error as Error;child.kill('SIGTERM'); }
        }
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
            timeout=setTimeout(() => {
                child.kill('SIGKILL');
                timeout=setTimeout(()=>reject(new Error('owned client supervisor did not stop')),4000);
            },8000);
        })]);
        if(record.cleanupError)throw record.cleanupError;
    } finally {
        if (timeout) clearTimeout(timeout);
        clients.delete(child);
    }
}

type OwnedImportCommitStage='row'|'registration'|'registration-stop';
type OwnedCommitStage=OwnedImportCommitStage|'media';
export interface OwnedPooledSqlProxy {
    env(): {HYPERDRIVE:{connectionString:string}; STOREFRONT_POOLED_SQL:'on'};
    stop():Promise<void>;
    lastRelayError():string|null;
    /** Named wire fault: forward the real row transaction, lose only its COMMIT ack. */
    dropNextProductImportCommitAcknowledgement(stage?:OwnedImportCommitStage):void;
    droppedProductImportCommitAcknowledgements():number;
    /** Lose only the actual COMMIT acknowledgement after a canonical Media receipt write. */
    dropNextMediaCommitAcknowledgement():void;
    droppedMediaCommitAcknowledgements():number;
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
    // Reuse the verified cluster's canonical NOINHERIT transport. Creating a
    // new app_tenant member after migrations freeze authority would invalidate
    // the billing/collection custody guards. Transactions still SET LOCAL ROLE
    // app_tenant; the transport itself has no inherited table privileges.
    const role='authenticator';
    const password=process.env.LETBUYY_OWNED_SQL_PASSWORD ?? '';
    if(!/^[0-9a-f]{48}$/.test(password))throw new Error('owned SQL proxy requires the runner-issued transport credential');
    if(owned.psql("SELECT count(*) FROM pg_roles WHERE rolname='authenticator' AND rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication;")!=='1')throw new Error('owned SQL proxy refuses changed transport authority');
    const sockets=new Set<Socket>();
    const children=new Set<OwnedClientProcess>();
    const closed=new Set<Promise<void>>();
    let stopping=false;
    let relayError:string|null=null;
    let dropImportCommit:OwnedCommitStage|null=null,droppedImportCommits=0,droppedMediaCommits=0;
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
        // Observe protocol framing without logging/buffering entire sessions.
        // Only the fixed import completion statement can arm the named fault;
        // bound values and arbitrary caller-provided SQL never select a target.
        let frontend=Buffer.alloc(0),backend=Buffer.alloc(0),startup=true,importRow:OwnedCommitStage|null=null;
        const statements=new Map<string,OwnedCommitStage|null>(),portals=new Map<string,OwnedCommitStage|null>();
        socket.on('data',(chunk:Buffer)=>{
            frontend=Buffer.concat([frontend,chunk]);
            while(frontend.length>=(startup?4:5)){
                const size=frontend.readInt32BE(startup?0:1),length=size+(startup?0:1);
                if(size<4||size>16_777_216){socket.destroy();return;}
                if(frontend.length<length)return;
                const frame=frontend.subarray(0,length);frontend=frontend.subarray(length);
                if(startup){startup=false;continue;}
                const type=String.fromCharCode(frame[0]);
                if(type==='P'||type==='Q'){
                    const nameEnd=type==='P'?frame.indexOf(0,5):4;
                    const start=nameEnd+1,end=frame.indexOf(0,start);
                    const query=start>=5&&end>start?frame.toString('utf8',start,end):'';
                    const matching=/^SELECT public\.complete_product_import_row_v1\(/.test(query)?'row'
                        :/^SELECT public\.register_product_import_v1\(/.test(query)?'registration'
                        :/^SELECT public\.stop_product_import_registration_v1\(/.test(query)?'registration-stop'
                        :/^UPDATE public\.idempotency_keys SET status='completed',resource_type='media',/.test(query)?'media':null;
                    if(type==='P')statements.set(frame.toString('utf8',5,nameEnd),matching);
                    else if(dropImportCommit===matching&&matching)importRow=matching;
                }else if(type==='B'){
                    const portalEnd=frame.indexOf(0,5),statementEnd=frame.indexOf(0,portalEnd+1);
                    if(portalEnd>=5&&statementEnd>portalEnd)portals.set(frame.toString('utf8',5,portalEnd),
                        statements.get(frame.toString('utf8',portalEnd+1,statementEnd))??null);
                }else if(type==='E'&&dropImportCommit){
                    const portalEnd=frame.indexOf(0,5);
                    const operation=portalEnd>=5?portals.get(frame.toString('utf8',5,portalEnd)):null;
                    if(operation===dropImportCommit&&operation)importRow=operation;
                }
            }
        });
        socket.pipe(child.stdin);
        child.stdout.on('data',(chunk:Buffer)=>{
            backend=Buffer.concat([backend,chunk]);
            while(backend.length>=5){
                const size=backend.readInt32BE(1),length=size+1;
                if(size<4||size>16_777_216){socket.destroy();return;}
                if(backend.length<length)return;
                const frame=backend.subarray(0,length);backend=backend.subarray(length);
                if(frame[0]===67){
                    const command=frame.toString('utf8',5,length-1);
                    if(command==='COMMIT'&&importRow&&importRow===dropImportCommit){
                        // PostgreSQL has acknowledged its own actual COMMIT.
                        // Nothing fabricates success or rolls back that state.
                        dropImportCommit=null;if(importRow==='media')droppedMediaCommits++;else droppedImportCommits++;socket.destroy();return;
                    }
                    if(command==='COMMIT'||command==='ROLLBACK')importRow=null;
                }
                if(!socket.write(frame)){child.stdout.pause();socket.once('drain',()=>child.stdout.resume());}
            }
        });
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
        process.removeListener('exit',killChildren);throw error;
    }
    const address=server.address();
    if(!address||typeof address==='string')throw new Error('owned SQL proxy has no loopback port');
    const connectionString=`postgresql://${role}:${password}@127.0.0.1:${address.port}/${verified.database}`;
    let stopped:Promise<void>|undefined;
    return Object.freeze({
        env:()=>({HYPERDRIVE:{connectionString},STOREFRONT_POOLED_SQL:'on' as const}),
        lastRelayError:()=>relayError,
        dropNextProductImportCommitAcknowledgement:(stage:OwnedImportCommitStage='row')=>{
            if(stopping||dropImportCommit)throw new Error('Owned import COMMIT fault is already armed or stopped');
            dropImportCommit=stage;
        },
        droppedProductImportCommitAcknowledgements:()=>droppedImportCommits,
        dropNextMediaCommitAcknowledgement:()=>{
            if(stopping||dropImportCommit)throw new Error('Owned COMMIT fault is already armed or stopped');
            dropImportCommit='media';
        },
        droppedMediaCommitAcknowledgements:()=>droppedMediaCommits,
        stop:()=>stopped??=(async()=>{
            stopping=true;
            const serverClosed=new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
            for(const socket of sockets)socket.destroy();killChildren();
            await serverClosed;await Promise.all([...closed]);process.removeListener('exit',killChildren);
            // Only this proxy owns these sockets/relays; the REST transport stays alive.
        })(),
    });
}


/** SQL-only historical control inside the already verified disposable cluster.
 * It has no REST endpoint and cannot be passed to an owned client runtime.
 *315,358 and361 pin schema/physical identities that later DDL cannot recreate.
 */
export function requireOwnedHistoricalSqlDatabase(through: 309 | 315 | 346 | 356 | 357 | 358 | 361 | 385): Pick<OwnedDatabase,'database'|'psql'|'psqlAsync'|'psqlExpectError'|'psqlScriptExpectError'|'exec'|'script'|'scriptLarge'> {
    if(through!==309&&through!==315&&through!==346&&through!==356&&through!==357&&through!==358&&through!==361&&through!==385)throw new Error('unreviewed historical schema point');
    const verified=requireOwnedDatabase(); // No environment/container fallback.
    const root=fileURLToPath(new URL('../../../../../',import.meta.url));
    const database=`letbuyy_history_${through}_${crypto.randomUUID().replaceAll('-','').slice(0,12)}`;
    const run=(target:string,sql:string)=>execFileSync('docker',[
        'exec','-i',verified.container,'psql','-U','postgres','-d',target,'-v','ON_ERROR_STOP=1','-qAt',
    ],{input:sql,encoding:'utf8',timeout:45000,maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
    const roleState=()=>verified.psql(`SELECT jsonb_build_object(
        'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid) FROM pg_roles r),
        'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) FROM pg_auth_members m));`);
    const initialRoles=roleState();
    run('postgres',`CREATE DATABASE "${database}";`); // Exclusive CREATE, never replace an existing database.
    try {
        run(database,SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
        const migrations=readdirSync(join(root,'database/supabase/migrations')).filter(name=>name.endsWith('.sql')&&parseInt(name,10)<=through)
            .sort((a,b)=>parseInt(a,10)-parseInt(b,10)||a.localeCompare(b));
        if(!migrations.some(name=>parseInt(name,10)===through))throw new Error('historical migration is missing');
        for(const name of migrations)run(database,readFileSync(join(root,'database/supabase/migrations',name),'utf8').replace(/^SET transaction_timeout = 0;\s*$/m,''));
        if(roleState()!==initialRoles)throw new Error('historical replay changed cluster role authority');
    } catch(error) {
        run('postgres',`DROP DATABASE "${database}" WITH(FORCE);`);
        throw error;
    }
    const expectError=(sql:string)=>{try{run(database,sql);return '';}catch(error){return String((error as {stderr?:Buffer|string}).stderr??'').trim();}};
    const script=(sql:string)=>run(database,sql);
    return Object.freeze({database,psql:script,script,scriptLarge:script,
        exec:(sql:string)=>{try{return script(sql);}catch{return null;}},psqlExpectError:expectError,psqlScriptExpectError:expectError,
        psqlAsync:(sql:string)=>new Promise<string>((resolve,reject)=>{
            const child=spawn('docker',['exec','-i',verified.container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-qAt']);
            let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
            child.once('error',reject);child.once('close',code=>code===0?resolve(out.trim()):reject(new Error(err||'historical SQL failed')));
            child.stdin.end(sql);
        }),
    });
}


/** Fresh provider-role cluster, reachable only after the normal fixture guard.
 * Administrator access exists solely inside this network-disabled synthetic
 * image. No endpoint, credentials, existing container or recovery data can be
 * supplied by a caller. All SQL/process access stays in this support module.
 */
interface OwnedProviderSession {
    query(sql:string):Promise<string>;
    close():void;
    stopped():Promise<void>;
}
export async function createOwnedManagedSupabaseFixture(owned:OwnedDatabase) {
    const verified=requireOwnedDatabase();
    if(owned!==verified) throw new Error('Managed provider fixture requires the exact verified parent handle');
    const image='public.ecr.aws/supabase/postgres:17.6.1.127@sha256:be60aee15997daca475b710b734bc6bfe52cd544dcd7e9fd2ff58210b6747d83';
    requireImagePresent(image);
    const runId=newRunId(),name=`letbuyy-managed-admission-${runId}`;
    const volume=createVolume({name:`${name}-data`,runId});
    const connections:OwnedProviderSession[]=[];
    const applicationPassword=randomBytes(32).toString('hex');
    const migratorPassword=randomBytes(32).toString('hex');
    let applicationPasswordInstalled=false;
    let migratorPasswordInstalled=false;
    const execute=(sql:string,role:'postgres'|'supabase_admin'|'authenticator'|'cli_login_postgres'='postgres')=>{
        try {
            const password=role==='authenticator'?applicationPassword:role==='cli_login_postgres'?migratorPassword:undefined;
            const stdout=execFileSync('docker',['exec','-i',...(password?['-e','PGPASSWORD']:[]),name,'psql',...(password?['-h','127.0.0.1']:[]),'-U',role,'-d','postgres','-qAtX','-v','ON_ERROR_STOP=1'],{
                input:(role==='cli_login_postgres'?'SET ROLE postgres;\n':'')+'SET search_path=public,extensions;\n'+sql,encoding:'utf8',timeout:90_000,stdio:['pipe','pipe','pipe'],
                ...(password?{env:{...process.env,PGPASSWORD:password}}:{}),
            });
            return {ok:true,stdout:stdout.trim(),error:''};
        } catch(error) {
            return {ok:false,stdout:'',error:String((error as {stderr?:Buffer|string}).stderr??'Managed fixture SQL failed').slice(-1800)};
        }
    };
    const query=(sql:string,role:'postgres'|'supabase_admin'|'authenticator'|'cli_login_postgres'='postgres')=>{
        const result=execute(sql,role);if(!result.ok) throw new Error(result.error);return result.stdout;
    };
    function session():OwnedProviderSession {
        const child=spawn('docker',['exec','-i',name,'psql','-U','postgres','-d','postgres','-qAtX','-v','ON_ERROR_STOP=1']);
        let output='',errors='',ended=false;
        let pending:{marker:string;done:(value:string)=>void;fail:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}|undefined;
        child.stdout.on('data',(data:Buffer)=>{
            output+=data.toString();
            if(pending&&output.includes(pending.marker)) {
                const current=pending;pending=undefined;clearTimeout(current.timer);
                const result=output.slice(0,output.indexOf(current.marker));output='';current.done(result.trim());
            }
        });
        child.stderr.on('data',(data:Buffer)=>{errors+=data.toString();});
        child.on('exit',()=>{
            ended=true;
            if(pending) {clearTimeout(pending.timer);pending.fail(new Error(errors.slice(-1800)));pending=undefined;}
        });
        const connection={
            query(sql:string):Promise<string> {
                if(ended) return Promise.reject(new Error(errors.slice(-1800)||'Owned managed session ended'));
                if(pending) return Promise.reject(new Error('One command at a time per owned connection'));
                return new Promise((done,fail)=>{
                    const marker='MANAGED_DONE_'+randomBytes(12).toString('hex');
                    pending={marker,done,fail,timer:setTimeout(()=>{child.kill();fail(new Error('Owned managed SQL timed out'));},90_000)};
                    // Finish a valid final statement before the completion
                    // marker. psql can echo while an unterminated SELECT is
                    // still buffered, which otherwise returns false completion.
                    child.stdin.write(sql+'\n;\n\\echo '+marker+'\n');
                });
            },
            close(){if(!child.stdin.destroyed)child.stdin.end();},
            stopped(){return new Promise<void>(done=>{if(ended)done();else child.once('exit',()=>done());});},
        };
        connections.push(connection);return connection;
    }
    try {
        docker(['run','-d','--pull','never','--name',name,'--network','none',
            '--label',`${FIXTURE_LABEL}=1`,'--label',`${OWNER_PID_LABEL}=${process.pid}`,
            '--label',`${RUN_ID_LABEL}=${runId}`,'--label',`${ROLE_LABEL}=postgres`,
            '--memory','1g','--memory-swap','1g','--cpus','2','--pids-limit','512',
            '--mount',`type=volume,source=${volume},target=/var/lib/postgresql/data`,'-e','POSTGRES_PASSWORD',
            image,'postgres','-D','/etc/postgresql','-c','max_prepared_transactions=2','-c','autovacuum=off','-c','jit=off'],
            {env:{POSTGRES_PASSWORD:randomBytes(32).toString('hex')}});
        await waitUntilAccepting(name);
    } catch(error) {removeCluster({name,runId,volume});throw error;}
    return {
        psql:(sql:string)=>query(sql),admin:(sql:string)=>query(sql,'supabase_admin'),
        application:(sql:string)=>{
            if(!applicationPasswordInstalled) {
                query(`ALTER ROLE authenticator PASSWORD '${applicationPassword}';`,'supabase_admin');
                applicationPasswordInstalled=true;
            }
            return query(sql,'authenticator');
        },migrator:(sql:string)=>{
            if(!migratorPasswordInstalled) {
                query(`ALTER ROLE cli_login_postgres PASSWORD '${migratorPassword}';`,'supabase_admin');
                migratorPasswordInstalled=true;
            }
            return query(sql,'cli_login_postgres');
        },session,
        psqlExpectError(sql:string){const result=execute(sql);if(result.ok)throw new Error('Refused managed-fixture operation unexpectedly succeeded');return result.error;},
        async close(){
            for(const connection of connections)connection.close();
            await Promise.all(connections.map(connection=>connection.stopped()));
            removeCluster({name,runId,volume});
        },
    };
}
