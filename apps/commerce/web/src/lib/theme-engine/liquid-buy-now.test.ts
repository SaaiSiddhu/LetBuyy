import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>') as unknown as {
    window: Window & typeof globalThis;
    reconfigure(options: { url: string }): void;
};
dom.reconfigure({ url: 'https://shop.example.test/product/product-1' });
const navigations: string[] = [];
const location = { pathname: '/product/product-1', hostname: 'shop.example.test', origin: 'https://shop.example.test', search: '',
    assign(value: string) { navigations.push(value); } };
const browserWindow = new Proxy(dom.window, { get(target, key) {
    if (key === 'location') return location;
    const value = Reflect.get(target, key, target);
    return ['dispatchEvent', 'addEventListener', 'removeEventListener', 'setTimeout', 'clearTimeout'].includes(String(key))
        ? value.bind(target) : value;
} });
Object.assign(globalThis, { window: browserWindow, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent });
let registered: Promise<void> | undefined;
const ready = () => registered ??= import('./liquid-hydration-islands').then(module => module.registerLiquidHydrationIslands());
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const serverCart = { cart_token: 'synthetic-cart-token', lines: [{ product_id: 'product-1', title: 'Synthetic product',
    quantity: 1, unit_price: 199, currency: 'INR' }], subtotal: 199, discount_total: 0, shipping_total: 0, tax_total: 0,
    total: 199, coupon_codes: [], currency: 'INR' };
function purchase() {
    document.body.innerHTML = '<lb-add-to-cart data-product-id="product-1" data-product-name="Synthetic product" data-product-price="199" data-product-currency="INR">' +
        '<button type="button" data-lb-buy-now>Buy now</button><span data-lb-add-to-cart-status></span></lb-add-to-cart>';
    return { island: document.querySelector<HTMLElement>('lb-add-to-cart')!, button: document.querySelector<HTMLButtonElement>('button')! };
}
function reset() { document.body.innerHTML = ''; dom.window.localStorage.clear(); navigations.length = 0; location.pathname = '/product/product-1'; }

test('Buy now waits for the canonical cart receipt, coalesces a double click and keeps a storefront-domain checkout path', async () => {
    await ready(); reset();
    const originalFetch = globalThis.fetch;
    let release!: (response: Response) => void;
    let calls = 0, opened = 0;
    const openedCart = () => { opened++; };
    window.addEventListener('letbuyy:cart:open', openedCart);
    globalThis.fetch = (async () => { calls++; return new Promise<Response>(resolve => { release = resolve; }); }) as typeof fetch;
    try {
        const { button } = purchase(); button.click(); button.click();
        assert.deepEqual(navigations, [], 'leaving before the cart receipt loses the pending request');
        assert.equal(calls, 1); assert.equal(opened, 0, 'Buy now must not launch a second drawer cart synchronization');
        assert.equal(JSON.parse(dom.window.localStorage.getItem('lb_cart')!)[0].quantity, 1);
        release(new Response(JSON.stringify({ success: true, data: serverCart }), { status: 200 }));
        await tick();
        assert.equal(dom.window.localStorage.getItem('lb_cart_token'), serverCart.cart_token);
        assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('lb_cart_server')!), serverCart);
        assert.deepEqual(navigations, ['/checkout']);
    } finally { globalThis.fetch = originalFetch; window.removeEventListener('letbuyy:cart:open', openedCart); reset(); }
});

for (const outcome of ['outage', 'missing-token'] as const) {
    test('Buy now stays on the product when the canonical cart reports ' + outcome, async () => {
        await ready(); reset(); const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => outcome === 'outage'
            ? new Response('{}', { status: 503 })
            : new Response(JSON.stringify({ success: true, data: { ...serverCart, cart_token: '' } }), { status: 200 })) as typeof fetch;
        try {
            const { button, island } = purchase(); button.click(); await tick();
            assert.deepEqual(navigations, []);
            assert.equal(dom.window.localStorage.getItem('lb_cart_token'), null);
            assert.match(island.textContent || '', /could not prepare checkout/i);
            assert.equal(button.disabled, false, 'a failed cart synchronization allows a normal retry');
        } finally { globalThis.fetch = originalFetch; reset(); }
    });
}

test('Buy now preserves the explicit path-routed storefront base', async () => {
    await ready(); reset(); const originalFetch = globalThis.fetch;
    location.pathname = '/store/demo/product/product-1';
    globalThis.fetch = (async () => new Response(JSON.stringify({ success: true, data: serverCart }), { status: 200 })) as typeof fetch;
    try {
        const { island, button } = purchase(); island.dataset.basePath = '/store/demo'; button.click(); await tick();
        assert.deepEqual(navigations, ['/store/demo/checkout']);
    } finally { globalThis.fetch = originalFetch; reset(); }
});

test('variant purchases require a choice and retain durable variant identity through cart receipts and controls', async () => {
    await ready(); reset(); const originalFetch = globalThis.fetch;
    Object.assign(globalThis, { CSS: { escape: (value: string) => value } });
    const requests: Array<{ lines: Array<{ product_id: string; variant_id: string; quantity: number; properties: Record<string, string> }> }> = [];
    const variants = [{ id: 'small', price: 199, stock: 3, options: { Size: 'Small' } }, { id: 'large', price: 249, stock: 4, options: { Size: 'Large' } }, { id: 'sold', price: 299, stock: 0, options: { Size: 'Sold' } }];
    globalThis.fetch = (async (input, init) => {
        if (String(input).endsWith('/checkout-status')) return new Response(JSON.stringify({ success: true, data: { cart_status: 'active', checkout_state: null } }));
        const body = JSON.parse(String(init?.body)); requests.push(body);
        return new Response(JSON.stringify({ success: true, data: { ...serverCart, lines: body.lines.map((line: {variant_id: string; quantity: number}) => ({ ...serverCart.lines[0], ...line, unit_price: variants.find(variant => variant.id === line.variant_id)?.price })) } }), { status: 200 });
    }) as typeof fetch;
    try {
        const section = document.createElement('section'); section.dataset.sectionId = 'pdp';
        section.innerHTML = `<span class="lb-product-detail__price-current">₹199</span><lb-variant-picker data-variants='${JSON.stringify(variants)}'>${['Small','Large','Sold'].map(value => `<button data-lb-variant-option data-variant-name="Size" data-variant-value="${value}" aria-pressed="false">${value}</button>`).join('')}<span data-lb-variant-status></span></lb-variant-picker><lb-add-to-cart data-product-id="product-1" data-product-name="Synthetic product" data-product-price="199" data-product-currency="INR"><button data-lb-buy-now>Buy now</button><button data-lb-add-to-cart>Add to cart</button><span data-lb-add-to-cart-status></span></lb-add-to-cart>`;
        document.body.append(section);
        const button = section.querySelector<HTMLButtonElement>('[data-lb-buy-now]')!;
        assert.equal(button.disabled, true); button.click(); await tick(); assert.equal(requests.length, 0);
        section.querySelector<HTMLButtonElement>('[data-variant-value="Sold"]')!.click(); assert.equal(button.disabled, true);
        section.querySelector<HTMLButtonElement>('[data-variant-value="Large"]')!.click(); assert.equal(button.disabled, false);
        assert.match(section.querySelector('.lb-product-detail__price-current')!.textContent!, /249/);
        button.click(); await tick();
        assert.equal(requests[0].lines[0].variant_id, 'large');
        assert.equal(JSON.parse(dom.window.localStorage.getItem('lb_cart')!)[0].variantId, 'large');
        section.querySelector<HTMLButtonElement>('[data-variant-value="Small"]')!.click(); section.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]')!.click(); await tick();
        assert.deepEqual(requests.at(-1)!.lines.map(line => [line.variant_id, line.quantity]), [['large',1],['small',1]], 'different sizes must not collapse into one product line');
        const cart = document.createElement('lb-cart'); document.body.append(cart);
        cart.querySelector<HTMLButtonElement>('[data-lb-cart-step="up"][data-variant-id="small"]')!.click(); await tick();
        assert.deepEqual(requests.at(-1)!.lines.map(line => [line.variant_id, line.quantity]), [['large',1],['small',2]]);
        cart.querySelector<HTMLButtonElement>('[data-lb-cart-remove][data-variant-id="large"]')!.click(); await tick();
        assert.deepEqual(requests.at(-1)!.lines.map(line => [line.variant_id, line.quantity]), [['small',2]]);
    } finally { globalThis.fetch = originalFetch; reset(); }
});

test('variant quick-add cards open the product picker without writing an unspecified cart line', async () => {
    await ready(); reset(); const originalFetch = globalThis.fetch; let calls = 0;
    globalThis.fetch = (async () => { calls++; throw new Error('no cart write expected'); }) as typeof fetch;
    try {
        const { island, button } = purchase(); island.dataset.productUrl = '/product/product-1';
        const islandsModule = await import('./liquid-hydration-islands'); islandsModule.bindVariantPurchaseControls(document.body, ['product-1']);
        assert.equal(button.textContent, 'Choose options'); button.click(); await tick();
        assert.deepEqual(navigations, ['/product/product-1']); assert.equal(calls, 0); assert.equal(dom.window.localStorage.getItem('lb_cart'), null);
    } finally { globalThis.fetch = originalFetch; reset(); }
});

test('actual hydration mounts on rendered content when a hoisted Liquid stylesheet precedes it', async () => {
    await ready(); reset();
    const { createRoot } = await import('react-dom/client'); const { createElement, act } = await import('react');
    const islandsModule = await import('./liquid-hydration-islands'); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const style = document.createElement('style'); style.dataset.themeRenderer = 'liquid'; document.head.append(style);
    const { island, button } = purchase(); const rendered = document.createElement('div'); rendered.dataset.themeRenderer = 'liquid'; rendered.dataset.editorMode = 'false'; rendered.append(island); document.body.append(rendered);
    const mount = document.createElement('div'); document.body.append(mount); const root = createRoot(mount);
    try {
        await act(async () => { root.render(createElement(islandsModule.default, { basePath: '', storeId: 'store-1', variantProductIds: ['product-1'] })); });
        assert.equal(button.textContent, 'Choose options'); assert.ok(rendered.querySelector('lb-cart-drawer')); assert.equal(style.childElementCount, 0);
    } finally { await act(async () => root.unmount()); style.remove(); reset(); }
});


test('confirmed cart is retired before a new Buy now and old purchased lines never enter the new intent',async()=>{
 await ready();reset();const originalFetch=globalThis.fetch,oldItems=JSON.stringify([{id:'old-product',name:'Purchased',quantity:1,price:999,currency:'INR',images:[]}]);
 window.localStorage.setItem('lb_cart_token','ct_old_completed');window.localStorage.setItem('lb_cart',oldItems);window.localStorage.setItem('lb_cart_server',JSON.stringify({cart_token:'ct_old_completed',lines:[]}));
 const writes:Array<{method:string;body:{lines:Array<{product_id:string;quantity:number}>}}>=[];
 globalThis.fetch=(async(input,init)=>{
  if(String(input).endsWith('/checkout-status'))return new Response(JSON.stringify({success:true,data:{cart_status:'converted',checkout_state:'completed',order:{id:crypto.randomUUID()}}}));
  writes.push({method:String(init?.method),body:JSON.parse(String(init?.body))});return new Response(JSON.stringify({success:true,data:{...serverCart,cart_token:'ct_new_purchase'}}));
 })as typeof fetch;
 try{const{button}=purchase();button.click();button.click();await tick();assert.equal(writes.length,1);assert.equal(writes[0].method,'POST');assert.deepEqual(writes[0].body.lines.map(line=>[line.product_id,line.quantity]),[['product-1',1]]);assert.equal(window.localStorage.getItem('lb_cart_token'),'ct_new_purchase');assert.deepEqual(navigations,['/checkout']);}finally{globalThis.fetch=originalFetch;reset();}
});

for(const state of ['contact','payment_intent',null])test('pending checkout '+state+' retains its cart and draft when adding another item',async()=>{
 await ready();reset();const originalFetch=globalThis.fetch;window.localStorage.setItem('lb_cart_token','ct_pending_purchase');window.localStorage.setItem('lb_cart',JSON.stringify([{id:'old-product',name:'Draft',quantity:1,price:99,currency:'INR',images:[]}]));let method='',products:string[]=[];
 globalThis.fetch=(async(input,init)=>{
  if(String(input).endsWith('/checkout-status'))return new Response(JSON.stringify({success:true,data:{cart_status:'active',checkout_state:state}}));
  method=String(init?.method);products=JSON.parse(String(init?.body)).lines.map((line:{product_id:string})=>line.product_id);return new Response(JSON.stringify({success:true,data:{...serverCart,cart_token:'ct_pending_purchase'}}));
 })as typeof fetch;
 try{purchase().button.click();await tick();assert.equal(method,'PATCH');assert.deepEqual(products,['old-product','product-1']);assert.equal(window.localStorage.getItem('lb_cart_token'),'ct_pending_purchase');}finally{globalThis.fetch=originalFetch;reset();}
});

for(const outcome of ['not-found','outage','converted-without-order','active-completed','malformed'] as const)test('unknown previous checkout '+outcome+' preserves storage and starts no replacement purchase',async()=>{
 await ready();reset();const originalFetch=globalThis.fetch;window.localStorage.setItem('lb_cart_token','ct_unknown_purchase');window.localStorage.setItem('lb_cart','[{"id":"draft"}]');const before=JSON.stringify({...window.localStorage});let writes=0;
 globalThis.fetch=(async(input)=>{
  if(!String(input).endsWith('/checkout-status')){writes++;throw new Error('No new intent may be sent');}
  return new Response(JSON.stringify(outcome==='malformed'?{}:{success:true,data:outcome==='active-completed'?{cart_status:'active',checkout_state:'completed',order:{id:crypto.randomUUID()}}:{cart_status:'converted',checkout_state:'completed'}}),{status:outcome==='not-found'?404:outcome==='outage'?503:200});
 })as typeof fetch;
 try{const{button,island}=purchase();button.click();await tick();assert.equal(writes,0);assert.equal(JSON.stringify({...window.localStorage}),before);assert.deepEqual(navigations,[]);assert.match(island.textContent||'',/could not check your previous checkout/i);assert.equal(button.disabled,false);}finally{globalThis.fetch=originalFetch;reset();}
});

test('delayed committed receipt cannot erase another tab cart or later draft and equivalent in-flight reads coalesce',async()=>{
 await ready();reset();const originalFetch=globalThis.fetch;const{reconcileStoredCart}=await import('../checkout/cart-lifecycle');
 for(const change of ['token','items']){
  window.localStorage.setItem('lb_cart_token','ct_previous_purchase');window.localStorage.setItem('lb_cart','[]');let release!:(response:Response)=>void,calls=0;
  globalThis.fetch=(async()=>{calls++;return new Promise<Response>(r=>{release=r;});})as typeof fetch;
  try{const first=reconcileStoredCart('shop'),second=reconcileStoredCart('shop');assert.ok(first);assert.equal(first,second);assert.equal(calls,1);window.localStorage.setItem(change==='token'?'lb_cart_token':'lb_cart',change==='token'?'ct_new_tab':'[{"id":"new-draft"}]');const snapshot=JSON.stringify({...window.localStorage});release(new Response(JSON.stringify({success:true,data:{cart_status:'converted',checkout_state:'completed',order:{id:crypto.randomUUID()}}})));assert.equal(await first,'unavailable');assert.equal(JSON.stringify({...window.localStorage}),snapshot);}finally{globalThis.fetch=originalFetch;reset();}
 }
});

for(const completed of [true,false])test('React cart bootstrap is read-only and '+(completed?'retires confirmed state before a fresh add':'preserves an unavailable checkout draft'),async()=>{
 await ready();reset();const originalFetch=globalThis.fetch;Object.assign(globalThis,{localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const{createRoot}=await import('react-dom/client'),{createElement,act}=await import('react'),{CartProvider,useCart}=await import('../../context/cart-context');
 let view:ReturnType<typeof useCart>|undefined;function Probe(){view=useCart();return null;}
 const oldItem={id:'old-product',name:'Old draft',price:99,quantity:1,currency:'INR',images:[]};window.localStorage.setItem('lb_cart_token','ct_react_previous');window.localStorage.setItem('lb_cart',JSON.stringify([oldItem]));window.localStorage.setItem('lb_cart_server','{}');let writes=0;
 globalThis.fetch=(async(input)=>{
  if(String(input).endsWith('/checkout-status'))return new Response(JSON.stringify({success:true,data:{cart_status:'converted',checkout_state:'completed',order:{id:crypto.randomUUID()}}}),{status:completed?200:503});
  writes++;return new Response(JSON.stringify({success:true,data:{...serverCart,cart_token:'ct_react_next'}}));
 })as typeof fetch;
 const mount=document.createElement('div');document.body.append(mount);const root=createRoot(mount);
 try{
  await act(async()=>{root.render(createElement(CartProvider,null,createElement(Probe)));});await act(async()=>{await tick();});assert.ok(view);assert.equal(writes,0,'mounting a storefront must not replay cart commands');
  if(completed){assert.deepEqual(view.items,[]);assert.equal(window.localStorage.getItem('lb_cart_token'),null);assert.equal(window.localStorage.getItem('lb_cart_server'),null);const product={id:'product-1',name:'Synthetic product',price:199,currency:'INR',images:[]}as Parameters<typeof view.addToCart>[0];await act(async()=>{await view!.addToCart(product);await tick();});await act(async()=>{await tick();});assert.equal(writes,1);assert.equal(window.localStorage.getItem('lb_cart_token'),'ct_react_next');}
  else{assert.equal(view.items[0].id,oldItem.id);await act(async()=>{await view!.clearCart();await tick();});assert.equal(writes,0);assert.equal(view.items[0].id,oldItem.id);assert.equal(window.localStorage.getItem('lb_cart_token'),'ct_react_previous');assert.match(view.syncError||'',/could not check your previous checkout/i);}
 }finally{await act(async()=>root.unmount());globalThis.fetch=originalFetch;reset();}
});
