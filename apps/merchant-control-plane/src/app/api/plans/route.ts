import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'

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

        const plans = await createMerchantApiClient().payments.plans({
            site_type: siteType,
            ...(slug ? { slug } : {}),
        })

        return NextResponse.json({ plans })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Internal server error')
    }
}
