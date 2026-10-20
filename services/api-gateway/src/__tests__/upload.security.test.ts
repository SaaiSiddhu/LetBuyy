import assert from 'node:assert/strict';
import test, {beforeEach,afterEach} from 'node:test';
const originalFetch=globalThis.fetch;
beforeEach(()=>{globalThis.fetch=(async(input:RequestInfo|URL)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(url.origin,'https://upload-unit.invalid');const table=url.pathname.split('/').pop();if(table==='users_custom')return Response.json([{id:'user-owner',email:'owner@example.invalid'}]);if(table==='sites')return Response.json([{id:'store-owner'}]);throw new Error('Unexpected upload unit dependency');}) as typeof fetch;});
afterEach(()=>{globalThis.fetch=originalFetch;});
import { Hono } from 'hono';
import type { Env } from '../index';
import uploadRouter from '../routes/upload.ts';

function createUploadApp(userId: string, bucket: Partial<R2Bucket>, storeId = 'store-owner') {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
        c.set('auth', { user: { id: userId, email: 'owner@example.com', storeId } });
        await next();
    });
    app.route('/upload', uploadRouter);
    return {
        app,
        env: {
            ENVIRONMENT: 'test',
            SUPABASE_URL: 'https://upload-unit.invalid',
            SUPABASE_SERVICE_ROLE_KEY: 'synthetic-upload-unit-only',
            R2_BUCKET: bucket as R2Bucket,
        } as Env,
    };
}

test('recognized KYC/private document folders cannot write public R2 objects or return public URLs', async () => {
    let writes = 0;
    const { app, env } = createUploadApp('user-owner', {
        put: async () => { writes++; throw new Error('Private evidence reached public storage'); },
    });
    env.ENVIRONMENT = 'production';
    env.ASSET_PUBLIC_BASE_URL = 'https://cdn.test';
    for (const folder of [
        'kyc-documents', '/KYC_DOCUMENTS/', 'kyc/documents', 'kyc',
        'stores/kyc-documents/proof', 'private-documents', 'private/documents',
        'identity-proofs', 'verification/evidence', 'kyc%2Fdocuments',
        'KycDocuments', 'privateDocuments', 'ｋｙｃ/documents', 'private\\documents',
    ]) {
        const body = new FormData();
        body.set('folder', folder);
        body.set('file', new File(['synthetic-no-personal-data'], 'proof.png', { type: 'image/png' }));
        const response = await app.request('/upload', { method: 'POST', body }, env);
        const payload = await response.json() as { error: { code: string }; data?: unknown };
        assert.equal(response.status, 503, folder);
        assert.equal(payload.error.code, 'KYC_PRIVATE_UPLOAD_UNAVAILABLE', folder);
        assert.equal(payload.data, undefined, folder);
    }
    assert.equal(writes, 0);
});

test('private document containment also refuses development inline storage before returning file bytes', async () => {
    const { app, env } = createUploadApp('user-owner', {});
    delete env.R2_BUCKET;
    const body = new FormData();
    body.set('folder', 'kyc-documents');
    body.set('file', new File(['synthetic-no-personal-data'], 'proof.png', { type: 'image/png' }));
    const response = await app.request('/upload', { method: 'POST', body }, env);
    const payload = await response.json() as { error: { code: string }; data?: unknown };
    assert.equal(response.status, 503);
    assert.equal(payload.error.code, 'KYC_PRIVATE_UPLOAD_UNAVAILABLE');
    assert.equal(payload.data, undefined);
});

test('ordinary public product images still upload and retain their store and MIME controls', async () => {
    let writes = 0;
    const { app, env } = createUploadApp('user-owner', {
        put: async () => { writes++; return null as unknown as R2Object; },
    });
    env.ASSET_PUBLIC_BASE_URL = 'https://cdn.test';
    const send = (storeId: string, type: string) => {
        const body = new FormData();
        body.set('folder', 'products'); body.set('store_id', storeId);
        body.set('file', new File(['synthetic-image'], 'product.png', { type }));
        return app.request('/upload', { method: 'POST', body }, env);
    };
    const positive = await send('store-owner', 'image/png');
    assert.equal(positive.status, 201);
    const payload = await positive.json() as { data: { url: string; store_id: string } };
    assert.match(payload.data.url, /^http:\/\/localhost\/assets\/public-media\/products\/user-owner\//);
    assert.equal(payload.data.store_id, 'store-owner');
    assert.equal((await send('rival-store', 'image/png')).status, 403);
    assert.equal((await send('store-owner', 'image/svg+xml')).status, 400);
    assert.equal(writes, 1);
});

test('upload accepts storefront video assets above the image limit and records video metadata', async () => {
    let observedKey = '';
    let observedContentType = '';
    let observedMediaType = '';
    const { app, env } = createUploadApp('user-owner', {
        put: async (key: string, _value: unknown, options?: R2PutOptions) => {
            const httpMetadata = options?.httpMetadata as { contentType?: string } | undefined;
            const customMetadata = options?.customMetadata as Record<string, string> | undefined;
            observedKey = key;
            observedContentType = httpMetadata?.contentType || '';
            observedMediaType = customMetadata?.media_type || '';
            return null as unknown as R2Object;
        },
    });
    env.ASSET_PUBLIC_BASE_URL = 'https://cdn.test';
    const body = new FormData();
    body.set('store_id', 'store-owner');
    body.set('folder', 'media');
    body.set('file', new File([new Uint8Array(11 * 1024 * 1024)], 'launch.mp4', { type: 'video/mp4' }));

    const response = await app.request('/upload', { method: 'POST', body }, env);
    const payload = await response.json() as { data?: { content_type?: string; media_type?: string; url?: string } };

    assert.equal(response.status, 201);
    assert.equal(payload.data?.content_type, 'video/mp4');
    assert.equal(payload.data?.media_type, 'video');
    assert.equal(observedContentType, 'video/mp4');
    assert.equal(observedMediaType, 'video');
    assert.match(observedKey, /^public-media\/media\/user-owner\/.+\.mp4$/);
    assert.match(payload.data?.url || '', /^http:\/\/localhost\/assets\/public-media\/media\/user-owner\/.+\.mp4$/);
});

test('upload delete derives the object key from the wildcard route parameter and verifies store ownership', async () => {
    let observedHeadKey = '';
    let observedDeleteKey = '';
    const { app, env } = createUploadApp('user-owner', {
        head: async (key: string) => {
            observedHeadKey = key;
            return { customMetadata: { owner_id: 'user-owner', store_id: 'store-owner' } } as unknown as R2Object;
        },
        delete: async (key: string) => {
            observedDeleteKey = key;
        },
    });

    const response = await app.request('/upload/media/user-owner/product.png', { method: 'DELETE' }, env);

    assert.equal(response.status, 200);
    assert.equal(observedHeadKey, 'media/user-owner/product.png');
    assert.equal(observedDeleteKey, 'media/user-owner/product.png');
});

test('upload delete denies objects owned by another user and does not delete them', async () => {
    let deleteCalled = false;
    const { app, env } = createUploadApp('user-owner', {
        head: async () => ({ customMetadata: { owner_id: 'other-user' } }) as unknown as R2Object,
        delete: async () => {
            deleteCalled = true;
        },
    });

    const response = await app.request('/upload/media/other-user/product.png', { method: 'DELETE' }, env);
    const payload = await response.json() as { error?: { code?: string } };

    assert.equal(response.status, 403);
    assert.equal(payload.error?.code, 'FORBIDDEN');
    assert.equal(deleteCalled, false);
});

test('upload delete rejects store metadata outside the authenticated store scope', async () => {
    let deleteCalled = false;
    const { app, env } = createUploadApp('user-owner', {
        head: async () => ({ customMetadata: { owner_id: 'user-owner', store_id: 'other-store' } }) as unknown as R2Object,
        delete: async () => {
            deleteCalled = true;
        },
    }, 'store-owner');

    const response = await app.request('/upload/media/user-owner/product.png', { method: 'DELETE' }, env);
    const payload = await response.json() as { error?: { code?: string } };

    assert.equal(response.status, 403);
    assert.equal(payload.error?.code, 'FORBIDDEN');
    assert.equal(deleteCalled, false);
});

test('legacy upload delete requires an owned store query as well as owner metadata', async () => {
    let observedDeleteKey = '';
    const { app, env } = createUploadApp('user-owner', {
        head: async () => ({ customMetadata: { owner_id: 'user-owner' } }) as unknown as R2Object,
        delete: async (key: string) => {
            observedDeleteKey = key;
        },
    }, 'store-owner');

    const blocked = await app.request('/upload/media/user-owner/product.png', { method: 'DELETE' }, env);
    assert.equal(blocked.status, 403);

    const allowed = await app.request('/upload/media/user-owner/product.png?store_id=store-owner', { method: 'DELETE' }, env);
    assert.equal(allowed.status, 200);
    assert.equal(observedDeleteKey, 'media/user-owner/product.png');
});

test('production public delivery is explicit and survives an internal service host without selecting the legacy CDN', async () => {
    let writes=0;
    const {app,env}=createUploadApp('user-owner',{put:async()=>{writes++;return null as unknown as R2Object;}});
    env.ENVIRONMENT='production';env.ASSET_PUBLIC_BASE_URL='https://cdn.test';
    const send=()=>{const body=new FormData();body.set('store_id','store-owner');body.set('folder','products');body.set('file',new File(['synthetic-image'],'image.png',{type:'image/png'}));return app.request('https://api-gateway.internal/upload',{method:'POST',body},env);};
    assert.equal((await send()).status,503);assert.equal(writes,0);
    env.UPLOAD_PUBLIC_BASE_URL='https://api-public.invalid/assets';
    const positive=await send();assert.equal(positive.status,201);
    const payload=await positive.json() as {data:{url:string;cdn_configured:boolean}};
    assert.match(payload.data.url,/^https:\/\/api-public\.invalid\/assets\/public-media\//);assert.equal(payload.data.cdn_configured,false);
    env.UPLOAD_PUBLIC_BASE_URL='https://api-public.invalid/unregistered';assert.equal((await send()).status,503);assert.equal(writes,1);
});
