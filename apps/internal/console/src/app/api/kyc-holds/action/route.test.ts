import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from './route';

test('Console legal hold action refuses missing or foreign Origin before any credential forwarding', async () => {
    const url = 'https://console.letbuyy.test/api/kyc-holds/action';
    for (const origin of [null, 'https://other.letbuyy.test']) {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        if (origin) headers.set('Origin', origin);
        const response = await POST(new NextRequest(url, { method: 'POST', headers, body: '{}' }));
        assert.equal(response.status, 403);
    }
});

test('Console legal hold action refuses a same-origin request without a current session', async () => {
    const response = await POST(new NextRequest('https://console.letbuyy.test/api/kyc-holds/action', {
        method: 'POST',
        headers: { Origin: 'https://console.letbuyy.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
    }));
    assert.equal(response.status, 401);
});
