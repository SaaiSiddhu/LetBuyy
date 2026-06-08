import assert from 'node:assert/strict';
import test from 'node:test';
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
            R2_BUCKET: bucket as R2Bucket,
        } as Env,
    };
}

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
    assert.match(observedKey, /^media\/user-owner\/.+\.mp4$/);
    assert.match(payload.data?.url || '', /^https:\/\/cdn\.test\/media\/user-owner\/.+\.mp4$/);
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
