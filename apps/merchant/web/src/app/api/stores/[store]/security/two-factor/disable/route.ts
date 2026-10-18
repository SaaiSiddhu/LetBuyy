import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

// POST /api/stores/:store/security/two-factor/disable → POST /2fa/disable
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const resolved = await merchantSecurityScope(request, params)
        if (resolved.error) return resolved.error

        const body = await request.json()
        const response = await merchantApiFetch('/2fa/disable', {
            method: 'POST',
            requireSession: true,
            headers: resolved.headers,
            body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => null)
        return privateSecurityResponse(NextResponse.json(payload, { status: response.status }))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Unable to disable 2FA factor'))
    }
}
