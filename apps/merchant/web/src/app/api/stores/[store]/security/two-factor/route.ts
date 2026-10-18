import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

// GET /api/stores/:store/security/two-factor → GET /2fa (overview: factors + sessions)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const resolved = await merchantSecurityScope(request, params, false)
        if (resolved.error) return resolved.error

        const response = await merchantApiFetch('/2fa', { requireSession: true, headers: resolved.headers })
        const payload = await response.json().catch(() => null)
        return privateSecurityResponse(NextResponse.json(payload, { status: response.status }))
    } catch (err) {
        return privateSecurityResponse(merchantApiErrorResponse(err, 'Unable to load 2FA status'))
    }
}
