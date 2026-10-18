import {z} from 'zod';
import type {SupabaseClient} from '@letbuyy/infrastructure/supabase-adapter';
import {AppError} from './errors';
import {fetchRazorpayPlan,fetchRazorpayPayment,fetchRazorpayInvoice,fetchRazorpaySubscription,type RazorpayCredentials} from '@letbuyy/infrastructure/razorpay-adapter';
import {SubscriptionTaxSnapshotSchema,SubscriptionImmediateChargeScheduleSchema,SubscriptionInvoiceEvidenceSchema,resolveSubscriptionInvoiceTaxPhase,type SubscriptionInvoiceEvidence,planSubscriptionTaxSnapshot,subscriptionTaxSummary,type SubscriptionTaxSnapshot,type BillingPlanCatalogRecord,type SubscriptionBillingPeriod} from '@letbuyy/billing-core';

const ProviderPlanBinding=z.object({schema_version:z.literal(1),provider_plan_id:z.string().regex(/^plan_[A-Za-z0-9]+$/).max(120),
 base_gross_minor:z.number().int().safe().positive().max(2147483647),currency:z.literal('INR'),
 billing_period:z.enum(['monthly','yearly']),interval:z.literal(1),tax_configuration:z.literal('no_additional_tax')}).strict();
export async function requireConfiguredSubscriptionPlan(credentials:RazorpayCredentials,input:{planId:string;baseGross:number;period:SubscriptionBillingPeriod}){
 const fail=()=>new AppError('The configured recurring plan does not match this subscription quote. Ask support to review billing setup.',503,'SUBSCRIPTION_TAX_SETUP_REQUIRED');
 const args=z.object({planId:z.string().regex(/^plan_[A-Za-z0-9]+$/).max(120),baseGross:z.number().int().safe().positive().max(2147483647),period:z.enum(['monthly','yearly'])}).safeParse(input);
 if(!args.success)throw fail();
 let plan:Awaited<ReturnType<typeof fetchRazorpayPlan>>;
 try{plan=await fetchRazorpayPlan(credentials,input.planId);}catch{throw fail();}
 const parsed=z.object({id:z.literal(input.planId),entity:z.literal('plan'),interval:z.literal(1),period:z.literal(input.period),
  item:z.object({active:z.literal(true),amount:z.number().int().safe().positive().max(2147483647),currency:z.literal('INR'),
   tax_rate:z.number().finite().nullable().optional(),tax_id:z.string().nullable().optional(),tax_group_id:z.string().nullable().optional(),tax_inclusive:z.boolean().optional()}).passthrough(),
  error:z.never().optional()}).passthrough().safeParse(plan);
 if(!parsed.success||parsed.data.item.amount!==input.baseGross||!([undefined,null,0] as unknown[]).includes(parsed.data.item.tax_rate)
  ||parsed.data.item.tax_id!=null||parsed.data.item.tax_group_id!=null)throw fail();
 return ProviderPlanBinding.parse({schema_version:1,provider_plan_id:input.planId,base_gross_minor:input.baseGross,currency:'INR',
  billing_period:input.period,interval:1,tax_configuration:'no_additional_tax'});
}

const Plan=z.object({id:z.string(),slug:z.string(),name:z.string()}).passthrough();
const PaidQuote=z.object({plan:Plan,
 mode:z.enum(['razorpay_order','razorpay_subscription','sandbox_activation']),amount_minor:z.number().optional(),currency:z.literal('INR').optional(),
 response:z.record(z.string(),z.unknown()).optional(),provider_input:z.record(z.string(),z.unknown()).optional()}).passthrough();
const PaidCharge=z.object({id:z.string().uuid().optional(),site_id:z.string().uuid().optional(),user_id:z.string().uuid().optional(),
 billing_period:z.enum(['monthly','yearly']).optional(),payment_status:z.string().optional(),subscription_id:z.string().uuid().nullable().optional(),
 legacy_completed:z.boolean().optional(),retained_invoice_evidence:SubscriptionInvoiceEvidenceSchema.nullable().optional(),subscription_tax_snapshot:SubscriptionTaxSnapshotSchema.nullable().optional(),amount:z.number().int().positive(),currency:z.literal('INR'),
 subscription_checkout_key:z.string().optional(),subscription_checkout_request:z.record(z.string(),z.unknown()).optional(),
 subscription_checkout_reference:z.string().nullable(),subscription_checkout:PaidQuote});
const FreeCharge=z.object({id:z.string().uuid(),amount:z.literal(0),currency:z.literal('INR'),
 payment_gateway:z.null(),provider_payment_reference:z.null().optional(),
 subscription_checkout_key:z.string().min(1).max(200),
 subscription_checkout_request:z.object({plan_slug:z.string().min(1),site_type:z.string().min(1),
  billing_period:z.enum(['monthly','yearly']),approved_usage_charges:z.array(z.unknown()),coupon_code:z.string().nullable()}),
 subscription_checkout_reference:z.string(),subscription_checkout:z.object({plan:Plan,mode:z.literal('free_activation'),
  amount_minor:z.literal(0),currency:z.literal('INR'),provider_input:z.never().optional(),
  response:z.object({checkout_mode:z.literal('free_activation'),amount:z.literal(0),currency:z.literal('INR'),
   billing_period:z.enum(['monthly','yearly']),is_promo:z.literal(false),recurring:z.literal(false),plan:Plan}).passthrough(),
 }).passthrough(),
}).refine(charge=>charge.subscription_checkout_reference==='free_checkout:'+charge.id
 &&charge.subscription_checkout_request.plan_slug===charge.subscription_checkout.plan.slug
 &&charge.subscription_checkout_request.billing_period===charge.subscription_checkout.response.billing_period);
const Charge=z.union([PaidCharge,FreeCharge]);
export type SubscriptionCheckoutCharge=z.infer<typeof Charge>;
export function isFreeSubscriptionCheckoutCharge(charge:SubscriptionCheckoutCharge):charge is z.infer<typeof FreeCharge>{
 return charge.subscription_checkout.mode==='free_activation';
}
export async function subscriptionCheckoutRpc(db:SupabaseClient,name:string,args:Record<string,unknown>){
 const {data,error}=await db.rpc(name,args);
 if(error)throw new AppError('Subscription checkout storage is unavailable. Retry the same request key.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
 const result=z.object({accepted:z.boolean(),code:z.string().optional(),missing:z.boolean().optional(),claimed:z.boolean().optional(),charge:Charge.optional()}).safeParse(data);
 if(!result.success)throw new AppError('Subscription checkout state is unavailable.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
 if(!result.data.accepted){const code=result.data.code||'SUBSCRIPTION_CHECKOUT_CONFLICT';
  if(['SUBSCRIPTION_TAX_SETUP_REQUIRED','SUBSCRIPTION_TAX_REVIEW_REQUIRED'].includes(code))throw new AppError('Subscription billing tax setup or the saved tax source needs review before payment can continue.',503,code);
  if(code==='SUBSCRIPTION_LEGACY_CHECKOUT_PENDING')throw new AppError('An earlier checkout result needs recovery before activation can continue.',503,code);
  throw new AppError(code==='SUBSCRIPTION_OWNER_REQUIRED'?'The current store owner is required.':'This payment does not match the saved subscription checkout.',code==='SUBSCRIPTION_OWNER_REQUIRED'?403:409,code);}
 return result.data;
}
export async function readSubscriptionCheckoutSource(db:SupabaseClient,input:{actor:string;site:string;reference:string;payment:string;planSlug:string;period:string}){
 const r=await subscriptionCheckoutRpc(db,'read_merchant_subscription_checkout_v1',{p_actor:input.actor,p_site:input.site,
  p_reference:input.reference,p_payment:input.payment,p_plan_slug:input.planSlug,p_period:input.period});
 if(!r.charge)throw new AppError('The saved subscription checkout is unavailable.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
 if(isFreeSubscriptionCheckoutCharge(r.charge))throw new AppError('A free checkout is not paid verification authority.',409,'SUBSCRIPTION_CHECKOUT_CONFLICT');
 if(!r.charge.legacy_completed)requireSubscriptionTaxSnapshot(r.charge);
 return {...r.charge,plan:r.charge.subscription_checkout.plan as BillingPlanCatalogRecord};
}

export function requireSubscriptionTaxSnapshot(charge:SubscriptionCheckoutCharge):SubscriptionTaxSnapshot {
 if(isFreeSubscriptionCheckoutCharge(charge))throw new AppError('Free activation has no paid tax source.',409,'SUBSCRIPTION_CHECKOUT_CONFLICT');
 const parsed=SubscriptionTaxSnapshotSchema.safeParse(charge.subscription_tax_snapshot);
 if(!parsed.success)throw new AppError('The saved subscription tax source needs review before payment can continue.',503,'SUBSCRIPTION_TAX_REVIEW_REQUIRED');
 const s=parsed.data;
 if(charge.subscription_checkout.mode==='razorpay_subscription'){
  const schedule=SubscriptionImmediateChargeScheduleSchema.safeParse(charge.subscription_checkout.charge_schedule);
  const binding=ProviderPlanBinding.safeParse(charge.subscription_checkout.provider_plan_binding);
  if(!schedule.success||schedule.data.initial_gross_minor!==charge.amount)
   throw new AppError('The saved recurring charge schedule needs review.',409,'SUBSCRIPTION_CHECKOUT_CONFLICT');
  if(!binding.success||binding.data.base_gross_minor!==schedule.data.base_gross_minor
   ||binding.data.provider_plan_id!==charge.subscription_checkout.provider_input?.plan_id||binding.data.billing_period!==s.source.billing_period
   ||charge.subscription_checkout.provider_input?.quantity!==1||charge.subscription_checkout.provider_input?.start_at!==undefined)
   throw new AppError('The saved provider plan binding needs review.',409,'SUBSCRIPTION_CHECKOUT_CONFLICT');
  const recurring=SubscriptionTaxSnapshotSchema.safeParse(charge.subscription_checkout.recurring_tax_snapshot);
  if(!recurring.success||recurring.data.gross_minor!==schedule.data.base_gross_minor
   ||JSON.stringify(recurring.data.profile)!==JSON.stringify(s.profile)||JSON.stringify(recurring.data.recipient)!==JSON.stringify(s.recipient)
   ||recurring.data.source.discount_minor!==0||recurring.data.source.coupon_code!==null
   ||Object.keys(s.source).filter(k=>k!=='gross_before_discount_minor').some(k=>
    recurring.data.source[k as keyof typeof s.source]!==s.source[k as keyof typeof s.source]))
   throw new AppError('The saved recurring tax source needs review.',409,'SUBSCRIPTION_CHECKOUT_CONFLICT');

 }
 if(s.gross_minor!==charge.amount || s.source.plan_id!==charge.subscription_checkout.plan.id || s.source.plan_slug!==charge.subscription_checkout.plan.slug
  || (charge.site_id!==undefined&&s.source.site_id!==charge.site_id) || (charge.user_id!==undefined&&s.source.actor_id!==charge.user_id)
  || (charge.billing_period!==undefined&&s.source.billing_period!==charge.billing_period)
  || (charge.subscription_checkout_key!==undefined&&s.source.request_key!==charge.subscription_checkout_key))
  throw new AppError('The saved subscription tax source does not match this checkout.',409,'SUBSCRIPTION_CHECKOUT_CONFLICT');
 return s;
}
/** Select only an already-persisted native amount. This function does not
 * authenticate provider data; its caller must supply server-verified evidence. */
export function selectSubscriptionInvoiceTaxSnapshot(charge:SubscriptionCheckoutCharge,evidence:unknown){
 const initial=requireSubscriptionTaxSnapshot(charge),invoice=SubscriptionInvoiceEvidenceSchema.parse(evidence);
 if(isFreeSubscriptionCheckoutCharge(charge)||charge.subscription_checkout.mode!=='razorpay_subscription'
  ||invoice.subscription_reference!==charge.subscription_checkout_reference)
  throw new AppError('Provider invoice does not match its saved subscription source.',409,'SUBSCRIPTION_CHECKOUT_CONFLICT');
 const selected=invoice.phase==='initial_with_upfront'?initial:SubscriptionTaxSnapshotSchema.parse(charge.subscription_checkout.recurring_tax_snapshot);
 const schedule=SubscriptionImmediateChargeScheduleSchema.parse(charge.subscription_checkout.charge_schedule);
 if(selected.gross_minor!==invoice.gross_minor||(invoice.phase==='initial_with_upfront'&&schedule.upfront_gross_minor<=0))
  throw new AppError('Provider invoice gross does not match its retained phase source.',409,'SUBSCRIPTION_CHECKOUT_CONFLICT');
 return selected;
}

/** Native capture authority is payment -> invoice -> subscription, matched to
 * the retained initial/base sources. No caller/current provider pointer supplies
 * the old invoice period. A committed immutable paid receipt can replay without
 * depending on provider availability; SQL still rechecks the live site owner. */
export async function verifyNativeSubscriptionInvoice(credentials:RazorpayCredentials,charge:SubscriptionCheckoutCharge,input:{
 paymentId:string;subscriptionId:string;orderId?:string|null;
}):Promise<SubscriptionInvoiceEvidence>{
 const conflict=()=>new AppError('The subscription invoice does not match the saved checkout.',409,'SUBSCRIPTION_CHECKOUT_CONFLICT');
 const unavailable=()=>new AppError('The captured subscription invoice is unavailable. Retry the same payment or contact support.',503,'SUBSCRIPTION_INVOICE_VERIFICATION_UNAVAILABLE');
 requireSubscriptionTaxSnapshot(charge);
 const parsed=z.object({paymentId:z.string().regex(/^pay_[A-Za-z0-9]+$/).max(120),subscriptionId:z.string().regex(/^sub_[A-Za-z0-9]+$/).max(120),
  orderId:z.string().regex(/^order_[A-Za-z0-9]+$/).max(120).nullish()}).strict().safeParse(input);
 if(!parsed.success||isFreeSubscriptionCheckoutCharge(charge)||charge.subscription_checkout.mode!=='razorpay_subscription'
  ||charge.subscription_checkout_reference!==input.subscriptionId)throw conflict();
 if(charge.retained_invoice_evidence){
  const retained=charge.retained_invoice_evidence;
  if(retained.payment_id!==input.paymentId||retained.subscription_reference!==input.subscriptionId
   ||(input.orderId!=null&&retained.order_id!==input.orderId))throw conflict();
  selectSubscriptionInvoiceTaxSnapshot(charge,retained);return retained;
 }
 if(!credentials.keyId||!credentials.keySecret)throw unavailable();
 let payment:Awaited<ReturnType<typeof fetchRazorpayPayment>>;
 try{payment=await fetchRazorpayPayment(credentials,input.paymentId);}catch{throw unavailable();}
 if(payment.error)throw unavailable();
 if(payment.id!==input.paymentId||payment.status!=='captured'||payment.currency!=='INR'
  ||(input.orderId!=null&&payment.order_id!==input.orderId)
  ||!z.string().regex(/^inv_[A-Za-z0-9]+$/).max(120).safeParse(payment.invoice_id).success)throw conflict();
 let invoice:Awaited<ReturnType<typeof fetchRazorpayInvoice>>,subscription:Awaited<ReturnType<typeof fetchRazorpaySubscription>>;
 try{[invoice,subscription]=await Promise.all([fetchRazorpayInvoice(credentials,payment.invoice_id!),fetchRazorpaySubscription(credentials,input.subscriptionId)]);}catch{throw unavailable();}
 if(invoice.error||subscription.error)throw unavailable();
 try{
  const binding=ProviderPlanBinding.parse(charge.subscription_checkout.provider_plan_binding);
  const {taxSnapshot,...evidence}=resolveSubscriptionInvoiceTaxPhase({subscriptionReference:input.subscriptionId,providerPlanId:binding.provider_plan_id,
   schedule:charge.subscription_checkout.charge_schedule,initialSnapshot:charge.subscription_tax_snapshot,
   recurringSnapshot:charge.subscription_checkout.recurring_tax_snapshot,approvedUsageCharges:charge.subscription_checkout_request?.approved_usage_charges??[],payment,invoice,subscription});
  const verified=SubscriptionInvoiceEvidenceSchema.parse(evidence);
  if(JSON.stringify(selectSubscriptionInvoiceTaxSnapshot(charge,verified))!==JSON.stringify(taxSnapshot))throw conflict();
  return verified;
 }catch{throw conflict();}
}

export async function resolveNewSubscriptionTaxSnapshot(db:SupabaseClient,env:{LETBUYY_SUBSCRIPTION_TAX_PROFILE?:string},input:{
 actor:string;site:string;key:string;plan:BillingPlanCatalogRecord;period:SubscriptionBillingPeriod;gross:number;beforeDiscount:number;coupon?:string|null;
}):Promise<SubscriptionTaxSnapshot>{
 // No defaults establish supplier registration, recipient jurisdiction or exemption.
 // Persist these private party facts only in the canonical server-side source.
 try{
  if(!env.LETBUYY_SUBSCRIPTION_TAX_PROFILE)throw new Error('profile absent');
  const profile:unknown=JSON.parse(env.LETBUYY_SUBSCRIPTION_TAX_PROFILE);
  const {data:raw,error}=await db.from('sites').select('id,legal_name,gstin,gst_state_code,invoice_address').eq('id',input.site).is('deleted_at',null).single();
  if(error||!raw)throw new Error('recipient absent');
  const row=raw as Record<string,unknown>,a=row.invoice_address as Record<string,unknown>|null;
  if(!a||typeof a!=='object'||Array.isArray(a))throw new Error('billing address absent');
  if(row.gst_state_code&&a.state_code&&row.gst_state_code!==a.state_code)throw new Error('billing state disagreement');
  const recipient={name:row.legal_name,country:a.country,state_code:row.gst_state_code||a.state_code,gstin:row.gstin||null,
   address:{line1:a.line1,city:a.city,state:a.state,zip:a.zip??a.postal_code,country:a.country}};
  const plan=input.plan as BillingPlanCatalogRecord&Record<string,unknown>;
  return planSubscriptionTaxSnapshot({profile,recipient,grossMinor:input.gross,source:{actor_id:input.actor,site_id:input.site,request_key:input.key,
   plan_id:plan.id,plan_slug:plan.slug,billing_period:input.period,
   price_version:typeof plan.updated_at==='string'?plan.updated_at:JSON.stringify([plan.id,plan.price_monthly_inr,plan.price_yearly_inr,plan.promo_price_inr,plan.promo_months]),
   gross_before_discount_minor:input.beforeDiscount,discount_minor:input.beforeDiscount-input.gross,coupon_code:input.coupon||null}});
 }catch{
  throw new AppError('Subscription billing tax setup is incomplete or unsupported. Ask support to review the supplier and billing profile before paying.',503,'SUBSCRIPTION_TAX_SETUP_REQUIRED');
 }
}
export {subscriptionTaxSummary};

export function publicSubscriptionBillingRecord(value:Record<string,unknown>):Record<string,unknown>{
 const result={...value};
 for(const key of ['subscription_tax_snapshot','subscription_tax_source_id','subscription_checkout','subscription_checkout_key','subscription_checkout_request','subscription_checkout_reference','retained_invoice_evidence'])delete result[key];
 if(value.subscription_tax_snapshot!=null){
  const snapshot=SubscriptionTaxSnapshotSchema.safeParse(value.subscription_tax_snapshot);
  if(!snapshot.success)throw new AppError('The saved subscription invoice needs review.',503,'SUBSCRIPTION_TAX_REVIEW_REQUIRED');
  result.tax=subscriptionTaxSummary(snapshot.data);
 }
 return result;
}
