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

import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
}

let cached: OwnedDatabase | undefined;
let watchdogArmed = false;

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
    });
    return cached;
}
