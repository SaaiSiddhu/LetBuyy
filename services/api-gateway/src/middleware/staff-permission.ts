// ============================================================
// STAFF PERMISSION GUARD — per-user (merchant staff) RBAC enforcement
//
// Phase-4.5 security: `requirePermission` (permission.ts) gates on the
// store's BILLING PLAN, not on the calling staff member's role. Staff roles
// are persisted as `employees.permissions = { granted: string[] }` but were
// never enforced at runtime — a viewer-role staff member could call any write
// route. This guard closes that gap.
//
// FAIL CLOSED (APPID-P5b, 2026-09-24). Until then this guard was a dry run everywhere (the
// mode was set nowhere, so every environment took the 'dryrun' default), allowed on any lookup
// error or missing context, and read grants from `employees.site_id`, a column that does not
// exist (the store is `employees.store_id`), so it had never evaluated a real grant. Now:
//   - Production always enforces. A dry run (evaluate and log, never block) can be asked for with
//     MERCHANT_STAFF_RBAC_MODE=dryrun outside production only; there is no 'off'.
//   - The store owner (sites.custom_user_id / sites.user_id) passes; anyone else needs an ACTIVE
//     `employees` row for THIS store whose `permissions.granted` holds the key.
//   - A request with no store or no user, a session bound to another store, or a lookup that
//     fails, is refused: 403 when the answer is no, 503 when there is no answer.
//   - Every route that calls this has already checked ownership of the store it names, so an
//     owner is never blocked by it; it is the gate that holds when a non-owner path is added.
// ============================================================

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin } from '../lib/supabase';

type AppContext = Context<{ Bindings: Env }>;

export type StaffPermissionKey =
    | 'products:read'
    | 'products:write'
    | 'orders:read'
    | 'orders:write'
    | 'customers:read'
    | 'customers:write'
    | 'marketing:write'
    | 'shipping:write'
    | 'returns:write'
    | 'settings:write'
    | 'content:write';

export type StaffRbacMode = 'dryrun' | 'enforce';

export function staffRbacMode(env: Env): StaffRbacMode {
    const raw = String((env as unknown as { MERCHANT_STAFF_RBAC_MODE?: string }).MERCHANT_STAFF_RBAC_MODE || '')
        .toLowerCase()
        .trim();
    const production = String(env.ENVIRONMENT || '').toLowerCase().trim() === 'production';
    return raw === 'dryrun' && !production ? 'dryrun' : 'enforce';
}

/**
 * Pure decision function — no I/O, exhaustively unit-tested.
 * Owners always pass. Otherwise the required key must be present in `granted`
 * directly, via the `*` super-grant, via a `prefix:*` wildcard, or via the matching
 * `<resource>:write` grant when the requirement is `<resource>:read` (see below).
 */
export function evaluateStaffPermission(input: {
    isOwner: boolean;
    granted: string[];
    requiredKey: string;
}): { allowed: boolean; reason: string } {
    const { isOwner, granted, requiredKey } = input;
    if (isOwner) return { allowed: true, reason: 'owner' };
    if (!Array.isArray(granted) || granted.length === 0) {
        return { allowed: false, reason: 'no-grants' };
    }
    // Phase 2 / F2.5: every "write" role in the staff role catalog (merchant-web's roles.ts --
    // manager, editor, fulfillment, marketing, support) grants <resource>:write WITHOUT the
    // matching <resource>:read, on the evident assumption that write access includes the ability
    // to view what you can edit -- only the read-only "viewer" role lists :read keys explicitly.
    // Reproduced live: a real Manager, added through the real product UI, was refused reading the
    // product list (products:read required) despite holding products:write. This widens ONLY a
    // `:read` requirement to also accept the matching `:write` grant -- a `:write` requirement is
    // never satisfied by a `:read` grant, and no other implication is added.
    const impliedByWrite = requiredKey.endsWith(':read') ? `${requiredKey.slice(0, -':read'.length)}:write` : null;
    for (const g of granted) {
        if (g === '*' || g === requiredKey) return { allowed: true, reason: `grant:${g}` };
        if (g.endsWith(':*') && requiredKey.startsWith(g.slice(0, -1))) {
            return { allowed: true, reason: `grant:${g}` };
        }
        if (impliedByWrite && g === impliedByWrite) {
            return { allowed: true, reason: `grant:${g}` };
        }
    }
    return { allowed: false, reason: `missing:${requiredKey}` };
}

interface StaffEmployeeRow {
    permissions: { granted?: string[] } | null;
    status: string | null;
    role: string | null;
}

/// The store owner, by the store's own owner columns. Unlike verifySiteOwnership, a failed read
/// is an error here, not a "no": this answer decides whether a grant is needed at all.
async function ownsStore(db: ReturnType<typeof getSupabaseAdmin>, siteId: string, userId: string): Promise<boolean> {
    const { data, error } = await db
        .from('sites')
        .select('id')
        .eq('id', siteId)
        .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`)
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw new Error('Store ownership lookup failed');
    return Boolean(data);
}

/// The caller's staff record AT THIS STORE: `employees.store_id` is the store (sites.id).
async function resolveGrants(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    userId: string,
): Promise<{ found: boolean; granted: string[] }> {
    const { data, error } = await db
        .from('employees')
        .select('permissions, status, role')
        .eq('store_id', siteId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw new Error('Staff grant lookup failed');

    const row = (data as StaffEmployeeRow | null) || null;
    if (!row) return { found: false, granted: [] };
    const granted = Array.isArray(row.permissions?.granted) ? (row.permissions!.granted as string[]) : [];
    return { found: true, granted };
}

function logDecision(
    mode: StaffRbacMode,
    key: string,
    decision: { allowed: boolean; reason: string },
    siteId: string | null | undefined,
    userId: string | null | undefined,
    employeeFound: boolean,
): void {
    console.warn(JSON.stringify({
        level: decision.allowed ? 'info' : 'warn',
        event: 'staff_rbac_decision',
        mode,
        required: key,
        allowed: decision.allowed,
        reason: decision.reason,
        site_id: siteId ?? null,
        user_id: userId ?? null,
        employee_found: employeeFound,
    }));
}

export type StaffDecision = { block: false } | { block: true; status: 403 | 503 };

/**
 * Shared evaluation for both the middleware and the in-handler assertion. Fails closed: in
 * 'enforce' a request is allowed only when the caller owns the store, or holds the key at it.
 */
export async function evaluateStaffRequest(
    c: AppContext,
    siteId: string | null | undefined,
    userId: string | null | undefined,
    key: StaffPermissionKey,
): Promise<StaffDecision> {
    const mode = staffRbacMode(c.env);
    const refuse = (status: 403 | 503): StaffDecision => (mode === 'enforce' ? { block: true, status } : { block: false });

    const sessionStoreId = (() => { try { return c.get('auth')?.user?.storeId; } catch { return undefined; } })();
    if (!siteId || !userId) {
        logDecision(mode, key, { allowed: false, reason: 'missing-context' }, siteId, userId, false);
        return refuse(403);
    }
    if (sessionStoreId && sessionStoreId !== siteId) {
        logDecision(mode, key, { allowed: false, reason: 'session-bound-to-another-store' }, siteId, userId, false);
        return refuse(403);
    }

    try {
        const db = getSupabaseAdmin(c);
        const isOwner = await ownsStore(db, siteId, userId);

        let granted: string[] = [];
        let found = false;
        if (!isOwner) {
            const g = await resolveGrants(db, siteId, userId);
            granted = g.granted;
            found = g.found;
        }

        const decision = evaluateStaffPermission({ isOwner, granted, requiredKey: key });
        logDecision(mode, key, decision, siteId, userId, found);
        return decision.allowed ? { block: false } : refuse(403);
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error',
            event: 'staff_rbac_error',
            mode,
            required: key,
            message: err instanceof Error ? err.message : String(err),
        }));
        // A permission that could not be checked is not granted.
        return refuse(503);
    }
}

function forbidden(c: AppContext, key: string, status: 403 | 503): Response {
    if (status === 503) {
        return c.json({
            success: false,
            error: {
                code: 'STAFF_PERMISSION_UNAVAILABLE',
                message: 'Your permissions could not be checked. Try again shortly.',
                status: 503,
            },
        }, 503);
    }
    return c.json({
        success: false,
        error: {
            code: 'STAFF_PERMISSION_REQUIRED',
            message: `Your staff role does not include the "${key}" permission.`,
            status: 403,
        },
    }, 403);
}

/**
 * In-handler assertion — PREFERRED for merchant routes that resolve the store +
 * user per-handler (e.g. products/orders). Call AFTER the handler has resolved
 * `customUser`/siteId. Returns a Response to return early if blocked, else null.
 *
 *   const block = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
 *   if (block) return block;
 */
export async function assertStaffPermission(
    c: AppContext,
    siteId: string | null | undefined,
    userId: string | null | undefined,
    key: StaffPermissionKey,
): Promise<Response | null> {
    const r = await evaluateStaffRequest(c, siteId, userId, key);
    return r.block ? forbidden(c, key, r.status) : null;
}

/**
 * Middleware variant — for routes that pre-set the tenant context (mirrors the
 * `requirePermission` usage). Reads siteId/userId from `tenant`, falling back to
 * the auth session store.
 */
export const requireStaffPermission = (key: StaffPermissionKey) =>
    createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const tenant = (() => { try { return c.get('tenant'); } catch { return null; } })();
        const auth = (() => { try { return c.get('auth'); } catch { return null; } })();
        const siteId = tenant?.siteId ?? auth?.user?.storeId;
        const userId = tenant?.userId ?? auth?.user?.id;
        const r = await evaluateStaffRequest(c, siteId, userId, key);
        if (r.block) return forbidden(c, key, r.status);
        await next();
    });
