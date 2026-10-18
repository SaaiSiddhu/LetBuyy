import type {getSupabaseAdmin} from './supabase';

/** Fast restoration of verified whole-order tender. A partial cash refund
 * cannot release the entire gift-card redemption. Durable catch-up is N6. */
export async function tryRestoreGiftCardForReversedOrder(db:ReturnType<typeof getSupabaseAdmin>,
    input:{siteId:string;orderId:string;userId?:string|null;requestId?:string|null},source:unknown):Promise<void>{
    if(!source||typeof source!=='object'||Array.isArray(source))return;
    const order=source as Record<string,unknown>;
    if(order.id!==input.orderId||order.store_id!==input.siteId||!['cancelled','refunded'].includes(String(order.status)))return;
    try{
        const {error}=await db.rpc('restore_gift_card_on_refund',{p_store_id:input.siteId,p_order_id:input.orderId,
            p_actor_id:input.userId??null,p_request_id:input.requestId??null});
        if(error)throw new Error('Gift-card restoration unavailable');
    }catch{
        console.warn(JSON.stringify({level:'warn',event:'gift_card_refund_restore_pending',site_id:input.siteId,
            order_id:input.orderId,request_id:input.requestId??null}));
    }
}
