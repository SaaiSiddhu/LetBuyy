import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { JSDOM } = createRequire('/Volumes/Projects/LetBuyy/packages/theme-engine/package.json')('jsdom') as {JSDOM:new(markup:string)=>{window:{document:Document;close():void}}};
import { createDewdropTheme as current } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/dewdrop-theme';
import { createDewdropTheme as proposal } from './src/dewdrop-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-bundle-core';
import { LiquidRenderer } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-settings';
const factory = process.env.DEWDROP_HEADING_TARGET === 'current' ? current : proposal;
async function heading(template: 'collection'|'search', title?: string, catalogueTitle = 'Colour') {
 const bundle = factory(createLetbuyyCoreLiquidThemeBundleFixture());
 const id = template === 'collection' ? 'aura-care-discovery' : 'aura-care-search';
 if(title!==undefined) bundle.templates[template].sections[id].settings.title=title;
 const result=await new LiquidRenderer().render({
  context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'dewdrop-heading-proposal',path:template==='search'?'/search':'/collections/colour',previewMode:false,locale:'en-IN'},
  storeTemplate:{themeId:'letbuyy-aura',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},
  routeTemplate:{id:template,type:template,layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:template,
  liquidContext:{shop:{name:'Synthetic heading control'},collection:{title:catalogueTitle,products:[],total:0},request:{path:template==='search'?'/search':'/collections/colour',query:{search:'Fixture',sort:'name'}}}
 });
 assert.equal(result.status,'rendered',JSON.stringify(result.warnings));assert.deepEqual(result.warnings,[]);
 const dom=new JSDOM(result.liquid!.contentForLayout);
 return {text:dom.window.document.querySelector('h1')?.textContent,document:dom.window.document,close:()=>dom.window.close()};
}
test('custom collection Heading wins when the real named collection already supplies a title',async()=>{
 const r=await heading('collection','Merchant care edit','Colour');try{assert.equal(r.text,'Merchant care edit');assert.match(r.document.body.textContent??'',/0 products/);}finally{r.close();}
});
test('custom search Heading wins over the supplied search title',async()=>{
 const r=await heading('search','Merchant search edit','Search results');try{assert.equal(r.text,'Merchant search edit');}finally{r.close();}
});
test('clearing Heading recovers the actual named collection title',async()=>{
 const r=await heading('collection','','Colour');try{assert.equal(r.text,'Colour');}finally{r.close();}
});
test('merchant heading remains escaped text without attack nodes or handler attributes',async()=>{
 const hostile='<img src=x onerror="fixtureAttack()"><script>fixtureAttack()</script>';
 const r=await heading('collection',hostile,'Colour');try{assert.equal(r.text,hostile);assert.equal(r.document.querySelectorAll('img[src="x"],script').length,0);assert.equal(r.document.querySelectorAll('[onerror]').length,0);}finally{r.close();}
});
test('fresh collection and search defaults preserve their dynamic supplied headings',async()=>{
 for(const [key,title]of[['collection','Colour'],['search','Search results']]as const){const r=await heading(key,undefined,title);try{assert.equal(r.text,title);}finally{r.close();}}
});
