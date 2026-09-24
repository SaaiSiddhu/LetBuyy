import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// GET /api/stores/[store]/domains/[domain] — live health (DNS + SSL).
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; domain: string }> }
) {
    try {
        const { store, domain } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const data = await createMerchantApiClient().customDomains.health(
            decodeURIComponent(domain),
            { site_id: resolved.storeId },
        )
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load domain health')
    }
}

// PATCH /api/stores/[store]/domains/[domain] — set the domain's role to redirect.
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; domain: string }> }
) {
    try {
        const { store, domain } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = (await request.json().catch(() => ({}))) as { redirect_to?: string | null }
        const data = await createMerchantApiClient().customDomains.update(decodeURIComponent(domain), {
            site_id: resolved.storeId,
            role: 'redirect',
            redirect_to: body.redirect_to ?? null,
        })
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update domain')
    }
}

// DELETE /api/stores/[store]/domains/[domain] — disconnect the domain.
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; domain: string }> }
) {
    try {
        const { store, domain } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const data = await createMerchantApiClient().customDomains.remove(
            decodeURIComponent(domain),
            { site_id: resolved.storeId },
        )
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to remove domain')
    }
}
