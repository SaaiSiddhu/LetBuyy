import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'

/**
 * GET /api/subscribe/status?payment_id=pay_xxx
 * 
 * Polls Razorpay for the status of a payment (used after S2S UPI collect).
 * Client polls this endpoint until status === 'captured' or 'authorized'.
 */

const RAZORPAY_BASE = 'https://api.razorpay.com/v1'

export async function GET(request: NextRequest) {
    try {
        const user = await getSessionUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const paymentId = request.nextUrl.searchParams.get('payment_id')
        if (!paymentId) {
            return NextResponse.json({ error: 'payment_id is required' }, { status: 400 })
        }

        // Test mode
        if (paymentId.startsWith('pay_test_')) {
            return NextResponse.json({
                id: paymentId,
                status: 'captured',
                method: 'upi',
            })
        }

        const keyId = process.env.RAZORPAY_KEY_ID
        const keySecret = process.env.RAZORPAY_KEY_SECRET

        if (!keyId || !keySecret) {
            return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 })
        }

        const res = await fetch(`${RAZORPAY_BASE}/payments/${paymentId}`, {
            headers: {
                Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
            },
        })

        if (!res.ok) {
            const errData = await res.json()
            console.error('[API /subscribe/status] Error:', errData)
            return NextResponse.json({ error: 'Failed to fetch payment status' }, { status: 500 })
        }

        const payment = await res.json() as { id: string; status: string; method: string; order_id: string; error_code: string | null; error_description: string | null }

        return NextResponse.json({
            id: payment.id,
            status: payment.status,
            method: payment.method,
            order_id: payment.order_id,
            error_code: payment.error_code,
            error_description: payment.error_description,
        })
    } catch (err) {
        console.error('[API /subscribe/status] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
