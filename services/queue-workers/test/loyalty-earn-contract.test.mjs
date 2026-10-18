// F-LOY-2 — where the loyalty accrual runs, and why it is not in the payment RPC.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripSqlComments } from '../../../scripts/governance/definer-role-closure.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const sweeper = strip(readFileSync(join(root, 'services/queue-workers/src/loyalty-earn.ts'), 'utf8'));
const index = strip(readFileSync(join(root, 'services/queue-workers/src/index.ts'), 'utf8'));
const migrations=join(root,'database/supabase/migrations');
function latestFunction(name) {
    let body;
    for (const file of readdirSync(migrations).filter(file=>file.endsWith('.sql')).sort((a,b)=>parseInt(a,10)-parseInt(b,10)||a.localeCompare(b))) {
        const sql=stripSqlComments(readFileSync(join(migrations,file),'utf8'));
        const definitions=new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${name}\\s*\\([\\s\\S]*?\\bAS\\s+(\\$[a-z_]*\\$)([\\s\\S]*?)\\1`,'gi');
        for (const definition of sql.matchAll(definitions)) body=definition[2];
    }
    assert.ok(body,`the current ${name} definition must exist`);
    return body;
}
const capture=latestFunction('confirm_order_payment_with_ledger');
const pending=latestFunction('pending_loyalty_earn_orders_v1');
const award=latestFunction('award_loyalty_points');

test('the accrual is SCHEDULED, not dead code', () => {
    assert.match(index, /runLoyaltyEarnSweeper\(env, \{/, 'importing it without calling it would be dead code');
    assert.match(index, /scheduled\.loyalty_earn/);
});

test('loyalty is NOT awarded inside the payment capture RPC', () => {
    // That function runs in one transaction: a raise there would roll back a capture the provider
    // has already settled, and a persistently broken programme would make payments unretryable.
    assert.doesNotMatch(capture, /award_loyalty_points/, 'the capture path must not award points');
});

test('the sweeper awards through the RPC with an ORDER-DERIVED idempotency key', () => {
    assert.match(sweeper, /\.rpc\('award_loyalty_points'/, 'points move only through the SECURITY DEFINER RPC');
    assert.match(sweeper, /p_idempotency_key: `loyalty\.earn:\$\{order\.id\}`/, 'a re-run must award once');
    assert.doesNotMatch(sweeper, /\.from\('loyalty_ledger_entries'\)[\s\S]{0,200}\.insert\(/, 'the ledger must never be written from TypeScript');
});

test('the ledger entry is the marker — the sweeper keeps no cursor', () => {
    // A cursor is state that can be wrong; an existing 'earned' entry cannot be.
    assert.match(sweeper, /\.eq\('entry_type', 'earned'\)/);
    assert.doesNotMatch(sweeper, /cursor|checkpoint|last_processed/i, 'no cursor state');
    assert.match(pending,/NOT EXISTS[\s\S]*entry_type='earned'/);
});

test('the buyer is the order\'s EXPLICIT owner, never an email match (APPID-P3, migration 255)', () => {
    // buyer_order_links is written only by the buyer\'s own authenticated checkout, a verified claim or
    // an operator resolution. The email chain this replaced credited whoever registered an address.
    assert.match(sweeper, /\.from\('buyer_order_links'\)/);
    assert.match(sweeper, /\.eq\('order_id', order\.id\)/, 'ownership is looked up by the order itself');
    assert.doesNotMatch(sweeper, /buyer_store_customers|store_customers|customer_email|ilike/, 'no email or store-customer matching may decide who is credited');
    assert.match(award,/buyer_order_links[\s\S]*FOR SHARE/,'the transaction rechecks and locks the live owner');
});

test('only PAID orders on ACTIVE programmes are scanned', () => {
    assert.match(sweeper,/\.rpc\('pending_loyalty_earn_orders_v1'/,'the actual worker uses canonical discovery');
    assert.match(pending,/o\.payment_status='paid'/);
    assert.match(pending,/loyalty_programs p ON p\.site_id=o\.site_id AND p\.is_active/);
    assert.ok(pending.indexOf("entry_type='earned'")<pending.indexOf('LIMIT p_limit'),'completed work is excluded before the batch limit');
    assert.doesNotMatch(sweeper,/\.from\('orders'\)/,'no parallel limit-before-filter discovery');
});

test('discovery and posting share the existing earn calculation without deciding point revaluation',()=>{
    assert.match(pending,/public\.loyalty_points_for_order_total_v1\(o\.total,p\.earn_rate_bps\)>0/);
    assert.match(award,/public\.loyalty_points_for_order_total_v1\(v_order_total,v_program\.earn_rate_bps\)/);
    assert.match(latestFunction('loyalty_points_for_order_total_v1'),/floor\(coalesce\(p_total,0\)\*coalesce\(p_earn_rate_bps,0\)\/10000\.0\)::bigint/);
    assert.match(award,/'point_value_minor', v_program.point_value_minor/,'value at earn metadata remains recorded');
});
