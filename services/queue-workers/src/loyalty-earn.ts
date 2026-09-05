// F-LOY-2 — award loyalty points for paid orders, asynchronously.
//
// WHY THIS IS NOT IN THE PAYMENT RPC. The obvious home is confirm_order_payment_with_ledger, but
// that function runs in ONE transaction: if awarding raised there, the whole capture would roll back
// AFTER the provider had already taken the money, and a persistently-broken loyalty programme would
// make payments unretryable. The Constitution is explicit that the synchronous path performs only
// work required for a correct result — a loyalty accrual is not one.
//
// WHY A SWEEPER AND NOT AN EVENT CONSUMER. confirm_order_payment already emits `payment.confirmed`
// atomically with the order update, so an event exists. But consuming it needs a cursor, and a
// cursor is state that can be wrong. The LEDGER ENTRY IS ITS OWN MARKER: this awards for paid orders
// that have no 'earned' entry yet, so it is idempotent by construction, self-healing after any
// outage, and cannot double-award even if two instances run concurrently — award_loyalty_points is
// keyed on 'loyalty.earn:<order id>' and the ledger's UNIQUE (site_id, idempotency_key) is the
// backstop behind that.
//
// The buyer is resolved from the ESTABLISHED link, never from request input: the order's customer
// email identifies a store_customers row, and buyer_store_customers links it to the platform buyer
// account a verified buyer session created earlier. An order with no linked buyer earns nothing,
// which is correct — there is no account to credit.

import {
    createSupabaseServiceClient,
    type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';

export interface LoyaltyEarnEnv extends SupabaseServiceEnv {
    LOYALTY_EARN_BATCH_LIMIT?: string;
}

export interface LoyaltyEarnInput {
    requestId: string;
    limit?: number;
}

export interface LoyaltyEarnResult {
    scanned: number;
    awarded: number;
    skipped: number;
    failed: number;
    request_id: string;
    results: Array<{ order_id: string; site_id: string; status: 'awarded' | 'skipped' | 'failed'; points: number; reason?: string }>;
}

function batchLimit(env: LoyaltyEarnEnv, requested?: number): number {
    const configured = requested ?? Number(env.LOYALTY_EARN_BATCH_LIMIT || 100);
    if (!Number.isFinite(configured)) return 100;
    return Math.min(Math.max(Math.trunc(configured), 1), 500);
}

export async function runLoyaltyEarnSweeper(
    env: LoyaltyEarnEnv,
    input: LoyaltyEarnInput,
): Promise<LoyaltyEarnResult> {
    const db = createSupabaseServiceClient(env);
    const limit = batchLimit(env, input.limit);
    const results: LoyaltyEarnResult['results'] = [];
    let awarded = 0;
    let skipped = 0;
    let failed = 0;

    // Only sites with an ACTIVE programme are candidates. Scanning every paid order and asking the
    // RPC to decline would work, but it would call it once per order per run forever.
    const { data: programs, error: programError } = await db
        .from('loyalty_programs')
        .select('site_id')
        .eq('is_active', true);
    if (programError) throw programError;

    const siteIds = (programs || []).map((row) => (row as { site_id: string }).site_id);
    if (siteIds.length === 0) {
        return { scanned: 0, awarded: 0, skipped: 0, failed: 0, request_id: input.requestId, results };
    }

    const { data: orders, error: orderError } = await db
        .from('orders')
        .select('id, site_id, customer_email')
        .in('site_id', siteIds)
        .eq('payment_status', 'paid')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (orderError) throw orderError;

    for (const row of orders || []) {
        const order = row as { id: string; site_id: string; customer_email: string | null };

        // The marker: an order that already has an 'earned' entry is done. Checked per order rather
        // than filtered in the query above because PostgREST cannot express "no matching row in
        // another table" without a view, and a wrong filter here would silently skip real awards.
        const { data: existing, error: existingError } = await db
            .from('loyalty_ledger_entries')
            .select('id')
            .eq('order_id', order.id)
            .eq('entry_type', 'earned')
            .maybeSingle();
        if (existingError) {
            failed += 1;
            results.push({ order_id: order.id, site_id: order.site_id, status: 'failed', points: 0, reason: 'lookup_failed' });
            continue;
        }
        if (existing) {
            skipped += 1;
            results.push({ order_id: order.id, site_id: order.site_id, status: 'skipped', points: 0, reason: 'already_awarded' });
            continue;
        }

        if (!order.customer_email) {
            skipped += 1;
            results.push({ order_id: order.id, site_id: order.site_id, status: 'skipped', points: 0, reason: 'no_customer_email' });
            continue;
        }

        const { data: link, error: linkError } = await db
            .from('store_customers')
            .select('id, buyer_store_customers!inner(buyer_account_id)')
            .eq('store_id', order.site_id)
            .ilike('email', order.customer_email)
            .maybeSingle();
        if (linkError) {
            failed += 1;
            results.push({ order_id: order.id, site_id: order.site_id, status: 'failed', points: 0, reason: 'link_lookup_failed' });
            continue;
        }
        const embedded = (link as { buyer_store_customers?: unknown } | null)?.buyer_store_customers;
        const linkRow = (Array.isArray(embedded) ? embedded[0] : embedded) as { buyer_account_id?: string } | undefined;
        const buyerAccountId = linkRow?.buyer_account_id;
        if (!buyerAccountId) {
            // No platform buyer behind this order. Correct to skip: there is no account to credit.
            skipped += 1;
            results.push({ order_id: order.id, site_id: order.site_id, status: 'skipped', points: 0, reason: 'no_linked_buyer' });
            continue;
        }

        // Derived from the order, so a re-run awards once. The ledger's UNIQUE (site_id,
        // idempotency_key) is the backstop if two instances race.
        const { data: outcome, error: awardError } = await db.rpc('award_loyalty_points', {
            p_site_id: order.site_id,
            p_buyer_account_id: buyerAccountId,
            p_order_id: order.id,
            p_idempotency_key: `loyalty.earn:${order.id}`,
            p_request_id: input.requestId,
        });
        if (awardError) {
            // A failure here is retried on the next run, because nothing marks the order as done.
            failed += 1;
            results.push({ order_id: order.id, site_id: order.site_id, status: 'failed', points: 0, reason: 'award_failed' });
            continue;
        }
        const result = (outcome || {}) as { awarded?: boolean; points?: number; reason?: string };
        if (result.awarded) {
            awarded += 1;
            results.push({ order_id: order.id, site_id: order.site_id, status: 'awarded', points: Number(result.points || 0) });
        } else {
            skipped += 1;
            results.push({ order_id: order.id, site_id: order.site_id, status: 'skipped', points: 0, reason: result.reason || 'not_awarded' });
        }
    }

    return { scanned: (orders || []).length, awarded, skipped, failed, request_id: input.requestId, results };
}
