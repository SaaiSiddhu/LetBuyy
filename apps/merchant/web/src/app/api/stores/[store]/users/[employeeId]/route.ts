import { NextRequest, NextResponse } from 'next/server'
import type { UpdateEmployeeInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { validateStaffMutationRequest } from '@/lib/staff/request-origin'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; employeeId: string }> }
) {
    const denied = validateStaffMutationRequest(request)
    if (denied) return denied
    try {
        const { store, employeeId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const payload = await createMerchantApiClient().employees.update(employeeId, { ...body, store_id: resolved.storeId } as UpdateEmployeeInput, { idempotencyKey: request.headers.get('X-Idempotency-Key') || '' })

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update staff member')
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; employeeId: string }> }
) {
    const denied = validateStaffMutationRequest(request)
    if (denied) return denied
    try {
        const { store, employeeId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const payload = await createMerchantApiClient().employees.remove(employeeId, {
            idempotencyKey: request.headers.get('X-Idempotency-Key') || '',
            body: { expected_updated_at: body.expected_updated_at, store_id: resolved.storeId },
        })

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to remove staff member')
    }
}
