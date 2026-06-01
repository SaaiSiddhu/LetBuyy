import { NextRequest, NextResponse } from 'next/server'
import type { UpdateFormSubmissionInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; submissionId: string }> }
) {
    try {
        const { store, submissionId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const payload = await createMerchantApiClient().formSubmissions.update(
            submissionId,
            body as UpdateFormSubmissionInput
        )

        return NextResponse.json({
            success: true,
            data: payload,
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update form submission')
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; submissionId: string }> }
) {
    try {
        const { store, submissionId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().formSubmissions.remove(submissionId)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to delete form submission')
    }
}
