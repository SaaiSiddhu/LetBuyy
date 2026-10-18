import type {Context} from 'hono';
import type {Env} from '../index';
import {getSupabaseAdmin,getSupabaseAdminUnguarded} from './supabase';
import {verifySiteOwnership} from './auth-user';

/** Minimal global-ID bootstrap only when no tenant is known. A returned ID is
 * never authority: live ownership precedes every full read and mutation. */
export async function resolveReturnScope(c:Context<{Bindings:Env}>,returnId:string,customUserId:string){
    const signedStore=c.get('auth').user.storeId;
    const hint=signedStore||c.req.header('X-Store-ID')?.trim();
    const db=hint?getSupabaseAdmin(c):getSupabaseAdminUnguarded(c);
    let query=db.from('returns').select('id, site_id, order_id').eq('id',returnId).is('deleted_at',null);
    if(hint)query=query.eq('site_id',hint);
    const {data,error}=await query.maybeSingle();
    if(error)throw new Error('Return scope lookup failed');
    if(!data?.site_id||!data.order_id||!(await verifySiteOwnership(db,data.site_id,customUserId,signedStore)))return null;
    const {data:order,error:orderError}=await getSupabaseAdmin(c).from('orders').select('id')
        .eq('id',String(data.order_id)).eq('store_id',String(data.site_id)).is('deleted_at',null).maybeSingle();
    if(orderError)throw new Error('Return order scope lookup failed');
    if(!order)return null;
    return{id:String(data.id),siteId:String(data.site_id),orderId:String(data.order_id)};
}
