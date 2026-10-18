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
import { getSupabaseAdmin, isLocalSupabaseEnvironment } from '../lib/supabase';
import { compareStaffPermissionDecision } from '../identity-foundation/shadow-permission-comparison';
import { compareStaffPermissionDecisionAgainstTargetData, type TargetShadowDb } from '../identity-foundation/target-shadow-comparison';
// Pure decision primitive lives in lib/ (no imports of its own) specifically so this file and every
// shadow comparator can depend on it without depending on EACH OTHER -- see
// lib/staff-permission-decision.ts's own header for the circular-import history this replaced.
import { evaluateStaffPermission, type StaffPermissionKey } from '../lib/staff-permission-decision';
export { evaluateStaffPermission, type StaffPermissionKey };

type AppContext = Context<{ Bindings: Env }>;

export type StaffRbacMode = 'dryrun' | 'enforce';

export function staffRbacMode(env: Env): StaffRbacMode {
    const raw = String((env as unknown as { MERCHANT_STAFF_RBAC_MODE?: string }).MERCHANT_STAFF_RBAC_MODE || '')
        .toLowerCase()
        .trim();
    const production = String(env.ENVIRONMENT || '').toLowerCase().trim() === 'production';
    return raw === 'dryrun' && !production ? 'dryrun' : 'enforce';
}

// Phase 2 / D03 (auth hardening mandate, Section 9; tightened by Section 7 of the 2026-09-28
// follow-up) -- runtime shadow evaluation. Disabled by default.
//
// `ENVIRONMENT !== 'production'` alone is NOT "local only" -- it silently qualifies staging, preview,
// an unset ENVIRONMENT, or a typo'd value nobody meant to be treated as safe. This now requires BOTH
// independent signals to agree, matching this repository's own established convention for "is this
// genuinely a local instance" (isLocalSupabaseEnvironment, lib/supabase.ts -- already used the same
// way for the local-schema-missing dev fallback in routes/auth.ts): (1) ENVIRONMENT is not the
// literal string "production", AND (2) SUPABASE_URL itself points at localhost/127.0.0.1, a fact a
// staging/preview deploy's real connection string cannot satisfy no matter how its ENVIRONMENT var is
// labeled. An unset, empty, or malformed ENVIRONMENT value fails the first check only by accident of
// string comparison -- it is the SUPABASE_URL check that is load-bearing against an unknown/mislabeled
// environment, since a hosted deployment's connection string will never contain "localhost".
export function staffPermissionShadowEnabled(env: Env): boolean {
    const raw = String((env as unknown as { STAFF_PERMISSION_SHADOW?: string }).STAFF_PERMISSION_SHADOW || '')
        .toLowerCase()
        .trim();
    if (raw !== 'on') return false;
    const production = String(env.ENVIRONMENT || '').toLowerCase().trim() === 'production';
    if (production) return false;
    return isLocalSupabaseEnvironment(env);
}

/** Bounded, redacted: outcome categories and the two UUIDs already logged by logDecision for the
 *  real decision (established precedent in this file) -- never an email, a raw permission-VALUE
 *  array, or anything from compareStaffPermissionDecision's free-text `detail` beyond its length. */
function logShadowComparison(
    siteId: string | null | undefined,
    userId: string | null | undefined,
    result: Awaited<ReturnType<typeof compareStaffPermissionDecision>> | { outcome: 'SHADOW_EVALUATION_ERROR' | 'SHADOW_EVALUATION_TIMEOUT'; legacyKey: string; canonicalAction: null; legacyAllowed: null; newAllowed: null },
): void {
    console.warn(JSON.stringify({
        level: 'info',
        event: 'staff_permission_shadow_comparison',
        comparator: 'compareStaffPermissionDecision@identity-foundation/shadow-permission-comparison.ts',
        site_id: siteId ?? null,
        user_id: userId ?? null,
        legacy_key: result.legacyKey,
        canonical_action: result.canonicalAction,
        legacy_allowed: result.legacyAllowed,
        new_allowed: result.newAllowed,
        outcome: result.outcome,
    }));
}

/** Bounded, redacted, same discipline as logShadowComparison above: outcome categories and the two
 *  UUIDs already logged for the real decision, never a raw target role id list. */
function logTargetShadowComparison(
    siteId: string | null | undefined,
    userId: string | null | undefined,
    result: Awaited<ReturnType<typeof compareStaffPermissionDecisionAgainstTargetData>> | { outcome: 'TARGET_SHADOW_EVALUATION_ERROR' | 'TARGET_SHADOW_EVALUATION_TIMEOUT'; legacyKey: string; canonicalAction: null; legacyAllowed: boolean | null; targetAllowed: null },
): void {
    console.warn(JSON.stringify({
        level: 'info',
        event: 'staff_permission_target_shadow_comparison',
        comparator: 'compareStaffPermissionDecisionAgainstTargetData@identity-foundation/target-shadow-comparison.ts',
        site_id: siteId ?? null,
        user_id: userId ?? null,
        legacy_key: result.legacyKey,
        canonical_action: result.canonicalAction,
        legacy_allowed: result.legacyAllowed,
        target_allowed: result.targetAllowed,
        outcome: result.outcome,
    }));
}

// D03 permission equivalence follow-up (2026-09-28): a real, measured gap -- the try/catch blocks
// below only ever protected against a THROWN exception. A merely-slow-but-eventually-resolving
// target-store query never trips them, so its full latency was added to every real request while
// shadow mode is on (`evaluateStaffRequest` awaits this function inline, before returning the real
// decision). Proven with a real test: an artificially delayed fake fetch made the real HTTP response
// measurably wait out the full delay (staff-permission-shadow.test.ts, the "LATENCY" test).
//
// SHADOW_COMPARISON_TIMEOUT_MS is a diagnostic-only internal safety bound, not a claimed production
// SLO: chosen generously above realistic real-Postgres latency for the 1-3 sequential lookups either
// comparator performs, specifically so it almost never fires under normal conditions -- its only job
// is to stop a genuinely stuck/degraded target store from adding unbounded latency to a real request.
const SHADOW_COMPARISON_TIMEOUT_MS = 800;

function shadowComparisonTimeoutError(label: string): Error {
    const error = new Error(`${label} exceeded ${SHADOW_COMPARISON_TIMEOUT_MS}ms`);
    error.name = 'SHADOW_COMPARISON_TIMEOUT';
    return error;
}

function isShadowComparisonTimeout(err: unknown): boolean {
    return err instanceof Error && err.name === 'SHADOW_COMPARISON_TIMEOUT';
}

// `onTimeout` (real cancellation, when the caller has one to offer) and the Promise.race below (the
// unconditional bound) fire from the exact same setTimeout callback, deliberately: real cancellation
// is a best-effort OPTIMIZATION on top of the guarantee, never a substitute for it. If `work`'s own
// implementation does not honor the cancellation (or has none to offer), this function still returns
// within SHADOW_COMPARISON_TIMEOUT_MS regardless -- the bound must never silently depend on the
// callee's cooperation.
async function withShadowComparisonTimeout<T>(work: Promise<T>, label: string, onTimeout?: () => void): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
            onTimeout?.();
            reject(shadowComparisonTimeoutError(label));
        }, SHADOW_COMPARISON_TIMEOUT_MS);
    });
    try {
        return await Promise.race([work, timer]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

/** Never throws, never blocks, never influences the real decision -- a defect in the shadow model
 *  itself must not become an outage or a denial for a real request. Runs BOTH shadow dimensions:
 *  the legacy-translated comparison (permission-translation correctness) and the target-backed
 *  comparison (does a real backfilled principal/membership/role exist and agree) -- they test
 *  different things and a divergence in one says nothing about the other.
 *
 *  Bounded differently, deliberately, per dimension (D03 permission equivalence follow-up, Section 8,
 *  2026-09-28 -- "do not claim Promise.race cancels an underlying database request if it does not"):
 *   - The legacy comparison is pure computation (no db parameter, no I/O) -- there is nothing to
 *     cancel, so a plain Promise.race timeout is both correct and the only meaningful bound; it is
 *     kept for defensive symmetry against a future change making this comparator do I/O, not because
 *     it can genuinely hang today.
 *   - The target comparison performs real HTTP requests, so it gets REAL cancellation: an
 *     AbortController whose signal is threaded into every one of its queries (confirmed supported by
 *     the real @supabase/postgrest-js client -- target-shadow-comparison.ts's own module comment).
 *     On timeout the in-flight request is actually interrupted, not merely abandoned while it keeps
 *     running unobserved. */
async function runShadowComparisonInner(
    env: Env,
    db: TargetShadowDb,
    siteId: string | null | undefined,
    userId: string | null | undefined,
    input: { isOwner: boolean; granted: readonly string[]; requiredKey: string },
): Promise<void> {
    if (!staffPermissionShadowEnabled(env)) return;

    let legacyAllowed: boolean | null = null;
    try {
        const result = await withShadowComparisonTimeout(compareStaffPermissionDecision(input), 'legacy shadow comparison');
        legacyAllowed = result.legacyAllowed;
        logShadowComparison(siteId, userId, result);
    } catch (err) {
        const timedOut = isShadowComparisonTimeout(err);
        logShadowComparison(siteId, userId, {
            outcome: timedOut ? 'SHADOW_EVALUATION_TIMEOUT' : 'SHADOW_EVALUATION_ERROR',
            legacyKey: input.requiredKey,
            canonicalAction: null,
            legacyAllowed: null,
            newAllowed: null,
        });
        console.error(JSON.stringify({
            level: 'error',
            event: timedOut ? 'staff_permission_shadow_timeout' : 'staff_permission_shadow_error',
            message: err instanceof Error ? err.message : String(err),
        }));
    }

    if (!userId || !siteId || legacyAllowed === null) return;

    // Belt and suspenders, deliberately: `controller` gives a real db that supports abortSignal (the
    // production Supabase client does -- confirmed in target-shadow-comparison.ts's own module
    // comment) genuine cancellation, actually interrupting the in-flight request. The
    // withShadowComparisonTimeout race is the UNCONDITIONAL bound underneath it -- if some future or
    // test `db` does not implement abortSignal, `controller.abort()` still fires (harmlessly, on
    // nothing) but the race's own timer still rejects on schedule regardless, so this function's
    // total runtime can never come to depend on a callee choosing to cooperate.
    const controller = new AbortController();
    try {
        const targetResult = await withShadowComparisonTimeout(
            compareStaffPermissionDecisionAgainstTargetData(db, {
                legacyUserId: userId,
                siteId,
                requiredKey: input.requiredKey,
                legacyAllowed,
            }, controller.signal),
            'target shadow comparison',
            () => controller.abort(shadowComparisonTimeoutError('target shadow comparison')),
        );
        // A real cancellation can surface as a normal, non-throwing {data:null,error} query result
        // inside the comparator (matching the Supabase client's own convention) rather than as a
        // rejection reaching this function -- checked explicitly so a real timeout is still labeled
        // TIMEOUT, not folded into whichever generic error outcome the comparator happened to return.
        if (controller.signal.aborted) {
            logTargetShadowComparison(siteId, userId, {
                outcome: 'TARGET_SHADOW_EVALUATION_TIMEOUT',
                legacyKey: input.requiredKey,
                canonicalAction: null,
                legacyAllowed,
                targetAllowed: null,
            });
        } else {
            logTargetShadowComparison(siteId, userId, targetResult);
        }
    } catch (err) {
        // `controller.signal.aborted` (set synchronously, unconditionally, the instant the shared
        // timer fires) is the reliable signal here, deliberately not `isShadowComparisonTimeout(err)`
        // alone -- the rejection this catch actually observes can be either the race's own timeout
        // error OR the db's real AbortError, depending on microtask ordering between them, and both
        // mean exactly the same thing: this comparison hit the bound, not some independent failure.
        const timedOut = controller.signal.aborted || isShadowComparisonTimeout(err);
        logTargetShadowComparison(siteId, userId, {
            outcome: timedOut ? 'TARGET_SHADOW_EVALUATION_TIMEOUT' : 'TARGET_SHADOW_EVALUATION_ERROR',
            legacyKey: input.requiredKey,
            canonicalAction: null,
            legacyAllowed,
            targetAllowed: null,
        });
        console.error(JSON.stringify({
            level: 'error',
            event: timedOut ? 'staff_permission_target_shadow_timeout' : 'staff_permission_target_shadow_error',
            message: err instanceof Error ? err.message : String(err),
        }));
    }
}

// A final, outer safety net -- distinct from the two try/catch blocks above, which each handle their
// OWN comparison's failure but assumed the logging calls themselves (console.warn/console.error)
// never throw. If they did (a broken console, a circular-reference JSON.stringify, anything else
// unanticipated), that exception would previously have propagated out of this function, up through
// evaluateStaffRequest's own `await runShadowComparisonSafely(...)` call, and into ITS catch block --
// which refuses the REAL request with a 503. That would make a logging failure deny a currently
// permitted request, violating this function's own "never influences the real decision" contract.
// Swallowed here, with a last-resort log attempt of its own (itself guarded, in case even that
// throws) so the failure is not silently invisible either.
async function runShadowComparisonSafely(...args: Parameters<typeof runShadowComparisonInner>): Promise<void> {
    try {
        await runShadowComparisonInner(...args);
    } catch (err) {
        try {
            console.error(JSON.stringify({
                level: 'error',
                event: 'staff_permission_shadow_outer_failure',
                message: err instanceof Error ? err.message : String(err),
            }));
        } catch {
            // Logging itself failed too -- there is nothing further this function can safely do
            // except still return normally, which is the one guarantee that actually matters here.
        }
    }
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
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw new Error('Staff grant lookup failed');

    const row = (data as StaffEmployeeRow | null) || null;
    if (!row) return { found: false, granted: [] };
    const granted = Array.isArray(row.permissions?.granted) ? (row.permissions!.granted as string[]) : [];
    return { found: true, granted };
}

// D03 staff-mutation/shadow-runtime completion (2026-09-28): guarded, discovered via a real test
// (staff-permission-shadow.test.ts's LOGGING FAILURE case) that a broken console.warn here -- called
// for the REAL, authoritative decision, unconditionally, before any shadow work even starts --
// propagated out of evaluateStaffRequest's own try block into its catch, which refuses the request
// with a 503. That makes a logging failure deny an otherwise-permitted request, the exact class of
// bug this pass's shadow-safety work exists to close, just one call earlier than the shadow path
// itself. Audit logging must never become an authorization outcome.
function logDecision(
    mode: StaffRbacMode,
    key: string,
    decision: { allowed: boolean; reason: string },
    siteId: string | null | undefined,
    userId: string | null | undefined,
    employeeFound: boolean,
): void {
    try {
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
    } catch {
        // Never let a broken logger turn a real decision into a 503 -- see the comment above.
    }
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
    enforcement?: 'enforce',
): Promise<StaffDecision> {
    // Newly opened staff paths must stay closed without a grant, even when an
    // existing route's explicit non-production diagnostic mode is dryrun.
    const mode = enforcement ?? staffRbacMode(c.env);
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

        // D03 runtime shadow evaluation (Section 9): compute the target-model decision for the SAME
        // input, compare, log -- awaited so the comparison is guaranteed to have run before this
        // function returns (useful for tests and for not racing the request's own completion), but
        // its result is discarded below; `decision.allowed` from the line above is the only thing
        // that reaches `return`. runShadowComparisonSafely can neither throw into this function nor
        // change what is returned -- a shadow denial can never turn this into a block, and a shadow
        // error can never turn this into an allow, because neither is ever read past this point.
        await runShadowComparisonSafely(c.env, db as unknown as TargetShadowDb, siteId, userId, { isOwner, granted, requiredKey: key });

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
    enforcement?: 'enforce',
): Promise<Response | null> {
    const r = await evaluateStaffRequest(c, siteId, userId, key, enforcement);
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
