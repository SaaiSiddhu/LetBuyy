import { readMobileFlow } from '@/lib/auth/mobile'
import { identityApiRequest } from '@/lib/api/client'
import { BrandLogo } from '@/components/BrandLogo'
import { MobileAccountApproval, ContinueInBrowser } from '@/components/MobileAccountReturn'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export default async function MobileAccountPage() {
    const flow = await readMobileFlow()
    if (!flow) return <main className="auth-container"><div className="auth-card"><BrandLogo /><h1>Start sign-in from the LetBuyy app</h1><p>Your request may have expired. Return to the app and try again.</p></div></main>
    try {
        const response = await identityApiRequest('/auth/custom/session', { requireSession: true })
        if (response.status === 401) redirect(flow.purpose === 'signup' ? '/signup' : '/login')
        const payload = await response.json() as { authenticated?: boolean; user?: { id: string; email: string } }
        if (!response.ok || !payload?.authenticated || !payload.user?.id) throw new Error('Unavailable')
        return <main className="auth-container"><div className="auth-card"><BrandLogo /><MobileAccountApproval email={payload.user.email} /><ContinueInBrowser /></div></main>
    } catch (error) {
        // Next redirects are control flow and must pass through the boundary.
        if (error && typeof error === 'object' && 'digest' in error) throw error
        return <main className="auth-container"><div className="auth-card"><BrandLogo /><h1>Unable to check your account</h1><p role="alert">Your sign-in is preserved. Please retry when your connection is available.</p><a href="/mobile">Retry</a></div></main>
    }
}
