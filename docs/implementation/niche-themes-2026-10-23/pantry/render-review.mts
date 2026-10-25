/** Local pure render evidence only; no merchant, network or publication effects. */
import { writeFileSync } from 'node:fs';
import { createPantryTheme } from '../../../../packages/theme-engine/src/pantry-theme.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../packages/theme-engine/src/theme-bundle-core.ts';
import { LiquidRenderer } from '../../../../packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings.ts';
const bundle = createPantryTheme(createLetbuyyCoreLiquidThemeBundleFixture());
const rice = { id:'7b669c70-1005-4000-8000-000000000002',title:'Basmati rice',price:220,currency:'INR',url:'/product/rice',images:['/theme-assets/pantry/v2/basmati-rice.webp'],featured_image:'/theme-assets/pantry/v2/basmati-rice.webp',available:true,variants:[],options:[],food:{ingredients:'Basmati rice (100%).',allergens:{status:'not_supplied'},storage:'Keep cool and dry.',netQuantityValue:1000,netQuantityUnit:'g',unitPriceMinor:2200,basisQuantity:100}};
bundle.templates.index.sections['pantry-hero'].settings.image='/theme-assets/pantry/v2/staples-still-life.webp';
const records=[];
for(const key of ['index','collection','product']){
 const r=await new LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'pantry-pure-render',path:'/',previewMode:true,locale:'en-IN'},storeTemplate:{themeId:'letbuyy-refresh',themeSettings:{...DEFAULT_THEME_SETTINGS,...bundle.config.settings_data.current},sections:[]},routeTemplate:{id:key,type:key==='index'?'index':key==='product'?'product':'collection',layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:key,liquidContext:{shop:{name:'Synthetic Pantry'},product:rice,collection:{title:'Everyday staples',products:[rice]},section_products:{'pantry-staples':[rice],'pantry-results':[rice]}}});
 if(r.status!=='rendered'||!r.liquid)throw new Error(JSON.stringify(r.warnings));
 const file=`pure-render-${key}.html`;writeFileSync(new URL(file,import.meta.url),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pantry pure render · ${key}</title><style>${r.liquid.headStyleText||''}</style><body>${r.liquid.contentForLayout}</body></html>`);records.push({key,status:r.status,warnings:r.warnings,file,scope:'Pure canonical renderer, synthetic public facts, not integrated hydration or publication'});
}
writeFileSync(new URL('pure-render.json',import.meta.url),JSON.stringify(records,null,2)+'\n');
