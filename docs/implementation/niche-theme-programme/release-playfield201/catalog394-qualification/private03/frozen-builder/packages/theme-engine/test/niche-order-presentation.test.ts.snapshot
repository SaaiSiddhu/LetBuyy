import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { withNicheOrderPresentation } from '../src/niche-order-presentation';
import { createFirstPartyCatalogBundle } from '../src/first-party-theme-catalog';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { createPlayfieldTheme } from '../src/playfield-theme';
import { createPlayfieldThemeV201 } from '../src/playfield-theme-v201';
import { createCircuitTheme } from '../src/circuit-theme';
import { createPantryTheme } from '../src/pantry-theme';
import { createHabitatTheme } from '../src/habitat-theme';
import { createKindredTheme } from '../src/kindred-theme';
import { createMadeYoursTheme } from '../src/madeyours-theme';
import { createDewdropTheme } from '../src/dewdrop-theme';
import { createTrailmarkTheme } from '../src/trailmark-theme';
import { createMarginaliaTheme } from '../src/marginalia-theme';
const factories = { bloom: createPlayfieldTheme, forge: createCircuitTheme, refresh: createPantryTheme, craft: createHabitatTheme, summit: createKindredTheme, nova: createMadeYoursTheme, aura: createDewdropTheme, ride: createTrailmarkTheme, dawn: createMarginaliaTheme };
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
const slugs = Object.keys(factories) as (keyof typeof factories)[];
async function render(bundle: ReturnType<typeof withNicheOrderPresentation>, text?: string) {
    return new LiquidRenderer().render({
        context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'order-facts-test',path:'/account/orders/saved',previewMode:false,locale:'en-IN'},
        storeTemplate:{themeId:bundle.package.slug,themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},
        liquidBundle:bundle,liquidTemplateKey:'customers/order',
        liquidContext:{buyer:{email:'buyer@example.test'},order:{number:'SAVED-1',status:'paid',currency:'INR',total:52000,line_items:[{title:'Saved item',quantity:1,line_price:52000,niche_facts_text:text}],timeline:[]}},
    });
}
test('decoration is pure and idempotent for all nine explicit v2 designs',()=>{
    for(const preset of slugs){const base=factories[preset](createLetbuyyCoreLiquidThemeBundleFixture());const before=structuredClone(base);const b=withNicheOrderPresentation(base);
        assert.deepEqual(base,before);assert.match(b.sections['customer-order-detail'].source,/item.niche_facts_text/);assert.deepEqual(withNicheOrderPresentation(b),b);
        for(const key of Object.keys(base.sections).filter(k=>k!=='customer-order-detail'))assert.deepEqual(b.sections[key],base.sections[key],key);
        assert.deepEqual(b.templates,base.templates);assert.deepEqual(b.config,base.config);
    }
});
test('Core, pinned Threadline, v1 captures, other versions and third-party bundles retain exact bytes',()=>{
    const core=createLetbuyyCoreLiquidThemeBundleFixture();
    const threadline=createFirstPartyCatalogBundle('letbuyy-sense');
    const legacy=createFirstPartyCatalogBundle('letbuyy-aura');
    const later=createDewdropTheme(createLetbuyyCoreLiquidThemeBundleFixture());later.package.version='2.0.1';
    const third=structuredClone(later);third.package.version='2.0.0';third.package.slug='third-party';
    for(const b of [core,threadline,legacy,later,third]){const before=JSON.stringify(b);assert.equal(withNicheOrderPresentation(b),b);assert.equal(JSON.stringify(b),before);}
});
test('actual Liquid preserves bounded scalar facts through depth four with escaped text and existing order money',async()=>{
    const attack='Care details\nSelected shade: Pink Clay\nCode: PC02\n<img src=x onerror="attack()"><script>attack()</script>';
    const b=withNicheOrderPresentation(createDewdropTheme(createLetbuyyCoreLiquidThemeBundleFixture()));
    const result=await render(b,attack);assert.equal(result.status,'rendered');assert.deepEqual(result.warnings,[]);
    const doc=new JSDOM(result.liquid!.contentForLayout).window.document;
    assert.equal(doc.querySelector('.lb-order-facts__text')?.textContent,attack);assert.equal(doc.querySelector('script,img,[onerror]'),null);
    assert.match(doc.body.textContent!,/SAVED-1|Saved item/);assert.match(doc.body.textContent!,/520\.00/);assert.match(result.liquid!.headStyleText!,/white-space:pre-wrap/);
});
test('missing legacy scalar stays a brief neutral fallback instead of invented namespace facts',async()=>{
    const result=await render(withNicheOrderPresentation(createDewdropTheme(createLetbuyyCoreLiquidThemeBundleFixture())));
    assert.equal(result.status,'rendered');const doc=new JSDOM(result.liquid!.contentForLayout).window.document;
    assert.equal(doc.querySelector('.lb-order-facts'),null);assert.equal(doc.querySelectorAll('.lb-order-facts__missing').length,1);
    assert.match(doc.body.textContent!,/Product details were not recorded with this order/);
});
test('a missing canonical line seam refuses decoration instead of modifying unrelated markup',()=>{
    const b=createDewdropTheme(createLetbuyyCoreLiquidThemeBundleFixture());b.sections['customer-order-detail'].source='<section>Different markup</section>';
    assert.throws(()=>withNicheOrderPresentation(b),/canonical order line loop/);
});

test('Playfield 2.0.1 retains exact historical order markup and CSS with only PDP and version differences',()=>{
    const old=createFirstPartyCatalogBundle('letbuyy-bloom',{designVersion:'2.0.0'});
    const next=createFirstPartyCatalogBundle('letbuyy-bloom',{designVersion:'2.0.0',playfieldVersion:'2.0.1'});
    const marker='<!-- lb:niche-order-presentation:v1 -->';
    assert.ok(old.sections['customer-order-detail'].source.includes(marker));
    assert.ok(next.sections['customer-order-detail'].source.includes(marker),'2.0.1 must retain saved order facts');
    assert.ok(next.layout.theme.source.includes('data-niche-order-presentation="1"'),'2.0.1 must retain order facts CSS');
    assert.deepEqual(next.layout,old.layout);assert.deepEqual(next.templates,old.templates);assert.deepEqual(next.config,old.config);
    assert.deepEqual(next.blocks,old.blocks);assert.deepEqual(next.locales,old.locales);assert.deepEqual(next.renderer,old.renderer);
    assert.deepEqual({...next.package,version:old.package.version,version_number:old.package.version_number},old.package);
    for(const key of Object.keys(old.sections))if(key!=='product-detail')assert.deepEqual(next.sections[key],old.sections[key],key);
    assert.notEqual(next.sections['product-detail'].source,old.sections['product-detail'].source);
    assert.deepEqual({...next.sections['product-detail'],source:old.sections['product-detail'].source},old.sections['product-detail']);
});

test('Playfield 2.0.1 decoration is pure, idempotent and renders saved facts as inert text with existing order money',async()=>{
    const base=createPlayfieldThemeV201(createLetbuyyCoreLiquidThemeBundleFixture()),before=JSON.stringify(base);
    const decorated=withNicheOrderPresentation(base);
    assert.equal(JSON.stringify(base),before);assert.notEqual(decorated,base);
    assert.equal(withNicheOrderPresentation(decorated),decorated);
    const attack='Paper edition\n36 sheets\n<script>attack()</script><img src=x onerror="attack()">';
    const result=await render(decorated,attack);assert.equal(result.status,'rendered');assert.deepEqual(result.warnings,[]);
    const doc=new JSDOM(result.liquid!.contentForLayout).window.document;
    assert.equal(doc.querySelector('.lb-order-facts__text')?.textContent,attack);
    assert.equal(doc.querySelector('script,img,[onerror]'),null);assert.match(doc.body.textContent!,/520\.00/);
    assert.match(result.liquid!.headStyleText!,/white-space:pre-wrap/);
});

test('only exact Playfield 2.0.1 joins the existing opt-in; unknown versions and every other 2.0.1 identity remain byte-exact',()=>{
    const base=createPlayfieldTheme(createLetbuyyCoreLiquidThemeBundleFixture());
    for(const version of ['1.0.0','2.0.2','2.1.0','3.0.0','02.0.1','2.0.1\n','2.0.1+build','']){
        const value=structuredClone(base);value.package.version=version;const before=JSON.stringify(value);
        assert.equal(withNicheOrderPresentation(value),value,version);assert.equal(JSON.stringify(value),before);
    }
    for(const slug of ['letbuyy-core','letbuyy-sense',...slugs.filter(id=>id!=='bloom').map(id=>`letbuyy-${id}`),'third-party','letbuyy-bloom-extra']){
        const value=structuredClone(base);value.package.slug=slug;value.package.version='2.0.1';const before=JSON.stringify(value);
        assert.equal(withNicheOrderPresentation(value),value,slug);assert.equal(JSON.stringify(value),before);
    }
});
