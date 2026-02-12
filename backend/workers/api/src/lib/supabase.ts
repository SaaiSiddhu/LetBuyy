import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../index';
import type { Context } from 'hono';

/**
 * Create a Supabase Admin client (service role — bypasses RLS)
 */
export function getSupabaseAdmin(c: Context<{ Bindings: Env }>): SupabaseClient {
    return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

/**
 * Create a Supabase client scoped to the authenticated user (respects RLS)
 */
export function getSupabaseUser(c: Context<{ Bindings: Env }>, token: string): SupabaseClient {
    return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
}

/**
 * Standard API response helpers
 */
export function success<T>(data: T, meta?: Record<string, unknown>) {
    return { data, ...meta };
}

export function paginated<T>(data: T[], total: number, page: number, limit: number) {
    return {
        data,
        total,
        page,
        limit,
        has_more: page * limit < total,
    };
}

export function apiError(code: string, message: string, status: number = 400) {
    return {
        body: { error: { code, message } },
        status,
    };
}
