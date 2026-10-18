import { NextRequest, NextResponse } from 'next/server'
import type { CreateEmployeeInput, CreateStaffInvitationInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { validateStaffMutationRequest } from '@/lib/staff/request-origin'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const apiClient = createMerchantApiClient()
        // Staff list + plan seat usage. The limit is best-effort: if it fails the
        // page still renders the roster (the gateway POST stays authoritative on the cap).
        const [employees, limit] = await Promise.all([
            apiClient.employees.list({ store_id: resolved.storeId }),
            apiClient.employees.limits({ store_id: resolved.storeId }).catch(() => null),
        ])

        return NextResponse.json({ success: true, data: { employees, limit } })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load staff')
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    const denied = validateStaffMutationRequest(request)
    if (denied) return denied
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const client = createMerchantApiClient()
        const input = { ...body, store_id: resolved.storeId }
        const options = { idempotencyKey: request.headers.get('X-Idempotency-Key') || '' }
        const payload = body.invitation === true
            ? await client.employees.invite(input as CreateStaffInvitationInput, options)
            : await client.employees.create(input as CreateEmployeeInput, options)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to add staff')
    }
}
