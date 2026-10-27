import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';

import { loadThemeServerDom } from '@letbuyy/theme-engine/server-dom';
type QaDom = { window: Window & typeof globalThis };
type QaDomConstructor = new (html?: string, options?: { url?: string }) => QaDom;
const requireApp = createRequire(new URL('../package.json', import.meta.url));
const site = '7b669c70-9000-4000-8000-000000000001';
const instance = '7b669c70-9000-4000-8000-000000000002';
const versionId = '7b669c70-9000-4000-8000-000000000003';
const packageId = '7b669c70-9000-4000-8000-000000000004';
const theme = { id: site, slug: 'letbuyy-sense', name: 'Threadline', version: '2.0.0', description: 'Editorial apparel', category: 'fashion', pricing_type: 'free', price_inr: 0, is_active: true, features: ['Garment facts'] };
const installReceipt = { theme: { id: site, slug: theme.slug, name: theme.name, version: theme.version }, theme_instance_id: instance, theme_package_id: packageId, theme_package_version_id: versionId, installed_version: theme.version, already_installed: false };
const catalog = { themes: [theme], total: 25, page: 2, limit: 12, has_more: true, storeId: site, categories: ['fashion'], selectedRuntime: { id: theme.id, slug: theme.slug, name: theme.name, renderer_key: theme.slug, theme_package_id: packageId, theme_package_version_id: versionId }, selectedRuntimeStatus: 'ready' };

async function mount(url: string, transport: (url: string, init?: RequestInit) => Promise<Response>, workspace = false) {
    const { JSDOM } = await loadThemeServerDom();
    const dom = new (JSDOM as unknown as QaDomConstructor)('<!doctype html><div id="root"></div>', { url: `http://localhost${url}` });
    const names = ['window', 'document', 'navigator', 'self', 'localStorage', 'MutationObserver', 'HTMLElement', 'Element', 'fetch', 'React', 'IS_REACT_ACT_ENVIRONMENT'];
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    for (const name of names.slice(0, 8)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'self' ? dom.window : Reflect.get(dom.window,name) });
    Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true, fetch: (input: RequestInfo | URL, init?: RequestInit) => transport(String(input), init) });
    const oldCss = requireApp.extensions['.css'];
    requireApp.extensions['.css'] = module => { module.exports = {}; };
    const { ThemeMarketplace } = await import('../src/components/theme-library/ThemeMarketplace');
    const { ThemeWorkspace } = await import('../src/components/theme-library/ThemeWorkspace');
    const { ToastProvider } = await import('@letbuyy/ui');
    const { createRoot } = await import('react-dom/client');
    const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js');
    const { PathParamsContext, SearchParamsContext, PathnameContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js');
    const root = createRoot(dom.window.document.getElementById('root')!);
    const pushes: string[] = [];
    const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push(value: string) { pushes.push(value); }, replace(value: string) { pushes.push(value); }, prefetch() {} };
    async function render(next = url) {
        const parsed = new URL(next, 'http://localhost');
        const store = parsed.pathname.split('/')[1];
        await act(async () => root.render(<AppRouterContext.Provider value={router}><PathParamsContext.Provider value={{ store }}><SearchParamsContext.Provider value={parsed.searchParams}><PathnameContext.Provider value={parsed.pathname}>{workspace ? <ToastProvider><ThemeWorkspace/></ToastProvider> : <ThemeMarketplace/>}</PathnameContext.Provider></SearchParamsContext.Provider></PathParamsContext.Provider></AppRouterContext.Provider>));
    }
    await render();
    return { render, pushes, document: dom.window.document,
        text: () => dom.window.document.body.textContent || '',
        async click(label: string, twice = false) { const button = [...dom.window.document.querySelectorAll('button')].find(node => node.textContent?.trim() === label); assert.ok(button, `Missing ${label}: ${dom.window.document.body.textContent}`); await act(async () => { button.click(); if (twice) button.click(); }); },
        async close() { await act(async () => root.unmount()); dom.window.close(); for (const [name, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); } if (oldCss) requireApp.extensions['.css'] = oldCss; else delete requireApp.extensions['.css']; },
    };
}

test('marketplace uses server totals and preserves combined filters when paging', async () => {
    const calls: string[] = [];
    const h = await mount('/sample-store/online-store/themes/marketplace?search=linen&category=fashion&page=2&sort=name', async url => { calls.push(url); return Response.json(catalog); });
    try {
        assert.match(h.text(), /25 themes/);
        assert.match(calls[0], /search=linen/); assert.match(calls[0], /page=2/);
        await h.click('Next');
        const next = new URL(h.pushes.at(-1)!, 'http://localhost');
        assert.equal(next.searchParams.get('page'), '3');
        assert.equal(next.searchParams.get('search'), 'linen');
        assert.equal(next.searchParams.get('category'), 'fashion');
        assert.equal(h.document.querySelectorAll('article').length, 1, 'one loaded page is not the total');
    } finally { await h.close(); }
});
test('direct detail outside the loaded page resolves its selected package and embeds the versioned canonical demo', async () => {
    const h = await mount('/sample-store/online-store/themes/marketplace?search=linen&theme=letbuyy-sense&view=demo', async () => Response.json({ ...catalog, themes: [], selectedTheme: theme, selectedThemeStatus: 'ready' }));
    try {
        assert.match(h.text(), /Threadline/);
        assert.match(h.text(), /Version 2.0.0/);
        const frame = h.document.querySelector('iframe'); assert.ok(frame);
        assert.match(frame.src, /theme-preview\/letbuyy-sense\?version=2.0.0/);
        const back = [...h.document.querySelectorAll('a')].find(node => node.textContent?.includes('Back to results'))!;
        assert.match(back.href, /search=linen/); assert.doesNotMatch(back.href, /theme=/);
    } finally { await h.close(); }
});
test('a catalog outage never renders no-match success', async () => {
    const h = await mount('/sample-store/online-store/themes/marketplace', async () => Response.json({ error: { message: 'Injected read failure' } }, { status: 503 }));
    try { assert.match(h.text(), /Theme catalog unavailable/); assert.match(h.text(), /Injected read failure/); assert.doesNotMatch(h.text(), /No themes match|0 themes/); }
    finally { await h.close(); }
});
test('Add has one pending intent, requires instance readback and opens that exact editor instance', async () => {
    let writes = 0;
    const h = await mount('/sample-store/online-store/themes/marketplace?theme=letbuyy-sense', async url => {
        if (url === '/api/themes/install') { writes++; return Response.json(installReceipt); }
        if (url.includes('/api/themes/library')) return Response.json({ data: { themes: [{ slug: theme.slug, instance_id: instance, instance_status: 'installed', theme_package_version_id: versionId }] } });
        return Response.json({ ...catalog, selectedTheme: theme, selectedThemeStatus: 'ready' });
    });
    try {
        await h.click('Add to library', true); assert.equal(writes, 1);
        assert.match(h.text(), /Theme added to your library/);
        const customize = [...h.document.querySelectorAll('a')].find(node => node.textContent === 'Customize theme'); assert.ok(customize);
        assert.match(customize.href, new RegExp(`theme_instance_id=${instance}`));
        assert.match(customize.href, new RegExp(`theme_package_version_id=${versionId}`));
    } finally { await h.close(); }
});
test('lost post-install readback preserves retry context and never announces added', async () => {
    const h = await mount('/sample-store/online-store/themes/marketplace?theme=letbuyy-sense', async url => {
        if (url === '/api/themes/install') return Response.json(installReceipt);
        if (url.includes('/api/themes/library')) return Response.json({ error: 'unavailable' }, { status: 503 });
        return Response.json({ ...catalog, selectedTheme: theme, selectedThemeStatus: 'ready' });
    });
    try { await h.click('Add to library'); assert.match(h.text(), /Add has not been confirmed/); assert.match(h.text(), /Retry Add/); assert.doesNotMatch(h.text(), /Theme added to your library|Customize theme/); }
    finally { await h.close(); }
});

test('a failed detail navigation never retains the previous theme or Add action', async () => {
    let read = 0;
    const h = await mount('/sample-store/online-store/themes/marketplace?theme=letbuyy-sense', async () => {
        read++;
        return read === 1 ? Response.json({ ...catalog, selectedTheme: theme, selectedThemeStatus: 'ready' }) : Response.json({ error: { message: 'Second theme unavailable' } }, { status: 503 });
    });
    try {
        assert.match(h.text(), /Threadline/);
        await h.render('/sample-store/online-store/themes/marketplace?theme=letbuyy-aura');
        assert.match(h.text(), /Second theme unavailable/);
        assert.doesNotMatch(h.text(), /Editorial apparel|Add to library/);
    } finally { await h.close(); }
});
test('out-of-order selected detail identity cannot create an Add action', async () => {
    const h = await mount('/sample-store/online-store/themes/marketplace?theme=letbuyy-aura', async () => Response.json({ ...catalog, selectedTheme: theme, selectedThemeStatus: 'ready' }));
    try { assert.doesNotMatch(h.text(), /Editorial apparel|Add to library/); }
    finally { await h.close(); }
});

test('unconfirmed package metadata keeps demo details available while Add is disabled', async () => {
    let writes = 0;
    const h = await mount('/sample-store/online-store/themes/marketplace?theme=letbuyy-sense', async url => {
        if (url === '/api/themes/install') writes++;
        return Response.json({ ...catalog, selectedTheme: theme, selectedThemeStatus: 'ready', selectedRuntime: null, selectedRuntimeStatus: 'unavailable' });
    });
    try {
        assert.match(h.text(), /Threadline/); assert.match(h.text(), /Package details unavailable/);
        const add = [...h.document.querySelectorAll('button')].find(button => button.textContent === 'Add to library')!;
        assert.ok(add.disabled); await h.click('Add to library'); assert.equal(writes, 0);
        assert.ok([...h.document.querySelectorAll('a')].some(link => link.textContent === 'View demo'));
    } finally { await h.close(); }
});

for (const visibility of [
    { label: 'unpublished', published: false, status: 'draft', access_mode: 'public', embedded: false },
    { label: 'private published', published: true, status: 'published', access_mode: 'preview_only', embedded: false },
    { label: 'public published', published: true, status: 'published', access_mode: 'public', embedded: true },
    { label: 'visibility unavailable', published: true, status: 'published', access_mode: 'public', embedded: false, unavailable: true },
]) test(`current-theme hero uses live scoped visibility: ${visibility.label}`, async () => {
    const h = await mount('/sample-store/online-store/themes', async url => {
        if (url.includes('/access')) return visibility.unavailable
            ? Response.json({ error: { message: 'Synthetic visibility outage' } }, { status: 503 })
            : Response.json({ data: { ...visibility, access_message: null, has_password: false } });
        if (url.includes('/library')) return Response.json({ data: { themes: [] } });
        return Response.json({ themes: [theme], currentTheme: theme, storeId: site, storeStatus: visibility.status });
    }, true);
    try {
        assert.equal(Boolean(h.document.querySelector('iframe[title="Current storefront"]')), visibility.embedded);
        if (!visibility.embedded) assert.match(h.text(), /Open the theme editor to preview your saved design/);
        assert.match(h.text(), /Threadline/);
    } finally { await h.close(); }
});


for (const artwork of [
 {version:'2.0.0',original:'/theme-previews/forge.svg',expected:'/theme-previews/catalog-v2/circuit.webp'},
 {version:'1.0.0',original:'/theme-previews/forge.svg',expected:'/theme-previews/forge.svg'},
 {version:undefined,original:'/theme-previews/forge.svg',expected:'/theme-previews/forge.svg'},
 {version:'2.0.0',original:'https://custom.example.invalid/captured-design.webp',expected:'https://custom.example.invalid/captured-design.webp'},
]) test(`installed library artwork honors its captured version and custom override: ${artwork.version}/${artwork.original}`,async()=>{
 const circuit={...theme,slug:'letbuyy-forge',name:'Circuit'};
 const h=await mount('/sample-store/online-store/themes',async url=>{
  if(url.includes('/access'))return Response.json({data:{published:false,status:'draft',access_mode:'public',access_message:null,has_password:false}});
  if(url.includes('/library'))return Response.json({data:{themes:[{slug:circuit.slug,name:circuit.name,version:artwork.version,thumbnail_url:artwork.original,instance_status:'installed',installed_at:'2026-10-27T00:00:00Z',last_published_at:null,last_modified_at:'2026-10-27T00:00:00Z',hasDraft:true,isCurrentlyPublished:false,updateAvailable:false,theme_package_version_id:versionId}]}});
  return Response.json({themes:[circuit],currentTheme:circuit,storeId:site,storeStatus:'draft'});
 },true);
 try{const image=h.document.querySelector('img[alt="Circuit design preview"]');assert.ok(image);assert.equal(image.getAttribute('src'),artwork.expected);assert.match(h.text(),/Saved draft/);}finally{await h.close();}
});

test('a public overview frame uses the allowed Commerce platform origin while View store keeps the buyer hostname',async()=>{
 const names: string[]=['NEXT_PUBLIC_STOREFRONT_URL','NEXT_PUBLIC_STORE_ROOT_DOMAIN','NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES','NODE_ENV'];
 const prior=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 Object.assign(process.env,{NEXT_PUBLIC_STOREFRONT_URL:'https://storefront.stores.example.test',NEXT_PUBLIC_STORE_ROOT_DOMAIN:'stores.example.test',NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES:'storefront.stores.example.test',NODE_ENV:'production'});
 try{
  const h=await mount('/sample-store/online-store/themes',async url=>{
   if(url.includes('/access'))return Response.json({data:{published:true,status:'published',access_mode:'public',access_message:null,has_password:false}});
   if(url.includes('/library'))return Response.json({data:{themes:[]}});
   return Response.json({themes:[theme],currentTheme:theme,storeId:site,storeStatus:'published'});
  },true);
  try{
   const frame=h.document.querySelector<HTMLIFrameElement>('iframe[title="Current storefront"]');assert.ok(frame);
   assert.equal(frame.src,'https://storefront.stores.example.test/store/sample-store');
   const view=[...h.document.querySelectorAll('a')].find(a=>a.textContent?.includes('View store'));assert.ok(view);
   assert.equal(new URL(view.href).hostname,'sample-store.stores.example.test');
   assert.equal(frame.getAttribute('sandbox'),'allow-scripts allow-same-origin allow-forms');
  }finally{await h.close();}
 }finally{for(const name of names){if(prior[name]===undefined)delete process.env[name];else process.env[name]=prior[name];}}
});
