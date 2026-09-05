// BUYER-1 — guards the two decisions in migration 223 that are easy to undo by accident and
// expensive to discover afterwards.
//
// This is a source contract, not a behavioural test: the behaviour was proven by executing the full
// migration chain against a real database and probing as each role (app_tenant with a valid tenant
// context, authenticated, anon: permission denied on both tables; service_role: reads both). What a
// source contract adds is that the NEXT change cannot quietly reverse it — the leak this prevents is
// invisible in any single diff that reintroduces it, because the reintroduction looks correct.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(testDir, '../../services/../database/supabase/migrations');
const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
const buyerMigration = readFileSync(join(migrationsDir, '223_platform_buyer_identity.sql'), 'utf8');

test('the buyer-to-store link is NOT a column on store_customers', () => {
    // The rejected design. store_customers is readable by its owning merchant under site-scoped RLS,
    // and a buyer account id is a stable cross-store identifier — so two merchants comparing their
    // own customer lists could establish that the same person shops at both. Proven in BUYER-1 by
    // adding the column in a throwaway database and reading it back as app_tenant: it came out.
    for (const file of migrationFiles) {
        const sql = readFileSync(join(migrationsDir, file), 'utf8');
        const addsColumn = /ALTER TABLE\s+(?:public\.)?store_customers\s+ADD COLUMN[^;]*buyer_account_id/is;
        assert.ok(
            !addsColumn.test(sql),
            `${file} adds buyer_account_id to store_customers — that column lets two merchants correlate the same shopper. The link belongs in buyer_store_customers, which tenant roles cannot read.`,
        );
    }
});

test('both buyer tables are ENABLE + FORCE row level security', () => {
    for (const table of ['buyer_accounts', 'buyer_store_customers']) {
        assert.match(
            buyerMigration,
            new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
            `${table} must ENABLE row level security`,
        );
        assert.match(
            buyerMigration,
            new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`),
            `${table} must FORCE row level security — ENABLE alone is bypassed by the table owner`,
        );
    }
});

test('tenant and public roles are explicitly REVOKED from both buyer tables', () => {
    // buyer_accounts is deliberately cross-tenant: one row per human, not per store. The reflex to
    // "scope it to site_id" is exactly wrong here and would hand every merchant the buyer graph.
    for (const table of ['buyer_accounts', 'buyer_store_customers']) {
        const revoke = new RegExp(`REVOKE ALL ON public\\.${table} FROM ([a-z_, ]+);`);
        const match = buyerMigration.match(revoke);
        assert.ok(match, `${table} must explicitly REVOKE, not merely rely on having no policy`);
        const revoked = match![1].split(',').map((r) => r.trim());
        for (const role of ['app_tenant', 'authenticated', 'anon']) {
            assert.ok(revoked.includes(role), `${table} must REVOKE from ${role}`);
        }
    }
});

test('service_role is granted EXPLICITLY, not left to a hosted bootstrap', () => {
    // A policy grants no table privilege of its own. Without an explicit GRANT, service_role is
    // denied and the platform path is dead — observed exactly that while probing, before this was
    // added. Every other table reaches service_role through Supabase's project-level default
    // privileges, which do not exist in a local container, so the platform path would be
    // unverifiable anywhere this programme can actually run a database (D-11).
    for (const table of ['buyer_accounts', 'buyer_store_customers']) {
        assert.match(
            buyerMigration,
            new RegExp(`GRANT [A-Z, ]+ ON public\\.${table} TO service_role;`),
            `${table} must grant service_role explicitly`,
        );
    }
});

test('buyer_accounts carries no site_id — it is cross-tenant by design', () => {
    const createTable = buyerMigration.slice(
        buyerMigration.indexOf('CREATE TABLE IF NOT EXISTS public.buyer_accounts'),
        buyerMigration.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS buyer_accounts_email_key'),
    );
    assert.ok(createTable.length > 0, 'buyer_accounts CREATE TABLE should be locatable');
    assert.ok(
        !/\bsite_id\b/.test(createTable),
        'buyer_accounts must not gain a site_id — a buyer identity is not a tenant, and site_id stays the tenant boundary',
    );
});
