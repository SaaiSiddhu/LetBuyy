import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { ProductCsvImportSchema } from '@letbuyy/shared-types'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json().catch(() => null)
        if (!body || typeof body.csv !== 'string') return NextResponse.json({ error: { message: 'A product CSV is required.' } }, { status: 400 })
        const input = {
            store_id: resolved.storeId,
            csv: body.csv,
        }
        if (JSON.stringify(input).length > 1_048_576) return NextResponse.json({ error: { message: 'This CSV is too large. Split it into smaller files.' } }, { status: 413 })
        const parsed = ProductCsvImportSchema.safeParse(input)
        if (!parsed.success) return NextResponse.json({ error: { message: 'A valid product CSV is required.' } }, { status: 400 })
        const payload = await createMerchantApiClient().products.importCsv(parsed.data)

        return NextResponse.json({ data: payload }, { status: 202 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to import products')
    }
}
