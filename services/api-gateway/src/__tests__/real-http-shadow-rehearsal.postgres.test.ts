// D03 permission equivalence, Sections 10-12 (auth hardening follow-up, 2026-09-28): a REAL
// HTTP-to-database rehearsal. Explicitly NOT a substitute with fake PostgREST, an in-memory
// repository, a fixture-only handler, or a direct comparator call -- this mounts the REAL
// routes/products.ts router (the exact file every merchant client calls through) and hits it with a
// real SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY pointed at the owned local Postgres instance. Every
// query below runs against genuine tables, genuine constraints, and genuine data this file seeds and
// deletes.
//
// Honesty boundary, stated precisely rather than implied: this bypasses only the OUTERMOST
// session-token-verification step (the JWT/cookie check that ordinarily populates `c.set('auth', ...)`
// before a request ever reaches routes/products.ts) by setting that same context directly to the
// shape a genuinely authenticated request would carry. Every query, permission check, and shadow
// comparison from `c.get('auth')` onward -- which is where 100% of the staff-permission and
// target-shadow logic actually lives -- runs unmodified, against real Postgres. This does not re-prove
// JWT/session-cookie verification itself, which is a separate, already-tested concern elsewhere in
// this codebase (session-verifier.test.mjs and friends).
//
// Current authorization remains authoritative throughout: shadow mode is enabled (STAFF_PERMISSION_SHADOW=on)
// so both shadow comparators run and log, but every assertion in this file checks the REAL, RETURNED
// HTTP response -- the shadow log lines are inspected SEPARATELY, never substituted for the real
// result.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Hono } from 'hono';
import productsRouter from '../routes/products';
import { executeMerchantPrincipalBackfill, executeStoreMembershipBackfill } from '../identity-foundation/backfill-executor';
import { ensureOwnerRole, executeSiteOwnerMembershipBackfill } from '../identity-foundation/owner-role-backfill';
import { getSupabaseAdmin, getSupabaseAdminUnguarded } from '../lib/supabase';
import type { Env } from '../index';
import type { BackfillExecutorDb } from '../identity-foundation/backfill-executor';

const devVarsPath = new URL('../../.dev.vars', import.meta.url);
function readLocalSupabaseConfig(): { url: string; serviceRoleKey: string } | null {
    if (!existsSync(devVarsPath)) return null;
    const devVars = readFileSync(devVarsPath, 'utf8');
    const url = devVars.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim();
    const serviceRoleKey = devVars.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();
    if (!url || !serviceRoleKey) return null;
    let hostname = '';
    try { hostname = new URL(url).hostname.toLowerCase(); } catch { return null; }
    return ['localhost', '127.0.0.1', '::1'].includes(hostname) ? { url, serviceRoleKey } : null;
}
function dbContainerName(): string {
    return process.env.LETBUYY_LOCAL_SUPABASE_CONTAINER || 'supabase_db_letbuyy-newmac-20260926';
}
function psql(sql: string): string | null {
    try {
        return execFileSync('docker', ['exec', '-i', dbContainerName(), 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], { input: sql, encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
}
const config = readLocalSupabaseConfig();
const dockerAvailable = (() => {
    try { execFileSync('docker', ['exec', dbContainerName(), 'true']); return true; } catch { return false; }
})();

function env(overrides: Partial<Env> = {}): Env {
    return { SUPABASE_URL: config!.url, SUPABASE_SERVICE_ROLE_KEY: config!.serviceRoleKey, ENVIRONMENT: 'test', STAFF_PERMISSION_SHADOW: 'on', ...overrides } as unknown as Env;
}

function appAs(userId: string, storeId?: string) {
    const api = new Hono<{ Bindings: Env }>();
    api.use('*', async (c, next) => {
        c.set('auth', { user: { id: userId, storeId } } as never);
        await next();
    });
    api.route('/products', productsRouter);
    return api;
}

async function capturingWarnLines<T>(fn: () => Promise<T>): Promise<{ result: T; lines: Record<string, unknown>[] }> {
    const captured: Record<string, unknown>[] = [];
    const original = console.warn;
    console.warn = (msg: unknown) => {
        try { captured.push(JSON.parse(String(msg))); } catch { /* ignore non-JSON */ }
    };
    try {
        const result = await fn();
        return { result, lines: captured };
    } finally {
        console.warn = original;
    }
}

// A route that throws an uncaught exception (rather than returning a JSON error response) reaches
// the test as a non-JSON body (Hono's default error handler). Read defensively so that case fails
// with the actual response body in the assertion message, not a confusing secondary SyntaxError from
// `res.json()` itself.
async function readJson(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        throw new Error(`expected a JSON response (status ${res.status}), got: ${text.slice(0, 300)}`);
    }
}

test('D03 real HTTP-to-database shadow rehearsal', async (t) => {
    if (!config || !dockerAvailable) {
        t.skip('no local Supabase instance reachable -- this is a SKIP, not a pass');
        return;
    }

    const RUN = crypto.randomUUID().slice(0, 8);
    const SITE_A = crypto.randomUUID();
    const SITE_B = crypto.randomUUID();
    const OWNER = crypto.randomUUID();
    const STAFF_FULL = crypto.randomUUID();
    const STAFF_READONLY = crypto.randomUUID();
    const STAFF_REVOKED = crypto.randomUUID();
    const CROSS_SITE_USER = crypto.randomUUID();
    const PRODUCT_A = crypto.randomUUID();
    const createdProductIds: string[] = [];

    psql(`
        INSERT INTO users_custom (id, email) VALUES
            ('${OWNER}', 'owner-${RUN}@example.test'),
            ('${STAFF_FULL}', 'staff-full-${RUN}@example.test'),
            ('${STAFF_READONLY}', 'staff-ro-${RUN}@example.test'),
            ('${STAFF_REVOKED}', 'staff-revoked-${RUN}@example.test'),
            ('${CROSS_SITE_USER}', 'cross-site-${RUN}@example.test');
        INSERT INTO sites (id, name, store_name, site_type, subdomain, custom_user_id) VALUES
            ('${SITE_A}', 'rehearsal-a-${RUN}', 'Rehearsal A ${RUN}', 'store', 'rehearsal-a-${RUN}', '${OWNER}'),
            ('${SITE_B}', 'rehearsal-b-${RUN}', 'Rehearsal B ${RUN}', 'store', 'rehearsal-b-${RUN}', '${CROSS_SITE_USER}');
        INSERT INTO products (id, store_id, name, price, is_active) VALUES
            ('${PRODUCT_A}', '${SITE_A}', 'Rehearsal Product ${RUN}', 19.99, true);
    `);

    const db = getSupabaseAdmin({ env: env() } as never) as unknown as BackfillExecutorDb;
    // ensureOwnerRole's site_roles lookup (site_id IS NULL, a genuinely global bootstrap row) cannot
    // satisfy the tenant guard -- see owner-role-backfill.ts's own "CLIENT CONTRACT" note. Every other
    // call below uses the regular guarded `db`.
    const unguardedDb = getSupabaseAdminUnguarded({ env: env() } as never) as unknown as BackfillExecutorDb;

    try {
        // ---- Prepare TARGET data through the real backfill/reconciliation path (never hand-crafted) ----
        const { roleId: ownerRoleId } = await ensureOwnerRole(unguardedDb);
        await executeMerchantPrincipalBackfill(db, [
            { id: OWNER, email: `owner-${RUN}@example.test` },
            { id: STAFF_FULL, email: `staff-full-${RUN}@example.test` },
            { id: STAFF_READONLY, email: `staff-ro-${RUN}@example.test` },
            { id: STAFF_REVOKED, email: `staff-revoked-${RUN}@example.test` },
            { id: CROSS_SITE_USER, email: `cross-site-${RUN}@example.test` },
        ]);
        await executeSiteOwnerMembershipBackfill(db, [{ site_id: SITE_A, custom_user_id: OWNER, user_id: null }], ownerRoleId);
        await executeSiteOwnerMembershipBackfill(db, [{ site_id: SITE_B, custom_user_id: CROSS_SITE_USER, user_id: null }], ownerRoleId);
        // A real granting role for the "full staff" member, seeded via real site_roles/site_role_permissions.
        const fullStaffRoleId = crypto.randomUUID();
        // A deliberately lesser role (read-only, no product.update) used by the PERMISSION DOWNGRADE
        // scenario below -- assigned to the owner in place of the owner role to simulate a downgrade
        // while leaving role_ids non-empty (an empty role_ids array hits a different, more specific
        // comparator outcome, TARGET_NO_ROLES_ASSIGNED, not the DIVERGE_* outcome a downgrade means).
        const downgradedRoleId = crypto.randomUUID();
        psql(`
            INSERT INTO site_roles (id, site_id, slug, name) VALUES ('${fullStaffRoleId}', '${SITE_A}', 'rehearsal-full-${RUN}', 'Rehearsal Full ${RUN}');
            INSERT INTO site_role_permissions (role_id, permission, effect) VALUES ('${fullStaffRoleId}', 'product.read', 'allow'), ('${fullStaffRoleId}', 'product.update', 'allow');
            INSERT INTO site_roles (id, site_id, slug, name) VALUES ('${downgradedRoleId}', '${SITE_A}', 'rehearsal-downgraded-${RUN}', 'Rehearsal Downgraded ${RUN}');
            INSERT INTO site_role_permissions (role_id, permission, effect) VALUES ('${downgradedRoleId}', 'product.read', 'allow');
        `);
        await executeStoreMembershipBackfill(db, [
            { id: crypto.randomUUID(), store_id: SITE_A, user_id: STAFF_FULL, email: `staff-full-${RUN}@example.test`, role: 'manager', status: 'active', deleted_at: null },
            { id: crypto.randomUUID(), store_id: SITE_A, user_id: STAFF_READONLY, email: `staff-ro-${RUN}@example.test`, role: 'viewer', status: 'active', deleted_at: null },
            { id: crypto.randomUUID(), store_id: SITE_A, user_id: STAFF_REVOKED, email: `staff-revoked-${RUN}@example.test`, role: 'manager', status: 'active', deleted_at: null },
        ]);
        psql(`UPDATE store_memberships SET role_ids = ARRAY['${fullStaffRoleId}']::uuid[] WHERE store_id = '${SITE_A}' AND principal_id = (SELECT id FROM principals WHERE legacy_user_id = '${STAFF_FULL}');`);
        // Also grant the legacy staff-permission.ts side of the world for STAFF_FULL/STAFF_READONLY/STAFF_REVOKED.
        psql(`
            INSERT INTO employees (id, store_id, user_id, email, role, status, permissions) VALUES
                ('${crypto.randomUUID()}', '${SITE_A}', '${STAFF_FULL}', 'staff-full-${RUN}@example.test', 'manager', 'active', '{"granted": ["products:read", "products:write"]}'::jsonb),
                ('${crypto.randomUUID()}', '${SITE_A}', '${STAFF_READONLY}', 'staff-ro-${RUN}@example.test', 'viewer', 'active', '{"granted": ["products:read"]}'::jsonb),
                ('${crypto.randomUUID()}', '${SITE_A}', '${STAFF_REVOKED}', 'staff-revoked-${RUN}@example.test', 'manager', 'removed', '{"granted": ["products:read", "products:write"]}'::jsonb);
        `);

        // ---- Allowed read: owner ----
        {
            const res = await appAs(OWNER).request(`/products?store_id=${SITE_A}`, {}, env());
            assert.equal(res.status, 200, `owner read: ${await res.text()}`);
        }

        // ---- Allowed read: full staff ----
        {
            const res = await appAs(STAFF_FULL).request(`/products?store_id=${SITE_A}`, {}, env());
            assert.equal(res.status, 200, `staff read: ${await res.text()}`);
        }

        // ---- Allowed reversible mutation: the owner creates a product, with shadow logging captured ----
        //
        // Real, unrelated, pre-existing discovery made while building this rehearsal, stated precisely:
        // a real, non-owner staff member with genuine products:write CANNOT complete any product
        // mutation through this router today -- not PATCH/DELETE, and not even POST (create), despite
        // the route-level `assertStaffPermission('products:write')` check correctly allowing them
        // through first. Two independent internal gates cause this, both stricter than and redundant
        // with the route-level check they sit behind:
        //   1. PATCH/DELETE /products/:id resolve the target's store via
        //      `ProductExecutionAdapter.ownedProductStoreId` -> `resolveOwnedStoreIds`, a lookup against
        //      `sites.custom_user_id`/`user_id` ONLY (product-execution.adapter.ts:345-355) -- confirmed
        //      by first running this scenario against PATCH and observing
        //      `ForbiddenError: Not authorized for this product` thrown from `ownedProductStoreId`
        //      (product-execution.adapter.ts:365), BEFORE `assertStaffPermission` ever runs.
        //   2. POST / (create) reaches `assertStaffPermission` first (it correctly allows a permitted
        //      staff member through), but `ProductExecutionAdapter.createProduct` then calls its own
        //      `assertStoreOwnership` (product-execution.adapter.ts:140), a literal-owner-only recheck
        //      via `verifySiteOwnership` (lib/auth-user.ts:58-76, the same helper `sites`-only check
        //      used everywhere else) -- confirmed by observing
        //      `ForbiddenError: You do not own this store` thrown from `assertStoreOwnership` for
        //      STAFF_FULL immediately after their `assertStaffPermission` check had already passed.
        // GET /:id is the one route already fixed for this exact gap class (owner-OR-staff, see
        // the comment at routes/products.ts:1110-1113: "assertStaffPermission alone denied a real
        // Manager... the same gap fixed for the list route") -- POST/PATCH/DELETE never received the
        // equivalent fix, so `products:write` is currently INERT for every non-owner. This is a real,
        // pre-existing, out-of-scope gap in product mutation authorization (not a shadow/target-permission
        // defect) -- reported separately (see the evidence doc and the spawned follow-up task), not
        // fixed inline here, since fixing it would touch routes/products.ts and
        // product-execution.adapter.ts, outside this phase's D03 permission-equivalence scope. The owner
        // is used below instead, which genuinely passes both gates, so this rehearsal can still exercise
        // a real, successful, shadow-observed mutation end to end.
        {
            const { result: res, lines } = await capturingWarnLines(async () =>
                appAs(OWNER).request(`/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ store_id: SITE_A, name: `Rehearsal Create ${RUN}`, price: 9.99 }),
                }, env()));
            const body = await readJson(res) as { data?: { id?: string; name?: string } };
            assert.equal(res.status, 201, `owner mutation: ${JSON.stringify(body)}`);
            assert.equal(body.data?.name, `Rehearsal Create ${RUN}`);
            if (body.data?.id) createdProductIds.push(body.data.id);
            const targetLine = lines.find((l) => l.event === 'staff_permission_target_shadow_comparison');
            assert.ok(targetLine, 'a real target-shadow comparison must have been logged for this real mutation');
            assert.equal(targetLine!.outcome, 'MATCH', `expected the real, backfilled owner role to agree with the legacy owner-bypass decision: ${JSON.stringify(targetLine)}`);
        }

        // ---- Forbidden mutation: read-only staff ----
        {
            const res = await appAs(STAFF_READONLY).request(`/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: SITE_A, name: 'should not be allowed', price: 1 }),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 403, `read-only staff mutation must be forbidden: ${JSON.stringify(body)}`);
        }

        // ---- Membership revocation: revoked staff denied read ----
        {
            const res = await appAs(STAFF_REVOKED).request(`/products?store_id=${SITE_A}`, {}, env());
            assert.equal(res.status, 403, `revoked staff must be denied: ${await res.text()}`);
        }

        // ---- Cross-site read: SITE_B's owner reading SITE_A ----
        {
            const res = await appAs(CROSS_SITE_USER).request(`/products?store_id=${SITE_A}`, {}, env());
            assert.equal(res.status, 403, `a different site's owner must never read this site's products: ${await res.text()}`);
        }

        // ---- Cross-site mutation: SITE_B's owner mutating (creating on) SITE_A ----
        // POST / (see the note above the "full staff" mutation scenario) isolates the real
        // `assertStaffPermission` denial precisely: CROSS_SITE_USER has no employees/store_membership
        // row on SITE_A at all, so the assertion is a real 403 from the permission gate itself, not
        // merely "not 200" from an unrelated pre-gate.
        {
            const res = await appAs(CROSS_SITE_USER).request(`/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: SITE_A, name: 'cross-site takeover attempt', price: 1 }),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 403, `cross-site mutation must never succeed: ${JSON.stringify(body)}`);
        }

        // ---- PERMISSION DOWNGRADE, real: the owner's TARGET role is swapped for a lesser one ----
        //
        // Uses the owner (not a staff member) for the same reason as the "allowed reversible mutation"
        // scenario above: only the owner can currently complete a real product mutation through this
        // router, so only the owner can demonstrate "the real response stays legacy-authoritative
        // regardless of a target-only change." The owner's LEGACY decision (`evaluateStaffPermission`'s
        // `isOwner` bypass, staff-permission.ts) never consults `role_ids` at all, so replacing the
        // owner's target-side role with the read-only `downgradedRoleId` (product.read only, no
        // product.update) cannot and does not change the real response -- while the TARGET comparator
        // (which resolves the owner through the ordinary principal -> membership -> role -> permission
        // chain, no special case) independently sees the same real row and correctly reports the
        // product.update grant is gone. This is the same independence property Section 11 asks for,
        // demonstrated with the one actor this router currently lets reach a real mutation.
        {
            psql(`UPDATE store_memberships SET role_ids = ARRAY['${downgradedRoleId}']::uuid[] WHERE store_id = '${SITE_A}' AND principal_id = (SELECT id FROM principals WHERE legacy_user_id = '${OWNER}');`);
            // Legacy side (the `sites.custom_user_id` row itself) is untouched -- this proves the
            // TARGET side's downgrade independently.
            const { result: res, lines } = await capturingWarnLines(async () =>
                appAs(OWNER).request(`/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ store_id: SITE_A, name: `Rehearsal Downgrade ${RUN}`, price: 1 }),
                }, env()));
            const body = await readJson(res) as { data?: { id?: string } };
            assert.equal(res.status, 201, `the REAL decision is still legacy-authoritative -- unaffected by the target-only downgrade: ${JSON.stringify(body)}`);
            if (body.data?.id) createdProductIds.push(body.data.id);
            const targetLine = lines.find((l) => l.event === 'staff_permission_target_shadow_comparison');
            assert.equal(targetLine!.outcome, 'DIVERGE_LEGACY_ALLOWS_TARGET_DENIES', 'the target-only downgrade must be OBSERVED, never enforced');
            assert.equal(targetLine!.target_allowed, false, `the downgraded role must not carry product.update: ${JSON.stringify(targetLine)}`);
        }

        // ---- OWNER TRANSITION: ownership of SITE_A moves to STAFF_READONLY; old owner loses authority, new owner gains it ----
        {
            // The PERMISSION DOWNGRADE scenario just above replaced the owner's SITE_A role_ids with
            // `downgradedRoleId` entirely (a wholesale overwrite, not an add), so this scenario would
            // otherwise start from an ambiguous state: the old owner would still carry a real, active
            // `product.read` grant from that leftover role, independent of ownership -- muddying what
            // this scenario means to prove. Restored here so "the old owner held real owner authority,
            // then lost it" is unambiguous, and so the reconciliation assertions below test what they
            // say they test.
            psql(`UPDATE store_memberships SET role_ids = ARRAY['${ownerRoleId}']::uuid[] WHERE store_id = '${SITE_A}' AND principal_id = (SELECT id FROM principals WHERE legacy_user_id = '${OWNER}');`);

            psql(`UPDATE sites SET custom_user_id = '${STAFF_READONLY}' WHERE id = '${SITE_A}';`);
            await executeSiteOwnerMembershipBackfill(db, [{ site_id: SITE_A, custom_user_id: STAFF_READONLY, user_id: null }], ownerRoleId);

            // The legacy owner check (staff-permission.ts's own ownsStore) is driven by `sites` directly,
            // so it reflects the transfer immediately -- the OLD owner is no longer recognized as owner.
            const { result: oldOwnerRes, lines: oldOwnerLines } = await capturingWarnLines(async () =>
                appAs(OWNER).request(`/products?store_id=${SITE_A}`, {}, env()));
            assert.equal(oldOwnerRes.status, 403, 'the former owner must lose access once ownership transfers');
            const oldOwnerTargetLine = oldOwnerLines.find((l) => l.event === 'staff_permission_target_shadow_comparison');
            assert.equal(oldOwnerTargetLine!.target_allowed, false, `reconciliation must have revoked the former owner's TARGET-side owner role, not just left the real response to be decided by sites.custom_user_id: ${JSON.stringify(oldOwnerTargetLine)}`);

            const { result: newOwnerRes, lines: newOwnerLines } = await capturingWarnLines(async () =>
                appAs(STAFF_READONLY).request(`/products?store_id=${SITE_A}`, {}, env()));
            assert.equal(newOwnerRes.status, 200, 'the new owner must gain access');
            const newOwnerTargetLine = newOwnerLines.find((l) => l.event === 'staff_permission_target_shadow_comparison');
            assert.equal(newOwnerTargetLine!.outcome, 'MATCH', `the new owner's TARGET-side membership must independently agree they now hold owner authority: ${JSON.stringify(newOwnerTargetLine)}`);
        }
    } finally {
        const allProductIds = [PRODUCT_A, ...createdProductIds].map((id) => `'${id}'`).join(', ');
        // `createProduct` (product-execution.adapter.ts) writes inventory_adjustments/inventory_levels
        // and product_variants/product_options rows for every product it creates -- discovered when an
        // earlier run of this file left three of these behind: the `products` DELETE below failed on
        // `inventory_adjustments_product_id_fkey` (ON_ERROR_STOP aborted the rest of this script,
        // leaking every row past it), and the leaked rows had to be identified and removed by hand
        // afterward. These four deletes must run, in this order, before the `products` delete.
        psql(`
            DELETE FROM inventory_adjustments WHERE product_id IN (${allProductIds});
            DELETE FROM inventory_levels WHERE product_id IN (${allProductIds});
            DELETE FROM product_variants WHERE product_id IN (${allProductIds});
            DELETE FROM product_options WHERE product_id IN (${allProductIds});
            DELETE FROM products WHERE id IN (${allProductIds});
            DELETE FROM employees WHERE store_id IN ('${SITE_A}', '${SITE_B}');
            DELETE FROM store_memberships WHERE store_id IN ('${SITE_A}', '${SITE_B}');
            DELETE FROM site_role_permissions WHERE role_id IN (SELECT id FROM site_roles WHERE slug LIKE 'rehearsal-%-${RUN}');
            DELETE FROM site_roles WHERE slug LIKE 'rehearsal-%-${RUN}';
            DELETE FROM principals WHERE legacy_user_id IN ('${OWNER}', '${STAFF_FULL}', '${STAFF_READONLY}', '${STAFF_REVOKED}', '${CROSS_SITE_USER}');
            DELETE FROM sites WHERE id IN ('${SITE_A}', '${SITE_B}');
            DELETE FROM users_custom WHERE id IN ('${OWNER}', '${STAFF_FULL}', '${STAFF_READONLY}', '${STAFF_REVOKED}', '${CROSS_SITE_USER}');
        `);
    }
});
