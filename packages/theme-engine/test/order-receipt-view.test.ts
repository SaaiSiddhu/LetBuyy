import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../src/first-party-theme-catalog';
import { withSavedOrderReceiptView } from '../src/order-receipt-view';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
const receipt={number:'SAVED-RECEIPT',status:'pending_cod',currency:'INR',subtotal:19900,discount_total:1990,coupon_code:'SAVE10',shipping_total:2000,tax_total:3582,total:23492,line_items:[],timeline:[]};
async function render(bundle: ReturnType<typeof createFirstPartyCatalogBundle>, order=receipt, key='customers/order') {
    return new LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'receipt-test',path:'/account/orders/saved',previewMode:false,locale:'en-IN'},storeTemplate:{themeId:bundle.package.slug,themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},liquidBundle:bundle,liquidTemplateKey:key,liquidContext:{buyer:{orders:[{id:'saved',...order}]},order}});
}
test('all ten shipped account definitions show exact saved coupon and final receipt, preserving source and identity',async()=>{
    const catalog=firstPartyThemeListings({designVersion:'2.0.0'});assert.equal(catalog.length,10);
    for(const theme of catalog){
        const original=createFirstPartyCatalogBundle(theme.slug,{designVersion:'2.0.0'});original.package.checksum='original-integrity-metadata';
        const before=structuredClone(original),view=withSavedOrderReceiptView(original);
        assert.deepEqual(original,before);assert.deepEqual(view.package,original.package);assert.deepEqual(view.config,original.config);assert.deepEqual(view.layout,original.layout);
        assert.equal(withSavedOrderReceiptView(view),view,'idempotent rendering projection');
        const detail=await render(view);assert.equal(detail.status,'rendered');const doc=new JSDOM(detail.liquid!.contentForLayout).window.document;
        assert.match(doc.body.textContent!,/Coupon \(SAVE10\)/,theme.slug);assert.match(doc.body.textContent!,/19\.90/);assert.match(doc.body.textContent!,/Final total/);assert.match(doc.body.textContent!,/234\.92/);
        const list=await render(view,receipt,'customers/orders');assert.match(list.liquid!.contentForLayout,/SAVE10/);assert.match(list.liquid!.contentForLayout,/19\.90/);
        for(const name of Object.keys(original.sections).filter(key=>!['customer-orders','customer-order-detail'].includes(key))) assert.deepEqual(view.sections[name],original.sections[name],name);
    }
});
test('custom account source, third parties and unknown versions are never replaced',()=>{
    for(const change of ['custom','third-party','unknown-version']){
        const base=createFirstPartyCatalogBundle('letbuyy-forge',{designVersion:'2.0.0'});
        if(change==='custom'){base.sections['customer-order-detail'].source+='<!-- merchant-customized -->';base.sections['customer-orders'].source+='<!-- merchant-customized -->';}
        if(change==='third-party')base.package.slug='third-party';
        if(change==='unknown-version')base.package.version='99.0.0';
        const before=structuredClone(base);assert.equal(withSavedOrderReceiptView(base),base);assert.deepEqual(base,before);
    }
});
test('hostile coupon text stays inert and a zero-discount order gets no invented coupon',async()=>{
    const view=withSavedOrderReceiptView(createFirstPartyCatalogBundle('letbuyy-forge',{designVersion:'2.0.0'}));
    const hostile=await render(view,{...receipt,coupon_code:'<img src=x onerror="attack()"><script>attack()</script>'});
    const doc=new JSDOM(hostile.liquid!.contentForLayout).window.document;assert.equal(doc.querySelector('img[src="x"],[onerror],script'),null);assert.match(doc.body.textContent!,/Coupon/);
    const normal=await render(view,{...receipt,coupon_code:'',discount_total:0});assert.doesNotMatch(normal.liquid!.contentForLayout,/Coupon \(/);assert.match(normal.liquid!.contentForLayout,/234\.92/,'saved total is not recomputed from current coupon data');
});
