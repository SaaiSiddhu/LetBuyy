import assert from 'node:assert/strict';
import test from 'node:test';
import type {SupabaseClient} from '@letbuyy/infrastructure/supabase-adapter';
import {readSubscriptionCheckoutSource,subscriptionCheckoutRpc} from '../lib/subscription-checkout-source';
import {createMerchantSubscriptionCheckout} from '../lib/subscription-checkout';

const id='d94bdfbe-d051-4696-95b4-d7601816a677';
const plan={id:'c3c22850-a78b-4468-97ad-e542b80907b5',slug:'free',name:'Synthetic Internal Free Fallback'};
function freeCharge(){
 return {id,amount:0,currency:'INR',payment_gateway:null,provider_payment_reference:null,
  subscription_checkout_key:'synthetic-free-intent',
  subscription_checkout_request:{plan_slug:'free',site_type:'store',billing_period:'monthly',approved_usage_charges:[],coupon_code:null},
  subscription_checkout_reference:'free_checkout:'+id,
  subscription_checkout:{plan,mode:'free_activation',amount_minor:0,currency:'INR',
   response:{checkout_mode:'free_activation',amount:0,currency:'INR',billing_period:'monthly',is_promo:false,recurring:false,plan}}};
}
function dbReturning(charge:unknown):SupabaseClient{
 return {rpc:async()=>({data:{accepted:true,charge},error:null})} as unknown as SupabaseClient;
}

test('saved free checkout source is explicitly zero/internal and retains its logical request',async()=>{
 const input=freeCharge(),result=await subscriptionCheckoutRpc(dbReturning(input),'synthetic_read',{});
 assert.equal(result.charge?.subscription_checkout.mode,'free_activation');
 assert.equal(result.charge?.amount,0);
 assert.deepEqual(result.charge?.subscription_checkout_request,input.subscription_checkout_request);
});

for(const mode of ['razorpay_order','razorpay_subscription']){
 test('paid '+mode+' source retains positive amount admission',async()=>{
  const charge={amount:100,currency:'INR',subscription_checkout_reference:'synthetic-provider-ref',subscription_checkout:{plan:{...plan,slug:'growth'},mode}};
  assert.equal((await subscriptionCheckoutRpc(dbReturning(charge),'synthetic_read',{})).charge?.amount,100);
  for(const amount of [0,-1])await assert.rejects(()=>subscriptionCheckoutRpc(dbReturning({...charge,amount}),'synthetic_read',{}),{code:'SUBSCRIPTION_STORAGE_UNAVAILABLE'});
 });
}

test('free discriminant cannot admit a paid amount, gateway, provider reference or provider create input',async()=>{
 const charge=freeCharge();
 for(const invalid of [
  {...charge,amount:1}, {...charge,amount:-1}, {...charge,payment_gateway:'razorpay'},
  {...charge,provider_payment_reference:'pay_synthetic-forged'},
  {...charge,subscription_checkout_reference:'order_synthetic-forged'},
  {...charge,subscription_checkout:{...charge.subscription_checkout,amount_minor:1}},
  {...charge,subscription_checkout:{...charge.subscription_checkout,provider_input:{amount:100,currency:'INR'}}},
 ])await assert.rejects(()=>subscriptionCheckoutRpc(dbReturning(invalid),'synthetic_read',{}),{code:'SUBSCRIPTION_STORAGE_UNAVAILABLE'});
});

test('free source without its durable receipt identity, key or request fails closed',async()=>{
 const charge:Record<string,unknown>=freeCharge();
 for(const field of ['id','subscription_checkout_key','subscription_checkout_request']){
  const invalid={...charge};delete invalid[field];
  await assert.rejects(()=>subscriptionCheckoutRpc(dbReturning(invalid),'synthetic_read',{}),{code:'SUBSCRIPTION_STORAGE_UNAVAILABLE'});
 }
});

test('a free source cannot be reused as paid provider verification authority',async()=>{
 await assert.rejects(()=>readSubscriptionCheckoutSource(dbReturning(freeCharge()),{
  actor:'synthetic-owner',site:'synthetic-site',reference:'free_checkout:'+id,payment:'pay_synthetic',planSlug:'free',period:'monthly',
 }),{code:'SUBSCRIPTION_CHECKOUT_CONFLICT'});
});

test('canonical checkout still requires a bounded request key before any storage or provider dispatch',async()=>{
 let calls=0;
 const db={rpc:async()=>{calls++;throw new Error('invalid key must not reach storage');}} as unknown as SupabaseClient;
 for(const idempotencyKey of ['', '   ', 'tiny', 'x'.repeat(201)])await assert.rejects(()=>createMerchantSubscriptionCheckout({
  db,env:{},idempotencyKey,userId:'synthetic-owner',storeId:'synthetic-store',siteType:'store',planSlug:'free',billingPeriod:'monthly',
 }),{code:'IDEMPOTENCY_KEY_REQUIRED',statusCode:400});
 assert.equal(calls,0);
});

test('unbound historical free checkout returns explicit recovery-pending rather than a new activation',async()=>{
 const db={rpc:async()=>({data:{accepted:false,code:'SUBSCRIPTION_LEGACY_CHECKOUT_PENDING'},error:null})} as unknown as SupabaseClient;
 await assert.rejects(()=>subscriptionCheckoutRpc(db,'synthetic_read',{}),{code:'SUBSCRIPTION_LEGACY_CHECKOUT_PENDING',statusCode:503});
});
