import assert from 'node:assert/strict';
import test, {after, afterEach, before} from 'node:test';
import {Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest, restJson} from './gateway-harness';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant, seedSyntheticTenant, type SyntheticTenant} from './synthetic-tenant';
import type {SmartCondition, SmartMatchType} from '../../lib/smart-collection-eval';

// Real worker + owned PostgREST/PG. This retains the current owner-only boundary.
// No application/schema changes, fabricated positive result, or protected-row cleanup.
const owned = requireOwnedDatabase();
const {psql} = owned;
let gateway: Gateway;
const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const json = (s: string) => JSON.parse(psql(s));
before(async () => {gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));});
afterEach(async () => {await gateway.settle();});
after(async () => {await gateway?.settle();});

function world(tag: string) {
    const a = newSyntheticTenant(tag + '-a'), b = newSyntheticTenant(tag + '-b');
    seedSyntheticTenant(psql, a); seedSyntheticTenant(psql, b);
    const owner = crypto.randomUUID(), other = crypto.randomUUID(), staff = crypto.randomUUID();
    const email = (id: string) => 'syn-sc-' + id + '@example.invalid';
    for (const id of [owner, other, staff]) {
        psql('INSERT INTO users_custom(id,email,email_verified) VALUES(' + quote(id) + ',' + quote(email(id)) + ',true);');
    }
    psql('UPDATE sites SET custom_user_id=' + quote(owner) + ' WHERE id=' + quote(a.siteId) + ';' +
        'UPDATE sites SET custom_user_id=' + quote(other) + ' WHERE id=' + quote(b.siteId) + ';' +
        'INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions) VALUES(' +
        [quote(staff), quote(email(staff)), quote(a.siteId), "'editor'", "'active'", 'true', quote(JSON.stringify({granted: ['products:read', 'products:write']}))].join(',') + ');');
    return {a, b, owner, other, staff, email};
}
type World = ReturnType<typeof world>;

function product(site: SyntheticTenant, options: {name?: string; stock?: number; active?: boolean; deleted?: boolean; price?: number} = {}) {
    const id = crypto.randomUUID();
    psql('INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,product_type,vendor,tags,deleted_at) VALUES(' +
        [quote(id), quote(site.siteId), quote(site.siteId), quote(options.name ?? 'SYN-MATCH Shoe'), quote('syn-sc-' + id),
            String(options.price ?? 100), String(options.stock ?? 5), String(options.active !== false),
            quote(options.active === false ? 'draft' : 'active'), "'Footwear'", "'Synthetic Vendor'", "ARRAY['synthetic','sale']::text[]",
            options.deleted ? 'now()' : 'NULL'].join(',') + ');');
    return id;
}
function collection(site: SyntheticTenant, conditions: SmartCondition[], matchType: SmartMatchType = 'all', deleted = false) {
    const id = crypto.randomUUID();
    psql('INSERT INTO smart_collections(id,store_id,name,slug,conditions,match_type,deleted_at) VALUES(' +
        [quote(id), quote(site.siteId), quote('Synthetic saved rules ' + id), quote('syn-sc-' + id), quote(JSON.stringify(conditions)) + '::jsonb', quote(matchType), deleted ? 'now()' : 'NULL'].join(',') + ');');
    return id;
}
async function request(w: World, path: string, actor = w.owner, sessionStore = w.a.siteId) {
    return gateway.request(path, {headers: await signedIdentityHeaders(actor, w.email(actor), sessionStore)});
}
const preview = (w: World, id: string, actor = w.owner, store = w.a.siteId) => request(w, '/v1/smart-collections/' + id + '/preview?store_id=' + w.a.siteId, actor, store);

function snapshot(w: World) {
    const sites = [quote(w.a.siteId), quote(w.b.siteId)].join(',');
    const productScope = 'SELECT id FROM products WHERE store_id IN (' + sites + ')';
    const predicates: Record<string, string> = {
        smart_collections: 'store_id IN (' + sites + ')', products: 'store_id IN (' + sites + ')',
        product_variants: 'product_id IN (' + productScope + ')', inventory_levels: 'store_id IN (' + sites + ')',
        inventory_adjustments: 'product_id IN (' + productScope + ')',
        outbox_events: 'store_id IN (' + sites + ') OR site_id IN (' + sites + ')', idempotency_keys: 'site_id IN (' + sites + ')',
    };
    // Optional receipt snapshots conserve these tables when present, without
    // making this independent read suite depend on migration 346 or 356.
    if (psql("SELECT to_regclass('public.inventory_adjustment_receipts') IS NOT NULL;") === 't') {
        predicates.inventory_adjustment_receipts = 'store_id IN (' + sites + ')';
    }
    const result: Record<string, unknown> = {};
    for (const [table, where] of Object.entries(predicates)) {
        result[table] = json("SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public." + table + ' t WHERE ' + where + ';');
    }
    return result;
}
function assertPreview(response: Awaited<ReturnType<typeof preview>>, id: string) {
    assert.equal(response.status, 200, response.text);
    assert.equal(response.json?.success, true);
    assert.equal(response.json?.data.collection_id, id);
    return response.json!.data;
}

test('saved owner rules read canonical product name and stock with actual schema and tenant/filter conservation', async () => {
    const columns: string[] = json("SELECT jsonb_agg(column_name ORDER BY column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='products';");
    assert.ok(columns.includes('name') && columns.includes('stock'));
    assert.equal(columns.includes('title'), false);
    assert.equal(columns.includes('inventory_quantity'), false);
    console.info('OWNED_SMART_COLLECTION_SCHEMA ' + JSON.stringify({canonical: ['name', 'stock'], absent: ['title', 'inventory_quantity']}));
    const w = world('sc-p1');
    const match = product(w.a), nonmatch = product(w.a, {name: 'Synthetic Nonmatch', stock: 0});
    product(w.a, {deleted: true}); product(w.a, {active: false}); product(w.b);
    // Seed one real nonempty stock audit/outbox/cache baseline with the unchanged writer.
    psql('SELECT set_inventory_level_available(' + [quote(match), 'NULL', quote(w.a.locationId), '5', quote(w.owner)].join(',') + ');');
    const id = collection(w.a, [{field: 'title', op: 'contains', value: 'SYN-MATCH'}, {field: 'inventory_quantity', op: 'gt', value: '0'}]);
    const before = snapshot(w);
    const listed = await request(w, '/v1/smart-collections?store_id=' + w.a.siteId);
    assert.equal(listed.status, 200, listed.text);
    assert.equal(listed.json?.data.find((row: {id: string}) => row.id === id)?.version, 1);
    const data = assertPreview(await preview(w, id), id);
    assert.equal(data.match_type, 'all'); assert.equal(data.condition_count, 2);
    assert.equal(data.count, 1); assert.equal(data.evaluated_of, 2);
    assert.deepEqual(data.sample_product_ids, [match]); assert.notEqual(match, nonmatch);
    assert.deepEqual(snapshot(w), before);
});

test('saved all/any rules retain canonical title, inventory, tag, type, vendor and numeric price vocabulary', async () => {
    const w = world('sc-p2'); const shoe = product(w.a), other = product(w.a, {name: 'Synthetic Other', stock: 0, price: 50});
    const cases: {conditions: SmartCondition[]; type?: SmartMatchType; expected: string[]}[] = [
        {conditions: [{field: 'title', op: 'equals', value: 'syn-match shoe'}], expected: [shoe]},
        {conditions: [{field: 'inventory_quantity', op: 'gt', value: '0'}], expected: [shoe]},
        {conditions: [{field: 'price', op: 'gt', value: '75'}], expected: [shoe]},
        {conditions: [{field: 'tag', op: 'equals', value: 'sale'}, {field: 'product_type', op: 'equals', value: 'footwear'}, {field: 'vendor', op: 'contains', value: 'synthetic'}], expected: [shoe, other]},
        {conditions: [{field: 'title', op: 'contains', value: 'absent'}, {field: 'price', op: 'lt', value: '75'}], type: 'any', expected: [other]},
    ];
    const ids = cases.map(item => collection(w.a, item.conditions, item.type));
    const before = snapshot(w);
    for (const [index, item] of cases.entries()) {
        const data = assertPreview(await preview(w, ids[index]), ids[index]);
        assert.equal(data.count, item.expected.length); assert.equal(data.evaluated_of, 2);
        assert.deepEqual([...data.sample_product_ids].sort(), [...item.expected].sort());
        assert.equal(data.match_type, item.type ?? 'all');
    }
    assert.deepEqual(snapshot(w), before);
});

test('current owner-only preview preserves staff, foreign tenant, bound-store and missing/deleted denials', async () => {
    const w = world('sc-p3'); product(w.a); product(w.b);
    const id = collection(w.a, []), foreign = collection(w.b, []), deleted = collection(w.a, [], 'all', true);
    const before = snapshot(w);
    for (const actor of [w.staff, w.other]) {
        const list = await request(w, '/v1/smart-collections?store_id=' + w.a.siteId, actor);
        assert.equal(list.status, 403, list.text);
        const denied = await preview(w, id, actor); assert.equal(denied.status, 403, denied.text);
        assert.equal(denied.json?.data, undefined);
    }
    // Intentional root-reviewed privacy correction: within the verified A
    // scope, a foreign id is indistinguishable from a nonexistent id (404).
    const hidden = await preview(w, foreign);
    assert.equal(hidden.status, 404, hidden.text); assert.equal(hidden.json?.data, undefined);
    // Separately request B with an unbound owner identity. The canonical
    // current-owner check must deny the requested store itself with 403.
    const unauthorizedStore = await gateway.request('/v1/smart-collections/' + foreign + '/preview?store_id=' + w.b.siteId,
        {headers: await signedIdentityHeaders(w.owner, w.email(w.owner))});
    for (const response of [unauthorizedStore, await preview(w, id, w.owner, w.b.siteId)]) {
        assert.equal(response.status, 403, response.text); assert.equal(response.json?.data, undefined);
    }
    for (const missing of [crypto.randomUUID(), deleted]) {
        const response = await preview(w, missing); assert.equal(response.status, 404, response.text); assert.equal(response.json?.data, undefined);
    }
    assert.deepEqual(snapshot(w), before);
});

test('a prior owner cannot preview saved rules after live ownership revocation and normal access returns only after restoration', async () => {
    const w = world('sc-p4'); const match = product(w.a), id = collection(w.a, []);
    assert.deepEqual(assertPreview(await preview(w, id), id).sample_product_ids, [match]);
    psql('UPDATE sites SET custom_user_id=' + quote(w.other) + ' WHERE id=' + quote(w.a.siteId) + ';');
    try {
        const before = snapshot(w), denied = await preview(w, id);
        assert.equal(denied.status, 403, denied.text); assert.equal(denied.json?.data, undefined);
        assert.deepEqual(snapshot(w), before);
    } finally {psql('UPDATE sites SET custom_user_id=' + quote(w.owner) + ' WHERE id=' + quote(w.a.siteId) + ';');}
    const before = snapshot(w);
    assert.deepEqual(assertPreview(await preview(w, id), id).sample_product_ids, [match]);
    assert.deepEqual(snapshot(w), before);
});

test('collection and product read failures stay visible and restored retries evaluate saved rules without effects', async () => {
    const w = world('sc-p5'); const match = product(w.a), id = collection(w.a, []), before = snapshot(w);
    for (const resource of ['smart_collections', 'products']) {
        let failedReads = 0;
        const tap = tapRest(owned.restUrl, async (call, forward) => {
            if (call.method === 'GET' && call.resource === resource) {
                failedReads += 1;
                return restJson(503, {code: 'XX000', message: 'relation "syn_private_preview_fault" does not exist', details: 'synthetic-private-detail', hint: 'synthetic-private-hint'});
            }
            return forward();
        });
        try {
            const failed = await preview(w, id);
            assert.equal(failed.status, 500, failed.text); assert.equal(failedReads, 1);
            assert.equal(failed.json?.data, undefined);
            assert.doesNotMatch(failed.text, /syn_private_preview_fault|synthetic-private-detail|synthetic-private-hint/);
            assert.deepEqual(snapshot(w), before);
        } finally {tap.restore();}
        assert.deepEqual(assertPreview(await preview(w, id), id).sample_product_ids, [match]);
        assert.deepEqual(snapshot(w), before);
    }
});

test('the 500-product bound and ten-id sample remain explicit and repeated preview never writes business state', async () => {
    const w = world('sc-p6');
    psql('INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status) SELECT gen_random_uuid(),' + quote(w.a.siteId) + ',' + quote(w.a.siteId) + ", 'Synthetic capped product '||n,'syn-sc-cap-'||gen_random_uuid(),100,7,true,'active' FROM generate_series(1,501) n;");
    product(w.a, {deleted: true}); product(w.a, {active: false}); product(w.b);
    const id = collection(w.a, []), before = snapshot(w);
    const actualOwnIds: string[] = json('SELECT jsonb_agg(id) FROM products WHERE store_id=' + quote(w.a.siteId) + ' AND is_active AND deleted_at IS NULL;');
    assert.equal(actualOwnIds.length, 501);
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const data = assertPreview(await preview(w, id), id);
        assert.equal(data.evaluated_of, 500); assert.equal(data.capped_at, 500); assert.equal(data.count, 500);
        assert.equal(data.sample_product_ids.length, 10); assert.equal(new Set(data.sample_product_ids).size, 10);
        assert.ok(data.sample_product_ids.every((value: string) => actualOwnIds.includes(value)));
        assert.deepEqual(snapshot(w), before);
    }
});
