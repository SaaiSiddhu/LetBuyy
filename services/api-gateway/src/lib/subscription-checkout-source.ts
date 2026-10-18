import {z} from 'zod';
import type {SupabaseClient} from '@letbuyy/infrastructure/supabase-adapter';
import {AppError} from './errors';
import type {BillingPlanCatalogRecord} from '@letbuyy/billing-core';

const Quote=z.object({plan:z.object({id:z.string(),slug:z.string(),name:z.string()}).passthrough(),
 mode:z.enum(['razorpay_order','razorpay_subscription']),amount_minor:z.number().optional(),currency:z.literal('INR').optional(),
 response:z.record(z.string(),z.unknown()).optional(),provider_input:z.record(z.string(),z.unknown()).optional()}).passthrough();
const Charge=z.object({id:z.string().optional(),amount:z.number().int().positive(),currency:z.literal('INR'),
 subscription_checkout_reference:z.string().nullable(),subscription_checkout:Quote});
export type SubscriptionCheckoutCharge=z.infer<typeof Charge>;
export async function subscriptionCheckoutRpc(db:SupabaseClient,name:string,args:Record<string,unknown>){
 const {data,error}=await db.rpc(name,args);
 if(error)throw new AppError('Subscription checkout storage is unavailable. Retry the same request key.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
 const result=z.object({accepted:z.boolean(),code:z.string().optional(),missing:z.boolean().optional(),claimed:z.boolean().optional(),charge:Charge.optional()}).safeParse(data);
 if(!result.success)throw new AppError('Subscription checkout state is unavailable.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
 if(!result.data.accepted){const code=result.data.code||'SUBSCRIPTION_CHECKOUT_CONFLICT';
  throw new AppError(code==='SUBSCRIPTION_OWNER_REQUIRED'?'The current store owner is required.':'This payment does not match the saved subscription checkout.',code==='SUBSCRIPTION_OWNER_REQUIRED'?403:409,code);}
 return result.data;
}
export async function readSubscriptionCheckoutSource(db:SupabaseClient,input:{actor:string;site:string;reference:string;payment:string;planSlug:string;period:string}){
 const r=await subscriptionCheckoutRpc(db,'read_merchant_subscription_checkout_v1',{p_actor:input.actor,p_site:input.site,
  p_reference:input.reference,p_payment:input.payment,p_plan_slug:input.planSlug,p_period:input.period});
 if(!r.charge)throw new AppError('The saved subscription checkout is unavailable.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
 return {...r.charge,plan:r.charge.subscription_checkout.plan as BillingPlanCatalogRecord};
}
