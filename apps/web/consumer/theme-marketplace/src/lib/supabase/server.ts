import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Server-side Supabase client for theme-marketplace
 * Uses the anon key since the themes table has public SELECT RLS.
 * 
 * NOTE: The SUPABASE_SERVICE_ROLE_KEY in .env belongs to a different
 * Supabase project. Use the anon key until the service role key is
 * regenerated for the correct project (rvzgkynwhbiksffusqnb).
 *
 * When env vars are missing (e.g. during build), `db` is null.
 * All consumers should handle this gracefully via try/catch.
 */
export const db = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null as any;
