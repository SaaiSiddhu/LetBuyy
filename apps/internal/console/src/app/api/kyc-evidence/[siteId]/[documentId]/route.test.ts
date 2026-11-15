import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from './route';

test('private KYC proxy denies a request without a current Console session before any upstream read', async () => {
    const originalFetch = globalThis.fetch;
    let upstreamCalls = 0;
    globalThis.fetch = async () => {
        upstreamCalls++;
        throw new Error('upstream must not be called');
    };
    try {
        const request = new NextRequest('https://console.letbuyy.test/api/kyc-evidence/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222?reason=Reviewing+private+evidence');
        const response = await GET(request, { params: Promise.resolve({
            siteId: '11111111-1111-4111-8111-111111111111',
            documentId: '22222222-2222-4222-8222-222222222222',
        }) });
        assert.equal(response.status, 401);
        assert.equal(upstreamCalls, 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
