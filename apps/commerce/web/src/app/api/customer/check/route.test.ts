import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from './route';

test('public legacy customer lookup is retired without exposing account existence', async () => {
    const response = await GET();
    const body = await response.json();

    assert.equal(response.status, 410);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(body, {
        error: 'Account lookup is unavailable. Continue with LetBuyy or choose existing store-account sign-in.',
    });
    assert.equal('exists' in body, false);
    assert.equal('hasPassword' in body, false);
});
