import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type BillingPlanSlug = 'free' | 'starter' | 'business' | 'enterprise'
type BillingPeriod = 'monthly' | 'yearly'

const PLAN_SLUGS: readonly BillingPlanSlug[] = ['free', 'starter', 'business', 'enterprise']

function isPlanSlug(value: unknown): value is BillingPlanSlug {
    return typeof value === 'string' && (PLAN_SLUGS as readonly string[]).includes(value)
}

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

        // Upcoming bill — the actual next charge. For an active subscription that is
        // the last recorded charge (renews at the same amount); during trial it is ₹0
        // due on the trial end date. Never an estimate or fabricated figure.
        const upcoming = subscription
            ? {
                amount_minor: Number(subscription.amount_paid || 0),
                due_date: subscription.current_period_end || null,
                currency: 'INR',
                billing_period: subscription.billing_period || 'monthly',
                plan: subscription.plan || null,
            }
            : {
                amount_minor: 0,
                due_date: trialEndsAt,
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
// Adds a billing payment method = authorises a Razorpay UPI AutoPay mandate.
// LetBuyy is not an RBI-licensed payment aggregator, so no card/UPI credential is
// stored here — Razorpay holds the instrument and we keep only the mandate handle.
// Body: { plan_slug?, billing_period?, upi_vpa? } (sandbox in non-live environments).
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        const planSlug: BillingPlanSlug = isPlanSlug(body.plan_slug) ? body.plan_slug : 'starter'
        const billingPeriod: BillingPeriod = isBillingPeriod(body.billing_period) ? body.billing_period : 'monthly'
        const upiVpa = readString(body.upi_vpa)

        const apiClient = createMerchantApiClient()
        const result = await apiClient.billing.mandates.create({
            store_id: resolved.storeId,
            plan_slug: planSlug,
            billing_period: billingPeriod,
            ...(upiVpa ? { upi_vpa: upiVpa } : {}),
            idempotency_key: `mandate:${resolved.storeId}:${crypto.randomUUID()}`,
        })

        return NextResponse.json({ data: result }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to add payment method')
    }
}
