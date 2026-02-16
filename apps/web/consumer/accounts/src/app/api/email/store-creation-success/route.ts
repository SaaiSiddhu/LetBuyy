import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendStoreCreatedEmail } from '@/lib/email/resend'

/**
 * POST /api/email/store-creation-success
 * Sends a store creation success email and logs it.
 */
export async function POST(request: NextRequest) {
    try {
        const { email, storeName, storeType, storeUrl, adminUrl } = await request.json()

        if (!email || !storeName || !storeType || !storeUrl || !adminUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const result = await sendStoreCreatedEmail(email, storeName, storeType, storeUrl, adminUrl)

        // Log to email_logs table
        try {
            const supabase = await createServerClient()
            await supabase.from('email_logs').insert({
                recipient_email: email,
                email_type: 'store_created_success',
                subject: `🎉 Your store is ready!`,
                status: result.success ? 'sent' : 'failed',
                error_message: result.error || null,
                metadata: { storeName, storeType, storeUrl, adminUrl },
            })
        } catch (logErr) {
            console.error('Email log error:', logErr)
        }

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Store success email error:', err)
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }
}
