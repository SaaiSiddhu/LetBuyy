// CHK-1 — the cross-artifact contract for the parent-purchase model (migration 219).
//
// The behavioural half runs on real Postgres (tests/executable/purchase-parent-child-postgres.test.mjs:
// one parent per checkout, replay creates no second parent, the single-child index refuses a second
// child, app_tenant/anon/authenticated are denied on purchases, rollback round-trip). This half needs
// no database and runs in the default gate, pinning the decisions that a future migration could
// erode without any test noticing — above all D-PURCHASE-TENANCY (decisions.md 2b), which is the only
// reason a table with no tenant column is acceptable in this schema.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const MIGRATION = 'database/supabase/migrations/219_purchase_parent_child_orders.sql';
const ROLLBACK = 'database/supabase/rollback/219_purchase_parent_child_orders.rollback.sql';
const REGISTRY = 'services/api-gateway/src/tenant/tenant-tables.registry.ts';

function read(relativePath: string): string {
    const absolute = join(repoRoot, relativePath);
    assert.equal(existsSync(absolute), true, `${relativePath} must exist`);
    return readFileSync(absolute, 'utf8');
}

// Strip line comments so the migration's own prose can never satisfy an assertion about its DDL.
function executableSql(source: string): string {
    return source.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n');
}

function purchasesTableDdl(sql: string): string {
    const start = sql.indexOf('CREATE TABLE IF NOT EXISTS public.purchases');
    assert.notEqual(start, -1, `${MIGRATION} must create public.purchases`);
    const end = sql.indexOf(');', start);
    assert.ok(end > start, 'unterminated purchases table definition');
    return sql.slice(start, end + 2);
}

test('purchases carries no tenant column — the reason it is not, and must not become, a tenant table', () => {
    const ddl = purchasesTableDdl(executableSql(read(MIGRATION)));
    // The registry generator decides membership by the EXACT column names site_id / store_id
    // (scripts/governance/tenant-registry-common.mjs:51). A purchase may span merchants, so it has no
    // single tenant, and the provenance column is deliberately named origin_site_id.
    assert.doesNotMatch(ddl, /^\s*site_id\s/m, 'purchases must not declare a site_id column');
    assert.doesNotMatch(ddl, /^\s*store_id\s/m, 'purchases must not declare a store_id column');
    assert.match(ddl, /origin_site_id uuid NOT NULL REFERENCES public\.sites\(id\)/, 'provenance is recorded, but not as a tenant column');
    assert.doesNotMatch(read(REGISTRY), /"purchases"/, 'purchases must not appear in the tenant table registry');
});

test('no merchant, anon or authenticated realm is granted any access to purchases (D-PURCHASE-TENANCY)', () => {
    const sql = executableSql(read(MIGRATION));
    // FORCE RLS plus exactly one policy, for service_role only. A policy naming any other role would
    // give merchants a read path onto other merchants' purchases, which is what the decision forbids.
    assert.match(sql, /ALTER TABLE public\.purchases ENABLE ROW LEVEL SECURITY;/);
    assert.match(sql, /ALTER TABLE public\.purchases FORCE ROW LEVEL SECURITY;/);
    const policies = [...sql.matchAll(/CREATE POLICY (\w+) ON public\.purchases\s+FOR (\w+) TO ([^\n]+)/g)];
    assert.equal(policies.length, 1, 'purchases must carry exactly one policy');
    assert.equal(policies[0][1], 'service_role_purchases');
    assert.equal(policies[0][3].trim(), 'service_role', 'the only policy on purchases is service_role\'s');
    assert.match(sql, /REVOKE SELECT, INSERT, UPDATE, DELETE ON public\.purchases FROM app_tenant;/, 'app_tenant must be revoked at the grant layer too');
    assert.doesNotMatch(sql, /GRANT[^;]*ON public\.purchases TO (anon|authenticated|app_tenant)/, 'no read grant to any merchant or public realm');
});

test('the parent deliberately holds no money and no status — the child order stays the single source of truth', () => {
    const ddl = purchasesTableDdl(executableSql(read(MIGRATION)));
    // Each of these is a recorded decision, not an oversight (migration header + decisions.md 2b).
    // A parent total would be a second source of truth for money and, once carts span merchants,
    // would expose one merchant's amounts to another.
    for (const forbidden of ['subtotal', 'total', 'tax', 'shipping', 'discount', 'amount', 'grand_total']) {
        assert.doesNotMatch(ddl, new RegExp(`^\\s*${forbidden}\\b`, 'm'), `purchases must not carry a money column (${forbidden})`);
    }
    assert.doesNotMatch(ddl, /^\s*status\b/m, 'purchases must not carry a status — it is derivable from its children');
    assert.match(ddl, /customer_email text NOT NULL/, 'the parent carries the same contact snapshot orders already carries');
});

test('the child link and the D-3 single-merchant flag are both present and correctly shaped', () => {
    const sql = executableSql(read(MIGRATION));
    assert.match(
        sql,
        /ADD COLUMN IF NOT EXISTS purchase_id uuid NULL REFERENCES public\.purchases\(id\) ON DELETE RESTRICT/,
        'purchase_id must be nullable (existing orders predate it, nothing is backfilled) and RESTRICT (a parent cannot vanish under its children)',
    );
    // THE flag: exactly one child per purchase. Dropping this index is the flip; making it
    // non-unique or unconditional would silently change what ships.
    assert.match(
        sql,
        /CREATE UNIQUE INDEX IF NOT EXISTS orders_single_child_per_purchase_idx\s+ON public\.orders \(purchase_id\)\s+WHERE purchase_id IS NOT NULL/,
        'the single-child guarantee must be a PARTIAL UNIQUE index on orders(purchase_id)',
    );
});

test('219 carries migration 218\'s advisory lock forward, and its rollback restores it too', () => {
    // The CREATE OR REPLACE trap: 213 and 215 each rebuilt create_checkout_order from an older copy
    // and dropped the lock, shipping a duplicate-order defect (CHK-0). tests/contracts/
    // checkout-idempotency-lock-contract.test.ts guards the winning definition; this asserts the
    // rollback path too, so rolling CHK-1 back can never reopen the race CHK-0 closed.
    assert.match(executableSql(read(MIGRATION)), /PERFORM pg_advisory_xact_lock\(hashtextextended\(p_store_id::text \|\| ':' \|\| p_idempotency_key, 0\)\)/);
    assert.match(
        executableSql(read(ROLLBACK)),
        /PERFORM pg_advisory_xact_lock\(hashtextextended\(p_store_id::text \|\| ':' \|\| p_idempotency_key, 0\)\)/,
        'the rollback restores 218\'s body, lock included — a CHK-1 rollback must not reopen the idempotency race',
    );
    const rollback = executableSql(read(ROLLBACK));
    for (const drop of [
        /DROP INDEX IF EXISTS public\.orders_single_child_per_purchase_idx/,
        /ALTER TABLE public\.orders DROP COLUMN IF EXISTS purchase_id/,
        /DROP TABLE IF EXISTS public\.purchases/,
    ]) {
        assert.match(rollback, drop, 'the rollback must remove every object 219 adds');
    }
    assert.doesNotMatch(rollback, /DROP TABLE[^;]*purchases[^;]*CASCADE/i, 'never CASCADE: a still-referenced parent must fail loudly, not vanish');
});
