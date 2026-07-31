import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string; email: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
        const { store, email } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const decodedEmail = decodeURIComponent(email)
        const notes = await createMerchantApiClient().customers.notes.list(
            decodedEmail,
            { store_id: resolved.storeId },
        )
        return NextResponse.json({ data: notes })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load customer notes')
    }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { store, email } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const decodedEmail = decodeURIComponent(email)
        const body = await request.json() as { note: string }
        const note = await createMerchantApiClient().customers.notes.create(decodedEmail, {
            store_id: resolved.storeId,
            note: body.note,
        })
        return NextResponse.json({ data: note }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to create customer note')
    }
}
