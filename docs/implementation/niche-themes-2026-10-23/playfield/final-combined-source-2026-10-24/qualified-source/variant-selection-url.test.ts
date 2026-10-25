import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { JSDOM } from 'jsdom';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '@letbuyy/theme-engine';
import { ToyFactsSchema, type ProductModel } from '@letbuyy/commerce-core';
import { productToLiquidDrop } from './product-liquid-drop';
import { parsePickerVariants } from './variant-options-carrier';
import { buyerVariantUrl, buyerUrlWithVariant, uniquePickerVariant, variantFromBuyerUrl } from './variant-selection-url';

const PID = '11111111-1111-4111-8111-111111111111', OTHER = '99999999-9999-4999-8999-999999999999';
const ids = ['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
const path = `/store/source-only/product/${PID}`, origin = 'https://buyer.example.invalid';
const url = (query = '') => origin + path + query;
const common = ToyFactsSchema.parse({ ageBands: ['6-8'], ageStatement: '6–8 years', contents: [{ label: 'tiles', quantity: 15 }], contentsComplete: true, materials: 'Wood' });
function model(id = PID): ProductModel {
    return { id, name: 'Synthetic source-only URL fixture', description: '', price: 480, stock: 8, currency: 'INR', images: [], toys: common,
        variantOptions: [{ name: 'Edition kind', values: ['Inherited','Paper'] },{ name: 'भाषा', values: ['हिन्दी','English'] }],
        variants: [{ id: ids[0], name: 'Inherited Hindi', price: 480, stock: 4, options: { 'Edition kind': 'Inherited', भाषा: 'हिन्दी' }, metadata: { toys: { finish: 'Sample blue finish' } } },
            { id: ids[1], name: 'Paper Hindi', price: 480, stock: 3, options: { 'Edition kind': 'Paper', भाषा: 'हिन्दी' }, metadata: { toys: { ageBands: ['9-12'], contents: [{ label: 'paper sheets', quantity: 36 }], contentsComplete: true, materials: 'Paper' } } },
            { id: ids[2], name: 'Paper English unavailable', price: 480, stock: 0, options: { 'Edition kind': 'Paper', भाषा: 'English' }, metadata: { toys: { ageBands: [], ageStatement: '', contents: [], contentsComplete: false, materials: '' } } }] };
}
const rows = () => parsePickerVariants(JSON.stringify(productToLiquidDrop(model())!.variants));
const groups = new Map([['Edition kind',new Set(['Inherited','Paper'])],['भाषा',new Set(['हिन्दी','English'])]]);
const QaDom = JSDOM as unknown as new (html: string, options: { url: string }) => { window: Window & typeof globalThis & { close(): void } };
const dom = new QaDom('<!doctype html><body></body>', { url: url() });
const names = ['window','document','HTMLElement','Element','CustomEvent','CSS'];
const before = new Map(names.map(name => [name,Object.getOwnPropertyDescriptor(globalThis,name)]));
Object.assign(globalThis,{ window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,CustomEvent:dom.window.CustomEvent });
Object.defineProperty(globalThis,'CSS',{configurable:true,value:{escape:(value:string)=>value.replace(/["\\]/g,'\\$&')}});
let registered: Promise<void> | undefined;
const ready = () => registered ??= import('./liquid-hydration-islands').then(module=>module.registerLiquidHydrationIslands());
const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = (async()=>{calls++;throw new Error('URL selection must not fetch');}) as typeof fetch;
after(()=>{document.body.replaceChildren();dom.window.close();globalThis.fetch=originalFetch;for(const name of names){const d=before.get(name);if(d)Object.defineProperty(globalThis,name,d);else Reflect.deleteProperty(globalThis,name);}});
function reset(href = url()) { document.body.replaceChildren(); window.localStorage.clear();window.history.replaceState({__NA:true,tree:['retained']},'',href);calls=0; }
async function html(product = model(), sectionId = 'main') {
    const bundle=createFirstPartyCatalogBundle('letbuyy-bloom',{designVersion:'2.0.0',playfieldVersion:'2.0.1'});
    const original=bundle.templates.product,key=original.order.find(id=>original.sections[id].type==='product-detail')!;
    bundle.templates.product={sections:{[sectionId]:original.sections[key]},order:[sectionId]};
    const result=await new LiquidRenderer().render({context:{storeId:PID,subdomain:'source-only',path,previewMode:false,locale:'en-IN'},storeTemplate:{themeId:'letbuyy-bloom',themeSettings:DEFAULT_THEME_SETTINGS,sections:[]},routeTemplate:{id:'product',type:'product',layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:'product',liquidContext:{product:productToLiquidDrop(product)!}});
    assert.equal(result.status,'rendered');assert.deepEqual(result.warnings,[]);return result.liquid!.contentForLayout;
}
const root = (id='main') => document.querySelector<HTMLElement>(`[data-section-id="${id}"]`)!;
const add = (section=root()) => section.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]')!;
function choose(name:string,value:string,section=root()) {const button=[...section.querySelectorAll<HTMLButtonElement>('[data-lb-variant-option]')].find(e=>e.dataset.variantName===name&&e.dataset.variantValue===value);assert.ok(button);button.click();}
function empty(section=root()) {assert.equal(section.querySelectorAll('[aria-pressed="true"]').length,0);assert.equal(add(section).disabled,true);assert.equal(section.dataset.variantId,'');}
const pop = () => window.dispatchEvent(new dom.window.PopStateEvent('popstate',{state:window.history.state}));
async function traverse(move:()=>void) {await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Expected actual jsdom history event')),2000);window.addEventListener('popstate',()=>{clearTimeout(timer);resolve();},{once:true});move();});}

test('pure buyer path/UUID scope excludes previews, demos, private keys and foreign products',()=>{
    assert.ok(buyerVariantUrl(url(),PID));assert.ok(buyerVariantUrl(`${origin}/product/${PID}/`,PID));
    for(const href of [`${origin}/preview?variant=${ids[0]}`,`${origin}/theme-preview/letbuyy-bloom?demo_path=/product/${PID}`,url('?preview_token=synthetic'),url('?theme_preview_session_id=synthetic'),url('?demo_path=synthetic'),`${origin}/product/${OTHER}`,url().replace(PID,'label'),`file:///product/${PID}`]) assert.equal(buyerVariantUrl(href,PID),null,href);
});
test('one variant parameter preserves unrelated repeated values and fragment; no invented identifier',()=>{
    const href=url(`?interest=art&interest=build&search=हिन्दी&variant=${ids[0]}&variant=bad#facts`);
    const result=new URL(buyerUrlWithVariant(href,PID,ids[1])!);
    assert.deepEqual(result.searchParams.getAll('interest'),['art','build']);assert.equal(result.searchParams.get('search'),'हिन्दी');assert.deepEqual(result.searchParams.getAll('variant'),[ids[1]]);assert.equal(result.hash,'#facts');
    assert.equal(new URL(buyerUrlWithVariant(result.href,PID,null)!).searchParams.has('variant'),false);assert.equal(buyerUrlWithVariant(href,PID,'Paper'),null);
});
test('pure restoration rejects unknown/malformed/duplicate IDs, missing options and ambiguous tuples/IDs',()=>{
    const variants=rows();assert.equal(variantFromBuyerUrl(url(`?variant=${ids[1]}`),PID,variants,groups)?.id,ids[1]);
    for(const query of ['', '?variant=', '?variant=Paper', `?variant=${OTHER}`, `?variant=${ids[0]}&variant=${ids[0]}`]) assert.equal(variantFromBuyerUrl(url(query),PID,variants,groups),null);
    assert.equal(variantFromBuyerUrl(url(`?variant=${ids[0]}`),PID,[...variants,{...variants[0],id:OTHER}],groups),null);
    assert.equal(uniquePickerVariant([...variants,{...variants[0],options:{'Edition kind':'Paper',भाषा:'English'}}],groups,variants[0].options!),null);
    assert.equal(uniquePickerVariant(variants,groups,{'Edition kind':'Paper'}),null);
});
test('initial actual Liquid/native UUID restores all Unicode option groups, selected facts and availability',async()=>{
    await ready();reset(url(`?variant=${ids[1]}&interest=art#facts`));const beforeUrl=window.location.href;
    document.body.innerHTML=await html();assert.equal(root().dataset.variantId,ids[1]);assert.equal(add().disabled,false);
    assert.equal(root().querySelector('input[name="variant[भाषा]"]')?.getAttribute('value')??root().querySelector<HTMLInputElement>('input[name="variant[भाषा]"]')?.value,'हिन्दी');
    assert.match(root().textContent!,/36 items in total/);assert.doesNotMatch(root().textContent!,/15 items|Wood|6–8/);assert.equal(window.location.href,beforeUrl);assert.equal(calls,0);
});
test('invalid initial URL never chooses a first row, including repeated identical variant parameters',async()=>{
    await ready();for(const query of ['', '?variant=bad',`?variant=${OTHER}`,`?variant=${ids[0]}&variant=${ids[0]}`]) {
        reset(url(query));const beforeUrl=window.location.href;document.body.innerHTML=await html();empty();assert.equal(window.location.href,beforeUrl);assert.doesNotMatch(root().textContent!,/15 items|Wood|36 items/);
    }
});
test('native choices replace one param and preserve exact Next state object, repeated values, hash and history length',async()=>{
    await ready();reset(url('?interest=art&interest=build&search=हिन्दी#facts'));document.body.innerHTML=await html();
    const state=window.history.state,length=window.history.length,original=window.history.replaceState;const seen:unknown[]=[];
    window.history.replaceState=function(data:unknown,unused:string,target?:string|URL|null){seen.push(data);return original.call(this,data,unused,target);};
    try {choose('Edition kind','Paper');assert.equal(new URL(window.location.href).searchParams.has('variant'),false);choose('भाषा','हिन्दी');
        assert.equal(new URL(window.location.href).searchParams.get('variant'),ids[1]);assert.equal(root().dataset.variantId,ids[1]);
        choose('भाषा','English');assert.equal(new URL(window.location.href).searchParams.get('variant'),ids[2]);assert.equal(add().disabled,true);assert.equal(root().dataset.selectionState,'unavailable');
        assert.deepEqual(new URL(window.location.href).searchParams.getAll('interest'),['art','build']);assert.equal(window.location.hash,'#facts');assert.equal(window.history.length,length);assert.ok(seen.length>=2);assert.ok(seen.every(value=>value===state));
    } finally {window.history.replaceState=original;}
});
test('fresh native rehydrate restores the chosen edition from its actual URL',async()=>{
    await ready();reset();const source=await html();document.body.innerHTML=source;choose('Edition kind','Paper');choose('भाषा','हिन्दी');const selectedUrl=window.location.href;
    document.body.replaceChildren();document.body.innerHTML=source;assert.equal(window.location.href,selectedUrl);assert.equal(root().dataset.variantId,ids[1]);assert.match(root().textContent!,/36 items in total/);assert.equal(calls,0);
});
test('real jsdom back/forward traversals restore each UUID and clear selection on the entry with no variant',async()=>{
    await ready();reset();document.body.innerHTML=await html();window.history.pushState({entry:'A'},'',url(`?variant=${ids[0]}#a`));pop();assert.equal(root().dataset.variantId,ids[0]);
    window.history.pushState({entry:'B'},'',url(`?variant=${ids[1]}#b`));pop();assert.equal(root().dataset.variantId,ids[1]);
    await traverse(()=>window.history.back());assert.equal(root().dataset.variantId,ids[0]);assert.match(root().textContent!,/15 items in total/);
    await traverse(()=>window.history.forward());assert.equal(root().dataset.variantId,ids[1]);assert.match(root().textContent!,/36 items in total/);
    await traverse(()=>window.history.back());await traverse(()=>window.history.back());empty();assert.equal(calls,0);
});
test('current product is scoped away from related products, duplicate owners and a later foreign path',async()=>{
    await ready();reset(url(`?variant=${ids[1]}`));document.body.innerHTML=await html()+await html(model(OTHER),'related');assert.equal(root().dataset.variantId,ids[1]);empty(root('related'));
    const beforeUrl=window.location.href;choose('Edition kind','Inherited',root('related'));choose('भाषा','हिन्दी',root('related'));assert.equal(window.location.href,beforeUrl);assert.equal(root().dataset.variantId,ids[1]);
    window.history.replaceState({},'',`${origin}/product/${OTHER}?variant=${ids[0]}`);const foreignUrl=window.location.href;choose('Edition kind','Inherited');assert.equal(window.location.href,foreignUrl);
    reset(url(`?variant=${ids[0]}`));document.body.innerHTML=await html()+await html(model(),'duplicate');empty();empty(root('duplicate'));
    const mixed='abcdef12-3456-4abc-8def-1234567890ab';reset(`${origin}/product/${mixed}?variant=${ids[0]}`);
    document.body.innerHTML=await html(model(mixed))+await html(model(mixed.toUpperCase()),'duplicate');empty();empty(root('duplicate'));
});
test('initial duplicate pickers becoming one restore facts and availability through real back/forward history', async () => {
    await ready();
    reset(url(`?interest=art&interest=build&variant=${ids[0]}#facts`));
    const stateA = window.history.state;
    document.body.innerHTML = await html() + await html(model(), 'duplicate');
    empty();
    empty(root('duplicate'));
    assert.doesNotMatch(root().textContent!, /15 items|36 items|Wood/);
    const initialUrl = window.location.href;
    pop();
    empty();
    empty(root('duplicate'));
    assert.equal(window.location.href, initialUrl);

    root('duplicate').remove();
    empty();
    window.history.pushState({ __NA: true, tree: ['paper-entry'] }, '', initialUrl);
    const stateB = window.history.state;
    const paperHistoryLength = window.history.length;
    choose('Edition kind', 'Paper');
    choose('भाषा', 'हिन्दी');
    assert.equal(new URL(window.location.href).searchParams.get('variant'), ids[1]);
    assert.equal(root().dataset.variantId, ids[1]);
    assert.match(root().textContent!, /36 items in total/);
    assert.equal(add().disabled, false);
    assert.equal(window.history.state, stateB);
    assert.equal(window.history.length, paperHistoryLength);

    window.history.pushState({ __NA: true, tree: ['unavailable-entry'] }, '', window.location.href);
    const stateC = window.history.state;
    choose('भाषा', 'English');
    assert.equal(new URL(window.location.href).searchParams.get('variant'), ids[2]);
    assert.equal(root().dataset.selectionState, 'unavailable');
    assert.equal(add().disabled, true);
    assert.doesNotMatch(root().textContent!, /15 items|36 items|Wood/);
    assert.equal(window.history.state, stateC);
    assert.deepEqual(new URL(window.location.href).searchParams.getAll('interest'), ['art', 'build']);
    assert.equal(window.location.hash, '#facts');

    await traverse(() => window.history.back());
    assert.equal(window.history.state, stateB);
    assert.equal(root().dataset.variantId, ids[1]);
    assert.match(root().textContent!, /36 items in total/);
    assert.equal(add().disabled, false);
    await traverse(() => window.history.back());
    assert.equal(window.history.state, stateA);
    assert.equal(root().dataset.variantId, ids[0]);
    assert.match(root().textContent!, /15 items in total/);
    assert.equal(add().disabled, false);
    await traverse(() => window.history.forward());
    assert.equal(window.history.state, stateB);
    assert.equal(root().dataset.variantId, ids[1]);
    assert.match(root().textContent!, /36 items in total/);
    assert.equal(add().disabled, false);
    await traverse(() => window.history.forward());
    assert.equal(window.history.state, stateC);
    assert.equal(root().dataset.variantId, ids[2]);
    assert.equal(root().dataset.selectionState, 'unavailable');
    assert.equal(add().disabled, true);
    assert.doesNotMatch(root().textContent!, /15 items|36 items|Wood/);
    assert.equal(calls, 0);
});
test('private editor and catalog-demo URLs are never restored or rewritten',async()=>{
    await ready();for(const href of [`${origin}/preview?variant=${ids[1]}&theme_preview_session_id=synthetic`,`${origin}/theme-preview/letbuyy-bloom?demo_path=product&variant=${ids[1]}`,url(`?preview_token=synthetic&variant=${ids[1]}`)]) {
        reset(href);document.body.innerHTML=await html();const original=window.location.href;choose('Edition kind','Paper');choose('भाषा','हिन्दी');assert.equal(window.location.href,original);
    }
    reset(url(`?variant=${ids[1]}`));document.body.innerHTML=`<div data-catalog-demo-read-only="true">${await html()}</div>`;choose('Edition kind','Inherited');choose('भाषा','हिन्दी');assert.equal(new URL(window.location.href).searchParams.get('variant'),ids[1]);assert.equal(calls,0);
});
test('ambiguous actual picker tuples stay unselected/disabled even with an owned URL UUID',async()=>{
    await ready();reset(url(`?variant=${ids[0]}`));const product=model();product.variants!.push({...product.variants![0],id:OTHER});document.body.innerHTML=await html(product);empty();
    choose('Edition kind','Inherited');choose('भाषा','हिन्दी');assert.equal(add().disabled,true);assert.equal(root().dataset.variantId,'');assert.equal(new URL(window.location.href).searchParams.has('variant'),false);
});
test('disconnect removes popstate behavior and reconnect restores once from the current owned URL',async()=>{
    await ready();reset(url(`?variant=${ids[0]}`));document.body.innerHTML=await html();const section=root(),picker=section.querySelector('lb-variant-picker')!;
    let events=0;const changed=()=>events++;window.addEventListener('letbuyy:variant:changed',changed);
    try {section.remove();const beforeEvents=events;window.history.replaceState({},'',url(`?variant=${ids[1]}`));pop();assert.equal(events,beforeEvents);assert.equal(picker.querySelectorAll('[aria-pressed="true"]').length,2);
        document.body.append(section);assert.equal(root().dataset.variantId,ids[1]);assert.equal(root().querySelectorAll('.pf-contents').length,1);assert.equal(events,beforeEvents+1);
    } finally {window.removeEventListener('letbuyy:variant:changed',changed);}
});
