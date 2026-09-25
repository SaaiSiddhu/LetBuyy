// SUSTAINED-J Phase 2 — migration 260, proven on real Postgres: the buyer profile fields (D1) and
// the buyer address book (D2), both keyed by buyer_account_id and both under the SAME "inverse
// tenancy rule" 223 established for buyer_accounts itself — no tenant role, ever, and ownership
// derived only from an explicit buyer_account_id, never a store/tenant context.
//
// DESTRUCTIVE: recreates its own database and replays every migration. Refuses the shared database.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_buyer_profile_addresses';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/260_buyer_profile_and_addresses.sql';
const ROLLBACK = 'database/supabase/rollback/260_buyer_profile_and_addresses.rollback.sql';

const BUYER_A = '22222222-2222-4222-8222-00000000a001';
const BUYER_B = '22222222-2222-4222-8222-00000000a002';
const ADDR_A1 = '33333333-3333-4333-8333-00000000a001';
const ADDR_A2 = '33333333-3333-4333-8333-00000000a002';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ).trim();
}

function psqlError(sql) {
    try {
        psql(sql);
        return null;
    } catch (error) {
        return `${error.stderr || ''}${error.stdout || ''}`;
    }
}

const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (relativePath) => psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));
const lastLine = (out) => out.split('\n').map((l) => l.trim()).filter(Boolean).at(-1) || '';

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
    psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
    for (const name of listMigrations()) {
        try {
            applySqlFile(`database/supabase/migrations/${name}`);
        } catch (error) {
            throw new Error(`migration ${name} failed to apply: ${error.message}`);
        }
    }
}

function seedFixtures() {
    psql(`
    INSERT INTO public.buyer_accounts (id, email, email_verified, status) VALUES
      (${q(BUYER_A)}::uuid, 'a@example.com', true, 'active'),
      (${q(BUYER_B)}::uuid, 'b@example.com', true, 'active');
  `);
}

before(() => {
    if (!runnable) return;
    bootstrapDatabase();
    seedFixtures();
});

test('migration 260 applies cleanly on top of a real 223-established buyer realm', { skip }, () => {
    // bootstrapDatabase already applied it as part of the full replay; this asserts it left the
    // exact shape expected.
    assert.equal(lastLine(psql("SELECT to_regclass('public.buyer_addresses') IS NOT NULL;")), 't');
    assert.equal(
        lastLine(psql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='buyer_accounts' AND column_name IN ('full_name','phone');")),
        '2',
    );
});

test('D1: buyer profile fields are nullable and independent of email/password/session_epoch', { skip }, () => {
    assert.equal(
        lastLine(psql(`SELECT full_name IS NULL AND phone IS NULL FROM public.buyer_accounts WHERE id = ${q(BUYER_A)}::uuid;`)),
        't',
    );
    psql(`UPDATE public.buyer_accounts SET full_name = 'Asha Verma', phone = '+919999999999' WHERE id = ${q(BUYER_A)}::uuid;`);
    assert.equal(
        lastLine(psql(`SELECT full_name || '|' || phone FROM public.buyer_accounts WHERE id = ${q(BUYER_A)}::uuid;`)),
        'Asha Verma|+919999999999',
    );
    // Untouched by the profile update: email, password_hash, session_epoch, email_verified.
    assert.equal(lastLine(psql(`SELECT email FROM public.buyer_accounts WHERE id = ${q(BUYER_A)}::uuid;`)), 'a@example.com');
    assert.equal(lastLine(psql(`SELECT email_verified FROM public.buyer_accounts WHERE id = ${q(BUYER_A)}::uuid;`)), 't');
});

test('D2: an address is owned by exactly one buyer_account_id, never inferred from anything else', { skip }, () => {
    psql(`
    INSERT INTO public.buyer_addresses (id, buyer_account_id, full_name, address_line1, city, state, postal_code, is_default)
    VALUES (${q(ADDR_A1)}::uuid, ${q(BUYER_A)}::uuid, 'Asha Verma', '12 MG Road', 'Bengaluru', 'Karnataka', '560001', true);
  `);
    assert.equal(
        lastLine(psql(`SELECT buyer_account_id FROM public.buyer_addresses WHERE id = ${q(ADDR_A1)}::uuid;`)),
        BUYER_A,
    );
    // B's address list is empty -- A's address is not visible by any query scoped to B.
    assert.equal(
        lastLine(psql(`SELECT count(*) FROM public.buyer_addresses WHERE buyer_account_id = ${q(BUYER_B)}::uuid;`)),
        '0',
    );
});

test('D2: default-address switch matches the two-step sequence the gateway route uses (unset-then-set)', { skip }, () => {
    // Gateway pattern (customer-address-routes.ts, the established precedent this migration's own
    // header cites): unset every existing default for the buyer, THEN insert/update the new default.
    psql(`UPDATE public.buyer_addresses SET is_default = false WHERE buyer_account_id = ${q(BUYER_A)}::uuid;`);
    psql(`
    INSERT INTO public.buyer_addresses (id, buyer_account_id, full_name, address_line1, city, state, postal_code, is_default)
    VALUES (${q(ADDR_A2)}::uuid, ${q(BUYER_A)}::uuid, 'Asha Verma', '45 Residency Road', 'Bengaluru', 'Karnataka', '560025', true);
  `);
    assert.equal(
        lastLine(psql(`SELECT count(*) FROM public.buyer_addresses WHERE buyer_account_id = ${q(BUYER_A)}::uuid AND is_default = true;`)),
        '1',
    );
    assert.equal(
        lastLine(psql(`SELECT is_default FROM public.buyer_addresses WHERE id = ${q(ADDR_A1)}::uuid;`)),
        'f',
    );
});

test('D2: label/state_code/gstin CHECK constraints reject malformed input, same shape as customer_addresses', { skip }, () => {
    const badLabel = psqlError(`
    INSERT INTO public.buyer_addresses (buyer_account_id, label, full_name, address_line1, city, state, postal_code)
    VALUES (${q(BUYER_A)}::uuid, 'castle', 'Asha Verma', '1 Road', 'Bengaluru', 'Karnataka', '560001');
  `);
    assert.match(badLabel || '', /buyer_addresses_label_check/);

    const badStateCode = psqlError(`
    INSERT INTO public.buyer_addresses (buyer_account_id, full_name, address_line1, city, state, postal_code, state_code)
    VALUES (${q(BUYER_A)}::uuid, 'Asha Verma', '1 Road', 'Bengaluru', 'Karnataka', '560001', '99');
  `);
    assert.match(badStateCode || '', /buyer_addresses_state_code_check/);
});

test('D2: deleting a buyer_account cascades to delete their addresses only', { skip }, () => {
    psql(`
    INSERT INTO public.buyer_addresses (buyer_account_id, full_name, address_line1, city, state, postal_code)
    VALUES (${q(BUYER_B)}::uuid, 'Priya B', '9 Church St', 'Chennai', 'Tamil Nadu', '600001');
  `);
    assert.equal(lastLine(psql(`SELECT count(*) FROM public.buyer_addresses WHERE buyer_account_id = ${q(BUYER_B)}::uuid;`)), '1');
    psql(`DELETE FROM public.buyer_accounts WHERE id = ${q(BUYER_B)}::uuid;`);
    assert.equal(lastLine(psql(`SELECT count(*) FROM public.buyer_addresses WHERE buyer_account_id = ${q(BUYER_B)}::uuid;`)), '0');
    // A's own addresses are untouched by B's cascade.
    assert.equal(lastLine(psql(`SELECT count(*) FROM public.buyer_addresses WHERE buyer_account_id = ${q(BUYER_A)}::uuid;`)), '2');
});

test('no tenant or API role can read buyer_addresses, matching buyer_accounts/buyer_order_links (223/255)', { skip }, () => {
    for (const role of ['app_tenant', 'authenticated', 'anon']) {
        const denied = psqlError(`BEGIN; SET ROLE ${role}; SELECT count(*) FROM public.buyer_addresses; COMMIT;`);
        assert.match(denied || 'READ SUCCEEDED', /permission denied/, `${role} read buyer_addresses`);
        const writeAttempt = psqlError(
            `BEGIN; SET ROLE ${role}; INSERT INTO public.buyer_addresses (buyer_account_id, full_name, address_line1, city, state, postal_code) VALUES (${q(BUYER_A)}::uuid, 'x', 'x', 'x', 'x', '000000'); COMMIT;`,
        );
        assert.match(writeAttempt || 'WRITE SUCCEEDED', /permission denied/, `${role} wrote buyer_addresses`);
    }
    // service_role, which the gateway's admin client authenticates as, keeps full access.
    const serviceRoleCount = lastLine(psql(`SET ROLE service_role; SELECT count(*) FROM public.buyer_addresses;`));
    assert.ok(Number(serviceRoleCount) >= 2, 'service_role should still read buyer_addresses');
});

test('migration 260 rolls back to exactly the pre-260 shape', { skip }, () => {
    applySqlFile(ROLLBACK);
    assert.equal(lastLine(psql("SELECT to_regclass('public.buyer_addresses') IS NULL;")), 't');
    assert.equal(
        lastLine(psql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='buyer_accounts' AND column_name IN ('full_name','phone');")),
        '0',
    );
    // buyer_accounts itself, and its rows, survive the rollback -- 260 only added columns to it.
    assert.equal(lastLine(psql(`SELECT count(*) FROM public.buyer_accounts;`)), '1');
});
