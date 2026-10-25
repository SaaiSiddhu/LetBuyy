// Real mounted worker + owned PostgreSQL/PostgREST + tenant SQL proxy. Synthetic data only.
// Proves package/draft/release persistence, product fact editing and public discovery;
// browser/identity/provider verification remains a separate acceptance class.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { LiquidRenderer, DEFAULT_THEME_SETTINGS, type LiquidThemePackageBundle } from '@letbuyy/theme-engine';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
let gateway: Gateway, proxy: OwnedPooledSqlProxy;
after(async () => { await gateway?.settle(); await closePooledSqlClients(); await proxy?.stop(); });
const json = (value: unknown) => JSON.stringify(value).replaceAll("'", "''");

test('Threadline: real garment edit → variant discovery → install → saved preview → publish/readback → recovery', async () => {
    const site = newSyntheticTenant('threadline'), other = newSyntheticTenant('threadline-other');
    for (const tenant of [site, other]) seedSyntheticTenant(owned.psql, tenant);
    const owner = randomUUID(), stranger = randomUUID(), email = `threadline-${owner}@example.invalid`, foreignEmail = `threadline-${stranger}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true),('${stranger}','${foreignEmail}',true);UPDATE sites SET custom_user_id='${owner}',theme_id='letbuyy-core' WHERE id='${site.siteId}';UPDATE sites SET custom_user_id='${stranger}' WHERE id='${other.siteId}';`);
    proxy = await startOwnedPooledSqlProxy(owned);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), proxy.env()));
    const headers = () => signedIdentityHeaders(owner, email, site.siteId);
    const post = async (path: string, body: unknown) => gateway.request(path, { method: 'POST', headers: await headers(), body: JSON.stringify(body) });
    const product = randomUUID(), foreignProduct = randomUUID();
    owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,metadata) VALUES('${product}','${site.siteId}','${site.siteId}','Synthetic Threadline shirt','shirt-${product}',2490,12,true,'active','{"privateSupplier":"NEVER_PUBLIC"}'),('${foreignProduct}','${other.siteId}','${other.siteId}','Never show another tenant product','foreign-${foreignProduct}',100,1,true,'active','{}');INSERT INTO product_options(product_id,name,position,values) VALUES('${product}','Size',0,'["M","L"]'),('${product}','Color',1,'["Oat","Rust"]');`);
    for (const [size, color, stock] of [['M','Oat',5],['L','Rust',5],['M','Rust',0]] as const) {
        const variant = randomUUID();
        owned.psql(`INSERT INTO product_variants(id,product_id,title,sku,price,inventory_qty,option1,option2) VALUES('${variant}','${product}','${size} / ${color}','SYN-${variant}',2490,${stock},'${size}','${color}');SELECT set_inventory_level_available('${product}','${variant}','${site.locationId}',${stock},'${owner}');`);
    }
    const collection = randomUUID();
    owned.psql(`INSERT INTO collections(id,store_id,title,is_active) VALUES('${collection}','${site.siteId}','Synthetic fitting collection',true);INSERT INTO collection_products(collection_id,product_id,position) VALUES('${collection}','${product}',0);`);
    // Real schema reads catch nonexistent projection columns that source-only
    // tenancy tests cannot detect. The resource picker must return actual IDs.
    const collectionSearch = await gateway.request(`/v1/themes/resource-search?store_id=${site.siteId}&type=collection&q=Synthetic&limit=20`, { headers: await headers() });
    assert.equal(collectionSearch.status, 200, collectionSearch.text);
    assert.deepEqual(collectionSearch.json!.data.map((row: { id: string }) => row.id), [collection]);
    const productSearch = await gateway.request(`/v1/themes/resource-search?store_id=${site.siteId}&type=product&q=Synthetic&limit=20`, { headers: await headers() });
    assert.equal(productSearch.status, 200, productSearch.text);
    assert.deepEqual(productSearch.json!.data.map((row: { id: string }) => row.id), [product]);
    assert.equal((await gateway.request(`/v1/themes/resource-search?store_id=${other.siteId}&type=product&q=&limit=20`, { headers: await headers() })).status, 403);
    const searchFailure = tapRest(owned.restUrl, async (call, forward) => call.resource === 'collections'
        ? new Response(JSON.stringify({ code: '42703', message: 'column collections.title does not exist' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) : forward());
    try {
        const brokenSearch = await gateway.request(`/v1/themes/resource-search?store_id=${site.siteId}&type=collection&q=Synthetic&limit=20`, { headers: await headers() });
        assert.equal(brokenSearch.status, 500, 'schema failures must not masquerade as no matching resources');
        assert.doesNotMatch(brokenSearch.text, /column collections|42703/);
    } finally { searchFailure.restore(); }
    const facts = { fit: 'Merchant-supplied relaxed fit', fabric: 'Synthetic linen fixture', care: 'Synthetic cold wash fixture', unit: 'cm', measurements: [{ size: 'M', chest: 102, shoulder: 40, length: 69 }] };
    const editKey = randomUUID(), version = Number(owned.psql(`SELECT version FROM products WHERE id='${product}';`));
    const edit = await gateway.request(`/v1/products/${product}`, { method: 'PATCH', headers: { ...await headers(), 'X-Store-ID': site.siteId, 'X-Idempotency-Key': editKey }, body: JSON.stringify({ metadata: { privateSupplier: 'NEVER_PUBLIC', apparel: facts }, version, idempotency_key: editKey }) });
    assert.equal(edit.status, 200, edit.text);
    assert.deepEqual(JSON.parse(owned.psql(`SELECT metadata->'apparel' FROM products WHERE id='${product}';`)), facts);
    const key = randomUUID();
    const invalid = await gateway.request(`/v1/products/${product}`, { method: 'PATCH', headers: { ...await headers(), 'X-Store-ID': site.siteId, 'X-Idempotency-Key': key }, body: JSON.stringify({ metadata: { apparel: { ...facts, unit: 'guessed' } }, version: version + 1, idempotency_key: key }) });
    assert.equal(invalid.status, 400, invalid.text);
    const before = owned.psql(`SELECT coalesce(current_theme_release_id::text,'none')||'|'||theme_id FROM sites WHERE id='${site.siteId}';`);
    const install = await post('/v1/themes/letbuyy-sense/install', { store_id: site.siteId });
    assert.equal(install.status, 201, install.text);
    assert.equal(owned.psql(`SELECT coalesce(current_theme_release_id::text,'none')||'|'||theme_id FROM sites WHERE id='${site.siteId}';`), before);
    const loaded = await gateway.request(`/v1/themes/letbuyy-sense/editor?store_id=${site.siteId}`, { headers: await headers() });
    assert.equal(loaded.status, 200, loaded.text);
    const initial = loaded.json!.data, config = structuredClone(initial.template_config);
    assert.equal(config.liquidBundle.package.version, '2.0.0');
    assert.match(config.liquidBundle.sections['product-detail'].source, /Garment measurements/);
    const hero = 'sense-heroBanner-index';
    config.liquidBundle.templates.index.sections[hero].settings.heading = 'Synthetic saved Threadline campaign';
    config.templates.index.sections[hero].settings.heading = 'Synthetic saved Threadline campaign';
    config.liquidBundle.templates.index.sections['sense-categoryGrid-index'].settings.collection1 = collection;
    config.templates.index.sections['sense-categoryGrid-index'].settings.collection1 = collection;
    config.liquidBundle.templates.index.order.reverse(); config.templates.index.order.reverse();
    config.themeSettings.primaryColor = '#713F35';
    config.liquidBundle.config.settings_data.current.primaryColor = '#713F35';
    const draftKey = randomUUID();
    const saved = await gateway.request('/v1/themes/letbuyy-sense/editor/draft', { method: 'PUT', headers: await headers(), body: JSON.stringify({ store_id: site.siteId, template_config: config, base_version: initial.version, idempotency_key: draftKey, template_key: 'index' }) });
    assert.equal(saved.status, 200, saved.text);
    const reloaded = await gateway.request(`/v1/themes/letbuyy-sense/editor?store_id=${site.siteId}`, { headers: await headers() });
    assert.equal(reloaded.json!.data.template_config.liquidBundle.templates.index.sections[hero].settings.heading, 'Synthetic saved Threadline campaign');
    assert.equal(reloaded.json!.data.template_config.liquidBundle.templates.index.sections['sense-categoryGrid-index'].settings.collection1, collection);
    const stale = await gateway.request('/v1/themes/letbuyy-sense/editor/draft', { method: 'PUT', headers: await headers(), body: JSON.stringify({ store_id: site.siteId, template_config: config, base_version: initial.version, idempotency_key: randomUUID() }) });
    assert.equal(stale.status, 409, stale.text);
    const beforePublishRead = await gateway.request(`/v1/storefront/${site.subdomain}`);
    assert.equal(beforePublishRead.status, 200, beforePublishRead.text);
    assert.doesNotMatch(beforePublishRead.text, /Synthetic saved Threadline campaign/, 'private draft content never appears in anonymous store reads');
    for (const repeated of await Promise.all([post('/v1/themes/letbuyy-sense/install', { store_id: site.siteId }), post('/v1/themes/letbuyy-sense/install', { store_id: site.siteId })])) {
        assert.equal(repeated.status, 201, repeated.text);
        assert.equal(repeated.json!.data.already_installed, true);
    }
    assert.equal(owned.psql(`SELECT count(*) FROM theme_instances WHERE store_id='${site.siteId}' AND theme_slug='letbuyy-sense' AND deleted_at IS NULL;`), '1');
    const preview = await post('/v1/themes/letbuyy-sense/preview-session', { store_id: site.siteId, template_key: 'index', ttl_seconds: 900 });
    assert.equal(preview.status, 201, preview.text);
    const previewToken = preview.json!.data.preview_token;
    const previewPage = await gateway.request(`/v1/storefront/${site.subdomain}/theme-preview?token=${encodeURIComponent(previewToken)}`);
    assert.equal(previewPage.status, 200);
    assert.match(previewPage.text, /Synthetic saved Threadline campaign/);
    assert.equal((await gateway.request(`/v1/storefront/${other.subdomain}/theme-preview?token=${encodeURIComponent(previewToken)}`)).status, 404);
    const foreign = await gateway.request('/v1/themes/letbuyy-sense/install', { method: 'POST', headers: await signedIdentityHeaders(stranger, foreignEmail, other.siteId), body: JSON.stringify({ store_id: site.siteId }) });
    assert.equal(foreign.status, 403);
    const published = await post('/v1/themes/letbuyy-sense/publish', { store_id: site.siteId, base_version: saved.json!.data.version, idempotency_key: randomUUID(), make_store_live: true });
    assert.equal(published.status, 200, published.text);
    const release = JSON.parse(owned.psql(`SELECT jsonb_build_object('id',r.id,'snapshot',r.template_snapshot,'source',r.source_draft_version) FROM sites s JOIN theme_releases r ON r.id=s.current_theme_release_id WHERE s.id='${site.siteId}';`));
    const bundle = release.snapshot.liquidBundle as LiquidThemePackageBundle;
    assert.equal(bundle.package.version, '2.0.0');
    assert.equal(bundle.templates.index.sections[hero].settings.heading, 'Synthetic saved Threadline campaign');
    assert.deepEqual(bundle.templates.index.order, config.liquidBundle.templates.index.order);
    const rows = await gateway.request(`/v1/storefront/${site.subdomain}/products?size=M&color=Oat&sort=price-asc`);
    assert.equal(rows.status, 200, rows.text);
    assert.equal(rows.json!.data.length, 1);
    assert.equal(rows.json!.data[0].id, product);
    assert.deepEqual(rows.json!.data[0].metadata.apparel, facts);
    assert.doesNotMatch(rows.text, /NEVER_PUBLIC|privateSupplier|Never show another/);
    assert.equal((await gateway.request(`/v1/storefront/${site.subdomain}/products?size=M&color=Rust`)).json!.data.length, 0, 'same variant must match both options and have stock');
    assert.equal((await gateway.request(`/v1/storefront/${site.subdomain}/products?min_price=3000`)).json!.data.length, 0);
    assert.equal((await gateway.request(`/v1/storefront/${site.subdomain}/products?sort=untrusted`)).status, 400);
    assert.equal((await gateway.request(`/v1/storefront/${site.subdomain}/products?page=2&limit=1&sort=name`)).json!.meta.total, 1, 'empty page retains the actual total');
    assert.match(owned.psqlExpectError(`SET ROLE anon; SELECT browse_storefront_apparel_v1('${site.siteId}');`), /permission denied/);
    const rendered = await new LiquidRenderer().render({ context: { storeId: site.siteId, subdomain: site.subdomain, path: '/', previewMode: false, locale: 'en-IN' }, storeTemplate: { themeId: 'letbuyy-sense', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidContext: { shop: { name: 'Synthetic Threadline' }, collection: { products: [] } } });
    assert.equal(rendered.status, 'rendered'); assert.match(rendered.liquid!.contentForLayout, /Synthetic saved Threadline campaign/); assert.match(rendered.liquid!.headStyleText!, /\.tl-hero/);
    const releaseDigest = createHash('sha256').update(JSON.stringify(release.snapshot)).digest('hex');
    const failedPublish = await post('/v1/themes/letbuyy-sense/publish', { store_id: site.siteId, base_version: initial.version, idempotency_key: randomUUID(), make_store_live: true });
    assert.equal(failedPublish.status, 409, failedPublish.text);
    assert.equal(owned.psql(`SELECT current_theme_release_id FROM sites WHERE id='${site.siteId}';`), release.id, 'failed publication keeps the last valid release');
    // Forward replay + paired catalog rollback conserve this captured merchant release and draft.
    const migration = (dir: string) => readFileSync(new URL(`../../../../../database/supabase/${dir}/382_threadline_catalog_v2${dir === 'rollback' ? '.rollback' : ''}.sql`, import.meta.url), 'utf8');
    owned.script(migration('migrations')); owned.script(migration('rollback')); owned.script(migration('migrations'));
    const unchanged = JSON.parse(owned.psql(`SELECT template_snapshot FROM theme_releases WHERE id='${release.id}';`));
    assert.equal(createHash('sha256').update(JSON.stringify(unchanged)).digest('hex'), releaseDigest);
    const discoveryMigration = (dir: string) => readFileSync(new URL(`../../../../../database/supabase/${dir}/383_storefront_apparel_discovery${dir === 'rollback' ? '.rollback' : ''}.sql`, import.meta.url), 'utf8');
    owned.script(discoveryMigration('rollback'));
    assert.equal(owned.psql(`SELECT count(*) FROM pg_proc WHERE proname='browse_storefront_apparel_v1';`), '0');
    owned.script(discoveryMigration('migrations')); owned.script(discoveryMigration('migrations'));
    assert.equal((await gateway.request(`/v1/storefront/${site.subdomain}/products?size=M&color=Oat`)).json!.data.length, 1, 'discovery forward/rollback/replay restores actual filtering');
    console.info('THREADLINE_LIFECYCLE_PROOF', JSON.stringify({ packageVersion: bundle.package.version, draftVersion: saved.json!.data.version, releaseSnapshotSha256: releaseDigest, renderer: rendered.engine, persisted: true, provider: 'not exercised by this suite' }));
    if (process.env.LETBUYY_THREADLINE_BROWSER_HOLD === '1') {
        const { holdThreadlineBrowserFixture } = await import('./threadline-browser-fixture');
        await holdThreadlineBrowserFixture(owned, proxy.env());
    }
});
