import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>') as unknown as {window:Window & typeof globalThis;reconfigure(options:{url:string}):void};
dom.reconfigure({url:'https://shop.example.test/account/addresses'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,CustomEvent:dom.window.CustomEvent,FormData:dom.window.FormData});
let registration:Promise<void>|undefined;
const register=()=>registration??=import('./liquid-hydration-islands').then(m=>m.registerLiquidHydrationIslands());
const tick=()=>new Promise(r=>setTimeout(r,0));
async function until(check:()=>boolean){for(let i=0;i<50&&!check();i++)await tick();assert.ok(check(),'island reached its expected visible state');}
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function manager(buyer=true){const el=document.createElement('lb-address-manager');if(buyer)el.dataset.accountType='buyer';document.body.append(el);return el;}
function action(el:Element,selector:string){const button=el.querySelector<HTMLButtonElement>(selector);assert.ok(button,selector);button.click();}
function fill(el:Element){for(const[name,value]of Object.entries({full_name:'Synthetic Buyer',address_line1:'Synthetic Road',city:'Bengaluru',state:'Karnataka',postal_code:'560001'})){const field=el.querySelector<HTMLInputElement>(`[name="${name}"]`);assert.ok(field);field.value=value;}}
function submit(el:Element){const form=el.querySelector('form');assert.ok(form);form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));}

test('Liquid buyer address create/edit/default/delete retain the loaded canonical buyer ID',async()=>{
 await register();const original=globalThis.fetch;let rows:Record<string,unknown>[]=[];const writes:{method:string;headers:Headers;body:Record<string,unknown>}[]=[];
 globalThis.fetch=(async(input,init)=>{const url=String(input),method=init?.method||'GET';if(url==='/api/buyer/profile')return json({buyer:{id:'buyer-a'}});if(method==='GET')return json({addresses:rows});
  const body=init?.body?JSON.parse(String(init.body)):{};writes.push({method,headers:new Headers(init?.headers),body});
  if(method==='POST')rows=[{...body,id:'address-a'}];if(method==='PATCH')rows=rows.map(row=>({...row,...body}));if(method==='DELETE')rows=[];return json({});}) as typeof fetch;
 const el=manager();try{
  await until(()=>Boolean(el.querySelector('[data-lb-addr-add]')));action(el,'[data-lb-addr-add]');fill(el);submit(el);await until(()=>Boolean(el.querySelector('[data-lb-addr-edit]')));
  action(el,'[data-lb-addr-edit]');fill(el);submit(el);await until(()=>Boolean(el.querySelector('[data-lb-addr-default]')));
  action(el,'[data-lb-addr-default]');await until(()=>Boolean(el.querySelector('.lb-address-card--default')));
  action(el,'[data-lb-addr-delete]');await until(()=>Boolean(el.querySelector('.lb-addresses__empty')));
  assert.deepEqual(writes.map(w=>w.method),['POST','PATCH','PATCH','DELETE']);assert.ok(writes.every(w=>w.headers.get('x-letbuyy-expected-buyer-id')==='buyer-a'));assert.equal(writes[0].body.label,'home');
 }finally{el.remove();globalThis.fetch=original;}
});

for(const outcome of ['expired','unavailable','missing-id'])test('Liquid address identity '+outcome+' stays unavailable instead of rendering an editable empty book',async()=>{
 await register();const original=globalThis.fetch;const calls:string[]=[];globalThis.fetch=(async input=>{calls.push(String(input));return outcome==='missing-id'?json({buyer:{}}):json({},outcome==='expired'?401:503);}) as typeof fetch;
 const el=manager();try{await until(()=>Boolean(el.querySelector('[role="alert"]')));assert.deepEqual(calls,['/api/buyer/profile']);assert.equal(el.querySelector('[data-lb-addr-add]'),null);assert.equal(el.querySelector('.lb-addresses__empty'),null);}finally{el.remove();globalThis.fetch=original;}
});

test('a stale Liquid address form keeps its original buyer ID and preserves the draft on account-change refusal',async()=>{
 await register();const original=globalThis.fetch;let current='buyer-a',attempted:string|null=null;
 globalThis.fetch=(async(input,init)=>{if(String(input)==='/api/buyer/profile')return json({buyer:{id:current}});if(!init?.method)return json({addresses:[]});attempted=new Headers(init.headers).get('x-letbuyy-expected-buyer-id');assert.equal(attempted,'buyer-a');return json({error:'Your account changed'},409);}) as typeof fetch;
 const el=manager();try{await until(()=>Boolean(el.querySelector('[data-lb-addr-add]')));action(el,'[data-lb-addr-add]');fill(el);current='buyer-b';submit(el);await until(()=>/account changed/i.test(el.textContent||''));assert.equal(attempted,'buyer-a');assert.equal(el.querySelector<HTMLInputElement>('[name="address_line1"]')?.value,'Synthetic Road');}finally{el.remove();globalThis.fetch=original;}
});

for(const delayed of ['profile','addresses'])test('retired '+delayed+' load cannot overwrite a reconnected buyer address view',async()=>{
 await register();const original=globalThis.fetch;let generation=0,release!:(r:Response)=>void;const pending=new Promise<Response>(r=>release=r);
 globalThis.fetch=(async input=>{const path=String(input);if(path==='/api/buyer/profile'){generation++;if(generation===1&&delayed==='profile')return pending;return json({buyer:{id:generation===1?'buyer-a':'buyer-b'}});}if(generation===1)return pending;return json({addresses:[{id:'address-b',full_name:'Synthetic B',address_line1:'Current B Road'}]});}) as typeof fetch;
 const el=manager();try{await tick();el.remove();document.body.append(el);await until(()=>/Current B Road/.test(el.textContent||''));release(delayed==='profile'?json({buyer:{id:'buyer-a'}}):json({addresses:[{address_line1:'Retired A Road'}]}));await tick();await tick();assert.match(el.textContent||'',/Current B Road/);assert.doesNotMatch(el.textContent||'',/Retired A Road/);}finally{el.remove();globalThis.fetch=original;}
});

test('legacy store-customer address transport does not acquire canonical buyer identity or headers',async()=>{
 await register();const original=globalThis.fetch;const calls:string[]=[];let write:RequestInit|undefined;
 globalThis.fetch=(async(input,init)=>{calls.push(String(input));if(init?.method)write=init;return json({addresses:[]});}) as typeof fetch;
 const el=manager(false);try{await until(()=>Boolean(el.querySelector('[data-lb-addr-add]')));action(el,'[data-lb-addr-add]');fill(el);submit(el);await until(()=>Boolean(write));assert.equal(write?.method,'POST');assert.equal(new Headers(write?.headers).get('x-letbuyy-expected-buyer-id'),null);assert.ok(calls.every(path=>path==='/api/customer/addresses'));}finally{el.remove();globalThis.fetch=original;}
});
