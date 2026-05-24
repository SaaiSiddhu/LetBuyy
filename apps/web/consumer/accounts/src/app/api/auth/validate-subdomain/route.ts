import { NextRequest, NextResponse } from 'next/server'
import { accountWorkerFetch } from '@/lib/api/worker-client'

/**
 * GET /api/auth/validate-subdomain?subdomain=mystore
 * Validates subdomain format, reserved words, and availability.
 */
export async function GET(request: NextRequest) {
    const subdomain = request.nextUrl.searchParams.get('subdomain')?.toLowerCase().trim()
    try {
        const response = await accountWorkerFetch('/auth/custom/subdomains/validate', {
            method: 'POST',
            body: JSON.stringify({ subdomain }),
        })
        const payload = await response.json().catch(() => null)
        return NextResponse.json(payload || {
            valid: false,
            reason: 'error',
            message: 'Unable to verify availability',
        }, { status: response.status })
    } catch {
        return NextResponse.json({
            valid: false,
            reason: 'error',
            message: 'Unable to verify availability',
        }, { status: 500 })
    }
}
