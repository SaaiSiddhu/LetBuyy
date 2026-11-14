import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type BillingPeriod = 'monthly' | 'yearly'

function isBillingPeriod(value: unknown): value is BillingPeriod {
    return value === 'monthly' || value === 'yearly'
}

function readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

// GET /api/stores/[store]/billing
// Returns everything the Shopify-style Billing surface needs:
//  - subscription      : current plan + status (StoreSubscriptionState)
//  - upcoming          : next bill amount + due date (computed, no fabrication)
//  - mandates          : billing payment methods (Razorpay UPI AutoPay)
//  - invoices          : past bills (billing_history + GST invoice join)
//  - profile           : GSTIN, GST state, legal name, currency (fixed INR)
// All five reads are gateway calls — this route writes nothing to the DB.
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const apiClient = createMerchantApiClient()
        const storeId = resolved.storeId

        const [subscriptionState, invoicesPayload, mandatesPayload, storeRecord] = await Promise.all([
            apiClient.payments.subscription.get({ store_id: storeId }),
            apiClient.billing.invoices.list({ store_id: storeId, limit: 50 }),
            apiClient.billing.mandates.list({ store_id: storeId }),
            apiClient.stores.get(storeId),
        ])

        const subscription = subscriptionState.subscription || null
        const trialEndsAt = subscriptionState.store?.trial_ends_at || null
        const trialStatus = subscriptionState.store?.trial_status || null

        // Keep cancelled receipts in history without presenting them as new charges.
        const renewable = subscription && ['active', 'trialing'].includes(subscription.status)
        const activeTrial = !subscription && trialStatus === 'active' && trialEndsAt
            && new Date(trialEndsAt).getTime() > Date.now()
        const upcoming = renewable
            ? {
                amount_minor: Number(subscription.amount_paid || 0),
                due_date: subscription.current_period_end || null,
                currency: 'INR',
                billing_period: subscription.billing_period || 'monthly',
                plan: subscription.plan || null,
            }
            : {
                amount_minor: 0,
                due_date: activeTrial ? trialEndsAt : null,
                currency: 'INR',
                billing_period: 'monthly' as const,
                plan: null,
            }

        return NextResponse.json({
            data: {
                subscription,
                trial: { status: trialStatus, ends_at: trialEndsAt },
                upcoming,
                mandates: mandatesPayload.mandates || [],
                invoices: invoicesPayload.invoices || [],
                profile: {
                    gstin: storeRecord.gstin || null,
                    gst_state_code: storeRecord.gst_state_code || null,
                    legal_name: storeRecord.legal_name || null,
                    currency: storeRecord.currency || 'INR',
                },
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load billing data')
    }
}

// POST /api/stores/[store]/billing
// Requests a billing method through the gateway; sandbox setup is a simulation.
// Body: { plan_slug, billing_period, upi_vpa? }; stable X-Idempotency-Key required.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body: unknown = await request.json().catch(() => null)
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'Choose a plan and billing cycle before adding a payment method.' }, { status: 400 })
        }
        const input = body as Record<string, unknown>
        const planSlug = readString(input.plan_slug)
        const billingPeriod = input.billing_period
        const requestKey = request.headers.get('X-Idempotency-Key')?.trim()
        if (!planSlug || planSlug.length > 120 || !isBillingPeriod(billingPeriod)
            || !requestKey || requestKey.length < 8 || requestKey.length > 200) {
            return NextResponse.json({ error: 'Choose a plan and billing cycle, then retry the same payment-method request.' }, { status: 400 })
        }
        const upiVpa = readString(input.upi_vpa)

        const apiClient = createMerchantApiClient()
        const result = await apiClient.billing.mandates.create({
            store_id: resolved.storeId,
            plan_slug: planSlug,
            billing_period: billingPeriod,
            ...(upiVpa ? { upi_vpa: upiVpa } : {}),
            idempotency_key: requestKey,
        })

        return NextResponse.json({ data: result }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to add payment method')
    }
}
