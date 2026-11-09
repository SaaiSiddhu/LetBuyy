import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { z } from 'zod'

const AddMandateInputSchema = z.object({
    plan_slug: z.enum(['launch', 'growth', 'scale', 'commerce_os']),
    billing_period: z.enum(['monthly', 'yearly']),
    intent_id: z.string().uuid(),
}).strict()

// GET /api/stores/[store]/billing
// Returns everything the Shopify-style Billing surface needs:
//  - subscription      : current plan + status (StoreSubscriptionState)
//  - upcoming          : known period end; next charge is unquoted
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
        if (!Array.isArray(invoicesPayload.invoices) || !Array.isArray(mandatesPayload.mandates)) {
            throw new Error('Billing history response is incomplete')
        }

        // The current period end is known, but a future charge requires a fresh
        // server quote. The last amount paid is not evidence of the next amount.
        const upcoming = {
            amount_minor: null,
            due_date: subscription?.current_period_end || null,
            currency: 'INR',
            billing_period: subscription?.billing_period || null,
            plan: subscription?.plan || null,
        }

        return NextResponse.json({
            data: {
                subscription,
                trial: { status: trialStatus, ends_at: trialEndsAt },
                upcoming,
                mandates: mandatesPayload.mandates,
                invoices: invoicesPayload.invoices,
                profile: {
                    store_id: storeRecord.id,
                    version: storeRecord.version,
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
// Creates a sandbox billing mandate record for an explicitly selected plan.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const parsed = AddMandateInputSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) {
            return NextResponse.json({ error: { code: 'INVALID_BILLING_MANDATE', message: 'Choose a valid plan and billing period.' } }, { status: 400 })
        }
        const { plan_slug: planSlug, billing_period: billingPeriod, intent_id: intentId } = parsed.data

        const apiClient = createMerchantApiClient()
        const result = await apiClient.billing.mandates.create({
            store_id: resolved.storeId,
            plan_slug: planSlug,
            billing_period: billingPeriod,
            idempotency_key: `mandate:${resolved.storeId}:${intentId}`,
        })

        if (result.mandate?.plan_slug !== planSlug || result.mandate?.billing_period !== billingPeriod) {
            return NextResponse.json({ error: { code: 'MANDATE_INTENT_CONFLICT', message: 'This request key belongs to a different billing selection. Refresh billing before trying again.' } }, { status: 409 })
        }

        return NextResponse.json({ data: result }, { status: result.replayed ? 200 : 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to add payment method')
    }
}
