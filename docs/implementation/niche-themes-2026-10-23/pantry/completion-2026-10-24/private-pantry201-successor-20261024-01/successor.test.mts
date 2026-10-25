import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createFirstPartyCatalogBundle as mainBundle, firstPartyThemeListings } from '../../../../../../packages/theme-engine/src/first-party-theme-catalog.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../../../packages/theme-engine/src/theme-bundle-core.ts';
import { withNicheOrderPresentation } from '../../../../../../packages/theme-engine/src/niche-order-presentation.ts';
import { LiquidThemePackageBundleSchema, buildLiquidThemePackagePersistencePayload, type LiquidThemePackageBundle } from '../../../../../../packages/theme-engine/src/theme-bundle.ts';
import { LiquidRenderer } from '../../../../../../packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../../../../packages/theme-engine/src/theme-settings.ts';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../../../../../../packages/theme-engine/src/theme-document.ts';
import { compilePortableToLiquidBundle } from '../../../../../../packages/theme-engine/src/portable-to-liquid.ts';
import { collectThemeTemplateValidationIssues } from '../../../../../../packages/theme-engine/src/index.ts';

const require=createRequire(import.meta.url);
const root=new URL('../../../../../../',import.meta.url);
const {JSDOM}=createRequire(new URL('packages/theme-engine/package.json',root))('jsdom');
const api=require('./src/first-party-theme-catalog.proposed.ts') as {createFirstPartyCatalogBundle:typeof mainBundle};
const {createPantryThemeV201}=require('./src/pantry-theme-v201.ts') as {createPantryThemeV201:(b:LiquidThemePackageBundle)=>LiquidThemePackageBundle};
const prior=require('../applied-private-heading-20261024-01/src/pantry-theme.ts') as {createPantryTheme:(b:LiquidThemePackageBundle)=>LiquidThemePackageBundle};
const epoch=process.env.PANTRY_201_EPOCH;
assert.ok(epoch&&/^(red01|red-final|green01|green02)$/.test(epoch),'Use a finite new test epoch');
const artifacts=new URL(`test-results/${epoch}/`,import.meta.url);
assert.equal(existsSync(artifacts),false,'Do not overwrite a completed epoch');mkdirSync(artifacts,{recursive:true});
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const original=()=>mainBundle('letbuyy-refresh',{designVersion:'2.0.0'});
const successor=()=>api.createFirstPartyCatalogBundle('letbuyy-refresh',{designVersion:'2.0.0',pantryVersion:'2.0.1'} as Parameters<typeof mainBundle>[1]);
const observations:Record<string,unknown>[]=[];
const rice={id:'7b669c70-1005-4000-8000-000000000002',title:'Basmati rice',price:220,currency:'INR',url:'/product/rice',images:[],featured_image:'',available:true,variants:[],options:[],food:{ingredients:'Rice (100%).',allergens:{status:'not_supplied'},netQuantityValue:1000,netQuantityUnit:'g',unitPriceMinor:2200,basisQuantity:100}};
const savedFacts='Per-item net quantity: 1000 g\nIngredients: Rice (100%).\nAllergen statement: Not recorded with this order.';
const sourceOrder={id:'synthetic-unpersisted-pantry-order',number:'SOURCE-PN-201',status:'pending',currency:'INR',line_items:[{title:'Basmati rice',quantity:2,line_price:44000,niche_facts_text:savedFacts}],total:44000};
type Page='collection'|'search'|'customers/order';
function rows(b:LiquidThemePackageBundle,key:'collection'|'search',title:string|undefined,show=true){
  const id=key==='collection'?'pantry-results':'search-results';const old=b.templates[key].sections[id];
  b.templates[key].sections[id]={...old,type:'collection-product-list',settings:{showHeading:show,...(title===undefined?{}:{title})}};return id;
}
function orderHeading(b:LiquidThemePackageBundle,value:string){b.templates['customers/order'].sections['customer-order-detail-default'].settings.heading=value;}
async function render(b:LiquidThemePackageBundle,key:Page,empty=false,order=sourceOrder,product=rice){
  const products=empty?[]:[product];const orderBefore=JSON.stringify(order);
  const result=await new LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'pantry-private-successor',path:key==='customers/order'?'/account/orders/source-only':`/${key}`,previewMode:false,locale:'en-IN'},storeTemplate:{themeId:'letbuyy-refresh',themeSettings:{...DEFAULT_THEME_SETTINGS,...b.config.settings_data.current},sections:[]},routeTemplate:{id:key,type:key==='customers/order'?'customer_order':key,layoutKey:'theme',sections:[]},liquidBundle:b,liquidTemplateKey:key,liquidContext:{shop:{name:'Synthetic Pantry'},product,collection:{title:'Canonical named rice shelf',products,pagination:{page:1,next_url:'/collections/rice?page=2'}},section_products:{'pantry-results':products,'search-results':products},buyer:{id:'source-only-buyer'},order}});
  assert.equal(result.status,'rendered',JSON.stringify(result.warnings));assert.deepEqual(result.warnings,[]);assert.ok(result.liquid);assert.equal(JSON.stringify(order),orderBefore);
  const html=result.liquid.contentForLayout,style=result.liquid.headStyleText??'',digest=sha(html);
  if(!existsSync(new URL(`${digest}.html`,artifacts)))writeFileSync(new URL(`${digest}.html`,artifacts),html);
  observations.push({key,empty,packageVersion:b.package.version,htmlSha256:digest,styleSha256:sha(style)});return {html,style};
}
function inspect(html:string,id?:string){const dom=new JSDOM(html);const target=id?dom.window.document.querySelector(`[data-section-id="${id}"]`):dom.window.document.body;assert.ok(target);const value={h1:[...target.querySelectorAll('h1')].map((x:Element)=>x.textContent),h2:[...target.querySelectorAll('h2')].map((x:Element)=>x.textContent),facts:target.querySelector('.lb-order-facts__text')?.textContent??null,missingFacts:target.querySelector('.lb-order-facts__missing')?.textContent??null,cards:target.querySelectorAll('.pn-card').length,unsafe:target.querySelector('script,img[src="x"],[onerror]')!==null,text:target.textContent};dom.window.close();return value;}

test('successor is opt-in2.0.1/version3 with unchanged stable Pantry identity; default stays2.0.0',()=>{
  const next=successor();assert.equal(next.package.slug,'letbuyy-refresh');assert.equal(next.package.name,'Pantry');assert.equal(next.package.version,'2.0.1');assert.equal(next.package.version_number,3);assert.equal(original().package.version,'2.0.0');
  assert.equal(firstPartyThemeListings({designVersion:'2.0.0'}).find(x=>x.slug==='letbuyy-refresh')?.id,'7b669c70-0000-4000-8000-000000000005');
});

test('new dispatch option preserves all ten default/legacy outputs and cannot opt in another theme or bare legacy path',()=>{
  for(const listing of firstPartyThemeListings({designVersion:'2.0.0'})){
    assert.deepEqual(api.createFirstPartyCatalogBundle(listing.slug,{designVersion:'2.0.0'}),mainBundle(listing.slug,{designVersion:'2.0.0'}),listing.slug);
    assert.deepEqual(api.createFirstPartyCatalogBundle(listing.slug),mainBundle(listing.slug),`${listing.slug}/legacy`);
  }
  assert.deepEqual(api.createFirstPartyCatalogBundle('letbuyy-refresh',{pantryVersion:'2.0.1'} as Parameters<typeof mainBundle>[1]),mainBundle('letbuyy-refresh'));
  assert.deepEqual(api.createFirstPartyCatalogBundle('letbuyy-bloom',{designVersion:'2.0.0',playfieldVersion:'2.0.1',pantryVersion:'2.0.1'} as Parameters<typeof mainBundle>[1]),mainBundle('letbuyy-bloom',{designVersion:'2.0.0',playfieldVersion:'2.0.1'}));
});

test('existing merchant2.0.0 template values, resource identities and tokens survive without rebuilding defaults',()=>{
  const base=original();base.templates.index.sections['pantry-hero'].settings.heading='Merchant existing heading';base.templates.index.sections['pantry-shelves'].settings.collection1='existing-canonical-collection';base.config.settings_data.current.primaryColor='#123456';base.templates.search.sections['search-results'].settings.title='Saved unshown title';base.package.checksum='1'.repeat(64);
  const before=structuredClone(base),next=createPantryThemeV201(base);assert.deepEqual(base,before);assert.deepEqual(next.templates,before.templates);assert.deepEqual(next.config,before.config);assert.deepEqual(next.blocks,before.blocks);assert.equal(next.package.version,'2.0.1');assert.equal(next.package.checksum,undefined);
});

test('successor is idempotent, input-immutable and retains post-construction merchant edits without duplicate saved-facts injection',()=>{
  const next=successor();orderHeading(next,'Merchant order label');next.templates.search.sections['search-results'].settings.title='Merchant shelf';const before=structuredClone(next),again=createPantryThemeV201(next);assert.deepEqual(next,before);assert.deepEqual(again,next);assert.notEqual(again,next);assert.equal(again.sections['customer-order-detail'].source.split('lb:niche-order-presentation:v1').length-1,1);assert.equal(again.layout.theme.source.split('data-niche-order-presentation="1"').length-1,1);
});

test('version boundary rejects malformed201 and a drifted200 source instead of silently accepting incompatible headings',()=>{
  const malformed=successor();malformed.sections['customer-order-detail'].source=malformed.sections['customer-order-detail'].source.replace(' #{{ order.number }}','');const before=JSON.stringify(malformed);assert.throws(()=>createPantryThemeV201(malformed));assert.equal(JSON.stringify(malformed),before);
  const drift=original();drift.sections['collection-product-list'].source=drift.sections['collection-product-list'].source.replace('pn-wrap pn-section','different-row-contract');assert.throws(()=>createPantryThemeV201(drift));
});

test('the previously applied private collection correction is reused exactly when wrapping its2.0.0 source output',()=>{
  const previous=withNicheOrderPresentation(prior.createPantryTheme(createLetbuyyCoreLiquidThemeBundleFixture()));const before=structuredClone(previous),next=createPantryThemeV201(previous);assert.deepEqual(previous,before);assert.deepEqual(next.sections['collection-product-list'],before.sections['collection-product-list']);assert.equal(next.package.version,'2.0.1');assert.equal(next.sections['collection-product-list'].schema.settings.filter(f=>f.id==='showHeading').length,1);
});

test('actual successor manifests and canonical JSON/document/portable roundtrip preserve both headings and explicitfalse',()=>{
  const b=successor();rows(b,'search','Saved Pantry shelf',false);orderHeading(b,'Saved receipt label');const manifest=buildLiquidThemePackagePersistencePayload(b).schemaManifest;const runtime={sectionSchemas:manifest.section_schemas,settingsSchema:manifest.settings_schema};const wire=JSON.parse(JSON.stringify({themeId:b.package.slug,schema_version:b.schema_version,engineVersion:b.renderer.renderer_version,rendererEngine:'liquid',liquidBundle:b,sections:{},templates:b.templates,themeSettings:b.config.settings_data.current}));assert.deepEqual(collectThemeTemplateValidationIssues({templateConfig:wire,runtime,themeSlug:b.package.slug}),[]);assert.deepEqual(fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(b)))),b);const compiled=compilePortableToLiquidBundle(wire,{baseBundle:b});assert.deepEqual(compiled.warnings,[]);assert.deepEqual(compiled.bundle.templates,b.templates);assert.equal(b.sections['collection-product-list'].schema.settings.find(x=>x.id==='showHeading')?.default,false);assert.equal(b.sections['customer-order-detail'].schema.settings.find(x=>x.id==='heading')?.default,'Order');assert.equal(LiquidThemePackageBundleSchema.safeParse(b).success,true);
});

test('populated collection and search rows use edited heading A/B over the actual nonblank collection title',async()=>{
  for(const key of ['collection','search'] as const){const b=successor(),id=rows(b,key,'Pantry heading A');const a=inspect((await render(b,key)).html,id);b.templates[key].sections[id].settings.title='Pantry heading B';const z=inspect((await render(b,key)).html,id);assert.deepEqual(a.h2,['Pantry heading A']);assert.deepEqual(z.h2,['Pantry heading B']);assert.equal(z.cards,1);assert.match(z.text,/Basmati rice/);}
});

test('explicit clear/whitespace uses the collection fallback; omitted title preserves the existing schema default',async()=>{
  for(const title of ['','   ',undefined]){const b=successor(),id=rows(b,'collection',title);const z=inspect((await render(b,'collection')).html,id);assert.deepEqual(z.h2,[title===undefined?'Everyday staples':'Canonical named rice shelf']);}
});

test('fresh successor default collection/search/order HTML and styles remain byte-identical to frozen200 output',async()=>{
  for(const key of ['collection','search','customers/order'] as const)assert.deepEqual(await render(successor(),key),await render(original(),key),key);
});

test('declared order heading A/B changes the prefix while retaining authoritative order.number and saved facts',async()=>{
  const b=successor();orderHeading(b,'Your Pantry purchase');const a=inspect((await render(b,'customers/order')).html);orderHeading(b,'Pantry receipt');const z=inspect((await render(b,'customers/order')).html);assert.deepEqual(a.h1,['Your Pantry purchase #SOURCE-PN-201']);assert.deepEqual(z.h1,['Pantry receipt #SOURCE-PN-201']);assert.equal(z.facts,savedFacts);
});

test('blank/whitespace order heading restores Order plus authoritative number and canonical unrecorded-facts fallback',async()=>{
  for(const title of ['','   ']){const b=successor();orderHeading(b,title);assert.deepEqual(inspect((await render(b,'customers/order')).html).h1,['Order #SOURCE-PN-201']);}
  const noFacts={...sourceOrder,line_items:sourceOrder.line_items.map(x=>({...x,niche_facts_text:''}))};const changedCurrent={...rice,title:'Current changed food',price:240};const z=inspect((await render(successor(),'customers/order',false,noFacts,changedCurrent)).html);assert.equal(z.facts,null);assert.match(z.missingFacts,/not recorded with this order/);assert.doesNotMatch(z.text,/Current changed food/);
});

test('both merchant headings escape hostile markup and Unicode while order identity and facts remain intact',async()=>{
  const hostile='<img src=x onerror=headingAttack()> <script>x()</script> चावल / அரிசி';const b=successor(),id=rows(b,'collection',hostile);const c=inspect((await render(b,'collection')).html,id);assert.deepEqual(c.h2,[hostile]);assert.equal(c.unsafe,false);orderHeading(b,hostile);const o=inspect((await render(b,'customers/order')).html);assert.deepEqual(o.h1,[hostile+' #SOURCE-PN-201']);assert.equal(o.unsafe,false);assert.equal(o.facts,savedFacts);
});

test('only version/checksum and the two heading sections differ; product facts/layout/niche order style remain unchanged',()=>{
  const base=original(),next=successor(),rest=structuredClone(next);rest.package=base.package;rest.sections['collection-product-list']=base.sections['collection-product-list'];rest.sections['customer-order-detail']=base.sections['customer-order-detail'];assert.deepEqual(rest,base);assert.deepEqual(next.sections['product-detail'],base.sections['product-detail']);assert.deepEqual(next.layout,base.layout);assert.equal(next.sections['customer-order-detail'].source.includes('lb:niche-order-presentation:v1'),true);
});

test.after(()=>writeFileSync(new URL('renders.json',artifacts),JSON.stringify({recordedAt:new Date().toISOString(),classification:'PRIVATE201_SOURCE_SCHEMA_AND_LIQUID_ONLY_NOT_INSTALLED_OR_ORDER_ACCEPTANCE',observations,syntheticOrderUnpersisted:true,liveEffects:0},null,2)+'\n'));
