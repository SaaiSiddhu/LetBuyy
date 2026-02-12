import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create a Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
    if (supabaseClient) {
        return supabaseClient;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables');
    }

    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseClient;
}

/**
 * Create a Supabase client for server-side use with service role key
 */
export function getSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase admin environment variables');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

export { createClient, type SupabaseClient };
