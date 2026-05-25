import { createSupabaseBrowserClient } from '@letbuyy/runtime-composition/identity-runtime-adapter';

let clientInstance: ReturnType<typeof createSupabaseBrowserClient> | null = null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Client-side Supabase client (uses anon key, respects RLS)
 * Uses @supabase/ssr for proper cookie-based session management
 * Singleton pattern to avoid creating multiple clients
 */
export function getSupabaseClient() {
    if (!clientInstance) {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error(
                '[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
                'Set these environment variables to connect to your Supabase project.'
            );
            return null;
        }
        clientInstance = createSupabaseBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return clientInstance;
}
