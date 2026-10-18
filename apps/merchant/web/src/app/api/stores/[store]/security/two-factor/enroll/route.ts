import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

// POST /api/stores/:store/security/two-factor/enroll → POST /2fa/totp/enroll
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const resolved = await merchantSecurityScope(request, params)
        if (resolved.error) return resolved.error

        const response = await merchantApiFetch('/2fa/totp/enroll', {
            method: 'POST',
            requireSession: true,
            headers: resolved.headers,
            body: '{}',
        })
        const payload = await response.json().catch(() => null)
        return privateSecurityResponse(NextResponse.json(payload, { status: response.status }))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'TOTP enrollment failed'))
    }
}
