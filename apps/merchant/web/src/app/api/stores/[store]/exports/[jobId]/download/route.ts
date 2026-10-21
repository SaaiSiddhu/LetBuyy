import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse, merchantApiFetch, merchantApiReadSignal } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(request: NextRequest, { params }: { params: Promise<{ store: string; jobId: string }> }) {
    try {
        const { store, jobId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error
        const { job } = await createMerchantApiClient().exports.job(jobId, {
            query: { store_id: resolved.storeId }, signal: merchantApiReadSignal(request.signal),
        })
        if (job.id !== jobId || job.status !== 'completed' || job.type === 'product_import') {
            return NextResponse.json({ error: { message: 'Export is not ready' } }, { status: 409 })
        }
        // Take only the opaque signature. Never fetch an upstream-provided URL.
        const token = new URL(job.download_url).searchParams.get('token')
        if (!token) throw new Error('Missing export signature')
        const query = new URLSearchParams({ store_id: resolved.storeId, token })
        const upstream = await merchantApiFetch(`/export/jobs/${encodeURIComponent(jobId)}/download?${query}`, {
            requireSession: true, signal: request.signal, readTimeoutMs: 60_000, redirect: 'error',
        })
        if (!upstream.ok) {
            await upstream.body?.cancel()
            return NextResponse.json({ error: { message: 'Export download unavailable' } }, { status: upstream.status })
        }
        return new Response(upstream.body, { headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${job.type}.csv"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        } })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to download export')
    }
}
