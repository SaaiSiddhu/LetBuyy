import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// GET /api/stores/[store]/domains — list connected domains (multi-domain + legacy fallback).
// GET /api/stores/[store]/domains?search=<q> — registrar availability search (buy flow).
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const client = createMerchantApiClient()
        const search = request.nextUrl.searchParams.get('search')?.trim()
        if (search) {
            const data = await client.domains.search({ query: search })
            return NextResponse.json({ data })
        }

        const data = await client.customDomains.list({ site_id: resolved.storeId })
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load domains')
    }
}

// POST /api/stores/[store]/domains — connect a domain (creates the DNS challenge).
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = (await request.json().catch(() => ({}))) as { domain?: string }
        const data = await createMerchantApiClient().customDomains.connect({
            site_id: resolved.storeId,
            domain: String(body.domain || ''),
        })
        return NextResponse.json({ data }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to connect domain')
    }
}
