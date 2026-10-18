import assert from 'node:assert/strict';
import test from 'node:test';
import {planSubscriptionTaxSnapshot,SubscriptionTaxSnapshotSchema,subscriptionTaxSummary,subscriptionApprovedChargeComponents,planImmediateSubscriptionChargeSchedule,SubscriptionImmediateChargeScheduleSchema,planSubscriptionRecurringTaxSnapshots,resolveSubscriptionInvoiceTaxPhase} from '../src/index';
const party={name:'Synthetic Party',country:'IN',state_code:'29',gstin:'29AAAAA0000A1Z5',address:{line1:'Synthetic address',city:'Bengaluru',state:'Karnataka',zip:'560001',country:'IN'}};
const profile={schema_version:1,policy_version:'D-SUB-TAX-INCLUSIVE-V1',profile_id:'synthetic-local-only',profile_version:1,approval_status:'approved',approval_reference:'synthetic-approval-only',registration_status:'registered',supply_category:'domestic_taxable_saas',rate_bps:1800,supplier:party};
const source={actor_id:'11111111-1111-4111-8111-111111111111',site_id:'22222222-2222-4222-8222-222222222222',request_key:'synthetic-tax-source',plan_id:'33333333-3333-4333-8333-333333333333',plan_slug:'growth',billing_period:'monthly',price_version:'synthetic-price-v1',gross_before_discount_minor:69900,discount_minor:0,coupon_code:null};
const plan=(gross=69900,state='29')=>planSubscriptionTaxSnapshot({profile,recipient:{...party,state_code:state,gstin:null},source:{...source,gross_before_discount_minor:gross},grossMinor:gross});
test('final69900 includes10663 tax and preserves canonical intra-state paise allocation',()=>{
 const s=plan();assert.equal(s.gross_minor,69900);assert.equal(s.taxable_minor,59237);assert.equal(s.tax_minor,10663);
 assert.equal(s.cgst_minor,5331);assert.equal(s.sgst_minor,5332);assert.equal(s.igst_minor,0);assert.equal(s.taxable_minor+s.cgst_minor+s.sgst_minor,69900);
});
test('interstate tax is IGST and recipient GSTIN absence does not select exemption',()=>{
 const s=plan(69900,'27');assert.equal(s.igst_minor,10663);assert.equal(s.cgst_minor+s.sgst_minor,0);assert.equal(s.taxable_minor+s.igst_minor,69900);
});
test('one-paise, annual and maximum supported gross conserve exact integers',()=>{
 for(const n of [1,2,3,17,99,100,69900*12,2147483647]){
  const s=plan(n);assert.equal(s.taxable_minor+s.tax_minor,n);assert.equal(s.cgst_minor+s.sgst_minor+s.igst_minor,s.tax_minor);
  assert.ok(Object.values(subscriptionTaxSummary(s)).filter(x=>typeof x==='number').every(Number.isSafeInteger));
 }
});
test('coupon or founding gross is split after the saved price decision, not increased by tax',()=>{
 const s=planSubscriptionTaxSnapshot({profile,recipient:party,source:{...source,gross_before_discount_minor:69900,discount_minor:19900,coupon_code:'SYNTHETIC'},grossMinor:50000});
 assert.equal(s.gross_minor,50000);assert.equal(s.taxable_minor+s.tax_minor,50000);assert.equal(s.source.discount_minor,19900);
});
test('unsafe, fractional, negative, infinite and unsupported money is refused without coercion',()=>{
 for(const n of [-1,0,1.1,NaN,Infinity,Number.MAX_SAFE_INTEGER,2147483648,'69900'])assert.throws(()=>plan(n as number));
});
test('missing, unapproved, foreign, unsupported or conflicting supplier facts cannot select taxable supply',()=>{
 for(const p of [null,{}, {...profile,approval_status:'draft'},{...profile,rate_bps:0},{...profile,supply_category:'export'},
  {...profile,supplier:{...party,country:'US'}},{...profile,supplier:{...party,gstin:null}},{...profile,supplier:{...party,state_code:'27'}}])
  assert.throws(()=>planSubscriptionTaxSnapshot({profile:p,recipient:party,source,grossMinor:69900}));
});
test('missing recipient jurisdiction, contradictory GSTIN or foreign profile cannot be inferred as exempt',()=>{
 for(const recipient of [{...party,state_code:undefined},{...party,state_code:'27'},{...party,country:'US'},{...party,address:null}])
  assert.throws(()=>planSubscriptionTaxSnapshot({profile,recipient,source,grossMinor:69900}));
});
test('mutated totals, components, source discount or jurisdiction fail strict persisted snapshot parsing',()=>{
 const s=plan();for(const change of [{gross_minor:82482},{tax_minor:0},{igst_minor:10663},{taxable_minor:69900},{supply_type:'inter_state'},
  {source:{...s.source,discount_minor:1}},{extra:'unreviewed'}])assert.equal(SubscriptionTaxSnapshotSchema.safeParse({...s,...change}).success,false);
});
test('public summary contains no party, tax identifier, address, approval or request key',()=>{
 const summary=subscriptionTaxSummary(plan());assert.equal(JSON.stringify(summary).includes('Synthetic'),false);
 for(const key of ['profile','recipient','source','gstin','address'])assert.equal(key in summary,false);
});

test('approved base and upfront addon quantities remain separate without guessing provider timing',()=>{
 const amounts=subscriptionApprovedChargeComponents(69900,[{meter_name:'synthetic_usage',amount_minor:1000,quantity:2,idempotency_key:'synthetic-addon'}]);
 assert.deepEqual(amounts,{baseGrossMinor:69900,upfrontGrossMinor:2000});
});
test('unsafe addon multiplication, total overflow and malformed approved charge are rejected',()=>{
 for(const line of [{amount_minor:Number.MAX_SAFE_INTEGER,quantity:999},{amount_minor:2147483647,quantity:2},{amount_minor:-1,quantity:1},{amount_minor:1.5,quantity:1}])
  assert.throws(()=>subscriptionApprovedChargeComponents(69900,[{meter_name:'synthetic_usage',idempotency_key:'synthetic-addon',...line}]));
});

test('UUID representation is canonicalized without changing source ownership',()=>{
 const upper={...source,actor_id:'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',site_id:'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB'};
 const s=planSubscriptionTaxSnapshot({profile,recipient:party,source:upper,grossMinor:69900});
 assert.equal(s.source.actor_id,upper.actor_id.toLowerCase());assert.equal(s.source.site_id,upper.site_id.toLowerCase());
});

test('immediate initial authorization includes only the approved upfront charge while later base stays69900',()=>{
 const schedule=planImmediateSubscriptionChargeSchedule(69900,[{meter_name:'synthetic_usage',amount_minor:1000,quantity:2,idempotency_key:'synthetic-addon'}]);
 assert.deepEqual(schedule,{schema_version:1,start_mode:'immediate',base_gross_minor:69900,upfront_gross_minor:2000,initial_gross_minor:71900});
 assert.equal(schedule.base_gross_minor,69900);assert.equal(schedule.initial_gross_minor-schedule.base_gross_minor,2000);
});
test('immediate zero addon schedule preserves the exact quoted base without inventing a token or extra charge',()=>{
 assert.deepEqual(planImmediateSubscriptionChargeSchedule(69900,[]),{schema_version:1,start_mode:'immediate',base_gross_minor:69900,upfront_gross_minor:0,initial_gross_minor:69900});
});
test('immediate schedule rejects overflow, changed sums and future-mode substitution',()=>{
 const schedule=planImmediateSubscriptionChargeSchedule(69900,[]);
 assert.throws(()=>planImmediateSubscriptionChargeSchedule(2147483647,[{meter_name:'synthetic_usage',amount_minor:1,quantity:1,idempotency_key:'synthetic-addon'}]));
 for(const change of [{initial_gross_minor:82482},{upfront_gross_minor:1},{start_mode:'future'},{extra:'unapproved'}])assert.equal(SubscriptionImmediateChargeScheduleSchema.safeParse({...schedule,...change}).success,false);
});

test('initial and recurring tax snapshots conserve their own totals without repeating approved upfront usage',()=>{
 const saved=planSubscriptionRecurringTaxSnapshots(plan(),[{meter_name:'synthetic_usage',amount_minor:1000,quantity:2,idempotency_key:'synthetic-addon'}]);
 assert.equal(saved.initial.gross_minor,71900);assert.equal(saved.recurring.gross_minor,69900);
 for(const snap of [saved.initial,saved.recurring])assert.equal(snap.taxable_minor+snap.tax_minor,snap.gross_minor);
 assert.deepEqual(saved.initial.profile,saved.recurring.profile);assert.deepEqual(saved.initial.recipient,saved.recurring.recipient);
 assert.equal(saved.initial.source.request_key,saved.recurring.source.request_key);assert.equal(saved.initial.source.price_version,saved.recurring.source.price_version);
 assert.equal(saved.initial.source.gross_before_discount_minor,71900);assert.equal(saved.recurring.source.gross_before_discount_minor,69900);
 assert.throws(()=>planSubscriptionRecurringTaxSnapshots({...plan(),source:{...source,gross_before_discount_minor:70000,discount_minor:100,coupon_code:'SYNTHETIC'}},[]),/undiscounted native billing basis/);
});

function phaseFixture(upfront=true){
 const approved=[{meter_name:'synthetic_usage',description:'Synthetic Usage',amount_minor:1000,quantity:2,idempotency_key:'synthetic-addon'}];
 const saved=planSubscriptionRecurringTaxSnapshots(plan(),approved),gross=upfront?71900:69900;
 const payment={id:'pay_Synthetic123',invoice_id:'inv_Synthetic123',order_id:'order_Synthetic123',amount:gross,currency:'INR',status:'captured'};
 const planLine={type:'plan',name:'Synthetic Plan',quantity:1,unit_amount:69900,gross_amount:69900,tax_amount:0,currency:'INR'};
 const addonLine={type:'addon',name:'Synthetic Usage',quantity:2,unit_amount:1000,gross_amount:2000,tax_amount:0,currency:'INR'};
 const invoice={id:payment.invoice_id,entity:'invoice',subscription_id:'sub_Synthetic123',payment_id:payment.id,order_id:payment.order_id,status:'paid',currency:'INR',amount:gross,amount_paid:gross,amount_due:0,gross_amount:gross,partial_payment:false,billing_start:1792292423,billing_end:1794970823,line_items:upfront?[planLine,addonLine]:[planLine]};
 return {subscriptionReference:'sub_Synthetic123',providerPlanId:'plan_Synthetic123',schedule:saved.schedule,initialSnapshot:saved.initial,recurringSnapshot:saved.recurring,approvedUsageCharges:approved,payment,invoice,subscription:{id:'sub_Synthetic123',entity:'subscription',plan_id:'plan_Synthetic123',quantity:1,current_start:1,current_end:2,paid_count:999}};
}
test('provider invoice lineage selects71900 initial gross and keeps69900 base on later invoices',()=>{
 const first=resolveSubscriptionInvoiceTaxPhase(phaseFixture()),later=resolveSubscriptionInvoiceTaxPhase(phaseFixture(false));
 assert.equal(first.phase,'initial_with_upfront');assert.equal(first.gross_minor,71900);assert.equal(first.taxSnapshot.gross_minor,71900);
 assert.equal(later.phase,'base_cycle');assert.equal(later.gross_minor,69900);assert.equal(later.taxSnapshot.gross_minor,69900);
 assert.equal(first.taxSnapshot.taxable_minor+first.taxSnapshot.tax_minor,71900);assert.equal(later.taxSnapshot.taxable_minor+later.taxSnapshot.tax_minor,69900);
 assert.equal(first.period_start,new Date(1792292423*1000).toISOString());
});
test('late invoice phase uses its own paid source and period despite a moved provider cycle pointer/count',()=>{
 const input=phaseFixture();const first=resolveSubscriptionInvoiceTaxPhase(input);
 const late=resolveSubscriptionInvoiceTaxPhase({...input,subscription:{...input.subscription,current_start:999999999,current_end:1000000000,paid_count:1000}});
 assert.deepEqual(late,first);
});
test('foreign invoice/payment/order/subscription/plan lineage cannot select a retained tax source',()=>{
 const input=phaseFixture();
 for(const invoice of [{...input.invoice,id:'inv_Foreign'},{...input.invoice,payment_id:'pay_Foreign'},{...input.invoice,order_id:'order_Foreign'},{...input.invoice,subscription_id:'sub_Foreign'}])assert.throws(()=>resolveSubscriptionInvoiceTaxPhase({...input,invoice}),/does not match/);
 assert.throws(()=>resolveSubscriptionInvoiceTaxPhase({...input,subscription:{...input.subscription,plan_id:'plan_Foreign'}}));
 assert.throws(()=>resolveSubscriptionInvoiceTaxPhase({...input,payment:{...input.payment,invoice_id:null}}));
});
test('partial, unpaid, extra or changed invoice components cannot consume approved upfront source',()=>{
 const input=phaseFixture();
 for(const invoice of [{...input.invoice,amount_due:1},{...input.invoice,status:'issued'},{...input.invoice,partial_payment:true},{...input.invoice,amount_paid:71901},{...input.invoice,billing_end:input.invoice.billing_start},
  {...input.invoice,line_items:input.invoice.line_items.map(l=>l.type==='addon'?{...l,name:'Unapproved Usage'}:l)},
  {...input.invoice,line_items:input.invoice.line_items.map(l=>l.type==='addon'?{...l,quantity:3}:l)},
  {...input.invoice,line_items:[...input.invoice.line_items,input.invoice.line_items[1]]}])assert.throws(()=>resolveSubscriptionInvoiceTaxPhase({...input,invoice}));
 assert.throws(()=>resolveSubscriptionInvoiceTaxPhase({...input,payment:{...input.payment,amount:82482}}));
 assert.throws(()=>resolveSubscriptionInvoiceTaxPhase({...input,payment:{...input.payment,captured:false}}));
});
