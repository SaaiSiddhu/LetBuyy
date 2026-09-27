import {
    createSupabaseServiceClient,
    createSupabaseUserClient,
    type SupabaseClient,
} from '@letbuyy/infrastructure/supabase-adapter';
import type { Env } from '../index';
import type { Context } from 'hono';
import { createTenantGuardedSupabaseClient } from '../tenant/tenant-scoped';

/**
 * Create a Supabase Admin client (service role — bypasses RLS)
 */
export function getSupabaseAdminFromEnv(env: Env): SupabaseClient {
    return createTenantGuardedSupabaseClient(createSupabaseServiceClient(env));
}

export function getSupabaseAdmin(c: Context<{ Bindings: Env }>): SupabaseClient {
    return getSupabaseAdminFromEnv(c.env);
}

/**
 * The service-role client WITHOUT the tenant query guard.
 *
 * `getSupabaseAdmin` wraps every client in `createTenantGuardedSupabaseClient`, which refuses any
 * query against a registered tenant table that carries no tenant/owner predicate. That guard is
 * correct for ordinary work and must stay the default.
 *
 * It is wrong for exactly one shape: a BOOTSTRAP LOOKUP BY A GLOBALLY-UNIQUE EXTERNAL KEY, made
 * before any tenant is known. The motivating case is cross-tenant payment-replay detection — asking
 * "has this provider payment id ever been used, by anyone?". Adding a `site_id` predicate there
 * would not fix a violation; it would silently narrow the question to "not replayed within this
 * tenant" and delete the cross-tenant replay protection the check exists to provide.
 *
 * Conditions every call site must meet, and which
 * `services/api-gateway/src/__tests__/unguarded-admin-client-contract.test.ts` enforces by
 * allowlist — this is deliberately NOT a general-purpose escape hatch:
 *   1. the lookup key is unique across the whole provider/platform, not per tenant;
 *   2. no tenant is known yet, so no scope predicate could be supplied;
 *   3. the query is bounded (`.limit(1)` / `.maybeSingle()`), so it cannot enumerate across tenants;
 *   4. the result is re-verified before it is trusted, and is never authorization by itself.
 *
 * Anything that does not meet all four uses `getSupabaseAdmin`.
 */
export function getSupabaseAdminUnguarded(c: Context<{ Bindings: Env }>): SupabaseClient {
    return createSupabaseServiceClient(c.env);
}

/**
 * The service-role client WITHOUT the tenant query guard, for a route that already verified a
 * specific operator review/moderation PERMISSION via `requirePermission` before this function is
 * ever called (F2.6, D-ONE-IDENTITY's delegation of "how an operator reads across tenants" to
 * technical design under ART-08/SEC-R9: no blanket service_role, audited, narrow).
 *
 * This is a DIFFERENT shape of exception from `getSupabaseAdminUnguarded` above, not a relaxation
 * of it: that one bounds a read to a single row because the caller does not yet know which tenant
 * it wants. An operator moderation QUEUE is the opposite case — the tenant is deliberately unknown
 * because the operator's job is to see pending items from every site, and narrowing to one site_id
 * would not be a safety fix, it would silently hide every other site's queue from review. The
 * boundary here is not row count; it is that only a route holding a verified, table-appropriate
 * operator scope may ever construct this client, and every call site is enumerated by
 * `services/api-gateway/src/__tests__/operator-scoped-admin-client-contract.test.ts`, which also
 * asserts the named permission scope is required on the exact route before this function runs.
 *
 * Conditions every call site must meet:
 *   1. mounted behind `requirePermission(<scope>)` for the specific route handler, not merely
 *      somewhere earlier in the file — the allowlist test greps the route registration itself;
 *   2. reads only — every state transition for the same resource goes through its own
 *      `SECURITY DEFINER` RPC (e.g. `transition_channel_listing`), which takes an explicit
 *      `p_site_id` and is where mutation-level tenant enforcement actually happens;
 *   3. the query's own request schema caps page size (no unbounded `SELECT *` across a table with
 *      no ceiling) — the allowlist test reads the validated schema's `limit` bound;
 *   4. never used to decide authorization by itself — the permission check already happened.
 *
 * Anything that does not meet all four uses `getSupabaseAdmin` (single tenant) or
 * `getSupabaseAdminUnguarded` (single-row bootstrap lookup) instead.
 */
export function getSupabaseAdminForOperatorRead(c: Context<{ Bindings: Env }>): SupabaseClient {
    return createSupabaseServiceClient(c.env);
}

/**
 * Create a Supabase client scoped to the authenticated user (respects RLS)
 */
export function getSupabaseUser(c: Context<{ Bindings: Env }>, token: string): SupabaseClient {
    return createSupabaseUserClient(c.env, token);
}

// ── Response Envelope (matches Doc 09 § 1.3) ──────────────────

/**
 * Standard success response with `success: true` field.
 */
export function success<T>(data: T, meta?: Record<string, unknown>) {
    return { success: true as const, data, ...meta };
}

/**
 * Paginated success response with navigation metadata.
 */
export function paginated<T>(data: T[], total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    return {
        success: true as const,
        data,
        meta: {
            page,
            per_page: limit,
            total,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1,
        },
    };
}

export function encodeListCursor(row: Record<string, unknown>, sortColumn: string): string | null {
    const id = row.id;
    const value = row[sortColumn];

    if (typeof id !== 'string' || id.length === 0) return null;
    if (value === undefined || value === null) return null;

    return btoa(JSON.stringify({ id, value }));
}

export function decodeListCursor(cursor?: string): { id: string; value: string | number | boolean } | null {
    if (!cursor) return null;

    try {
        const parsed = JSON.parse(atob(cursor)) as Record<string, unknown>;
        const id = parsed.id;
        const value = parsed.value;

        if (typeof id !== 'string' || id.length === 0) return null;
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return null;

        return { id, value };
    } catch {
        return null;
    }
}

export function cursorPaginated<T>(
    data: T[],
    input: {
        page: number;
        limit: number;
        total?: number | null;
        nextCursor?: string | null;
    },
) {
    const hasExactTotal = typeof input.total === 'number';
    const visibleTotal = hasExactTotal ? input.total as number : data.length;
    const totalPages = hasExactTotal
        ? Math.ceil(visibleTotal / input.limit)
        : input.nextCursor ? input.page + 1 : input.page;

    return {
        success: true as const,
        data,
        meta: {
            page: input.page,
            per_page: input.limit,
            total: visibleTotal,
            total_pages: totalPages,
            has_next: Boolean(input.nextCursor),
            has_prev: input.page > 1 || Boolean(input.nextCursor && input.page > 1),
            next_cursor: input.nextCursor || null,
            total_is_exact: hasExactTotal,
        },
    };
}

/**
 * Standard error response factory.
 */
export function apiError(code: string, message: string, status: number = 400) {
    return {
        body: {
            success: false as const,
            error: { code, message, status },
        },
        status,
    };
}

export const DATABASE_ERROR_MESSAGE = 'Database operation failed';

export function errorBody(code: string, message: string) {
    return {
        error: { code, message },
    };
}

export function failureBody(code: string, message: string) {
    return {
        success: false as const,
        error: { code, message },
    };
}

export function dbErrorBody(message = DATABASE_ERROR_MESSAGE) {
    return errorBody('DB_ERROR', message);
}

export function dbFailureBody(message = DATABASE_ERROR_MESSAGE) {
    return failureBody('DB_ERROR', message);
}

export function isLocalSupabaseEnvironment(env: Env): boolean {
    const url = env.SUPABASE_URL || '';
    return url.includes('localhost') || url.includes('127.0.0.1');
}

export function isMissingSchemaError(error: unknown): boolean {
    if (!error) return false;
    const message = typeof error === 'string'
        ? error
        : error instanceof Error
            ? error.message
            : typeof (error as { message?: unknown }).message === 'string'
                ? (error as { message: string }).message
                : '';

    return /Could not find the table 'public\.[^']+' in the schema cache/i.test(message)
        || /relation "public\.[^"]+" does not exist/i.test(message)
        || /schema cache/i.test(message)
        || /fetch failed/i.test(message)
        || /ECONNREFUSED/i.test(message)
        || /connect/i.test(message);
}

export function shouldReturnEmptyForMissingLocalSchema(env: Env, error: unknown): boolean {
    return isLocalSupabaseEnvironment(env) && isMissingSchemaError(error);
}
