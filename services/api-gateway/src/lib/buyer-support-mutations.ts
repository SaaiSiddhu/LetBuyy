import type { AppContext } from '../routes/storefront/customer-engagement-routes';
import { getSupabaseAdmin } from './supabase';
import { getBuyerSession } from '../middleware/buyer-session';
import { getStorefrontBuyerSession } from '../middleware/storefront-buyer-session';
import { addBusinessDays, generateTicketRef } from '../routes/operations/support';
import { SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS, SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS } from '@letbuyy/shared-types';

export interface BuyerSupportMutation {
    operation: 'create' | 'reply';
    targetId: string | null;
    key: string;
    payload: { body: string; subject?: string; site_id?: string | null; order_id?: string | null };
}

/** Canonical SDK sends X-Idempotency-Key; conventional clients may use
 * Idempotency-Key. Conflicting spellings are never silently resolved. Old web
 * clients without a key retain one request/one action behavior, not a claimed
 * restart/retry guarantee. New native commands always persist and send a key. */
export function buyerSupportRequestKey(headers: Headers): string {
    const canonical = headers.get('X-Idempotency-Key');
    const conventional = headers.get('Idempotency-Key');
    if (canonical !== null && conventional !== null && canonical !== conventional) throw new Error('Invalid support request key');
    const key = canonical ?? conventional ?? `legacy-${crypto.randomUUID()}`;
    if (key.length < 8 || key.length > 200 || key.trim() !== key || /[\x00-\x1f\x7f]/.test(key)) throw new Error('Invalid support request key');
    return key;
}

/** Only the authenticated contexts supply the buyer and signed epoch. The RPC
 * rechecks both atomically before new effects or a recorded response. */
export async function executeBuyerSupportMutation(c: AppContext, input: BuyerSupportMutation) {
    const buyer = getBuyerSession(c);
    const storefront = getStorefrontBuyerSession(c);
    const epoch = buyer?.sessionEpoch ?? (storefront?.buyerAccountId === buyer?.buyerAccountId ? storefront?.sessionEpoch : undefined);
    if (!buyer || epoch === undefined) return { data: null, error: { code: 'PT401' } };
    const now = new Date();
    return getSupabaseAdmin(c).rpc('execute_buyer_support_mutation', {
        p_buyer_account_id: buyer.buyerAccountId,
        p_session_epoch: epoch,
        p_operation: input.operation,
        p_target_id: input.targetId,
        p_idempotency_key: input.key,
        p_payload: input.payload,
        p_ticket_ref: generateTicketRef(now),
        p_first_response_due_at: new Date(now.getTime() + SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS * 3600000).toISOString(),
        p_resolution_due_at: addBusinessDays(now, SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS).toISOString(),
    });
}

/** Web recovery is read-only. Its site comes from the verified host-bound
 * storefront session, never from the browser's saved metadata or JSON. */
export async function readBuyerSupportMutationReceipt(c: AppContext, input: Pick<BuyerSupportMutation, 'operation' | 'targetId' | 'key'>) {
    const buyer = getBuyerSession(c), storefront = getStorefrontBuyerSession(c);
    if (!buyer || !storefront || storefront.buyerAccountId !== buyer.buyerAccountId) return { data: null, error: { code: 'PT401' } };
    return getSupabaseAdmin(c).rpc('read_buyer_support_mutation_receipt', {
        p_buyer_account_id: buyer.buyerAccountId, p_session_epoch: storefront.sessionEpoch,
        p_site_id: storefront.siteId, p_operation: input.operation, p_target_id: input.targetId, p_idempotency_key: input.key,
    });
}
