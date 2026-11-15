import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
let gateway: Gateway;
after(async () => { await gateway?.settle(); });

// Complete the existing sites.version protocol already used by the newer
// canonical Merchant source. This changes no schema or migration allocation.
test('two store editors cannot resurrect a cleared contact with an old version', async () => {
    const site = newSyntheticTenant('profile-cas');
    seedSyntheticTenant(owned.psql, site);
    const actor = randomUUID(), email = `syn-profile-${actor}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name)
        VALUES('${actor}','${email}',true,'Synthetic Profile Owner');
        UPDATE sites SET custom_user_id='${actor}',business_profile=
            '{"email":"old-contact@example.invalid","trade_name":"Retained synthetic trade"}'::jsonb
        WHERE id='${site.siteId}';`);
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const send = async (body: Record<string, unknown>) => gateway.request(`/v1/stores/${site.siteId}`, {
        method: 'PATCH', headers: {
            ...await signedIdentityHeaders(actor, email, site.siteId),
            'X-Idempotency-Key': randomUUID(),
        }, body: JSON.stringify(body),
    });
    const read = await gateway.request(`/v1/stores/${site.siteId}`, {
        headers: await signedIdentityHeaders(actor, email, site.siteId),
    });
    assert.equal(read.status, 200, read.text);
    const version = read.json?.data.version;
    assert(Number.isSafeInteger(version) && version > 0, 'positive current revision is required');
    const first = await send({ version, business_profile: { trade_name: 'Retained synthetic trade' } });
    assert.equal(first.status, 200, first.text);
    assert.equal(first.json?.data.version, version + 1);
    assert.equal('email' in first.json!.data.business_profile, false);
    const stale = await send({ version, business_profile: { email: 'old-contact@example.invalid' } });
    assert.equal(stale.status, 409, stale.text);
    assert.equal(owned.psql(`SELECT business_profile ? 'email' FROM sites WHERE id='${site.siteId}'`), 'f');
    const missing = await send({ name: 'Unversioned overwrite' });
    assert.equal(missing.status, 409, missing.text);
    assert.equal(missing.json?.error.code, 'STORE_VERSION_REQUIRED');
    assert.equal(Number(owned.psql(`SELECT version FROM sites WHERE id='${site.siteId}'`)), version + 1);
    const current = await send({ version: version + 1, name: 'Reviewed current name' });
    assert.equal(current.status, 200, current.text);
    assert.equal(current.json?.data.version, version + 2);
    assert.equal(current.json?.data.name, 'Reviewed current name');
    const raceVersion = version + 2;
    const raced = await Promise.all([
        send({ version: raceVersion, name: 'Concurrent editor A' }),
        send({ version: raceVersion, name: 'Concurrent editor B' }),
    ]);
    assert.deepEqual(raced.map(result => result.status).sort(), [200, 409]);
    assert.equal(Number(owned.psql(`SELECT version FROM sites WHERE id='${site.siteId}'`)), raceVersion + 1);
    assert.equal(owned.psql(`SELECT business_profile ? 'email' FROM sites WHERE id='${site.siteId}'`), 'f');
    for (const invalid of [0, -1, 1.5, '1']) {
        assert.equal((await send({ version: invalid, name: 'Invalid revision' })).status, 400);
    }
    assert.equal(Number(owned.psql(`SELECT version FROM sites WHERE id='${site.siteId}'`)), raceVersion + 1);

    const foreign = newSyntheticTenant('profile-foreign');
    seedSyntheticTenant(owned.psql, foreign);
    const other = randomUUID();
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name)
        VALUES('${other}','syn-profile-${other}@example.invalid',true,'Synthetic Other Owner');
        UPDATE sites SET custom_user_id='${other}' WHERE id='${foreign.siteId}';`);
    const forged = await gateway.request(`/v1/stores/${foreign.siteId}`, {
        method: 'PATCH', headers: {
            ...await signedIdentityHeaders(actor, email, foreign.siteId),
            'X-Idempotency-Key': randomUUID(),
        }, body: JSON.stringify({ version: 2, name: 'Forged foreign edit' }),
    });
    assert.equal(forged.status, 403, forged.text);
    assert.notEqual(owned.psql(`SELECT name FROM sites WHERE id='${foreign.siteId}'`), 'Forged foreign edit');
    // The existing dedicated tax setting does not silently become a profile
    // protocol break; every new profile save still observes its resulting version.
    const taxOnly = await send({ tax_inclusive: false });
    assert.equal(taxOnly.status, 200, taxOnly.text);
    assert.equal(taxOnly.json?.data.version, raceVersion + 2);
});
