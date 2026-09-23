// F-BIL1-1 (LB-BIL-001) — the database half of "one payment activates one subscription".
//
// SubscriptionExecutionAdapter.activateMerchantSubscription now looks for a subscription the payment
// already activated before inserting one. Two activations of the same payment can both pass that
// lookup: the merchant's verify route and the Razorpay webhook arrive seconds apart, sometimes at the
// same moment. What splits them is the insert. It carries the payment as its idempotency key, and
// migration 152 already created subscriptions_site_id_idempotency_key_idx,
// UNIQUE (site_id, idempotency_key) WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL. The
// adapter simply never set the column. This suite proves on real Postgres that the index admits
// exactly one of five concurrent inserts, and, as a CONTROL, that the NULL key the adapter used to
// write admits all five.
//
// It also records the evidence behind NOT adding the other backstop considered, a unique index on
// subscriptions(razorpay_payment_id). That index cannot be built on the rows this defect leaves
// behind (one payment, a cancelled and an active subscription), and the per-site index does not cover
// a second store, which is why LB-BIL-002 (cross-store replay) stays open.
//
// Runs as the postgres superuser, the convention of every sibling suite: this proves the schema's
// constraints, not RLS.

import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_subscription_payment';
const SHARED_DATABASE = 'letbuyy_executable';
const skip = databaseName !== SHARED_DATABASE
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const OWNER = '11111111-1111-4111-8111-1111111b1101';
const STORE = '22222222-2222-4222-8222-2222222b1101';
const OTHER_STORE = '22222222-2222-4222-8222-2222222b1102';
const CONTENDERS = 4;
const HOLD_SECONDS = 4;
const UUID_LINE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INDEX_VIOLATION = /duplicate key value violates unique constraint "subscriptions_site_id_idempotency_key_idx"/;

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
    psql(`
    INSERT INTO public.users_custom (id, email) VALUES (${sqlString(OWNER)}::uuid, 'subscription-owner@example.test');
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published) VALUES
      (${sqlString(STORE)}::uuid, 'Single Activation Store', 'Single Activation Store', 'store', 'single-activation', true),
      (${sqlString(OTHER_STORE)}::uuid, 'Second Store', 'Second Store', 'store', 'second-store', true);
    `);
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

test('CONTROL: with the NULL key the adapter used to write, all five activations land', { skip }, async () => {
    const statement = activationSql({ paymentId: 'pay_CONTROL', key: null });
    const outcomes = await Promise.allSettled(Array.from({ length: CONTENDERS + 1 }, () => psqlAsync(statement)));
    assert.deepEqual(outcomes.map((outcome) => outcome.status), Array(CONTENDERS + 1).fill('fulfilled'));
    assert.equal(rowsFor('pay_CONTROL'), CONTENDERS + 1, 'nothing in the schema stops one payment becoming many subscriptions');
});

test('the key is per store: the same payment key is admitted in another store (LB-BIL-002 stays open)', { skip }, () => {
    psql(activationSql({ paymentId: 'pay_TWO_STORES', key: paymentKey('pay_TWO_STORES'), store: STORE }));
    psql(activationSql({ paymentId: 'pay_TWO_STORES', key: paymentKey('pay_TWO_STORES'), store: OTHER_STORE }));
    assert.equal(rowsFor('pay_TWO_STORES'), 2);
});

test('the rejected alternative: a unique index on razorpay_payment_id cannot be built on the rows the defect left', { skip }, () => {
    psql('DELETE FROM public.subscriptions;');
    // What every double activation left behind: the first subscription cancelled, the second active,
    // both carrying the payment, neither carrying a key.
    psql(activationSql({ paymentId: 'pay_DEFECT', key: null, status: 'cancelled' }));
    psql(activationSql({ paymentId: 'pay_DEFECT', key: null, status: 'active' }));
    const proposed = 'CREATE UNIQUE INDEX subscriptions_razorpay_payment_id_key ON public.subscriptions (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;';
    assert.throws(() => psql(proposed), /could not create unique index "subscriptions_razorpay_payment_id_key"[\s\S]*pay_DEFECT/);

    // The index itself is sound: on the data the fix produces, one row per payment, it builds.
    psql("DELETE FROM public.subscriptions WHERE razorpay_payment_id = 'pay_DEFECT' AND status = 'cancelled';");
    psql(proposed);
    psql('DROP INDEX public.subscriptions_razorpay_payment_id_key;');
});
