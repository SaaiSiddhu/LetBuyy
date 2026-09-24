import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { getSessionCookie } from '@/lib/auth/cookies'
import { validateCsrf } from '@/lib/auth/csrf'
import { identityApiRequest } from '@/lib/api/client'
import { getAdminDashboardUrl, getStorefrontUrl } from '@/lib/config/urls'
import { sendStoreCreatedEmail } from '@/lib/email/resend'

const ACTIVE_SITE_TYPES = ['store'] as const
const COMING_SOON_SITE_TYPES = ['landing', 'blog'] as const
const LEGACY_SITE_TYPES = ['portfolio', 'resume'] as const

function legacySiteTypesEnabled(): boolean {
    return process.env.LETBUYY_ENABLE_LEGACY_SITE_TYPES === 'true'
}

function isSupportedSiteType(siteType: string): boolean {
    return [...ACTIVE_SITE_TYPES, ...(legacySiteTypesEnabled() ? LEGACY_SITE_TYPES : [])].includes(
        siteType as (typeof ACTIVE_SITE_TYPES[number] | typeof LEGACY_SITE_TYPES[number])
    )
}

function isComingSoonSiteType(siteType: string): boolean {
    return COMING_SOON_SITE_TYPES.includes(siteType as (typeof COMING_SOON_SITE_TYPES[number]))
}

/**
 * POST /api/auth/create-store
 * Create a new store/site during onboarding.
 * Requires an authenticated session. Creates a `sites` row with trial period.
 */
export async function POST(request: NextRequest) {
    try {
        // Auth check
        const sessionToken = await getSessionCookie()
        if (!sessionToken) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const session = await validateSession(sessionToken)
        if (!session) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
        }

        // CSRF validation
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const body = await request.json()
        const {
            siteType,
            storeName,
            subdomain,
            templateId,
            survey,
        } = body

        // Validate required fields
        if (!siteType || !storeName || !subdomain) {
            return NextResponse.json(
                { error: 'Site type, name, and subdomain are required' },
                { status: 400 }
            )
        }

        // Validate site type
        if (isComingSoonSiteType(siteType)) {
            return NextResponse.json(
                { error: 'Landing pages and blogs are not enabled for publication. Online Store is available today.' },
                { status: 403 }
            )
        }

        if (!isSupportedSiteType(siteType)) {
            return NextResponse.json(
                { error: 'This site type is not available for new stores.' },
                { status: 403 }
            )
        }

        const normalizedSubdomain = subdomain.toLowerCase().trim()

        const storeResponse = await identityApiRequest('/stores', {
            method: 'POST',
            requireSession: true,
            body: JSON.stringify({
                name: storeName.trim(),
                subdomain: normalizedSubdomain,
                site_type: siteType,
                theme_id: templateId || 'modern',
                template_config: {
                    templateId: templateId || null,
                    survey: survey || null,
                },
            }),
        })
        const storePayload = await storeResponse.json().catch(() => null) as {
            data?: {
                id: string
                subdomain: string
                name: string
                site_type: string
                status: string
            }
            error?: { code?: string; message?: string; details?: unknown[] }
        } | null

        if (!storeResponse.ok || !storePayload?.data) {
            const errMsg = storePayload?.error?.message || storeResponse.statusText
            const errDetails = storePayload?.error?.details
            console.error('[create-store] api-gateway error', storeResponse.status, errMsg, errDetails ? JSON.stringify(errDetails) : '')
            return NextResponse.json(
                {
                    error: errMsg || 'Failed to create store. Please try again.',
                    ...(errDetails ? { details: errDetails } : {}),
                },
                { status: storeResponse.status }
            )
        }

        const site = storePayload.data

        // The store-created email, sent here to the merchant this request has already authenticated.
        // It used to be sent by fetching the public /api/email/store-creation-success route, which
        // sent the same branded email for any caller, to any address, with any links (APPID-SEC2).
        // Awaited, because a serverless function may be stopped once it responds; a failure never
        // fails store creation.
        try {
            const storeUrl = getStorefrontUrl(normalizedSubdomain)
            const adminUrl = getAdminDashboardUrl(normalizedSubdomain)
            const result = await sendStoreCreatedEmail(session.email, storeName.trim(), siteType, storeUrl, adminUrl)
            await identityApiRequest('/notifications/email-log', {
                method: 'POST',
                requireSession: true,
                sessionToken,
                body: JSON.stringify({
                    recipient_email: session.email,
                    email_type: 'store_created_success',
                    subject: 'Your LetBuyy workspace was created',
                    status: result.success ? 'sent' : 'failed',
                    error_message: result.error || null,
                    metadata: { storeName: storeName.trim(), storeType: siteType, storeUrl, adminUrl },
                }),
            })
        } catch (emailError) {
            console.error('[create-store] store-created email failed:', emailError instanceof Error ? emailError.message : String(emailError))
        }

        return NextResponse.json({
            success: true,
            store: site,
        })
    } catch (error) {
        // The detail goes to the log, not to the browser: an exception message can carry internal
        // hostnames, query text or configuration.
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[create-store] caught exception:', msg)
        return NextResponse.json(
            { error: 'Something went wrong creating your store. Please try again.' },
            { status: 500 }
        )
    }
}
