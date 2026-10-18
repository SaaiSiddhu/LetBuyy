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
// The buyer is the order's EXPLICIT owner (buyer_order_links, migration 255): the buyer whose own
// authenticated checkout placed it, or a buyer who verified the order's contact address and claimed
// it. Never an email match. Until 255 this read store_customers.email -> buyer_store_customers, and
// that link was created without anyone proving the address, so registering someone else's email was
// enough to collect their points. An order nobody owns earns nothing, which is correct: there is no
// account to credit, and the sweep will award it on the run after its owner claims it.

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

    // The database excludes completed and ineligible work BEFORE applying the
    // batch limit. Limiting the newest paid orders first stranded older orders
    // forever once that window was already earned. Discovery shares the award
    // calculation and never supplies a point amount or a mutable balance.
    const { data: orders, error: orderError } = await db.rpc('pending_loyalty_earn_orders_v1', { p_limit: limit });
    if (orderError) throw orderError;
    if (!Array.isArray(orders) || orders.some(row => !row || typeof row.id !== 'string' || typeof row.site_id !== 'string')) {
        throw new Error('Unexpected loyalty earning discovery response');
    }

    for (const row of orders || []) {
        const order = row as { id: string; site_id: string };

        // Recheck the marker in case another worker completed this candidate
        // after discovery. The authoritative RPC also binds source and replay.
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

        const { data: link, error: linkError } = await db
            .from('buyer_order_links')
            .select('buyer_account_id')
            .eq('order_id', order.id)
            .maybeSingle();
        if (linkError) {
            failed += 1;
            results.push({ order_id: order.id, site_id: order.site_id, status: 'failed', points: 0, reason: 'link_lookup_failed' });
            continue;
        }
        const buyerAccountId = (link as { buyer_account_id?: string } | null)?.buyer_account_id;
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
