import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'

/**
 * GET /api/plans?site_type=store&slug=starter
 *
 * Fetches active subscription plans through the Hono worker.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const siteType = searchParams.get('site_type')
        const slug = searchParams.get('slug')

        if (!siteType) {
            return NextResponse.json(
                { error: 'site_type parameter is required' },
                { status: 400 }
            )
        }

        const query = new URLSearchParams({ site_type: siteType })
        if (slug) query.set('slug', slug)

        const workerResponse = await workerFetch(`/payments/plans?${query.toString()}`, {
            method: 'GET',
            requireSession: true,
        })
        const payload = await readWorkerJson(workerResponse) as { data?: unknown[] }

        return NextResponse.json({ plans: payload.data || [] })
    } catch (err) {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
