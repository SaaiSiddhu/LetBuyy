import assert from 'node:assert/strict';
import type { Page } from '@playwright/test';

/** Observe the real storefront redirect; never inject an authorization URL or cookie. */
export async function expectBuyerHandoff(page: Page, identityOrigin: string, storeOrigin: string): Promise<void> {
    await page.waitForURL(url => url.origin === identityOrigin && url.pathname === '/buyer/authorize');
    const authorization = new URL(page.url());
    assert.equal(authorization.searchParams.get('response_type'), 'code');
    assert.equal(authorization.searchParams.get('client_id'), 'letbuyy-storefront');
    assert.equal(authorization.searchParams.get('redirect_uri'), storeOrigin + '/api/buyer-auth/callback');
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    assert.match(authorization.searchParams.get('code_challenge') || '', /^[A-Za-z0-9_-]{43}$/);
    assert.match(authorization.searchParams.get('state') || '', /^[A-Za-z0-9_-]{43}$/);
}
