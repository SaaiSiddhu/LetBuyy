import type { Context } from 'hono';
import type { Env } from '../index';
import { LETBUYY_CHECKOUT_ORIGIN_HEADER, normalizeCheckoutOrigin } from '@letbuyy/checkout-core';
import { centralCheckoutOrigin, checkoutOriginBelongsToSite } from './store-checkout-domain';
import { getSupabaseAdmin } from './supabase';

/** undefined means a pre-v2 central cart; null is refusal. New handoffs must
 * carry their stored and signed origin, and cannot downgrade by dropping it. */
export async function verifyHandoffCheckoutOrigin(c:Context<{Bindings:Env}>,siteId:string,storedOrigin:string|undefined):Promise<string|null|undefined> {
  const declared=c.req.query('checkout_origin');
  const actual=c.req.header(LETBUYY_CHECKOUT_ORIGIN_HEADER);
  if(declared===undefined) {
    if(storedOrigin!==undefined||actual!==undefined&&actual!==centralCheckoutOrigin(c.env))return null;
    return undefined;
  }
  if(normalizeCheckoutOrigin(declared)!==declared||actual!==declared||storedOrigin!==declared)return null;
  return await checkoutOriginBelongsToSite(getSupabaseAdmin(c),c.env,siteId,declared)?declared:null;
}
