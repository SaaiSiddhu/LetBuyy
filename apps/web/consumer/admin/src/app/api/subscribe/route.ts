import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'

/**
 * POST /api/subscribe
 *
 * Creates a Razorpay Order for checkout.
 * Body: { store_id, plan_slug, billing_period, site_type }
 */

const RAZORPAY_BASE = 'https://api.razorpay.com/v1'

export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { store_id, plan_slug, billing_period = 'monthly', site_type } = body

        if (!store_id || !plan_slug || !site_type) {
            return NextResponse.json(
                { error: 'store_id, plan_slug, and site_type are required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // Verify store ownership
        const { data: store, error: storeError } = await supabase
            .from('sites')
            .select('id, custom_user_id, subdomain, name')
            .eq('id', store_id)
            .single()

        if (storeError || !store) {
            return NextResponse.json({ error: 'Store not found' }, { status: 404 })
        }

        if (store.custom_user_id !== user.id) {
            return NextResponse.json({ error: 'Not authorized for this store' }, { status: 403 })
        }

        // Fetch plan
        const { data: plan, error: planError } = await supabase
            .from('plans')
            .select('*')
            .eq('site_type', site_type)
            .eq('slug', plan_slug)
            .eq('is_active', true)
            .single()

        if (planError || !plan) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
        }

        if (plan.requires_contact) {
            return NextResponse.json(
                { error: 'This plan requires contacting sales' },
                { status: 400 }
            )
        }

        // Calculate amount in paise
        let amountPaise: number
        const hasPromo = plan.promo_price_inr > 0 && plan.promo_months > 0

        if (billing_period === 'yearly') {
            amountPaise = plan.price_yearly_inr * 12
        } else {
            amountPaise = hasPromo ? plan.promo_price_inr : plan.price_monthly_inr
        }

        const razorpayKeyId = process.env.RAZORPAY_KEY_ID
        const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET

        if (!razorpayKeyId || !razorpayKeySecret) {
            // Dev/test mode — mock order
            return NextResponse.json({
                razorpay_order_id: `order_test_${Date.now()}`,
                amount: amountPaise,
                currency: 'INR',
                key_id: 'rzp_test_mock',
                plan: {
                    id: plan.id,
                    name: plan.name,
                    slug: plan.slug,
                    price_monthly_inr: plan.price_monthly_inr,
                    price_yearly_inr: plan.price_yearly_inr,
                    promo_price_inr: plan.promo_price_inr,
                    promo_months: plan.promo_months,
                },
                billing_period,
                is_promo: hasPromo && billing_period === 'monthly',
                test_mode: true,
            })
        }

        // Create Razorpay Order
        const orderRes = await fetch(`${RAZORPAY_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
            },
            body: JSON.stringify({
                amount: amountPaise,
                currency: 'INR',
                receipt: `sub_${store_id.slice(-8)}_${Date.now()}`,
                notes: {
                    store_id,
                    plan_slug,
                    billing_period,
                    user_id: user.id,
                },
            }),
        })

        if (!orderRes.ok) {
            const errData = await orderRes.json()
            console.error('[API /subscribe] Razorpay error:', errData)
            return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
        }

        const order = await orderRes.json() as { id: string }

        return NextResponse.json({
            razorpay_order_id: order.id,
            amount: amountPaise,
            currency: 'INR',
            key_id: razorpayKeyId,
            plan: {
                id: plan.id,
                name: plan.name,
                slug: plan.slug,
                price_monthly_inr: plan.price_monthly_inr,
                price_yearly_inr: plan.price_yearly_inr,
                promo_price_inr: plan.promo_price_inr,
                promo_months: plan.promo_months,
            },
            billing_period,
            is_promo: hasPromo && billing_period === 'monthly',
        })
    } catch (err) {
        console.error('[API /subscribe] Unexpected error:', err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Internal server error' },
            { status: 500 }
        )
    }
}
