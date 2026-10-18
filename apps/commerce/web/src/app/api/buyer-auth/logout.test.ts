import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { STOREFRONT_BUYER_SESSION_COOKIE } from '@/lib/buyer-auth/flow';
import { POST } from './logout/route';

function logoutRequest(origin: string, options: { fetchSite?: string; accept?: string; returnTo?: string } = {}) {
    const url = new URL('https://shop.example.test/api/buyer-auth/logout');
    if (options.returnTo) url.searchParams.set('return_to', options.returnTo);
    return new NextRequest(url, {
        method: 'POST',
        headers: {
            origin,
            ...(options.fetchSite ? { 'sec-fetch-site': options.fetchSite } : {}),
            ...(options.accept ? { accept: options.accept } : {}),
        },
    });
}

test('buyer logout rejects sibling-store same-site and same-host scheme-mismatch origins without clearing the cookie', async () => {
    const sibling = await POST(logoutRequest('https://sibling.example.test', { fetchSite: 'same-site' }));
    assert.equal(sibling.status, 403);
    assert.equal(sibling.headers.get('cache-control'), 'no-store');
    assert.equal(sibling.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE), undefined);

    const schemeMismatch = await POST(logoutRequest('http://shop.example.test'));
    assert.equal(schemeMismatch.status, 403);
    assert.equal(schemeMismatch.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE), undefined);
});

test('buyer logout accepts this exact origin and clears only the storefront buyer cookie', async () => {
    const response = await POST(logoutRequest('https://shop.example.test', {
        fetchSite: 'same-origin',
        accept: 'application/json',
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.value, '');
    assert.equal(response.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.maxAge, 0);
});

test('buyer logout keeps a same-origin form return on the current store', async () => {
    const response = await POST(logoutRequest('https://shop.example.test', { returnTo: '//attacker.example' }));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://shop.example.test/');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.maxAge, 0);
});
