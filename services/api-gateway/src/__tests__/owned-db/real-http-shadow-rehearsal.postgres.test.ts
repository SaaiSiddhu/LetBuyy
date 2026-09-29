// D03 permission equivalence, Sections 10-12 (auth hardening follow-up, 2026-09-28): a REAL
// HTTP-to-database rehearsal. Explicitly NOT a substitute with fake PostgREST, an in-memory
// repository, a fixture-only handler, or a direct comparator call -- this mounts the REAL
// routes/products.ts router (the exact file every merchant client calls through) and hits it with the
// owned database's own REST endpoint and service key (a real PostgREST over a disposable Postgres that the
// executable-suite runner created for this suite). Every query below runs against genuine tables, genuine
// constraints, and genuine data this file seeds.
//
// WHERE IT RUNS (P2-HERMETIC-GATEWAY-DB): only in that owned database, reached through requireOwnedDatabase(),
// which proves ownership before a statement is sent. There is no skip path and no lookup of the developer's own
// stack: with no owned database this suite FAILS. Nothing is hand-deleted afterwards; the database is disposed of
// with the suite, so the products' child rows, the memberships and the identity rows need no FK-ordered cleanup.
//
// Honesty boundary, stated precisely rather than implied: this bypasses only the OUTERMOST
// session-token-verification step (the JWT/cookie check that ordinarily populates `c.set('auth', ...)`
// before a request ever reaches routes/products.ts) by setting that same context directly to the
// shape a genuinely authenticated request would carry. Every query, permission check, and shadow
// comparison from `c.get('auth')` onward -- which is where 100% of the staff-permission and
// target-shadow logic actually lives -- runs unmodified, against real Postgres. This does not re-prove
// JWT/session-cookie verification itself, which is a separate, already-tested concern elsewhere in
// this codebase (session-verifier.test.mjs and friends); the sibling real-staff-product-journey suite is the
// one that runs the real authMiddleware with real HMAC-signed internal identity headers. Per proof, this file
// exercises: the gateway route (routes/products.ts, unmodified) and the shadow comparators, with an injected
// auth context; database constraints and triggers; NOT internal signed identity, NOT a browser session, and NOT
// row-level security (the service role bypasses it -- the tenant guard, RPCs, constraints and triggers do not).
//
// Current authorization remains authoritative throughout: shadow mode is enabled (STAFF_PERMISSION_SHADOW=on)
// so both shadow comparators run and log, but every assertion in this file checks the REAL, RETURNED
// HTTP response -- the shadow log lines are inspected SEPARATELY, never substituted for the real
// result.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import productsRouter from '../../routes/products';
import { executeMerchantPrincipalBackfill, executeStoreMembershipBackfill } from '../../identity-foundation/backfill-executor';
import { ensureOwnerRole, executeSiteOwnerMembershipBackfill } from '../../identity-foundation/owner-role-backfill';
import { getSupabaseAdmin, getSupabaseAdminUnguarded } from '../../lib/supabase';
import type { Env } from '../../index';
import type { BackfillExecutorDb } from '../../identity-foundation/backfill-executor';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const psql = owned.psql;
const script = owned.script;

function env(overrides: Partial<Env> = {}): Env {
    return { ...owned.restEnv(), ENVIRONMENT: 'test', STAFF_PERMISSION_SHADOW: 'on', ...overrides } as unknown as Env;
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

test('D03 real HTTP-to-database shadow rehearsal', async () => {
    const RUN = crypto.randomUUID().slice(0, 8);
    const SITE_A = crypto.randomUUID();
    const SITE_B = crypto.randomUUID();
    const OWNER = crypto.randomUUID();
    const STAFF_FULL = crypto.randomUUID();
    const STAFF_READONLY = crypto.randomUUID();
    const STAFF_REVOKED = crypto.randomUUID();
    const CROSS_SITE_USER = crypto.randomUUID();
    const PRODUCT_A = crypto.randomUUID();

    script(`
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
    script(`
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
    script(`
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

    // ---- Allowed reversible mutation: full staff updates the product, with shadow logging captured ----
    //
    // A real, non-owner staff member with genuine products:write now completes a real PATCH mutation
    // -- this exact scenario is what first surfaced a real, unrelated, pre-existing bug: PATCH/DELETE
    // /products/:id used to resolve the target's store via `ProductExecutionAdapter.ownedProductStoreId`
    // -> `resolveOwnedStoreIds`, a lookup against `sites.custom_user_id`/`user_id` ONLY, which threw
    // `ForbiddenError: Not authorized for this product` for STAFF_FULL BEFORE `assertStaffPermission`
    // ever ran; and `createProduct` separately called its own `assertStoreOwnership` (the same
    // `sites`-only check) AFTER the route's `assertStaffPermission` had already correctly allowed a
    // permitted staff member through. GET /:id was the one route already fixed for this exact gap
    // class (owner-OR-staff, see the comment at routes/products.ts:1110-1113); PATCH/DELETE/POST have
    // since received the equivalent fix (routes/products.ts now resolves the product's real store via
    // `loadProductByIdUnguarded`, the same pattern GET /:id uses, before checking owner-OR-staff; and
    // createProduct/bulkAction take an explicit `alreadyAuthorized` flag the route sets once it has
    // already verified access, instead of redundantly re-running a stricter, owner-only check) -- see
    // docs/evidence/phase2-2026-09-27/D03_PERMISSION_EQUIVALENCE_AND_RUNTIME_REHEARSAL.md and
    // product-tenant-guard.test.ts's section 5 for the fix's own dedicated regression coverage.
    {
        const { result: res, lines } = await capturingWarnLines(async () =>
            appAs(STAFF_FULL).request(`/products/${PRODUCT_A}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `Rehearsal Product ${RUN} (updated by staff)` }),
            }, env()));
        const body = await readJson(res) as { data?: { name?: string } };
        assert.equal(res.status, 200, `staff mutation: ${JSON.stringify(body)}`);
        assert.equal(body.data?.name, `Rehearsal Product ${RUN} (updated by staff)`);
        const targetLine = lines.find((l) => l.event === 'staff_permission_target_shadow_comparison');
        assert.ok(targetLine, 'a real target-shadow comparison must have been logged for this real mutation');
        assert.equal(targetLine!.outcome, 'MATCH', `expected the real, seeded target role to agree with the legacy decision: ${JSON.stringify(targetLine)}`);
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
    // Correction (D03 staff-mutation/shadow-runtime completion, 2026-09-28): this scenario used to
    // say "only the owner can currently complete a real product mutation through this router" --
    // that was true when this scenario was written, but false by the time the "Allowed reversible
    // mutation: full staff" scenario above landed in this same file (a real STAFF_FULL PATCH already
    // succeeds there). Kept on the OWNER anyway, deliberately, because it now demonstrates a
    // DIFFERENT independence property than the staff-side proof does: the owner's LEGACY decision
    // (`evaluateStaffPermission`'s `isOwner` bypass, staff-permission.ts) never consults `role_ids`
    // at all -- a structurally different code path from staff's `resolveGrants` path -- so replacing
    // the owner's target-side role with the read-only `downgradedRoleId` (product.read only, no
    // product.update) cannot and does not change the real response, while the TARGET comparator
    // (which resolves the owner through the ordinary principal -> membership -> role -> permission
    // chain, no special case) independently sees the same real row and correctly reports the
    // product.update grant is gone. The equivalent proof for a real STAFF member -- through the
    // `resolveGrants` path, using a real employee created via POST /employees and a real target role
    // built by staff-role-backfill.ts -- now lives in real-staff-product-journey.postgres.test.ts
    // ("The decisive independence proof"), which also corrects the historical framing that any
    // rehearsal proving this pattern had to substitute the owner for a permitted staff mutation.
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
});
