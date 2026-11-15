// Real mounted Worker/middleware + owned PostgREST/Postgres. Only public R2 is
// an in-memory provider fixture; no external storage/provider call is made.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import test, { after } from 'node:test';
import type { Env } from '../../index';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest } from './gateway-harness';

const owned = requireOwnedDatabase();
const gateways: Gateway[] = [];
after(async () => { for (const gateway of gateways) await gateway.settle(); });
const content = (name = 'A') => JSON.stringify({ asset: { version: '2.0' }, extras: { name } });

async function fixture(tag: string) {
    const tenant = newSyntheticTenant(tag), owner = randomUUID(), replacement = randomUUID();
    const email = `syn-media-${owner}@example.invalid`;
    seedSyntheticTenant(owned.psql, tenant);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES
      ('${owner}','${email}',true),('${replacement}','syn-media-${replacement}@example.invalid',true);
      UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);
    const puts: { key: string; bytes: Uint8Array }[] = [];
    const objects = new Map<string, { bytes: Uint8Array; options?: R2PutOptions }>();
    const bucket = {
        put: async (key: string, value: ReadableStream<Uint8Array>, options?: R2PutOptions) => {
            const bytes = new Uint8Array(await new Response(value).arrayBuffer());
            puts.push({ key, bytes });
            objects.set(key, { bytes, options });
            return null;
        },
        head: async (key: string) => {
            const object = objects.get(key);
            return object ? { key, size: object.bytes.length, customMetadata: object.options?.customMetadata, httpMetadata: object.options?.httpMetadata } : null;
        },
    } as unknown as NonNullable<Env['R2_BUCKET']>;
    const gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), {
        ENVIRONMENT: 'test', R2_BUCKET: bucket,
    }));
    gateways.push(gateway);
    async function headers(key: string, json = false) {
        const values = await signedIdentityHeaders(owner, email, tenant.siteId);
        if (!json) delete values['Content-Type'];
        values['X-Idempotency-Key'] = key;
        return values;
    }
    async function upload(key: string) {
        const form = new FormData();
        form.set('store_id', tenant.siteId);
        form.set('folder', 'media');
        form.set('file', new File([content()], 'synthetic.gltf', { type: 'model/gltf+json' }));
        return gateway.request('/v1/upload', { method: 'POST', headers: await headers(key), body: form });
    }
    return { tenant, owner, replacement, email, puts, objects, gateway, headers, upload };
}

test('public upload replays identical file input under its original key despite a new multipart boundary', async () => {
    const f = await fixture('media-boundary'), key = randomUUID();
    const first = await f.upload(key);
    assert.equal(first.status, 201, first.text);
    assert.equal(f.puts.length, 1, 'positive storage effect must be observed');
    const repeated = await f.upload(key);
    assert.equal(repeated.status, 201, repeated.text);
    assert.deepEqual(repeated.json?.data, first.json?.data);
    assert.equal(f.puts.length, 1, 'the original acknowledgement must not write another object');
    assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${f.tenant.siteId}' AND key='${key}' AND status='completed'`), '1');
});

test('a fixed multipart envelope cannot hide changed same-length file bytes under the old key', async () => {
    const f = await fixture('media-bytes'), key = randomUUID(), boundary = 'owned-media-fixed-boundary';
    function body(name: string) {
        return `--${boundary}\r\nContent-Disposition: form-data; name="store_id"\r\n\r\n${f.tenant.siteId}\r\n`
          + `--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\nmedia\r\n`
          + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.gltf"\r\nContent-Type: model/gltf+json\r\n\r\n${content(name)}\r\n--${boundary}--\r\n`;
    }
    const original = body('A'), changed = body('B');
    assert.equal(Buffer.byteLength(original), Buffer.byteLength(changed));
    async function send(payload: string) {
        return f.gateway.request('/v1/upload', { method: 'POST', body: payload, headers: {
            ...await f.headers(key), 'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': String(Buffer.byteLength(payload)),
        } });
    }
    assert.equal((await send(original)).status, 201);
    assert.equal(f.puts.length, 1);
    const refused = await send(changed);
    assert.equal(refused.status, 409, refused.text);
    assert.equal(f.puts.length, 1);
    assert.equal(new TextDecoder().decode(f.puts[0].bytes), content('A'));
});

test('a revoked media owner cannot replay a cached mutation after a fresh read is denied', async () => {
    const f = await fixture('media-authority'), key = randomUUID();
    const input = { store_id: f.tenant.siteId, filename: 'synthetic.png',
        url: 'https://assets.example.invalid/synthetic.png', mime_type: 'image/png',
        size_bytes: 12, storage_key: `synthetic/${randomUUID()}.png` };
    async function create() {
        return f.gateway.request('/v1/media', { method: 'POST',
            headers: await f.headers(key, true), body: JSON.stringify(input) });
    }
    const created = await create();
    assert.equal(created.status, 201, created.text);
    const id = (created.json?.data as { id: string }).id;
    const before = await f.gateway.request(`/v1/media?store_id=${f.tenant.siteId}`, { headers: await f.headers(randomUUID()) });
    assert.equal(before.status, 200, before.text);
    assert.ok((before.json?.data as { id: string }[]).some(row => row.id === id));
    owned.psql(`UPDATE sites SET custom_user_id='${f.replacement}' WHERE id='${f.tenant.siteId}'`);
    const denied = await f.gateway.request(`/v1/media?store_id=${f.tenant.siteId}`, { headers: await f.headers(randomUUID()) });
    assert.equal(denied.status, 403, denied.text);
    const replay = await create();
    assert.equal(replay.status, 403, replay.text);
    assert.equal(owned.psql(`SELECT count(*) FROM media WHERE id='${id}' AND store_id='${f.tenant.siteId}'`), '1');
});

test('concurrent identical uploads retain one object and one completed receipt', async () => {
    const f = await fixture('media-concurrent'), key = randomUUID();
    const responses = await Promise.all([f.upload(key), f.upload(key)]);
    assert.ok(responses.some(r => r.status === 201));
    assert.ok(responses.every(r => [201, 409].includes(r.status)), responses.map(r => r.text).join('\n'));
    const recovered = await f.upload(key);
    assert.equal(recovered.status, 201, recovered.text);
    assert.equal(f.puts.length, 1);
    assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${f.tenant.siteId}' AND key='${key}' AND status='completed'`), '1');
});

test('a revoked upload owner cannot replay the stored public object acknowledgement', async () => {
    const f = await fixture('upload-authority'), key = randomUUID();
    assert.equal((await f.upload(key)).status, 201);
    assert.equal(f.puts.length, 1);
    owned.psql(`UPDATE sites SET custom_user_id='${f.replacement}' WHERE id='${f.tenant.siteId}'`);
    const denied = await f.upload(key);
    assert.equal(denied.status, 403, denied.text);
    assert.equal(f.puts.length, 1);
});

test('receipt recovery rejects a selected store different from the original upload', async () => {
    const f = await fixture('upload-selection'), key = randomUUID();
    assert.equal((await f.upload(key)).status, 201);
    const form = new FormData();
    form.set('store_id', f.tenant.siteId); form.set('folder', 'media');
    form.set('file', new File([content()], 'synthetic.gltf', { type: 'model/gltf+json' }));
    const headers = await f.headers(key); headers['X-Store-ID'] = randomUUID();
    const denied = await f.gateway.request('/v1/upload', { method: 'POST', headers, body: form });
    assert.equal(denied.status, 403, denied.text);
    assert.equal(f.puts.length, 1);
});

test('upload folder and filename remain immutable under the original key', async () => {
    const f = await fixture('upload-metadata'), key = randomUUID();
    assert.equal((await f.upload(key)).status, 201);
    for (const [folder, name] of [['changed', 'synthetic.gltf'], ['media', 'renamed.gltf']]) {
        const form = new FormData(); form.set('store_id', f.tenant.siteId); form.set('folder', folder);
        form.set('file', new File([content()], name, { type: 'model/gltf+json' }));
        const refused = await f.gateway.request('/v1/upload', { method: 'POST', headers: await f.headers(key), body: form });
        assert.equal(refused.status, 409, refused.text);
    }
    assert.equal(f.puts.length, 1);
});

function recoveryInput(siteId: string, key: string) {
    return { store_id: siteId, idempotency_key: key, filename: 'synthetic.gltf',
        folder: 'media', content_type: 'model/gltf+json', byte_size: Buffer.byteLength(content()),
        sha256_hex: createHash('sha256').update(content()).digest('hex') };
}

test('read-only recovery returns a committed upload without bytes or another receipt/effect', async () => {
    const f = await fixture('upload-recover'), key = randomUUID();
    const uploaded = await f.upload(key);
    assert.equal(uploaded.status, 201, uploaded.text); assert.equal(f.puts.length, 1);
    const count = () => owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${f.tenant.siteId}'`);
    const before = count();
    const recover = async (input: Record<string, unknown>) => f.gateway.request('/v1/upload/recover', {
        method: 'POST', headers: await f.headers(randomUUID(), true), body: JSON.stringify(input),
    });
    const input = recoveryInput(f.tenant.siteId, key);
    const result = await recover(input);
    assert.equal(result.status, 200, result.text);
    assert.deepEqual(result.json?.data, uploaded.json?.data);
    assert.equal(count(), before); assert.equal(f.puts.length, 1);
    const mismatch = await recover({ ...input, sha256_hex: '0'.repeat(64) });
    assert.equal(mismatch.status, 409, mismatch.text);
    owned.psql(`UPDATE sites SET custom_user_id='${f.replacement}' WHERE id='${f.tenant.siteId}'`);
    const revoked = await recover(input);
    assert.equal(revoked.status, 403, revoked.text);
    assert.equal(count(), before); assert.equal(f.puts.length, 1);
});

test('an unknown upload receipt stays unavailable and does not claim or send anything', async () => {
    const f = await fixture('upload-no-receipt');
    const response = await f.gateway.request('/v1/upload/recover', {
        method: 'POST', headers: await f.headers(randomUUID(), true),
        body: JSON.stringify(recoveryInput(f.tenant.siteId, randomUUID())),
    });
    assert.equal(response.status, 409, response.text);
    assert.equal(f.puts.length, 0);
    assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${f.tenant.siteId}'`), '0');
});


test('changed file bytes cannot be sent under the client saved checksum and unsafe MIME stays rejected', async () => {
    const f = await fixture('upload-client-digest');
    for (const [type, checksum, status, code] of [
        ['model/gltf+json', '0'.repeat(64), 409, 'UPLOAD_FILE_CHANGED'],
        ['image/svg+xml', null, 400, 'MIME_NOT_ALLOWED'],
    ] as const) {
        const form = new FormData(); form.set('store_id', f.tenant.siteId); form.set('folder', 'media');
        if (checksum) form.set('sha256_hex', checksum);
        form.set('file', new File([content()], 'synthetic.gltf', { type }));
        const refused = await f.gateway.request('/v1/upload', { method: 'POST', headers: await f.headers(randomUUID()), body: form });
        assert.equal(refused.status, status, refused.text);
        assert.equal((refused.json?.error as { code: string }).code, code);
    }
    assert.equal(f.puts.length, 0);
    assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${f.tenant.siteId}'`), '0');
});


test('receipt recovery holds a missing storage object instead of declaring it ready for library creation', async () => {
    const f = await fixture('upload-lost-object'), key = randomUUID();
    const uploaded = await f.upload(key); assert.equal(uploaded.status, 201, uploaded.text);
    const objectKey = (uploaded.json?.data as { key: string }).key;
    assert.equal(f.objects.delete(objectKey), true);
    const response = await f.gateway.request('/v1/upload/recover', { method: 'POST',
        headers: await f.headers(randomUUID(), true), body: JSON.stringify(recoveryInput(f.tenant.siteId, key)) });
    assert.equal(response.status, 503, response.text);
    assert.equal((response.json?.error as { code: string }).code, 'UPLOAD_OBJECT_UNCONFIRMED');
    assert.equal(f.puts.length, 1);
    assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${f.tenant.siteId}'`), '1');
});


test('storage acceptance survives failed server receipt completion without another object upload', async () => {
    const f = await fixture('upload-ack-loss'), key = randomUUID();
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.resource === 'idempotency_keys' && call.method === 'PATCH'
            && (call.json as { status?: string } | null)?.status === 'completed') {
            return new Response(JSON.stringify({ code: 'XX000', message: 'Synthetic receipt acknowledgement outage' }),
                { status: 503, headers: { 'content-type': 'application/json' } });
        }
        return forward();
    });
    let first;
    try { first = await f.upload(key); } finally { tap.restore(); }
    assert.equal(first.status, 500, first.text);
    assert.equal(f.puts.length, 1, 'positive committed storage effect before lost SQL acknowledgement');
    assert.equal(owned.psql(`SELECT status FROM idempotency_keys WHERE site_id='${f.tenant.siteId}' AND key='${key}'`), 'processing');
    const recovered = await f.gateway.request('/v1/upload/recover', { method: 'POST',
        headers: await f.headers(randomUUID(), true), body: JSON.stringify(recoveryInput(f.tenant.siteId, key)) });
    assert.equal(recovered.status, 200, recovered.text);
    assert.equal((recovered.json?.data as { key: string }).key, f.puts[0].key);
    assert.equal(f.puts.length, 1);
    assert.equal(owned.psql(`SELECT count(*) FROM idempotency_keys WHERE site_id='${f.tenant.siteId}' AND key='${key}' AND status='completed'`), '1');
});
