// APPID-P4a — migration 257 on real Postgres: buyer email codes, password recovery and the session
// epoch behind "sign out everywhere".
//
// What is asserted is what an attacker would try: the stored row never contains the code, a code
// works once, guessing stops at five, an expired or superseded code is dead, a code sent to an old
// address proves nothing about a new one, a reset ends every session, and no API or tenant role can
// call any of it.
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
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_p4a_email_challenges';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable ? false : `refusing to recreate the shared database '${SHARED_DATABASE}'`;

const MIGRATION = 'database/supabase/migrations/257_buyer_email_challenges.sql';
const ROLLBACK = 'database/supabase/rollback/257_buyer_email_challenges.rollback.sql';
const A = '22222222-2222-4222-8222-0000000000a1';
const OFF = '22222222-2222-4222-8222-0000000000a2';
const BCRYPT_LIKE = '$2a$10$abcdefghijklmnopqrstuuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012';

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
const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const lastLine = (out) => out.split('\n').map((l) => l.trim()).filter(Boolean).at(-1) || '';
const strip = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (rel) => psql(strip(readFileSync(join(repoRoot, rel), 'utf8')));
const rpc = (sql) => JSON.parse(lastLine(psql(`SET ROLE service_role; SELECT (${sql})::text;`)));
const start = (buyer, purpose) => rpc(`public.start_buyer_email_challenge(${q(buyer)}::uuid, ${q(purpose)})`);
const consumeSql = (buyer, purpose, code, hash = null) =>
    `public.consume_buyer_email_challenge(${q(buyer)}::uuid, ${q(purpose)}, ${q(code)}, ${hash === null ? 'NULL' : q(hash)})`;
const consume = (buyer, purpose, code, hash = null) => rpc(consumeSql(buyer, purpose, code, hash));
const verify = (code) => consume(A, 'verify_email', code);
// A second, concurrent session: psql in its own process, so its row lock is real.
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
const wrong = (code) => String((Number(code) + 1) % 1000000).padStart(6, '0');
const account = (field) => lastLine(psql(`SELECT ${field} FROM public.buyer_accounts WHERE id = ${q(A)}::uuid;`));
const resetRateWindow = () => psql(`UPDATE public.buyer_email_challenges SET created_at = now() - interval '2 hours';`);

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
    psql(`INSERT INTO public.buyer_accounts (id, email, email_verified, status) VALUES
            (${q(A)}::uuid, 'a@example.com', false, 'active'),
            (${q(OFF)}::uuid, 'off@example.com', false, 'disabled');`);
});

test('a verification code is returned once, stored only as a salted hash, and works exactly once', { skip }, () => {
    const started = start(A, 'verify_email');
    assert.equal(started.outcome, 'started');
    assert.match(started.code, /^\d{6}$/);
    assert.equal(started.email, 'a@example.com');
    const row = psql(`SELECT row_to_json(c)::text FROM public.buyer_email_challenges c WHERE id = ${q(started.challenge_id)}::uuid;`);
    assert.ok(!row.includes(`"${started.code}"`) && !row.includes(`:${started.code}`), 'the stored row must not contain the code');

    assert.deepEqual(verify(wrong(started.code)), { outcome: 'invalid' });
    const verified = verify(started.code);
    assert.equal(verified.outcome, 'verified');
    assert.equal(account(`email_verified || '|' || (email_verified_at IS NOT NULL)`), 'true|true');
    assert.deepEqual(verify(started.code), { outcome: 'invalid' }, 'a code must not work twice');
    assert.equal(lastLine(psql(`SELECT count(*) FROM public.audit_logs WHERE action = 'buyer_email.verified' AND actor_id = ${q(A)}::uuid;`)), '1');
    psql(`UPDATE public.buyer_accounts SET email_verified = false WHERE id = ${q(A)}::uuid;`);
});

test('guessing stops at five: the right code after that is refused', { skip }, () => {
    const started = start(A, 'verify_email');
    for (let i = 0; i < 4; i += 1) assert.equal(verify(wrong(started.code)).outcome, 'invalid');
    assert.equal(verify(wrong(started.code)).outcome, 'locked');
    assert.equal(verify(started.code).outcome, 'invalid');
    assert.equal(account('email_verified'), 'f');
});

test('an expired code is refused, and a newer challenge supersedes an older one', { skip }, () => {
    const old = start(A, 'verify_email');
    psql(`UPDATE public.buyer_email_challenges SET expires_at = now() - interval '1 minute' WHERE id = ${q(old.challenge_id)}::uuid;`);
    assert.equal(verify(old.code).outcome, 'expired');

    const first = start(A, 'verify_email');
    const second = start(A, 'verify_email');
    if (first.code !== second.code) {
        assert.equal(verify(first.code).outcome, 'invalid', 'a superseded code must be dead');
    }
    assert.equal(lastLine(psql(`SELECT outcome FROM public.buyer_email_challenges WHERE id = ${q(first.challenge_id)}::uuid;`)), 'superseded');
    assert.equal(verify(second.code).outcome, 'verified');
    psql(`UPDATE public.buyer_accounts SET email_verified = false WHERE id = ${q(A)}::uuid;`);
    resetRateWindow();
});

test('at most five challenges per buyer and purpose per hour', { skip }, () => {
    for (let i = 0; i < 5; i += 1) assert.equal(start(A, 'verify_email').outcome, 'started');
    assert.deepEqual(start(A, 'verify_email'), { outcome: 'rate_limited' });
    assert.equal(start(A, 'reset_password').outcome, 'started', 'the limit is per purpose');
    resetRateWindow();
});

test('a code sent to an old address proves nothing once the address changes', { skip }, () => {
    const started = start(A, 'verify_email');
    psql(`UPDATE public.buyer_accounts SET email = 'a2@example.com' WHERE id = ${q(A)}::uuid;`);
    assert.equal(verify(started.code).outcome, 'address_changed');
    assert.equal(account('email_verified'), 'f');
    psql(`UPDATE public.buyer_accounts SET email = 'a@example.com' WHERE id = ${q(A)}::uuid;`);
    resetRateWindow();
});

test('a reset needs a new hash, sets it, verifies the address, and ends every session', { skip }, () => {
    const epochBefore = Number(account('session_epoch'));
    const started = start(A, 'reset_password');
    assert.match(psqlError(`SET ROLE service_role; SELECT ${consumeSql(A, 'reset_password', started.code)};`) || '', /new password hash is required/);
    assert.equal(verify(started.code).outcome, 'invalid', 'a reset code is not a verification code');
    const reset = consume(A, 'reset_password', started.code, BCRYPT_LIKE);
    assert.equal(reset.outcome, 'password_reset');
    assert.equal(reset.session_epoch, epochBefore + 1);
    assert.equal(account(`password_hash = ${q(BCRYPT_LIKE)}`), 't');
    assert.equal(account('email_verified'), 't');
    resetRateWindow();
});

test('sign out everywhere advances the epoch; a disabled buyer gets no code', { skip }, () => {
    const before = Number(account('session_epoch'));
    assert.deepEqual(rpc(`public.revoke_buyer_sessions(${q(A)}::uuid)`), { outcome: 'revoked', session_epoch: before + 1 });
    assert.equal(lastLine(psql(`SELECT count(*) FROM public.audit_logs WHERE action = 'buyer_sessions.revoked' AND actor_id = ${q(A)}::uuid;`)), '1');
    assert.deepEqual(start(OFF, 'verify_email'), { outcome: 'buyer_unavailable' });
});

test('two concurrent requests with the right code: exactly one succeeds', { skip }, async () => {
    const started = start(A, 'verify_email');
    // Session one takes the row lock and holds its transaction open; session two starts while it is
    // held, must wait for it, and must then find the challenge already consumed.
    const first = psqlAsync(`BEGIN; SET LOCAL ROLE service_role; SELECT (${consumeSql(A, 'verify_email', started.code)})::text; SELECT pg_sleep(1.5); COMMIT;`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const second = psqlAsync(`SET ROLE service_role; SELECT (${consumeSql(A, 'verify_email', started.code)})::text;`);
    const outcomes = (await Promise.all([first, second])).map((out) => JSON.parse(out.split('\n').find((l) => l.startsWith('{'))).outcome);
    assert.deepEqual(outcomes, ['verified', 'invalid']);
    assert.equal(lastLine(psql(`SELECT count(*) FROM public.audit_logs WHERE action = 'buyer_email.verified' AND actor_id = ${q(A)}::uuid;`)), '3');
    psql(`UPDATE public.buyer_accounts SET email_verified = false WHERE id = ${q(A)}::uuid;`);
    resetRateWindow();
});

test('no API or tenant role can read the challenges or call the functions', { skip }, () => {
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.match(psqlError(`BEGIN; SET LOCAL ROLE ${role}; SELECT count(*) FROM public.buyer_email_challenges; COMMIT;`) || 'READ SUCCEEDED', /permission denied/, role);
        for (const call of [
            `public.start_buyer_email_challenge(${q(A)}::uuid, 'verify_email')`,
            consumeSql(A, 'verify_email', '000000'),
            `public.revoke_buyer_sessions(${q(A)}::uuid)`,
        ]) {
            assert.match(psqlError(`BEGIN; SET LOCAL ROLE ${role}; SELECT ${call}; COMMIT;`) || 'CALL SUCCEEDED', /permission denied/, `${role}: ${call}`);
        }
    }
});

test('the rollback removes the challenges and the epoch, and the migration re-applies', { skip }, () => {
    applySqlFile(ROLLBACK);
    assert.equal(lastLine(psql(`SELECT to_regclass('public.buyer_email_challenges') IS NULL;`)), 't');
    assert.equal(lastLine(psql(`SELECT count(*) FROM information_schema.columns WHERE table_name = 'buyer_accounts' AND column_name = 'session_epoch';`)), '0');
    applySqlFile(MIGRATION);
    assert.equal(start(A, 'verify_email').outcome, 'started');
});
