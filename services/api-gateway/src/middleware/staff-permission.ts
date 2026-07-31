// ============================================================
// STAFF PERMISSION GUARD — per-user (merchant staff) RBAC enforcement
//
// Phase-4.5 security: `requirePermission` (permission.ts) gates on the
// store's BILLING PLAN, not on the calling staff member's role. Staff roles
// are persisted as `employees.permissions = { granted: string[] }` but were
// never enforced at runtime — a viewer-role staff member could call any write
// route. This guard closes that gap.
//
// SAFE ROLLOUT (this cannot be flow-verified without a live auth stack):
//   - Mode is env-gated (`MERCHANT_STAFF_RBAC_MODE`): off | dryrun | enforce.
//   - DEFAULT = 'dryrun' — it evaluates and LOGS the decision but NEVER blocks,
//     so it changes zero behavior until the logs confirm correctness, then an
//     operator flips it to 'enforce'.
//   - Owner bypass is AUTHORITATIVE (verifySiteOwnership against `sites`), so
//     store owners — the overwhelming majority of callers — are never blocked.
//   - FAIL-OPEN on any missing context or lookup error: this is a
//     defense-in-depth layer ON TOP of the existing ownership/membership
//     checks, so a transient RBAC lookup failure must never break merchant ops.
// ============================================================

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../index';
import { verifySiteOwnership } from '../lib/auth-user';
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

export type StaffRbacMode = 'off' | 'dryrun' | 'enforce';

export function staffRbacMode(env: Env): StaffRbacMode {
    const raw = String((env as unknown as { MERCHANT_STAFF_RBAC_MODE?: string }).MERCHANT_STAFF_RBAC_MODE || '')
        .toLowerCase()
        .trim();
    if (raw === 'enforce' || raw === 'dryrun' || raw === 'off') return raw;
    // Safe default: evaluate + log, never block, until live-verified.
    return 'dryrun';
}

/**
 * Pure decision function — no I/O, exhaustively unit-tested.
 * Owners always pass. Otherwise the required key must be present in `granted`
 * directly, via the `*` super-grant, or via a `prefix:*` wildcard.
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
    for (const g of granted) {
        if (g === '*' || g === requiredKey) return { allowed: true, reason: `grant:${g}` };
        if (g.endsWith(':*') && requiredKey.startsWith(g.slice(0, -1))) {
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

async function resolveGrants(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    userId: string,
): Promise<{ found: boolean; granted: string[] }> {
    const { data } = await db
        .from('employees')
        .select('permissions, status, role')
        .eq('site_id', siteId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

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

/**
 * Shared evaluation for both the middleware and the in-handler assertion.
 * FAIL-SAFE: returns `{ block: false }` whenever it cannot confidently deny
 * (mode off, missing context, lookup error, or any non-enforce mode).
 */
export async function evaluateStaffRequest(
    c: AppContext,
    siteId: string | null | undefined,
    userId: string | null | undefined,
    key: StaffPermissionKey,
): Promise<{ block: boolean }> {
    const mode = staffRbacMode(c.env);
    if (mode === 'off') return { block: false };
    if (!siteId || !userId) return { block: false };

    try {
        const db = getSupabaseAdmin(c);
        const isOwner = await verifySiteOwnership(db, siteId, userId);

        let granted: string[] = [];
        let found = false;
        if (!isOwner) {
            const g = await resolveGrants(db, siteId, userId);
            granted = g.granted;
            found = g.found;
        }

        const decision = evaluateStaffPermission({ isOwner, granted, requiredKey: key });
        logDecision(mode, key, decision, siteId, userId, found);
        return { block: !decision.allowed && mode === 'enforce' };
    } catch (err) {
        // Defense-in-depth layer — never break merchant ops on a lookup error.
        console.error(JSON.stringify({
            level: 'error',
            event: 'staff_rbac_error',
            required: key,
            message: err instanceof Error ? err.message : String(err),
        }));
        return { block: false };
    }
}

function forbidden(c: AppContext, key: string): Response {
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
    return r.block ? forbidden(c, key) : null;
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
        if (r.block) return forbidden(c, key);
        await next();
    });
