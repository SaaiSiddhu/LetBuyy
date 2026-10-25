import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { StorefrontCartLineInput } from '@letbuyy/checkout-core';
import { CartProvider, useCart, type CartContextType } from './cart-context';

const configuredProduct = '7b669c70-9000-4000-8000-000000000001';
const ordinaryProduct = '7b669c70-9000-4000-8000-000000000002';
const revision = (n: number) => `2026-10-24T15:00:00.${String(123450+n).padStart(6,'0')}+00:00`;
function initialCart() {
    return { cart_token:'ct_owned_react', status:'active', updated_at:revision(0), lines:[
        { id:configuredProduct+':'+'a'.repeat(64), product_id:configuredProduct, variant_id:null as string|null, title:'Configured notebook',
            quantity:1, unit_price:690, currency:'INR', properties:{Cover:'Moss',custom:{reference:'retain'},approved:false} as Record<string,unknown>, personalization:{ method_id:'engrave',style_id:'sans',placement_id:'front',
                text:'Asha',facts_revision:2,review_fingerprint:'b'.repeat(64) } as StorefrontCartLineInput['personalization'] },
        { id:ordinaryProduct, product_id:ordinaryProduct, variant_id:null as string|null, title:'Plain pencil',
            quantity:1, unit_price:100, currency:'INR', properties:{} as Record<string,unknown> },
    ] };
}
type Wire = { lines:StorefrontCartLineInput[]; expected_updated_at?:string };

async function harness(run:(fixture:{context:()=>CartContextType;cart:()=>ReturnType<typeof initialCart>;replace:(cart:ReturnType<typeof initialCart>)=>void;
    writes:Wire[];blockNext:(fn:(body:Wire)=>Promise<Response>)=>void;commit:(body:Wire)=>Response;document:Document;releaseInitialRead:()=>void})=>Promise<void>,delayInitialRead=false) {
    const DomConstructor=JSDOM as unknown as {new(html:string,options:{url:string}):{window:Window & typeof globalThis & {close():void}}};
    const dom=new DomConstructor('<!doctype html><div id="root"></div>',{url:'https://owned.example.test/store/react-fixture/cart'});
    const keys=['window','document','navigator','localStorage','CustomEvent'] as const;
    const old=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
    for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
    const savedFetch=globalThis.fetch;
    const globalAct=globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?:boolean};
    const savedAct=globalAct.IS_REACT_ACT_ENVIRONMENT;globalAct.IS_REACT_ACT_ENVIRONMENT=true;
    let state=initialCart(),serial=0,context:CartContextType|undefined;
    const writes:Wire[]=[];
    let next:((body:Wire)=>Promise<Response>)|undefined;
    let firstRead=true,releaseInitialRead:(()=>void)|undefined;
    dom.window.localStorage.setItem('lb_cart_token',state.cart_token);
    dom.window.localStorage.setItem('lb_cart',JSON.stringify([{id:ordinaryProduct,name:'stale cached title',quantity:99,price:1}]));
    function commit(body:Wire) {
        assert.equal(body.expected_updated_at,state.updated_at,'same raw acknowledged revision, including microseconds');
        assert(body.lines.every(line=>!('unit_price' in line)&&!('price' in line)));
        state={...state,updated_at:revision(++serial),lines:body.lines.map(line=>{
            const prior=state.lines.find(row=>row.product_id===line.product_id&&row.variant_id===(line.variant_id??null));
            assert(prior);return {...prior,...line,variant_id:line.variant_id??null};
        })};
        return Response.json({success:true,data:state});
    }
    globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
        const path=String(input);
        if(path.endsWith('/checkout-status'))return Response.json({success:true,data:{cart_status:'active',checkout_state:null}});
        if((init?.method||'GET')==='GET'&&path.endsWith('/cart/'+state.cart_token)){
            if(firstRead&&delayInitialRead){firstRead=false;const captured=structuredClone(state);return new Promise<Response>(resolve=>{releaseInitialRead=()=>resolve(Response.json({success:true,data:captured}));});}
            firstRead=false;return Response.json({success:true,data:state});
        }
        if(init?.method==='PATCH'&&path.endsWith('/cart/'+state.cart_token)) {
            const body=JSON.parse(String(init.body)) as Wire;writes.push(body);
            if(next){const handler=next;next=undefined;return handler(body);}
            return commit(body);
        }
        throw new Error('Unexpected owned React consumer request '+path+' '+(init?.method||'GET'));
    }) as typeof fetch;
    function Probe(){const value=useCart();React.useLayoutEffect(()=>{context=value;},[value]);return <output>{value.items.map(item=>`${item.id}:${item.quantity}:${item.personalizationDraft?.text||''}`).join('|')} / {value.syncError}</output>;}
    const root=createRoot(dom.window.document.getElementById('root')!);
    try {
        await act(async()=>{root.render(<CartProvider><Probe/></CartProvider>);await new Promise(done=>setTimeout(done,0));});
        await run({context:()=>{assert(context);return context;},cart:()=>structuredClone(state),replace:value=>{state=value;},writes,
            blockNext:fn=>{next=fn;},commit,document:dom.window.document,releaseInitialRead:()=>{assert(releaseInitialRead);releaseInitialRead();}});
    } finally {
        await act(async()=>root.unmount());dom.window.close();globalThis.fetch=savedFetch;globalAct.IS_REACT_ACT_ENVIRONMENT=savedAct;
        for(const key of keys){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
    }
}

test('actual React cart mounts as a read and preserves configured facts in a revision-bound quantity write',async()=>{
    await harness(async f=>{
        assert.equal(f.writes.length,0);assert.equal(f.context().items[0].personalizationDraft?.text,'Asha');assert.equal(f.context().cartCount,2);
        let release:(()=>void)|undefined;
        f.blockNext(body=>new Promise<Response>(resolve=>{release=()=>resolve(f.commit(body));}));
        let pending:Promise<void>|undefined;
        await act(async()=>{pending=Promise.resolve(f.context().updateQuantity(ordinaryProduct,2));await new Promise(done=>setTimeout(done,0));});
        assert.equal(f.writes.length,1);assert.equal(f.writes[0].expected_updated_at,revision(0));
        assert.equal(f.writes[0].lines[0].personalization?.text,'Asha');assert.deepEqual(f.writes[0].lines[0].properties,initialCart().lines[0].properties);assert.equal(f.context().cartCount,2,'unacknowledged change must not replace accepted UI');
        await act(async()=>{assert(release);release();await pending;});
        assert.equal(f.context().cartCount,3);assert.equal(f.context().syncError,null);
    });
});

test('two queued React intents re-read accepted contents and use consecutive raw server revisions',async()=>{
    await harness(async f=>{
        await act(async()=>{
            const a=Promise.resolve(f.context().updateQuantity(ordinaryProduct,2));
            const b=Promise.resolve(f.context().updateQuantity(ordinaryProduct,3));await Promise.all([a,b]);
        });
        assert.equal(f.writes.length,2);assert.deepEqual(f.writes.map(body=>body.expected_updated_at),[revision(0),revision(1)]);
        assert.equal(f.cart().lines[1].quantity,3);assert.equal(f.cart().lines[0].personalization?.text,'Asha');
    });
});

test('a revision conflict cancels old queued intents and a fresh intent retains another consumer’s configured edit',async()=>{
    await harness(async f=>{
        f.blockNext(async()=>{
            const changed=f.cart();changed.updated_at=revision(8);changed.lines[0].personalization!.text='Asha-Rae';f.replace(changed);
            return Response.json({success:false,error:{code:'CART_REVISION_CONFLICT',message:'Reload your saved cart.'}},{status:409});
        });
        await act(async()=>{
            const a=Promise.resolve(f.context().updateQuantity(ordinaryProduct,2));
            const b=Promise.resolve(f.context().updateQuantity(ordinaryProduct,3));await Promise.all([a,b]);
        });
        assert.equal(f.writes.length,1);assert.match(f.context().syncError||'',/Reload/);assert.equal(f.cart().lines[0].personalization?.text,'Asha-Rae');
        await act(async()=>{await f.context().updateQuantity(ordinaryProduct,2);});
        assert.equal(f.writes[1].expected_updated_at,revision(8));assert.equal(f.writes[1].lines[0].personalization?.text,'Asha-Rae');
        assert.equal(f.context().items[0].personalizationDraft?.text,'Asha-Rae');
    });
});

test('an ambiguous old React item selector cannot delete several separately configured lines',async()=>{
    await harness(async f=>{
        const changed=f.cart();changed.lines=[changed.lines[0],{...changed.lines[0],id:configuredProduct+':'+'c'.repeat(64),personalization:{...changed.lines[0].personalization!,text:'Kabir'}}];f.replace(changed);
        await act(async()=>{await f.context().removeFromCart(configuredProduct);});
        assert.equal(f.writes.length,0);assert.equal(f.cart().lines.length,2);assert.match(f.context().syncError||'',/specific configured line/);
    });
});

test('a delayed mount read cannot replace a later acknowledged cart mutation',async()=>{
    await harness(async f=>{
        await act(async()=>{await f.context().updateQuantity(ordinaryProduct,2);});
        assert.equal(f.context().cartCount,3);
        await act(async()=>{f.releaseInitialRead();await new Promise(done=>setTimeout(done,0));});
        assert.equal(f.context().cartCount,3,'late read retains the newer accepted result');
        assert.equal(f.writes.length,1);assert.equal(f.cart().lines[1].quantity,2);
    },true);
});
