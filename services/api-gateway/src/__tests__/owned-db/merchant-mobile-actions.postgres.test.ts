import {isWarehouseCommandPath,WAREHOUSE_COMMAND_PROTOCOL_HEADER,WAREHOUSE_COMMAND_PROTOCOL_VERSION} from '@letbuyy/shared-types';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
// Merchant actions must persist through the production Worker, not only render.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import test, { before, after } from 'node:test';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder } from './synthetic-tenant';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';

const owned = requireOwnedDatabase();
const a = newSyntheticTenant('mobile-action-a'), b = newSyntheticTenant('mobile-action-b');
const owner = randomUUID(), email = `syn-${owner}@example.invalid`;
let gateway: Gateway;
let proxy: OwnedPooledSqlProxy;
let productId: string;
before(async () => {
    seedSyntheticTenant(owned.psql, a); seedSyntheticTenant(owned.psql, b);
    productId = seedSyntheticOrder(owned.psql, a).productId;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','${email}',true);
      UPDATE sites SET custom_user_id='${owner}' WHERE id='${a.siteId}';`);
    proxy = await startOwnedPooledSqlProxy(owned);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), proxy.env()));
});
after(async () => { await gateway?.settle(); await closePooledSqlClients(); await proxy?.stop(); });
async function call(path: string, method = 'GET', body?: Record<string, unknown>, selected: string | null = a.siteId) {
    // Exercise the real limiter at its 20-point/second sustainable request rate.
    await setTimeout(250);
    const response = await gateway.request(path, { method, headers: {
        ...await signedIdentityHeaders(owner, email),
        ...(selected ? { 'X-Store-ID': selected } : {}),
        'Content-Type': 'application/json', 'Idempotency-Key': String(body?.idempotency_key || randomUUID()),
        ...(isWarehouseCommandPath(path) ? {[WAREHOUSE_COMMAND_PROTOCOL_HEADER]: WAREHOUSE_COMMAND_PROTOCOL_VERSION} : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return response;
}
async function ok(path: string, method = 'GET', body?: Record<string, unknown>) {
    const r = await call(path, method, body);
    assert.ok(r.status >= 200 && r.status < 300, `${method} ${path}: ${r.status} ${r.text}`);
    return r.json?.data;
}

test('coupon save, toggle and deletion persist; foreign selection cannot mutate', async () => {
    const coupon = await ok('/v1/coupons', 'POST', { store_id: a.siteId, code: 'SYN'+randomUUID().replaceAll('-',''), type: 'percentage', value: 10 });
    const changed = await ok(`/v1/coupons/${coupon.id}`, 'PATCH', { value: 15, is_active: false });
    assert.equal(changed.value, 15); assert.equal(changed.is_active, false);
    assert.equal((await call(`/v1/coupons/${coupon.id}`, 'PATCH', { value: 99 }, b.siteId)).status, 403);
    assert.equal(owned.psql(`SELECT discount_value FROM coupons WHERE id='${coupon.id}'`), '15.00');
    await ok(`/v1/coupons/${coupon.id}`, 'DELETE');
    assert.equal(owned.psql(`SELECT is_active FROM coupons WHERE id='${coupon.id}'`), 'f');
    // Legacy reads stay owned; mutations still require explicit store context.
    assert.equal((await call(`/v1/coupons/${coupon.id}`, 'GET', undefined, null)).status, 200);
    assert.equal((await call(`/v1/coupons/${coupon.id}`, 'PATCH', { value: 12 }, null)).status, 400);
});

test('page save and publication persist a canonical revision and scoped navigation entry', async () => {
    const slug = 'syn-'+randomUUID();
    const page = await ok('/v1/pages', 'POST', { store_id: a.siteId, title: 'Synthetic action page', slug, body: 'Synthetic draft', status: 'draft' });
    const changed = await ok(`/v1/pages/${page.id}`, 'PATCH', { body: 'Synthetic published body', status: 'published', show_in_nav: true });
    assert.equal(changed.status, 'published');
    assert.equal(owned.psql(`SELECT count(*) FROM storefront_page_revisions WHERE page_id='${page.id}' AND store_id='${a.siteId}'`), '2');
    assert.equal(owned.psql(`SELECT count(*) FROM storefront_pages p JOIN storefront_page_revisions r ON r.id=p.published_revision_id WHERE p.id='${page.id}' AND r.store_id=p.store_id`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM navigation_menu_items WHERE store_id='${a.siteId}' AND target_resource_id='${page.id}' AND is_visible AND deleted_at IS NULL`), '1');
    assert.equal((await call(`/v1/pages/${page.id}`, 'PATCH', { title: 'Must not save' }, b.siteId)).status, 403);
    await ok(`/v1/pages/${page.id}`, 'DELETE');
    assert.equal(owned.psql(`SELECT status FROM storefront_pages WHERE id='${page.id}'`), 'archived');
});

test('blog and collection edit/archive actions use authorized tenant predicates', async () => {
    const post = await ok('/v1/blog/posts', 'POST', { store_id: a.siteId, title: 'Synthetic action blog', slug: 'syn-'+randomUUID(), content: 'Synthetic', status: 'draft' });
    const changed = await ok(`/v1/blog/posts/${post.id}`, 'PATCH', { title: 'Synthetic changed blog', status: 'published' });
    assert.equal(changed.status, 'published');
    assert.equal((await call(`/v1/blog/posts/${post.id}`, 'DELETE', undefined, b.siteId)).status, 403);
    await ok(`/v1/blog/posts/${post.id}`, 'DELETE');
    assert.equal(owned.psql(`SELECT status FROM blog_posts WHERE id='${post.id}'`), 'archived');
    const legacy = await call('/v1/products/collections', 'POST', {store_id: a.siteId, title: 'Synthetic rejected old client'});
    assert.equal(legacy.status, 400, 'Unversioned legacy collection input remains rejected');
    const collection = await ok('/v1/products/collections', 'POST', {store_id: a.siteId, title: 'Synthetic action collection', collection_type: 'manual', idempotency_key: randomUUID()});
    const edited = await ok(`/v1/products/collections/${collection.id}`, 'PATCH', {store_id: a.siteId, collection_type: 'manual', version: collection.version, idempotency_key: randomUUID(), title: 'Synthetic changed collection'});
    assert.equal(edited.title, 'Synthetic changed collection');
    const remove = {store_id: a.siteId, collection_type: 'manual', version: edited.version, idempotency_key: randomUUID()};
    assert.equal((await call(`/v1/products/collections/${collection.id}`, 'DELETE', remove, b.siteId)).status, 403);
    await ok(`/v1/products/collections/${collection.id}`, 'DELETE', {...remove, idempotency_key: randomUUID()});
    assert.equal(owned.psql(`SELECT deleted_at IS NOT NULL FROM collections WHERE id='${collection.id}'`), 't');
});

test('merchant GST percentages round trip to the fractional checkout database authority', async () => {
    const rate = await ok('/v1/shipping-tax/taxes', 'POST', { store_id: a.siteId, name: 'Synthetic GST', rate: 18, country: 'IN', hsn_code: '6109' });
    assert.equal(rate.rate, 18);
    assert.equal(owned.psql(`SELECT rate FROM tax_rates WHERE id='${rate.id}'`), '0.1800');
    assert.equal((await ok(`/v1/shipping-tax/taxes/${rate.id}`, 'PATCH', { rate: 12 })).rate, 12);
    assert.equal(owned.psql(`SELECT rate FROM tax_rates WHERE id='${rate.id}'`), '0.1200');
    const rows = await ok(`/v1/shipping-tax/taxes?store_id=${a.siteId}`);
    assert.equal(rows.find((r: { id: string }) => r.id === rate.id).rate, 12);
    await ok(`/v1/shipping-tax/taxes/${rate.id}`, 'DELETE');
});

test('inventory location address and purchase-order receiving persist through real worker/RPCs', async () => {
    const input = {store_id: a.siteId, name: 'Synthetic action warehouse', address: 'Synthetic address', city: 'Chennai', state: 'TN', country: 'IN', idempotency_key: randomUUID()};
    const legacy = await gateway.request('/v1/inventory/locations', {method: 'POST', headers: {...await signedIdentityHeaders(owner, email), 'X-Store-ID': a.siteId, 'Idempotency-Key': input.idempotency_key}, body: JSON.stringify(input)});
    assert.equal(legacy.status, 426, 'Missing atomic warehouse protocol must remain rejected');
    const saved = await ok('/v1/inventory/locations', 'POST', input), location = saved.location;
    assert.equal(location.address.city, 'Chennai');
    assert.equal(owned.psql(`SELECT address->>'city' FROM inventory_locations WHERE id='${location.id}'`), 'Chennai');
    const created = await ok('/v1/inventory/purchase-orders', 'POST', { store_id: a.siteId, location_id: location.id, lines: [{ product_id: productId, quantity: 2, unit_cost: 25 }], idempotency_key: randomUUID() });
    const po = created.purchase_order;
    assert.ok(po.id); assert.equal(created.lines.length, 1);
    assert.equal((await call(`/v1/inventory/purchase-orders/${po.id}/receive`, 'POST', { idempotency_key: randomUUID() }, b.siteId)).status, 403);
    const key = randomUUID();
    const received = await ok(`/v1/inventory/purchase-orders/${po.id}/receive`, 'POST', { idempotency_key: key });
    assert.equal(received.purchase_order.status, 'received');
    await ok(`/v1/inventory/purchase-orders/${po.id}/receive`, 'POST', { idempotency_key: key });
    assert.equal(owned.psql(`SELECT available_quantity FROM inventory_levels WHERE location_id='${location.id}' AND product_id='${productId}'`), '2');
});

test('media metadata edits and deletion persist and reject foreign stores', async () => {
    const media = await ok('/v1/media', 'POST', { store_id: a.siteId, filename: 'synthetic.png', url: 'https://assets.example.invalid/synthetic.png', mime_type: 'image/png', size_bytes: 1, storage_key: 'synthetic/native-image.png' });
    assert.equal(media.storage_key, 'synthetic/native-image.png');
    const listed = await ok(`/v1/media?store_id=${a.siteId}`);
    assert.equal(listed.find((row: {id:string}) => row.id === media.id).storage_key, 'synthetic/native-image.png');
    assert.equal((await ok(`/v1/media/${media.id}`, 'PATCH', { alt_text: 'Synthetic image' })).alt_text, 'Synthetic image');
    assert.equal((await call(`/v1/media/${media.id}`, 'DELETE', undefined, b.siteId)).status, 403);
    await ok(`/v1/media/${media.id}`, 'DELETE');
    assert.equal(owned.psql(`SELECT count(*) FROM media WHERE id='${media.id}'`), '0');
});

test('review moderation/reply and contact status actions persist with tenant authorization', async () => {
    const review = randomUUID(), submission = randomUUID();
    owned.psql(`INSERT INTO product_reviews(id,store_id,product_id,customer_name,rating) VALUES('${review}','${a.siteId}','${productId}','Synthetic buyer',5);
      INSERT INTO form_submissions(id,store_id,data) VALUES('${submission}','${a.siteId}','{"message":"Synthetic contact"}');`);
    await ok(`/v1/reviews/${review}`, 'PATCH', { status: 'approved' });
    await ok(`/v1/reviews/${review}/reply`, 'POST', { message: 'Synthetic merchant reply' });
    assert.equal(owned.psql(`SELECT status||'|'||merchant_reply FROM product_reviews WHERE id='${review}'`), 'approved|Synthetic merchant reply');
    assert.equal((await call(`/v1/reviews/${review}`, 'DELETE', undefined, b.siteId)).status, 403);
    await ok(`/v1/reviews/${review}`, 'DELETE');
    await ok(`/v1/form-submissions/${submission}`, 'PATCH', { status: 'read' });
    assert.equal(owned.psql(`SELECT status FROM form_submissions WHERE id='${submission}'`), 'read');
    assert.equal((await call(`/v1/form-submissions/${submission}`, 'DELETE', undefined, b.siteId)).status, 403);
    await ok(`/v1/form-submissions/${submission}`, 'DELETE');
    assert.equal(owned.psql(`SELECT deleted_at IS NOT NULL FROM form_submissions WHERE id='${submission}'`), 't');
});

test('navigation replacement rolls back a failed insert and preserves the previous menu', async () => {
    const path = '/v1/pages/navigation/footer';
    const initial = { store_id: a.siteId, location: 'footer', items: [{ label: 'Synthetic original', url: '/original', target_type: 'url' }] };
    await ok(path, 'PUT', initial);
    owned.psql(`CREATE FUNCTION public.synthetic_reject_navigation_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.label='Synthetic forced failure' THEN RAISE EXCEPTION 'synthetic insert failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER synthetic_reject_navigation_insert BEFORE INSERT ON navigation_menu_items FOR EACH ROW EXECUTE FUNCTION public.synthetic_reject_navigation_insert();`);
    try {
        assert.equal((await call(path, 'PUT', { ...initial, items: [{ label: 'Synthetic forced failure', url: '/failure', target_type: 'url' }] })).status, 500);
        assert.equal(owned.psql(`SELECT label FROM navigation_menu_items WHERE store_id='${a.siteId}' AND deleted_at IS NULL AND menu_id=(SELECT id FROM navigation_menus WHERE store_id='${a.siteId}' AND handle='footer')`), 'Synthetic original');
        assert.equal((await call(path, 'PUT', initial, b.siteId)).status, 403);
    } finally {
        owned.psql('DROP TRIGGER synthetic_reject_navigation_insert ON navigation_menu_items; DROP FUNCTION public.synthetic_reject_navigation_insert();');
    }
    await ok(path, 'PUT', { ...initial, items: [{ label: 'Synthetic replacement', url: '/replacement', target_type: 'url' }] });
    assert.equal(owned.psql(`SELECT count(*) FROM navigation_menu_items WHERE store_id='${a.siteId}' AND label='Synthetic replacement' AND deleted_at IS NULL`), '1');
});

test('navigation replacement remaps nested parents and accepts canonical text resource IDs', async () => {
    const path = '/v1/pages/navigation/footer';
    await ok(path, 'PUT', { store_id: a.siteId, location: 'footer', items: [
        { label: 'Synthetic parent', url: '/parent', target_type: 'url', target_resource_id: 'legal' },
        { label: 'Synthetic child', url: '/child', target_type: 'url' },
    ] });
    const menu = await ok(`/v1/pages/navigation?store_id=${a.siteId}&location=footer`);
    const parent = menu.items.find((item: { label: string }) => item.label === 'Synthetic parent');
    const child = menu.items.find((item: { label: string }) => item.label === 'Synthetic child');
    await ok(path, 'PUT', { store_id: a.siteId, location: 'footer', items: [parent, { ...child, parent_item_id: parent.id }] });
    assert.equal(owned.psql(`SELECT count(*) FROM navigation_menu_items child JOIN navigation_menu_items parent ON parent.id=child.parent_item_id WHERE child.store_id='${a.siteId}' AND child.deleted_at IS NULL AND parent.deleted_at IS NULL AND parent.label='Synthetic parent' AND child.label='Synthetic child'`), '1');
});

test('page revision failure rolls back creation and publication without partial page/navigation effects', async () => {
    const slug = 'syn-atomic-'+randomUUID();
    const page = await ok('/v1/pages', 'POST', { store_id: a.siteId, title: 'Synthetic atomic original', slug, body: 'Original', status: 'published', show_in_nav: true });
    const before = owned.psql(`SELECT row_to_json(p)::text FROM storefront_pages p WHERE id='${page.id}'`);
    const revisions = owned.psql(`SELECT count(*) FROM storefront_page_revisions WHERE page_id='${page.id}'`);
    owned.psql(`CREATE FUNCTION public.synthetic_reject_page_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title='Synthetic revision failure' THEN RAISE EXCEPTION 'synthetic revision failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER synthetic_reject_page_revision BEFORE INSERT ON storefront_page_revisions FOR EACH ROW EXECUTE FUNCTION public.synthetic_reject_page_revision();`);
    try {
        assert.equal((await call(`/v1/pages/${page.id}`, 'PATCH', { title: 'Synthetic revision failure', body: 'Must roll back', status: 'published', show_in_nav: false })).status, 500);
        assert.equal(owned.psql(`SELECT row_to_json(p)::text FROM storefront_pages p WHERE id='${page.id}'`), before);
        assert.equal(owned.psql(`SELECT count(*) FROM storefront_page_revisions WHERE page_id='${page.id}'`), revisions);
        assert.equal(owned.psql(`SELECT count(*) FROM navigation_menu_items WHERE store_id='${a.siteId}' AND target_resource_id='${page.id}' AND is_visible AND deleted_at IS NULL`), '1');
        assert.equal((await call('/v1/pages', 'POST', { store_id: a.siteId, title: 'Synthetic revision failure', slug: slug+'-failed', body: 'Must roll back' })).status, 500);
        assert.equal(owned.psql(`SELECT count(*) FROM storefront_pages WHERE store_id='${a.siteId}' AND slug='${slug}-failed'`), '0');
    } finally {
        owned.psql('DROP TRIGGER synthetic_reject_page_revision ON storefront_page_revisions; DROP FUNCTION public.synthetic_reject_page_revision();');
    }
    await Promise.all([ok(`/v1/pages/${page.id}`, 'PATCH', { body: 'Concurrent A' }),ok(`/v1/pages/${page.id}`, 'PATCH', { body: 'Concurrent B' })]);
    assert.equal(owned.psql(`SELECT count(DISTINCT revision_number) FROM storefront_page_revisions WHERE page_id='${page.id}'`), String(Number(revisions)+2));
});

test('draft navigation preference survives a fresh read and publish without exposing the draft', async () => {
    const page = await ok('/v1/pages', 'POST', { store_id: a.siteId, title: 'Synthetic navigation draft', slug: 'syn-nav-'+randomUUID(), body: 'Draft', status: 'draft', show_in_nav: true });
    const pages = await ok(`/v1/pages?store_id=${a.siteId}`);
    assert.equal(pages.find((item: { id: string }) => item.id === page.id).show_in_nav, true);
    assert.equal(owned.psql(`SELECT is_visible FROM navigation_menu_items WHERE store_id='${a.siteId}' AND target_resource_id='${page.id}' AND deleted_at IS NULL`), 'f');
    await ok(`/v1/pages/${page.id}`, 'PATCH', { status: 'published' });
    assert.equal(owned.psql(`SELECT is_visible FROM navigation_menu_items WHERE store_id='${a.siteId}' AND target_resource_id='${page.id}' AND deleted_at IS NULL`), 't');
});

test('blog taxonomy, comment moderation and policy actions persist and deny foreign selections', async () => {
    const category = await ok('/v1/blog/categories', 'POST', { store_id: a.siteId, name: 'Synthetic category '+randomUUID() });
    const tag = await ok('/v1/blog/tags', 'POST', { store_id: a.siteId, name: 'Synthetic tag '+randomUUID() });
    const post = await ok('/v1/blog/posts', 'POST', { store_id: a.siteId, title: 'Synthetic taxonomy post', slug: 'syn-'+randomUUID(), content: 'Synthetic', category_id: category.id, tag_ids: [tag.id] });
    await ok(`/v1/blog/posts/${post.id}`, 'PATCH', { tag_ids: [] });
    assert.equal(owned.psql(`SELECT count(*) FROM blog_post_tags WHERE post_id='${post.id}'`), '0');
    const comment = randomUUID();
    owned.psql(`INSERT INTO blog_comments(id,post_id,store_id,author_name,body) VALUES('${comment}','${post.id}','${a.siteId}','Synthetic buyer','Synthetic comment');`);
    await ok(`/v1/blog/comments/${comment}`, 'PATCH', { status: 'approved' });
    assert.equal(owned.psql(`SELECT status FROM blog_comments WHERE id='${comment}'`), 'approved');
    assert.equal((await call(`/v1/blog/comments/${comment}`, 'DELETE', undefined, b.siteId)).status, 403);
    await ok(`/v1/blog/comments/${comment}`, 'DELETE');
    assert.equal((await call(`/v1/blog/categories/${category.id}`, 'DELETE', undefined, b.siteId)).status, 403);
    await ok(`/v1/blog/categories/${category.id}`, 'DELETE');
    const policy = await ok('/v1/pages/policies', 'POST', { store_id: a.siteId, policy_type: 'custom', slug: 'syn-'+randomUUID(), title: 'Synthetic policy', body: 'Synthetic policy body' });
    await ok(`/v1/pages/policies/${policy.id}`, 'PATCH', { status: 'published', body: 'Synthetic published policy' });
    assert.equal((await call(`/v1/pages/policies/${policy.id}`, 'DELETE', undefined, b.siteId)).status, 403);
    await ok(`/v1/pages/policies/${policy.id}`, 'DELETE');
});

test('native notification inbox and device registration remain private to the signed-in actor', async () => {
    const title='Synthetic native inbox '+randomUUID();
    await ok('/v1/notifications/send','POST',{site_id:a.siteId,recipient:{actor_id:owner},preferred_channels:['in_app'],message:{channel:'in_app',template_key:'native.audit',subject:title,body:'Synthetic local inbox proof'},idempotency_key:randomUUID()});
    const id=owned.psql(`SELECT id FROM notifications WHERE user_id='${owner}' AND title='${title}'`);
    assert.ok(id);
    const otherActor=randomUUID();
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${otherActor}','syn-${otherActor}@example.invalid',true); UPDATE sites SET custom_user_id='${otherActor}' WHERE id='${b.siteId}'`);
    const foreign=async(path:string,method:string,body?:Record<string,unknown>) => gateway.request(path,{method,headers:{...await signedIdentityHeaders(otherActor,`syn-${otherActor}@example.invalid`),'X-Store-ID':b.siteId,'Content-Type':'application/json','Idempotency-Key':randomUUID()},...(body?{body:JSON.stringify(body)}:{})});
    await foreign(`/v1/notifications/${id}/read`,'PATCH');
    assert.equal(owned.psql(`SELECT is_read FROM notifications WHERE id='${id}'`),'f');
    await foreign(`/v1/notifications/${id}`,'DELETE');
    assert.equal(owned.psql(`SELECT count(*) FROM notifications WHERE id='${id}'`),'1');
    await ok(`/v1/notifications/${id}/read`,'PATCH');
    assert.equal(owned.psql(`SELECT is_read FROM notifications WHERE id='${id}'`),'t');
    await ok(`/v1/notifications/${id}`,'DELETE');
    const token='synthetic-native-'+randomUUID();
    await ok('/v1/notifications/device-tokens','POST',{token,platform:'android',device_name:'Synthetic S26 registration'});
    await ok('/v1/notifications/device-tokens','POST',{token,platform:'android',device_name:'Synthetic S26 registration retry'});
    assert.equal(owned.psql(`SELECT count(*) FROM device_tokens WHERE user_id='${owner}' AND token='${token}'`),'1');
    await foreign('/v1/notifications/device-tokens','DELETE',{token});
    assert.equal(owned.psql(`SELECT count(*) FROM device_tokens WHERE user_id='${owner}' AND token='${token}'`),'1');
    await ok('/v1/notifications/device-tokens','DELETE',{token});
    assert.equal(owned.psql(`SELECT count(*) FROM device_tokens WHERE user_id='${owner}' AND token='${token}'`),'0');
});
