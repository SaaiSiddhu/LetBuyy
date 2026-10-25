// Private source render qualification. No shared source is changed or runtime started.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createFirstPartyCatalogBundle } from '../../../../../../packages/theme-engine/src/first-party-theme-catalog.ts';
import { LiquidRenderer } from '../../../../../../packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../../../../packages/theme-engine/src/theme-settings.ts';
const root=new URL('../../../../../../',import.meta.url);
const {JSDOM}=createRequire(new URL('packages/theme-engine/package.json',root))('jsdom');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const file='packages/theme-engine/src/pantry-theme.ts';
const baseHash=sha(readFileSync(new URL(file,root)));
const proposal=JSON.parse(readFileSync(new URL('collection-row-heading.json',import.meta.url),'utf8'));
assert.equal(baseHash,proposal.files[0].baseSha256);
const old='<div class="pn-wrap pn-section">{% if collection.products.size > 0 %}';
const changed='<div class="pn-wrap pn-section">{% if section.settings.title != blank %}<h2>{{ section.settings.title }}</h2>{% endif %}{% if collection.products.size > 0 %}';
// The same static, synthetic unvarianted rice presentation used by existing render-review.mts.
// This is neither a new database recipe nor an accepted real product/order.
const rice={id:'7b669c70-1005-4000-8000-000000000002',title:'Basmati rice',price:220,currency:'INR',url:'/product/rice',images:['/theme-assets/pantry/v2/basmati-rice.webp'],featured_image:'/theme-assets/pantry/v2/basmati-rice.webp',available:true,variants:[],options:[],food:{ingredients:'Basmati rice (100%).',allergens:{status:'not_supplied'},storage:'Keep cool and dry.',netQuantityValue:1000,netQuantityUnit:'g',unitPriceMinor:2200,basisQuantity:100}};
const observations=[];
async function render(mode,title,empty=false){
 const b=createFirstPartyCatalogBundle('letbuyy-refresh',{designVersion:'2.0.0'});
 const section=b.sections['collection-product-list'];
 if(mode==='proposed'){
  assert.equal(section.source.split(old).length-1,1);
  section.source=section.source.replace(old,changed);
 }
 b.templates.search.sections['search-results'].settings.title=title;
 const products=empty?[]:[rice];
 const result=await new LiquidRenderer().render({
  context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'pantry-pure-render',path:'/search',previewMode:false,locale:'en-IN'},
  storeTemplate:{themeId:'letbuyy-refresh',themeSettings:{...DEFAULT_THEME_SETTINGS,...b.config.settings_data.current},sections:[]},
  routeTemplate:{id:'search',type:'search',layoutKey:'theme',sections:[]},
  liquidBundle:b,liquidTemplateKey:'search',
  liquidContext:{shop:{name:'Synthetic Pantry'},collection:{title:'Everyday staples',products},section_products:{'search-results':products}},
 });
 assert.equal(result.status,'rendered');assert.ok(result.liquid);
 const html=result.liquid.contentForLayout;
 const dom=new JSDOM(html);
 const element=dom.window.document.querySelector('[data-section-id="search-results"]');
 assert.ok(element);
 const headings=[...element.querySelectorAll('h2')].map(x=>x.textContent);
 const record={mode,title,empty,status:result.status,warnings:result.warnings,headings,htmlSha256:sha(html),cardCount:element.querySelectorAll('.pn-card').length,emptyMessage:element.querySelector('.pn-empty')?.textContent ?? null};
 observations.push(record);
 dom.window.close();
 return {html,headings,record};
}
const results=[];
for(const empty of [false,true]){
 const a=await render('current','Pantry source heading A',empty);
 const b=await render('current','Pantry source heading B',empty);
 assert.deepEqual(a.headings,[]);assert.deepEqual(b.headings,[]);
 results.push({case:empty?'CURRENT_EMPTY_INERT_HEADING':'CURRENT_POPULATED_INERT_HEADING',result:'OBSERVED_DEFECT',scope:'Actual current Liquid+sanitizer output lacks both configured heading values; not browser evidence'});
 const fixedA=await render('proposed','Pantry source heading A',empty);
 const fixedB=await render('proposed','Pantry source heading B',empty);
 assert.deepEqual(fixedA.headings,['Pantry source heading A']);assert.deepEqual(fixedB.headings,['Pantry source heading B']);
 assert.equal(fixedA.record.cardCount,empty?0:1);
 if(empty)assert.match(fixedA.record.emptyMessage,/No matching products/);
 results.push({case:empty?'PROPOSED_EMPTY_TITLE_CHANGE':'PROPOSED_POPULATED_TITLE_CHANGE',result:'PASS_SOURCE_ONLY'});
 const blank=await render('proposed','',empty);
 assert.deepEqual(blank.headings,[]);
 results.push({case:empty?'PROPOSED_EMPTY_BLANK':'PROPOSED_POPULATED_BLANK',result:'PASS_SOURCE_ONLY'});
 const hostile='<script>pantryHeadingAttack()</script><img src=x onerror=pantryHeadingAttack()> & संग्रह';
 const escaped=await render('proposed',hostile,empty);
 assert.deepEqual(escaped.headings,[hostile]);
 assert.doesNotMatch(escaped.html,/<script>pantryHeadingAttack\(\)<\/script>/);
 assert.doesNotMatch(escaped.html,/<img src="?x"? onerror=/);
 results.push({case:empty?'PROPOSED_EMPTY_ESCAPED_UNICODE':'PROPOSED_POPULATED_ESCAPED_UNICODE',result:'PASS_SOURCE_ONLY'});
}
assert.equal(sha(readFileSync(new URL(file,root))),baseHash);
const output={recordedAt:new Date().toISOString(),classification:'PRIVATE_CANONICAL_LIQUID_RENDER_AND_SANITIZER_SOURCE_QUALIFICATION_NOT_BROWSER_OR_PACKAGE_ADMISSION',finding:'PANTRY-COMP-DECLARED-01',source:{path:file,sha256:baseHash},renderer:{path:'packages/theme-engine/src/theme-renderer.ts',sha256:sha(readFileSync(new URL('packages/theme-engine/src/theme-renderer.ts',root)))},proposalPatchSha256:sha(readFileSync(new URL('collection-row-heading.patch',import.meta.url))),results,observations,counts:{currentDefectWitnesses:2,proposedSourceCasesPassed:6,failed:0,skipped:0},sharedSourceChanged:false,installedOrCapturedBundleChanged:false,liveEffects:0,browserAcceptance:'NOT_RUN',qualificationLimit:'Proposed patch changes an in-memory copy of the canonical factory output only. No source lease, version/release admission, editor Save/reload, HTTP receipt, actual provider or user-state acceptance follows.'};
writeFileSync(new URL('heading-render-qualification.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({classification:output.classification,counts:output.counts,sharedSourceChanged:false,liveEffects:0}));
