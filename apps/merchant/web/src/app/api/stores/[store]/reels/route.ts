import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
    try {
        const client = createMerchantApiClient(), session = await client.auth.session()
        if (!session.authenticated || !session.user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
        if (request.headers.get('X-LetBuyy-Merchant-Context') !== session.user.id) return NextResponse.json({ error: { code: 'SESSION_CONTEXT_CHANGED' } }, { status: 409 })
        const { store } = await params, owned = await resolveOwnedStoreId(decodeURIComponent(store))
        if (owned.error) return owned.error
        const page = Number(request.nextUrl.searchParams.get('page') ?? 1)
        if (!Number.isInteger(page) || page < 1 || page > 10000) return NextResponse.json({ error: { code: 'VALIDATION' } }, { status: 400 })
        return NextResponse.json({ data: await client.reels.list(owned.storeId!, page) }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) { return merchantApiErrorResponse(error, 'Unable to load private reels') }
}
