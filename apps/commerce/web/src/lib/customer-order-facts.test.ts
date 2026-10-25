import assert from 'node:assert/strict';
import test from 'node:test';
import { LiquidRenderer, createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS } from '@letbuyy/theme-engine';
import { normalizeOrderItemRecord } from '@letbuyy/checkout-core';
import { mapOrderDetailDrop } from './customer-drop';
import { savedFacts } from './order-facts.test-support';
const receipt = () => ({ id:'saved-order',order_number:'SAVED-1',status:'pending_cod',currency:'INR',subtotal:520,total:520,tax:0,discount:0,shipping_cost:0,items:[{name:'Saved tint',quantity:1,price:520,total:520,niche_snapshot:savedFacts()}] });

test('actual Liquid order mapping preserves frozen facts after current product mutation/deletion and money/status fixes', async () => {
    const source = receipt(); const currentProduct = { name:'Today product', metadata:{ ingredients:'TODAY-PRIVATE' } };
    Object.assign(source.items[0], { product: currentProduct });
    const before = mapOrderDetailDrop(source); currentProduct.metadata.ingredients='Changed'; Reflect.deleteProperty(source.items[0], 'product');
    const after=mapOrderDetailDrop(source); assert.deepEqual(after,before); assert.equal(after.total,52000); assert.equal(after.timeline.filter(s=>s.reached).length,1);
    assert.deepEqual(after.line_items[0].variant, { Shade: 'Pink Clay' });
    for(const text of ['Pink Clay','PC02','Saved Pink Clay ingredients','Saved edition 2','250 g','Asha'])assert.ok(after.line_items[0].niche_facts_text!.includes(text),text);
    assert.doesNotMatch(after.line_items[0].niche_facts_text!,/RW01|TODAY-PRIVATE/);
    const result=await new LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'order-test',path:'/account/orders/saved-order',previewMode:false,locale:'en-IN'},storeTemplate:{themeId:'letbuyy-aura',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},liquidBundle:createFirstPartyCatalogBundle('letbuyy-aura',{designVersion:'2.0.0'}),liquidTemplateKey:'customers/order',liquidContext:{buyer:{email:'buyer@example.test'},order:after}});
    assert.equal(result.status,'rendered'); assert.deepEqual(result.warnings,[]);assert.match(result.liquid!.contentForLayout,/PC02/);assert.match(result.liquid!.contentForLayout,/Asha/);
});
test('hostile saved text is escaped by actual Liquid; malformed/legacy facts remain a neutral missing result', async()=>{
    const source=receipt(); const attack='<img src=x onerror="attack()"><script>attack()</script>';
    source.items[0].niche_snapshot={...source.items[0].niche_snapshot,facts:{...source.items[0].niche_snapshot.facts,beauty:{...source.items[0].niche_snapshot.facts.beauty!,ingredients:attack}}};
    const drop=mapOrderDetailDrop(source);
    const result=await new LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'order-test',path:'/',previewMode:false,locale:'en-IN'},storeTemplate:{themeId:'letbuyy-aura',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},liquidBundle:createFirstPartyCatalogBundle('letbuyy-aura',{designVersion:'2.0.0'}),liquidTemplateKey:'customers/order',liquidContext:{buyer:{email:'buyer@example.test'},order:drop}});
    assert.equal(result.status,'rendered');assert.match(result.liquid!.contentForLayout,/&lt;img/);assert.doesNotMatch(result.liquid!.contentForLayout,/<script|<img[^>]+onerror/);
    assert.equal(mapOrderDetailDrop({...source,items:[{name:'Legacy',price:520,quantity:1}]}).line_items[0].niche_facts_text,null);
});


test('real canonical normalizer output reaches the Liquid mapper without a mocked niche projection or lost saved title', () => {
    const normalized = normalizeOrderItemRecord({ title: 'Saved canonical tint', quantity: 1, unit_price: 520, total: 520, product_snapshot: { niche: savedFacts(), private_supplier: 'PRIVATE' } });
    const drop = mapOrderDetailDrop({ ...receipt(), items: [normalized] });
    assert.equal(drop.line_items[0].title, 'Saved canonical tint');
    assert.deepEqual(drop.line_items[0].variant, { Shade: 'Pink Clay' });
    for (const text of ['PC02', 'Saved edition 2', '250 g', 'Asha']) assert.ok(drop.line_items[0].niche_facts_text!.includes(text));
    assert.doesNotMatch(JSON.stringify(drop), /PRIVATE|private_supplier|product_snapshot/);
});

test('saved non-beauty option tuples reach both the exact variant map and actual Liquid receipt', async () => {
    const choices = [{ name: 'Finish', value: 'Recorded oil' }, { name: 'Seat size', value: 'Wide' }, { name: 'आकार', value: 'बड़ा' }, { name: 'Pack size', value: '250 g' }];
    const niche = { version: 1, facts: { furniture: { finish: 'Recorded oil' }, food: {} }, selected_options: choices };
    const normalized = normalizeOrderItemRecord({ title: 'Saved chair and pack', quantity: 1, unit_price: 520, total: 520, product_snapshot: { niche } });
    const drop = mapOrderDetailDrop({ ...receipt(), items: [{ ...normalized, variant: { Finish: 'Today wrong finish', 'Pack size': 'Today wrong size' } }] });
    assert.deepEqual(drop.line_items[0].variant, Object.fromEntries(choices.map(choice => [choice.name, choice.value])));
    for (const choice of choices) assert.ok(drop.line_items[0].niche_facts_text!.includes(`${choice.name}: ${choice.value}`));
    assert.match(drop.line_items[0].niche_facts_text!, /Per-item net quantity: Not recorded with this order/);
    const result = await new LiquidRenderer().render({ context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'order-test', path: '/', previewMode: false, locale: 'en-IN' }, storeTemplate: { themeId: 'letbuyy-aura', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, liquidBundle: createFirstPartyCatalogBundle('letbuyy-aura', { designVersion: '2.0.0' }), liquidTemplateKey: 'customers/order', liquidContext: { buyer: { email: 'buyer@example.test' }, order: drop } });
    assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
    assert.match(result.liquid!.contentForLayout, /Saved chair and pack/);
    for (const choice of choices) assert.ok(result.liquid!.contentForLayout.includes(`${choice.name}: ${choice.value}`));
    assert.doesNotMatch(result.liquid!.contentForLayout, /Today wrong/);
    const legacy = mapOrderDetailDrop({ ...receipt(), items: [{ name: 'Legacy', quantity: 1, price: 520, variant: { Size: 'Recorded legacy size', nested: { private: 'PRIVATE' } } }] });
    assert.deepEqual(legacy.line_items[0].variant, { Size: 'Recorded legacy size' });
    assert.equal(legacy.line_items[0].niche_facts_text, null);
});

test('actual decorated Liquid order keeps saved facts hidden for absent or unavailable buyer context', async () => {
    const order = mapOrderDetailDrop(receipt());
    for (const context of [{ buyer: null }, { buyer: { email: 'buyer@example.test' }, buyer_unavailable: true }]) {
        const result = await new LiquidRenderer().render({ context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'order-test', path: '/', previewMode: false, locale: 'en-IN' }, storeTemplate: { themeId: 'letbuyy-aura', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, liquidBundle: createFirstPartyCatalogBundle('letbuyy-aura', { designVersion: '2.0.0' }), liquidTemplateKey: 'customers/order', liquidContext: { ...context, order } });
        assert.equal(result.status, 'rendered'); assert.doesNotMatch(result.liquid!.contentForLayout, /PC02|Asha|Saved edition 2/);
    }
});
