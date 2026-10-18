import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const resolved = await merchantSecurityScope(request, params)
        if (resolved.error) return resolved.error

        const body = await request.json()
        if (body.idempotency_key !== request.headers.get('X-Idempotency-Key')) return privateSecurityResponse(NextResponse.json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'The command keys must match.' } }, { status: 400 }))

        const response = await merchantApiFetch('/security/step-up/challenges', {
            method: 'POST',
            requireSession: true,
            headers: resolved.headers,
            body: JSON.stringify({ ...body, store_id: resolved.storeId }),
        })

        const payload = await response.json().catch(() => null)
        return privateSecurityResponse(NextResponse.json(payload, { status: response.status }))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Step-up challenge failed'))
    }
}
