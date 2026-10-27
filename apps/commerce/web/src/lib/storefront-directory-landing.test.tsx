import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { StorefrontDirectoryPayloadSchema } from '@letbuyy/shared-types';

const source = new URL('../app/storefront-landing.tsx', import.meta.url);
const requireLocal = createRequire(source);
const code = ts.transpileModule(readFileSync(source, 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const compiled: { exports: {default?: React.ComponentType<React.ComponentProps<typeof import('../app/storefront-landing').default>>} } = {exports:{}};
let finderInputOnChange: React.ChangeEventHandler<HTMLInputElement> | undefined;
const mocks: Record<string, unknown> = {
    'next/link': ({href, children, ...props}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement('a',{...props,href},children),
    '@letbuyy/ui': { MaterialIcon:()=>null, ThemeToggleButton:()=>null,
        Button: (props:React.ButtonHTMLAttributes<HTMLButtonElement>)=>React.createElement('button',props),
        Input: (props:React.InputHTMLAttributes<HTMLInputElement>)=>{finderInputOnChange=props.onChange;return React.createElement('input',props);} },
    './storefront-landing.css': {},
};
new Function('require','module','exports',code)((id:string)=>Object.hasOwn(mocks,id)?mocks[id]:requireLocal(id),compiled,compiled.exports);
const Landing=compiled.exports.default!;
const directory=StorefrontDirectoryPayloadSchema.parse({stores:[{store_name:'synthetic-public',subdomain:'synthetic-public',name:'Synthetic public shop',logo_url:null,theme_id:'letbuyy-forge',theme_name:'Circuit',status:'published',site_type:'store',created_at:'2026-10-26T00:00:00Z',published_at:'2026-10-27T00:00:00Z'}],stats:{scope:'public_stores',totalStores:1,totalThemes:10,totalProducts:5,totalOrders:0},pagination:{limit:12,has_more:false,next_cursor:null}});

test('actual landing SSR displays supplied counts immediately and uses the configured tenant root and authored theme name',()=>{
    const keys=['NEXT_PUBLIC_STORE_ROOT_DOMAIN','NEXT_PUBLIC_STOREFRONT_URL','NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES'] as const;
    const before=keys.map(key=>process.env[key]);
    try {
        process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN='example.invalid';
        process.env.NEXT_PUBLIC_STOREFRONT_URL='https://storefront.example.invalid';
        process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES='storefront.example.invalid';
        const document=new JSDOM(renderToStaticMarkup(<Landing stores={directory.stores} stats={directory.stats} directoryAvailable />)).window.document;
        assert.deepEqual([...document.querySelectorAll('.stat-value')].map(node=>node.textContent),['1','10','5','0']);
        assert.equal(document.querySelector('.store-card-visit')?.getAttribute('href'),'https://synthetic-public.example.invalid');
        assert.match(document.querySelector('.store-card-theme-badge')?.textContent??'',/Circuit/);
        assert.equal(document.querySelector('.store-card-owner'),null);
    } finally { keys.forEach((key,index)=>{if(before[index]===undefined)delete process.env[key];else process.env[key]=before[index];}); }
});

test('unavailable is distinct from a genuinely empty directory and never presents fabricated zero counts',()=>{
    const failed=new JSDOM(renderToStaticMarkup(<Landing stores={[]} stats={null} directoryAvailable={false} />)).window.document;
    assert.match(failed.querySelector('[role="alert"]')?.textContent??'',/temporarily unavailable/);
    assert.deepEqual([...failed.querySelectorAll('.stat-value')].map(node=>node.textContent),['—','—','—','—']);
    assert.doesNotMatch(failed.body.textContent??'',/No sites launched/);
    const empty=new JSDOM(renderToStaticMarkup(<Landing stores={[]} stats={{...directory.stats,totalStores:0,totalProducts:0}} directoryAvailable />)).window.document;
    assert.match(empty.body.textContent??'',/No sites launched/);
    assert.equal(empty.querySelector('[role="alert"]'),null);
});

test('the public contract rejects account/config fields instead of passing unknown private metadata through',()=>{
    assert.equal(StorefrontDirectoryPayloadSchema.safeParse({...directory,stores:[{...directory.stores[0],email:'synthetic-private@example.invalid'}]}).success,false);
    assert.equal(StorefrontDirectoryPayloadSchema.safeParse({...directory,stats:{...directory.stats,totalStores:-1}}).success,false);
});

test('mounted finder retires old-query results and reports unavailability without redirecting to an old store',async()=>{
    const BrowserDom=JSDOM as unknown as new(html:string,options:{url:string})=>{window:Window & {close():void}};
    const dom=new BrowserDom('<!doctype html><div id="root"></div>',{url:'https://directory.example.invalid'});
    const keys=['window','document','navigator','IS_REACT_ACT_ENVIRONMENT'] as const;
    const prior=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
    for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{configurable:true,value});
    const originalFetch=globalThis.fetch;
    const pending=new Map<string,{resolve:(response:Response)=>void;signal:AbortSignal|null|undefined}>();
    globalThis.fetch=(async(input,init)=>new Promise<Response>(resolve=>pending.set(new URL(String(input),'https://directory.example.invalid').searchParams.get('q')!,{resolve,signal:init?.signal}))) as typeof fetch;
    const root=createRoot(dom.window.document.getElementById('root')!);
    const type=async(value:string)=>{
        await act(async()=>finderInputOnChange!({target:{value}} as React.ChangeEvent<HTMLInputElement>));
        await act(async()=>{await new Promise(resolve=>setTimeout(resolve,450));});
    };
    try{
        await act(async()=>root.render(<Landing stores={[]} stats={directory.stats} directoryAvailable />));
        await type('alpha-shop');assert.ok(pending.has('alpha-shop'));
        await type('beta-shop');assert.ok(pending.has('beta-shop'));assert.equal(pending.get('alpha-shop')!.signal?.aborted,true);
        await act(async()=>pending.get('beta-shop')!.resolve(Response.json({status:'found',store:{name:'Beta shop',subdomain:'beta-shop',status:'published',siteType:'store'}})));
        assert.match(dom.window.document.querySelector('.status-found')?.textContent??'',/Beta shop/);
        await act(async()=>pending.get('alpha-shop')!.resolve(Response.json({status:'found',store:{name:'Old Alpha shop',subdomain:'alpha-shop',status:'published',siteType:'store'}})));
        assert.match(dom.window.document.querySelector('.status-found')?.textContent??'',/Beta shop/);
        assert.doesNotMatch(dom.window.document.body.textContent??'',/Old Alpha shop/);
        await type('unavailable-shop');
        await act(async()=>pending.get('unavailable-shop')!.resolve(Response.json({status:'unavailable'},{status:503})));
        assert.match(dom.window.document.querySelector('[role="alert"]')?.textContent??'',/temporarily unavailable/);
        assert.equal(dom.window.document.querySelector('.status-found'),null);
        assert.equal(dom.window.location.pathname,'/');
    }finally{
        await act(async()=>root.unmount());globalThis.fetch=originalFetch;
        keys.forEach((key,index)=>{if(prior[index])Object.defineProperty(globalThis,key,prior[index]!);else Reflect.deleteProperty(globalThis,key);});dom.window.close();
    }
});
