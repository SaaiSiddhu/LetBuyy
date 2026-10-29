import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticOrder, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
let gateway: Gateway;
after(async () => { await gateway?.settle(); });

test('two store editors cannot overwrite a cleared contact or cross tenant boundary', async () => {
    const first = newSyntheticTenant('profile-a');
    const second = newSyntheticTenant('profile-b');
    seedSyntheticTenant(owned.psql, first);
    seedSyntheticTenant(owned.psql, second);
    const owner = randomUUID(), other = randomUUID(), staff = randomUUID();
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES
        ('${owner}','profile-${owner}@example.invalid',true,'Synthetic owner'),
        ('${other}','profile-${other}@example.invalid',true,'Synthetic other'),
        ('${staff}','profile-${staff}@example.invalid',true,'Synthetic read-only staff');
        UPDATE sites SET custom_user_id='${owner}', business_profile='{"email":"old@example.invalid","trade_name":"Original"}'::jsonb,
            site_settings='{"primary_color":"#123456","checkout":{"internal_secret":"never-public"}}'::jsonb,
            settings='{"private_note":"never-public"}'::jsonb WHERE id='${first.siteId}';
        UPDATE sites SET custom_user_id='${other}' WHERE id='${second.siteId}';
        INSERT INTO site_memberships(site_id,custom_user_id,role_slugs,permissions,status)
            VALUES('${first.siteId}','${staff}',ARRAY['staff'],ARRAY['store:read'],'active');`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const request = async (siteId: string, actor: string, body: Record<string, unknown>) =>
        gateway.request(`/v1/stores/${siteId}`, { method: 'PATCH', headers: {
            ...await signedIdentityHeaders(actor, `profile-${actor}@example.invalid`, siteId),
            'X-Idempotency-Key': randomUUID(),
        }, body: JSON.stringify(body) });
    const initial = JSON.parse(owned.psql(`SELECT json_build_object('version',version,'business_profile',business_profile) FROM sites WHERE id='${first.siteId}';`));
    const clear = await request(first.siteId, owner, { version: initial.version, business_profile: { trade_name: 'Original' } });
    assert.equal(clear.status, 200, clear.text);
    assert.equal(clear.json?.data.business_profile.email, undefined);
    const stale = await request(first.siteId, owner, { version: initial.version, business_profile: { email: 'stale@example.invalid' } });
    assert.equal(stale.status, 409, stale.text);
    assert.equal(owned.psql(`SELECT business_profile ? 'email' FROM sites WHERE id='${first.siteId}';`), 'f');
    const forged = await request(second.siteId, owner, { version: 1, business_profile: { email: 'forged@example.invalid' } });
    assert.equal(forged.status, 403, forged.text);
    assert.equal(owned.psql(`SELECT business_profile ? 'email' FROM sites WHERE id='${second.siteId}';`), 'f');
    const unauthorizedStaff = await request(first.siteId, staff, { version: Number(owned.psql(`SELECT version FROM sites WHERE id='${first.siteId}';`)), name: 'Forged staff name' });
    assert.equal(unauthorizedStaff.status, 403, unauthorizedStaff.text);
    assert.notEqual(owned.psql(`SELECT name FROM sites WHERE id='${first.siteId}';`), 'Forged staff name');

    owned.psql(`SELECT public.publish_theme_release('${first.siteId}','letbuyy-core','{}'::jsonb);`);
    const publicPath = `/v1/storefront/${first.subdomain}?projection=render-v1`;
    const privateRead = await gateway.request(publicPath);
    assert.equal(privateRead.status, 200, privateRead.text);
    assert.equal(privateRead.json?.data.public_contact, null);
    assert.equal('business_profile' in privateRead.json!.data, false);
    assert.equal('user_id' in privateRead.json!.data, false);
    assert.equal('custom_user_id' in privateRead.json!.data, false);
    assert.equal('settings' in privateRead.json!.data, false);
    assert.deepEqual(privateRead.json?.data.site_settings, { primary_color: '#123456' });
    assert.doesNotMatch(privateRead.text, /never-public/);

    const currentVersion = Number(owned.psql(`SELECT version FROM sites WHERE id='${first.siteId}';`));
    const optIn = await request(first.siteId, owner, { version: currentVersion,
        name: 'New public merchant name', tagline: 'Fresh merchant tagline',
        seo_title: 'New public merchant SEO title', seo_description: 'A revised public search description.',
        business_profile: {
        email: 'merchant@example.invalid', phone: '+919876543210', legal_name: 'Private Legal Name',
        pan_last4: '1234', public_contact_enabled: true,
    } });
    assert.equal(optIn.status, 200, optIn.text);
    const persisted = JSON.parse(owned.psql(`SELECT json_build_object('name',name,'tagline',tagline,'meta_title',meta_title,'meta_description',meta_description) FROM sites WHERE id='${first.siteId}';`));
    assert.deepEqual(persisted, { name: 'New public merchant name', tagline: 'Fresh merchant tagline',
        meta_title: 'New public merchant SEO title', meta_description: 'A revised public search description.' });
    const publicRead = await gateway.request(publicPath);
    assert.equal(publicRead.status, 200, publicRead.text);
    assert.equal(publicRead.json?.data.name, persisted.name);
    assert.equal(publicRead.json?.data.tagline, persisted.tagline);
    assert.equal(publicRead.json?.data.meta_title, persisted.meta_title);
    assert.equal(publicRead.json?.data.meta_description, persisted.meta_description);
    assert.deepEqual(publicRead.json?.data.public_contact, { email: 'merchant@example.invalid', phone: '+919876543210' });
    assert.doesNotMatch(publicRead.text, /Private Legal Name|pan_last4|business_profile/);

    const clearPublicEmail = await request(first.siteId, owner, { version: optIn.json!.data.version, business_profile: {
        phone: '+919876543210', public_contact_enabled: true,
    } });
    assert.equal(clearPublicEmail.status, 200, clearPublicEmail.text);
    const clearedRead = await gateway.request(publicPath);
    assert.equal(clearedRead.status, 200, clearedRead.text);
    assert.deepEqual(clearedRead.json?.data.public_contact, { phone: '+919876543210' });
    assert.doesNotMatch(clearedRead.text, /merchant@example.invalid/);

    const { orderId } = seedSyntheticOrder(owned.psql, first);
    const notificationName = owned.psql(`SELECT metadata->'snapshot'->>'store_name' FROM email_logs
        WHERE site_id='${first.siteId}' AND metadata->>'order_id'='${orderId}' AND template_key='order_lifecycle_v1';`);
    assert.equal(notificationName, persisted.name, 'order notification captures the merchant public name at order creation');
    const rename = await request(first.siteId, owner, { version: clearPublicEmail.json!.data.version,
        name: 'Merchant name after the order',
    });
    assert.equal(rename.status, 200, rename.text);
    assert.equal(owned.psql(`SELECT metadata->'snapshot'->>'store_name' FROM email_logs
        WHERE site_id='${first.siteId}' AND metadata->>'order_id'='${orderId}' AND template_key='order_lifecycle_v1';`),
        persisted.name, 'editing the current profile does not rewrite an existing order notification');
});
