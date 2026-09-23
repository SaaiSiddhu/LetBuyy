// F-PAY8-1 (LB-PAY-008) — reclaiming a retried webhook event is exclusive: exactly one delivery wins.
//
// services/webhook-service reclaims a payment_webhook_events row with a conditional PATCH, which PostgREST
// runs as a single UPDATE ... WHERE <predicate> RETURNING. The claim that only one concurrent delivery gets
// the row back rests on Postgres, not on the service. Under READ COMMITTED, an UPDATE that waited on a row
// lock re-evaluates its WHERE clause against the version the lock holder committed. Once the winner has
// changed the row, a contender's predicate no longer matches. That is proven here on the real table, with
// its real trigger. The winner's transaction is held open until every contender is queued on the row lock,
// so the recheck is exercised rather than assumed.
//
// CONTROL 1: the same contention with the status predicate removed, where every contender also "wins".
// CONTROL 2: the stale-'received' reclaim with the table's update trigger dropped and updated_at not set by
// the statement. Every contender wins, because nothing the predicate reads has changed. Setting updated_at
// in the statement, as the service does, restores exclusivity on its own.
//
// Runs as the postgres superuser, the convention of every sibling suite: this proves the statement's
// semantics, not RLS.

import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_webhook_reclaim';
const SHARED_DATABASE = 'letbuyy_executable';
const skip = databaseName !== SHARED_DATABASE
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const CONTENDERS = 4;
const HOLD_SECONDS = 4;
const UUID_LINE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    ).trim();
}

function psqlAsync(sql) {
    return new Promise((resolve, reject) => {
        const child = spawn('docker', [
            'exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt',
        ], { stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', (code) => (code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `psql exited with ${code}`))));
        child.stdin.end(sql);
    });
}

const sqlString = (v) => `'${String(v).replaceAll("'", "''")}'`;
const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function listMigrations() {
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((n) => n.endsWith('.sql'))
        .sort((a, b) => {
            const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
            const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
            return na - nb || a.localeCompare(b);
        });
}

function bootstrapDatabase() {
    psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE); CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
    for (const name of listMigrations()) {
        try {
            psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8')));
        } catch (error) {
            throw new Error(`migration ${name} failed to apply: ${error.message}`);
        }
    }
}

let seq = 0;
function seedEvent(status, updatedAt = 'now()') {
    seq += 1;
    const eventId = `payment.captured:pay_RECLAIM${String(seq).padStart(4, '0')}`;
    psql(`
    INSERT INTO public.payment_webhook_events
      (provider, provider_event_id, event_type, signature_valid, processing_status, created_at, updated_at)
    VALUES ('razorpay', ${sqlString(eventId)}, 'payment.captured', true, ${sqlString(status)}, ${updatedAt}, ${updatedAt});
    `);
    return eventId;
}

// The statement PostgREST issues for the service's reclaim PATCH, minus its CTE wrapper.
function reclaimSql(eventId, { predicate, setUpdatedAt = true }) {
    return `
    UPDATE public.payment_webhook_events
       SET processing_status = 'received', processed_at = NULL${setUpdatedAt ? ', updated_at = now()' : ''}
     WHERE provider = 'razorpay'
       AND provider_event_id = ${sqlString(eventId)}${predicate ? `\n       AND ${predicate}` : ''}
    RETURNING id;`;
}

const FAILED = "processing_status = 'failed'";
const STALE_RECEIVED = "processing_status = 'received' AND updated_at < now() - interval '5 minutes'";

const winnersIn = (output) => output.split('\n').filter((line) => UUID_LINE.test(line.trim())).length;

async function waitFor(probe, what) {
    const deadline = Date.now() + (HOLD_SECONDS - 1) * 1000;
    while (Date.now() < deadline) {
        if (probe()) return;
        await sleep(50);
    }
    throw new Error(`timed out waiting for ${what}; the contention was not set up, so nothing was proven`);
}

const otherSessions = (condition) => Number(psql(`
    SELECT count(*) FROM pg_stat_activity
     WHERE datname = current_database() AND pid <> pg_backend_pid() AND ${condition};`));

// One delivery takes the row and keeps its transaction open. The others issue the same statement and
// queue behind its row lock. Only then is the first allowed to commit.
async function contend(statement) {
    const holder = psqlAsync(`BEGIN;${statement}\nSELECT pg_sleep(${HOLD_SECONDS});\nCOMMIT;`);
    await waitFor(() => otherSessions("state = 'active' AND query LIKE 'SELECT pg_sleep%'") === 1, 'the first claimant to hold the row');
    const queued = Array.from({ length: CONTENDERS }, () => psqlAsync(statement));
    await waitFor(() => otherSessions("wait_event_type = 'Lock'") === CONTENDERS, `${CONTENDERS} contenders queued on the row lock`);
    const [holderOutput, ...queuedOutputs] = await Promise.all([holder, ...queued]);
    return { holder: winnersIn(holderOutput), contenders: queuedOutputs.map(winnersIn) };
}

before(() => {
    if (skip) return;
    bootstrapDatabase();
});

test('the table still carries the update trigger the reclaim leans on', { skip }, () => {
    const trigger = psql(`
    SELECT tgname || ':' || p.proname
      FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE t.tgrelid = 'public.payment_webhook_events'::regclass AND NOT t.tgisinternal;`);
    assert.equal(trigger, 'update_payment_webhook_events_updated_at:update_updated_at');
});

test('a failed event: of five concurrent reclaims, exactly one gets the row', { skip }, async () => {
    const eventId = seedEvent('failed');
    const outcome = await contend(reclaimSql(eventId, { predicate: FAILED }));
    assert.equal(outcome.holder, 1);
    assert.deepEqual(outcome.contenders, Array(CONTENDERS).fill(0), 'every queued contender re-checks the predicate against the committed row and misses');
    assert.equal(psql(`SELECT processing_status FROM public.payment_webhook_events WHERE provider_event_id = ${sqlString(eventId)};`), 'received');
});

test('CONTROL 1: without the status predicate, every queued contender also takes the row', { skip }, async () => {
    const eventId = seedEvent('failed');
    const outcome = await contend(reclaimSql(eventId, { predicate: null }));
    assert.equal(outcome.holder, 1);
    assert.deepEqual(outcome.contenders, Array(CONTENDERS).fill(1), 'the predicate, not the row lock, is what makes one delivery the only one');
});

test("an abandoned 'received' event: of five concurrent stale reclaims, exactly one gets the row", { skip }, async () => {
    const eventId = seedEvent('received', "now() - interval '10 minutes'");
    const outcome = await contend(reclaimSql(eventId, { predicate: STALE_RECEIVED }));
    assert.equal(outcome.holder, 1);
    assert.deepEqual(outcome.contenders, Array(CONTENDERS).fill(0));
});

test("the service's predicates never match a terminal row or a fresh 'received' row", { skip }, () => {
    for (const status of ['processed', 'ignored']) {
        const eventId = seedEvent(status, "now() - interval '10 minutes'");
        assert.equal(winnersIn(psql(reclaimSql(eventId, { predicate: FAILED }))), 0);
        assert.equal(winnersIn(psql(reclaimSql(eventId, { predicate: STALE_RECEIVED }))), 0);
    }
    const inFlight = seedEvent('received');
    assert.equal(winnersIn(psql(reclaimSql(inFlight, { predicate: STALE_RECEIVED }))), 0, 'an attempt still inside the lease is left alone');
});

test("CONTROL 2: with the trigger gone, the stale reclaim is exclusive only because the statement sets updated_at", { skip }, async () => {
    psql('DROP TRIGGER update_payment_webhook_events_updated_at ON public.payment_webhook_events;');
    try {
        const unstamped = seedEvent('received', "now() - interval '10 minutes'");
        const without = await contend(reclaimSql(unstamped, { predicate: STALE_RECEIVED, setUpdatedAt: false }));
        assert.equal(without.holder, 1);
        assert.deepEqual(without.contenders, Array(CONTENDERS).fill(1), 'nothing the predicate reads changed, so every contender still matches');

        const stamped = seedEvent('received', "now() - interval '10 minutes'");
        const withStamp = await contend(reclaimSql(stamped, { predicate: STALE_RECEIVED, setUpdatedAt: true }));
        assert.equal(withStamp.holder, 1);
        assert.deepEqual(withStamp.contenders, Array(CONTENDERS).fill(0));
    } finally {
        psql(`CREATE TRIGGER update_payment_webhook_events_updated_at BEFORE UPDATE ON public.payment_webhook_events
              FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();`);
    }
});
