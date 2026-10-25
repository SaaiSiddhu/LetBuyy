import assert from 'node:assert/strict';
import test from 'node:test';
import { StorefrontDiscoveryQuerySchema } from '@letbuyy/commerce-core';
import { parseStorefrontDiscoveryRequest, storefrontDiscoveryRpcArgs, readStorefrontDiscoveryPayload, STOREFRONT_DISCOVERY_RPC } from '../lib/storefront-discovery';

const store = '11111111-1111-4111-8111-111111111111', product = '22222222-2222-4222-8222-222222222222', variant = '33333333-3333-4333-8333-333333333333';
test('product and verified-preview parsing share one strict contract without swallowing repeated controls or unknown filters', () => {
  const preview = parseStorefrontDiscoveryRequest('https://example.invalid/v1/storefront/demo/theme-preview?token=secret&resource=products&pagination=1&connector=usb-c&connector=hdmi&max_price=5000', { transportKeys:['token','resource','pagination'] });
  assert.equal(preview.success,true);if (!preview.success) return;
  assert.deepEqual(preview.data.connector,['usb-c','hdmi']);assert.equal(preview.data.max_price,5000);
  assert.equal(parseStorefrontDiscoveryRequest('https://example.invalid/products?page=1&page=2').success,false);
  assert.equal(parseStorefrontDiscoveryRequest('https://example.invalid/products?privateSupplier=x').success,false);
  assert.equal(parseStorefrontDiscoveryRequest('https://example.invalid/products?token=secret').success,false);
});
test('RPC parameters bind identifiers and hostile search as values, never SQL syntax or a second query path', () => {
  assert.equal(STOREFRONT_DISCOVERY_RPC,'browse_storefront_products_v1');
  const search = "x%' OR 1=1; --";
  const args = storefrontDiscoveryRpcArgs(store,{search,sort:'price-asc',pack_size:'g:250'},[product]);
  assert.deepEqual(args.p_product_ids,[product]);assert.equal(args.p_query.search,search);assert.equal(args.p_store_id,store);
  assert.throws(()=>storefrontDiscoveryRpcArgs('foreign',{search}));assert.throws(()=>storefrontDiscoveryRpcArgs(store,{where:'true'}));assert.throws(()=>storefrontDiscoveryRpcArgs(store,{},['bad']));
});
test('response accepts exact empty past-end totals and page-matching safe discovery metadata', () => {
  const query = StorefrontDiscoveryQuerySchema.parse({page:100,limit:2});
  assert.deepEqual(readStorefrontDiscoveryPayload({data:[],count:3,facets:[],matches:[]},query).count,3);
  const parsed = readStorefrontDiscoveryPayload({data:[{id:product,price:999}],count:1,facets:[{key:'pack_size',value:'g:250',label:'250 g',count:1}],matches:[{product_id:product,price:180,variant_ids:[variant]}]},query);
  assert.equal(parsed.data[0].price,999);assert.equal(parsed.discovery.matches[0].price,180);
});
test('malformed or private discovery projections fail closed instead of changing count or showing invented prices', () => {
  const query = StorefrontDiscoveryQuerySchema.parse({}), base = {data:[{id:product}],count:1,facets:[],matches:[{product_id:product,price:180,variant_ids:[variant]}]};
  for (const invalid of [{...base,count:-1},{...base,matches:[]},{...base,matches:[{product_id:store,price:180,variant_ids:[]}]},{...base,matches:[{product_id:product,price:NaN,variant_ids:[]}]},{...base,matches:[{product_id:product,price:180,variant_ids:[variant,variant]}]},{...base,matches:[{...base.matches[0],privateSupplier:'secret'}]},{...base,facets:[{key:'api_key',value:'x',label:'x',count:1}]},{...base,facets:[{key:'age_band',value:'6-8',label:'6–8',count:2}]}]) assert.throws(()=>readStorefrontDiscoveryPayload(invalid,query));
});

test('390 measurement metadata propagates explicitly without changing query, totals, prices or variant witnesses;386 absence remains absent', () => {
  const query = StorefrontDiscoveryQuerySchema.parse({ length_value: 67.5, length_unit: 'cm', connector: ['usb-c','hdmi'] });
  const base = { data: [{ id: product, price: 999 }], count: 1, facets: [], matches: [{ product_id: product, price: 180, variant_ids: [variant] }] };
  const absent = readStorefrontDiscoveryPayload(base, query);
  assert.equal(Object.hasOwn(absent.discovery, 'measurement_capabilities'), false);
  const measurement_capabilities = { equipment_length: { available: true, allowed_units: ['mm','cm','m','in'] }, max_width_cm: { available: true }, max_depth_cm: { available: false } };
  const input = { ...base, measurement_capabilities }, original = structuredClone(input);
  const present = readStorefrontDiscoveryPayload(input, query);
  assert.deepEqual(input, original);assert.deepEqual(present.discovery.measurement_capabilities, measurement_capabilities);
  assert.equal(present.discovery.query, query);assert.deepEqual(present.discovery.matches, base.matches);assert.equal(present.count, 1);assert.equal(present.data[0].price, 999);
});
test('raw measurement admission fails closed on malformed, partial or contradictory metadata instead of silently falling back to386', () => {
  const query = StorefrontDiscoveryQuerySchema.parse({}), base = { data: [], count: 0, facets: [], matches: [] };
  const disabled = { equipment_length: { available: false, allowed_units: [] }, max_width_cm: { available: false }, max_depth_cm: { available: false } };
  const malformed = [null, {}, [], { ...disabled, max_width_cm: undefined }, { ...disabled, max_depth_cm: undefined }, { ...disabled, equipment_length: undefined },
    { ...disabled, unknown: true }, { ...disabled, max_width_cm: { available: false, raw_value: 60 } },
    { ...disabled, equipment_length: { available: true, allowed_units: [] } },
    { ...disabled, equipment_length: { available: false, allowed_units: ['cm'] } },
    ...[['cm','mm'], ['mm','mm'], ['feet'], ['mm','cm','m','in','mm']].map(allowed_units => ({ ...disabled, equipment_length: { available: true, allowed_units } })),
  ];
  for (const measurement_capabilities of malformed) assert.throws(() => readStorefrontDiscoveryPayload({ ...base, measurement_capabilities }, query), error => {
    assert.equal((error as { code?: string }).code, 'INTERNAL_ERROR');assert.doesNotMatch(String(error), /allowed_units|raw_value|unknown/);return true;
  });
  const valid = { ...base, measurement_capabilities: disabled };
  assert.throws(() => readStorefrontDiscoveryPayload({ ...valid, unrecognized: true }, query));
  assert.throws(() => readStorefrontDiscoveryPayload({ ...valid, data: [{ id: product }], count: 1, matches: [{ product_id: store, price: 180, variant_ids: [] }] }, query), 'capability admission never weakens witness order/identity');
});
