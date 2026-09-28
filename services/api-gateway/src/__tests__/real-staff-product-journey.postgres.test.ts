// D03 staff-mutation/shadow-runtime completion (Section 7/10/11, 2026-09-28) -- the REAL, independently
// authenticated staff product journey this mandate asks for, against the owned local Postgres instance.
//
// This complements, and in one specific way corrects, real-http-shadow-rehearsal.postgres.test.ts:
// that file's "PERMISSION DOWNGRADE" and "OWNER TRANSITION" scenarios use the OWNER, with a comment
// claiming "only the owner can currently complete a real product mutation through this router" -- true
// when it was written, false by the time that same file's own earlier "Allowed reversible mutation:
// full staff" scenario landed (a real STAFF_FULL PATCH already succeeds there). This file is the
// correction: every mutation below is completed by a real, independently authenticated STAFF session,
// never the owner standing in for one. (The stale comment in that sibling file is fixed alongside this.)
//
// Three things this file exercises that neither sibling file does:
//
//  1. REAL authentication, not a context bypass. real-http-shadow-rehearsal.postgres.test.ts states its
//     own honesty boundary explicitly: it sets `c.set('auth', ...)` directly and never runs a request
//     through authMiddleware, so it does not re-prove HMAC verification itself. This file mounts the
//     REAL authMiddleware and constructs REAL signed headers via createLetbuyyInternalIdentityHeaders
//     (@letbuyy/auth-core) for every actor -- the exact mechanism a real merchant/staff client uses
//     (Phase N3 closed ART-05: identity-platform issues, every other runtime verifies). Each HTTP call
//     mints a FRESH signed assertion (a new jti + signature), matching how this scheme is designed to be
//     used (it is a per-request signed assertion, not a reusable session cookie) -- verifyInternalIdentityPayload's
//     replay cache means the SAME jti/signature pair could not be reused across requests even if this
//     file wanted to. "The same session" below means the same identity (userId/email/secret), re-signed
//     per call, not a literal single token replayed.
//
//  2. The REAL staff-creation path (POST /employees -> planEmployeeStaffCreate), not a hand-crafted
//     `employees` row. This is also what surfaces the real activation precondition: an employee is
//     linked (user_id set, status 'active') immediately ONLY when a users_custom row already exists for
//     that email with email_verified true -- otherwise the row stays user_id-less and 'invited', and no
//     staff session could ever authenticate as it. Seeded deliberately below, not glossed over.
//
//  3. staff-role-backfill.ts (this same pass, D03 Section 10) exercised against a REAL employee created
//     through that real path -- not a synthetic LegacyStaffGrantRow. real-http-shadow-rehearsal's
//     downgrade/reconcile proof runs on the OWNER using owner-role-backfill.ts; this file runs the
//     identical "decisive independence proof" shape (target-only change -> real auth unaffected ->
//     DIVERGE observed -> reconcile -> MATCH again) on the STAFF member, using executeStaffMembershipRoleAssignment.
//
// Cleanup is verified, not assumed: the `finally` block deletes every row this file created, in the
// same FK-safe order established by real-http-shadow-rehearsal.postgres.test.ts (discovered there the
// hard way -- an early run left orphaned inventory rows behind when `products` was deleted first), and
// a dedicated verification block afterward re-queries every affected table and asserts zero rows remain.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { createLetbuyyInternalIdentityHeaders } from '@letbuyy/auth-core';
import { authMiddleware } from '../middleware/auth';
import employeeRouter from '../routes/employee';
import productsRouter from '../routes/products';
import { executeMerchantPrincipalBackfill, executeStoreMembershipBackfill, type BackfillExecutorDb } from '../identity-foundation/backfill-executor';
import { executeStaffMembershipRoleAssignment, ensureStaffRole } from '../identity-foundation/staff-role-backfill';
import { getSupabaseAdmin } from '../lib/supabase';
import type { Env } from '../index';
import { readLocalSupabaseConfig, resolveLocalSupabaseContainer, isLocalPostgresReachable, psql as psqlOn } from './local-postgres-support';

const config = readLocalSupabaseConfig(new URL('../../.dev.vars', import.meta.url));
const container = resolveLocalSupabaseContainer();
const dockerAvailable = isLocalPostgresReachable(container);
function psql(sql: string): string | null {
    return psqlOn(container, sql);
}

const INTERNAL_SECRET = 'internal-secret-for-real-staff-journey-tests';

function env(overrides: Partial<Env> = {}): Env {
    return {
        SUPABASE_URL: config!.url,
        SUPABASE_SERVICE_ROLE_KEY: config!.serviceRoleKey,
        ENVIRONMENT: 'test',
        STAFF_PERMISSION_SHADOW: 'on',
        INTERNAL_API_SECRET: INTERNAL_SECRET,
        ...overrides,
    } as unknown as Env;
}

function db(): BackfillExecutorDb {
    return getSupabaseAdmin({ env: env() } as never) as unknown as BackfillExecutorDb;
}

/** A REAL signed identity assertion, freshly minted per call -- see the file header. Deliberately
 *  never sets storeId: a real merchant/staff web session carries a user and no store of its own
 *  (staff-paths-fail-closed.test.ts's own documented shape), so every scoping decision below is made
 *  by the resource's own store, exactly as a live request would be evaluated. */
async function identityHeaders(userId: string, email: string): Promise<Record<string, string>> {
    const plan = await createLetbuyyInternalIdentityHeaders({ userId, email, secret: INTERNAL_SECRET });
    assert.ok(plan.ok, `identity header creation failed: ${JSON.stringify(plan)}`);
    return (plan as { headers: Record<string, string> }).headers;
}

function gateway() {
    const api = new Hono<{ Bindings: Env }>();
    api.use('/*', authMiddleware);
    api.route('/employees', employeeRouter);
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

async function readJson(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        throw new Error(`expected a JSON response (status ${res.status}), got: ${text.slice(0, 300)}`);
    }
}

function targetShadowLine(lines: Record<string, unknown>[]): Record<string, unknown> {
    const line = lines.find((l) => l.event === 'staff_permission_target_shadow_comparison');
    assert.ok(line, `a target-shadow comparison must have been logged: ${JSON.stringify(lines)}`);
    return line!;
}

test('D03 real staff product journey: independently authenticated staff, real employee creation, real target-role backfill, real downgrade', async (t) => {
    if (!config || !dockerAvailable) {
        t.skip('no local Supabase instance reachable -- this is a SKIP, not a pass; acceptance requires re-running with the local stack up');
        return;
    }

    const RUN = crypto.randomUUID().slice(0, 8);
    const SITE_A = crypto.randomUUID();
    const SITE_B = crypto.randomUUID();
    const OWNER = crypto.randomUUID();
    const OWNER_B = crypto.randomUUID();
    const STAFF = crypto.randomUUID();
    const ownerEmail = `owner-${RUN}@example.test`;
    const staffEmail = `staff-${RUN}@example.test`;
    const PRODUCT_B = crypto.randomUUID();
    const createdProductIds: string[] = [PRODUCT_B];

    psql(`
        INSERT INTO users_custom (id, email, email_verified) VALUES
            ('${OWNER}', '${ownerEmail}', true),
            ('${STAFF}', '${staffEmail}', true),
            ('${OWNER_B}', 'owner-b-${RUN}@example.test', true);
        INSERT INTO sites (id, name, store_name, site_type, subdomain, custom_user_id) VALUES
            ('${SITE_A}', 'staff-journey-a-${RUN}', 'Staff Journey A ${RUN}', 'store', 'staff-journey-a-${RUN}', '${OWNER}'),
            ('${SITE_B}', 'staff-journey-b-${RUN}', 'Staff Journey B ${RUN}', 'store', 'staff-journey-b-${RUN}', '${OWNER_B}');
        INSERT INTO products (id, store_id, name, price, is_active) VALUES
            ('${PRODUCT_B}', '${SITE_B}', 'Other store''s product ${RUN}', 9.99, true);
    `);

    let employeeId = '';

    try {
        // ============================================================
        // 1. Owner creates staff with the intended product permission -- the REAL POST /employees path.
        // ============================================================
        {
            const res = await gateway().request('/employees', {
                method: 'POST',
                headers: { ...(await identityHeaders(OWNER, ownerEmail)), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: staffEmail,
                    store_id: SITE_A,
                    role: 'manager',
                    permissions: { granted: ['products:read', 'products:write'] },
                }),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 201, `real staff creation: ${JSON.stringify(body)}`);
            const created = body.data as { id: string; user_id: string; status: string; permissions: { granted: string[] } };
            assert.equal(created.user_id, STAFF, 'the pre-verified users_custom row must auto-link user_id');
            assert.equal(created.status, 'active', 'a pre-verified email activates immediately, not "invited"');
            assert.deepEqual([...created.permissions.granted].sort(), ['products:read', 'products:write']);
            employeeId = created.id;
        }

        // ============================================================
        // 2. Real target-role backfill for THIS staff member (D03 Section 10), from THIS real employee
        //    row -- never a synthetic LegacyStaffGrantRow.
        // ============================================================
        {
            const principalResult = await executeMerchantPrincipalBackfill(db(), [
                { id: OWNER, email: ownerEmail },
                { id: STAFF, email: staffEmail },
            ]);
            assert.equal(principalResult.inserted, 2, JSON.stringify(principalResult.details));

            const membershipResult = await executeStoreMembershipBackfill(db(), [
                { id: crypto.randomUUID(), store_id: SITE_A, user_id: STAFF, email: staffEmail, role: 'manager', status: 'active', deleted_at: null },
            ]);
            assert.equal(membershipResult.inserted, 1, JSON.stringify(membershipResult.details));

            const roleResult = await executeStaffMembershipRoleAssignment(db(), [
                { employeeId, storeId: SITE_A, legacyUserId: STAFF, granted: ['products:read', 'products:write'] },
            ]);
            assert.equal(roleResult.details[0]?.outcome, 'inserted', JSON.stringify(roleResult.details));
            assert.deepEqual(roleResult.unmappedGrants, [], 'both products:read and products:write have canonical aliases');
        }

        // ============================================================
        // 3. Staff signs in independently and completes the golden product path -- real HTTP, real
        //    authMiddleware, real HMAC signature, never the owner standing in.
        // ============================================================
        let productId = '';
        {
            const res = await gateway().request('/products', {
                method: 'POST',
                headers: { ...(await identityHeaders(STAFF, staffEmail)), 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: SITE_A, name: `Staff Disposable Product ${RUN}`, price: 199 }),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 201, `staff product creation: ${JSON.stringify(body)}`);
            productId = (body.data as { id: string }).id;
            createdProductIds.push(productId);
        }
        {
            const res = await gateway().request(`/products/${productId}`, { headers: await identityHeaders(STAFF, staffEmail) }, env());
            const body = await readJson(res);
            assert.equal(res.status, 200, `staff product read: ${JSON.stringify(body)}`);
            assert.equal((body.data as { name: string }).name, `Staff Disposable Product ${RUN}`);
        }
        {
            const { result: res, lines } = await capturingWarnLines(async () => gateway().request(`/products/${productId}`, {
                method: 'PATCH',
                headers: { ...(await identityHeaders(STAFF, staffEmail)), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `Staff Disposable Product ${RUN} (edited)` }),
            }, env()));
            const body = await readJson(res);
            assert.equal(res.status, 200, `staff product edit: ${JSON.stringify(body)}`);
            assert.equal((body.data as { name: string }).name, `Staff Disposable Product ${RUN} (edited)`);
            const targetLine = targetShadowLine(lines);
            assert.equal(targetLine.outcome, 'MATCH', `the real target role, backfilled from this real employee, must agree with the real legacy grant: ${JSON.stringify(targetLine)}`);
            assert.equal(targetLine.target_allowed, true);
        }
        {
            const res = await gateway().request(`/products/${productId}`, {
                method: 'DELETE',
                headers: await identityHeaders(STAFF, staffEmail),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 200, `staff approved deletion: ${JSON.stringify(body)}`);
            assert.equal((body.data as { deleted: boolean }).deleted, true);
        }

        // ============================================================
        // 4. Staff attempts a forbidden operation -- collection management has no staff path at all
        //    (verifyStoreOwnership only, routes/products.ts), regardless of products:write.
        // ============================================================
        {
            const res = await gateway().request('/products/collections', {
                method: 'POST',
                headers: { ...(await identityHeaders(STAFF, staffEmail)), 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: SITE_A, title: 'Should not be allowed' }),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 403, `a forbidden operation must be refused: ${JSON.stringify(body)}`);
            assert.equal((body.error as { code: string }).code, 'FORBIDDEN');
        }

        // ============================================================
        // 5. Staff attempts a cross-store mutation -- both a caller-supplied store_id on create, and a
        //    real product that already belongs to the other store.
        // ============================================================
        {
            const res = await gateway().request('/products', {
                method: 'POST',
                headers: { ...(await identityHeaders(STAFF, staffEmail)), 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: SITE_B, name: 'cross-store takeover attempt', price: 1 }),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 403, `a caller-supplied store_id must never redirect a mutation: ${JSON.stringify(body)}`);
            assert.equal((body.error as { code: string }).code, 'STAFF_PERMISSION_REQUIRED');
        }
        {
            const res = await gateway().request(`/products/${PRODUCT_B}`, {
                method: 'PATCH',
                headers: { ...(await identityHeaders(STAFF, staffEmail)), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'should not be renamed by a stranger' }),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 403, `mutating a real product at a store this staff member has no grant at must be refused: ${JSON.stringify(body)}`);
            assert.equal((body.error as { code: string }).code, 'STAFF_PERMISSION_REQUIRED');
        }

        // ============================================================
        // 6. The decisive independence proof (D03 Section 11), for THIS staff member's real target
        //    role: change the TARGET only, observe the REAL response is unaffected (legacy stays
        //    authoritative) and the shadow log DIVERGEs, then reconcile and observe MATCH again.
        // ============================================================
        let independenceProductId = '';
        {
            const res = await gateway().request('/products', {
                method: 'POST',
                headers: { ...(await identityHeaders(STAFF, staffEmail)), 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: SITE_A, name: `Staff Independence Product ${RUN}`, price: 149 }),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 201, `independence-proof product creation: ${JSON.stringify(body)}`);
            independenceProductId = (body.data as { id: string }).id;
            createdProductIds.push(independenceProductId);
        }

        const patchIndependenceProduct = async (name: string) => capturingWarnLines(async () => gateway().request(`/products/${independenceProductId}`, {
            method: 'PATCH',
            headers: { ...(await identityHeaders(STAFF, staffEmail)), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        }, env()));

        // Baseline: real target role still matches the real legacy grant.
        {
            const { result: res, lines } = await patchIndependenceProduct(`Staff Independence Product ${RUN} (baseline)`);
            assert.equal(res.status, 200, `baseline staff mutation: ${JSON.stringify(await readJson(res))}`);
            assert.equal(targetShadowLine(lines).outcome, 'MATCH');
        }

        // TARGET-only change: swap this staff member's role_ids to a real, deliberately lesser role
        // (product.read only) -- built through ensureStaffRole itself, not hand-crafted -- while the
        // legacy employees.permissions row is untouched.
        const { roleId: readOnlyRoleId } = await ensureStaffRole(db(), SITE_A, ['product.read']);
        psql(`UPDATE store_memberships SET role_ids = ARRAY['${readOnlyRoleId}']::uuid[] WHERE store_id = '${SITE_A}' AND principal_id = (SELECT id FROM principals WHERE legacy_user_id = '${STAFF}');`);
        {
            const { result: res, lines } = await patchIndependenceProduct(`Staff Independence Product ${RUN} (target diverged)`);
            const body = await readJson(res);
            assert.equal(res.status, 200, `the real decision must stay legacy-authoritative, unaffected by a target-only change: ${JSON.stringify(body)}`);
            const targetLine = targetShadowLine(lines);
            assert.equal(targetLine.outcome, 'DIVERGE_LEGACY_ALLOWS_TARGET_DENIES', `the target-only change must be OBSERVED, never enforced: ${JSON.stringify(targetLine)}`);
            assert.equal(targetLine.target_allowed, false);
        }

        // Reconcile: rerun the real backfill from the SAME (unchanged) legacy grant.
        {
            const reconciled = await executeStaffMembershipRoleAssignment(db(), [
                { employeeId, storeId: SITE_A, legacyUserId: STAFF, granted: ['products:read', 'products:write'] },
            ]);
            assert.equal(reconciled.details[0]?.outcome, 'updated', JSON.stringify(reconciled.details));
        }
        {
            const { result: res, lines } = await patchIndependenceProduct(`Staff Independence Product ${RUN} (reconciled)`);
            assert.equal(res.status, 200, `reconciled staff mutation: ${JSON.stringify(await readJson(res))}`);
            const targetLine = targetShadowLine(lines);
            assert.equal(targetLine.outcome, 'MATCH', `matching must return once the target role is reconciled: ${JSON.stringify(targetLine)}`);
            assert.equal(targetLine.target_allowed, true);
        }
        {
            const res = await gateway().request(`/products/${independenceProductId}`, { method: 'DELETE', headers: await identityHeaders(STAFF, staffEmail) }, env());
            assert.equal(res.status, 200, `independence-proof product cleanup: ${JSON.stringify(await readJson(res))}`);
        }

        // ============================================================
        // 7. Owner downgrades staff -- the REAL PATCH /employees/:id path, removing products:write and
        //    leaving products:read (a genuine downgrade, not a blunt removal).
        // ============================================================
        {
            const res = await gateway().request(`/employees/${employeeId}`, {
                method: 'PATCH',
                headers: { ...(await identityHeaders(OWNER, ownerEmail)), 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions: { granted: ['products:read'] } }),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 200, `real owner downgrade: ${JSON.stringify(body)}`);
            assert.deepEqual((body.data as { permissions: { granted: string[] } }).permissions.granted, ['products:read']);
        }

        // ============================================================
        // 8. The SAME existing staff session (same identity, freshly signed) immediately loses the
        //    withdrawn authority -- and ONLY the withdrawn authority: write is now refused, read still
        //    works, proving this is a live per-request re-evaluation, not a blanket lockout.
        // ============================================================
        {
            const res = await gateway().request('/products', {
                method: 'POST',
                headers: { ...(await identityHeaders(STAFF, staffEmail)), 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: SITE_A, name: 'should be refused after downgrade', price: 1 }),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 403, `the same staff identity must lose the withdrawn write grant immediately: ${JSON.stringify(body)}`);
            assert.equal((body.error as { code: string }).code, 'STAFF_PERMISSION_REQUIRED');
        }
        {
            const res = await gateway().request(`/products?store_id=${SITE_A}`, { headers: await identityHeaders(STAFF, staffEmail) }, env());
            assert.equal(res.status, 200, `the retained read grant must still work -- this is a precise downgrade, not a lockout: ${JSON.stringify(await readJson(res))}`);
        }

        // ============================================================
        // 9. Owner remains unaffected by their own staff member's downgrade.
        // ============================================================
        {
            const res = await gateway().request('/products', {
                method: 'POST',
                headers: { ...(await identityHeaders(OWNER, ownerEmail)), 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: SITE_A, name: `Owner still works ${RUN}`, price: 299 }),
            }, env());
            const body = await readJson(res);
            assert.equal(res.status, 201, `the owner must be completely unaffected: ${JSON.stringify(body)}`);
            createdProductIds.push((body.data as { id: string }).id);
        }
    } finally {
        // FK-safe order established by real-http-shadow-rehearsal.postgres.test.ts (products' own child
        // rows before products; employees/memberships before sites; roles before sites; principals last
        // among the identity rows; sites and users_custom last of all).
        const productIdList = createdProductIds.map((id) => `'${id}'`).join(', ');
        psql(`
            DELETE FROM inventory_adjustments WHERE product_id IN (${productIdList});
            DELETE FROM inventory_levels WHERE product_id IN (${productIdList});
            DELETE FROM product_variants WHERE product_id IN (${productIdList});
            DELETE FROM product_options WHERE product_id IN (${productIdList});
            DELETE FROM products WHERE id IN (${productIdList});
            DELETE FROM employees WHERE store_id IN ('${SITE_A}', '${SITE_B}');
            DELETE FROM store_memberships WHERE store_id IN ('${SITE_A}', '${SITE_B}');
            DELETE FROM site_role_permissions WHERE role_id IN (SELECT id FROM site_roles WHERE site_id = '${SITE_A}');
            DELETE FROM site_roles WHERE site_id = '${SITE_A}';
            DELETE FROM principals WHERE legacy_user_id IN ('${OWNER}', '${STAFF}');
            DELETE FROM sites WHERE id IN ('${SITE_A}', '${SITE_B}');
            DELETE FROM users_custom WHERE id IN ('${OWNER}', '${STAFF}', '${OWNER_B}');
        `);

        // Verify cleanup rather than assuming it succeeded.
        const remainingProducts = psql(`SELECT count(*) FROM products WHERE id IN (${productIdList});`);
        const remainingEmployees = psql(`SELECT count(*) FROM employees WHERE store_id IN ('${SITE_A}', '${SITE_B}');`);
        const remainingMemberships = psql(`SELECT count(*) FROM store_memberships WHERE store_id IN ('${SITE_A}', '${SITE_B}');`);
        const remainingRoles = psql(`SELECT count(*) FROM site_roles WHERE site_id = '${SITE_A}';`);
        const remainingPrincipals = psql(`SELECT count(*) FROM principals WHERE legacy_user_id IN ('${OWNER}', '${STAFF}');`);
        const remainingSites = psql(`SELECT count(*) FROM sites WHERE id IN ('${SITE_A}', '${SITE_B}');`);
        const remainingUsers = psql(`SELECT count(*) FROM users_custom WHERE id IN ('${OWNER}', '${STAFF}', '${OWNER_B}');`);
        for (const [label, remaining] of [
            ['products', remainingProducts],
            ['employees', remainingEmployees],
            ['store_memberships', remainingMemberships],
            ['site_roles', remainingRoles],
            ['principals', remainingPrincipals],
            ['sites', remainingSites],
            ['users_custom', remainingUsers],
        ] as const) {
            assert.equal(remaining, '0', `cleanup left ${remaining} row(s) behind in ${label} -- fixture side effects were not fully removed`);
        }
    }
});
