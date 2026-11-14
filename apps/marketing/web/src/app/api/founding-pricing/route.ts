import { NextResponse } from 'next/server'
import { loadPublicPricing } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function GET() {
    const data = await loadPublicPricing()
    return data
        ? NextResponse.json({ data })
        : NextResponse.json({ error: 'Pricing is temporarily unavailable. Please try again later.' }, { status: 502 })
}
