import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse, merchantApiReadSignal } from '@/lib/api/client'
import { validateStaffMutationRequest } from '@/lib/staff/request-origin'

// Thin authenticated proxy: account, token, expiry, grants, consent and atomic
// effects remain owned by the canonical Gateway/database invitation flow.
export async function POST(request: NextRequest) {
    const originDenied = validateStaffMutationRequest(request, false)
    if (originDenied) return originDenied
    try {
        const body = await request.json().catch(() => null)
        if (!body || typeof body.token !== 'string' || !['preview', 'accept'].includes(body.action)) {
            return NextResponse.json({ error: { code: 'VALIDATION', message: 'A valid invitation and action are required.' } }, { status: 400 })
        }
        const client = createMerchantApiClient()
        if (body.action === 'preview') return NextResponse.json({ data: await client.employees.previewInvite({ token: body.token }, { signal: merchantApiReadSignal(request.signal) }) })
        const denied = validateStaffMutationRequest(request)
        if (denied) return denied
        const data = await client.employees.acceptInvite({ token: body.token }, { idempotencyKey: request.headers.get('X-Idempotency-Key') || '' })
        return NextResponse.json({ data })
    } catch (error) { return merchantApiErrorResponse(error, 'Unable to process this staff invitation') }
}
