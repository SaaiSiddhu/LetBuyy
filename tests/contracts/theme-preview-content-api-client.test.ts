import assert from 'node:assert/strict';
import test from 'node:test';
import { createLetbuyyApiClient, LetbuyyApiError } from '../../packages/typescript/api-client/src/index';

test('private preview content uses the canonical endpoint and exact resource; caller query cannot replace its token/site context', async () => {
    const calls: Array<{ url: URL; init: RequestInit | undefined }> = [];
    const payload = { resource: 'page', content: { id: '33333333-3333-4333-8333-333333333333', title: 'Synthetic owned draft' }, articles: [], pagination: { page: 1, limit: 1, has_more: false } };
    const client = createLetbuyyApiClient({ baseUrl: 'https://gateway.example.invalid/v1', fetch: async (input, init) => {
        calls.push({ url: new URL(String(input)), init }); return Response.json({ success: true, data: payload });
    } });
    assert.deepEqual(await client.storefront.themePreviewContent('synthetic-editor', 'synthetic-token', { resource: 'page', resource_id: payload.content.id }, { query: { token: 'wrong-token', store_id: 'caller-site' } }), payload);
    assert.equal(calls[0].url.pathname, '/v1/storefront/synthetic-editor/theme-preview');
    assert.equal(calls[0].url.searchParams.get('token'), 'synthetic-token');
    assert.equal(calls[0].url.searchParams.get('resource_id'), payload.content.id);
    assert.equal(calls[0].url.searchParams.has('store_id'), false);
});
test('missing preview resources remain explicit failures in the SDK', async () => {
    const client = createLetbuyyApiClient({ baseUrl: 'https://gateway.example.invalid/v1', fetch: async () => Response.json({ success: false, error: { code: 'NOT_FOUND', message: 'Preview content not found.' } }, { status: 404 }) });
    await assert.rejects(client.storefront.themePreviewContent('synthetic-editor', 'synthetic-token', { resource: 'article', resource_id: '33333333-3333-4333-8333-333333333333' }), error => error instanceof LetbuyyApiError && error.status === 404);
});
