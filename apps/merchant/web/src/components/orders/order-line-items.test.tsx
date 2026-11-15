import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import path from 'node:path';
import React, { act } from 'react';
import { createLetbuyyApiClient } from '@letbuyy/api-client';
import { readProductFactSnapshot } from '@letbuyy/commerce-core';
import { readOrderLineItems } from './order-line-items';
const requireUI=createRequire(path.resolve(__dirname,'../../../../../../packages/typescript/ui/package.json'));
const {JSDOM}=requireUI('jsdom') as {JSDOM:new(html:string,options:{url:string})=>{window:Window&typeof globalThis&{close():void}}};
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
function snapshot(){const result=readProductFactSnapshot({version:1,selected_options:[{name:'Shade',value:'Pink Clay'}],facts:{beauty:{shadeOptionName:'Shade',shades:[{value:'Rosewater',code:'RW01'},{value:'Pink Clay',code:'PC02',ingredients:'Saved Pink ingredients'}]},books:{kind:'book',edition:'Saved edition 2'}}});assert.ok(result);return result;}
const row=()=>({id:'saved-order',order_number:'SAVED-1',status:'pending_cod',payment_status:'pending',total:520,subtotal:520,tax:0,discount:0,shipping_cost:0,currency:'INR',created_at:'2026-10-01T00:00:00Z',items:[{name:'Saved tint',title:'Saved tint',quantity:1,unit_price:520,total:520,niche_snapshot:snapshot(),product_snapshot:{private_supplier:'PRIVATE'}}]});
test('actual SDK unwrapping preserves niche; merchant mapper validates it and strips raw/private data',async()=>{
    const client=createLetbuyyApiClient({baseUrl:'https://order-sdk.fake.test/v1',fetch:async input=>{assert.match(String(input),/orders\/saved-order$/);return Response.json({success:true,data:row()});}});
    const order=await client.orders.get('saved-order');const lines=readOrderLineItems((order as unknown as Record<string,unknown>).items);
    assert.equal(lines[0].niche_snapshot?.selected_options?.[0].value,'Pink Clay');assert.equal(lines[0].unit_price,520);
    assert.doesNotMatch(JSON.stringify(lines),/product_snapshot|private_supplier|PRIVATE/);
    assert.equal(readOrderLineItems([{...row().items[0],niche_snapshot:{version:99,facts:{}}}])[0].niche_snapshot,null);
});
async function mount(initial:Record<string,unknown>,status=200){
    const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://merchant.example.test/alpha/orders/saved-order'});
    const names=['window','document','navigator','self','fetch'];const previous=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
    for(const name of names.slice(0,4))Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:name==='window'||name==='self'?dom.window:Reflect.get(dom.window,name)});
    const calls:string[]=[];let payload=initial;
    globalThis.fetch=(async input=>{const url=String(input);calls.push(url);assert.match(url,/^\/api\/stores\/(alpha|beta)\/orders\/saved-order$/);return Response.json(url.includes('/beta/')?{error:'Access denied'}:{data:payload},{status:url.includes('/beta/')?403:status});}) as typeof fetch;
    const {createRoot}=await import('react-dom/client');const {PathParamsContext,PathnameContext}=await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js');const {AppRouterContext}=await import('next/dist/shared/lib/app-router-context.shared-runtime.js');const {default:Page}=await import('../../app/[store]/orders/[orderId]/page');
    const root=createRoot(dom.window.document.getElementById('root')!);let key=0;const router={ bfcacheId: 'synthetic-router-cache', back(){},forward(){},refresh(){},hmrRefresh(){},push(){},replace(){},prefetch(){}};
    const render=async(store='alpha',remount=false)=>{if(remount)key++;await act(async()=>{root.render(<AppRouterContext.Provider value={router}><PathParamsContext.Provider value={{store,orderId:'saved-order'}}><PathnameContext.Provider value={`/${store}/orders/saved-order`}><Page key={key}/></PathnameContext.Provider></PathParamsContext.Provider></AppRouterContext.Provider>);});};
    await render();
    const close=async()=>{await act(async()=>root.unmount());dom.window.close();for(const name of names){if(previous[name])Object.defineProperty(globalThis,name,previous[name]!);else Reflect.deleteProperty(globalThis,name);}};
    return {document:dom.window.document,calls,render,replace:(next:Record<string,unknown>)=>{payload=next;},close};
}
test('actual merchant order page shows historical facts after current product deletion and hides them on denied store read',async()=>{
    const saved=row();const today={name:'Today product'};Object.assign(saved.items[0],{product:today});
    const h=await mount(saved);
    try{
        for(const expected of ['PC02','Pink Clay','Saved Pink ingredients','Saved edition 2'])assert.ok(h.document.body.textContent!.includes(expected),expected);
        assert.doesNotMatch(h.document.body.textContent!,/RW01|PRIVATE/);today.name='Changed today';Reflect.deleteProperty(saved.items[0],'product');h.replace(saved);await h.render('alpha',true);
        assert.match(h.document.body.textContent!,/Saved edition 2/);assert.equal(h.calls.length,2);assert.ok(h.calls.every(url=>!url.includes('/products')));
        await h.render('beta');assert.match(h.document.body.textContent!,/Access denied/);assert.doesNotMatch(h.document.body.textContent!,/PC02|Saved edition 2|Saved Pink ingredients/);
    }finally{await h.close();}
});
test('actual merchant page escapes hostile saved text and keeps malformed legacy facts neutral',async()=>{
    const saved=row();saved.items[0].niche_snapshot={...snapshot(),facts:{beauty:{schemaVersion:1,shadeOptionName:'Shade',shades:[],ingredients:'<img src=x onerror="attack()"><script>attack()</script>'}}};
    const h=await mount(saved);
    try{
        assert.equal(h.document.querySelector('script,[onerror],img[src="x"]'),null);assert.ok(h.document.body.textContent!.includes('<script>attack()</script>'));
        h.replace({...row(),items:[{name:'Legacy',quantity:1,unit_price:520,total:520,niche_snapshot:{version:99,facts:{}}}]});await h.render('alpha',true);
        assert.match(h.document.body.textContent!,/Product details were not recorded with this order/);assert.equal(h.document.querySelector('details'),null);
    }finally{await h.close();}
});

test('actual Merchant receipt shows saved coupon, savings and final amount without recalculating it',async()=>{
    const h=await mount({...row(),coupon_code:'SAVE10',discount:19.9,coupon_discount:19.9,subtotal:199,shipping_cost:20,tax:35.82,total:234.92});
    try{const text=h.document.body.textContent!;assert.match(text,/Coupon \(SAVE10\)/);assert.match(text,/19\.90/);assert.match(text,/234\.92/);}finally{await h.close();}
});
