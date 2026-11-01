import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'
import {prepareWarehouseCommand} from '@letbuyy/shared-types'

const requireUI = createRequire(new URL('../../../../packages/typescript/ui/package.json', import.meta.url))
const { JSDOM } = requireUI('jsdom')
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })
const json = (data: unknown, status = 200) => Response.json({ data }, { status })
function warehouseResponse(url:string,data:unknown,status=200) {
    const detail=/\/(?:purchase-orders|transfers)\/([^/?]+)$/.exec(url);
    if(detail&&Array.isArray(data))return json(data.find(row=>row&&typeof row==='object'&&'id'in row&&row.id===decodeURIComponent(detail[1])),status);
    if(!/\/(purchase-orders|transfers|inventory-locations|suppliers)\?/.test(url))return json(data,status);
    const query=new URL(url,'http://localhost').searchParams;
    return Response.json({data,meta:{store_id:url.includes('/alpha/')?historySite:'22222222-2222-4222-8222-222222222222',
        page:Number(query.get('page')??1),per_page:Number(query.get('limit')??20),total:Array.isArray(data)?data.length:0,
        has_next:false,total_is_exact:true}},{status});
}

function locationOption(index:number,site=historySite) {
    return {id:`00000000-0000-4000-8000-${String(index).padStart(12,'0')}`,store_id:site,name:index===1?'A':'B',
        status:'active',is_default:index===1,address:{},created_at:'2026-11-01T00:00:00Z'};
}

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
const contentPages = {
    categories: () => import('../src/app/[store]/categories/page'),
    certifications: () => import('../src/app/[store]/certifications/page'),
    comments: () => import('../src/app/[store]/comments/page'),
    contact: () => import('../src/app/[store]/contact/page'),
    coupons: () => import('../src/app/[store]/coupons/page'),
    education: () => import('../src/app/[store]/education/page'),
    experience: () => import('../src/app/[store]/experience/page'),
    gallery: () => import('../src/app/[store]/gallery/page'),
    leads: () => import('../src/app/[store]/leads/page'),
    pages: () => import('../src/app/[store]/pages/page'),
    posts: () => import('../src/app/[store]/posts/page'),
    projects: () => import('../src/app/[store]/projects/page'),
    reviews: () => import('../src/app/[store]/reviews/page'),
    skills: () => import('../src/app/[store]/skills/page'),
    testimonials: () => import('../src/app/[store]/testimonials/page'),
}
const readPages = {
    locations:()=>import('../src/app/[store]/products/locations/page'),
    suppliers:()=>import('../src/app/[store]/products/suppliers/page'),
    ...contentPages,
    aiStudio: () => import('../src/app/[store]/ai/page'),
    operationsDashboard: () => import('../src/app/[store]/products/operations-dashboard/page'),
    exportPage: () => import('../src/app/[store]/export/page'),
    generalSettings: () => import('../src/app/[store]/settings/general/page'),
    checkoutSettings: () => import('../src/app/[store]/settings/checkout/page'),
    policySettings: () => import('../src/app/[store]/settings/policies/page'),
    notificationSettings: () => import('../src/app/[store]/settings/notifications/page'),
    businessSettings: () => import('../src/app/[store]/settings/business/page'),
    storefrontPages: () => import('../src/app/[store]/online-store/pages/page'),
    segments: () => import('../src/app/[store]/customers/segments/page'),
    inventory: () => import('../src/app/[store]/products/inventory/page'),
    inventoryHistory: () => import('../src/app/[store]/products/inventory-history/page'),
    inventoryReservations: () => import('../src/app/[store]/products/reservations/page'),
    inventoryReceipts: () => import('../src/app/[store]/products/receipts/page'),
    planSettings: () => import('../src/app/[store]/settings/plan/page'),
    themeUpdate: () => import('../src/app/[store]/online-store/themes/update/UpdatePageClient'),

}

test('AI Studio renders the authoritative balance, all credit sources and canonical usage fields', async () => {
    const h=await mount('aiStudio',async()=>json({credits:{store_id:'11111111-1111-4111-8111-111111111111',
        plan_credits:3000,bonus_credits:10,total_purchased:20,total_used:2206,balance:824},
        usage:[{id:'22222222-2222-4222-8222-222222222222',feature:'custom',tokens_input:10,tokens_output:7,credits_used:2,created_at:null}]}));
    try {
        assert.match(h.text(),/Credits remaining824/);
        assert.match(h.text(),/3,030 total credits/);
        assert.match(h.text(),/Latest 20 AI usage events/);
        assert.doesNotMatch(h.text(),/NaN|Invalid Date/);
        assert.match(h.text(),/custom17/);
    } finally {await h.close()}
});

const historySite = '11111111-1111-4111-8111-111111111111'
const historyRecord = (name = 'Synthetic history') => ({
    id: '22222222-2222-4222-8222-222222222222', store_id: historySite,
    product_id: '33333333-3333-4333-8333-333333333333',
    location_id: '44444444-4444-4444-8444-444444444444',
    quantity_change: -2, reason: 'damaged', note: 'Synthetic history note',
    created_at: '2026-10-01T00:00:00Z', products: { name, store_id: historySite },
})
const historyResponse = (rows: unknown[], page = 1, total = rows.length) => Response.json({
    data: rows, meta: { total, page, per_page: 20, has_next: page * 20 < total, store_id: historySite },
})
const reservationRecord = (name = 'Private reserved product') => ({
    ...historyRecord(name), quantity: 3, status: 'hold', expires_at: '2026-11-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
})
const receiptRecord = (type: 'purchase_order' | 'transfer' = 'purchase_order') => ({
    id: '22222222-2222-4222-8222-222222222222', receipt_type: type, quantity_received: 3, notes: 'Private receiving note',
    received_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z',
    purchase_order_id: type === 'purchase_order' ? historyRecord().product_id : null,
    transfer_id: type === 'transfer' ? historyRecord().product_id : null,
    purchase_orders: type === 'purchase_order' ? { id: historyRecord().product_id, site_id: historySite } : null,
    inventory_transfers: type === 'transfer' ? { id: historyRecord().product_id, site_id: historySite } : null,
})
for (const resource of ['reservations', 'receipts'] as const) {
    const kind = resource === 'reservations' ? 'inventoryReservations' : 'inventoryReceipts'
    const record = () => resource === 'reservations' ? reservationRecord() : receiptRecord()
    const privateLabel = resource === 'reservations' ? /Private reserved product/ : /Private receiving note/
    test(`${resource} refuses malformed quantities, missing counts and mismatched row scope`, async () => {
        const missingQuantity = { ...record(), [resource === 'reservations' ? 'quantity' : 'quantity_received']: undefined }
        const foreignRow = resource === 'reservations'
            ? { ...reservationRecord(), store_id: historyRecord().product_id }
            : { ...receiptRecord(), purchase_orders: { id: historyRecord().product_id, site_id: historyRecord().product_id } }
        for (const payload of [() => historyResponse([missingQuantity]), () => json([record()]), () => historyResponse([foreignRow])]) {
            const h = await mount(kind, async () => payload())
            try {
                assert.match(h.text(), new RegExp(`Failed to load ${resource}`))
                assert.doesNotMatch(h.text(), privateLabel)
                assert.doesNotMatch(h.text(), new RegExp(`No ${resource} found`))
            } finally { await h.close() }
        }
    })
    test(`${resource} retires visible rows and filters on an account change within the same store`, async () => {
        let denied = false
        const h = await mount(kind, async () => denied ? json({}, 403) : historyResponse([record()]))
        try {
            assert.match(h.text(), privateLabel)
            denied = true; await h.render('alpha', 'actor-b')
            assert.doesNotMatch(h.text(), privateLabel)
            assert.match(h.text(), new RegExp(`Failed to load ${resource}`))
        } finally { await h.close() }
    })
    test(`${resource} preserves Previous after a failed later page and rejects retired response bodies`, async () => {
        const old = deferred<unknown>()
        const h = await mount(kind, async url => url.includes('page=2') ? json({}, 503) : url.includes('/beta/')
            ? { ok: true, json: () => old.promise } as Response : historyResponse([record()], 1, 21))
        try {
            await h.click('Next'); assert.doesNotMatch(h.text(), privateLabel)
            await h.click('Previous'); assert.match(h.text(), privateLabel)
            await h.render('beta'); await h.render('gamma')
            await act(async () => old.resolve({ data: [resource === 'reservations' ? reservationRecord('Private retired response') : { ...receiptRecord(), notes: 'Private retired response' }], meta: { store_id: historySite, total: 1, page: 1, per_page: 20, has_next: false } }))
            assert.doesNotMatch(h.text(), /Private retired response/)
            assert.match(h.text(), privateLabel)
        } finally { await h.close() }
    })
    test(`${resource} SDK validates acknowledged pages and pins the same store in query and headers`, async () => {
        const { createLetbuyyApiClient, LetbuyyApiError } = await import('@letbuyy/api-client')
        const meta = { total: 1, page: 1, per_page: 20, has_next: false, store_id: historySite }
        const client = (body: unknown) => createLetbuyyApiClient({ baseUrl: 'https://api.example.invalid/v1', fetch: async (url, init) => {
            assert.equal(new URL(String(url)).searchParams.get('store_id'), historySite)
            assert.equal(new Headers(init?.headers).get('X-Store-ID'), historySite)
            return Response.json(body)
        } })
        const result = await client({ data: [record()], meta }).inventory[resource].list({ store_id: historySite })
        assert.equal(result.total, 1); assert.equal(result.data.length, 1)
        for (const body of [
            { data: [record()], meta: { ...meta, store_id: undefined } },
            { data: [record()], meta: { ...meta, total: undefined } },
            { data: [record()], meta: { ...meta, page: 2 } },
            { data: [record()], meta: { ...meta, has_next: undefined } },
            { data: [{ ...record(), [resource === 'reservations' ? 'quantity' : 'quantity_received']: 1.5 }], meta },
        ]) await assert.rejects(() => client(body).inventory[resource].list({ store_id: historySite }),
            error => error instanceof LetbuyyApiError && error.code === 'INVENTORY_RECORDS_UNVERIFIED')
    })
}
test('web reservations preserve all seven recorded lifecycle states and both receipt families render', async () => {
    const h = await mount('inventoryReservations', async () => historyResponse(['active','hold','committed','released','expired','fulfilled','cancelled'].map(status => ({ ...reservationRecord(status), status }))))
    try { for (const status of ['Active','Hold','Committed','Released','Expired','Fulfilled','Cancelled']) assert.match(h.text(), new RegExp(status)) } finally { await h.close() }
    const receipts = await mount('inventoryReceipts', async () => historyResponse([receiptRecord(), { ...receiptRecord('transfer'), id: '55555555-5555-4555-8555-555555555555' }]))
    try { assert.match(receipts.text(), /PO Receipt/); assert.match(receipts.text(), /Transfer Receipt/) } finally { await receipts.close() }
})
test('web reservation pagination retains applied filters while draft inputs change', async () => {
    const queries: URL[] = []
    const h = await mount('inventoryReservations', async url => {
        const query = new URL(url); queries.push(query)
        return historyResponse([{ ...reservationRecord(), status: query.searchParams.get('status') || 'active' }], Number(query.searchParams.get('page')), 41)
    })
    try {
        await h.setField('#status-filter', 'hold'); await h.click('Apply')
        assert.equal(queries.at(-1)!.searchParams.get('status'), 'hold')
        await h.setField('#status-filter', 'expired'); await h.click('Next')
        assert.equal(queries.at(-1)!.searchParams.get('status'), 'hold')
        assert.equal(queries.at(-1)!.searchParams.get('page'), '2')
        await h.click('Clear'); assert.equal(queries.at(-1)!.searchParams.get('status'), null)
    } finally { await h.close() }
})
test('stock history refuses a missing quantity or missing matching count instead of painting fabricated zero', async () => {
    const broken: Record<string, unknown> = { ...historyRecord('Private malformed history') }
    delete broken.quantity_change
    for (const payload of [() => historyResponse([broken]), () => json([historyRecord('Private missing count')])]) {
        const h = await mount('inventoryHistory', async url => url.endsWith('/analytics') ? json({}) : payload())
        try {
            assert.match(h.text(), /Failed to load inventory history/)
            assert.doesNotMatch(h.text(), /Private malformed history|Private missing count|No history yet/)
        } finally { await h.close() }
    }
})
test('stock history retires visible rows and optional analytics when the account changes in the same store', async () => {
    let denied = false
    const h = await mount('inventoryHistory', async url => url.endsWith('/analytics')
        ? (denied ? json({}, 503) : json({ total_skus: 37 }))
        : (denied ? json({}, 403) : historyResponse([historyRecord('Private old actor history')])))
    try {
        assert.match(h.text(), /Private old actor history/)
        denied = true
        await h.render('alpha', 'actor-b')
        assert.doesNotMatch(h.text(), /Private old actor history|Total SKUs37/)
        assert.match(h.text(), /Failed to load inventory history/)
    } finally { await h.close() }
})
test('stock history keeps Previous recovery after an unavailable later page', async () => {
    const h = await mount('inventoryHistory', async url => url.endsWith('/analytics') ? json({})
        : new URL(url).searchParams.get('page') === '2' ? json({}, 503)
        : historyResponse([historyRecord('Current valid history')], 1, 21))
    try {
        await h.click('Next')
        assert.match(h.text(), /Failed to load inventory history/)
        assert.doesNotMatch(h.text(), /Current valid history/)
        await h.click('Previous')
        assert.match(h.text(), /Current valid history/)
    } finally { await h.close() }
})
test('stock history rejects an old-store response body after a newer store is visible', async () => {
    const old = deferred<unknown>()
    const h = await mount('inventoryHistory', async url => {
        if (url.endsWith('/analytics')) return json({})
        if (url.includes('/alpha/')) { const r = new Response(''); r.json = () => old.promise; return r }
        return historyResponse([historyRecord('Current beta history')])
    })
    try {
        await h.render('beta')
        await act(async () => old.resolve({ data: [historyRecord('Private retired history')], meta: { total: 1, page: 1, per_page: 20, has_next: false } }))
        assert.doesNotMatch(h.text(), /Private retired history/)
        assert.match(h.text(), /Current beta history/)
    } finally { await h.close() }
})
test('stock history preserves a real zero quantity and genuine empty activity', async () => {
    const h = await mount('inventoryHistory', async url => url.endsWith('/analytics') ? json({})
        : historyResponse([{ ...historyRecord('Observed zero change'), quantity_change: 0 }]))
    try {
        assert.match(h.text(), /Observed zero change/)
        assert.doesNotMatch(h.text(), /Failed to load inventory history/)
    } finally { await h.close() }
    const empty = await mount('inventoryHistory', async url => url.endsWith('/analytics') ? json({}) : historyResponse([]))
    try { assert.doesNotMatch(empty.text(), /Failed to load inventory history/) } finally { await empty.close() }
})
test('stock history SDK refuses unacknowledged, malformed and foreign scope while preserving valid data', async () => {
    const { createLetbuyyApiClient, LetbuyyApiError } = await import('@letbuyy/api-client')
    const meta = { total: 1, page: 1, per_page: 20, has_next: false, store_id: historySite }
    const client = (body: unknown) => createLetbuyyApiClient({ baseUrl: 'https://api.example.invalid/v1', fetch: async () => Response.json(body) })
    const valid = await client({ data: [historyRecord()], meta }).inventory.history({ store_id: historySite })
    assert.equal(valid.data[0].quantity_change, -2); assert.equal(valid.total, 1)
    for (const body of [
        { data: [historyRecord()], meta: { ...meta, store_id: undefined } },
        { data: [historyRecord()], meta: { ...meta, total: undefined } },
        { data: [{ ...historyRecord(), quantity_change: undefined }], meta },
        { data: [{ ...historyRecord(), store_id: '55555555-5555-4555-8555-555555555555' }], meta },
    ]) {
        await assert.rejects(() => client(body).inventory.history({ store_id: historySite }),
            error => error instanceof LetbuyyApiError && error.code === 'INVENTORY_HISTORY_UNVERIFIED')
    }
})

test('AI Studio treats missing credit authority as unavailable instead of a zero-credit success', async () => {
    const h=await mount('aiStudio',async()=>json({usage:[]}));
    try {assert.match(h.text(),/AI credit information is unavailable/)} finally {await h.close()}
});

const operationPayload=(resource:string):Record<string,unknown>=>({store_id:historySite,...(
    resource==='supplierMetrics'?{suppliers:[{supplier_id:historyRecord().product_id,supplier_name:'Private supplier metrics',po_count:3,on_time_rate:null,avg_lead_time_days:null}],meta:{page:1,per_page:20,total:1,total_pages:1,has_next:false,has_prev:false}}:
    resource==='warehouseMetrics'?{warehouses:[{location_id:historyRecord().location_id,location_name:'Private warehouse metrics',is_default:true,sku_count:3,total_units:9}],meta:{page:1,per_page:20,total:1,total_pages:1,has_next:false,has_prev:false}}:
    resource==='transferMetrics'?{by_status:{shipped:1},in_transit_count:1,total_count:1}:
    {order_count:3,open_order_count:0})})
for(const resource of ['supplierMetrics','warehouseMetrics','transferMetrics','operationsSummary'] as const) {
    test(`${resource} SDK refuses missing scope and malformed metrics without inventing values`,async()=>{
        const {createLetbuyyApiClient,LetbuyyApiError}=await import('@letbuyy/api-client')
        const client=(body:unknown)=>createLetbuyyApiClient({baseUrl:'https://api.example.invalid/v1',fetch:async(url,init)=>{
            assert.equal(new URL(String(url)).searchParams.get('store_id'),historySite)
            assert.equal(new Headers(init?.headers).get('X-Store-ID'),historySite)
            return json(body)
        }})
        const valid=operationPayload(resource)
        const result=await client(valid).commerceAnalytics[resource]({store_id:historySite})
        assert.equal(result.store_id,historySite)
        const broken=operationPayload(resource)
        if(resource==='supplierMetrics') (broken.suppliers as Array<Record<string,unknown>>)[0].po_count=undefined
        if(resource==='warehouseMetrics') (broken.warehouses as Array<Record<string,unknown>>)[0].total_units=undefined
        if(resource==='transferMetrics') broken.total_count=0
        if(resource==='operationsSummary') delete broken.order_count
        for(const body of [{...valid,store_id:undefined},{...valid,store_id:historyRecord().product_id},broken]) await assert.rejects(()=>client(body).commerceAnalytics[resource]({store_id:historySite}),error=>error instanceof LetbuyyApiError&&error.code==='OPERATIONS_METRICS_UNVERIFIED')
    })
}
test('operations web rejects malformed required counts while other panels remain available',async()=>{
    const h=await mount('operationsDashboard',async url=>{
        const name=url.includes('supplier-metrics')?'supplierMetrics':url.includes('warehouse-metrics')?'warehouseMetrics':url.includes('transfer-metrics')?'transferMetrics':'operationsSummary'
        return json(name==='operationsSummary'?{store_id:historySite}:operationPayload(name))
    })
    try {assert.match(h.text(),/Unable to load snapshot/);assert.match(h.text(),/Private supplier metrics/);assert.match(h.text(),/Private warehouse metrics/);assert.doesNotMatch(h.text(),/Catalog products0/)} finally {await h.close()}
})
test('operations web retires private metrics on same-store account changes and ignores old body completion',async()=>{
    let retired=false;const old=deferred<unknown>()
    const h=await mount('operationsDashboard',async url=>{
        if(retired)return json({},403)
        if(url.includes('supplier-metrics'))return {ok:true,json:()=>old.promise} as Response
        return json(operationPayload(url.includes('warehouse-metrics')?'warehouseMetrics':url.includes('transfer-metrics')?'transferMetrics':'operationsSummary'))
    })
    try {
        assert.match(h.text(),/Private warehouse metrics/);retired=true;await h.render('alpha','actor-b')
        await act(async()=>old.resolve({data:operationPayload('supplierMetrics')}))
        assert.doesNotMatch(h.text(),/Private warehouse metrics|Private supplier metrics/)
        assert.match(h.text(),/Unable to load supplier metrics/)
    }finally{await h.close()}
})
test('operations warehouse page failure removes old rows and preserves Previous recovery',async()=>{
    const h=await mount('operationsDashboard',async url=>{
        if(!url.includes('warehouse-metrics'))return json(operationPayload(url.includes('supplier-metrics')?'supplierMetrics':url.includes('transfer-metrics')?'transferMetrics':'operationsSummary'))
        if(url.includes('page=2'))return json({},503)
        return json({store_id:historySite,warehouses:Array.from({length:20},(_,i)=>({location_id:`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`,location_name:`Private warehouse page ${i}`,is_default:false,sku_count:1,total_units:3})),meta:{page:1,per_page:20,total:21,total_pages:2,has_next:true,has_prev:false}})
    })
    try{
        assert.match(h.text(),/Private warehouse page 0/);await h.click('Next locations')
        assert.doesNotMatch(h.text(),/Private warehouse page 0/);assert.match(h.text(),/Unable to load warehouse metrics/)
        await h.click('Previous locations');assert.match(h.text(),/Private warehouse page 0/)
    }finally{await h.close()}
})
test('operations panels settle independently and page only the requested identity-bound collection', async () => {
    const calls:string[]=[];
    const pendingSupplier=deferred<Response>();
    const h=await mount('operationsDashboard',async url=>{
        calls.push(url);
        if(url.includes('supplier-metrics')) return pendingSupplier.promise;
        if(url.includes('warehouse-metrics')) return json({store_id:historySite,warehouses:Array.from({length:url.includes('page=2')?1:20},(_,i)=>({location_id:`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`,location_name:(url.includes('page=2')?'Second location':'First location')+i,is_default:false,sku_count:1100,total_units:9900})),meta:{page:url.includes('page=2')?2:1,per_page:20,total:21,total_pages:2,has_next:!url.includes('page=2'),has_prev:url.includes('page=2')}});
        if(url.includes('transfer-metrics')) return json({store_id:historySite,by_status:{shipped:1100,received:3},in_transit_count:1100,total_count:1103});
        return json({store_id:historySite,order_count:3});
    });
    try {
        assert.match(h.text(),/1103/);
        assert.match(h.text(),/First location/);
        const before=calls.length;
        await h.click('Next locations');
        assert.equal(calls.length,before+1);
        assert.match(calls.at(-1)!,/warehouse-metrics\?page=2/);
        assert.match(h.text(),/Second location/);
        await h.render('beta');
        assert.match(calls.filter(url=>url.includes('/beta/')&&url.includes('warehouse-metrics'))[0],/page=1/);
        pendingSupplier.resolve(json({store_id:historySite,suppliers:[],meta:{page:1,per_page:20,total:0,total_pages:0,has_next:false,has_prev:false}}));
        await h.pause(0);
    } finally {await h.close()}
});
type ContentPage = keyof typeof readPages
type Transport = (url: string, init?: RequestInit) => Promise<Response>

async function mount(kind: ContentPage | 'orders' | 'customers' | 'analytics' | 'search' | 'notifications' | 'purchasing' | 'transfers' | 'assistant' | 'themeLibrary' | 'previewUpdate' | 'loyalty' | 'checkoutDomain' | 'connectDomain', transport: Transport,configureStorage?:(storage:Storage)=>void,initialProtocolAvailable=true) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/alpha/orders' })
    const warehouse=kind==='purchasing'||kind==='transfers'||kind==='locations'||kind==='suppliers';
    if(warehouse)Object.defineProperty(dom.window.navigator,'locks',{value:{request:async(_name:string,callback:()=>unknown)=>callback()}});
    const domGlobals = ['window', 'document', 'navigator', 'self', 'localStorage', 'MutationObserver', 'HTMLElement', 'Element']
    const previous = Object.fromEntries([...domGlobals, 'fetch'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of domGlobals) Object.defineProperty(globalThis, name, {
        configurable: true, writable: true, value: name === 'window' || name === 'self' ? dom.window : dom.window[name],
    })
    let protocolAvailable=initialProtocolAvailable,capabilityReads=0;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url=String(input),match=/\/api\/v1\/stores\/([^/]+)\/inventory\/commands\/capabilities$/.exec(url);
        if(warehouse&&match){capabilityReads++;return Promise.resolve(protocolAvailable?json({
            store_id:decodeURIComponent(match[1])==='alpha'?historySite:'22222222-2222-4222-8222-222222222222',
            actor_id:new Headers(init?.headers).get('X-LetBuyy-Merchant-Context'),protocol_version:'2',
            effect_policy:'atomic_receipt_or_unavailable',stop_supported:true,
        }):Response.json({error:{code:'NOT_FOUND'}},{status:404}));}
        return transport(url, init);
    }) as typeof fetch
    configureStorage?.(dom.window.localStorage);
    const { createRoot } = await import('react-dom/client')
    const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js')
    const { PathParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js')
    const { ToastProvider } = await import('@letbuyy/ui')
    const { MerchantSecurityContext } = await import('../src/components/security/MerchantSecurityContext')
    const Component: React.ElementType = kind === 'connectDomain' ? (await import('../src/components/domains/ConnectDomainWizard')).ConnectDomainWizard
        : kind === 'checkoutDomain' ? (await import('../src/components/domains/CheckoutDomainCard')).CheckoutDomainCard
        : kind === 'themeLibrary' ? (await import('../src/components/theme-library/ThemeLibraryWorkspace')).ThemeLibraryWorkspace
        : kind === 'previewUpdate' ? (await import('../src/components/theme-editor/ThemeUpdatePanel')).default
        : kind === 'loyalty' ? (await import('../src/components/settings/LoyaltySettings')).LoyaltySettings
        : kind in readPages ? (await readPages[kind as ContentPage]()).default
        : kind === 'orders' ? (await import('../src/app/[store]/orders/page')).default
        : kind === 'customers' ? (await import('../src/app/[store]/customers/page')).default
        : kind === 'analytics' ? (await import('../src/app/[store]/analytics/page')).default
        : kind === 'search' ? (await import('../src/components/CommandPalette')).default
        : kind === 'purchasing' ? (await import('../src/app/[store]/products/purchase-orders/page')).default
        : kind === 'transfers' ? (await import('../src/app/[store]/products/transfers/page')).default
        : kind === 'assistant' ? (await import('../src/components/AISidebar')).default
        : (await import('../src/components/NotificationsPanel')).default
    let completions = 0
    const root = createRoot(dom.window.document.getElementById('root')!)
    const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} }
    const render = async (store = 'alpha', actorId = warehouse?'11111111-1111-4111-8111-111111111111':'actor-a') => {
        await act(async () => root.render(
            <AppRouterContext.Provider value={router}><PathParamsContext.Provider value={{ store }}>
                <ToastProvider duration={0}><MerchantSecurityContext.Provider value={{ actorId, store,siteId:warehouse?(store==='alpha'?historySite:'22222222-2222-4222-8222-222222222222'):undefined }}>
                    <Component initialDomain="shop.example.invalid" onConnected={() => completions++} actorId={actorId} currentVersionId="current-version" availableVersionId="next-version" themeSlug="synthetic-theme" storeId={kind === 'previewUpdate' ? store : kind === 'themeLibrary' ? null : 'site-a'} store={store} storeName="Synthetic Store" siteType="store" onClose={() => {}} storeData={{ id: 'site-a', name: 'Synthetic Store', store_name: 'Synthetic Store', subdomain: store, site_type: 'store', status: 'draft', trial_ends_at: null, trial_status: null, theme_id: 'modern', theme_settings: null, custom_domain: null }} />
                </MerchantSecurityContext.Provider></ToastProvider>
            </PathParamsContext.Provider></AppRouterContext.Provider>,
        ))
    }
    await render()
    return {
        render,
        async remount(){await act(async()=>root.render(null));await render();},
        storage:dom.window.localStorage,
        protocol(available:boolean){protocolAvailable=available;},
        capabilityReads:()=>capabilityReads,
        completions: () => completions,
        text: () => dom.window.document.body.textContent || '',
        controls: () => [...dom.window.document.querySelectorAll('input,textarea,select,[role="switch"]')].map((node: Element) => ({ value: (node as HTMLInputElement).value, checked: (node as HTMLInputElement).checked, ariaChecked: node.getAttribute('aria-checked') })),
        async setField(selector: string, value: string) {
            const field = dom.window.document.querySelector(selector) as HTMLInputElement | HTMLSelectElement
            assert.ok(field, `Missing field ${selector}`)
            await act(async () => {
                const prototype = field.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
                Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value)
                field.dispatchEvent(new dom.window.Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
            })
        },
        async type(value: string) {
            const input = dom.window.document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
            assert.ok(input, 'real search input')
            await act(async () => {
                Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
                input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
            })
        },
        async pause(ms = 300) { await act(async () => { await new Promise(done => setTimeout(done, ms)) }) },
        async click(label: string) {
            const button = [...dom.window.document.querySelectorAll('button')].find(item => item.textContent?.trim() === label)
            assert.ok(button, `Missing button ${label}: ${dom.window.document.body.textContent}`)
            await act(async () => button.click())
        },
        async dialogClick(label:string){
            const button=[...dom.window.document.querySelectorAll('[role="dialog"] button')].find(item=>item.textContent?.trim()===label)
            assert.ok(button,`Missing dialog action ${label}`);await act(async()=>button.click())
        },
        async file(file: { name: string; size: number; text(): Promise<string> }) {
            const input = dom.window.document.querySelector('input[type="file"]') as HTMLInputElement
            assert.ok(input, 'real file input')
            Object.defineProperty(input, 'files', { configurable: true, value: [file] })
            await act(async () => input.dispatchEvent(new dom.window.Event('change', { bubbles: true })))
        },
        async close() {
            await act(async () => root.unmount()); dom.window.close()
            for (const [name, descriptor] of Object.entries(previous)) {
                if (descriptor) Object.defineProperty(globalThis, name, descriptor)
                else Reflect.deleteProperty(globalThis, name)
            }
        },
    }
}

for (const kind of ['orders', 'customers'] as const) {
    test(`${kind} search coalesces rapid typing into one applied query`, async () => {
        const calls: string[] = []
        const h = await mount(kind, async url => { calls.push(url); return json([]) })
        try {
            const start = calls.length
            for (const value of ['n', 'no', 'note']) { await h.type(value); await h.pause(30) }
            assert.equal(calls.length, start, 'typing must not launch a request per key')
            await h.pause()
            assert.equal(calls.length, start + 1)
            assert.match(calls.at(-1)!, /search=note/)
        } finally { await h.close() }
    })
    test(`${kind} retires late old-store data even when transport ignores abort`, async () => {
        const old = deferred<Response>(), signals: AbortSignal[] = []
        const h = await mount(kind, async (url, init) => {
            if (url.includes('shipping/zones')) return json({ provider_mode: 'mock' })
            if (init?.signal) signals.push(init.signal)
            if (url.includes('/alpha/')) return old.promise
            return json([])
        })
        try {
            await h.render('beta')
            assert.ok(signals[0]?.aborted, 'retiring the scope also cancels the supported transport')
            await act(async () => old.resolve(json([{ id: 'old-row', order_number: 'PRIVATE-OLD-ORDER', email: 'old@example.invalid', full_name: 'PRIVATE-OLD-CUSTOMER', status: 'active', created_at: '2026-10-21' }])))
            assert.doesNotMatch(h.text(), /PRIVATE-OLD-/)
        } finally { await h.close() }
    })
}

test('command search waits for typing to pause before its three bounded resource reads', async () => {
    const calls: string[] = []
    const h = await mount('search', async url => { calls.push(url); return json([]) })
    try {
        for (const value of ['no', 'not', 'note']) { await h.type(value); await h.pause(30) }
        assert.equal(calls.length, 0)
        await h.pause()
        assert.equal(calls.length, 3)
    } finally { await h.close() }
})

test('failed and partial notifications settle with retry rather than false empty success', async () => {
    for (const partial of [false, true]) {
        const h = await mount('notifications', async () => partial
            ? Response.json({ data: [], meta: { partial: true } }) : json(null, 503))
        try {
            assert.match(h.text(), /Notifications could not be fully loaded/)
            assert.match(h.text(), /Retry/)
            assert.doesNotMatch(h.text(), /All caught up/)
        } finally { await h.close() }
    }
})

test('notification results from a retired store cannot replace the current store', async () => {
    const old = deferred<Response>()
    const h = await mount('notifications', async url => url.includes('/alpha/') ? old.promise : json([]))
    try {
        await h.render('beta')
        await act(async () => old.resolve(json([{ id: 'old', icon: 'mail', title: 'PRIVATE OLD STORE', time: 'Now', unread: true }])))
        assert.doesNotMatch(h.text(), /PRIVATE OLD STORE/)
        assert.match(h.text(), /All caught up/)
    } finally { await h.close() }
})

const warehouseTarget='33333333-3333-4333-8333-333333333333',warehouseLine='77777777-7777-4777-8777-777777777777';
function warehouseRow(po=false) {
    const date='2026-10-31T00:00:00Z';
    return {id:warehouseTarget,site_id:historySite,po_number:'PO-SYN',transfer_number:'TR-SYN',status:po?'partially_received':'reserved',
        source_location_id:'55555555-5555-4555-8555-555555555555',destination_location_id:'66666666-6666-4666-8666-666666666666',
        location_id:'55555555-5555-4555-8555-555555555555',notes:null,expected_at:null,supplier_id:null,supplier:null,
        created_at:date,total:1.16,subtotal:1.16,currency:'INR',shipped_at:null,received_at:null,
        lines:[{id:warehouseLine,site_id:historySite,purchase_order_id:warehouseTarget,transfer_id:warehouseTarget,
            product_id:historyRecord().product_id,variant_id:null,quantity_ordered:4,quantity_requested:4,
            quantity_shipped:0,quantity_received:po?2:0,unit_cost:0.29,created_at:date}]};
}
function warehouseAck(key:string,po=false,cancelled=false) {
    const command:Record<string,unknown>=po?{lines:[{purchase_order_line_id:warehouseLine,quantity:2}]}:{};
    return {command_receipt:{id:'88888888-8888-4888-8888-888888888888',key,site_id:historySite,
        actor_id:historySite,operation:po?'purchase_order.receive':'transfer.ship',target_id:warehouseTarget,
        command,effective_lines:!cancelled&&po?command.lines:null,outcome:cancelled?'cancelled':'applied'},
        ...(!cancelled?{[po?'purchase_order':'transfer']:{id:warehouseTarget,site_id:historySite,status:po?'received':'shipped'}}:{}),
        lines:cancelled?[]:[{...warehouseRow(po).lines[0],quantity_shipped:po?0:4,quantity_received:po?4:0}]};
}
for(const kind of ['purchasing','transfers'] as const) {
    test(`${kind} lost committed reply survives remount and retries its original request even when the list fails`,async()=>{
        const po=kind==='purchasing',writes:Array<{body:Record<string,unknown>;key:string}>=[];
        let receipt:ReturnType<typeof warehouseAck>|undefined,effects=0,failed=false;
        const h=await mount(kind,async(url,init)=>{
            if(init?.method==='POST') {
                const body=JSON.parse(String(init.body)) as Record<string,unknown>,headers=new Headers(init.headers),key=headers.get('X-Idempotency-Key')!;
                assert.equal(headers.get('X-LetBuyy-Merchant-Context'),historySite);assert.equal(key,body.idempotency_key);
                writes.push({body,key});if(!receipt){effects++;receipt=warehouseAck(key,po);failed=true;throw new Error('Synthetic lost committed reply');}
                return warehouseResponse(url,receipt);
            }
            if(url.includes('inventory-locations'))return warehouseResponse(url,[locationOption(1),locationOption(2)]);
            return failed?warehouseResponse(url,null,503):warehouseResponse(url,[warehouseRow(po)]);
        });
        try {
            await h.click(po?'Receive':'Ship');await h.click(po?'Mark as received':'Mark as shipped');
            assert.equal(effects,1);assert.equal(h.storage.length,1);assert.doesNotMatch(h.text(),po?/Stock received into inventory/:/Transfer marked as shipped/);
            await h.click('Cancel');await h.remount();assert.match(h.text(),/Warehouse request awaiting confirmation/);
            assert.match(h.text(),/records are unavailable/);assert.doesNotMatch(h.text(),/No transfers yet|No purchase orders yet/);
            await h.click('Retry original');assert.equal(effects,1);assert.deepEqual(writes[1],writes[0]);assert.equal(h.storage.length,0);
            assert.match(h.text(),/Original warehouse request confirmed/);
        }finally{await h.close();}
    });
}
test('a lost stop reply retains its original key and retry recovers the authoritative cancellation',async()=>{
    const writes:Array<{url:string;key:string}>=[];let cancelled:ReturnType<typeof warehouseAck>|undefined;
    const h=await mount('transfers',async(url,init)=>{
        if(init?.method==='POST') {
            const key=new Headers(init.headers).get('X-Idempotency-Key')!;writes.push({url,key});
            if(url.includes('/commands/stop')){if(!cancelled){cancelled=warehouseAck(key,false,true);throw new Error('Synthetic lost stop reply');}return warehouseResponse(url,cancelled);}
            if(cancelled)return Response.json({error:{code:'WAREHOUSE_REQUEST_STOPPED'}},{status:409});
            throw new Error('Synthetic failure before apply');
        }
        return warehouseResponse(url,url.includes('inventory-locations')?[locationOption(1),locationOption(2)]:[warehouseRow()]);
    });
    try {
        await h.click('Ship');await h.click('Mark as shipped');await h.click('Cancel');
        await h.click('Stop original');await h.click('Confirm stop');assert.equal(h.storage.length,1);assert.match(h.text(),/outcome is still unconfirmed/);
        await h.click('Back');await h.click('Retry original');assert.equal(h.storage.length,0);
        assert.match(h.text(),/Original warehouse request stopped before it applied/);
        assert.equal(new Set(writes.map(x=>x.key)).size,1);assert.match(writes.at(-1)!.url,/\/api\/v1\/stores\/alpha\/inventory\/commands\/stop$/);
    }finally{await h.close();}
});
for(const fault of ['actor','site','key','intent','target','state','quantity','missing-receipt']) {
    test(`warehouse ${fault} acknowledgement cannot clear saved recovery`,async()=>{
        let corrupt=true,effects=0,receipt:ReturnType<typeof warehouseAck>|undefined;
        const h=await mount('transfers',async(url,init)=>{
            if(init?.method==='POST') {
                const key=new Headers(init.headers).get('X-Idempotency-Key')!;if(!receipt){receipt=warehouseAck(key);effects++;}
                const ack=JSON.parse(JSON.stringify(receipt)) as Record<string,unknown>,r=ack.command_receipt as Record<string,unknown>;
                if(corrupt)switch(fault) {
                    case 'actor':r.actor_id=warehouseTarget;break;case 'site':r.site_id=warehouseTarget;break;
                    case 'key':r.key='wrong-original-request-key';break;case 'intent':r.command={extra:'changed'};break;
                    case 'target':r.target_id=historySite;break;case 'state':(ack.transfer as Record<string,unknown>).status='invented';break;
                    case 'quantity':(ack.lines as Array<Record<string,unknown>>)[0].quantity_received=9;break;
                    case 'missing-receipt':delete ack.command_receipt;break;
                }
                return warehouseResponse(url,ack);
            }
            return warehouseResponse(url,url.includes('inventory-locations')?[locationOption(1),locationOption(2)]:[warehouseRow()]);
        });
        try {
            await h.click('Ship');await h.click('Mark as shipped');assert.equal(h.storage.length,1);assert.doesNotMatch(h.text(),/Transfer marked as shipped/);
            await h.click('Cancel');corrupt=false;await h.click('Retry original');assert.equal(h.storage.length,0);assert.equal(effects,1);
        }finally{await h.close();}
    });
}
test('an open warehouse stop confirmation retires on store A-B-A without dispatch',async()=>{
    let writes=0;
    const h=await mount('transfers',async(url,init)=>{
        if(init?.method==='POST'){writes++;throw new Error('Synthetic uncertain outcome');}
        return warehouseResponse(url,url.includes('inventory-locations')?[locationOption(1),locationOption(2)]:[warehouseRow()]);
    });
    try {
        await h.click('Ship');await h.click('Mark as shipped');await h.click('Cancel');await h.click('Stop original');
        assert.match(h.text(),/Stop the original request\?/);await h.render('beta');await h.render('alpha');
        assert.doesNotMatch(h.text(),/Stop the original request\?/);assert.match(h.text(),/Warehouse request awaiting confirmation/);assert.equal(writes,1);
    }finally{await h.close();}
});
test('unreadable browser warehouse recovery disables new mutations and preserves the record',async()=>{
    let writes=0;
    const slot=`letbuyy.warehouse-command.v1:${historySite}:${historySite}`;
    const h=await mount('transfers',async(url,init)=>{if(init?.method==='POST')writes++;
        return warehouseResponse(url,url.includes('inventory-locations')?[locationOption(1),locationOption(2)]:[warehouseRow()]);
    },storage=>storage.setItem(slot,'{corrupt'));
    try {
        assert.match(h.text(),/Warehouse actions unavailable/);await h.click('Ship');assert.doesNotMatch(h.text(),/Ship transfer —/);
        await h.click('Check saved requests');assert.equal(h.storage.getItem(slot),'{corrupt');assert.equal(writes,0);
    }finally{await h.close();}
});
test('fractional receiving input is a local validation error, with no dispatch or saved pending request',async()=>{
    let writes=0;
    const h=await mount('purchasing',async(url,init)=>{if(init?.method==='POST')writes++;
        return warehouseResponse(url,url.includes('inventory-locations')?[locationOption(1)]:[warehouseRow(true)]);
    });
    try {
        await h.click('Receive');await h.setField('[role="dialog"] input','1.5');await h.click('Mark as received');
        assert.match(h.text(),/Enter whole receiving quantities/);assert.equal(writes,0);assert.equal(h.storage.length,0);
        assert.doesNotMatch(h.text(),/Warehouse request awaiting confirmation/);
    }finally{await h.close();}
});
for(const kind of ['purchasing','transfers'] as const) {
    test(`${kind} does not enable warehouse mutations against an older BFF/server`,async()=>{
        let writes=0;
        const h=await mount(kind,async(url,init)=>{if(init?.method==='POST')writes++;
            return warehouseResponse(url,url.includes('inventory-locations')?[locationOption(1),locationOption(2)]:[warehouseRow(kind==='purchasing')]);
        },undefined,false);
        try {
            assert.match(h.text(),/Warehouse actions unavailable/);await h.click(kind==='purchasing'?'Receive':'Ship');
            assert.doesNotMatch(h.text(),/Receive stock —|Ship transfer —/);assert.equal(writes,0);assert.equal(h.storage.length,0);
            assert.ok(h.capabilityReads()>0);
        }finally{await h.close();}
    });
}
test('browser recovery retains the original request through server unavailability and rechecks before replay',async()=>{
    let writes=0,key='';
    const h=await mount('transfers',async(url,init)=>{
        if(init?.method==='POST'){writes++;key=new Headers(init.headers).get('X-Idempotency-Key')!;
            if(writes===1)throw new Error('Synthetic lost reply');return warehouseResponse(url,warehouseAck(key));}
        return warehouseResponse(url,url.includes('inventory-locations')?[locationOption(1),locationOption(2)]:[warehouseRow()]);
    });
    try {
        await h.click('Ship');await h.click('Mark as shipped');await h.click('Cancel');h.protocol(false);await h.remount();
        assert.match(h.text(),/Warehouse request awaiting confirmation/);await h.click('Retry original');assert.equal(writes,1);assert.equal(h.storage.length,1);
        h.protocol(true);await h.click('Check saved requests');await h.click('Retry original');assert.equal(writes,2);assert.equal(h.storage.length,0);
        assert.match(h.text(),/Original warehouse request confirmed/);
    }finally{await h.close();}
});

for (const kind of ['purchasing','transfers'] as const) {
    test(`${kind} uses canonical partial quantities and sends the explicit remaining receipt`,async()=>{
        const transfer=kind==='transfers',id='33333333-3333-4333-8333-333333333333',lineId='77777777-7777-4777-8777-777777777777';
        const row={id,site_id:historySite,po_number:'PO-SYN',transfer_number:'TR-SYN',status:'partially_received',
            created_at:'2026-10-31T00:00:00Z',supplier:null,supplier_id:null,location_id:'55555555-5555-4555-8555-555555555555',
            source_location_id:'55555555-5555-4555-8555-555555555555',destination_location_id:'66666666-6666-4666-8666-666666666666',total:1.16,subtotal:1.16,currency:'INR',
            notes:null,expected_at:null,shipped_at:null,received_at:null,
            lines:[{id:lineId,site_id:historySite,purchase_order_id:id,transfer_id:id,
                product_id:historyRecord().product_id,variant_id:null,quantity_ordered:4,quantity_requested:4,
                quantity_shipped:3,quantity_received:2,unit_cost:0.29,created_at:'2026-10-31T00:00:00Z'}]};
        const writes:Record<string,unknown>[]=[];
        const h=await mount(kind,async(url,init)=>{
            if(init?.method==='POST'){writes.push(JSON.parse(String(init.body)));return warehouseResponse(url,{});}
            if(url.includes('inventory-locations'))return warehouseResponse(url,[locationOption(1),locationOption(2)]);
            if(url.includes('/suppliers'))return warehouseResponse(url,[]);
            return warehouseResponse(url,[row]);
        });
        try {
            assert.match(h.text(),/Partially received/);
            if(!transfer)assert.match(h.text(),/1\.16/);
            await h.click('Receive');
            assert.match(h.text(),transfer?/Requested: 4 · Shipped: 3 · Received: 2 · Remaining: 1/:/Ordered: 4 · Already received: 2 · Remaining: 2/);
            await h.click(transfer?'Confirm receipt':'Mark as received');
            assert.equal(writes.length,1);assert.deepEqual(writes[0].lines,[{[transfer?'transfer_line_id':'purchase_order_line_id']:lineId,quantity:transfer?1:2}]);
        }finally{await h.close();}
    });
}
for(const kind of ['purchasing','transfers'] as const) {
    test(`${kind} shows matching counts, navigates past the first page and recovers a denied page`,async()=>{
        const calls:number[]=[];let deny=false;
        const h=await mount(kind,async(url,init)=>{
            if(url.includes('inventory-locations'))return json([]);
            assert.equal(new Headers(init?.headers).get('X-LetBuyy-Merchant-Context'),historySite);
            const page=Number(new URL(url,'http://localhost').searchParams.get('page'));calls.push(page);
            if(page===2&&deny)return json(null,403);
            const data=Array.from({length:page===1?20:1},(_,index)=>({...warehouseRow(kind==='purchasing'),id:`synthetic-${page}-${index}`,
                po_number:`PO-PAGE-${page}-${index}`,transfer_number:`TR-PAGE-${page}-${index}`}));
            return Response.json({data,meta:{store_id:historySite,page,per_page:20,total:21,has_next:page===1,total_is_exact:true}});
        });
        try {
            assert.match(h.text(),/21 matching records · Page 1/);await h.click('Next');
            assert.equal(calls.at(-1),2);assert.match(h.text(),/21 matching records · Page 2/);
            assert.doesNotMatch(h.text(),/PAGE-1-0/);assert.match(h.text(),/PAGE-2-0/);
            await h.click('Previous');deny=true;await h.click('Next');
            assert.match(h.text(),/Page 2 · Count unavailable/);assert.match(h.text(),/records are unavailable/);assert.doesNotMatch(h.text(),/PAGE-1-0/);
            await h.click('Previous');assert.match(h.text(),/21 matching records · Page 1/);
            await h.render('beta');assert.equal(calls.at(-1),1);assert.doesNotMatch(h.text(),/21 matching records/);
        }finally{await h.close();}
    });
    test(`${kind} refuses an older unpaged response without displaying false empty or a count`,async()=>{
        const h=await mount(kind,async()=>json([]));
        try{assert.match(h.text(),/records are unavailable/);assert.match(h.text(),/Count unavailable/);
            assert.doesNotMatch(h.text(),/No purchase orders yet|No transfers yet|0 matching records/);
        }finally{await h.close();}
    });
}
for(const kind of ['purchasing','transfers'] as const){
 test(`${kind} prepares receipt quantities from a fresh detail rather than the list snapshot`,async()=>{
  const po=kind==='purchasing',base=warehouseRow(po),writes:Record<string,unknown>[]=[];let detailReads=0;
  const stale={...base,status:po?'ordered':'shipped',lines:[{...base.lines[0],quantity_shipped:4,quantity_received:0}]};
  const fresh={...base,status:'partially_received',lines:[{...base.lines[0],quantity_shipped:3,quantity_received:2}]};
  const h=await mount(kind,async(url,init)=>{
   if(init?.method==='POST'){writes.push(JSON.parse(String(init.body)));return json({});}
   if(url.includes('inventory-locations'))return json([]);
   if(url.endsWith('/'+warehouseTarget)){detailReads++;assert.equal(new Headers(init?.headers).get('X-LetBuyy-Merchant-Context'),historySite);return json(fresh);}
   return warehouseResponse(url,[stale]);
  });
  try{await h.click('Receive');assert.equal(detailReads,1);assert.match(h.text(),po?/Remaining: 2/:/Remaining: 1/);
   await h.click(po?'Mark as received':'Confirm receipt');assert.deepEqual(writes[0].lines,[{[po?'purchase_order_line_id':'transfer_line_id']:warehouseLine,quantity:po?2:1}]);
  }finally{await h.close();}
 });
 for(const fault of ['denied','foreign'])test(`${kind} cannot open a receipt from an unavailable or unverified ${fault} detail`,async()=>{
  const po=kind==='purchasing';let writes=0;
  const row={...warehouseRow(po),status:po?'ordered':'shipped',lines:[{...warehouseRow(po).lines[0],quantity_shipped:4}]};
  const h=await mount(kind,async(url,init)=>{
   if(init?.method==='POST')writes++;
   if(url.includes('inventory-locations'))return json([]);
   if(url.endsWith('/'+warehouseTarget))return fault==='denied'?json(null,403):json({...row,site_id:warehouseTarget});
   return warehouseResponse(url,[row]);
  });
  try{await h.click('Receive');assert.match(h.text(),/current warehouse record could not be loaded/);assert.equal(writes,0);assert.equal(h.storage.length,0);
   assert.doesNotMatch(h.text(),po?/Receive stock —/:/Receive transfer —/);
  }finally{await h.close();}
 });
 test(`${kind} retires a delayed action detail across store A-B-A`,async()=>{
  const po=kind==='purchasing',pending=deferred<Response>();let writes=0;
  const row={...warehouseRow(po),status:po?'ordered':'shipped',lines:[{...warehouseRow(po).lines[0],quantity_shipped:4}]};
  const h=await mount(kind,async(url,init)=>{
   if(init?.method==='POST')writes++;
   if(url.includes('inventory-locations'))return json([]);
   if(url.endsWith('/'+warehouseTarget))return pending.promise;
   return warehouseResponse(url,[row]);
  });
  try{await h.click('Receive');await h.render('beta');await h.render('alpha');
   await act(async()=>pending.resolve(json(row)));assert.equal(writes,0);assert.equal(h.storage.length,0);
   assert.doesNotMatch(h.text(),po?/Receive stock —/:/Receive transfer —/);
  }finally{await h.close();}
 });
}
test('a reserved transfer can open its shipping confirmation using the actual server status',async()=>{
    const h=await mount('transfers',async url=>url.includes('inventory-locations')?warehouseResponse(url,[locationOption(1),locationOption(2)]):warehouseResponse(url,[
        {...warehouseRow(),transfer_number:'TR-SYN-RESERVED'} ]));
    try{await h.click('Ship');assert.match(h.text(),/Ship transfer — TR-SYN-RESERVED/);}finally{await h.close();}
});

for (const [kind, label] of [['purchasing', 'Create purchase order'], ['transfers', 'Create transfer']] as const) {
    test(`${kind} loads rich product options on demand and permits the next bounded page`, async () => {
        const calls: string[] = []
        const h = await mount(kind, async url => {
            calls.push(url)
            if (url.includes('inventory-locations')) return warehouseResponse(url,[locationOption(1), locationOption(2)])
            if (url.includes('/products?')) {
                const page = new URL(url, 'http://localhost').searchParams.get('page')
                return Response.json({ data: [{ id: `product-${page}`, name: `Product ${page}`, variants: [] }], meta: { has_next: page === '1' } })
            }
            return warehouseResponse(url,[])
        })
        try {
            assert.equal(calls.filter(url => url.includes('/products?')).length, 0, 'a closed form must not preload the catalogue')
            if (kind === 'purchasing') assert.equal(calls.filter(url => url.endsWith('/suppliers')).length, 0)
            await h.click(label)
            const productReads = () => calls.filter(url => url.includes('/products?'))
            assert.equal(productReads().length, 1)
            assert.match(productReads()[0], /limit=100/)
            await h.click('Load more products')
            assert.equal(productReads().length, 2)
            assert.match(productReads()[1], /page=2/)
            assert.match(h.text(), /Product 1/)
            assert.match(h.text(), /Product 2/)
        } finally { await h.close() }
    })
}

test('setup assistant uses one maintained snapshot and keeps unknown checks distinct', async () => {
    const calls: string[] = []
    const h = await mount('assistant', async url => {
        calls.push(url)
        return json({ productsCount: 3, shippingZonesCount: 1, paymentConfigured: null, themeCustomized: true, domainConfigured: true, published: true })
    })
    try {
        assert.equal(calls.length, 1)
        assert.match(calls[0], /\/alpha\/dashboard\/setup$/)
        assert.doesNotMatch(calls[0], /store-data/)
        assert.match(h.text(), /Status unavailable/)
        assert.doesNotMatch(h.text(), /All setup tasks complete/)
    } finally { await h.close() }
})

for (const kind of Object.keys(contentPages) as ContentPage[]) {
    test(`${kind} discards a slow retired read without replacing the new store's rows`, async () => {
        const old = deferred<Response>(), signals: AbortSignal[] = []
        const h = await mount(kind, async (url, init) => {
            if (url.includes('/alpha/')) { if (init?.signal) signals.push(init.signal); return old.promise }
            return json([])
        })
        try {
            await h.render('beta')
            assert.equal(signals[0]?.aborted, true)
            await act(async () => old.resolve(json([{ id: 'old', name: 'PRIVATE-OLD', title: 'PRIVATE-OLD', content: 'PRIVATE-OLD', full_name: 'PRIVATE-OLD', email: 'old@example.invalid', code: 'PRIVATE-OLD', is_visible: true, status: 'pending', proficiency: 50, created_at: '2026-10-21' }])))
            assert.doesNotMatch(h.text(), /PRIVATE-OLD/)
        } finally { await h.close() }
    })
}

for (const kind of ['purchasing', 'transfers'] as const) {
    test(`${kind} primary records settle when optional location reads stall or fail`, async () => {
        const locations = deferred<Response>()
        const h = await mount(kind, async url => url.includes('inventory-locations') ? locations.promise : warehouseResponse(url,[]))
        try {
            assert.match(h.text(), kind === 'purchasing' ? /No purchase orders yet/ : /No transfers yet/)
            await act(async () => locations.resolve(json(null,503)))
            assert.match(h.text(), /Inventory locations could not be loaded/)
            assert.match(h.text(), /Retry locations/)
            assert.doesNotMatch(h.text(), /No inventory locations|Not enough inventory locations/)
        } finally { await h.close() }
    })
}

test('theme library starts alongside catalog metadata and never flashes false empty success', async () => {
    const pending = deferred<Response>(), calls: string[] = []
    const h = await mount('themeLibrary', async url => { calls.push(url); return pending.promise })
    try {
        assert.equal(calls.length,1,'the handle-scoped library must not wait for catalog UUID metadata')
        assert.doesNotMatch(h.text(), /No themes installed yet/)
        await act(async () => pending.resolve(Response.json({data:[]})))
        assert.match(h.text(), /No themes installed yet/)
    } finally { await h.close() }
})

function settingsResponse(url: string) {
    if (url.includes('/settings')) return json({ id: 'site-a', name: 'Current store', business_profile: {}, site_settings: {} })
    if (url.includes('/navigation')) return json({ items: [] })
    if (url.includes('/localization')) return json({ locales: [], default_locale: 'en', currency: 'INR', timezone: 'Asia/Kolkata' })
    if (url.endsWith('/kyc')) return json({ overall_status: 'not_started', provider_mode: 'sandbox', required_documents: [], documents: [] })
    if (url.endsWith('/commission')) return json({ currency: 'INR', schedule: { commission_bps: 0, gst_bps: 1800 }, summary: { gross_amount_minor: 0 } })
    return json([])
}

for (const kind of ['generalSettings','checkoutSettings','policySettings','notificationSettings','businessSettings','storefrontPages','segments'] as const) {
    test(`${kind} retires a previous store's response body even when transport ignores cancellation`, async () => {
        const oldBody = deferred<unknown>()
        let held = false
        let oldSignal: AbortSignal | null | undefined
        const h = await mount(kind, async (url, init) => {
            if (url.includes('/alpha/') && !held) {
                held = true; oldSignal = init?.signal
                const response = new Response('', { status: 200 })
                response.json = () => oldBody.promise
                return response
            }
            return settingsResponse(url)
        })
        try {
            await h.render('beta')
            assert.equal(oldSignal?.aborted, true, 'old scope must stop its read')
            const currentControls = h.controls()
            const lateData = kind === 'generalSettings' || kind === 'businessSettings' || kind === 'checkoutSettings'
                ? { id: 'old-site', name: 'PRIVATE-OLD', legal_name: 'PRIVATE-OLD', business_profile: {}, site_settings: { checkout: { contact_method: 'phone', order_notes: true } } }
                : kind === 'notificationSettings' ? [{ id: 'old', channel: 'email', category: 'orders', enabled: false }]
                : [{ id: 'old', title: 'PRIVATE-OLD', name: 'PRIVATE-OLD', body: 'PRIVATE-OLD', policy_type: 'privacy', rules: {}, created_at: '2026-10-21', updated_at: '2026-10-21' }]
            await act(async () => oldBody.resolve({ data: lateData }))
            assert.ok(!h.text().includes('PRIVATE-OLD'), h.text())
            assert.deepEqual(h.controls(), currentControls, 'late old-store data must not replace editable controls')
            assert.ok(!h.text().includes('could not load'), h.text())
        } finally { await h.close() }
    })
}

test('business identity becomes editable while verification and commission are stalled', async () => {
    const optional = deferred<Response>()
    const h = await mount('businessSettings', async url => url.endsWith('/kyc') || url.endsWith('/commission') ? optional.promise : settingsResponse(url))
    try {
        assert.ok(h.text().includes('Business identity'), h.text())
        assert.ok(h.text().includes('Checking verification and settlement fees'), h.text())
    } finally { await h.close(); optional.resolve(json({})) }
})

test('business identity survives unavailable optional verification with an explicit retry', async () => {
    const h = await mount('businessSettings', async url => url.endsWith('/kyc') ? new Response('', { status: 503 }) : settingsResponse(url))
    try {
        assert.ok(h.text().includes('Business identity'), h.text())
        assert.ok(h.text().includes('Verification status could not load'), h.text())
        assert.ok(h.text().includes('Retry status'), h.text())
    } finally { await h.close() }
})

test('theme releases reuse captured merchant identity without downloading editor data', async () => {
    const calls: string[] = []
    const h = await mount('themeUpdate', async url => { calls.push(url); return json([]) })
    try {
        assert.equal(calls.length, 1, JSON.stringify(calls))
        assert.ok(calls[0].includes('/releases?'), calls[0])
        assert.ok(h.text().includes('Update theme'), h.text())
    } finally { await h.close() }
})

test('read deadline settles general settings into a recoverable error', async () => {
    const originalTimeout = AbortSignal.timeout
    AbortSignal.timeout = () => originalTimeout(5)
    const h = await mount('generalSettings', async (_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Read timed out', 'TimeoutError')), { once: true })
    }))
    try {
        await h.pause(30)
        assert.ok(h.text().includes('Read timed out'), h.text())
        assert.ok(h.text().includes('Retry'), h.text())
    } finally { await h.close(); AbortSignal.timeout = originalTimeout }
})

for (const kind of ['loyalty', 'previewUpdate'] as const) {
    test(`${kind} stalled reads settle into a retry after the read deadline`, async () => {
        const originalTimeout = AbortSignal.timeout
        AbortSignal.timeout = () => originalTimeout(5)
        const h = await mount(kind, async (_url, init) => new Promise((_resolve, reject) => {
            const fail = () => reject(new DOMException('Read timed out', 'TimeoutError'))
            if (init?.signal?.aborted) fail()
            else init?.signal?.addEventListener('abort', fail, { once: true })
        }))
        try {
            if (kind === 'previewUpdate') await h.click('Preview update')
            await h.pause(30)
            assert.match(h.text(), /Read timed out/)
            assert.match(h.text(), kind === 'loyalty' ? /Retry loading loyalty/ : /Preview update/)
            assert.doesNotMatch(h.text(), /Loading loyalty settings|Previewing\.\.\./)
        } finally { await h.close(); AbortSignal.timeout = originalTimeout }
    })
}

test('loyalty scope retirement cancels the old read and refuses its late snapshot', async () => {
    const old = deferred<Response>(), signals: AbortSignal[] = []
    const h = await mount('loyalty', async (url, init) => {
        if (url.includes('/alpha/')) { signals.push(init!.signal!); return old.promise }
        return Response.json({ success: true, data: { store_id: 'beta', enrolled: false, program: null, outstanding_points: '0', valuation_policy: 'block_decrease_while_outstanding', value_decrease_allowed: true } })
    })
    try {
        await h.render('beta')
        assert.ok(signals[0]?.aborted)
        await act(async () => old.resolve(Response.json({ success: true, data: { store_id: 'alpha', enrolled: false, program: null, outstanding_points: '777777', valuation_policy: 'block_decrease_while_outstanding', value_decrease_allowed: true } })))
        assert.match(h.text(), /Loyalty is not set up/)
        assert.doesNotMatch(h.text(), /777,777/)
    } finally { await h.close() }
})

test('theme preview retires a successful old-store body before it can supply an apply hash', async () => {
    const body = deferred<unknown>(), signals: AbortSignal[] = []
    const h = await mount('previewUpdate', async (_url, init) => {
        signals.push(init!.signal!)
        return { ok: true, json: () => body.promise } as Response
    })
    try {
        await h.click('Preview update')
        await h.render('beta')
        assert.ok(signals[0]?.aborted)
        await act(async () => body.resolve({ diff: { diffHash: 'PRIVATE-OLD-DIFF', compatible: true, requiresDuplicate: false, rows: [] } }))
        assert.match(h.text(), /Preview update/)
        assert.doesNotMatch(h.text(), /Refresh preview|PRIVATE-OLD-DIFF/)
    } finally { await h.close() }
})

test('inventory reaches later records through bounded pages instead of loading all stock levels', async () => {
    const calls: string[] = []
    const h = await mount('inventory', async url => {
        calls.push(url)
        const second = url.includes('page=2')
        return Response.json({ data: [{ id: second ? 'b' : 'a', product_id: 'p', product_name: second ? 'Later stock level' : 'First stock level', available: 5 }], meta: { total: 101, has_next: !second } })
    })
    try {
        assert.ok(h.text().includes('101 tracked'), h.text())
        await h.click('Next page')
        assert.ok(h.text().includes('Later stock level'), h.text())
        assert.ok(!h.text().includes('First stock level'), h.text())
        assert.equal(calls.length,2,JSON.stringify(calls))
        assert.ok(calls.every(url => url.includes('limit=100')),JSON.stringify(calls))
        assert.ok(calls[1].includes('page=2'),calls[1])
    } finally { await h.close() }
})

test('plan status and paid amount settle while optional catalog descriptions are stalled', async () => {
    const catalog = deferred<Response>()
    const h = await mount('planSettings', async url => url.startsWith('/api/plans?') ? catalog.promise : json({ store: { site_type: 'store' }, subscription: { id: 'sub', plan: 'growth', plan_name: 'Growth', status: 'active', billing_period: 'monthly', amount_paid: 2500 } }))
    try {
        assert.ok(h.text().includes('Growth'),h.text())
        assert.ok(h.text().includes('paid'),h.text())
    } finally { await h.close(); catalog.resolve(json([])) }
})


test('export queues the canonical job, never downloads list pages, and exposes the complete ready file', async () => {
    const calls: string[] = [], ready = deferred<Response>()
    const h = await mount('exportPage', async (url, init) => {
        calls.push(`${init?.method || 'GET'} ${url}`)
        if (init?.method === 'POST') return json({ job: { id: 'export-a', type: 'products', status: 'queued', row_count: 0 } }, 202)
        return ready.promise
    })
    try {
        await h.click('Export Products')
        assert.match(h.text(), /Preparing export/)
        assert.deepEqual(calls, ['POST /api/stores/alpha/exports', 'GET /api/stores/alpha/exports/export-a'])
        await act(async () => ready.resolve(json({ job: { id: 'export-a', type: 'products', status: 'completed', row_count: 1103 } })))
        assert.match(h.text(), /1,103 records are ready/)
        const link = document.querySelector('a[download]')
        assert.equal(link?.getAttribute('href'), '/api/stores/alpha/exports/export-a/download')
        assert.equal(link?.getAttribute('download'), 'products.csv')
    } finally { await h.close() }
})

test('export polling retry checks the same job without starting another export', async () => {
    const calls: string[] = []
    const h = await mount('exportPage', async (url, init) => {
        calls.push(`${init?.method || 'GET'} ${url}`)
        if (init?.method === 'POST') return json({ job: { id: 'export-a', type: 'products', status: 'queued', row_count: 0 } }, 202)
        return calls.length === 2 ? new Response('', { status: 503 }) : json({ job: { id: 'export-a', type: 'products', status: 'completed', row_count: 0 } })
    })
    try {
        await h.click('Export Products')
        assert.match(h.text(), /Unable to check export/)
        await h.click('Check again')
        assert.match(h.text(), /Export ready/)
        assert.equal(calls.filter(call => call.startsWith('POST')).length, 1)
        assert.equal(calls.filter(call => call.startsWith('GET')).length, 2)
    } finally { await h.close() }
})

test('export scope retirement cancels polling and refuses a late old-store ready file', async () => {
    const old = deferred<Response>(), signals: AbortSignal[] = []
    const h = await mount('exportPage', async (_url, init) => {
        if (init?.method === 'POST') return json({ job: { id: 'private-old', type: 'products', status: 'queued', row_count: 0 } }, 202)
        signals.push(init!.signal!); return old.promise
    })
    try {
        await h.click('Export Products')
        await h.render('beta')
        assert.ok(signals[0].aborted)
        await act(async () => old.resolve(json({ job: { id: 'private-old', type: 'products', status: 'completed', row_count: 777777 } })))
        assert.doesNotMatch(h.text(), /Export ready|777,777/)
        assert.equal(document.querySelector('a[download]'), null)
    } finally { await h.close() }
})


test('export retires a captured account even when the store URL is unchanged', async () => {
    const old = deferred<Response>(), signals: AbortSignal[] = []
    const h = await mount('exportPage', async (_url, init) => {
        if (init?.method === 'POST') return json({ job: { id: 'old-actor-job', type: 'products', status: 'queued', row_count: 0 } }, 202)
        signals.push(init!.signal!); return old.promise
    })
    try {
        await h.click('Export Products')
        await h.render('alpha', 'actor-b')
        assert.ok(signals[0].aborted)
        await act(async () => old.resolve(json({ job: { id: 'old-actor-job', type: 'products', status: 'completed', row_count: 777777 } })))
        assert.doesNotMatch(h.text(), /Export ready|777,777/)
        assert.equal(document.querySelector('a[download]'), null)
    } finally { await h.close() }
})

test('CSV import rejects an oversized file before reading it or sending a command', async () => {
    let reads = 0, commands = 0
    const h = await mount('exportPage', async () => { commands++; throw new Error('unexpected command') })
    try {
        await h.file({ name: 'large.csv', size: 3 * 1_048_576 + 1, text: async () => { reads++; return '' } })
        await h.click('Import CSV')
        assert.match(h.text(), /This CSV is too large/)
        assert.equal(reads, 0)
        assert.equal(commands, 0)
    } finally { await h.close() }
})

test('CSV import checks the same job after a read failure and displays the committed row count', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const h = await mount('exportPage', async (url, init) => {
        calls.push({ url, init })
        if (init?.method === 'POST') return json({ job: { id: 'import-a', type: 'product_import', status: 'queued', row_count: 0 } }, 202)
        if (calls.length === 2) return new Response('', { status: 503 })
        return json({ job: { id: 'import-a', type: 'product_import', status: 'completed', row_count: 2 } })
    })
    try {
        const csv = 'name,description\r\n"東京","  First\r\nSecond  "\r\n'
        await h.file({ name: 'quoted.csv', size: Buffer.byteLength(csv), text: async () => csv })
        await h.click('Import CSV')
        assert.match(h.text(), /Unable to check import/)
        await h.click('Check import again')
        assert.match(h.text(), /Import complete[\s\S]*2 products imported/)
        assert.equal(calls.length, 3)
        assert.deepEqual(calls.map(call => call.url), ['/api/stores/alpha/products/import', '/api/stores/alpha/exports/import-a', '/api/stores/alpha/exports/import-a'])
        assert.equal(calls[0].init?.body, JSON.stringify({ csv }))
        assert.equal(calls[0].init?.signal, undefined, 'progress read deadlines do not abort or replay the import command')
        assert.equal(document.querySelector('a[download]'), null, 'imports never expose an export download action')
    } finally { await h.close() }
})

test('CSV import retires late status and command acknowledgements when the captured account changes', async () => {
    for (const stage of ['command', 'status'] as const) {
        const late = deferred<Response>(), signals: AbortSignal[] = []
        const h = await mount('exportPage', async (_url, init) => {
            if (init?.method === 'POST') return stage === 'command' ? late.promise : json({ job: { id: 'old-import', type: 'product_import', status: 'queued', row_count: 0 } }, 202)
            signals.push(init!.signal!); return late.promise
        })
        try {
            await h.file({ name: 'old.csv', size: 11, text: async () => 'name\nItem\n' })
            await h.click('Import CSV')
            await h.render('alpha', 'actor-b')
            if (stage === 'status') assert.ok(signals[0]?.aborted)
            await act(async () => late.resolve(json({ job: { id: 'old-import', type: 'product_import', status: 'completed', row_count: 777777 } })))
            assert.doesNotMatch(h.text(), /777,777|Import complete|import-a|old-import/)
            if (stage === 'command') assert.doesNotMatch(h.text(), /Import queued/)
        } finally { await h.close() }
    }
})

test('CSV import lost acknowledgement reports uncertainty and never automatically replays the command', async () => {
    let commands = 0
    const h = await mount('exportPage', async () => { commands++; throw new TypeError('fetch failed') })
    try {
        await h.file({ name: 'import.csv', size: 10, text: async () => 'name\nItem\n' })
        await h.click('Import CSV')
        assert.match(h.text(), /could not be confirmed[\s\S]*Some products may already exist/)
        assert.equal(commands, 1)
        assert.doesNotMatch(h.text(), /Import complete|Import queued/)
    } finally { await h.close() }
})

const checkoutSetup = (store = 'alpha', active = false) => ({
    site_id: '11111111-1111-4111-8111-111111111111', hostname: `checkout.${store}.shops.example.invalid`, parent_hostname: 'shops.example.invalid',
    source: 'platform', status: active ? 'active' : 'pending', ssl_status: active ? 'active' : 'pending',
    checkout_origin: active ? `https://checkout.${store}.shops.example.invalid` : 'https://checkout.letbuyy.com',
    fallback_origin: 'https://checkout.letbuyy.com', reason: null, dns_records: [],
})

test('checkout readiness is read first; platform provisioning is automatic and a manual recheck preserves fallback', async () => {
    const methods: string[] = []
    const h = await mount('checkoutDomain', async (_url, init) => {
        methods.push(init?.method || 'GET')
        return json(checkoutSetup('alpha', methods.length > 2), methods.length === 2 ? 202 : 200)
    })
    try {
        assert.deepEqual(methods, ['GET'])
        assert.match(h.text(), /Preparing/)
        assert.match(h.text(), /provisions this address automatically/)
        await h.click('Check status')
        assert.deepEqual(methods, ['GET', 'POST'])
        assert.match(h.text(), /Preparing/)
        await h.click('Check status')
        assert.match(h.text(), /Checkout links use this verified address/)
        assert.match(h.text(), /HTTPS ready/)
    } finally { await h.close() }
})

test('checkout domain read failure offers a read retry without claiming ready or making a provider change', async () => {
    const methods: string[] = []
    const h = await mount('checkoutDomain', async (_url, init) => {
        methods.push(init?.method || 'GET')
        return methods.length === 1 ? json(null, 503) : json(checkoutSetup())
    })
    try {
        assert.match(h.text(), /Checkout address unavailable/)
        assert.doesNotMatch(h.text(), /Checkout links use|HTTPS ready/)
        await h.click('Retry')
        assert.deepEqual(methods, ['GET', 'GET'])
        assert.match(h.text(), /checkout.alpha.shops.example.invalid/)
    } finally { await h.close() }
})

test('checkout domain retires a late response from the previous store even if transport ignores abort', async () => {
    const previous = deferred<Response>()
    const h = await mount('checkoutDomain', async url => url.includes('/alpha/') ? previous.promise : json(checkoutSetup('beta', true)))
    try {
        await h.render('beta')
        assert.match(h.text(), /checkout.beta.shops.example.invalid/)
        await act(async () => previous.resolve(json(checkoutSetup('alpha', true))))
        assert.doesNotMatch(h.text(), /checkout.alpha.shops.example.invalid/)
        assert.match(h.text(), /checkout.beta.shops.example.invalid/)
    } finally { await h.close() }
})

const customCheckout = (active = false) => ({ ...checkoutSetup('alpha', active), source: 'custom', parent_hostname: 'shop.example.invalid', hostname: 'checkout.shop.example.invalid', checkout_origin: active ? 'https://checkout.shop.example.invalid' : 'https://checkout.letbuyy.com', dns_records: [{ type: 'CNAME', name: 'checkout.shop.example.invalid', value: 'exact-provider.example.invalid' }] })
const connectedDomain = () => ({ domain: 'shop.example.invalid', status: 'pending', role: 'primary', provider: 'Cloudflare', checkout: customCheckout(), records: { txt: { name: '_letbuyy-challenge.shop.example.invalid', value: 'synthetic-public-claim' }, cname: { name: 'shop.example.invalid', value: 'exact-provider.example.invalid' } } })

test('domain wizard supplies both DNS addresses and cannot complete on storefront readiness alone', async () => {
    let checks = 0
    const h = await mount('connectDomain', async (url, init) => {
        assert.equal(init?.method, 'POST')
        if (url.endsWith('/domains')) return json(connectedDomain(), 201)
        if (url.endsWith('/verify')) return json({ domain: 'shop.example.invalid', status: 'active', txt_verified: true, cname_verified: true, customer_verification: { status: 'ready' }, checkout: customCheckout() })
        assert.ok(url.endsWith('/checkout'))
        return json(customCheckout(++checks > 1), checks > 1 ? 200 : 202)
    })
    try {
        await h.click('Continue')
        assert.match(h.text(), /checkout.shop.example.invalid/)
        assert.match(h.text(), /exact-provider.example.invalid/)
        assert.doesNotMatch(h.text(), /ALIAS.*Unknown|checkout.alpha.shop/)
        await h.click('Check setup')
        assert.equal(h.completions(), 0)
        assert.match(h.text(), /Storefront ready · checkout pending/)
        await h.click('Check setup')
        assert.equal(h.completions(), 1)
        assert.match(h.text(), /Your domain setup is ready/)
    } finally { await h.close() }
})

test('domain wizard retains DNS instructions after an uncertain provider response and retires old-store completions', async () => {
    const old = deferred<Response>()
    const h = await mount('connectDomain', async (url) => {
        if (url.endsWith('/domains')) return json(connectedDomain(), 201)
        return old.promise
    })
    try {
        await h.click('Continue'); await h.click('Check setup')
        await h.render('beta')
        await act(async () => old.resolve(json({ domain: 'shop.example.invalid', status: 'active', checkout: customCheckout(true) })))
        assert.equal(h.completions(), 0)
    } finally { await h.close() }
})

test('domain wizard cannot declare completion when HTTPS works but customer verification is unavailable or at capacity', async () => {
    for (const status of ['capacity_reached', 'unavailable', 'configuration_required', 'pending']) {
        const h = await mount('connectDomain', async url => {
            if (url.endsWith('/domains')) return json(connectedDomain(), 201)
            if (url.endsWith('/verify')) return json({ domain: 'shop.example.invalid', status: 'active', customer_verification: { status }, checkout: customCheckout(true) })
            return json(customCheckout(true))
        })
        try {
            await h.click('Continue'); await h.click('Check setup')
            assert.equal(h.completions(), 0)
            assert.match(h.text(), /Customer verification pending/)
            assert.doesNotMatch(h.text(), /Your domain setup is ready|Domain setup complete/)
            if (status === 'capacity_reached') assert.match(h.text(), /verification capacity is full/)
        } finally { await h.close() }
    }
})

for (const kind of ['purchasing','transfers'] as const) test(`${kind} bounded location choices preserve draft and explicit selection across Load more`, async () => {
    const queries: URLSearchParams[] = []
    const h = await mount(kind, async (url) => {
        if (url.includes('inventory-locations')) {
            const query = new URL(url,'http://localhost').searchParams; queries.push(query)
            const page = Number(query.get('page'))
            const rows = Array.from({length:page===1?20:1},(_,i)=>({...locationOption((page-1)*20+i+1),name:`Choice ${(page-1)*20+i+1}`}))
            return Response.json({data:rows,meta:{store_id:historySite,page,per_page:20,total:21,total_is_exact:true,has_next:page===1}})
        }
        if (url.includes('/products?')) return json([{id:historyRecord().product_id,name:'Synthetic product',variants:[]}])
        if (url.includes('/suppliers?')) return warehouseResponse(url,[])
        return warehouseResponse(url,[])
    })
    try {
        await h.click(kind==='purchasing'?'Create purchase order':'Create transfer')
        const noteSelector = kind==='purchasing'?'input[placeholder="Internal notes about this order"]':'input[placeholder="Internal notes about this transfer"]'
        await h.setField(noteSelector,'Retained synthetic draft')
        await h.setField('select[required]',locationOption(1).id)
        await h.click('Load more locations')
        assert.equal(queries.length,2);assert.equal(queries[1].get('page'),'2');assert.equal(queries[1].get('status'),'active')
        assert.ok(h.controls().some(field=>field.value==='Retained synthetic draft'))
        assert.ok(h.controls().some(field=>field.value===locationOption(1).id))
        assert.match(h.text(),/Choice 21/)
    } finally { await h.close() }
})

for (const kind of ['purchasing','transfers'] as const) test(`${kind} delayed option page cannot return private choices after store A-B-A`, async () => {
    const pending = deferred<Response>()
    const h=await mount(kind,async url=>{
        if(url.includes('inventory-locations')) {
            const page=Number(new URL(url,'http://localhost').searchParams.get('page'))
            if(page===2)return pending.promise
            return Response.json({data:Array.from({length:20},(_,i)=>locationOption(i+1,url.includes('/alpha/')?historySite:'22222222-2222-4222-8222-222222222222')),
                meta:{store_id:url.includes('/alpha/')?historySite:'22222222-2222-4222-8222-222222222222',page:1,per_page:20,total:21,total_is_exact:true,has_next:true}})
        }
        if(url.includes('/products?'))return json([{id:historyRecord().product_id,name:'Synthetic product'}])
        return warehouseResponse(url,[])
    })
    try{
        await h.click(kind==='purchasing'?'Create purchase order':'Create transfer');await h.click('Load more locations')
        await h.render('beta');await h.render('alpha')
        await act(async()=>pending.resolve(Response.json({data:[{...locationOption(21),name:'Retired private option'}],meta:{store_id:historySite,page:2,per_page:20,total:21,total_is_exact:true,has_next:false}})))
        assert.doesNotMatch(h.text(),/Retired private option/)
    }finally{await h.close()}
})

for (const kind of ['purchasing','transfers'] as const) test(`${kind} filters query the full matching population and Clear restores canonical order`,async()=>{
    const reads:URLSearchParams[]=[]
    const h=await mount(kind,async url=>{
        if(url.includes(kind==='purchasing'?'/purchase-orders?':'/transfers?'))reads.push(new URL(url,'http://localhost').searchParams)
        return warehouseResponse(url,[])
    })
    try{
        await h.setField('form[aria-label="Warehouse filters"] input','SYN_%')
        await h.setField('select[name="warehouse-status"]','received')
        await h.setField('select[name="warehouse-sort"]','oldest')
        await h.click('Apply filters')
        assert.equal(reads.at(-1)!.get('search'),'SYN_%');assert.equal(reads.at(-1)!.get('status'),'received');assert.equal(reads.at(-1)!.get('sort'),'oldest');assert.equal(reads.at(-1)!.get('page'),'1')
        assert.match(h.text(),kind==='purchasing'?/No matching purchase orders/:/No matching transfers/)
        await h.click('Clear filters')
        assert.equal(reads.at(-1)!.has('search'),false);assert.equal(reads.at(-1)!.has('status'),false);assert.equal(reads.at(-1)!.get('sort'),'newest')
        assert.match(h.text(),kind==='purchasing'?/No purchase orders yet/:/No transfers yet/)
    }finally{await h.close()}
})
for (const kind of ['purchasing','transfers'] as const) test(`${kind} delayed filtered page retires across store A-B-A`,async()=>{
    const pending=deferred<Response>()
    const h=await mount(kind,async url=>url.includes('search=PrivateRetired')?pending.promise:warehouseResponse(url,[]))
    try{
        await h.setField('form[aria-label="Warehouse filters"] input','PrivateRetired');await h.click('Apply filters')
        await h.render('beta');await h.render('alpha')
        await act(async()=>pending.resolve(Response.json({data:[{...warehouseRow(kind==='purchasing'),po_number:'Retired filtered page',transfer_number:'Retired filtered page'}],meta:{store_id:historySite,page:1,per_page:20,total:1,total_is_exact:true,has_next:false}})))
        assert.doesNotMatch(h.text(),/Retired filtered page/);assert.ok(h.controls().every(field=>field.value!=='PrivateRetired'))
    }finally{await h.close()}
})

for(const kind of ['purchasing','transfers'] as const)test(`${kind} denied filtered reads retire counts and cannot imply an empty matching population`,async()=>{
    const h=await mount(kind,async url=>warehouseResponse(url,[],url.includes('search=DeniedQuery')?403:200))
    try{
        await h.setField('form[aria-label="Warehouse filters"] input','DeniedQuery');await h.click('Apply filters')
        assert.match(h.text(),/Count unavailable/);assert.doesNotMatch(h.text(),/No matching purchase orders|No matching transfers|0 matching records/)
        await h.click('Clear filters');assert.match(h.text(),/0 matching records/)
    }finally{await h.close()}
})


for(const kind of ['locations','suppliers'] as const){
 const supplier=kind==='suppliers',entity=supplier?'supplier':'location',operation=supplier?'supplier.create':'location.create';
 const row=(site=historySite)=>supplier?{id:'99999999-9999-4999-8999-999999999999',site_id:site,name:'Synthetic supplier',status:'active',created_at:'2026-11-01T00:00:00Z',contact_name:null,email:null,phone:null,address:{}}:{...locationOption(1,site),name:'Synthetic location'};
 function acknowledgement(body:Record<string,unknown>,actor='11111111-1111-4111-8111-111111111111'){
  const intent=prepareWarehouseCommand(operation,null,{...body,store_id:historySite}),command=intent.command;
  return {command_receipt:{id:'88888888-8888-4888-8888-888888888888',key:body.idempotency_key,site_id:historySite,actor_id:actor,operation,target_id:row().id,command,effective_lines:null,outcome:'applied'},lines:[],
   [entity]:{...row(),name:command.name,...(supplier?{contact_name:command.contact_name,email:command.email,phone:command.phone,address:command.address}:{is_default:command.is_default,address:Object.fromEntries(['address','city','state','country','pincode'].map(k=>[k,command[k]]))})}};
 }
 test(`${kind} actual form retains original creation after lost reply and recovers with same key`,async()=>{
  const writes:Array<{url:string;body:Record<string,unknown>;key:string|null}>=[];let ack:ReturnType<typeof acknowledgement>|null=null,committed=false;
  const h=await mount(kind,async(url,init)=>{
   if(init?.method==='POST'){
    const body=JSON.parse(String(init.body));writes.push({url,body,key:new Headers(init.headers).get('X-Idempotency-Key')});
    if(!ack)ack=acknowledgement(body);
    if(!committed){committed=true;throw new Error('Synthetic reply lost after commit')}
    return json(ack);
   }
   return warehouseResponse(url,committed?[row()]:[]);
  });
  try{
   await h.click(supplier?'Add supplier':'Add location');await h.setField('input[placeholder="'+(supplier?'e.g. Rajesh Traders':'e.g. Mumbai Warehouse')+'"]','Synthetic '+entity);
   await h.setField('input[placeholder="'+(supplier?'400001':'411019')+'"]',supplier?'400001':'411019');
   await h.dialogClick(supplier?'Add supplier':'Add location');
   assert.match(h.text(),/Close this form and resolve the saved original request/);assert.equal(writes.length,1);assert.ok(writes[0].key);
   await h.click('Cancel');assert.match(h.text(),/Warehouse request awaiting confirmation/);
   await h.remount();assert.match(h.text(),/Warehouse request awaiting confirmation/);await h.click('Retry original');
   assert.equal(writes.length,2);assert.deepEqual(writes[1],writes[0]);assert.doesNotMatch(h.text(),/Warehouse request awaiting confirmation/);
   assert.match(h.text(),/Synthetic (location|supplier)/);assert.equal(h.storage.length,0);
   assert.equal(supplier?(writes[0].body.address as Record<string,unknown>).pincode:writes[0].body.pincode,supplier?'400001':'411019');
  }finally{await h.close()}
 });
 test(`${kind} account/store switch retires a delayed create without old success or journal removal`,async()=>{
  const pending=deferred<Response>();let posted:Record<string,unknown>|null=null;
  const h=await mount(kind,async(url,init)=>{if(init?.method==='POST'){posted=JSON.parse(String(init.body));return pending.promise}return warehouseResponse(url,[])});
  try{
   await h.click(supplier?'Add supplier':'Add location');await h.setField('input[placeholder="'+(supplier?'e.g. Rajesh Traders':'e.g. Mumbai Warehouse')+'"]','Synthetic '+entity);
   await h.dialogClick(supplier?'Add supplier':'Add location');assert.ok(posted);await h.render('beta');
   await act(async()=>pending.resolve(json(acknowledgement(posted!))));assert.doesNotMatch(h.text(),/Creation could not be confirmed|Location created|Supplier created/);
   assert.equal(h.storage.length,1);await h.render('alpha');assert.match(h.text(),/Warehouse request awaiting confirmation/);
  }finally{await h.close()}
 });
 test(`${kind} failed page removes private rows and preserves Previous without a false empty count`,async()=>{
  const h=await mount(kind,async url=>url.includes('page=2')?json({},403):Response.json({data:Array.from({length:20},(_,i)=>({...row(),id:`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:'Private metadata '+i})),meta:{store_id:historySite,page:1,per_page:20,total:21,total_is_exact:true,has_next:true}}));
  try{assert.match(h.text(),/21 matching records/);await h.click('Next');assert.doesNotMatch(h.text(),/Private metadata|No suppliers yet|No locations yet|0 matching/);assert.match(h.text(),/Count unavailable/);await h.click('Previous');assert.match(h.text(),/Private metadata/)}finally{await h.close()}
 });
}
