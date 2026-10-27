import type { Hono, Context } from 'hono';
import { MerchantBuyerConnectionStartSchema, MerchantBuyerConnectionConfirmSchema, MerchantBuyerConnectionCancelSchema } from '@letbuyy/auth-core';
import type { Env } from '../index';
import { getSupabaseAdmin } from '../lib/supabase';
import { validateMerchantSessionToken } from '../lib/merchant-session';
import { sendBuyerEmailCode } from '../lib/buyer-email-code';
import { AppError } from '../lib/errors';

type AuthContext = Context<{Bindings:Env}>;
const invalid = () => new AppError('Unable to connect this account. Start again from your store.',401,'ACCOUNT_CONNECTION_INVALID');
/** No Buyer API accepts Merchant tokens. Only the issuer's signed account boundary
 * may start this inbox-proven connection using its fresh, browser-invisible Merchant session. */
export function registerMerchantBuyerConnectionRoutes(router:Hono<{Bindings:Env}>, requireAccounts:(c:AuthContext)=>Promise<Response|null>) {
 router.post('/custom/buyer-connections/start',async c=>{
  const denied=await requireAccounts(c); if(denied)return denied;
  const body=MerchantBuyerConnectionStartSchema.safeParse(await c.req.json().catch(()=>null));
  if(!body.success)throw invalid();
  const db=getSupabaseAdmin(c),session=await validateMerchantSessionToken(db,body.data.merchant_session_token,{rotate:false});
  if(!session.accepted||!session.sessionId)throw invalid();
  const {data,error}=await db.rpc('start_merchant_buyer_connection',{p_session_id:session.sessionId,p_verifier_hash:body.data.verifier_hash,p_request_hash:body.data.request_hash});
  if(error)throw new AppError('Account connection is temporarily unavailable.',503,'ACCOUNT_CONNECTION_UNAVAILABLE');
  const result=data as {outcome?:string;intent_id?:string;email?:string;code?:string;expires_at?:string}|null;
  if(result?.outcome!=='started'||!result.intent_id||!result.email||!result.code)throw invalid();
  const delivery=await sendBuyerEmailCode(c.env,{email:result.email,code:result.code,purpose:'connect_merchant'});
  if(!delivery.sent){
   await db.rpc('consume_merchant_buyer_connection',{p_intent_id:result.intent_id,p_verifier_hash:body.data.verifier_hash,p_request_hash:body.data.request_hash,p_code:null,p_consent:false,p_cancel:true});
   throw new AppError('We could not send the connection email. Please try again later.',503,'ACCOUNT_CONNECTION_EMAIL_UNAVAILABLE');
  }
  c.header('Cache-Control','no-store');
  return c.json({data:{intent_id:result.intent_id,email:result.email,expires_at:result.expires_at}});
 });
 router.post('/custom/buyer-connections/confirm',async c=>{
  const denied=await requireAccounts(c);if(denied)return denied;
  const body=MerchantBuyerConnectionConfirmSchema.safeParse(await c.req.json().catch(()=>null));if(!body.success)throw invalid();
  const v=body.data;
  const {data,error}=await getSupabaseAdmin(c).rpc('consume_merchant_buyer_connection',{p_intent_id:v.intent_id,p_verifier_hash:v.verifier_hash,p_request_hash:v.request_hash,p_code:v.code,p_consent:v.consent,p_cancel:false});
  if(error)throw new AppError('Account connection is temporarily unavailable.',503,'ACCOUNT_CONNECTION_UNAVAILABLE');
  const result=data as {outcome?:string;buyer?:{id:string;email:string;status:string;session_epoch:number}}|null;
  if(result?.outcome!=='connected'||!result.buyer)throw invalid();
  c.header('Cache-Control','no-store');return c.json({data:{buyer:result.buyer}});
 });
 router.post('/custom/buyer-connections/cancel',async c=>{
  const denied=await requireAccounts(c);if(denied)return denied;
  const body=MerchantBuyerConnectionCancelSchema.safeParse(await c.req.json().catch(()=>null));if(!body.success)throw invalid();
  const v=body.data;const {error}=await getSupabaseAdmin(c).rpc('consume_merchant_buyer_connection',{p_intent_id:v.intent_id,p_verifier_hash:v.verifier_hash,p_request_hash:v.request_hash,p_code:null,p_consent:false,p_cancel:true});
  if(error)throw new AppError('Account connection is temporarily unavailable.',503,'ACCOUNT_CONNECTION_UNAVAILABLE');
  c.header('Cache-Control','no-store');return c.json({data:{cancelled:true}});
 });
}
