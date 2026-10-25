/** Real catalog factory + public app mapper + Liquid + canonical page assembly. No hydrated app claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { LiquidRenderer } from '../../../../packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings';
import type { LiquidThemePackageBundle } from '../../../../packages/theme-engine/src/theme-bundle';
const require=createRequire(new URL('../../../../package.json',import.meta.url));
const { productToLiquidDrop }=require('./apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts') as typeof import('../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop');
const { assembleLiquidPageFromRenderResult }=require('./apps/commerce/web/src/lib/theme-engine/liquid-page-assembly.ts') as typeof import('../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly');
const demo=require('./apps/commerce/web/src/lib/demo/trailmark-demo.ts') as typeof import('../../../../apps/commerce/web/src/lib/demo/trailmark-demo');
const root='docs/implementation/niche-themes-2026-10-23/trailmark';
async function main(){
  const base=createFirstPartyCatalogBundle('letbuyy-ride',{designVersion:'2.0.0'});
  assert.equal(base.package.version,'2.0.0');
  const bundle=demo.withTrailmarkDemoContent({liquidBundle:base}).liquidBundle as LiquidThemePackageBundle;
  const products=demo.TRAILMARK_DEMO_PRODUCTS.map(product=>productToLiquidDrop(product)!);
  const clothing=productToLiquidDrop({id:'7b669c70-8690-4000-8000-000000000001',name:'Court cotton tee',description:'Fictional clothing measurement fixture. No image supplied.',price:990,currency:'INR',stock:3,images:[],isActive:true,apparel:{fit:'Relaxed',fabric:'Cotton',care:'Cold wash',unit:'cm',measurements:[{size:'M',chest:104,length:70}]},variantOptions:[{name:'Size',values:['M']}],variants:[]})!;
  const missing=productToLiquidDrop({id:'7b669c70-8690-4000-8000-000000000002',name:'Unspecified recreational equipment',description:'No measurements or image supplied.',price:690,currency:'INR',stock:0,images:[],isActive:true,variants:[],variantOptions:[]})!;
  const files=[];
  fs.mkdirSync(path.join(root,'rendered'),{recursive:true});
  const cssSource='apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css';
  fs.copyFileSync(cssSource,path.join(root,'rendered/storefront.css'));
  const sources=[cssSource,'packages/theme-engine/src/trailmark-theme.ts','packages/theme-engine/src/trailmark-styles.ts','packages/theme-engine/src/trailmark-discovery.ts','packages/theme-engine/src/theme-renderer.ts','packages/theme-engine/src/first-party-theme-catalog.ts','packages/commerce-core/src/trailmark-facts.ts','packages/commerce-core/src/product-fact-presentation.ts','apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts','apps/commerce/web/src/lib/theme-engine/liquid-page-assembly.ts','apps/commerce/web/src/lib/demo/trailmark-demo.ts'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  const scenes=[
    {key:'index',file:'home',product:products[0],list:products},
    {key:'collection',file:'collection',product:products[0],list:products},
    {key:'search',file:'search',product:products[0],list:products},
    {key:'product',file:'product',product:products[0],list:products},
    {key:'product',file:'product-sleeve',product:products[2],list:products},
    {key:'product',file:'product-clothing',product:clothing,list:products},
    {key:'product',file:'missing-product',product:missing,list:[]},
    {key:'collection',file:'empty-collection',product:missing,list:[]},
  ];
  for(const scene of scenes){
    const collection={title:'Court time',description:'Recreational badminton. Fictional preview catalogue.',products:scene.list,total:scene.list.length};
    const sectionProducts=Object.fromEntries(Object.entries(bundle.templates[scene.key].sections).map(([id,section])=>[id,section.type==='featured-products'?products.slice(1):scene.list]));
    const result=await new LiquidRenderer().render({
      context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'trailmark-test',path:scene.key==='index'?'/':'/'+scene.key,previewMode:false,locale:'en-IN'},
      storeTemplate:{themeId:'letbuyy-ride',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},
      routeTemplate:{id:scene.key,type:scene.key==='index'?'index':scene.key==='product'?'product':'collection',layoutKey:'theme',sections:[]},
      liquidBundle:bundle,liquidTemplateKey:scene.key,
      liquidContext:{shop:{name:'Trailmark',description:'Fictional preview catalogue',subdomain:'trailmark-test'},product:scene.product,collection,collections:demo.TRAILMARK_DEMO_COLLECTIONS,section_products:sectionProducts,
        linklists:{main_menu:{links:[{title:'Activities',url:'/collection.html',links:[]},{title:'Equipment',url:'/collection.html',links:[]},{title:'Measurements guide',url:'/product.html#equipment-facts',links:[]}]}}},
    });
    assert.equal(result.status,'rendered');assert.deepEqual(result.warnings,[]);assert.ok(result.liquid);
    const assembled=assembleLiquidPageFromRenderResult(result.liquid);
    const fontContext=`@font-face{font-family:Inter;font-style:normal;font-weight:400;src:url('/fixture/inter-400.ttf')}@font-face{font-family:Inter;font-style:normal;font-weight:600;src:url('/fixture/inter-600.ttf')}@font-face{font-family:Inter;font-style:normal;font-weight:700;src:url('/fixture/inter-700.ttf')}@font-face{font-family:Inter;font-style:normal;font-weight:800;src:url('/fixture/inter-800.ttf')}body{margin:0}button,input,select{font:inherit}:root{--font-main:Inter,Arial,sans-serif;--font-heading:Inter,Arial,sans-serif;--radius:4px;--card-bg:#fff;--card-text:#222b22;--card-border:#ccd2c5;--input-bg:#f5f6f1;--input-text:#222b22;--input-border:#ccd2c5;--text:#222b22;--text-secondary:#4d554a}`;
    const html=`<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trailmark · actual Liquid review · ${scene.file}</title><link rel="stylesheet" href="/fixture/liquid-theme.css"><style>${fontContext}</style><style>${assembled.headStyleText}</style></head><body><div data-theme-renderer="liquid">${assembled.html}</div></body></html>`;
    fs.writeFileSync(path.join(root,'rendered',scene.file+'.html'),html);
    files.push({scene:scene.file,file:'rendered/'+scene.file+'.html',template:scene.key,engine:result.engine,warnings:result.warnings,bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex')});
  }
  fs.writeFileSync(path.join(root,'render-fixtures.json'),JSON.stringify({scope:'Actual v2 catalog dispatch + canonical app ProductModel mapper + LiquidRenderer + app page assembly and storefront CSS. Static visual fixture; no Next routing, DB, identity, hydration, purchase, filter-query or lifecycle certification.',fixtureContext:'Document reset, locally served approved Inter 400/600/800 fonts plus existing Pantry Inter700 source, and explicit fixed app-layout CSS context for fonts/radius/card/input/text variables. No visual repair CSS.',sportsFacets:'Absent: no fabricated canonical server capability.',sources,files},null,2)+'\n');
  console.log(JSON.stringify(files));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
