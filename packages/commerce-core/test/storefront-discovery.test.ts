import assert from 'node:assert/strict';
import test from 'node:test';
import { StorefrontApparelQuerySchema } from '../src/apparel';
import { StorefrontDiscoveryQuerySchema, storefrontDiscoveryQueryFromEntries, storefrontDiscoveryUrl, clearStorefrontDiscoveryFilterUrl, normalizeDiscoveryLengthMm, normalizeStorefrontManufacturerKey } from '../src/storefront-discovery';

test('manufacturer selection uses native simple casing while preserving supplied Unicode labels', () => {
  for (const [label, key] of [[' SYNTHETIC LAB ', 'synthetic lab'], ['İSTANBUL', 'istanbul'], ['ΟΣ', 'οσ'],
    ['MÜLLER', 'müller'], ['I\u0307', 'i\u0307'], ['नमूना', 'नमूना'], ['மாதிரி', 'மாதிரி']]) {
    assert.equal(normalizeStorefrontManufacturerKey(label), key);
    assert.equal(normalizeStorefrontManufacturerKey(key), key);
  }
});

test('one query contract normalizes bounded requests from all ten themes and retains its transitional apparel alias', () => {
  assert.equal(StorefrontApparelQuerySchema, StorefrontDiscoveryQuerySchema);
  const query = StorefrontDiscoveryQuerySchema.parse({ page:'2',limit:'25', search:'  hub ', country_of_origin:' India ', category:'Connect', size:'M',color:'Rust',min_price:'0',max_price:'5000', age_band:'6-8',interest:'art',electronics_kind:'hub',connector:['usb-c','hdmi'],power_input_w:'100',power_output_w:'65',power_capacity_w:'100',pass_through_output_w:'85',data_rate_mbps:'5000',length_mm:'1000',pack_size:'g:250',material:'wood',finish:'natural',max_width_cm:'70',max_depth_cm:'80',occasion:'birthday',recipient:'friend',personalization_method:'engrave',routine_stage:'colour',format:'Tint',shade:'Rosewater',activity:'badminton',equipment_type:'racket',length_value:'67.5',length_unit:'cm',books_kind:'book',books_author:'Asha',books_subject:'Fiction',books_language:'Hindi',books_format:'hardback',books_ruling:'lined' });
  assert.equal(query.page,2);assert.equal(query.limit,25);assert.equal(query.search,'hub');assert.equal(query.country_of_origin,'India');
  assert.equal(query.power_input_w,100);assert.equal(query.data_rate_mbps,5000);assert.equal(query.length_mm,1000);assert.equal(query.length_value,67.5);
  assert.equal(StorefrontDiscoveryQuerySchema.parse({occasion:'40th-birthday'}).occasion,'40th-birthday');
  assert.equal(StorefrontDiscoveryQuerySchema.safeParse({interest:'invented_interest'}).success,false);
});
test('unknown keys, unsafe bounds, repeated scalars, invalid units and inconsistent compound fields are rejected', () => {
  for (const query of [{limit:101},{page:0},{page:10001},{page:'1.5'},{sort:'price;drop table products'},{where:'true'},{stock:1},{search:'x'.repeat(201)},{min_price:false},{min_price:null},{min_price:'' ,max_price:-1},{min_price:50,max_price:20},{power_output_w:0},{power_output_w:'NaN'},{data_rate_mbps:Infinity},{pack_size:'kg:1'},{pack_size:'g:0'},{pack_size:'g:1000000001'},{max_width_cm:-1},{age_band:'all'},{connector:['usb-c','usb-c']},{shade:['A','B']},{length_value:1},{length_unit:'m'},{length_value:1,length_unit:'kg'},{books_format:'pdf'},{collection_id:'foreign'}]) assert.equal(StorefrontDiscoveryQuerySchema.safeParse(query).success,false,JSON.stringify(query));
});
test('empty optional controls omit facts and never manufacture zero bounds or measurement units', () => {
  const query = StorefrontDiscoveryQuerySchema.parse({ page:'',limit:'',min_price:'',max_price:' ',length_value:'',length_unit:'',size:'',shade:'',pack_size:'' });
  assert.deepEqual(JSON.parse(JSON.stringify(query)),{page:1,limit:20,sort:'display_order'});
});
test('GET parsing preserves repeated connector choices and denies repeated scalar ambiguity', () => {
  const input = storefrontDiscoveryQueryFromEntries(new URLSearchParams('connector=usb-c&connector=hdmi&search=CG&token=private&resource=products'),['token','resource']);
  assert.deepEqual(StorefrontDiscoveryQuerySchema.parse(input).connector,['usb-c','hdmi']);
  assert.equal(StorefrontDiscoveryQuerySchema.safeParse(storefrontDiscoveryQueryFromEntries(new URLSearchParams('page=1&page=2'))).success,false);
  assert.equal(StorefrontDiscoveryQuerySchema.safeParse(storefrontDiscoveryQueryFromEntries(new URLSearchParams('__proto__=bad'))).success,false);
});
test('clearing one filter preserves other applied scope, repeated choices and sort while resetting pagination', () => {
  const query = { page:4,limit:20,search:'CG & hub',category:'Connect',country_of_origin:'India',sort:'price-asc',connector:['usb-c','hdmi'],electronics_kind:'hub',max_price:5000,books_language:'Hindi' };
  const result = new URL(clearStorefrontDiscoveryFilterUrl('/store/circuit/products',query,'electronics_kind'),'https://example.invalid');
  assert.equal(result.pathname,'/store/circuit/products');assert.equal(result.searchParams.has('page'),false);assert.equal(result.searchParams.has('electronics_kind'),false);
  assert.equal(result.searchParams.get('search'),'CG & hub');assert.equal(result.searchParams.get('max_price'),'5000');assert.equal(result.searchParams.get('books_language'),'Hindi');
  assert.equal(result.searchParams.get('sort'),'price-asc');assert.deepEqual(result.searchParams.getAll('connector'),['hdmi','usb-c']);
  const single=new URL(clearStorefrontDiscoveryFilterUrl('/products',query,'connector','hdmi'),'https://example.invalid');
  assert.deepEqual(single.searchParams.getAll('connector'),['usb-c']);assert.equal(single.searchParams.get('electronics_kind'),'hub');assert.equal(single.searchParams.has('page'),false);
  assert.throws(()=>storefrontDiscoveryUrl('//foreign.invalid/products',query));assert.throws(()=>storefrontDiscoveryUrl('/products?attack=1',query));
});
test('length comparison uses exact named physical units and does not mix food mass/volume', () => {
  assert.equal(normalizeDiscoveryLengthMm(1,'in'),25.4);assert.equal(normalizeDiscoveryLengthMm(2.54,'cm'),25.4);assert.equal(normalizeDiscoveryLengthMm(.0254,'m'),25.4);
  for (const value of [0,-1,NaN,Infinity]) assert.equal(normalizeDiscoveryLengthMm(value,'mm'),null);
});

test('measurement metadata is optional as a whole, strict when present, and preserves canonical ordered unit subsets', async () => {
  const { StorefrontDiscoveryMeasurementCapabilitiesSchema: capabilities, StorefrontDiscoveryMetadataSchema } = await import('../src/storefront-discovery');
  const units = capabilities.shape.equipment_length.shape.allowed_units.element.options;
  const disabled = { equipment_length: { available: false, allowed_units: [] }, max_width_cm: { available: false }, max_depth_cm: { available: false } };
  assert.deepEqual(capabilities.parse(disabled), disabled);
  for (let mask = 1; mask < 2 ** units.length; mask++) {
    const selected = units.filter((_unit, index) => mask & 2 ** index);
    for (const unit of selected) assert.equal(StorefrontDiscoveryQuerySchema.shape.length_unit.parse(unit), unit);
    const value = { ...disabled, equipment_length: { available: true, allowed_units: selected }, max_width_cm: { available: true } };
    assert.deepEqual(capabilities.parse(value), value);
  }
  const old = StorefrontDiscoveryMetadataSchema.parse({ query: {}, facets: [], matches: [] });
  assert.equal(Object.hasOwn(old, 'measurement_capabilities'), false, '386 absence stays absent, never inferred from products/facets');
  const present = StorefrontDiscoveryMetadataSchema.parse({ ...old, measurement_capabilities: disabled });
  assert.deepEqual(present.measurement_capabilities, disabled);
  assert.equal(StorefrontDiscoveryQuerySchema.safeParse({ measurement_capabilities: disabled }).success, false, 'server metadata is not a query/filter authority');
});
test('measurement metadata rejects partial objects, coercion, unknown fields and contradictory or unordered units', async () => {
  const { StorefrontDiscoveryMeasurementCapabilitiesSchema: capabilities, StorefrontDiscoveryMetadataSchema } = await import('../src/storefront-discovery');
  const disabled = { equipment_length: { available: false, allowed_units: [] }, max_width_cm: { available: false }, max_depth_cm: { available: false } };
  const bad = [null, [], {}, { equipment_length: disabled.equipment_length },
    { ...disabled, max_width_cm: undefined }, { ...disabled, max_depth_cm: undefined },
    { ...disabled, extra: true }, { ...disabled, equipment_length: null },
    { ...disabled, equipment_length: { available: false } }, { ...disabled, equipment_length: { allowed_units: [] } },
    { ...disabled, equipment_length: { available: 'false', allowed_units: [] } },
    { ...disabled, equipment_length: { available: true, allowed_units: [] } },
    { ...disabled, equipment_length: { available: false, allowed_units: ['mm'] } },
    ...[['mm','mm'], ['cm','mm'], ['mm','m','cm'], ['in','m','cm','mm'], ['ft'], ['MM'], ['mm','cm','m','in','mm']].map(allowed_units => ({ ...disabled, equipment_length: { available: true, allowed_units } })),
    { ...disabled, equipment_length: { available: true, allowed_units: ['cm'], count: 1 } },
    { ...disabled, max_width_cm: { available: 1 } }, { ...disabled, max_depth_cm: { available: 'true' } },
    { ...disabled, max_width_cm: { available: false, units: [] } }, { ...disabled, max_depth_cm: {} },
  ];
  for (const value of bad) {
    assert.equal(capabilities.safeParse(value).success, false, JSON.stringify(value));
    assert.equal(StorefrontDiscoveryMetadataSchema.safeParse({ query: {}, facets: [], matches: [], measurement_capabilities: value }).success, false, JSON.stringify(value));
  }
});
