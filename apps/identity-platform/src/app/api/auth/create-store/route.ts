import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { getSessionCookie } from '@/lib/auth/cookies'
import { validateCsrf } from '@/lib/auth/csrf'
import { identityApiRequest } from '@/lib/api/client'
import { getAdminDashboardUrl } from '@/lib/config/urls'

const ACTIVE_SITE_TYPES = ['store', 'landing', 'blog'] as const
const LEGACY_SITE_TYPES = ['portfolio', 'resume'] as const

function legacySiteTypesEnabled(): boolean {
    return process.env.LETBUYY_ENABLE_LEGACY_SITE_TYPES === 'true'
}

function isSupportedSiteType(siteType: string): boolean {
    return [...ACTIVE_SITE_TYPES, ...(legacySiteTypesEnabled() ? LEGACY_SITE_TYPES : [])].includes(
        siteType as (typeof ACTIVE_SITE_TYPES[number] | typeof LEGACY_SITE_TYPES[number])
    )
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
        if (!isSupportedSiteType(siteType)) {
            return NextResponse.json(
                { error: 'This site type is not available for new stores.' },
                { status: 400 }
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
            error?: { message?: string }
        } | null

        if (!storeResponse.ok || !storePayload?.data) {
            console.error('Store creation error:', storePayload?.error?.message || storeResponse.statusText)
            return NextResponse.json(
                { error: storePayload?.error?.message || 'Failed to create store. Please try again.' },
                { status: storeResponse.status }
            )
        }

        const site = storePayload.data

        // Send store creation success email (fire-and-forget)
        try {
            const emailApiUrl = '/api/email/store-creation-success'
            await fetch(new URL(emailApiUrl, request.url), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: session.email,
                    storeName: storeName.trim(),
                    storeType: siteType,
                    storeUrl: `https://${normalizedSubdomain}.letbuyy.store`,
                    adminUrl: getAdminDashboardUrl(normalizedSubdomain),
                }),
            })
        } catch {
            // Non-critical — don't fail store creation if email fails
        }

        return NextResponse.json({
            success: true,
            store: site,
        })
    } catch (error) {
        console.error('Create store error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
