import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendStoreCreationFailedEmail } from '@/lib/email/resend'

/**
 * POST /api/email/store-creation-failure
 * Sends a store creation failure email and logs it.
 */
export async function POST(request: NextRequest) {
    try {
        const { email, storeName, storeType, reason, errorDetails } = await request.json()

        if (!email || !storeName || !storeType || !reason) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const result = await sendStoreCreationFailedEmail(email, storeName, storeType, reason, errorDetails)

        // Log to email_logs table
        try {
            const supabase = await createServerClient()
            await supabase.from('email_logs').insert({
                recipient_email: email,
                email_type: 'store_created_failure',
                subject: `Store creation failed`,
                status: result.success ? 'sent' : 'failed',
                error_message: result.error || null,
                metadata: { storeName, storeType, reason, errorDetails },
            })

            // Also log the onboarding attempt
            await supabase.from('onboarding_attempts').insert({
                requested_name: storeName,
                requested_subdomain: storeName.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                site_type: storeType,
                status: 'failed',
                failure_reason: reason,
                error_details: errorDetails,
            })
        } catch (logErr) {
            console.error('Email/onboarding log error:', logErr)
        }

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Store failure email error:', err)
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }
}
