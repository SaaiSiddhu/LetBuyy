import { redirect } from 'next/navigation'

/*
   Legacy subscribe-checkout route.
   The checkout experience now lives at the full-screen URL:
   /{store}/access_account/checkout/checkout?plan=...&bp=...&site_type=...
   This redirect preserves any existing links/bookmarks.
*/

interface PageProps {
    params: Promise<{ store: string }>
    searchParams: Promise<{ plan?: string; bp?: string; site_type?: string }>
}

export default async function LegacySubscribeCheckoutRedirect({ params, searchParams }: PageProps) {
    const { store } = await params
    const { plan, bp, site_type } = await searchParams

    const query = new URLSearchParams()
    if (plan) query.set('plan', plan)
    if (bp) query.set('bp', bp)
    if (site_type) query.set('site_type', site_type)

    const suffix = query.toString() ? `?${query.toString()}` : ''
    redirect(`/${store}/access_account/checkout/checkout${suffix}`)
}
