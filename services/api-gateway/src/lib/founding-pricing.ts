import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import type { BillingPlanCatalogRecord, FoundingLock } from '@letbuyy/billing-core';

// Plans eligible for a founding slot / founding price.
const FOUNDING_PLANS = new Set(['launch', 'growth']);

/**
 * Resolve the founding price lock to apply when computing a subscription charge for
 * a site + plan. This is the SINGLE place checkout/renewal pricing consults founding
 * state, so the lock is honored on every charge path (see PRICE_LOCK_VERIFICATION.md):
 *
 *  - Existing founder (sites.price_lock_enabled) → their locked snapshot (renewals,
 *    upgrades, downgrades, reactivations all read this).
 *  - Otherwise, if the program is active with remaining slots and the plan is
 *    founding-eligible → a provisional founding OFFER lock at plan.founding_price_inr
 *    (the merchant pays the founding price up front; allocation snapshots it on success).
 *  - Otherwise → no lock (catalog price).
 *
 * All *_price values are INR minor (paise).
 */
export async function resolveFoundingCheckoutLock(
    db: SupabaseClient,
    siteId: string,
    plan: BillingPlanCatalogRecord,
): Promise<FoundingLock> {
    const { data: site } = await db
        .from('sites')
        .select('price_lock_enabled, locked_launch_price, locked_growth_price')
        .eq('id', siteId)
        .is('deleted_at', null)
        .maybeSingle();

    if (site?.price_lock_enabled) {
        return {
            price_lock_enabled: true,
            is_founding_merchant: true,
            locked_launch_price: (site.locked_launch_price as number | null) ?? null,
            locked_growth_price: (site.locked_growth_price as number | null) ?? null,
        };
    }

    if (FOUNDING_PLANS.has(plan.slug) && Number(plan.founding_price_inr ?? 0) > 0) {
        const { data: program } = await db.rpc('get_founding_program_public');
        const p = (program ?? {}) as Record<string, unknown>;
        if (p.available && p.active && !p.paused && Number(p.remaining_slots ?? 0) > 0) {
            const offer = Number(plan.founding_price_inr);
            return {
                price_lock_enabled: true,
                is_founding_merchant: false,
                locked_launch_price: plan.slug === 'launch' ? offer : null,
                locked_growth_price: plan.slug === 'growth' ? offer : null,
            };
        }
    }

    return { price_lock_enabled: false };
}

/** Reject Scale / Commerce OS (status='coming_soon' or purchasable=false) at checkout. */
export function isPlanPurchasable(plan: BillingPlanCatalogRecord): boolean {
    return plan.purchasable !== false && plan.status !== 'coming_soon';
}
