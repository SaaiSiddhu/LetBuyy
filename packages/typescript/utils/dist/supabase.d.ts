import { createClient, SupabaseClient } from '@supabase/supabase-js';
/**
 * Get or create a Supabase client instance
 */
export declare function getSupabaseClient(): SupabaseClient;
/**
 * Create a Supabase client for server-side use with service role key
 */
export declare function getSupabaseAdmin(): SupabaseClient;
export { createClient, type SupabaseClient };
//# sourceMappingURL=supabase.d.ts.map