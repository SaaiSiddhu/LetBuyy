// Actual owned PostgreSQL structural/concurrency proof. The152 tenant key remains;
//327 also fences globally unique provider payments, including NULL legacy keys.
// Normal producer and atomic invoice/audit cases live in the Gateway owned lane.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const currentDatabase = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_subscription_payment';
const databaseName = `${currentDatabase}_at327`;
const SHARED_DATABASE = 'letbuyy_executable';
const skip = currentDatabase !== SHARED_DATABASE
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const OWNER = '11111111-1111-4111-8111-1111111b1101';
const STORE = '22222222-2222-4222-8222-2222222b1101';
const OTHER_STORE = '22222222-2222-4222-8222-2222222b1102';
const CONTENDERS = 4;
const HOLD_SECONDS = 4;
const UUID_LINE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INDEX_VIOLATION = /duplicate key value violates unique constraint "subscriptions_(?:site_id_idempotency_key_idx|razorpay_payment_global_uidx)"/;

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
    psql(`DROP DATABASE IF EXISTS "${currentDatabase}" WITH (FORCE); CREATE DATABASE "${currentDatabase}";`, 'postgres');
    psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL,currentDatabase);
    for (const name of listMigrations()) {
        try {
            psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8')),currentDatabase);
            if(parseInt(name,10)===327)psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}" TEMPLATE "${currentDatabase}";`,'postgres');
        } catch (error) {
            throw new Error(`migration ${name} failed to apply: ${error.message}`);
        }
    }
    for(const target of [databaseName,currentDatabase])psql(`
    INSERT INTO public.users_custom (id, email) VALUES (${sqlString(OWNER)}::uuid, 'subscription-owner@example.test');
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published) VALUES
      (${sqlString(STORE)}::uuid, 'Single Activation Store', 'Single Activation Store', 'store', 'single-activation', true),
      (${sqlString(OTHER_STORE)}::uuid, 'Second Store', 'Second Store', 'store', 'second-store', true);
    `,target);
}

// The row activateMerchantSubscription inserts, reduced to the columns that matter here.
function activationSql({ paymentId, key, store = STORE, status = 'active' }) {
    return `
    INSERT INTO public.subscriptions
      (user_id, store_id, site_id, plan, status, billing_period, payment_gateway, razorpay_payment_id, idempotency_key, amount_paid)
    VALUES
      (${sqlString(OWNER)}::uuid, ${sqlString(store)}::uuid, ${sqlString(store)}::uuid, 'growth', ${sqlString(status)}, 'monthly',
       'razorpay', ${sqlString(paymentId)}, ${key === null ? 'NULL' : sqlString(key)}, 99900)
    RETURNING id;`;
}

const paymentKey = (paymentId) => `razorpay_payment:${paymentId}`;
const rowsFor = (paymentId) => Number(psql(`SELECT count(*) FROM public.subscriptions WHERE razorpay_payment_id = ${sqlString(paymentId)};`));

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

before(() => {
    if (skip) return;
    bootstrapDatabase();
});

test('the index the fix relies on is the one migration 152 created', { skip }, () => {
    const definition = psql(`SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'subscriptions_site_id_idempotency_key_idx';`);
    assert.equal(
        definition,
        'CREATE UNIQUE INDEX subscriptions_site_id_idempotency_key_idx ON public.subscriptions USING btree (site_id, idempotency_key) WHERE ((idempotency_key IS NOT NULL) AND (deleted_at IS NULL))',
    );
});

test('five concurrent activations of one payment for one store: exactly one subscription', { skip }, async () => {
    // One activation holds its insert open; four more insert the same row and queue behind it on the
    // unique index. When it commits, each of them fails, and the adapter answers with the winner's row.
    const statement = activationSql({ paymentId: 'pay_RACE', key: paymentKey('pay_RACE') });
    const holder = psqlAsync(`BEGIN;${statement}\nSELECT pg_sleep(${HOLD_SECONDS});\nCOMMIT;`);
    await waitFor(() => otherSessions("state = 'active' AND query LIKE 'SELECT pg_sleep%'") === 1, 'the first activation to hold its insert');
    const queued = Array.from({ length: CONTENDERS }, () => psqlAsync(statement));
    await waitFor(() => otherSessions("wait_event_type = 'Lock'") === CONTENDERS, `${CONTENDERS} activations queued on the unique index`);

    const [holderOutput, ...outcomes] = await Promise.allSettled([holder, ...queued]);
    assert.equal(holderOutput.status, 'fulfilled');
    assert.equal(holderOutput.value.split('\n').filter((line) => UUID_LINE.test(line.trim())).length, 1);
    for (const outcome of outcomes) {
        assert.equal(outcome.status, 'rejected', 'every queued activation must be refused');
        assert.match(outcome.reason.message, INDEX_VIOLATION);
    }
    assert.equal(rowsFor('pay_RACE'), 1);
});

test('NULL legacy idempotency keys cannot bypass the retained global provider payment fence', { skip }, () => {
    const sql=activationSql({paymentId:'pay_NULL_KEY_FENCED',key:null});psql(sql);
    assert.throws(()=>psql(sql),/subscriptions_razorpay_payment_global_uidx/);
    assert.equal(rowsFor('pay_NULL_KEY_FENCED'),1);
});

test('the same payment cannot be admitted by another store even though the152 logical key is tenant scoped', { skip }, () => {
    psql(activationSql({paymentId:'pay_TWO_STORES',key:paymentKey('pay_TWO_STORES'),store:STORE}));
    assert.throws(()=>psql(activationSql({paymentId:'pay_TWO_STORES',key:paymentKey('pay_TWO_STORES'),store:OTHER_STORE})),/subscriptions_razorpay_payment_global_uidx/);
    assert.equal(rowsFor('pay_TWO_STORES'),1);
});

test('327 preflight refuses ambiguous retained duplicates and its failed transaction deletes no evidence or guard', { skip }, () => {
    const count=psql('SELECT count(*) FROM public.subscriptions;');
    const index=psql("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='subscriptions_razorpay_payment_global_uidx';");
    const migration=readFileSync(join(repoRoot,'database/supabase/migrations/327_atomic_subscription_payment_ownership.sql'),'utf8');
    // An owned uncommitted fault fixture only: failed canonical preflight rolls
    // back both synthetic duplicates and the temporary DDL without row deletion.
    const transaction='BEGIN;DROP INDEX public.subscriptions_razorpay_payment_global_uidx;'+
        activationSql({paymentId:'pay_DEFECT_UNCOMMITTED',key:null,status:'cancelled'})+
        activationSql({paymentId:'pay_DEFECT_UNCOMMITTED',key:null,status:'active'})+
        migration.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
    assert.throws(()=>psql(transaction),/requires reviewed resolution of duplicate retained subscription payments/);
    assert.equal(psql('SELECT count(*) FROM public.subscriptions;'),count);
    assert.equal(psql("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='subscriptions_razorpay_payment_global_uidx';"),index);
});


test('current HEAD rejects the legacy raw positive activation while historical index controls remain isolated', { skip }, () => {
    assert.throws(()=>psql(activationSql({paymentId:'pay_HEAD_RAW_DENIED',key:'head-raw-denied'}),currentDatabase),/positive subscription requires the current canonical activation writer/);
    assert.equal(psql("SELECT count(*) FROM subscriptions WHERE razorpay_payment_id='pay_HEAD_RAW_DENIED';",currentDatabase),'0');
});
