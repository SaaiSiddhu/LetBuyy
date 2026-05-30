import { createSupabaseBrowserClient } from '@letbuyy/runtime-composition/identity-runtime-adapter'

function getMissingSupabaseConfigMessage() {
  if (process.env.NODE_ENV === 'production') {
    return 'Sign in is temporarily unavailable. Please try again later.'
  }

  return 'Supabase sign in is not configured locally. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.'
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://example.supabase.co' || supabaseAnonKey === 'replace-with-public-anon-key') {
    throw new Error(getMissingSupabaseConfigMessage())
  }

  return createSupabaseBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )
}
