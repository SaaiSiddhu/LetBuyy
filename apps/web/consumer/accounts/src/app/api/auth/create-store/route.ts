import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { validateSession } from '@/lib/auth/session'
import { getSessionCookie } from '@/lib/auth/cookies'
import { validateCsrf } from '@/lib/auth/csrf'

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
        const validSiteTypes = ['store', 'portfolio', 'resume', 'landing', 'blog']
        if (!validSiteTypes.includes(siteType)) {
            return NextResponse.json(
                { error: 'Invalid site type' },
                { status: 400 }
            )
        }

        const normalizedSubdomain = subdomain.toLowerCase().trim()

        const supabase = await createServerClient()

        // Check subdomain availability (race condition guard)
        const { data: existing } = await supabase
            .from('sites')
            .select('id')
            .or(`subdomain.eq.${normalizedSubdomain},store_name.eq.${normalizedSubdomain}`)
            .limit(1)

        if (existing && existing.length > 0) {
            return NextResponse.json(
                { error: 'This subdomain is already taken' },
                { status: 409 }
            )
        }

        const { data: site, error: siteError } = await supabase
            .from('sites')
            .insert({
                custom_user_id: session.userId,
                name: storeName.trim(),
                store_name: normalizedSubdomain,
                subdomain: normalizedSubdomain,
                site_type: siteType,
                status: 'draft',
            })
            .select('id, subdomain, name, site_type, status')
            .single()

        if (siteError) {
            console.error('Store creation error:', siteError)
            return NextResponse.json(
                { error: 'Failed to create store. Please try again.' },
                { status: 500 }
            )
        }

        // Send store creation success email (fire-and-forget)
        try {
            const emailApiUrl = '/api/email/store-creation-success'
            await fetch(new URL(emailApiUrl, request.url), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: session.email,
                    storeName: storeName.trim(),
                    subdomain: normalizedSubdomain,
                    siteType,
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
