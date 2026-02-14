import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client for storefront
 * Uses service role key for server-side data access (no RLS)
 * Lazy-initialized to prevent build-time crashes
 */
let _db: SupabaseClient | null = null;
export function getDb(): SupabaseClient {
    if (!_db) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error(
                '[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
            );
        }
        _db = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }
    return _db;
}

// Backward-compatible lazy export — only calls getDb() on first property access
// This prevents build-time crashes when env vars aren't set
export const db: SupabaseClient = new Proxy({} as SupabaseClient, {
    get(_target, prop, receiver) {
        const instance = getDb();
        const value = Reflect.get(instance, prop, receiver);
        return typeof value === 'function' ? value.bind(instance) : value;
    },
});

/**
 * Client-side Supabase client (uses anon key, respects RLS)
 */
export function getPublicClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
