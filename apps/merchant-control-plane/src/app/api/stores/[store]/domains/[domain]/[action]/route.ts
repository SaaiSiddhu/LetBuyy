import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// POST /api/stores/[store]/domains/[domain]/{verify|primary}
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; domain: string; action: string }> }
) {
    try {
        const { store, domain, action } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const client = createMerchantApiClient()
        const name = decodeURIComponent(domain)

        if (action === 'verify') {
            const data = await client.customDomains.verify({ site_id: resolved.storeId, domain: name })
            return NextResponse.json({ data })
        }
        if (action === 'primary') {
            const data = await client.customDomains.setPrimary(name, { site_id: resolved.storeId })
            return NextResponse.json({ data })
        }
        return NextResponse.json({ error: 'Unknown domain action' }, { status: 404 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to complete domain action')
    }
}

// GET /api/stores/[store]/domains/[domain]/history
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; domain: string; action: string }> }
) {
    try {
        const { store, domain, action } = await params
        if (action !== 'history') {
            return NextResponse.json({ error: 'Unknown domain action' }, { status: 404 })
        }
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const data = await createMerchantApiClient().customDomains.history(
            decodeURIComponent(domain),
            { site_id: resolved.storeId },
        )
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load domain history')
    }
}
