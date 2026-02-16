import { redirect } from 'next/navigation'
import { getSessionUser, getUserStores } from '@/lib/auth/session'

/**
 * Root page — checks for session and redirects accordingly.
 * - Not logged in → accounts login
 * - Logged in, no stores → accounts onboarding
 * - Logged in, 1 store → that store's dashboard
 * - Logged in, 2+ stores → /stores (All Stores page)
 */
export default async function AdminRootPage() {
  const user = await getSessionUser()

  if (!user) {
    const accountsUrl =
      process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000'
    redirect(`${accountsUrl}/lookup`)
  }

  // Fetch all user stores
  const stores = await getUserStores(user.id)

  if (stores.length === 0) {
    // No stores → onboarding
    const accountsUrl =
      process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000'
    redirect(`${accountsUrl}/onboarding`)
  }

  if (stores.length === 1) {
    // Single store → go directly to dashboard
    redirect(`/${stores[0].subdomain}/dashboard`)
  }

  // Multiple stores → All Stores page
  redirect('/stores')
}
