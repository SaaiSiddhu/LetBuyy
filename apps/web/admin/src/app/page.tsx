import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'

/**
 * Root page — checks for session and redirects accordingly.
 * - If logged in: tries to find user's store → redirect to dashboard
 * - If not logged in: redirect to accounts login
 */
export default async function AdminRootPage() {
  const user = await getSessionUser()

  if (!user) {
    const accountsUrl =
      process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000'
    redirect(`${accountsUrl}/login`)
  }

  // User is logged in — try to find their store
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: store } = await supabase
    .from('sites')
    .select('subdomain')
    .eq('custom_user_id', user.id)
    .limit(1)
    .single()

  if (store?.subdomain) {
    redirect(`/${store.subdomain}/dashboard`)
  }

  // No store found — redirect to onboarding
  const accountsUrl =
    process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000'
  redirect(`${accountsUrl}/onboarding`)
}
