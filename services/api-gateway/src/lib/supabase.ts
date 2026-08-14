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
