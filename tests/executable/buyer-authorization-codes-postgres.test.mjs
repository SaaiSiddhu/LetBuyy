// APPID-P4b — migration 258 on real Postgres: first-party authorization codes for storefront sign-in.
//
// What is asserted is what an attacker holding a code, or part of a flow, would try: the stored row
// never contains the code, a code works once and only with the verifier whose S256 digest is its
// challenge (checked against RFC 7636's own test vector, not against this implementation), the exact
// client and redirect, and before it expires; a refused attempt burns the code; a code outlives
// neither a sign-out-everywhere nor a disabled account; two redemptions racing cannot both win; and no
// API or tenant role can touch any of it.
//
// DESTRUCTIVE: recreates its own database and replays every migration. Refuses the shared database.

import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_p4b_authorization_codes';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable ? false : `refusing to recreate the shared database '${SHARED_DATABASE}'`;

const MIGRATION = 'database/supabase/migrations/258_buyer_authorization_codes.sql';
const ROLLBACK = 'database/supabase/rollback/258_buyer_authorization_codes.rollback.sql';
const BUYER = '33333333-3333-4333-8333-0000000000b1';
const SITE = '33333333-3333-4333-8333-0000000000c1';
const CLIENT = 'letbuyy-storefront';
const REDIRECT = 'https://store-one.letbuyy.com/api/buyer-auth/callback';
// RFC 7636, Appendix B.
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: `SET client_min_messages = warning;\n${sql}`, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
}
function psqlError(sql) {
    try { psql(sql); return null; } catch (error) { return `${error.stderr || ''}${error.stdout || ''}`; }
}
function psqlAsync(sql) {
    return new Promise((resolve, reject) => {
        const child = execFile(
            'docker',
            ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
            { encoding: 'utf8' },
            (error, stdout) => (error ? reject(error) : resolve(stdout.trim())),
        );
        child.stdin.end(`SET client_min_messages = warning;\n${sql}`);
    });
}
const q = (v) => (v === null ? 'NULL' : `'${String(v).replaceAll("'", "''")}'`);
const lastLine = (out) => out.split('\n').map((l) => l.trim()).filter(Boolean).at(-1) || '';
const strip = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (rel) => psql(strip(readFileSync(join(repoRoot, rel), 'utf8')));
const rpc = (sql) => JSON.parse(lastLine(psql(`SET ROLE service_role; SELECT (${sql})::text;`)));
const issueSql = (over = {}) => {
    const a = { buyer: BUYER, client: CLIENT, redirect: REDIRECT, site: SITE, challenge: CHALLENGE, ...over };
    return `public.issue_buyer_authorization_code(${q(a.buyer)}::uuid, ${q(a.client)}, ${q(a.redirect)}, ${a.site === null ? 'NULL' : `${q(a.site)}::uuid`}, ${q(a.challenge)})`;
};
const issue = (over) => rpc(issueSql(over));
const redeemSql = (code, over = {}) => {
    const a = { verifier: VERIFIER, client: CLIENT, redirect: REDIRECT, ...over };
    return `public.redeem_buyer_authorization_code(${q(code)}, ${q(a.verifier)}, ${q(a.client)}, ${q(a.redirect)})`;
};
const redeem = (code, over) => rpc(redeemSql(code, over));
const refusals = (reason) => Number(lastLine(psql(
    `SELECT count(*) FROM public.audit_logs WHERE action = 'buyer_authorization_code.refused' AND metadata->>'reason' = ${q(reason)};`,
)));

after(() => {
    if (!runnable) return;
    try { psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres'); } catch { /* cleanup only */ }
});

before(() => {
    if (!runnable) return;
    psql(`DROP DATABASE IF EXISTS "${databaseName}";`, 'postgres');
    psql(`CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
    const migrations = readdirSync(join(repoRoot, 'database/supabase/migrations')).filter((n) => n.endsWith('.sql'))
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
    for (const name of migrations) applySqlFile(`database/supabase/migrations/${name}`);
    psql(`INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
            VALUES (${q(SITE)}::uuid, 'Store One', 'Store One', 'store', 'store-one', true);
          INSERT INTO public.buyer_accounts (id, email, email_verified, status)
            VALUES (${q(BUYER)}::uuid, 'shopper@example.com', true, 'active');`);
});

test('a code is 43 url-safe characters, returned once, stored only as a hash', { skip }, () => {
    const issued = issue();
    assert.equal(issued.outcome, 'issued');
    assert.match(issued.code, /^[A-Za-z0-9_-]{43}$/);
    const row = psql(`SELECT row_to_json(c)::text FROM public.buyer_authorization_codes c ORDER BY created_at DESC LIMIT 1;`);
    assert.ok(!row.includes(issued.code), 'the stored row must not contain the code');
});

test('the RFC 7636 verifier redeems once, for the right buyer, site and epoch', { skip }, () => {
    const { code } = issue();
    const redeemed = redeem(code);
    assert.deepEqual(redeemed, { outcome: 'redeemed', buyer_account_id: BUYER, site_id: SITE, client_id: CLIENT, session_epoch: 1 });
    assert.deepEqual(redeem(code), { outcome: 'invalid_grant' }, 'a code must not work twice');
    assert.equal(refusals('already_redeemed'), 1);
});

test('a wrong verifier, client or redirect is refused, and burns the code', { skip }, () => {
    for (const [over, reason] of [
        [{ verifier: 'x'.repeat(43) }, 'pkce_mismatch'],
        [{ verifier: 'short' }, 'pkce_mismatch'],
        [{ client: 'someone-else' }, 'client_or_redirect_mismatch'],
        [{ redirect: 'https://store-one.letbuyy.com/api/buyer-auth/callback?x=1' }, 'client_or_redirect_mismatch'],
        [{ redirect: 'https://evil.example/api/buyer-auth/callback' }, 'client_or_redirect_mismatch'],
    ]) {
        const { code } = issue();
        const before = refusals(reason);
        assert.deepEqual(redeem(code, over), { outcome: 'invalid_grant' }, JSON.stringify(over));
        assert.equal(refusals(reason), before + 1, `${reason} is recorded`);
        assert.deepEqual(redeem(code), { outcome: 'invalid_grant' }, `after ${reason}, even the right verifier must fail`);
    }
});

test('an expired code is refused', { skip }, () => {
    const { code } = issue();
    psql(`UPDATE public.buyer_authorization_codes SET expires_at = now() - interval '1 second' WHERE redeemed_at IS NULL;`);
    assert.deepEqual(redeem(code), { outcome: 'invalid_grant' });
    assert.ok(refusals('expired') >= 1);
});

test('a code does not survive sign-out-everywhere between issue and redemption', { skip }, () => {
    const { code } = issue();
    rpc(`public.revoke_buyer_sessions(${q(BUYER)}::uuid)`);
    assert.deepEqual(redeem(code), { outcome: 'invalid_grant' });
    assert.equal(refusals('session_ended'), 1);
    const fresh = issue();
    assert.equal(redeem(fresh.code).session_epoch, 2, 'a code issued after carries the new epoch');
});

test('a disabled buyer gets no code, and a code issued before disabling is refused', { skip }, () => {
    const { code } = issue();
    psql(`UPDATE public.buyer_accounts SET status = 'disabled' WHERE id = ${q(BUYER)}::uuid;`);
    assert.deepEqual(issue(), { outcome: 'buyer_unavailable' });
    assert.deepEqual(redeem(code), { outcome: 'invalid_grant' });
    psql(`UPDATE public.buyer_accounts SET status = 'active' WHERE id = ${q(BUYER)}::uuid;`);
});

test('issue refuses an unknown client, a bad challenge, and a missing or deleted site', { skip }, () => {
    assert.deepEqual(issue({ client: 'letbuyy-admin' }), { outcome: 'invalid_request' });
    assert.deepEqual(issue({ challenge: 'plain-text-challenge' }), { outcome: 'invalid_request' });
    assert.deepEqual(issue({ site: null }), { outcome: 'invalid_request' });
    assert.deepEqual(issue({ site: '33333333-3333-4333-8333-0000000000ff' }), { outcome: 'invalid_request' });
    psql(`INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
            VALUES ('33333333-3333-4333-8333-0000000000c2'::uuid, 'Gone', 'Gone', 'store', 'gone', true);
          UPDATE public.sites SET deleted_at = now() WHERE id = '33333333-3333-4333-8333-0000000000c2'::uuid;`);
    assert.deepEqual(issue({ site: '33333333-3333-4333-8333-0000000000c2' }), { outcome: 'invalid_request' }, 'a deleted site');
});

test('two concurrent redemptions of one code: exactly one wins', { skip }, async () => {
    const { code } = issue();
    const first = psqlAsync(`BEGIN; SET LOCAL ROLE service_role; SELECT (${redeemSql(code)})::text; SELECT pg_sleep(1.5); COMMIT;`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const second = psqlAsync(`SET ROLE service_role; SELECT (${redeemSql(code)})::text;`);
    const outcomes = (await Promise.all([first, second])).map((out) => JSON.parse(out.split('\n').find((l) => l.startsWith('{'))).outcome);
    assert.deepEqual(outcomes, ['redeemed', 'invalid_grant']);
});

test('no API or tenant role can read the codes or call the functions', { skip }, () => {
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.match(psqlError(`BEGIN; SET LOCAL ROLE ${role}; SELECT count(*) FROM public.buyer_authorization_codes; COMMIT;`) || 'READ SUCCEEDED', /permission denied/, role);
        for (const call of [issueSql(), redeemSql('A'.repeat(43))]) {
            assert.match(psqlError(`BEGIN; SET LOCAL ROLE ${role}; SELECT ${call}; COMMIT;`) || 'CALL SUCCEEDED', /permission denied/, `${role}: ${call.slice(0, 50)}`);
        }
    }
});

test('the rollback removes the codes, and the migration re-applies', { skip }, () => {
    applySqlFile(ROLLBACK);
    assert.equal(lastLine(psql(`SELECT to_regclass('public.buyer_authorization_codes') IS NULL;`)), 't');
    assert.equal(lastLine(psql(`SELECT count(*) FROM pg_proc WHERE proname IN ('issue_buyer_authorization_code', 'redeem_buyer_authorization_code');`)), '0');
    applySqlFile(MIGRATION);
    assert.equal(redeem(issue().code).outcome, 'redeemed');
});
