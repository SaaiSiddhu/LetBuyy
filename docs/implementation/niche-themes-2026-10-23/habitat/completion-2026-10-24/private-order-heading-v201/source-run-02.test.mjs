import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHabitatTheme } from '../../../../../../packages/theme-engine/src/habitat-theme.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../../../packages/theme-engine/src/theme-bundle-core.ts';
import { LiquidRenderer } from '../../../../../../packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../../../../packages/theme-engine/src/theme-settings.ts';
import { withNicheOrderPresentation } from '../../../../../../packages/theme-engine/src/niche-order-presentation.ts';
import { createHabitatThemeV201 } from './habitat-theme-v201.ts';
const here=dirname(fileURLToPath(import.meta.url)), out=resolve(here,'source-run-02');
assert.ok(!existsSync(out),'preserve every existing run, including failures'); mkdirSync(out);
const hash=x=>createHash('sha256').update(x).digest('hex');
const frozen=createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture());
const frozenJson=JSON.stringify(frozen), frozenDigest=hash(frozenJson);
const record={classification:'PRIVATE_FACTORY_AND_ACTUAL_LIQUID_SOURCE_RENDER_TESTS_NOT_BROWSER_PERSISTENCE_AUTH_OR_PURCHASE',node:process.version,frozenFactorySha256:frozenDigest,sourcePinFiles:{},observations:[],mainEdits:false,catalogDispatchEdited:false,primaryOrdersCreated:0,browserActions:0,providerCalls:0};
const root=resolve(here,'../../../../../..');
const {JSDOM}=createRequire(resolve(root,'packages/theme-engine/package.json'))('jsdom');
const inventory=JSON.parse(readFileSync(resolve(here,'../CAPABILITY_INVENTORY.json'),'utf8'));
const pins=[...Object.keys(inventory.sourceManifest),'packages/theme-engine/src/niche-order-presentation.ts','packages/theme-engine/src/theme-renderer.ts','packages/theme-engine/src/theme-settings.ts'];
for(const p of pins) record.sourcePinFiles[p]=hash(readFileSync(resolve(root,p)));
process.on('exit',()=>{record.allPinnedFilesStillExact=pins.every(p=>record.sourcePinFiles[p]===hash(readFileSync(resolve(root,p))));writeFileSync(resolve(out,'OBSERVED.json'),JSON.stringify(record,null,2)+'\n');});
const sampleOrder={number:'HAB-SOURCE-ONLY',status:'pending_cod',currency:'INR',total:17800,line_items:[{title:'Recorded source-only desk',quantity:2,line_price:17800,niche_facts_text:'Width: 48 in\nFinish: Natural\nPackage height: not recorded'}]};
async function render(bundle,heading,label,order=sampleOrder){
 const copy=structuredClone(bundle),template=copy.templates['customers/order'];
 const id=template.order.find(id=>template.sections[id].type==='customer-order-detail');
 if(heading!==undefined)template.sections[id].settings.heading=heading;
 const result=await new LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'habitat-source-only',path:'/account/orders/source-only',previewMode:false,locale:'en-IN'},storeTemplate:{themeId:'letbuyy-craft',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},routeTemplate:{id:'customers/order',type:'page',layoutKey:'theme',sections:[]},liquidBundle:copy,liquidTemplateKey:'customers/order',liquidContext:{shop:{name:'Habitat source-only'},buyer:{id:'source-only-buyer'},order}});
 const html=result.liquid?.contentForLayout;
 writeFileSync(resolve(out,`${label}.html`),html??JSON.stringify(result));
 assert.equal(typeof html,'string',`${label}: actual renderer emitted HTML`);
 const document=new JSDOM(html).window.document, h1=document.querySelector('.lb-order-detail h1')?.textContent;
 record.observations.push({label,heading:h1,sha256:hash(html),status:result.status,warnings:result.warnings??[],orderSource:'synthetic in-memory drop; NOT primary/history proof'});
 return {html,document,h1};
}
test('frozen2.0.0 stays exact; private successor changes only its opted-in order heading from catalog-equivalent baseline',()=>{
 assert.equal(frozenDigest,'2a652a7435f8a8a6ff699f02db829ce1ae1399d5b7609471d9e7192eb13ccd3d');
 const baseline=withNicheOrderPresentation(frozen), successor=createHabitatThemeV201(frozen);
 assert.equal(successor.package.version,'2.0.1');assert.equal(successor.package.version_number,3);
 assert.equal(JSON.stringify(frozen),frozenJson);
 for(const key of ['templates','blocks','config','layout','renderer','locales','snippets'])assert.deepEqual(successor[key],baseline[key],key);
 for(const [type,section]of Object.entries(baseline.sections))if(type!=='customer-order-detail')assert.deepEqual(successor.sections[type],section,type);
 assert.deepEqual(successor.sections['customer-order-detail'].schema,baseline.sections['customer-order-detail'].schema);
 assert.equal(hash(JSON.stringify(createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture()))),frozenDigest);
});
test('existing merchant draft values and actual identities survive opt-in without reapplying defaults',()=>{
 const edited=structuredClone(frozen);edited.config.settings_data.current.primaryColor='#123456';
 edited.templates.index.sections['habitat-measurement-guide'].settings.title='Existing merchant guide';
 edited.templates.index.sections['owned-faq-id']={type:'faq-accordion',settings:{title:'Owned FAQ'},blocks:{'owned-block-id':{type:'faq-item',settings:{question:'Same label',answer:'Keep this'},disabled:false,blocks:{},block_order:[]}},block_order:['owned-block-id'],disabled:false};
 edited.templates.index.order.push('owned-faq-id');const before=structuredClone(edited), successor=createHabitatThemeV201(edited);
 assert.deepEqual(edited,before);assert.deepEqual(successor.templates,before.templates);assert.deepEqual(successor.config,before.config);assert.deepEqual(successor.blocks,before.blocks);
});
test('private successor is idempotent and rejects corrupt/future successor contracts',()=>{
 const successor=createHabitatThemeV201(frozen);assert.deepEqual(createHabitatThemeV201(successor),successor);
 const malformed=structuredClone(successor);malformed.sections['customer-order-detail'].source=malformed.sections['customer-order-detail'].source.replace('section.settings.heading','section.settings.other');assert.throws(()=>createHabitatThemeV201(malformed),/canonical order heading/);
 const future=structuredClone(frozen);future.package.version='2.0.2';assert.throws(()=>createHabitatThemeV201(future),/not supported/);
});
test('actual source renderer reproduces inert frozen heading and makes deliberate successor edit effective',async()=>{
 const oldA=await render(withNicheOrderPresentation(frozen),'Habitat alpha','frozen-alpha'), oldB=await render(withNicheOrderPresentation(frozen),'Habitat beta','frozen-beta');
 assert.equal(oldA.h1,'Order #HAB-SOURCE-ONLY');assert.equal(oldA.h1,oldB.h1);
 const proposed=createHabitatThemeV201(frozen), nextA=await render(proposed,'Habitat alpha','proposed-alpha'), nextB=await render(proposed,'Habitat beta','proposed-beta');
 assert.equal(nextA.h1,'Habitat alpha #HAB-SOURCE-ONLY');assert.equal(nextB.h1,'Habitat beta #HAB-SOURCE-ONLY');assert.notEqual(nextA.h1,nextB.h1);
 const defaults=await render(proposed,undefined,'proposed-default'), blank=await render(proposed,'   ','proposed-blank');assert.equal(defaults.h1,oldA.h1);assert.equal(blank.h1,oldA.h1);
});
test('merchant heading stays escaped and saved-text outlet stays unchanged in source-only render',async()=>{
 const attack='<img src=x onerror="attack()"><script>attack()</script>',result=await render(createHabitatThemeV201(frozen),attack,'proposed-escaped');
 assert.equal(result.h1,`${attack} #HAB-SOURCE-ONLY`);assert.equal(result.document.querySelector('.lb-order-detail h1 img'),null);assert.equal(result.document.querySelector('.lb-order-detail h1 script'),null);
 assert.equal(result.document.querySelector('.lb-order-facts__text')?.textContent,sampleOrder.line_items[0].niche_facts_text);
 assert.equal(JSON.stringify(frozen),frozenJson);assert.ok(pins.every(p=>record.sourcePinFiles[p]===hash(readFileSync(resolve(root,p)))),'source pins stable through private tests');
});
