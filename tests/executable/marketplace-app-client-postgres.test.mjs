// APPID-P4d — migration 259 on real Postgres: the marketplace app as a second first-party client, and the
// Firebase-uid bridge.
//
// What is asserted: an app code carries no site and returns only to the app's one callback, while every
// 258 rule for the storefront still holds (a replaced function silently drops whatever its new body
// omits); a Firebase uid links only to a buyer whose VERIFIED address equals the Firebase account's, a
// uid is never re-pointed, and nothing but service_role can touch the bridge; and the rollback restores
// 258's issue function byte for byte.
//
// DESTRUCTIVE: recreates its own database and replays every migration. Refuses the shared database.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_p4d_marketplace_app';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable ? false : `refusing to recreate the shared database '${SHARED_DATABASE}'`;

const MIGRATION = 'database/supabase/migrations/259_marketplace_app_client_and_firebase_links.sql';
const ROLLBACK = 'database/supabase/rollback/259_marketplace_app_client_and_firebase_links.rollback.sql';
const BUYER = '55555555-5555-4555-8555-0000000000b1';
const OTHER = '55555555-5555-4555-8555-0000000000b2';
const UNVERIFIED = '55555555-5555-4555-8555-0000000000b3';
const SITE = '55555555-5555-4555-8555-0000000000c1';
const APP = 'letbuyy-marketplace-app';
const APP_REDIRECT = 'com.letbuyy.letbuyy:/oauth/callback';
const STOREFRONT_REDIRECT = 'https://store-one.letbuyy.com/api/buyer-auth/callback';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
let issueSourceAfter258 = null;

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
const q = (v) => (v === null ? 'NULL' : `'${String(v).replaceAll("'", "''")}'`);
const lastLine = (out) => out.split('\n').map((l) => l.trim()).filter(Boolean).at(-1) || '';
const strip = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (rel) => psql(strip(readFileSync(join(repoRoot, rel), 'utf8')));
const rpc = (sql) => JSON.parse(lastLine(psql(`SET ROLE service_role; SELECT (${sql})::text;`)));
const issue = ({ buyer = BUYER, client = APP, redirect = APP_REDIRECT, site = null } = {}) => rpc(
    `public.issue_buyer_authorization_code(${q(buyer)}::uuid, ${q(client)}, ${q(redirect)}, ${site === null ? 'NULL' : `${q(site)}::uuid`}, ${q(CHALLENGE)})`,
);
const redeem = (code, { client = APP, redirect = APP_REDIRECT } = {}) => rpc(
    `public.redeem_buyer_authorization_code(${q(code)}, ${q(VERIFIER)}, ${q(client)}, ${q(redirect)})`,
);
const link = (buyer, uid, email, project = 'letbuy-y') => rpc(
    `public.link_buyer_firebase_uid(${q(buyer)}::uuid, ${q(uid)}, ${q(project)}, ${q(email)})`,
);
const issueSource = () => lastLine(psql(`SELECT md5(prosrc) FROM pg_proc WHERE proname = 'issue_buyer_authorization_code';`));

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
    for (const name of migrations) {
        applySqlFile(`database/supabase/migrations/${name}`);
        if (name.startsWith('258_')) issueSourceAfter258 = issueSource();
    }
    psql(`INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
            VALUES (${q(SITE)}::uuid, 'Store One', 'Store One', 'store', 'store-one', true);
          INSERT INTO public.buyer_accounts (id, email, email_verified, status) VALUES
            (${q(BUYER)}::uuid, 'asha@example.com', true, 'active'),
            (${q(OTHER)}::uuid, 'ravi@example.com', true, 'active'),
            (${q(UNVERIFIED)}::uuid, 'meena@example.com', false, 'active');`);
});

test('an app code carries no site, returns only to the app, and redeems to the whole platform', { skip }, () => {
    const issued = issue();
    assert.equal(issued.outcome, 'issued');
    assert.deepEqual(redeem(issued.code), { outcome: 'redeemed', buyer_account_id: BUYER, site_id: null, client_id: APP, session_epoch: 1 });
    for (const [label, input] of [
        ['a site', { site: SITE }],
        ['another callback', { redirect: 'com.letbuyy.letbuyy:/elsewhere' }],
        ['a web callback', { redirect: STOREFRONT_REDIRECT }],
        ['another scheme', { redirect: 'com.attacker.app:/oauth/callback' }],
    ]) {
        assert.deepEqual(issue(input), { outcome: 'invalid_request' }, `an app code with ${label}`);
    }
});

test('every 258 rule for the storefront still holds after the function was replaced', { skip }, () => {
    const storefront = issue({ client: 'letbuyy-storefront', redirect: STOREFRONT_REDIRECT, site: SITE });
    assert.equal(storefront.outcome, 'issued');
    assert.equal(redeem(storefront.code, { client: 'letbuyy-storefront', redirect: STOREFRONT_REDIRECT }).site_id, SITE);
    assert.deepEqual(issue({ client: 'letbuyy-storefront', redirect: STOREFRONT_REDIRECT, site: null }), { outcome: 'invalid_request' }, 'a storefront code needs a site');
    assert.deepEqual(issue({ client: 'letbuyy-storefront', redirect: STOREFRONT_REDIRECT, site: '55555555-5555-4555-8555-0000000000ff' }), { outcome: 'invalid_request' }, 'a live site');
    assert.deepEqual(issue({ client: 'letbuyy-admin' }), { outcome: 'invalid_request' }, 'an unknown client');
    assert.deepEqual(issue({ redirect: '' }), { outcome: 'invalid_request' }, 'an empty callback');
    psql(`UPDATE public.buyer_accounts SET status = 'disabled' WHERE id = ${q(OTHER)}::uuid;`);
    assert.deepEqual(issue({ buyer: OTHER }), { outcome: 'buyer_unavailable' });
    psql(`UPDATE public.buyer_accounts SET status = 'active' WHERE id = ${q(OTHER)}::uuid;`);
});

test('the table itself refuses an app code with a site, or a storefront code without one', { skip }, () => {
    const insert = (client, site) => psqlError(`SET ROLE service_role; INSERT INTO public.buyer_authorization_codes
        (code_hash, buyer_account_id, client_id, redirect_uri, site_id, code_challenge, session_epoch, expires_at)
        VALUES (md5(random()::text), ${q(BUYER)}::uuid, ${q(client)}, 'x', ${site === null ? 'NULL' : `${q(site)}::uuid`}, ${q(CHALLENGE)}, 1, now() + interval '1 minute');`);
    assert.match(insert(APP, SITE) || 'INSERT SUCCEEDED', /buyer_authorization_codes_site_check/);
    assert.match(insert('letbuyy-storefront', null) || 'INSERT SUCCEEDED', /buyer_authorization_codes_site_check/);
});

test('a Firebase uid links only to a buyer whose verified address is the Firebase account\'s', { skip }, () => {
    assert.deepEqual(link(UNVERIFIED, 'uid-meena', 'meena@example.com'), { outcome: 'unverified' }, 'an unverified buyer address proves nothing');
    assert.deepEqual(link(BUYER, 'uid-asha', 'someone-else@example.com'), { outcome: 'email_mismatch' });
    assert.deepEqual(link(BUYER, 'uid-asha', '  Asha@Example.com '), { outcome: 'linked' }, 'the same address, however it is cased');
    assert.deepEqual(link(BUYER, 'uid-asha', 'asha@example.com'), { outcome: 'already_linked' });
    assert.equal(lastLine(psql(`SELECT count(*) FROM public.audit_logs WHERE action = 'buyer_firebase_link.email_mismatch';`)), '1');
});

test('a uid is never re-pointed to another buyer, and a disabled buyer links nothing', { skip }, () => {
    // Addresses are unique, so the way a second buyer reaches the same Firebase account: the first buyer
    // moves to a new address, and someone else later verifies the old one.
    // 255's trigger un-verifies an address whenever it changes, so the new owner proves it afterwards.
    psql(`UPDATE public.buyer_accounts SET email = 'asha.new@example.com' WHERE id = ${q(BUYER)}::uuid;
          UPDATE public.buyer_accounts SET email = 'asha@example.com' WHERE id = ${q(OTHER)}::uuid;
          UPDATE public.buyer_accounts SET email_verified = true WHERE id = ${q(OTHER)}::uuid;`);
    assert.deepEqual(link(OTHER, 'uid-asha', 'asha@example.com'), { outcome: 'conflict' });
    assert.equal(lastLine(psql(`SELECT buyer_account_id FROM public.buyer_firebase_links WHERE firebase_uid = 'uid-asha';`)), BUYER, 'the first verified owner keeps it');
    assert.equal(lastLine(psql(`SELECT count(*) FROM public.audit_logs WHERE action = 'buyer_firebase_link.conflict';`)), '1');
    psql(`UPDATE public.buyer_accounts SET email = 'ravi@example.com', status = 'disabled' WHERE id = ${q(OTHER)}::uuid;
          UPDATE public.buyer_accounts SET email = 'asha@example.com' WHERE id = ${q(BUYER)}::uuid;`);
    assert.deepEqual(link(OTHER, 'uid-ravi', 'ravi@example.com'), { outcome: 'buyer_unavailable' });
    psql(`UPDATE public.buyer_accounts SET status = 'active' WHERE id = ${q(OTHER)}::uuid;`);
});

test('no API or tenant role can read the bridge or call its function', { skip }, () => {
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.match(psqlError(`BEGIN; SET LOCAL ROLE ${role}; SELECT count(*) FROM public.buyer_firebase_links; COMMIT;`) || 'READ SUCCEEDED', /permission denied/, role);
        assert.match(
            psqlError(`BEGIN; SET LOCAL ROLE ${role}; SELECT public.link_buyer_firebase_uid(${q(BUYER)}::uuid, 'x', 'letbuy-y', 'asha@example.com'); COMMIT;`) || 'CALL SUCCEEDED',
            /permission denied/,
            role,
        );
    }
});

test('the rollback restores 258 byte for byte, and 259 re-applies', { skip }, () => {
    assert.ok(issueSourceAfter258, 'captured after 258');
    assert.notEqual(issueSource(), issueSourceAfter258, '259 changed the function');
    applySqlFile(ROLLBACK);
    assert.equal(issueSource(), issueSourceAfter258, 'the rollback restores 258\'s body exactly');
    assert.equal(lastLine(psql(`SELECT to_regclass('public.buyer_firebase_links') IS NULL;`)), 't');
    assert.deepEqual(issue(), { outcome: 'invalid_request' }, 'no app client after rollback');
    applySqlFile(MIGRATION);
    assert.equal(issue().outcome, 'issued');
});
