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
import proposedFactory from './habitat-theme-v201.ts';
const {createHabitatThemeV201}=proposedFactory;
const here=dirname(fileURLToPath(import.meta.url)), out=resolve(here,'source-run-01');
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
 for(const key of ['templates','config','layout','renderer','locales','snippets'])assert.deepEqual(successor[key],baseline[key],key);
 for(const [type,section]of Object.entries(baseline.sections))if(type!=='customer-order-detail')assert.deepEqual(successor.sections[type],section,type);
 assert.deepEqual(successor.sections['customer-order-detail'].schema,baseline.sections['customer-order-detail'].schema);
 for(const [type,block]of Object.entries(baseline.blocks)){
  if(type!=='badge')assert.deepEqual(successor.blocks[type],block);
  else assert.deepEqual({...successor.blocks.badge,source:block.source},block);
 }
 assert.equal(hash(JSON.stringify(createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture()))),frozenDigest);
});
test('existing merchant draft values and actual identities survive opt-in without reapplying defaults',()=>{
 const edited=structuredClone(frozen);edited.config.settings_data.current.primaryColor='#123456';
 edited.templates.index.sections['habitat-measurement-guide'].settings.title='Existing merchant guide';
 edited.templates.index.sections['owned-faq-id']={type:'faq-accordion',settings:{title:'Owned FAQ'},blocks:{'owned-block-id':{type:'faq-item',settings:{question:'Same label',answer:'Keep this'},disabled:false,blocks:{},block_order:[]}},block_order:['owned-block-id'],disabled:false};
 edited.templates.index.order.push('owned-faq-id');const before=structuredClone(edited), successor=createHabitatThemeV201(edited);
 assert.deepEqual(edited,before);assert.deepEqual(successor.templates,before.templates);assert.deepEqual(successor.config,before.config);assert.deepEqual({...successor.blocks,badge:{...successor.blocks.badge,source:before.blocks.badge.source}},before.blocks);
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

function nestedFixture(base,children=true){
 const copy=structuredClone(base);
 const node=(label,blocks={},order=Object.keys(blocks))=>({type:'badge',settings:{label},disabled:false,blocks,block_order:order});
 const kids=children?{'hab-child-a':node('HAB_CHILD_A',{'hab-grandchild':node('HAB_GRANDCHILD')}),'hab-child-b':node('HAB_CHILD_B')}:{};
 copy.templates.index.sections['hab-nested-probe']={type:'spotlight',settings:{title:'Nested source probe'},blocks:{'hab-parent':node('HAB_PARENT',kids)},block_order:['hab-parent'],disabled:false};
 copy.templates.index.order.push('hab-nested-probe');return copy;
}
async function renderIndex(bundle,label,previewMode=false){
 const result=await new LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'habitat-source-only',path:'/',previewMode,locale:'en-IN'},storeTemplate:{themeId:'letbuyy-craft',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},routeTemplate:{id:'index',type:'index',layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:'index',liquidContext:{shop:{name:'Habitat source-only'},collections:[]}});
 const html=result.liquid?.contentForLayout??'';writeFileSync(resolve(out,`${label}.html`),html);
 record.observations.push({label,status:result.status,sha256:hash(html),warnings:result.warnings??[],class:'in-memory source render; NOT actual UI operation'});
 assert.equal(result.status,'rendered');return {html,document:new JSDOM(html).window.document};
}
test('no-child badge output stays byte-identical to frozen; allowed child/grandchild labels now render',async()=>{
 const baseline=await renderIndex(nestedFixture(frozen,false),'badge-frozen-no-children');
 const noKids=await renderIndex(nestedFixture(createHabitatThemeV201(frozen),false),'badge-proposed-no-children');
 assert.equal(noKids.html,baseline.html);
 const nested=await renderIndex(nestedFixture(createHabitatThemeV201(frozen)),'badge-nested');
 for(const value of ['HAB_PARENT','HAB_CHILD_A','HAB_CHILD_B','HAB_GRANDCHILD'])assert.ok(nested.document.body.textContent.includes(value),value);
 assert.deepEqual([...nested.document.querySelectorAll('.lb-badge')].map(x=>x.textContent),['HAB_PARENT','HAB_CHILD_A','HAB_GRANDCHILD','HAB_CHILD_B']);
});
test('nested edit/order/hide/delete state mutations affect actual render and preserve untouched sibling',async()=>{
 const draft=nestedFixture(createHabitatThemeV201(frozen)),parent=draft.templates.index.sections['hab-nested-probe'].blocks['hab-parent'];
 parent.blocks['hab-child-a'].settings.label='EDITED_CHILD_A';parent.block_order=['hab-child-b','hab-child-a'];
 const edited=await renderIndex(draft,'badge-edited-reordered');
 assert.deepEqual([...edited.document.querySelectorAll('.lb-badge')].map(x=>x.textContent),['HAB_PARENT','HAB_CHILD_B','EDITED_CHILD_A','HAB_GRANDCHILD']);
 parent.blocks['hab-child-a'].disabled=true;const hidden=await renderIndex(draft,'badge-child-hidden');
 assert.ok(hidden.html.includes('HAB_CHILD_B'));assert.ok(!hidden.html.includes('EDITED_CHILD_A'));assert.ok(!hidden.html.includes('HAB_GRANDCHILD'));
 parent.blocks['hab-child-a'].disabled=false;delete parent.blocks['hab-child-b'];parent.block_order=['hab-child-a'];
 const removed=await renderIndex(draft,'badge-sibling-deleted');assert.ok(removed.html.includes('EDITED_CHILD_A'));assert.ok(removed.html.includes('HAB_GRANDCHILD'));assert.ok(!removed.html.includes('HAB_CHILD_B'));
 assert.equal(parent.blocks['hab-child-a'].settings.label,'EDITED_CHILD_A');
});
test('nested labels remain escaped; public render has no private block inspector attributes',async()=>{
 const draft=nestedFixture(createHabitatThemeV201(frozen)),child=draft.templates.index.sections['hab-nested-probe'].blocks['hab-parent'].blocks['hab-child-a'];
 const attack='<img src=x onerror="nestedAttack()"><script>nestedAttack()</script>';child.settings.label=attack;
 const result=await renderIndex(draft,'badge-nested-escaped-public');const badges=[...result.document.querySelectorAll('.lb-badge')];
 assert.equal(badges[1].textContent,attack);assert.equal(result.document.querySelector('.lb-badge img'),null);assert.equal(result.document.querySelector('.lb-badge script'),null);
 assert.ok(!/data-(?:lb|letbuyy)-(?:block|editor)/.test(badges.map(x=>x.outerHTML).join('')));
 assert.equal(hash(JSON.stringify(createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture()))),frozenDigest);
});
