/** Source-only current behavior probe. No browser/app/DB/API; does not repair frozen sources. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createFirstPartyCatalogBundle, LiquidRenderer, DEFAULT_THEME_SETTINGS } from '@letbuyy/theme-engine';
import { ToyFactsSchema, ProductVariantSchema, type ProductModel } from '@letbuyy/commerce-core';
import { productToLiquidDrop } from '../../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { parsePickerVariants } from '../../../../../apps/commerce/web/src/lib/theme-engine/variant-options-carrier';
import { VariantFactsController } from '../../../../../apps/commerce/web/src/lib/theme-engine/variant-facts-controller';
const root=new URL('../../../../../',import.meta.url),out=new URL('./',import.meta.url);
const local=createRequire(new URL('../../../../../apps/commerce/web/package.json',import.meta.url));
const {JSDOM}=local('jsdom');
const sha=(path:string)=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
const sourcePaths=['packages/theme-engine/src/playfield-theme.ts','packages/theme-engine/src/theme-bundle.ts','packages/theme-engine/src/first-party-theme-catalog.ts','packages/commerce-core/src/product-fact-presentation.ts','packages/commerce-core/src/playfield-facts.ts','apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts','apps/commerce/web/src/lib/theme-engine/variant-options-carrier.ts','apps/commerce/web/src/lib/theme-engine/variant-facts-controller.ts','apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx'];
const before=sourcePaths.map(path=>({path,sha256:sha(path)}));
async function main(){
 const plan=JSON.parse(readFileSync(new URL('docs/implementation/theme-editor-2026-10-23/evidence/fresh-fixture-data.plan.json',root),'utf8'));
 const recipe=plan.products.find((row:{key:string})=>row.key==='toys').createFields;
 const actualBindings=JSON.parse(readFileSync(new URL('docs/implementation/theme-editor-2026-10-23/evidence/playfield-PF-I05-selected-bindings.json',root),'utf8')) as Array<{editionName:string;carriers:Array<{productId:string;variantId:string}>}>;
 const ids=actualBindings.slice(0,3).map(row=>row.carriers[0].variantId);
 const common=ToyFactsSchema.parse(recipe.metadata.toys);
 const product:ProductModel={id:actualBindings[0].carriers[0].productId,name:'Source-only Playfield probe',price:480,currency:'INR',stock:8,images:[],toys:common,variantOptions:recipe.product_options,variants:recipe.variants.map((input:unknown,index:number)=>({...ProductVariantSchema.parse(input),id:ids[index]}))};
 const bundle=createFirstPartyCatalogBundle('letbuyy-bloom',{designVersion:'2.0.0'});
 const productSource=bundle.sections['product-detail'].source;
 const declaredTargets=[...new Set(productSource.match(/data-lb-[a-z-]+/g)||[])].sort();
 assert.equal(productSource.includes('data-lb-toy'),false);
 assert.equal(productSource.includes('data-lb-facts-namespace="toys"'),false);
 const drop=productToLiquidDrop(product,'/store/source-only')!;
 const render=await new LiquidRenderer().render({context:{storeId:'source-only-not-a-runtime-binding',subdomain:'source-only',path:'/store/source-only/product/'+product.id,previewMode:false,locale:'en-IN'},storeTemplate:{themeId:'letbuyy-bloom',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},routeTemplate:{id:'product',type:'product',layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:'product',liquidContext:{product:drop,shop:{name:'Source-only probe'}}});
 assert.equal(render.status,'rendered');assert.ok(render.liquid);assert.deepEqual(render.warnings,[]);
 const dom=new JSDOM(render.liquid.contentForLayout);const win=dom.window;
 const previous={HTMLElement:globalThis.HTMLElement,Element:globalThis.Element};
 Object.assign(globalThis,{HTMLElement:win.HTMLElement,Element:win.Element});
 const section=win.document.querySelector('.lb-product-detail[data-section-id]') as HTMLElement;
 const picker=section.querySelector('lb-variant-picker') as HTMLElement;
 const variants=parsePickerVariants(picker.dataset.variants);assert.equal(variants.length,3);
 const controller=new VariantFactsController(section,product.id,'INR',variants);
 const observations=[];
 try{
  for(const index of [0,1,2,0]){
   const variant=variants[index];controller.update(variant,'selected');
   const observation={variantId:variant.id,edition:variant.label,carrierFacts:variant.factPresentation?.toys,visibleOuterAge:section.querySelector('.pf-product-quick p')?.textContent,visibleOuterWarning:section.querySelector('.pf-warning')?.textContent,visibleOuterDetails:section.querySelector('#playfield-product-facts')?.textContent,selectedPanel:section.querySelector('[data-lb-selected-variant-facts]')?.textContent};
   observations.push(observation);
  }
  const unknown=observations[1],paper=observations[2];
  assert.equal(unknown.carrierFacts?.age,undefined);assert.equal(unknown.carrierFacts?.contents,undefined);assert.equal(unknown.carrierFacts?.materials,'Wood');
  assert.match(paper.selectedPanel||'',/36 × paper sheets/);assert.equal(paper.carrierFacts?.materials,'Paper');assert.match(paper.carrierFacts?.age||'',/9–12/);
  assert.match(unknown.visibleOuterAge||'',/6–8/);assert.match(unknown.visibleOuterWarning||'',/Read the sample kit information/);
  assert.match(paper.visibleOuterDetails||'',/15 items in total/);assert.match(paper.visibleOuterDetails||'',/Wood/);assert.match(paper.visibleOuterDetails||'',/Height 1.5 cm/);
 }finally{controller.dispose();Object.assign(globalThis,previous);win.close();}
 for(const source of before)assert.equal(sha(source.path),source.sha256,source.path);
 const result={classification:'SOURCE_ONLY_REPRODUCTION_OF_CURRENT_DEFECT_NOT_FIXED_ACCEPTANCE',scope:'Actual current v2 factory + actual mapper + Liquid + current VariantFactsController in jsdom. Source recipe is synthetic test input; actual public IDs only identify carrier cases. This does not execute a browser, current runtime, API, DB or installed lifecycle case.',currentDefectReproduced:true,packageVersion:bundle.package.version,declaredTargets,observations,sources:before,productionEdits:false};
 writeFileSync(new URL('selected-facts-source-probe.json',out),JSON.stringify(result,null,2)+'\n');
 process.stdout.write(JSON.stringify({currentDefectReproduced:true,selections:observations.length,sourcesUnchanged:before.length})+'\n');
}
main().catch(error=>{process.stderr.write(String(error)+'\n');process.exitCode=1;});
