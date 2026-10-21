import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse, merchantApiReadSignal } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(request: NextRequest, { params }: { params: Promise<{ store: string; jobId: string }> }) {
    try {
        const { store, jobId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error
        const payload = await createMerchantApiClient().exports.job(jobId, {
            query: { store_id: resolved.storeId }, signal: merchantApiReadSignal(request.signal),
        })
        return NextResponse.json({ data: payload }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to check export')
    }
}
