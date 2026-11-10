import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import Link from 'next/link';
import { Input, Button } from '@letbuyy/ui';
type QaDom = { window: Window & typeof globalThis };
type QaDomConstructor = new (html?: string, options?: { url?: string }) => QaDom;
const requireApp = createRequire(new URL('../../package.json', import.meta.url));
const { JSDOM } = requireApp('jsdom') as { JSDOM: QaDomConstructor };
async function mount() {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/theme-preview/letbuyy-sense?embedded=1' });
    const names = ['window','document','navigator','self','MutationObserver','HTMLElement','Element','FormData','React','IS_REACT_ACT_ENVIRONMENT'];
    const previous = Object.fromEntries(names.map(name => [name,Object.getOwnPropertyDescriptor(globalThis,name)]));
    for (const name of names.slice(0,8)) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:name==='self'?dom.window:Reflect.get(dom.window,name)});
    Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
    const oldCss = requireApp.extensions['.css']; requireApp.extensions['.css'] = module => { module.exports = {}; };
    const { default: Navigation } = await import('./CatalogPreviewNavigation');
    const { createRoot } = await import('react-dom/client');
    const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js');
    const { SearchParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js');
    const pushes:string[]=[]; let mutations=0;
    const router={ bfcacheId: \'synthetic-router-cache\', back(){},forward(){},refresh(){},hmrRefresh(){},push(value:string){pushes.push(value);},replace(){},prefetch(){}};
    const root=createRoot(dom.window.document.getElementById('root')!);
    await act(async()=>root.render(<AppRouterContext.Provider value={router}><SearchParamsContext.Provider value={new URLSearchParams()}><Navigation slug="letbuyy-sense" version="2.0.0">
        <Link id="product" href="/store/urban-kicks-demo/product/shirt?variant=medium#fit-guide">Shirt</Link>
        <Link id="external" href="https://provider.example.invalid/account">Provider</Link>
        <form id="search" action="/products?connector=lightning" method="get"><Input unstyled name="q" defaultValue="linen"/><Input unstyled name="age_band" defaultValue="6-8"/><Input unstyled name="connector" defaultValue="usb-c"/><Input unstyled name="connector" defaultValue="hdmi"/><Button unstyled>Search</Button></form>
        <form id="contact" action="/contact" method="post" onSubmit={()=>mutations++}><Input unstyled name="email" defaultValue="sample@example.invalid"/><Button unstyled>Send</Button></form>
        <Button unstyled id="add" data-lb-add-to-cart onClick={()=>mutations++}>Add</Button>
    </Navigation></SearchParamsContext.Provider></AppRouterContext.Provider>));
    return {dom,pushes,mutations:()=>mutations,text:()=>dom.window.document.body.textContent||'',
        async close(){await act(async()=>root.unmount());dom.window.close();for(const[name,descriptor]of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}if(oldCss)requireApp.extensions['.css']=oldCss;else delete requireApp.extensions['.css'];}};
}
test('demo link destinations retain resource, variant, fragment and exact theme version even before a click',async()=>{
    const h=await mount();try{
        const href=h.dom.window.document.getElementById('product')!.getAttribute('href')!;
        const url=new URL(href,'http://localhost');
        assert.equal(url.pathname,'/theme-preview/letbuyy-sense');assert.equal(url.searchParams.get('version'),'2.0.0');
        assert.equal(url.searchParams.get('demo_path'),'/product/shirt?variant=medium#fit-guide');
        assert.equal(h.dom.window.document.getElementById('external')!.getAttribute('href'),'#demo-link-unavailable');
        await act(async()=>h.dom.window.document.getElementById('external')!.click());
        assert.match(h.text(),/External navigation is unavailable/);assert.equal(h.pushes.length,0);
    }finally{await h.close();}
});
test('GET search translates bounded state while Add and mutating forms remain blocked until isolated transport exists',async()=>{
    const h=await mount();try{
        const search=h.dom.window.document.getElementById('search')!;
        await act(async()=>search.dispatchEvent(new h.dom.window.Event('submit',{bubbles:true,cancelable:true})));
        const target=new URL(h.pushes[0],'http://localhost');
        const route=new URL(target.searchParams.get('demo_path')!,'http://localhost');
        assert.equal(route.pathname,'/products');assert.equal(route.searchParams.get('search'),'linen');assert.equal(route.searchParams.get('age_band'),'6-8');
        assert.deepEqual(route.searchParams.getAll('connector'),['usb-c','hdmi'],'submitted repeated choices replace action defaults without flattening');
        await act(async()=>h.dom.window.document.getElementById('contact')!.dispatchEvent(new h.dom.window.Event('submit',{bubbles:true,cancelable:true})));
        assert.match(h.text(),/No message, subscription, account or order was sent/);
        await act(async()=>h.dom.window.document.getElementById('add')!.click());
        assert.match(h.text(),/isolated cart session/);assert.equal(h.mutations(),0);assert.equal(h.pushes.length,1);
    }finally{await h.close();}
});
