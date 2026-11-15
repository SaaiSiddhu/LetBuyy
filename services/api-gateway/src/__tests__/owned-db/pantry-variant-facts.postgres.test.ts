// Current runtime plus isolated385 SQL retirement controls. Every write goes
// to positively owned disposable infrastructure; historical SQL has no REST.
import assert from 'node:assert/strict';
import test, { before, after, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase, requireOwnedHistoricalSqlDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('pantry-facts'), other = newSyntheticTenant('pantry-other');
const owner = crypto.randomUUID(), staff = crypto.randomUUID(), reader = crypto.randomUUID(), stranger = crypto.randomUUID();
const email = (id: string) => `syn-pantry-${id}@example.invalid`;
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => quote(JSON.stringify(value)) + '::jsonb';
const migration = (kind: 'migrations' | 'rollback') => readFileSync(new URL('../../../../../database/supabase/' + kind + '/385_product_variant_facts' + (kind === 'rollback' ? '.rollback' : '') + '.sql', import.meta.url), 'utf8');
let gateway: Gateway, mirrorGateway: Gateway, proxy: OwnedPooledSqlProxy;
let historical: ReturnType<typeof requireOwnedHistoricalSqlDatabase>;

before(async () => {
  for (const tenant of [site, other]) seedSyntheticTenant(psql, tenant);
  psql(`INSERT INTO users_custom(id,email,email_verified) VALUES ${[owner, staff, reader, stranger].map(id => `('${id}','${email(id)}',true)`).join(',')};
    UPDATE sites SET custom_user_id='${owner}' WHERE id='${site.siteId}';
    UPDATE sites SET custom_user_id='${stranger}' WHERE id='${other.siteId}';
    INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions) VALUES
    ('${staff}','${email(staff)}','${site.siteId}','editor','active',true,'{"granted":["products:write"]}'),
    ('${reader}','${email(reader)}','${site.siteId}','viewer','active',true,'{"granted":["products:read"]}');`);
  proxy = await startOwnedPooledSqlProxy(owned);
  const env = gatewayEnv(owned, await newIdentityKeys(), proxy.env());
  gateway = new Gateway(env);
  mirrorGateway = new Gateway({ ...env, PRODUCT_VARIANTS_RELATIONAL_READS: 'off' });
});
afterEach(async () => { await gateway.settle(); await mirrorGateway.settle(); });
after(async () => { await closePooledSqlClients(); await proxy?.stop(); });

function product(metadata: object = {}, images: string[] = [], query = psql) {
  const id = crypto.randomUUID();
  query(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,country_of_origin,metadata,images)
    VALUES('${id}','${site.siteId}','${site.siteId}','Synthetic pantry product','syn-${id}',180,0,true,'active','India',${json(metadata)},ARRAY[${images.map(quote).join(',')}]::text[]);`);
  return id;
}
const version = (id: string) => Number(psql(`SELECT version FROM products WHERE id='${id}';`));
interface StoredVariant { id: string; stock: number; options: Record<string, string>; metadata: Record<string, unknown>; }
interface StoredProduct { id: string; version: number; variants: StoredVariant[]; metadata: Record<string, unknown> & { gifts?: { mediaRoles?: Record<string, number> } }; }
const row = (id: string, query = psql) => JSON.parse(query(`SELECT product_edit_snapshot_v1('${id}');`)) as StoredProduct;
function snapshot(id: string, query = psql) {
  return JSON.parse(query(`SELECT jsonb_build_object(
    'product',(SELECT to_jsonb(t) FROM products t WHERE id='${id}'),
    'variants',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM product_variants t WHERE product_id='${id}'),
    'levels',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM inventory_levels t WHERE product_id='${id}'),
    'adjustments',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM inventory_adjustments t WHERE product_id='${id}'),
    'events',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM inventory_events t WHERE product_id='${id}'),
    'prices',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM product_price_observations t WHERE product_id='${id}'),
    'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY idempotency_key),'[]') FROM product_edit_receipts t WHERE product_id='${id}'),
    'outbox',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM outbox_events t WHERE aggregate_id='${id}'),
    'audit',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM audit_activity_events t WHERE resource_id='${id}'))`));
}
async function patch(id: string, changes: object, expected = version(id), key = crypto.randomUUID(), actor = owner, store = site.siteId) {
  return gateway.request(`/v1/products/${id}`, { method: 'PATCH', headers: { ...await signedIdentityHeaders(actor, email(actor), store), 'X-Store-ID': store, 'X-Idempotency-Key': key },
    body: JSON.stringify({ ...changes, version: expected, idempotency_key: key }) });
}
async function create(changes: object, actor = owner, key = crypto.randomUUID()) {
  return gateway.request('/v1/products', { method: 'POST', headers: { ...await signedIdentityHeaders(actor, email(actor), site.siteId), 'X-Store-ID': site.siteId, 'X-Idempotency-Key': key },
    body: JSON.stringify({ store_id: site.siteId, name: 'Synthetic inline facts', price: 180, ...changes }) });
}
async function payload(response: { json: unknown }) {
  assert.ok(response.json, 'Gateway must return a JSON object');
  return response.json as { data?: StoredProduct; error?: unknown };
}
const food = { netQuantity: { value: 250, unit: 'g' } };
const allFacts = { food, toys: { materials: 'Merchant supplied wood' }, furniture: { materials: ['Birch'] }, sports: { weight: { value: 300, unit: 'g' } }, books: { kind: 'book', language: 'English', format: 'paperback' } };
function functionProfile(query = psql) {
  return query(`SELECT jsonb_agg(jsonb_build_object('name',proname,'body',prosrc,'acl',proacl,'config',proconfig,'owner',proowner) ORDER BY proname)
    FROM pg_proc WHERE oid IN('public.product_edit_snapshot_v1(uuid)'::regprocedure,'public.apply_product_edit_v1(uuid,uuid,uuid,integer,uuid,jsonb)'::regprocedure,'public.refresh_products_variants_jsonb_cache(integer)'::regprocedure);`);
}

test('385 clean-empty DOWN and reapply restore exact reviewed functions and preserve product data/ACLs', () => {
  historical = requireOwnedHistoricalSqlDatabase(385);
  const sql = historical.psql; seedSyntheticTenant(sql, site);
  assert.equal(sql(`SELECT count(*) FROM product_variants WHERE metadata<>'{}';`), '0');
  const id = product({}, [], sql); const before = snapshot(id, sql), profile = functionProfile(sql);
  historical.script(migration('rollback'));
  assert.equal(sql(`SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='product_variants' AND column_name='metadata';`), '0');
  const legacy = product({}, [], sql), legacyVariant = crypto.randomUUID(), unmatched = crypto.randomUUID();
  sql(`INSERT INTO product_variants(id,product_id,title,price,inventory_qty) VALUES('${legacyVariant}','${legacy}','Legacy synthetic pack',180,0);
    UPDATE products SET variants=jsonb_set(jsonb_set(variants,'{0,metadata}',${json({ food })}),'{0,id}',${json(unmatched)}) WHERE id='${legacy}';`);
  const legacyBefore = sql(`SELECT variants FROM products WHERE id='${legacy}';`);
  assert.match(historical.psqlScriptExpectError(migration('migrations')), /refuses unmatched or ambiguous variant facts/);
  assert.equal(sql(`SELECT variants FROM products WHERE id='${legacy}';`), legacyBefore, 'failed expansion never drops unmatched facts');
  assert.equal(sql(`SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='product_variants' AND column_name='metadata';`), '0');
  sql(`UPDATE products SET variants=jsonb_set(variants,'{0,id}',${json(legacyVariant)}) WHERE id='${legacy}';`);
  historical.script(migration('migrations'));
  assert.deepEqual(snapshot(id, sql), before);
  assert.equal(functionProfile(sql), profile);
  assert.deepEqual(row(legacy, sql).variants[0].metadata, { food }, 'backfill follows the existing UUID only');
  assert.deepEqual(row(legacy, sql).variants, JSON.parse(sql(`SELECT variants FROM products WHERE id='${legacy}';`)));
});

test('real canonical POST creates all five inline namespaces, stock and UUIDs in one tenant transaction', async () => {
  const response = await create({ product_options: [{ name: 'Pack', values: ['250 g'] }], variants: [{ title: '250 g', sku: 'SYN-PRIVATE-SKU', stock: 4, options: { Pack: '250 g' }, metadata: allFacts }], metadata: { food: { ingredients: 'Synthetic lentils' } } }, staff);
  const body = await payload(response); assert.equal(response.status, 201, JSON.stringify(body));
  const id = String(body.data!.id), current = row(id), variant = current.variants[0];
  assert.match(variant.id, /^[0-9a-f-]{36}$/); assert.equal(variant.stock, 4); assert.equal(variant.options.Pack, '250 g');
  for (const namespace of Object.keys(allFacts)) assert.ok(variant.metadata[namespace], namespace);
  assert.deepEqual(JSON.parse(psql(`SELECT metadata FROM product_variants WHERE id='${variant.id}';`)), variant.metadata);
  assert.deepEqual(current.variants, JSON.parse(psql(`SELECT variants FROM products WHERE id='${id}';`)));
  assert.equal(psql(`SELECT count(*) FROM inventory_levels WHERE product_id='${id}' AND variant_id='${variant.id}' AND available=4;`), '1');
  assert.ok(current.version > 1);
});

test('edit preserves omitted facts across durable-ID SKU/option edits; explicit clears do not inherit common food', async () => {
  const id = product({ food: { netQuantity: { value: 999, unit: 'ml' } } });
  let response = await patch(id, { product_options: [{ name: 'Pack', values: ['Original', 'Renamed'] }], variants: [{ title: 'Original', stock: 2, options: { Pack: 'Original' }, metadata: { food } }] });
  assert.equal(response.status, 200, JSON.stringify(await payload(response)));
  const variantId = row(id).variants[0].id;
  response = await patch(id, { variants: [{ id: variantId, title: 'Renamed', sku: 'CHANGED-SKU', options: { Pack: 'Renamed' } }] });
  assert.equal(response.status, 200); assert.deepEqual(row(id).variants[0].metadata, { food });
  assert.equal(row(id).variants[0].id, variantId); assert.equal(row(id).variants[0].stock, 2);
  response = await patch(id, { variants: [{ id: variantId, title: 'Renamed', metadata: { food: null } }] });
  assert.equal(response.status, 200); assert.deepEqual(row(id).variants[0].metadata, { food: null });
  response = await patch(id, { variants: [{ id: variantId, title: 'Renamed', metadata: {} }] });
  assert.equal(response.status, 200); assert.deepEqual(row(id).variants[0].metadata, {});
});

test('concurrent identical fact/stock intent returns one durable receipt and exactly one effect', async () => {
  const id = product(), expected = version(id), key = crypto.randomUUID();
  const changes = { stock: 3, variants: [{ title: '250 g', stock: 2, metadata: { food } }] };
  const responses = await Promise.all([patch(id, changes, expected, key), patch(id, changes, expected, key)]);
  const bodies = await Promise.all(responses.map(payload));
  assert.deepEqual(responses.map(response => response.status), [200, 200], JSON.stringify(bodies));
  assert.deepEqual(bodies[0].data, bodies[1].data);
  assert.equal(psql(`SELECT count(*) FROM product_variants WHERE product_id='${id}';`), '1');
  assert.equal(psql(`SELECT count(*) FROM product_edit_receipts WHERE product_id='${id}' AND idempotency_key='${key}';`), '1');
  assert.equal(psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${id}' AND idempotency_key='product.updated:${key}';`), '1');
});

test('malformed facts, foreign variant UUID, stale version and forbidden actors leave all product effects unchanged', async () => {
  const id = product(), foreign = product();
  assert.equal((await patch(foreign, { variants: [{ title: 'Foreign', metadata: { food } }] })).status, 200);
  const foreignVariant = row(foreign).variants[0].id;
  const before = snapshot(id);
  for (const changes of [{ variants: [{ title: 'Bad', metadata: { food: { netQuantity: { value: 0, unit: 'g' } } } }] },
    { name: 'Must roll back', variants: [{ id: foreignVariant, title: 'Foreign', metadata: { food } }] }]) {
    const response = await patch(id, changes); assert.equal(response.status, 400, JSON.stringify(await payload(response))); assert.deepEqual(snapshot(id), before);
  }
  assert.equal((await patch(id, { name: 'Stale' }, version(id) + 1)).status, 409); assert.deepEqual(snapshot(id), before);
  for (const actor of [reader, stranger]) { assert.equal((await patch(id, { name: 'Forbidden' }, version(id), crypto.randomUUID(), actor)).status, 403); assert.deepEqual(snapshot(id), before); }
  assert.equal((await patch(id, { name: 'Wrong store' }, version(id), crypto.randomUUID(), owner, other.siteId)).status, 404); assert.deepEqual(snapshot(id), before);
});

test('late audit failure rolls back parent, metadata, stock, mirror, history, receipt and outbox together', async () => {
  const id = product(); const before = snapshot(id);
  psql(`CREATE FUNCTION public.syn_pantry_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN IF NEW.resource_id='${id}' THEN RAISE EXCEPTION 'synthetic late audit failure'; END IF; RETURN NEW; END $f$;
    CREATE TRIGGER syn_pantry_audit_failure BEFORE INSERT ON audit_activity_events FOR EACH ROW EXECUTE FUNCTION public.syn_pantry_audit_failure();`);
  try {
    const response = await patch(id, { name: 'Must roll back', stock: 4, variants: [{ title: '250 g', stock: 3, metadata: { food } }] });
    assert.equal(response.status, 500); assert.doesNotMatch(JSON.stringify(await payload(response)), /synthetic late audit failure|pg_|product_variants/);
    assert.deepEqual(snapshot(id), before);
  } finally { psql('DROP TRIGGER syn_pantry_audit_failure ON audit_activity_events; DROP FUNCTION public.syn_pantry_audit_failure();'); }
});

test('variant failure during canonical POST rolls the initial product INSERT back too', async () => {
  const name = 'Synthetic failed create ' + crypto.randomUUID();
  psql(`CREATE FUNCTION public.syn_pantry_variant_failure() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN IF NEW.metadata->'food'->'netQuantity'->>'value'='777' THEN RAISE EXCEPTION 'synthetic variant failure'; END IF; RETURN NEW; END $f$;
    CREATE TRIGGER syn_pantry_variant_failure BEFORE INSERT ON product_variants FOR EACH ROW EXECUTE FUNCTION public.syn_pantry_variant_failure();`);
  try {
    const response = await create({ name, variants: [{ title: 'Failure', stock: 2, metadata: { food: { netQuantity: { value: 777, unit: 'g' } } } }] });
    assert.equal(response.status, 500, JSON.stringify(await payload(response)));
    assert.equal(psql(`SELECT count(*) FROM products WHERE store_id='${site.siteId}' AND name=${quote(name)};`), '0');
  } finally { psql('DROP TRIGGER syn_pantry_variant_failure ON product_variants; DROP FUNCTION public.syn_pantry_variant_failure();'); }
});

test('public relational and mirror paths retain validated facts while excluding supplier metadata and identifiers', async () => {
  const id = product(); assert.equal((await patch(id, { variants: [{ title: '250 g', sku: 'PRIVATE-SKU-385', barcode: 'PRIVATE-BARCODE-385', metadata: { food } }] })).status, 200);
  const variantId = row(id).variants[0].id;
  // The relational constraint rejects unknown namespaces; a legacy raw mirror
  // may still contain them, so anonymous projection must sanitize both paths.
  assert.match(owned.psqlExpectError(`UPDATE product_variants SET metadata=metadata||'{"supplierSecret":"PRIVATE-385"}' WHERE id='${variantId}';`), /product_variants_metadata_envelope/);
  psql(`UPDATE products SET metadata=metadata||'{"supplierSecret":"PRIVATE-385"}',
    variants=jsonb_set(variants, '{0,metadata,supplierSecret}', '"PRIVATE-385"'::jsonb) WHERE id='${id}';`);
  for (const api of [gateway, mirrorGateway]) {
    const response = await api.request(`/v1/storefront/${site.subdomain}/products/syn-${id}`);
    const body = await payload(response); assert.equal(response.status, 200, JSON.stringify(body));
    assert.deepEqual(body.data!.variants[0].metadata.food, food);
    assert.doesNotMatch(JSON.stringify(body), /PRIVATE-385|PRIVATE-SKU-385|PRIVATE-BARCODE-385|supplierSecret/);
  }
});

test('086 mirror refresh retains metadata and gift image-only rebind is atomic and replayable', async () => {
  const images = ['https://example.invalid/open.webp', 'https://example.invalid/closed.webp'];
  const id = product({ gifts: { mediaRoles: { openBox: 0, closedBox: 1 } } }, images);
  const expected = version(id), key = crypto.randomUUID();
  const first = await patch(id, { images: [...images].reverse(), variants: [{ title: '250 g', metadata: { food } }] }, expected, key);
  assert.equal(first.status, 200, JSON.stringify(await payload(first)));
  assert.deepEqual(row(id).metadata.gifts?.mediaRoles, { openBox: 1, closedBox: 0 });
  const before = snapshot(id);
  const replay = await patch(id, { images: [...images].reverse(), variants: [{ title: '250 g', metadata: { food } }] }, expected, key);
  assert.equal(replay.status, 200); assert.deepEqual(snapshot(id), before);
  psql('SELECT refresh_products_variants_jsonb_cache();'); assert.deepEqual(row(id).variants[0].metadata, { food });
  assert.equal((await patch(id, { images: [images[0]] })).status, 200);
  assert.deepEqual(row(id).metadata.gifts?.mediaRoles, { openBox: 0 });
  assert.equal((await patch(id, { images: [images[0], images[0]] })).status, 200);
  assert.equal(row(id).metadata.gifts, undefined, 'a roles-only namespace disappears when URL identity becomes ambiguous');
});

test('effective image bounds and beauty option membership reject metadata-only and option-only invalid edits', async () => {
  const id = product({}, ['https://example.invalid/open.webp']);
  const before = snapshot(id);
  assert.equal((await patch(id, { metadata: { gifts: { mediaRoles: { openBox: 1 } } } })).status, 400); assert.deepEqual(snapshot(id), before);
  const beauty = { shades: [{ value: 'Clay' }], shadeOptionName: 'Shade' };
  assert.equal((await patch(id, { metadata: { beauty }, product_options: [{ name: 'Shade', values: ['Clay'] }] })).status, 200);
  const valid = snapshot(id);
  assert.equal((await patch(id, { product_options: [{ name: 'Shade', values: ['Sand'] }] })).status, 400); assert.deepEqual(snapshot(id), valid);
  assert.equal((await patch(id, { metadata: { beauty: { ...beauty, shades: [{ value: 'Sand' }] } } } )).status, 400); assert.deepEqual(snapshot(id), valid);
});

test('385 DOWN refuses saved facts and changed search_path without changing data or function authority', () => {
  const sql = historical.psql;
  const id = product({}, [], sql); const before = snapshot(id, sql), profile = functionProfile(sql);
  assert.match(historical.psqlScriptExpectError(migration('rollback')), /refuses to discard saved variant facts/);
  assert.deepEqual(snapshot(id, sql), before); assert.equal(functionProfile(sql), profile);
  assert.match(historical.psqlScriptExpectError(`BEGIN; ALTER FUNCTION public.product_edit_snapshot_v1(uuid) SET search_path=public;\n${migration('rollback')}`), /refuses changed product function contract/);
  assert.equal(functionProfile(sql), profile);
});
