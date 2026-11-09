// Local actual Liquid rendering/adapter coverage only; not authored-theme device/hosted acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {firstPartyThemeListings,createFirstPartyCatalogBundle,DEFAULT_THEME_SETTINGS,LiquidRenderer} from '@letbuyy/theme-engine';
import {productToLiquidDrop} from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import {applyLiquidInventoryAvailability} from '../../../../apps/commerce/web/src/lib/theme-engine/liquid-inventory-availability';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const product=productToLiquidDrop({id:'22222222-2222-4222-8222-222222222222',name:'Synthetic unconfirmed inventory',description:'',price:125,currency:'INR',images:[],stock:null,isActive:true})!;
for(const listing of firstPartyThemeListings())for(const key of ['product','collection'])test(listing.slug+'2.1.0 '+key+' unknown inventory uses real frozen Liquid and existing adapter',async()=>{
 const bundle=createFirstPartyCatalogBundle(listing.slug,{customizationVersion:'2.1.0'}),before=digest(bundle);
 const scope={shop:{id:'11111111-1111-4111-8111-111111111111',subdomain:'syn-unknown-render',name:'Synthetic inventory'},product,collection:{products:[product],title:'Synthetic collection'},section_products:Object.fromEntries(Object.keys(bundle.templates[key].sections).map(id=>[id,[product]]))};
 const r=await new LiquidRenderer().render({context:{storeId:scope.shop.id,subdomain:scope.shop.subdomain,path:'/',previewMode:false,locale:'en-IN'},storeTemplate:{themeId:listing.slug,themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},routeTemplate:{id:key,type:key,layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:key,liquidContext:scope});
 assert.equal(r.status,'rendered',JSON.stringify(r.warnings));assert.ok(r.liquid);
 const html=await applyLiquidInventoryAvailability(r.liquid.contentForLayout,scope);
 const purchase=[...html.matchAll(/<lb-add-to-cart\b([^>]*)>([\s\S]*?)<\/lb-add-to-cart>/g)].find(m=>m[1].includes('data-product-id="'+product.id+'"'));assert.ok(purchase);
 assert.match(purchase[1],/data-inventory-known="false"/);
 const controls=[...purchase[2].matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].filter(m=>/data-lb-(?:add-to-cart|buy-now)/.test(m[1]));assert.ok(controls.length);
 for(const control of controls)assert.match(control[1],/\sdisabled(?:=|\s|$)/);
 assert.equal(controls.find(m=>m[1].includes('data-lb-add-to-cart'))?.[2],'Stock unavailable');assert.doesNotMatch(purchase[2],/Sold out/);
 assert.equal(digest(bundle),before,'frozen bundle is not modified');
});
