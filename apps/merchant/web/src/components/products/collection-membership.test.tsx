// Real maintained page + Next/security/UI contexts. All HTTP data below is an
// explicit synthetic client seam; this is not Gateway, database or login proof.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'
const requireUI = createRequire(new URL('../../../../../../packages/typescript/ui/package.json', import.meta.url))
const { JSDOM } = requireUI('jsdom')
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })
const cid = '11111111-1111-4111-8111-111111111111', otherCid = '11111111-1111-4111-8111-111111111112'
const pid = '22222222-2222-4222-8222-222222222222', laterPid = '22222222-2222-4222-8222-222222222223'
const siteId = '33333333-3333-4333-8333-333333333333', actorId = '44444444-4444-4444-8444-444444444444'
const product = (id = pid, name = 'Synthetic assigned product') => ({ id, name, price: 10, is_active: true })
const collections = [{ id: cid, title: 'Synthetic collection', is_active: true }, { id: otherCid, title: 'Second collection', is_active: true }]
const snapshot = (version = 7, ids = [pid], id = cid) => ({ collection_id: id, store_id: siteId,
    membership_version: version, product_ids: ids, products: ids.map(value => product(value)), unavailable_product_ids: [] })
const response = (data: unknown, status = 200, meta?: unknown) => new Response(JSON.stringify(status < 400 ? { success: true, data: data === collections ? collections.map(row => ({ ...row, store_id: siteId, description: null, created_at: '2026-10-25T00:00:00Z', membership_version: 7, product_count: 1 })) : data, ...(meta ? { meta } : data === collections ? { meta: { page: 1, per_page: 20, total: collections.length, total_pages: 1, has_next: false, has_prev: false } } : {}) } : { error: { code: 'SYNTHETIC_FAILURE', message: 'Synthetic membership read failed' } }),
    { status, headers: { 'Content-Type': 'application/json' } })
const choices = (data = [product()], hasNext = false, page = 1) => response(data, 200, { page, per_page: 100, has_next: hasNext, total: hasNext ? 101 : data.length })
type Transport = (url: string, init?: RequestInit) => Promise<Response>
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
async function mount(transport: Transport) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/alpha/products/collections', pretendToBeVisual: true })
    const names = ['window', 'document', 'navigator', 'self', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'fetch']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names.filter(name => name !== 'fetch')) {
        const value = name === 'window' || name === 'self' ? dom.window : dom.window[name]
        Object.defineProperty(globalThis, name, { configurable: true, writable: true,
            value: ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(name) ? value.bind(dom.window) : value })
    }
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => transport(String(input), init)) as typeof fetch
    const { createRoot } = await import('react-dom/client')
    const { PathParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js')
    const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js')
    const { ToastProvider } = await import('@letbuyy/ui')
    const { MerchantSecurityContext } = await import('../security/MerchantSecurityContext')
    const { default: CollectionsPage } = await import('../../app/[store]/products/collections/page')
    const container = dom.window.document.getElementById('root')!, root = createRoot(container)
    const router = { bfcacheId: \'synthetic-router-cache\',  back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} }
    let key = 0
    const render = async (store = 'alpha', actor = actorId) => { await act(async () => root.render(
        <AppRouterContext.Provider value={router}><PathParamsContext.Provider value={{ store }}><ToastProvider duration={0}>
            <MerchantSecurityContext.Provider value={{ actorId: actor, store, siteId }}><CollectionsPage key={key} /></MerchantSecurityContext.Provider>
        </ToastProvider></PathParamsContext.Provider></AppRouterContext.Provider>)) }
    await render()
    const text = () => container.textContent || ''
    const button = (name: string, index = 0) => {
        const buttons = [...container.querySelectorAll('button')].filter((item: any) => item.textContent.trim() === name)
        assert.ok(buttons[index], 'Missing maintained page control ' + name + ': ' + text())
        return buttons[index] as HTMLButtonElement
    }
    const click = async (name: string, index = 0) => { await act(async () => { button(name, index).click() }) }
    const checkbox = (name: string) => {
        const label = [...container.querySelectorAll('label')].find(item => item.textContent?.includes(name) && item.querySelector('input[type="checkbox"]'))
        assert.ok(label, 'Missing maintained product checkbox ' + name)
        return label.querySelector('input[type="checkbox"]') as HTMLInputElement
    }
    const toggle = async (name: string) => { await act(async () => checkbox(name).click()) }
    const close = async () => {
        await act(async () => root.unmount()); dom.window.close()
        for (const name of names) { if (previous[name]) Object.defineProperty(globalThis, name, previous[name]!); else Reflect.deleteProperty(globalThis, name) }
    }
    const dialogClick = async (name: string) => {
        const control = [...dom.window.document.querySelectorAll('[role="dialog"] button')].find(item => item.textContent?.trim() === name)
        assert.ok(control, 'Missing maintained dialog control ' + name)
        await act(async () => { (control as HTMLButtonElement).click() })
    }
    return { container, text, button, click, dialogClick, checkbox, toggle, render, remount: async () => { key++; await render() }, storage: dom.window.sessionStorage, close }
}
function base(url: string) { return /\/collections(?:\?|$)/.test(url) ? response(collections) : url.includes('/collections/') ? response(snapshot()) : choices() }

test('normal collection list discovers retained membership recovery when its live row was deleted', async () => {
    const h = await mount(async () => response([], 200, {page:1,per_page:20,total:0,total_pages:0,has_next:false,has_prev:false}));
    try {
        h.storage.setItem(`letbuyy.collection-membership.v1:${actorId}:alpha:${cid}`, JSON.stringify({
            actorId, store:'alpha', storeId:siteId, collectionId:cid,
            command:{product_ids:[pid],expected_version:7,idempotency_key:otherCid},
        }));
        await h.remount();
        assert(h.button('Retry saved product selection'));
    } finally { await h.close() }
});

for (const code of ['COLLECTION_MEMBERSHIP_KEY_CONFLICT', 'COLLECTION_MEMBERSHIP_LEGACY_KEY']) {
    test(`${code} cannot release an unconfirmed original selection as a stale-version review`, async () => {
        const h = await mount(async (url, init) => init?.method === 'PUT'
            ? Response.json({error:{code,message:'Synthetic original outcome is uncertain'}},{status:409}) : base(url));
        try {
            await h.click('Manage products');await h.click('Save products');
            assert.doesNotMatch(h.text(), /Reload current products/);
            assert(h.storage.getItem(`letbuyy.collection-membership.v1:${actorId}:alpha:${cid}`));
        } finally { await h.close() }
    });
}
test('a current owner denial removes private product-selection rows and keeps original recovery', async () => {
    const h = await mount(async (url, init) => init?.method === 'PUT'
        ? Response.json({error:{code:'FORBIDDEN',message:'Synthetic owner revoked'}},{status:403}) : base(url));
    try {
        await h.click('Manage products');assert(h.text().includes(product().name));await h.click('Save products');
        assert(!h.text().includes(product().name), 'Private selection rows must retire after current authority is withdrawn.');
        assert(h.storage.getItem(`letbuyy.collection-membership.v1:${actorId}:alpha:${cid}`));
    } finally { await h.close() }
});

test('a failed membership read never becomes an intentional empty save; explicit retry restores current selection', async () => {
    let reads = 0, puts = 0
    const h = await mount(async (url, init) => {
        if (init?.method === 'PUT') { puts++; return response(null, 503) }
        if (url.includes('/collections/' + cid + '/products')) return ++reads === 1 ? response(null, 503) : response(snapshot())
        return base(url)
    })
    try {
        await h.click('Manage products'); assert.equal(h.button('Save products').disabled, true)
        assert.match(h.text(), /Could not load collection products/); await h.click('Save products'); assert.equal(puts, 0)
        await h.click('Retry products'); assert.equal(reads, 2); assert.equal(h.checkbox(product().name).checked, true)
        assert.equal(h.button('Save products').disabled, false); assert.doesNotMatch(h.text(), /Could not load collection products/)
    } finally { await h.close() }
})
test('choice-read HTTP errors and malformed or wrong-collection snapshots fence Save without PUT', async () => {
    for (const mode of ['choices-fail', 'missing-version', 'wrong-collection']) {
        let puts = 0
        const h = await mount(async (url, init) => {
            if (init?.method === 'PUT') { puts++; return response(null, 503) }
            if (/\/collections(?:\?|$)/.test(url)) return response(collections)
            if (url.includes('/collections/')) return response(mode === 'missing-version' ? { collection_id: cid, product_ids: [] } : snapshot(7, [pid], mode === 'wrong-collection' ? otherCid : cid))
            return mode === 'choices-fail' ? response(null, 503) : choices()
        })
        try { await h.click('Manage products'); assert.equal(h.button('Save products').disabled, true, mode); await h.click('Save products'); assert.equal(puts, 0) }
        finally { await h.close() }
    }
})
test('existing page pagination stays <=100 and preserves an assigned product outside the loaded choices', async () => {
    const requests: string[] = [], commands: any[] = []
    const h = await mount(async (url, init) => {
        if (init?.method === 'PUT') { commands.push(JSON.parse(String(init.body))); return response(snapshot(19, commands[0].product_ids)) }
        if (/\/collections(?:\?|$)/.test(url)) return response(collections)
        if (url.includes('/collections/')) return response(snapshot())
        requests.push(url); return url.includes('page=2') ? choices([product(laterPid, 'Later page choice')], false, 2) : choices([product('22222222-2222-4222-8222-222222222224', 'First page choice')], true)
    })
    try {
        await h.click('Manage products'); await h.click('Load more products'); await h.toggle('Later page choice'); await h.click('Save products')
        assert.equal(requests.length, 2); assert.ok(requests.every(url => Number(new URL(url, 'https://synthetic.invalid').searchParams.get('limit')) <= 100))
        assert.deepEqual(commands[0].product_ids, [pid, laterPid]); assert.equal(commands[0].expected_version, 7)
    } finally { await h.close() }
})
test('an uncertain command survives remount with exactly its original actor, version, order and key', async () => {
    const commands: { body: any; headers: Headers }[] = []
    const h = await mount(async (url, init) => {
        if (init?.method === 'PUT') { const body = JSON.parse(String(init.body)); commands.push({ body, headers: new Headers(init.headers) }); return commands.length === 1 ? response(null, 503) : response(snapshot(24, body.product_ids)) }
        return base(url)
    })
    try {
        await h.click('Manage products'); await h.toggle(product().name); await h.click('Save products')
        assert.match(h.text(), /could not be confirmed/i); assert.equal(commands.length, 1)
        await h.remount(); await h.click('Manage products'); await h.click('Retry same save'); assert.equal(commands.length, 2)
        assert.deepEqual(commands[1].body, commands[0].body); assert.deepEqual(commands[0].body.product_ids, [])
        assert.equal(commands[0].body.expected_version, 7); assert.match(commands[0].body.idempotency_key, /^[0-9a-f-]{36}$/i)
        for (const c of commands) { assert.equal(c.headers.get('X-Idempotency-Key'), c.body.idempotency_key); assert.equal(c.headers.get('X-LetBuyy-Merchant-Context'), actorId) }
        assert.equal(h.storage.length, 0)
    } finally { await h.close() }
})
test('a stale revision is visible, keeps the selection and requires explicit reload without automatic rebase', async () => {
    let puts = 0, reads = 0
    const h = await mount(async (url, init) => {
        if (init?.method === 'PUT') { puts++; return new Response(JSON.stringify({ error: { code: 'COLLECTION_MEMBERSHIP_VERSION_CONFLICT', message: 'Collection membership changed. Reload the current collection.' } }), { status: 409, headers: { 'Content-Type': 'application/json' } }) }
        if (url.includes('/collections/')) { reads++; return response(snapshot(reads === 1 ? 7 : 9)) }
        return base(url)
    })
    try {
        await h.click('Manage products'); await h.toggle(product().name); await h.click('Save products')
        assert.equal(puts, 1); assert.match(h.text(), /membership changed/i); assert.equal(h.checkbox(product().name).checked, false)
        assert.equal(h.button('Save products').disabled, true); await h.click('Reload current products')
        assert.equal(reads, 2); assert.equal(h.checkbox(product().name).checked, true); assert.equal(puts, 1)
    } finally { await h.close() }
})
test('late collection and actor-context responses cannot populate a different active edit', async () => {
    const pending = deferred<Response>()
    const h = await mount(async url => url.includes('/collections/' + cid + '/') ? pending.promise : url.includes('/collections/' + otherCid + '/') ? response(snapshot(12, [], otherCid)) : base(url))
    try {
        await h.click('Manage products', 0); await h.click('Cancel'); await h.click('Manage products', 1)
        assert.match(h.text(), /Manage products — Second collection/)
        await act(async () => pending.resolve(response(snapshot()))); assert.equal(h.checkbox(product().name).checked, false)
        await h.render('beta', '55555555-5555-4555-8555-555555555555')
        assert.doesNotMatch(h.text(), /Manage products — Second collection/)
    } finally { pending.resolve(response(snapshot())); await h.close() }
})
test('a malformed save response remains uncertain and a new actor never replays the prior actor intent', async () => {
    let puts = 0
    const h = await mount(async (url, init) => init?.method === 'PUT' ? (puts++, response({ collection_id: otherCid, product_ids: [] })) : base(url))
    try {
        await h.click('Manage products'); await h.click('Save products'); assert.match(h.text(), /could not be confirmed/i)
        await h.render('alpha', '55555555-5555-4555-8555-555555555555'); await h.click('Manage products')
        assert.equal(puts, 1); assert.doesNotMatch(h.text(), /Retry same save/)
    } finally { await h.close() }
})

test('explicit unavailable assignment is visible and is removed only by the owner choice',async()=>{
    const commands:any[]=[]
    const h=await mount(async(url,init)=>{
        if(init?.method==='PUT'){const body=JSON.parse(String(init.body));commands.push(body);return response(snapshot(11,body.product_ids))}
        if(url.includes('/collections/'))return response({...snapshot(),products:[],unavailable_product_ids:[pid]})
        if(/\/collections(?:\?|$)/.test(url))return response(collections)
        return choices([])
    })
    try{await h.click('Manage products');assert.equal(h.checkbox('Unavailable assigned product').checked,true);assert.equal(commands.length,0);await h.toggle('Unavailable assigned product');await h.click('Save products');assert.deepEqual(commands[0].product_ids,[]);assert.equal(commands[0].expected_version,7)}
    finally{await h.close()}
})


test('an unmounted membership reply cannot clear a newer mounted editor pending command',async()=>{
    const oldReply=deferred<Response>(),newReply=deferred<Response>(),calls:any[]=[];let current=snapshot();
    const h=await mount(async(url,init)=>{
        if(init?.method==='PUT'){
            const body=JSON.parse(String(init.body));calls.push(body);
            if(calls.length===1){current=snapshot(19,body.product_ids);return oldReply.promise}
            if(calls.length===2)return response(snapshot(19,body.product_ids));
            current=snapshot(29,body.product_ids);return newReply.promise;
        }
        if(/\/collections(?:\?|$)/.test(url))return response(collections);
        if(url.includes('/collections/'))return response(current);
        return choices();
    });
    const storageKey=`letbuyy.collection-membership.v1:${actorId}:alpha:${cid}`;
    try{
        await h.click('Manage products');await h.toggle(product().name);await h.click('Save products');assert.equal(calls.length,1);
        await h.remount();await h.click('Manage products');await h.click('Retry same save');assert.equal(calls.length,2);assert.deepEqual(calls[1],calls[0]);
        await h.click('Manage products');await h.toggle(product().name);await h.click('Save products');assert.equal(calls.length,3);
        const retained=h.storage.getItem(storageKey);assert.ok(retained);assert.equal(JSON.parse(retained).command.idempotency_key,calls[2].idempotency_key);
        await act(async()=>{oldReply.resolve(response(snapshot(19,calls[0].product_ids)));await Promise.resolve()});
        console.info('MEMBERSHIP_UNMOUNTED_REPLY_WITNESS '+JSON.stringify({scope:'real membership afterimage with synthetic HTTP only',puts:calls.length,exactOldRetry:JSON.stringify(calls[0])===JSON.stringify(calls[1]),newRecoveryBefore:!!retained,newRecoveryAfter:!!h.storage.getItem(storageKey),actualBackendCalls:0,databaseLossProven:false}));
        assert.equal(h.storage.getItem(storageKey),retained,'Late old component acknowledgement must leave newer pending command byteexact');
    }finally{oldReply.resolve(response(snapshot(19,[])));newReply.resolve(response(current));await act(async()=>{await Promise.resolve()});await h.close()}
});

const retainedKey = `letbuyy.collection-membership.v1:${actorId}:alpha:${cid}`
const retainedSelection = () => ({ actorId, store:'alpha', storeId:siteId, collectionId:cid,
    command:{product_ids:[pid],expected_version:7,idempotency_key:otherCid} })
const emptyCollectionList = () => response([],200,{page:1,per_page:20,total:0,total_pages:0,has_next:false,has_prev:false})
const missingMembership = () => Response.json({error:{code:'COLLECTION_MEMBERSHIP_NOT_FOUND',message:'Synthetic canonical target missing'}},{status:404})

test('a deleted-row recovery retries the original command and accepts its original receipt', async () => {
    const commands: {url:string; body:unknown; headers:Headers}[]=[]
    const h=await mount(async(url,init)=>{
        if(init?.method==='PUT'){commands.push({url,body:JSON.parse(String(init.body)),headers:new Headers(init.headers)});return response(snapshot(8))}
        return emptyCollectionList()
    })
    try{
        h.storage.setItem(retainedKey,JSON.stringify(retainedSelection()));await h.remount();assert.doesNotMatch(h.text(),/Synthetic assigned product/)
        await h.click('Retry saved product selection');assert.equal(commands.length,1);assert.deepEqual(commands[0].body,retainedSelection().command)
        assert.equal(commands[0].headers.get('X-LetBuyy-Merchant-Context'),actorId);assert.equal(commands[0].headers.get('X-Idempotency-Key'),otherCid)
        assert.equal(h.storage.getItem(retainedKey),null);assert.match(h.text(),/Original product selection confirmed/)
    }finally{await h.close()}
})
test('a store URL rename discovers the stable-site selection and retries through the new URL',async()=>{
    const requests:string[]=[]
    const h=await mount(async(url,init)=>{if(init?.method==='PUT'){requests.push(url);return response(snapshot(8))}return emptyCollectionList()})
    try{
        h.storage.setItem(retainedKey,JSON.stringify(retainedSelection()));await h.render('renamed-alpha')
        await h.click('Retry saved product selection');assert.deepEqual(requests,[`/api/stores/renamed-alpha/collections/${cid}/products`]);assert.equal(h.storage.getItem(retainedKey),null)
    }finally{await h.close()}
})
test('other actors and sites stay private while malformed matching recovery blocks a new save',async()=>{
    let puts=0;const h=await mount(async(url,init)=>{if(init?.method==='PUT'){puts++;return response(snapshot(8))}return base(url)})
    try{
        const otherActor='55555555-5555-4555-8555-555555555555',otherSite='66666666-6666-4666-8666-666666666666'
        const otherActorKey=`letbuyy.collection-membership.v1:${otherActor}:alpha:${cid}`
        h.storage.setItem(otherActorKey,JSON.stringify({...retainedSelection(),actorId:otherActor}))
        h.storage.setItem(retainedKey,JSON.stringify({...retainedSelection(),storeId:otherSite}));await h.remount();assert.doesNotMatch(h.text(),/Retry saved product selection/)
        assert(h.storage.getItem(retainedKey));assert(h.storage.getItem(otherActorKey))
        h.storage.setItem(retainedKey,'{malformed matching original');await h.remount();await h.click('Manage products')
        assert.equal(h.button('Save products').disabled,true);assert.doesNotMatch(h.text(),/Discard saved recovery/)
        await h.click('Save products');assert.equal(puts,0);assert.equal(h.storage.getItem(retainedKey),'{malformed matching original')
    }finally{await h.close()}
})
for(const status of [404,503])test(`generic${status} after deletion cannot release an original selection`,async()=>{
    const h=await mount(async(_url,init)=>init?.method==='PUT'?response(null,status):emptyCollectionList())
    try{
        h.storage.setItem(retainedKey,JSON.stringify(retainedSelection()));await h.remount();await h.click('Retry saved product selection')
        assert.doesNotMatch(h.text(),/Discard rejected product selection/);assert(h.storage.getItem(retainedKey))
    }finally{await h.close()}
})
test('a same-version response cannot acknowledge an original membership effect',async()=>{
    const h=await mount(async(_url,init)=>init?.method==='PUT'?response(snapshot(7)):emptyCollectionList())
    try{
        h.storage.setItem(retainedKey,JSON.stringify(retainedSelection()));await h.remount();await h.click('Retry saved product selection')
        assert(h.storage.getItem(retainedKey));assert.match(h.text(),/receipt could not be confirmed/)
    }finally{await h.close()}
})
test('missing recovery survives remount and Cancel, then rechecks original command before explicit dismissal',async()=>{
    const commands:unknown[]=[]
    const h=await mount(async(_url,init)=>{if(init?.method==='PUT'){commands.push(JSON.parse(String(init.body)));return missingMembership()}return emptyCollectionList()})
    try{
        h.storage.setItem(retainedKey,JSON.stringify(retainedSelection()));await h.remount();await h.click('Retry saved product selection')
        assert.equal(JSON.parse(h.storage.getItem(retainedKey)!).outcome,'missing');await h.remount()
        await h.click('Discard rejected product selection');await h.dialogClick('Cancel');assert(h.storage.getItem(retainedKey));assert.equal(commands.length,1)
        await h.click('Discard rejected product selection');await h.dialogClick('Discard selection')
        assert.equal(commands.length,2);assert.deepEqual(commands[0],retainedSelection().command);assert.deepEqual(commands[1],commands[0])
        assert.equal(h.storage.getItem(retainedKey),null);assert.match(h.text(),/Rejected product selection discarded/)
    }finally{await h.close()}
})
for(const last of ['outage','denial','receipt'])test(`missing dismissal handles current ${last} without fabricating rejection`,async()=>{
    let puts=0
    const h=await mount(async(_url,init)=>{
        if(init?.method==='PUT'){
            if(++puts===1)return missingMembership()
            return last==='receipt'?response(snapshot(8)):Response.json({error:{code:last==='denial'?'FORBIDDEN':'UNAVAILABLE'}},{status:last==='denial'?403:503})
        }
        return emptyCollectionList()
    })
    try{
        h.storage.setItem(retainedKey,JSON.stringify(retainedSelection()));await h.remount();await h.click('Retry saved product selection')
        await h.click('Discard rejected product selection');await h.dialogClick('Discard selection');assert.equal(puts,2)
        if(last==='receipt'){assert.equal(h.storage.getItem(retainedKey),null);assert.match(h.text(),/Original product selection confirmed/);assert.doesNotMatch(h.text(),/Rejected product selection discarded/)}
        else{assert(h.storage.getItem(retainedKey));assert.doesNotMatch(h.text(),/Rejected product selection discarded/)}
        if(last==='denial')assert.match(h.text(),/Store access changed/)
    }finally{await h.close()}
})
test('stale review requires a fresh authorized read before releasing its original request',async()=>{
    let reads=0
    const h=await mount(async(url,init)=>{
        if(init?.method==='PUT')return Response.json({error:{code:'COLLECTION_MEMBERSHIP_VERSION_CONFLICT'}},{status:409})
        if(url.includes('/collections/'))return ++reads===1?response(snapshot()):Response.json({error:{code:'FORBIDDEN'}},{status:403})
        return base(url)
    })
    try{
        await h.click('Manage products');await h.click('Save products');const retained=h.storage.getItem(retainedKey);assert(retained)
        await h.click('Reload current products');assert.match(h.text(),/Store access changed/);assert.equal(h.storage.getItem(retainedKey),retained);assert.doesNotMatch(h.text(),/Synthetic assigned product/)
    }finally{await h.close()}
})
test('a current list denial retires private views and a late successful write cannot clear retained recovery',async()=>{
    const reply=deferred<Response>();let lists=0
    const h=await mount(async(url,init)=>{
        if(init?.method==='PUT')return reply.promise
        if(/\/collections(?:\?|$)/.test(url)&&++lists>1)return Response.json({error:{code:'FORBIDDEN'}},{status:403})
        return base(url)
    })
    try{
        await h.click('Manage products');await h.click('Save products');const retained=h.storage.getItem(retainedKey);assert(retained)
        await h.click('Refresh');assert.match(h.text(),/Store access changed/);assert.doesNotMatch(h.text(),/Synthetic assigned product/)
        await act(async()=>reply.resolve(response(snapshot(8))));assert.equal(h.storage.getItem(retainedKey),retained);assert.doesNotMatch(h.text(),/Products updated/)
    }finally{reply.resolve(response(snapshot(8)));await h.close()}
})
