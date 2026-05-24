import { createSupabaseBrowserClient } from '@letbuyy/runtime-composition/identity-runtime-adapter'

export function createClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
