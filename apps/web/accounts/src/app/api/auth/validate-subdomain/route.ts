import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Reserved subdomains — must match the DB function
const RESERVED_WORDS = new Set([
    'accounts', 'admin', 'console', 'team', 'api', 'webhooks',
    'www', 'mail', 'ftp', 'localhost', 'letbuyy',
    'seller', 'buyer', 'customer', 'support', 'help', 'contact',
    'about', 'terms', 'privacy', 'policy', 'faq', 'blog', 'press',
    'careers', 'investors', 'partners', 'affiliates', 'legal',
    'store', 'stores', 'shop', 'app', 'dashboard', 'billing',
    'auth', 'login', 'signup', 'register', 'onboarding',
    'static', 'assets', 'cdn', 'media', 'images', 'files',
    'null', 'undefined', 'test', 'demo', 'example', 'staging',
])

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/
const SUBDOMAIN_SHORT_REGEX = /^[a-z0-9]{4,}$/

/**
 * GET /api/auth/validate-subdomain?subdomain=mystore
 * Validates subdomain format, reserved words, and availability.
 */
export async function GET(request: NextRequest) {
    const subdomain = request.nextUrl.searchParams.get('subdomain')?.toLowerCase().trim()

    if (!subdomain) {
        return NextResponse.json(
            { valid: false, reason: 'missing', message: 'Subdomain is required' },
            { status: 400 }
        )
    }

    // Length check
    if (subdomain.length < 4) {
        return NextResponse.json({
            valid: false,
            reason: 'too_short',
            message: 'Must be at least 4 characters',
        })
    }

    if (subdomain.length > 63) {
        return NextResponse.json({
            valid: false,
            reason: 'too_long',
            message: 'Must be at most 63 characters',
        })
    }

    // Format check
    if (!SUBDOMAIN_REGEX.test(subdomain) && !SUBDOMAIN_SHORT_REGEX.test(subdomain)) {
        return NextResponse.json({
            valid: false,
            reason: 'invalid_format',
            message: 'Only lowercase letters, numbers, and hyphens. Must start and end with a letter or number.',
        })
    }

    // Double hyphen check
    if (subdomain.includes('--')) {
        return NextResponse.json({
            valid: false,
            reason: 'double_hyphen',
            message: 'Cannot contain consecutive hyphens',
        })
    }

    // Reserved words check
    if (RESERVED_WORDS.has(subdomain)) {
        return NextResponse.json({
            valid: false,
            reason: 'reserved',
            message: 'This name is reserved',
        })
    }

    // Availability check against DB
    try {
        const supabase = await createServerClient()
        const { data, error } = await supabase
            .from('sites')
            .select('id')
            .or(`subdomain.eq.${subdomain},store_name.eq.${subdomain}`)
            .limit(1)

        if (error) {
            console.error('Subdomain check error:', error)
            return NextResponse.json({
                valid: false,
                reason: 'error',
                message: 'Unable to verify availability',
            }, { status: 500 })
        }

        if (data && data.length > 0) {
            return NextResponse.json({
                valid: false,
                reason: 'taken',
                message: 'This subdomain is already taken',
            })
        }

        return NextResponse.json({
            valid: true,
            reason: 'available',
            message: 'Available!',
        })
    } catch {
        return NextResponse.json({
            valid: false,
            reason: 'error',
            message: 'Unable to verify availability',
        }, { status: 500 })
    }
}
