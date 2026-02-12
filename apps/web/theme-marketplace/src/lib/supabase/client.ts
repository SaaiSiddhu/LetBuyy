import { createBrowserClient } from '@supabase/ssr';

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

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
            console.warn('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
            // Return a dummy client that won't crash the app
            clientInstance = createBrowserClient(
                'https://placeholder.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
            );
            return clientInstance;
        }
        clientInstance = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return clientInstance;
}
