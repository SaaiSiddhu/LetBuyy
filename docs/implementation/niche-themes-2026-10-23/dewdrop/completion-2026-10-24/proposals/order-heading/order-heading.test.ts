import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createDewdropTheme } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/dewdrop-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-bundle-core';
import { withNicheOrderPresentation } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/niche-order-presentation';
import { LiquidRenderer } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-settings';
const {JSDOM}=createRequire('/Volumes/Projects/LetBuyy/packages/theme-engine/package.json')('jsdom') as {JSDOM:new(markup:string)=>{window:{document:Document;close():void}}};
const savedOrder={number:'ORD-SOURCE-UNIT',status:'pending_cod',currency:'INR',total:114000,line_items:[{title:'Saved synthetic tint',quantity:2,line_price:112000,niche_facts_text:'Shade name: Pink Clay\nShade code: PC02\nPer-item net quantity: 6 ml'}]};
async function render(title?:string,scope:'own'|'missing'|'unavailable'='own'){
 const bundle=withNicheOrderPresentation(createDewdropTheme(createLetbuyyCoreLiquidThemeBundleFixture()));
 if(process.env.DEWDROP_ORDER_HEADING_TARGET==='proposal'){
  const old='<h1>Order #{{ order.number }}</h1>';assert.ok(bundle.sections['customer-order-detail'].source.includes(old));
  bundle.sections['customer-order-detail'].source=bundle.sections['customer-order-detail'].source.replace(old,"<h1>{{ section.settings.heading | default: 'Order' }} #{{ order.number }}</h1>");
 }
 if(title!==undefined)bundle.templates['customers/order'].sections['customer-order-detail-default'].settings.heading=title;
 const order=structuredClone(savedOrder);const before=JSON.stringify(order);
 const result=await new LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'dewdrop-order-source',path:'/account/orders/synthetic',previewMode:false,locale:'en-IN'},storeTemplate:{themeId:'letbuyy-aura',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},routeTemplate:{id:'customers/order',type:'account',layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:'customers/order',liquidContext:{shop:{name:'Synthetic source-only order'},buyer:scope==='missing'?null:{id:'synthetic-unit-buyer'},buyer_unavailable:scope==='unavailable',order}});
 assert.equal(result.status,'rendered',JSON.stringify(result.warnings));assert.deepEqual(result.warnings,[]);assert.equal(JSON.stringify(order),before,'presentation must not change order input');
 const dom=new JSDOM(result.liquid!.contentForLayout);return {document:dom.window.document,heading:dom.window.document.querySelector('h1')?.textContent,close:()=>dom.window.close()};
}
test('custom Heading is visible while immutable order number and saved niche facts remain present',async()=>{
 const r=await render('My receipt');try{assert.equal(r.heading,'My receipt #ORD-SOURCE-UNIT');assert.match(r.document.body.textContent??'',/PC02/);assert.match(r.document.body.textContent??'',/6 ml/);}finally{r.close();}
});
test('default Heading preserves original Order label and saved order number',async()=>{
 const r=await render();try{assert.equal(r.heading,'Order #ORD-SOURCE-UNIT');}finally{r.close();}
});
test('blank Heading safely falls back to original Order label',async()=>{
 const r=await render('');try{assert.equal(r.heading,'Order #ORD-SOURCE-UNIT');}finally{r.close();}
});
test('hostile Heading is inert text with immutable number and no attack nodes',async()=>{
 const hostile='<img src=x onerror="fixtureAttack()"><script>fixtureAttack()</script>';const r=await render(hostile);try{assert.equal(r.heading,hostile+' #ORD-SOURCE-UNIT');assert.equal(r.document.querySelectorAll('img[src="x"],script,[onerror]').length,0);}finally{r.close();}
});
test('missing and unavailable buyer branches do not disclose the order or saved facts',async()=>{
 for(const scope of ['missing','unavailable']as const){const r=await render('Private receipt',scope);try{assert.equal(r.heading,undefined);assert.doesNotMatch(r.document.body.textContent??'',/ORD-SOURCE-UNIT|PC02|Private receipt/);assert.match(r.document.body.textContent??'',scope==='missing'?/sign in with LetBuyy/:/temporarily unavailable/);}finally{r.close();}}
});
