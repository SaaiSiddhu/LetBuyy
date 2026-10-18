import {SubscriptionExecutionAdapter} from '../execution/subscription-execution.adapter';
import type {SupabaseClient} from '@letbuyy/infrastructure/supabase-adapter';
import assert from 'node:assert/strict';
import test from 'node:test';
import {planSubscriptionTaxSnapshot,InternalSubscriptionStateSyncSchema} from '@letbuyy/billing-core';
import {requireSubscriptionTaxSnapshot,publicSubscriptionBillingRecord,requireConfiguredSubscriptionPlan,selectSubscriptionInvoiceTaxSnapshot,readSubscriptionCheckoutSource,verifyNativeSubscriptionInvoice} from '../lib/subscription-checkout-source';
const party={name:'Synthetic Party',country:'IN',state_code:'29',gstin:'29AAAAA0000A1Z5',address:{line1:'Synthetic address',city:'Bengaluru',state:'Karnataka',zip:'560001',country:'IN'}};
const profile={schema_version:1,policy_version:'D-SUB-TAX-INCLUSIVE-V1',profile_id:'synthetic-local-only',profile_version:1,approval_status:'approved',approval_reference:'synthetic-approval-only',registration_status:'registered',supply_category:'domestic_taxable_saas',rate_bps:1800,supplier:party};
const source={actor_id:'11111111-1111-4111-8111-111111111111',site_id:'22222222-2222-4222-8222-222222222222',request_key:'synthetic-tax-source',plan_id:'33333333-3333-4333-8333-333333333333',plan_slug:'growth',billing_period:'monthly',price_version:'synthetic-price-v1',gross_before_discount_minor:69900,discount_minor:0,coupon_code:null};
const plan=(gross=69900,state='29')=>planSubscriptionTaxSnapshot({profile,recipient:{...party,state_code:state,gstin:null},source:{...source,gross_before_discount_minor:gross},grossMinor:gross});

const snapshot=plan();
const charge={id:'44444444-4444-4444-8444-444444444444',site_id:source.site_id,user_id:source.actor_id,amount:69900,currency:'INR' as const,
 billing_period:'monthly' as const,subscription_checkout_key:source.request_key,subscription_checkout_reference:'order_syn_tax',
 subscription_checkout:{mode:'razorpay_order' as const,plan:{id:source.plan_id,slug:source.plan_slug,name:'Synthetic plan'}},subscription_tax_snapshot:snapshot};
test('saved canonical snapshot is returned without current config or price recomputation',()=>{assert.deepEqual(requireSubscriptionTaxSnapshot(charge),snapshot);});
test('legacy paid source without a tax snapshot requires review for new paid effects',()=>{assert.throws(()=>requireSubscriptionTaxSnapshot({...charge,subscription_tax_snapshot:undefined}),/needs review/);});
test('foreign site, actor, plan, key, period and charged gross cannot reuse the snapshot',()=>{
 for(const change of [{site_id:source.plan_id},{user_id:source.site_id},{amount:82482},{billing_period:'yearly' as const},
  {subscription_checkout_key:'different-key'},{subscription_checkout:{...charge.subscription_checkout,plan:{...charge.subscription_checkout.plan,id:source.site_id}}}])
  assert.throws(()=>requireSubscriptionTaxSnapshot({...charge,...change}),/does not match/);
});

test('billing responses expose conserved public amounts without raw parties, approval or private source terms',()=>{
 const row={amount:69900,tax_amount:10663,total_amount:69900,subscription_tax_snapshot:snapshot,subscription_tax_source_id:charge.id,
  subscription_checkout:charge.subscription_checkout,subscription_checkout_request:{coupon_code:'synthetic-private'},subscription_checkout_key:source.request_key};
 const publicRow=publicSubscriptionBillingRecord(row),wire=JSON.stringify(publicRow);
 assert.equal(publicRow.amount,69900);assert.equal((publicRow.tax as {gross_minor:number}).gross_minor,69900);
 for(const field of ['gstin','approval_reference','address','request_key','synthetic-private','subscription_checkout'])assert.equal(wire.includes(field),false);
});

test('retained native schedule binds its initial total while preserving a separate later base',()=>{
 const schedule={schema_version:1,start_mode:'immediate',base_gross_minor:69900,upfront_gross_minor:2000,initial_gross_minor:71900};
 const native={...charge,amount:71900,subscription_tax_snapshot:plan(71900),subscription_checkout:{...charge.subscription_checkout,mode:'razorpay_subscription' as const,charge_schedule:schedule,recurring_tax_snapshot:snapshot,provider_input:{plan_id:'plan_Synthetic123',quantity:1},provider_plan_binding:{schema_version:1,provider_plan_id:'plan_Synthetic123',base_gross_minor:69900,currency:'INR',billing_period:'monthly',interval:1,tax_configuration:'no_additional_tax'}}};
 assert.equal(requireSubscriptionTaxSnapshot(native).gross_minor,71900);
 assert.throws(()=>requireSubscriptionTaxSnapshot({...native,subscription_checkout:{...native.subscription_checkout,provider_input:{plan_id:'plan_Synthetic123',quantity:2}}}),/provider plan binding needs review/);
 assert.throws(()=>requireSubscriptionTaxSnapshot({...native,subscription_checkout:{...native.subscription_checkout,recurring_tax_snapshot:plan(71900)}}),/recurring tax source needs review/);
 for(const change of [{initial_gross_minor:69900},{base_gross_minor:70000},{start_mode:'future'},{initial_gross_minor:82482,upfront_gross_minor:12582}])
  assert.throws(()=>requireSubscriptionTaxSnapshot({...native,subscription_checkout:{...native.subscription_checkout,charge_schedule:{...schedule,...change}}}),/schedule needs review/);
});

test('configured recurring provider plan must exactly match saved base/currency/period/quantity and no additional tax',async()=>{
 const original=globalThis.fetch;let calls=0;
 const valid={id:'plan_Synthetic123',entity:'plan',period:'monthly',interval:1,item:{active:true,amount:69900,currency:'INR',tax_rate:null,tax_id:null,tax_group_id:null}};
 let result:unknown=valid;
 globalThis.fetch=(async(input,init)=>{calls++;assert.equal(String(input),'https://api.razorpay.com/v1/plans/plan_Synthetic123');assert.equal(init?.method,'GET');if(result==='synthetic_network_failure')throw new Error('synthetic private transport detail');return Response.json(result);}) as typeof fetch;
 try{
  assert.equal((await requireConfiguredSubscriptionPlan({keyId:'synthetic',keySecret:'synthetic'},{planId:'plan_Synthetic123',baseGross:69900,period:'monthly'})).base_gross_minor,69900);
  for(const change of [{id:'plan_Foreign'},{period:'yearly'},{period:'month'},{period:'year'},{period:'weekly'},{period:'daily'},{interval:2},{item:{...valid.item,active:false}},{item:{...valid.item,amount:82482}},{item:{...valid.item,currency:'USD'}},{item:{...valid.item,amount:69900.5}},{item:{...valid.item,tax_rate:18}},{item:{...valid.item,tax_id:'tax_Synthetic'}},{item:{...valid.item,tax_group_id:'taxgroup_Synthetic'}},{error:{description:'synthetic unavailable'}}]){
   result={...valid,...change};await assert.rejects(()=>requireConfiguredSubscriptionPlan({keyId:'synthetic',keySecret:'synthetic'},{planId:'plan_Synthetic123',baseGross:69900,period:'monthly'}),/does not match this subscription quote/);
  }
  for(const period of ['monthly','yearly'] as const){result={...valid,period};assert.equal((await requireConfiguredSubscriptionPlan({keyId:'synthetic',keySecret:'synthetic'},{planId:'plan_Synthetic123',baseGross:69900,period})).billing_period,period);}
  result='synthetic_network_failure';await assert.rejects(()=>requireConfiguredSubscriptionPlan({keyId:'synthetic',keySecret:'synthetic'},{planId:'plan_Synthetic123',baseGross:69900,period:'monthly'}),/does not match this subscription quote/);
  const before=calls;await assert.rejects(()=>requireConfiguredSubscriptionPlan({keyId:'synthetic',keySecret:'synthetic'},{planId:'https://foreign.invalid',baseGross:69900,period:'monthly'}));assert.equal(calls,before);
 }finally{globalThis.fetch=original;}
});

test('provider status contract requires an explicit known state and valid retained period',()=>{
 const payload={externalSubscriptionId:'sub_Synthetic123',status:'past_due',currentPeriodStart:'2026-10-18T00:00:00.000Z',currentPeriodEnd:'2026-11-18T00:00:00.000Z'};
 assert.equal(InternalSubscriptionStateSyncSchema.safeParse(payload).success,true);
 for(const change of [{status:'unknown'},{status:undefined},{currentPeriodEnd:payload.currentPeriodStart},{currentPeriodStart:'not-a-time'},{amount:69900}])assert.equal(InternalSubscriptionStateSyncSchema.safeParse({...payload,...change}).success,false);
});
test('provider status adapter uses one canonical RPC and strips private financial source from its result',async()=>{
 let response:unknown={accepted:true,subscription:{id:charge.id,user_id:source.actor_id,store_id:source.site_id,external_subscription_id:'sub_Synthetic123',status:'past_due',subscription_tax_snapshot:snapshot}};
 const calls:unknown[]=[];const db={from:()=>{throw new Error('Status must not directly update historical subscriptions');},rpc:async(name:string,args:unknown)=>{calls.push({name,args});return {data:response,error:null};}} as unknown as SupabaseClient;
 const adapter=new SubscriptionExecutionAdapter(db),result=await adapter.syncProviderSubscription({externalSubscriptionId:'sub_Synthetic123',status:'past_due'});
 assert.equal(result?.id,charge.id);assert.equal('subscription_tax_snapshot' in result!,false);assert.deepEqual(calls,[{name:'sync_merchant_subscription_state_v1',args:{p_input:{external_subscription_id:'sub_Synthetic123',status:'past_due',current_period_start:null,current_period_end:null}}}]);
 response={accepted:false,code:'SUBSCRIPTION_OWNER_REQUIRED'};await assert.rejects(()=>adapter.syncProviderSubscription({externalSubscriptionId:'sub_Synthetic123',status:'active'}),/current store owner/);
 response={accepted:false,code:'SUBSCRIPTION_CHECKOUT_CONFLICT'};await assert.rejects(()=>adapter.syncProviderSubscription({externalSubscriptionId:'sub_Synthetic123',status:'active'}),/immutable subscription cycle/);
});

function nativeEvidenceFixture(){
 const selected=plan(71900),schedule={schema_version:1,start_mode:'immediate',base_gross_minor:69900,upfront_gross_minor:2000,initial_gross_minor:71900};
 const native={...charge,amount:71900,subscription_tax_snapshot:selected,subscription_checkout_reference:'sub_Synthetic123',subscription_checkout:{...charge.subscription_checkout,plan:{...charge.subscription_checkout.plan,products_limit:10},mode:'razorpay_subscription' as const,charge_schedule:schedule,recurring_tax_snapshot:snapshot,provider_input:{plan_id:'plan_Synthetic123',quantity:1},provider_plan_binding:{schema_version:1,provider_plan_id:'plan_Synthetic123',base_gross_minor:69900,currency:'INR',billing_period:'monthly',interval:1,tax_configuration:'no_additional_tax'}}};
 const evidence={phase:'base_cycle' as const,invoice_id:'inv_Synthetic123',payment_id:'pay_Synthetic123',order_id:'order_Synthetic123',subscription_reference:'sub_Synthetic123',period_start:'2026-10-18T00:00:00.000Z',period_end:'2026-11-18T00:00:00.000Z',gross_minor:69900};
 return {native,evidence};
}
test('private verified invoice selects retained base or upfront source without changing the original quote',()=>{
 const {native,evidence}=nativeEvidenceFixture(),before=JSON.stringify(native);
 assert.equal(selectSubscriptionInvoiceTaxSnapshot(native,evidence).gross_minor,69900);
 assert.equal(selectSubscriptionInvoiceTaxSnapshot(native,{...evidence,phase:'initial_with_upfront',gross_minor:71900}).gross_minor,71900);
 assert.equal(JSON.stringify(native),before);
 assert.throws(()=>selectSubscriptionInvoiceTaxSnapshot(native,{...evidence,gross_minor:82482}),/retained phase source/);
 assert.throws(()=>selectSubscriptionInvoiceTaxSnapshot(native,{...evidence,subscription_reference:'sub_Foreign'}),/saved subscription source/);
});
test('activation adapter binds private invoice period and selected tax source before canonical RPC',async()=>{
 const {native,evidence}=nativeEvidenceFixture();const calls:Array<{name:string;args:unknown}>=[];
 const db={rpc:async(name:string,args:unknown)=>{calls.push({name,args});return {data:name==='activate_merchant_subscription_v1'?{accepted:true,replayed:false,subscription:{id:charge.id,plan:'growth',status:'active',billing_period:'monthly',current_period_end:evidence.period_end,promo_ends_at:null,external_subscription_id:evidence.subscription_reference,amount_paid:69900}}:null,error:null};}} as unknown as SupabaseClient;
 const adapter=new SubscriptionExecutionAdapter(db),input={userId:source.actor_id,storeId:source.site_id,plan:native.subscription_checkout.plan as import('@letbuyy/billing-core').BillingPlanCatalogRecord,billingPeriod:'monthly' as const,amountPaid:69900,paymentGateway:'razorpay' as const,externalSubscriptionId:evidence.subscription_reference,razorpayPaymentId:evidence.payment_id,taxSource:native,verifiedInvoice:evidence,now:new Date('2027-01-01T00:00:00.000Z')};
 await adapter.activateMerchantSubscription(input);
 const activation=calls.find(c=>c.name==='activate_merchant_subscription_v1')!.args as {p_input:Record<string,unknown>};
 assert.equal(activation.p_input.period_start,evidence.period_start);assert.equal(activation.p_input.period_end,evidence.period_end);assert.equal(activation.p_input.tax_amount,10663);assert.equal(activation.p_input.total_amount,69900);assert.equal(activation.p_input.subscription_tax_source_id,charge.id);assert.deepEqual(activation.p_input.provider_invoice_evidence,evidence);
 await adapter.activateMerchantSubscription({...input,verifiedInvoice:undefined,taxSource:{...native,retained_invoice_evidence:evidence}});
 const cached=calls.filter(c=>c.name==='activate_merchant_subscription_v1').at(-1)!.args as {p_input:Record<string,unknown>};
 assert.equal(cached.p_input.period_start,evidence.period_start);assert.equal(cached.p_input.tax_amount,10663);assert.deepEqual(cached.p_input.provider_invoice_evidence,evidence);
 const before=calls.length;await assert.rejects(()=>adapter.activateMerchantSubscription({...input,razorpayPaymentId:'pay_Foreign'}),/does not match this payment/);assert.equal(calls.length,before);
});

test('canonical source read preserves a paid invoice evidence record without exposing it in public billing summaries',async()=>{
 const {native,evidence}=nativeEvidenceFixture();let calls=0;
 const db={rpc:async(name:string,args:unknown)=>{calls++;assert.equal(name,'read_merchant_subscription_checkout_v1');assert.ok(args);return {data:{accepted:true,charge:{...native,retained_invoice_evidence:evidence}},error:null};}} as unknown as SupabaseClient;
 const saved=await readSubscriptionCheckoutSource(db,{actor:source.actor_id,site:source.site_id,reference:evidence.subscription_reference,payment:evidence.payment_id,planSlug:'growth',period:'monthly'});
 assert.deepEqual(saved.retained_invoice_evidence,evidence);assert.equal(saved.amount,71900);assert.equal(saved.retained_invoice_evidence?.gross_minor,69900);assert.equal(calls,1);
 const publicRow=publicSubscriptionBillingRecord({...saved});assert.equal('retained_invoice_evidence' in publicRow,false);
});

function nativeProviderFixture(){
 const {native,evidence}=nativeEvidenceFixture();
 const approved=[{meter_name:'synthetic-usage',description:'Synthetic usage',amount_minor:2000,quantity:1,idempotency_key:'synthetic-usage-01'}];
 const bound={...native,subscription_checkout_request:{approved_usage_charges:approved}};
 const payment={id:evidence.payment_id,entity:'payment',invoice_id:evidence.invoice_id,order_id:evidence.order_id,amount:69900,currency:'INR',status:'captured',captured:true};
 const invoice={id:evidence.invoice_id,entity:'invoice',subscription_id:evidence.subscription_reference,payment_id:evidence.payment_id,order_id:evidence.order_id,status:'paid',currency:'INR',
  amount:69900,amount_paid:69900,amount_due:0,gross_amount:69900,partial_payment:false,billing_start:Date.parse(evidence.period_start)/1000,billing_end:Date.parse(evidence.period_end)/1000,
  line_items:[{type:'plan',name:'Synthetic plan',quantity:1,unit_amount:69900,gross_amount:69900,tax_amount:0,currency:'INR'}]};
 const subscription={id:evidence.subscription_reference,entity:'subscription',plan_id:'plan_Synthetic123',quantity:1,current_start:1893456000,current_end:1896134400,paid_count:99};
 return {native:bound,evidence,payment,invoice,subscription};
}
function nativeProviderTransport(f:ReturnType<typeof nativeProviderFixture>){
 const calls:string[]=[];
 const transport=(async(input,init)=>{const url=String(input);calls.push(url);assert.equal(init?.method,'GET');assert.match(new Headers(init?.headers).get('Authorization')||'',/^Basic /);
  if(url==='https://api.razorpay.com/v1/payments/'+f.payment.id)return Response.json(f.payment);
  if(url==='https://api.razorpay.com/v1/invoices/'+f.payment.invoice_id)return Response.json(f.invoice);
  if(url==='https://api.razorpay.com/v1/subscriptions/'+f.subscription.id)return Response.json(f.subscription);
  throw new Error('Unexpected native provider transport');}) as typeof fetch;
 return {transport,calls};
}
const nativeCredentials={keyId:'synthetic',keySecret:'synthetic'};
test('native verified reads bind payment invoice subscription and use old invoice period instead of current pointer/count',async()=>{
 const f=nativeProviderFixture(),before=JSON.stringify(f.native),{transport,calls}=nativeProviderTransport(f),original=globalThis.fetch;globalThis.fetch=transport;
 try{const verified=await verifyNativeSubscriptionInvoice(nativeCredentials,f.native,{paymentId:f.payment.id,subscriptionId:f.subscription.id});assert.deepEqual(verified,f.evidence);assert.equal(calls.length,3);assert.equal(JSON.stringify(f.native),before);}finally{globalThis.fetch=original;}
});
test('native captured initial upfront invoice selects its retained71900 gross and cannot turn addon into a recurring amount',async()=>{
 const f=nativeProviderFixture();f.payment.amount=71900;Object.assign(f.invoice,{amount:71900,amount_paid:71900,gross_amount:71900});
 f.invoice.line_items.push({type:'addon',name:'Synthetic usage',quantity:1,unit_amount:2000,gross_amount:2000,tax_amount:0,currency:'INR'});
 const original=globalThis.fetch,{transport}=nativeProviderTransport(f);globalThis.fetch=transport;
 try{const verified=await verifyNativeSubscriptionInvoice(nativeCredentials,f.native,{paymentId:f.payment.id,subscriptionId:f.subscription.id,orderId:f.payment.order_id});assert.equal(verified.phase,'initial_with_upfront');assert.equal(verified.gross_minor,71900);assert.equal(selectSubscriptionInvoiceTaxSnapshot(f.native,verified).gross_minor,71900);}finally{globalThis.fetch=original;}
});
test('durable native paid invoice evidence replays without provider access and refuses a different payment',async()=>{
 const f=nativeProviderFixture(),original=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw new Error('Provider must not own committed receipt replay');}) as typeof fetch;
 try{const saved={...f.native,retained_invoice_evidence:f.evidence};assert.deepEqual(await verifyNativeSubscriptionInvoice({keyId:'',keySecret:''},saved,{paymentId:f.payment.id,subscriptionId:f.subscription.id}),f.evidence);
 await assert.rejects(()=>verifyNativeSubscriptionInvoice(nativeCredentials,saved,{paymentId:'pay_Foreign',subscriptionId:f.subscription.id}));assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
test('native invoice source binding rejects malformed or foreign references before provider reads',async()=>{
 const f=nativeProviderFixture(),original=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw new Error('No transport permitted');}) as typeof fetch;
 try{for(const change of [{paymentId:'https://foreign.invalid'},{subscriptionId:'sub_Foreign'},{orderId:'order_../foreign'}])await assert.rejects(()=>verifyNativeSubscriptionInvoice(nativeCredentials,f.native,{paymentId:f.payment.id,subscriptionId:f.subscription.id,...change}));
 await assert.rejects(()=>verifyNativeSubscriptionInvoice({keyId:'',keySecret:''},f.native,{paymentId:f.payment.id,subscriptionId:f.subscription.id}),(e:unknown)=>(e as {code?:string}).code==='SUBSCRIPTION_INVOICE_VERIFICATION_UNAVAILABLE');assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
test('native provider identity money period settlement line and plan mismatches are refused',async()=>{
 const original=globalThis.fetch;
 try{for(const mutate of [
  (f:ReturnType<typeof nativeProviderFixture>)=>{f.payment.status='authorized';},
  (f:ReturnType<typeof nativeProviderFixture>)=>{f.payment.currency='USD';},
  (f:ReturnType<typeof nativeProviderFixture>)=>{f.invoice.subscription_id='sub_Foreign';},
  (f:ReturnType<typeof nativeProviderFixture>)=>{f.invoice.payment_id='pay_Foreign';},
  (f:ReturnType<typeof nativeProviderFixture>)=>{f.invoice.order_id='order_Foreign';},
  (f:ReturnType<typeof nativeProviderFixture>)=>{f.invoice.amount_paid=1;},
  (f:ReturnType<typeof nativeProviderFixture>)=>{f.invoice.amount_due=1;},
  (f:ReturnType<typeof nativeProviderFixture>)=>{f.invoice.billing_end=f.invoice.billing_start;},
  (f:ReturnType<typeof nativeProviderFixture>)=>{f.invoice.line_items[0]!.unit_amount=82482;},
  (f:ReturnType<typeof nativeProviderFixture>)=>{f.subscription.plan_id='plan_Foreign';},
  (f:ReturnType<typeof nativeProviderFixture>)=>{f.subscription.quantity=2;},
 ]){const f=nativeProviderFixture();mutate(f);globalThis.fetch=nativeProviderTransport(f).transport;await assert.rejects(()=>verifyNativeSubscriptionInvoice(nativeCredentials,f.native,{paymentId:f.payment.id,subscriptionId:f.subscription.id}),(e:unknown)=>(e as {code?:string}).code==='SUBSCRIPTION_CHECKOUT_CONFLICT');}}finally{globalThis.fetch=original;}
});
test('native provider unavailable is explicit retryable and never leaks transport detail',async()=>{
 const f=nativeProviderFixture(),original=globalThis.fetch;globalThis.fetch=(async()=>{throw new Error('synthetic-private-provider-detail');}) as typeof fetch;
 try{await assert.rejects(()=>verifyNativeSubscriptionInvoice(nativeCredentials,f.native,{paymentId:f.payment.id,subscriptionId:f.subscription.id}),(e:unknown)=>{const error=e as {code?:string;message:string};assert.equal(error.code,'SUBSCRIPTION_INVOICE_VERIFICATION_UNAVAILABLE');assert.equal(error.message.includes('synthetic-private-provider-detail'),false);return true;});}finally{globalThis.fetch=original;}
});
test('native activation refuses an unverified invoice before any canonical RPC',async()=>{
 const {native}=nativeEvidenceFixture();let calls=0;const adapter=new SubscriptionExecutionAdapter({rpc:async()=>{calls++;throw new Error('No canonical RPC permitted');}} as unknown as SupabaseClient);
 await assert.rejects(()=>adapter.activateMerchantSubscription({userId:source.actor_id,storeId:source.site_id,plan:native.subscription_checkout.plan as import('@letbuyy/billing-core').BillingPlanCatalogRecord,billingPeriod:'monthly',amountPaid:71900,paymentGateway:'razorpay',externalSubscriptionId:native.subscription_checkout_reference,razorpayPaymentId:'pay_Synthetic123',taxSource:native}),(e:unknown)=>(e as {code?:string}).code==='SUBSCRIPTION_TAX_REVIEW_REQUIRED');assert.equal(calls,0);
});
