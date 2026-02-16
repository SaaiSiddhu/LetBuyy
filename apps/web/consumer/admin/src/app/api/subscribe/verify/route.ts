import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'

/**
 * POST /api/subscribe/verify
 *
 * Verifies Razorpay payment signature and activates subscription.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, store_id, plan_slug, billing_period, site_type }
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            store_id,
            plan_slug,
            billing_period = 'monthly',
            site_type,
            test_mode = false,
        } = body

        if (!store_id || !plan_slug || !site_type) {
            return NextResponse.json(
                { error: 'store_id, plan_slug, and site_type are required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // Verify store ownership
        const { data: store } = await supabase
            .from('sites')
            .select('id, custom_user_id, store_name')
            .eq('id', store_id)
            .single()

        if (!store || store.custom_user_id !== user.id) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
        }

        // Verify Razorpay signature
        if (!test_mode) {
            const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET
            if (!razorpayKeySecret) {
                return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 })
            }

            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                return NextResponse.json({ error: 'Missing payment verification data' }, { status: 400 })
            }

            // HMAC-SHA256: order_id|payment_id
            const encoder = new TextEncoder()
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(razorpayKeySecret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            )

            const payload = `${razorpay_order_id}|${razorpay_payment_id}`
            const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
            const expectedSig = Array.from(new Uint8Array(signatureBytes))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')

            if (expectedSig !== razorpay_signature) {
                return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
            }
        }

        // Fetch plan
        const { data: plan } = await supabase
            .from('plans')
            .select('*')
            .eq('site_type', site_type)
            .eq('slug', plan_slug)
            .eq('is_active', true)
            .single()

        if (!plan) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
        }

        // Calculate period
        const now = new Date()
        const periodEnd = new Date(now)
        if (billing_period === 'yearly') {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1)
        }

        // Promo end date
        let promoEndsAt: string | null = null
        if (plan.promo_price_inr > 0 && plan.promo_months > 0 && billing_period === 'monthly') {
            const promoEnd = new Date(now)
            promoEnd.setMonth(promoEnd.getMonth() + plan.promo_months)
            promoEndsAt = promoEnd.toISOString()
        }

        // Amount
        let amountPaid: number
        if (billing_period === 'yearly') {
            amountPaid = plan.price_yearly_inr * 12
        } else if (promoEndsAt) {
            amountPaid = plan.promo_price_inr
        } else {
            amountPaid = plan.price_monthly_inr
        }

        // Deactivate existing
        await supabase
            .from('subscriptions')
            .update({ status: 'cancelled', cancelled_at: now.toISOString() })
            .eq('store_id', store_id)
            .eq('status', 'active')

        // Create subscription
        const { data: subscription, error: subError } = await supabase
            .from('subscriptions')
            .insert({
                user_id: user.id,
                store_id,
                plan: plan_slug,
                plan_id: plan.id,
                status: 'active',
                billing_period,
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                promo_ends_at: promoEndsAt,
                payment_gateway: 'razorpay',
                external_subscription_id: razorpay_order_id || `test_${Date.now()}`,
                razorpay_order_id: razorpay_order_id || null,
                razorpay_payment_id: razorpay_payment_id || null,
                amount_paid: amountPaid,
                currency: 'INR',
                products_limit: plan.products_limit,
                stores_limit: 1,
            })
            .select()
            .single()

        if (subError) {
            console.error('[API /subscribe/verify] Subscription create error:', subError)
            return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
        }

        // Update store
        await supabase
            .from('sites')
            .update({ trial_status: 'paid', updated_at: now.toISOString() })
            .eq('id', store_id)

        // Billing history
        const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

        await supabase
            .from('billing_history')
            .insert({
                user_id: user.id,
                store_id,
                subscription_id: subscription.id,
                invoice_number: invoiceNumber,
                description: `${plan.name} plan - ${billing_period === 'yearly' ? 'Annual' : 'Monthly'}`,
                amount: amountPaid,
                currency: 'INR',
                tax_amount: Math.round(amountPaid * 0.18),
                total_amount: amountPaid + Math.round(amountPaid * 0.18),
                payment_gateway: 'razorpay',
                payment_id: razorpay_payment_id || null,
                payment_status: 'paid',
                period_start: now.toISOString(),
                period_end: periodEnd.toISOString(),
            })

        return NextResponse.json({
            success: true,
            subscription: {
                id: subscription.id,
                plan: plan_slug,
                plan_name: plan.name,
                status: 'active',
                billing_period,
                current_period_end: periodEnd.toISOString(),
                promo_ends_at: promoEndsAt,
            },
            message: `Successfully subscribed to ${plan.name} plan!`,
        })
    } catch (err) {
        console.error('[API /subscribe/verify] Unexpected error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
