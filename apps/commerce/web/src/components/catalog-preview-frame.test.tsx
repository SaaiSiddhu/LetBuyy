import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
type QaDom = { window: Window & typeof globalThis };
type QaDomConstructor = new (html?: string, options?: { url?: string }) => QaDom;
const requireApp=createRequire(new URL('../../package.json',import.meta.url));
const { JSDOM } = requireApp('jsdom') as { JSDOM: QaDomConstructor };
test('demo frame verifies readiness source, preserves the iframe across device changes, and retries a failed load',async()=>{
    const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/theme-preview/letbuyy-sense?version=2.0.0'});
    const names=['window','document','navigator','self','MutationObserver','HTMLElement','Element','ResizeObserver','React','IS_REACT_ACT_ENVIRONMENT','setTimeout'];
    const previous=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
    for(const name of names.slice(0,7))Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:name==='self'?dom.window:Reflect.get(dom.window,name)});
    Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true,ResizeObserver:class {constructor(private callback:(entries:object[])=>void){} observe(){this.callback([{contentRect:{width:1000}}]);} disconnect(){}}});
    const originalTimer=globalThis.setTimeout; let loadingTimeout:(()=>void)|undefined;
    globalThis.setTimeout=((callback:(...args:unknown[])=>void,delay?:number,...args:unknown[])=>{if(delay===20_000)loadingTimeout=()=>callback(...args);return originalTimer(callback,delay,...args);}) as typeof setTimeout;
    const oldCss=requireApp.extensions['.css'];requireApp.extensions['.css']=module=>{module.exports={};};
    const {default:Frame}=await import('./CatalogPreviewFrame');
    const {createRoot}=await import('react-dom/client');
    const root=createRoot(dom.window.document.getElementById('root')!);
    try{
        await act(async()=>root.render(<Frame slug="letbuyy-sense" version="2.0.0" name="Threadline"/>));
        const frame=dom.window.document.querySelector('iframe')!;
        assert.equal(frame.width,'1440');assert.match(dom.window.document.body.textContent||'',/Loading sample store/);
        const ready={type:'letbuyy:catalog-demo:route',slug:'letbuyy-sense',path:'/product/shirt?variant=medium'};
        await act(async()=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin:'https://foreign.example.invalid',source:frame.contentWindow,data:ready})));
        assert.match(dom.window.document.body.textContent||'',/Loading sample store/);
        await act(async()=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin:'http://localhost',source:dom.window,data:ready})));
        assert.match(dom.window.document.body.textContent||'',/Loading sample store/);
        await act(async()=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin:'http://localhost',source:frame.contentWindow,data:ready})));
        assert.doesNotMatch(dom.window.document.body.textContent||'',/Loading sample store/);
        assert.equal(new URL(dom.window.location.href).searchParams.get('demo_path'),ready.path);
        await act(async()=>dom.window.document.querySelector<HTMLButtonElement>('[aria-label="mobile preview"]')!.click());
        assert.equal(dom.window.document.querySelector('iframe'),frame,'device switch does not replace the active document');assert.equal(frame.width,'390');assert.equal(frame.height,'844');
        await act(async()=>dom.window.document.querySelector<HTMLButtonElement>('[aria-label="Reload demo page"]')!.click());
        const loadingFrame=dom.window.document.querySelector('iframe')!;
        assert.ok(loadingTimeout);
        await act(async()=>loadingTimeout!());
        assert.match(dom.window.document.body.textContent||'',/sample store has not responded/);
        await act(async()=>[...dom.window.document.querySelectorAll('button')].find(button=>button.textContent==='Retry demo')!.click());
        const retried=dom.window.document.querySelector('iframe')!;
        assert.notEqual(retried,loadingFrame,'retry starts a fresh iframe document');
        assert.equal(new URL(retried.src).searchParams.get('demo_path'),ready.path);
        assert.equal(new URL(retried.src).searchParams.get('version'),'2.0.0');
    }finally{
        await act(async()=>root.unmount());dom.window.close();
        for(const[name,descriptor]of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}
        if(oldCss)requireApp.extensions['.css']=oldCss;else delete requireApp.extensions['.css'];
    }
});
