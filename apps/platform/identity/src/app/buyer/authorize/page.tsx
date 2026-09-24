import { LETBUYY_BUYER_SESSION_HEADER } from '@letbuyy/auth-core'
import { identityApiRequest } from '@/lib/api/client'
import { getBuyerSessionCookie } from '@/lib/auth/buyer-session'
import { parseAuthorizationRequest } from '@/lib/auth/buyer-authorization'
import { BrandLogo } from '@/components/BrandLogo'
import { BuyerAuthorize } from './authorize-client'

/**
 * /buyer/authorize — where a storefront sends a buyer to sign in (APPID-P4b).
 *
 * The request is checked before anything is shown: its shape here, and its callback by the gateway,
 * which must resolve it to a published store's own address. A request that fails either gets an error
 * on this page and is never redirected: sending an error back to an unchecked callback would make this
 * page an open redirect. A request that passes names the store, so the buyer knows where they are
 * going, and signing in never sends them anywhere by itself: they choose to continue.
 */
export const dynamic = 'force-dynamic'

function AuthorizeProblem({ message }: { message: string }) {
    return (
        <main className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <BrandLogo />
                </div>
                <h1 className="auth-title">We can’t sign you in from here</h1>
                <p className="auth-subtitle">{message}</p>
            </div>
        </main>
    )
}

export default async function BuyerAuthorizePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const request = parseAuthorizationRequest(params)
    if (!request) {
        return <AuthorizeProblem message="This sign-in link is incomplete or has been changed. Go back to the store and choose Sign in again." />
    }

    const check = await identityApiRequest('/storefront/buyer/authorization-codes/check', {
        method: 'POST',
        body: JSON.stringify({ client_id: request.clientId, redirect_uri: request.redirectUri }),
    })
    const checkPayload = await check.json().catch(() => null) as { data?: { site?: { id: string; name: string | null } } | null } | null
    const site = checkPayload?.data?.site
    if (!check.ok || !site) {
        return (
            <AuthorizeProblem
                message={check.status === 400
                    ? 'This sign-in link did not come from a LetBuyy store, so we won’t send your account there.'
                    : 'Sign-in is unavailable right now. Try again in a moment.'}
            />
        )
    }

    let buyerEmail: string | null = null
    const token = await getBuyerSessionCookie()
    if (token) {
        const me = await identityApiRequest('/storefront/buyer/me', {
            method: 'GET',
            headers: { [LETBUYY_BUYER_SESSION_HEADER]: token },
        })
        const mePayload = await me.json().catch(() => null) as { data?: { buyer?: { email?: string } | null } | null } | null
        buyerEmail = me.ok ? mePayload?.data?.buyer?.email ?? null : null
    }

    return (
        <BuyerAuthorize
            request={request}
            storeName={site.name || 'this store'}
            buyerEmail={buyerEmail}
            initialMode={params.screen === 'register' ? 'register' : 'sign-in'}
        />
    )
}
