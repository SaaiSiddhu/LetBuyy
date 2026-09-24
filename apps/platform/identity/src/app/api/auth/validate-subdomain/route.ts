import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'
import { validateSubdomainFormat } from '@letbuyy/tenant-core'

/**
 * GET /api/auth/validate-subdomain?subdomain=mystore
 * Validates subdomain format, reserved words, and availability.
 */
export async function GET(request: NextRequest) {
    const subdomain = request.nextUrl.searchParams.get('subdomain')?.toLowerCase().trim()
    const format = validateSubdomainFormat(subdomain || '')

    if (!format.valid) {
        return NextResponse.json(format)
    }

    try {
        const response = await identityApiRequest('/auth/custom/subdomains/validate', {
            method: 'POST',
            body: JSON.stringify({ subdomain }),
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
            return NextResponse.json(payload || {
                valid: false,
                reason: 'unverified',
                message: 'Unable to verify availability right now',
            })
        }

        return NextResponse.json(payload || {
            valid: false,
            reason: 'unverified',
            message: 'Unable to verify availability right now',
        })
    } catch {
        return NextResponse.json({
            valid: false,
            reason: 'unverified',
            message: 'Unable to verify availability right now',
        })
    }
}
