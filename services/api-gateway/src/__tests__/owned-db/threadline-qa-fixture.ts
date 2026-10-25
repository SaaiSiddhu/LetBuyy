// Opt-in local QA setup through real canonical APIs. No browser session is injected.
// An API-created COD order enables account UI readback; it is not checkout/payment UI proof.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { CreateProductSchema, CreateCollectionSchema, ReplaceCollectionMembershipSchema, ProductVariantMetadataSchema, type CreateProductCommand } from '@letbuyy/commerce-core';
import { CollectionMembershipSnapshotSchema, UuidSchema, type CollectionMembershipSnapshot } from '@letbuyy/shared-types';
import { validateSubdomainFormat } from '@letbuyy/tenant-core';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { planProductSearchProjectionDocument } from '@letbuyy/event-core';
import { mintSession, signedIdentityHeaders, type Gateway, type IdentityKeys } from './gateway-harness';
import type { OwnedDatabase } from './owned-db-support';
import type { SyntheticTenant } from './synthetic-tenant';

type QaStoreInput = { owned: OwnedDatabase; gateway: Gateway; site: SyntheticTenant; owner: string; email: string; products: string[]; collections: string[] };

export async function prepareThreadlineQaStore(input: QaStoreInput) {
    const { owned, gateway, site, owner, email, products, collections } = input;
    // The parent fixture inserts products directly and does not run queue workers.
    // Seed their existing search read documents using the canonical projection
    // planner. This is fixture setup, never evidence that queue indexing ran.
    const searchRows = JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM (SELECT id,store_id,name,description,sku,category,product_type,vendor,tags,status,is_active,price,deleted_at FROM products WHERE store_id='${site.siteId}') p;`)) as Array<Parameters<typeof planProductSearchProjectionDocument>[0]>;
    assert.equal(searchRows.length, products.length);
    const searchDocuments = searchRows.map(product => planProductSearchProjectionDocument(product, randomUUID()));
    const searchJson = JSON.stringify(searchDocuments).replaceAll("'", "''");
    owned.psql(`INSERT INTO search_documents(site_id,object_type,object_id,title,subtitle,searchable_text,attributes,source_event_id,status,indexed_at,deleted_at) SELECT site_id,object_type,object_id,title,subtitle,searchable_text,attributes,source_event_id,status,indexed_at,deleted_at FROM jsonb_populate_recordset(NULL::search_documents,'${searchJson}'::jsonb);`);
    const headers = await signedIdentityHeaders(owner, email, site.siteId);
    const install = await gateway.request('/v1/themes/letbuyy-sense/install', { method: 'POST', headers, body: JSON.stringify({ store_id: site.siteId }) });
    assert.equal(install.status, 201, install.text);
    const loaded = await gateway.request(`/v1/themes/letbuyy-sense/editor?store_id=${site.siteId}`, { headers: await signedIdentityHeaders(owner, email, site.siteId) });
    assert.equal(loaded.status, 200, loaded.text);
    const config = structuredClone(loaded.json!.data.template_config);
    for (const templates of [config.templates, config.liquidBundle.templates]) {
        const sections = templates.index.sections as Record<string, { type: string; settings: Record<string, unknown> }>;
        Object.assign(sections['sense-heroBanner-index'].settings, {
            heading: 'The everyday edit, made yours.', image: '/theme-assets/threadline/v2/hero.webp',
            secondImage: '/theme-assets/threadline/v2/linen-shirt.webp',
            ctaLink: `/collections/${collections[0]}`, secondaryLink: `/product/${products[0]}#fit-guide`,
        });
        Object.assign(sections['sense-categoryGrid-index'].settings, { collection1: collections[0], collection2: collections[1], collection3: collections[2] });
        for (const section of Object.values(sections)) {
            if (section.type === 'featured-products') Object.assign(section.settings, { product1: products[0], product2: products[1] });
            if (section.type === 'about-section') Object.assign(section.settings, { title: 'Considered clothing, everyday care.', content: 'Fictional merchant editorial for isolated accessibility testing.', image: '/theme-assets/threadline/v2/linen-detail.webp' });
        }
    }
    const saved = await gateway.request('/v1/themes/letbuyy-sense/editor/draft', {
        method: 'PUT', headers: await signedIdentityHeaders(owner, email, site.siteId),
        body: JSON.stringify({ store_id: site.siteId, template_config: config, base_version: loaded.json!.data.version, idempotency_key: randomUUID(), template_key: 'index' }),
    });
    assert.equal(saved.status, 200, saved.text);
    const published = await gateway.request('/v1/themes/letbuyy-sense/publish', {
        method: 'POST', headers: await signedIdentityHeaders(owner, email, site.siteId),
        body: JSON.stringify({ store_id: site.siteId, base_version: saved.json!.data.version, idempotency_key: randomUUID(), make_store_live: true }),
    });
    assert.equal(published.status, 200, published.text);
}

export async function prepareThreadlineQaBuyer(input: QaStoreInput & { keys: IdentityKeys; identityOrigin: string }) {
    const { owned, gateway, site, products, keys, identityOrigin } = input;
    const email = `syn-threadline-qa-${randomUUID()}@example.invalid`, password = `Synthetic-${randomUUID()}!`;
    const csrf = randomUUID() + randomUUID();
    const register = () => fetch(`${identityOrigin}/api/buyer/register`, {
        method: 'POST', signal: AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/json', Origin: identityOrigin, 'X-CSRF-Token': csrf, Cookie: `letbuyy_csrf=${csrf}` },
        body: JSON.stringify({ email, password, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' }),
    });
    const registered = await register();
    const payload = await registered.json() as { buyer?: { id: string } };
    assert.equal(registered.status, 201, JSON.stringify(payload));
    assert.ok(payload.buyer?.id);
    const repeated = await register();
    assert.equal(repeated.status, 409, 'repeated registration must not create another buyer');
    const buyerId = payload.buyer.id;
    const zone = randomUUID(), rate = randomUUID();
    owned.psql(`INSERT INTO shipping_zones(id,store_id,site_id,name,countries,states,zip_codes,cod_enabled) VALUES('${zone}','${site.siteId}','${site.siteId}','Synthetic QA coverage',ARRAY['IN'],ARRAY['Karnataka','29'],ARRAY['560001'],true); INSERT INTO shipping_rates(id,zone_id,site_id,name,type,price,is_active,cod_enabled) VALUES('${rate}','${zone}','${site.siteId}','Synthetic QA delivery','flat',20,true,true);`);
    const variantId = owned.psql(`SELECT id FROM product_variants WHERE product_id='${products[0]}' AND option2='M';`);
    const body = { customer: { name: 'Synthetic QA Buyer', email, phone: '9000000088', address: { address: '1 Fixture Road', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', pincode: '560001' } }, items: [{ productId: products[0], variantId, quantity: 1 }], shippingRateId: rate, shippingAmountMinor: 2000, paymentMethod: 'cod', deliveryOption: 'standard', idempotencyKey: `syn-threadline-qa-${randomUUID()}` };
    const createOrder = async () => gateway.request(`/v1/storefront/${site.subdomain}/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyerId, { issuer: identityOrigin, audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch: 1, extraClaims: { site_id: site.siteId } }) }, body: JSON.stringify(body),
    });
    const order = await createOrder();
    assert.equal(order.status, 201, order.text);
    const replay = await createOrder();
    assert.equal(replay.status, 201, replay.text);
    const orderId = order.json!.data.order.id as string;
    assert.equal(replay.json!.data.order.id, orderId, 'an exact retry must retain the same order');
    assert.equal(owned.psql(`SELECT count(*) FROM buyer_order_links WHERE order_id='${orderId}' AND buyer_account_id='${buyerId}' AND site_id='${site.siteId}';`), '1');
    return { id: buyerId, email, password, orderId, apiProof: { registrationStatus: registered.status, repeatedRegistrationStatus: repeated.status, orderStatus: order.status, replaySameOrder: true, browserSignupOrPayment: false } };
}


// Fixed synthetic setup recipes. No theme install/publish, cart or order is created.
// Pantry/Dewdrop owner plans and the canonical variant fixtures supply these values.
const EDITOR_PRODUCT_RECIPES: ReadonlyArray<{
    key: string;
    mediaPaths: string[];
    createFields: Omit<CreateProductCommand, 'store_id' | 'images'>;
}> = [
    {"key": "toys","mediaPaths": [],"createFields": {"description": "Synthetic owned theme acceptance fixture only.","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_active": true,"stock": 8,"name": "Playfield lifecycle activity kit","price": 480,"category": "Activities","metadata": {"toys": {"ageBands": ["6-8"],"ageStatement": "6–8 years","interests": ["art"],"contents": [{"label": "tiles","quantity": 12},{"label": "idea cards","quantity": 2},{"label": "tray","quantity": 1}],"contentsComplete": true,"dimensions": {"label": "Tray","length": 24,"width": 19,"height": 1.5,"unit": "cm"},"additionalDimensions": [{"label": "Each tile","length": 5,"width": 5,"height": 0.6,"unit": "cm"}],"materials": "Wood","warnings": [{"text": "Read the sample kit information.","sourceLabel": "Fictional integration fixture"}]}},"product_options": [{"name": "Edition","values": ["Inherited","Unknown facts","Paper"]}],"variants": [{"title": "Inherited sample edition","stock": 4,"options": {"Edition": "Inherited"},"metadata": {"toys": {"finish": "Sample blue finish"}}},{"title": "Explicit unknown sample edition","stock": 2,"options": {"Edition": "Unknown facts"},"metadata": {"toys": {"ageBands": [],"contents": [],"dimensions": null,"additionalDimensions": [],"warnings": []}}},{"title": "Different paper sample edition","stock": 3,"options": {"Edition": "Paper"},"metadata": {"toys": {"ageBands": ["9-12"],"contents": [{"label": "paper sheets","quantity": 36}],"contentsComplete": true,"dimensions": {"label": "A5 sheet","length": 21,"width": 14.8,"unit": "cm"},"additionalDimensions": [],"materials": "Paper","warnings": []}}}]}},
    {"key": "electronics","mediaPaths": [],"createFields": {"description": "Synthetic owned theme acceptance fixture only.","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_active": true,"stock": 8,"name": "Circuit lifecycle hub","price": 1200,"category": "Accessories","metadata": {"electronics": {"kind": "hub","manufacturer": "Synthetic Lab","model": "Synthetic H1","connectors": [{"kind": "usb-c","role": "power-input","count": 1},{"kind": "usb-c","role": "power-output","count": 2},{"kind": "usb-a","role": "data","count": 1}],"power_input_w": 65,"power_output_w": 45,"pass_through_output_w": 60,"box_contents": [{"label": "Hub","quantity": 1}]}},"product_options": [],"variants": []}},
    {"key": "lentils","mediaPaths": [],"createFields": {"description": "Synthetic owned theme acceptance fixture only.","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_active": true,"stock": 6,"name": "Pantry lifecycle red lentils","price": 180,"category": "Staples","metadata": {"food": {"ingredients": "Split red lentils (100%).","allergens": {"status": "not_supplied"},"storage": "Keep cool and dry.","preparation": "Rinse before cooking.","netQuantity": null}},"product_options": [{"name": "Pack","values": ["250 g","500 g","750 g label only"]}],"variants": [{"title": "250 g","price": 180,"stock": 4,"options": {"Pack": "250 g"},"metadata": {"food": {"netQuantity": {"value": 250,"unit": "g"}}}},{"title": "500 g","price": 340,"stock": 0,"options": {"Pack": "500 g"},"metadata": {"food": {"netQuantity": {"value": 500,"unit": "g"}}}},{"title": "750 g label only","price": 210,"stock": 2,"options": {"Pack": "750 g label only"},"metadata": {"food": null}}]}},
    {"key": "rice","mediaPaths": [],"createFields": {"description": "Synthetic owned theme acceptance fixture only.","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_active": true,"stock": 4,"name": "Pantry lifecycle rice","price": 220,"category": "Staples","metadata": {"food": {"ingredients": "Rice (100%).","allergens": {"status": "not_supplied"},"netQuantity": {"value": 1000,"unit": "g"}}},"product_options": [],"variants": []}},
    {"key": "furniture","mediaPaths": [],"createFields": {"description": "Synthetic owned theme acceptance fixture only.","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_active": true,"stock": 8,"name": "Habitat lifecycle desk","price": 8900,"category": "Furniture","metadata": {"furniture": {"assembled": {"unit": "cm","width": 120,"depth": 60,"height": 75},"package": {"unit": "cm","width": 130,"depth": 65,"height": 20},"materials": ["Wood"],"finish": "Natural","care": "Wipe dry."}},"product_options": [{"name": "Width","values": ["48 in","Common size"]}],"variants": [{"title": "48 in","stock": 4,"options": {"Width": "48 in"},"metadata": {"furniture": {"assembled": {"unit": "in","width": 48},"package": {"unit": "in","width": 50,"depth": 25}}}},{"title": "Common size","stock": 3,"options": {"Width": "Common size"},"metadata": {"furniture": {}}}]}},
    {"key": "gifts","mediaPaths": ["/theme-assets/kindred/v2/little-pause-open.webp","/theme-assets/kindred/v2/little-pause-closed.webp"],"createFields": {"description": "Synthetic owned theme acceptance fixture only.","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_active": true,"stock": 8,"name": "Kindred lifecycle gift box","price": 1100,"category": "Gifts","metadata": {"gifts": {"contents": [{"label": "Mug","quantity": 1,"detail": "300 ml","care": "Hand wash."},{"label": "Notebook","quantity": 1},{"label": "Pen","quantity": 1}],"mediaRoles": {"openBox": 0,"closedBox": 1}}},"product_options": [],"variants": []}},
    {"key": "personalization","mediaPaths": [],"createFields": {"description": "Synthetic owned theme acceptance fixture only.","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_active": true,"stock": 8,"name": "MadeYours lifecycle notebook","price": 690,"category": "Personalized","metadata": {"personalization": {"version": 1,"revision": 1,"methods": [{"id": "engrave","label": "Front engraving","min_graphemes": 1,"max_graphemes": 18,"character_set": "unicode-letters","styles": [{"id": "sans","label": "Sans"}],"placements": [{"id": "front","label": "Front"}]}]}},"product_options": [{"name": "Cover","values": ["Moss","Oat"]}],"variants": [{"title": "Moss","stock": 4,"options": {"Cover": "Moss"}},{"title": "Oat","stock": 4,"options": {"Cover": "Oat"}}]}},
    {"key": "cloudRinse","mediaPaths": ["/theme-assets/dewdrop/v2/cloud-rinse.webp"],"createFields": {"description": "Synthetic owned beauty lifecycle fixture only.","category": "Care","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_physical": true,"is_active": true,"weight": 0.1,"weight_unit": "kg","name": "Fixture Cloud Rinse","price": 640,"stock": 12,"sku": "SYN-BEAUTY-CLOUD-{{runId}}","url_handle": "syn-cloud-rinse-{{runId}}","metadata": {"beauty": {"schemaVersion": 1,"routineStage": "cleanse","format": "Gel cleanser","netQuantity": {"value": 150,"unit": "ml"},"ingredients": "Cloud v1: Aqua, Glycerin.","directions": "Fixture directions v1: use as supplied.","warnings": "Fixture warning v1: external use only.","shadeOptionName": "Shade","shades": []}},"product_options": [],"variants": []}},
    {"key": "dailyVeil","mediaPaths": ["/theme-assets/dewdrop/v2/daily-veil.webp"],"createFields": {"description": "Synthetic owned beauty lifecycle fixture only.","category": "Care","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_physical": true,"is_active": true,"weight": 0.1,"weight_unit": "kg","name": "Fixture Daily Veil","price": 880,"stock": 12,"sku": "SYN-BEAUTY-VEIL-{{runId}}","url_handle": "syn-daily-veil-{{runId}}","metadata": {"beauty": {"schemaVersion": 1,"routineStage": "care","format": "Face cream","netQuantity": {"value": 50,"unit": "g"},"ingredients": "Veil v1: Aqua, Squalane.","directions": "Fixture directions v1: use as supplied.","warnings": "Fixture warning v1: external use only.","shadeOptionName": "Shade","shades": []}},"product_options": [],"variants": []}},
    {"key": "tint","mediaPaths": ["/theme-assets/dewdrop/v2/lip-tint.webp"],"createFields": {"description": "Synthetic owned beauty lifecycle fixture only.","category": "Care","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_physical": true,"is_active": true,"weight": 0.1,"weight_unit": "kg","name": "Fixture Soft Colour","price": 520,"stock": 8,"sku": "SYN-BEAUTY-TINT-{{runId}}","url_handle": "syn-soft-colour-{{runId}}","metadata": {"beauty": {"schemaVersion": 1,"routineStage": "colour","format": "Lip tint","netQuantity": {"value": 6,"unit": "ml"},"ingredients": "Common tint v1: fixture oil and wax; see named shade ingredients.","directions": "Fixture directions v1: use as supplied.","warnings": "Fixture warning v1: external use only.","shadeOptionName": "Shade name","shades": [{"value": "Rosewater","code": "RW01","color": "#a36a65","ingredients": "Rosewater v1: fixture oil, CI 77491."},{"value": "Pink Clay","code": "PC02","color": "#a36a65","ingredients": "Pink Clay v1: fixture oil, CI 77492."},{"value": "Terracotta","code": "TC03","color": "#89534a","ingredients": null}]},"private_supplier": "PRIVATE-BEAUTY-FIXTURE","internal_cost_note": "PRIVATE-BEAUTY-COST"},"product_options": [{"name": "Shade name","position": 0,"values": ["Rosewater","Pink Clay","Terracotta"]},{"name": "पैक आकार","position": 1,"values": ["एक इकाई"]}],"variants": [{"title": "Fixture shade SKU","sku": "SYN-BEAUTY-ROSE-{{runId}}","price": 520,"stock": 4,"options": {"Shade name": "Rosewater","पैक आकार": "एक इकाई"},"metadata": {}},{"title": "Fixture shade SKU","sku": "SYN-BEAUTY-PINK-{{runId}}","price": 560,"stock": 4,"options": {"Shade name": "Pink Clay","पैक आकार": "एक इकाई"},"metadata": {}},{"title": "Fixture shade SKU","sku": "SYN-BEAUTY-TERRA-{{runId}}","price": 590,"stock": 0,"options": {"Shade name": "Terracotta","पैक आकार": "एक इकाई"},"metadata": {}}]}},
    {"key": "palmWash","mediaPaths": [],"createFields": {"description": "Synthetic owned beauty lifecycle fixture only.","category": "Care","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_physical": true,"is_active": true,"weight": 0.1,"weight_unit": "kg","name": "Fixture Palm Wash","price": 460,"stock": 8,"sku": "SYN-BEAUTY-PALM-{{runId}}","url_handle": "syn-palm-wash-{{runId}}","metadata": {},"product_options": [],"variants": []}},
    {"key": "sports","mediaPaths": [],"createFields": {"description": "Synthetic owned theme acceptance fixture only.","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_active": true,"stock": 8,"name": "Trailmark lifecycle racket","price": 1800,"category": "Recreation","metadata": {"sports": {"activity": "Badminton","equipmentType": "racket","length": {"value": 67.5,"unit": "cm"},"dimensions": {"length": 67.5,"width": 26,"height": 2,"unit": "cm"},"weight": {"value": 85,"unit": "g"},"compatibility": {"status": "unconfirmed"}}},"product_options": [{"name": "Length","values": ["26.5 in","Common size"]}],"variants": [{"title": "26.5 in","stock": 4,"options": {"Length": "26.5 in"},"metadata": {"sports": {"length": {"value": 26.5,"unit": "in"},"dimensions": {"length": 26.5,"width": 10,"unit": "in"},"weight": {"value": 80,"unit": "g"}}}},{"title": "Common size","stock": 4,"options": {"Length": "Common size"}}]}},
    {"key": "books","mediaPaths": [],"createFields": {"description": "Synthetic owned theme acceptance fixture only.","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_active": true,"stock": 8,"name": "Marginalia lifecycle book","price": 420,"category": "Books","metadata": {"books": {"kind": "book","authors": ["सिंथेटिक लेखक"],"language": "Hindi","format": "paperback","edition": "First printing","pages": 160,"isbn": "9780306406157"}},"product_options": [{"name": "Edition","values": ["English hardback","Hindi paperback"]}],"variants": [{"title": "English hardback","price": 590,"stock": 4,"options": {"Edition": "English hardback"},"metadata": {"books": {"kind": "book","language": "English","format": "hardback","edition": "Illustrated second printing","pages": 192,"dimensions_mm": {"width": 156,"height": 234},"isbn": "9781861972712"}}},{"title": "Hindi paperback","price": 420,"stock": 4,"options": {"Edition": "Hindi paperback"}}]}},
    {"key": "stationery","mediaPaths": ["/theme-assets/marginalia/v2/notebook.webp"],"createFields": {"name": "Marginalia lifecycle lined notebook","description": "Synthetic local owned Marginalia acceptance fixture only. Not a merchant catalog seed.","price": 320,"category": "Stationery","country_of_origin": "India","charge_tax": false,"track_inventory": true,"sell_when_oos": false,"is_physical": true,"is_active": true,"stock": 6,"sku": "SYN-MARGINALIA-PAPER-{{runId}}","url_handle": "syn-marginalia-paper-{{runId}}","metadata": {"books": {"kind": "stationery","paper_gsm": 100,"dimensions_mm": {"width": 148,"height": 210},"page_count": 96,"sheet_count": 48,"ruling": "lined","binding": "Thread sewn","included": ["One lined notebook"],"materials": "Paper pages with a synthetic olive cover."}},"product_options": [],"variants": []}}
];

/** Pure, bounded data preparation; it neither acquires a fixture nor performs IO. */
export function themeEditorFixtureProductCommands(input: { runId: string; storeId: string; commerceOrigin: string }) {
    assert.match(input.runId, /^[a-f0-9]{12}$/);
    const storeId = UuidSchema.parse(input.storeId), origin = new URL(input.commerceOrigin);
    assert.equal(origin.protocol, 'http:');
    assert.match(origin.hostname, /^syn-[a-z0-9-]+\.localhost$/);
    assert.ok(validateSubdomainFormat(origin.hostname.slice(0, -'.localhost'.length)).valid);
    assert.ok(Number(origin.port) >= 1024 && Number(origin.port) <= 65535);
    assert.equal(origin.href, origin.origin + '/', 'fixture media requires a bare synthetic local origin');
    return EDITOR_PRODUCT_RECIPES.map(recipe => {
        const fields = JSON.parse(JSON.stringify(recipe.createFields).replaceAll('{{runId}}', input.runId)) as CreateProductCommand;
        return { key: recipe.key, command: CreateProductSchema.parse({ ...fields, store_id: storeId,
            sku: fields.sku || `SYN-EDITOR-${recipe.key}-${input.runId}`,
            url_handle: fields.url_handle || `syn-editor-${recipe.key.toLowerCase()}-${input.runId}`,
            images: recipe.mediaPaths.map(path => new URL(path, origin).href),
        }) };
    });
}

function editorFixtureRecord(value: unknown): Record<string, unknown> {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Fixture response must be an object');
    return value as Record<string, unknown>;
}

/** Extends only the already verified owned fixture, through canonical commands. */
export async function prepareThemeEditorQaStore(input: QaStoreInput & { commerceOrigin: string }) {
    const { owned, gateway, site, owner, email } = input;
    const commands = themeEditorFixtureProductCommands({ runId: owned.runId, storeId: site.siteId, commerceOrigin: input.commerceOrigin });
    const headers = async (key?: string) => ({ ...await signedIdentityHeaders(owner, email, site.siteId), 'X-Store-ID': site.siteId,
        ...(key ? { 'X-Idempotency-Key': key } : {}),
    });
    const products: Record<string, { id: string; version: number; variantIds: string[] }> = {};
    for (const { key, command } of commands) {
        const response = await gateway.request('/v1/products', { method: 'POST', headers: await headers(randomUUID()), body: JSON.stringify(command) });
        assert.equal(response.status, 201, `Fixture product ${key}: ${response.text}`);
        const id = UuidSchema.parse(editorFixtureRecord(response.json?.data as unknown).id);
        const loaded = await gateway.request(`/v1/products/${id}`, { headers: await headers() });
        assert.equal(loaded.status, 200, `Fixture product readback ${key}: ${loaded.text}`);
        const current = editorFixtureRecord(loaded.json?.data as unknown);
        assert.equal(current.id, id);
        assert.equal(current.store_id, site.siteId);
        assert.ok(Number.isInteger(current.version) && Number(current.version) > 0);
        assert.deepEqual(current.metadata, command.metadata);
        assert.ok(Array.isArray(current.variants));
        assert.equal(current.variants.length, command.variants.length);
        const variantIds: string[] = [];
        for (const variant of command.variants) {
            const matches: Record<string, unknown>[] = (current.variants as unknown[]).map(editorFixtureRecord).filter(row => isDeepStrictEqual(row.options, variant.options));
            assert.equal(matches.length, 1, 'Match canonical returned options exactly, never a mutable title/SKU');
            const returned = matches[0];
            variantIds.push(UuidSchema.parse(returned.id));
            assert.equal(returned.stock, variant.stock);
            assert.deepEqual(ProductVariantMetadataSchema.parse(returned.metadata || {}), ProductVariantMetadataSchema.parse(variant.metadata || {}));
        }
        assert.equal(new Set(variantIds).size, variantIds.length);
        products[key] = { id, version: Number(current.version), variantIds };
    }
    const groups: Array<[string, string, string[]]> = [
        ['toys', 'Lifecycle activities', ['toys']], ['electronics', 'Lifecycle accessories', ['electronics']],
        ['pulses', 'Lifecycle pulses', ['lentils']], ['rice', 'Lifecycle rice', ['rice']],
        ['furniture', 'Lifecycle furniture', ['furniture']], ['gifts', 'Lifecycle gifts', ['gifts']],
        ['personalization', 'Lifecycle personalized', ['personalization']],
        ['cleanse', 'Cleanse', ['cloudRinse', 'palmWash']], ['care', 'Care', ['dailyVeil']], ['colour', 'Colour', ['tint']],
        ['sports', 'Lifecycle recreation', ['sports']], ['books', 'Lifecycle books', ['books']],
        ['stationery', 'Lifecycle stationery', ['stationery']],
    ];
    const collections: Record<string, CollectionMembershipSnapshot> = {};
    for (const [key, title, members] of groups) {
        const created = await gateway.request('/v1/products/collections', { method: 'POST', headers: await headers(randomUUID()),
            body: JSON.stringify(CreateCollectionSchema.parse({ store_id: site.siteId, title, description: 'Synthetic theme acceptance setup only.' })),
        });
        assert.equal(created.status, 201, created.text);
        const id = UuidSchema.parse(editorFixtureRecord(created.json?.data as unknown).id);
        const path = `/v1/products/collections/${id}/products?store_id=${site.siteId}`;
        const before = await gateway.request(path, { headers: await headers() });
        assert.equal(before.status, 200, before.text);
        const loaded = CollectionMembershipSnapshotSchema.parse(before.json?.data as unknown), commandKey = randomUUID();
        assert.deepEqual(loaded.product_ids, []);
        const productIds = members.map(member => products[member].id);
        const saved = await gateway.request(path, { method: 'PUT', headers: await headers(commandKey),
            body: JSON.stringify(ReplaceCollectionMembershipSchema.parse({ expected_version: loaded.membership_version, idempotency_key: commandKey, product_ids: productIds })),
        });
        assert.equal(saved.status, 200, saved.text);
        const readback = await gateway.request(path, { headers: await headers() });
        assert.equal(readback.status, 200, readback.text);
        const confirmed = CollectionMembershipSnapshotSchema.parse(readback.json?.data as unknown);
        assert.deepEqual(confirmed.product_ids, productIds);
        collections[key] = confirmed;
    }
    // Reuse the existing canonical projection planner. This is fixture setup,
    // never evidence that a queue worker indexed these products.
    const rows = JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM (SELECT id,store_id,name,description,sku,category,product_type,vendor,tags,status,is_active,price,deleted_at FROM products WHERE store_id='${site.siteId}') p;`)) as Array<Parameters<typeof planProductSearchProjectionDocument>[0]>;
    assert.equal(rows.length, input.products.length + commands.length);
    assert.equal(owned.psql(`SELECT count(*) FROM search_documents WHERE site_id='${site.siteId}';`), '0');
    const documents = rows.map(product => planProductSearchProjectionDocument(product, randomUUID()));
    const payload = JSON.stringify(documents).replaceAll("'", "''");
    owned.psql(`INSERT INTO search_documents(site_id,object_type,object_id,title,subtitle,searchable_text,attributes,source_event_id,status,indexed_at,deleted_at) SELECT site_id,object_type,object_id,title,subtitle,searchable_text,attributes,source_event_id,status,indexed_at,deleted_at FROM jsonb_populate_recordset(NULL::search_documents,'${payload}'::jsonb);`);
    // The existing owned QA delivery prerequisite, without its API-created order
    // or a pre-authenticated browser. The buyer signs in through the real UI.
    const zone = randomUUID(), rate = randomUUID();
    owned.psql(`INSERT INTO shipping_zones(id,store_id,site_id,name,countries,states,zip_codes,cod_enabled) VALUES('${zone}','${site.siteId}','${site.siteId}','Synthetic Editor coverage',ARRAY['IN'],ARRAY['Karnataka','29'],ARRAY['560001'],true); INSERT INTO shipping_rates(id,zone_id,site_id,name,type,price,is_active,cod_enabled) VALUES('${rate}','${zone}','${site.siteId}','Synthetic Editor delivery','flat',20,true,true);`);
    return { classification: 'CANONICAL_API_FIXTURE_SETUP_NOT_BROWSER_ACCEPTANCE', products, collections, shippingRateId: rate,
        ordersCreated: 0, themesInstalled: 0, themesPublished: 0, browserSessionInjected: false, queueIndexingProven: false };
}
