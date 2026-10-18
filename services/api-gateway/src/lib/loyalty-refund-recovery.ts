import type { getSupabaseAdmin } from './supabase';

/** Fast path only. The canonical ledger discovery in queue-workers repairs
 * committed reversals even when this request is lost or never retried. */
export async function tryRestoreRedeemedLoyalty(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: { siteId: string; orderId: string; userId?: string | null; requestId?: string | null },
): Promise<void> {
    try {
        const { error } = await db.rpc('restore_loyalty_on_refund', {
            p_site_id: input.siteId, p_order_id: input.orderId,
            p_actor_id: input.userId ?? null, p_request_id: input.requestId ?? null,
        });
        if (error) throw new Error('Loyalty restoration unavailable');
    } catch {
        console.warn(JSON.stringify({ level: 'warn', event: 'loyalty_refund_restore_pending',
            site_id: input.siteId, order_id: input.orderId, request_id: input.requestId ?? null,
            recovery_owner: 'services/queue-workers' }));
    }
}
