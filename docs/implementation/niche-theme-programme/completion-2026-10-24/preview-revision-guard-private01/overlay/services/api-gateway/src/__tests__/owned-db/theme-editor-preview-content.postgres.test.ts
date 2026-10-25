// Real mounted worker + isolated PostgreSQL/PostgREST: signed preview capability,
// site/resource isolation, unpublished CMS visibility and resource pagination.
// service_role bypasses RLS; this suite proves gateway/token/query boundaries.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
const owned = requireOwnedDatabase();
let gateway: Gateway;
after(async () => { await gateway?.settle(); });

test('only the current site preview capability reads private CMS resources, with real paginated discovery', async () => {
    const a = newSyntheticTenant('editor-content-a'), b = newSyntheticTenant('editor-content-b');
    seedSyntheticTenant(owned.psql, a); seedSyntheticTenant(owned.psql, b);
    const actor = randomUUID(), foreign = randomUUID(), pageA = randomUUID(), pageB = randomUUID(), articleA = randomUUID(), articleB = randomUUID(), collectionA = randomUUID(), collectionB = randomUUID();
    const email = `editor-${actor}@example.invalid`, foreignEmail = `editor-${foreign}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true),('${foreign}','${foreignEmail}',true);
      UPDATE sites SET custom_user_id='${actor}',theme_id='letbuyy-core',published=false,status='draft' WHERE id='${a.siteId}';
      UPDATE sites SET custom_user_id='${foreign}',published=false,status='draft' WHERE id='${b.siteId}';
      INSERT INTO storefront_pages(id,store_id,title,slug,status,content) VALUES
       ('${pageA}','${a.siteId}','Owned unpublished page','owned-page','draft','{"body":"<p>Owned private page body</p>"}'),
       ('${pageB}','${b.siteId}','Foreign unpublished page','foreign-page','draft','{"body":"Foreign private page body"}');
      INSERT INTO blog_posts(id,store_id,title,slug,status,content_html) VALUES
       ('${articleA}','${a.siteId}','Owned unpublished article','owned-article','draft','<p>Owned private article body</p>'),
       ('${articleB}','${b.siteId}','Foreign unpublished article','foreign-article','draft','Foreign private article body');
      INSERT INTO blog_posts(store_id,title,slug,status) SELECT '${a.siteId}','Synthetic same title','owned-post-'||n,'draft' FROM generate_series(1,22)n;
      INSERT INTO collections(store_id,title,is_active) SELECT '${a.siteId}','A synthetic collection '||n,true FROM generate_series(1,26)n;
      INSERT INTO collections(id,store_id,title,is_active) VALUES('${collectionA}','${a.siteId}','ZZ selected beyond first24',true),('${collectionB}','${b.siteId}','Foreign private collection',true);`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const request = async (path: string, method = 'GET', body?: unknown, user = actor, mail = email, site = a.siteId) => gateway.request(path, {
        method, headers: await signedIdentityHeaders(user, mail, site), ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const theme = '/v1/themes/letbuyy-core';
    const loaded = await request(`${theme}/editor?store_id=${a.siteId}`);
    assert.equal(loaded.status, 200, loaded.text);
    const saved = await request(theme + '/editor/draft', 'PUT', { store_id: a.siteId, template_config: loaded.json!.data.template_config, base_version: loaded.json!.data.version, idempotency_key: 'synthetic-preview-content-save' });
    assert.equal(saved.status, 200, saved.text);
    const session = await request(theme + '/preview-session', 'POST', { store_id: a.siteId, ttl_seconds: 900 });
    assert.equal(session.status, 201, 'preview capability minting must precede negative controls');
    const token = String(session.json!.data.preview_token);
    const previewPath = `/v1/storefront/${a.subdomain}/theme-preview`;
    const read = (query: string, capability = token, handle = a.subdomain) => gateway.request(`/v1/storefront/${handle}/theme-preview?${query}&token=${encodeURIComponent(capability)}`);
    const page = await read(`resource=page&resource_id=${pageA}`);
    assert.equal(page.status, 200); assert.match(page.text, /Owned private page body/);
    assert.equal(page.json!.data.content.id, pageA);
    assert.match(page.headers.get('cache-control') || '', /private.*no-store/);
    const article = await read(`resource=article&resource_id=${articleA}`);
    assert.equal(article.status, 200); assert.match(article.text, /Owned private article body/);
    assert.doesNotMatch(article.text, /Foreign private/);
    for (const [resource, id] of [['page', pageB], ['article', articleB], ['page', randomUUID()]]) assert.equal((await read(`resource=${resource}&resource_id=${id}`)).status, 404);
    assert.equal((await read(`resource=page&resource_id=${pageA}`, token, b.subdomain)).status, 404);
    assert.equal((await read(`resource=page&resource_id=${pageA}`, 'synthetic-invalid-token')).status, 404);
    assert.equal((await gateway.request(previewPath + `?resource=page&resource_id=${pageA}`)).status, 400);
    assert.equal((await read('resource=page&resource_id=invalid')).status, 400);
    assert.equal((await read('resource=blog&page=0')).status, 400);
    const first = await read('resource=blog&page=1&limit=20'), second = await read('resource=blog&page=2&limit=20');
    assert.equal(first.status, 200); assert.equal(second.status, 200);
    assert.equal(first.json!.data.articles.length, 20); assert.equal(second.json!.data.articles.length, 3);
    assert.equal(first.json!.data.pagination.has_more, true); assert.equal(second.json!.data.pagination.has_more, false);
    const ids = [...first.json!.data.articles, ...second.json!.data.articles].map((item: { id: string }) => item.id);
    assert.equal(new Set(ids).size, 23);
    assert.equal(first.json!.data.pagination.total, 23); assert.equal(first.json!.data.pagination.total_pages, 2);
    const firstCollections = await read('resource=collections'); assert.equal(firstCollections.status, 200);
    assert.equal(firstCollections.json!.data.length, 24); assert.ok(!firstCollections.json!.data.some((item: { id: string }) => item.id === collectionA));
    const exactCollection = await read(`resource=collections&collection_id=${collectionA}`);
    assert.equal(exactCollection.status, 200); assert.equal(exactCollection.json!.data.id, collectionA);
    assert.equal(exactCollection.json!.data.title, 'ZZ selected beyond first24');
    assert.equal((await read(`resource=collections&collection_id=${collectionB}`)).status, 404);
    const search = (page: number, user = actor, mail = email, site = a.siteId) => request(`/v1/themes/resource-search?store_id=${a.siteId}&type=blog&limit=20&page=${page}`, 'GET', undefined, user, mail, site);
    const search1 = await search(1), search2 = await search(2);
    assert.equal(search1.status, 200); assert.equal(search2.status, 200);
    assert.equal(search1.json!.data.length, 20); assert.equal(search2.json!.data.length, 3);
    assert.equal(search1.json!.meta.has_more, true); assert.equal(search2.json!.meta.has_more, false);
    assert.equal(new Set([...search1.json!.data, ...search2.json!.data].map((item: { id: string }) => item.id)).size, 23);
    assert.ok([403, 404].includes((await search(1, foreign, foreignEmail, b.siteId)).status));
    // CASE SOURCE ONLY until this exact amended suite receives its own native admission.
    // Mutate only the newly owned draft, then prove that the old capability cannot
    // expose the next revision through either the manifest or resource endpoints.
    const mintedSessionId = String(session.json!.data.preview_session_id);
    assert.match(mintedSessionId, /^[0-9a-f-]{36}$/);
    const boundDraft = JSON.parse(owned.psql(`SELECT json_build_object('instance',theme_instance_draft_id,'legacy',draft_id,'version',draft_version) FROM theme_preview_sessions WHERE id='${mintedSessionId}' AND store_id='${a.siteId}';`)) as { instance: string | null; legacy: string | null; version: number };
    assert.ok(Number.isSafeInteger(boundDraft.version) && boundDraft.version > 0);
    const boundId = boundDraft.instance || boundDraft.legacy;
    assert.ok(boundId); assert.match(boundId, /^[0-9a-f-]{36}$/);
    if (boundDraft.instance) owned.psql(`UPDATE theme_instance_drafts SET draft_version=draft_version+1 WHERE id='${boundId}' AND store_id='${a.siteId}';`);
    else owned.psql(`UPDATE theme_editor_drafts SET version=version+1 WHERE id='${boundId}' AND store_id='${a.siteId}' AND theme_id='letbuyy-core';`);
    for (const query of ['', `resource=page&resource_id=${pageA}`, `resource=article&resource_id=${articleA}`, 'resource=products', 'resource=collections']) {
        const stale = await read(query);
        assert.equal(stale.status, 404, 'an old preview capability must not follow a mutable draft revision');
        assert.match(stale.headers.get('cache-control') || '', /private.*no-store/);
        assert.doesNotMatch(stale.text, /Owned private page body|Owned private article body/);
    }
    const fresh = await request(theme + '/preview-session', 'POST', { store_id: a.siteId, ttl_seconds: 900 });
    assert.equal(fresh.status, 201, 'normal minting must recover without weakening revision matching');
    assert.equal(fresh.json!.data.draft_version, boundDraft.version + 1);
    const freshRead = await read(`resource=page&resource_id=${pageA}`, String(fresh.json!.data.preview_token));
    assert.equal(freshRead.status, 200); assert.match(freshRead.text, /Owned private page body/);
    owned.psql(`UPDATE theme_preview_sessions SET expires_at=now()-interval '1 second' WHERE id='${fresh.json!.data.preview_session_id}' AND store_id='${a.siteId}';`);
    assert.equal((await read(`resource=page&resource_id=${pageA}`, String(fresh.json!.data.preview_token))).status, 404);
    owned.psql(`UPDATE theme_preview_sessions SET expires_at=now()-interval '1 second' WHERE id='${session.json!.data.preview_session_id}';`);
    assert.equal((await read(`resource=page&resource_id=${pageA}`)).status, 404);
});
