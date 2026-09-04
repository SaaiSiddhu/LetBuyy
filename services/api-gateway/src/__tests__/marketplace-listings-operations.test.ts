// ADM-1 — operator moderation routes for marketplace listings, and the client-actionable error registry.
// Behavioural where it can be: the operator router is driven through a real Hono app with injected
// fakes for the query, the transition call, the audit write and the actor, so what is asserted is the
// wire contract (named RPC parameters, the literal 'operator' realm, the reason rule, the audit row),
// not the source text. Source-shape assertions cover only mounting and the "never inside a tenant
// transaction" invariant, which no unit can exercise.

import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizePublicErrorPayload, CLIENT_ACTIONABLE_ERROR_CODES } from '../lib/public-errors';

// ── F-FB-1 (from MKT-1's lanes): the sanitizer must preserve the messages behind the listing codes ──

test('the channel-listing error codes are client-actionable, so their fixed messages survive the sanitizer', () => {
    for (const [code, message] of [
        ['UNPROCESSABLE', 'a marketplace category is required before review'],
        ['TENANT_TX_UNAVAILABLE', 'Tenant transaction unavailable'],
        ['TENANT_CONTEXT_MISSING', 'tenant context was not established'],
    ] as const) {
        assert.ok(CLIENT_ACTIONABLE_ERROR_CODES.has(code), `${code} must be registered as client-actionable`);
        const { payload, changed } = sanitizePublicErrorPayload({ error: { code, message } });
        assert.equal(payload.error?.message, message, `${code}'s message must reach the client verbatim`);
        assert.equal(payload.error?.code, code);
        assert.equal(changed, false);
    }
});

test('an unregistered code is still rewritten to the generic message, so the registry is the only door', () => {
    const { payload, changed } = sanitizePublicErrorPayload({ error: { code: 'SOME_NEW_CODE', message: 'relation "public.channel_listings" does not exist' } });
    assert.equal(changed, true);
    assert.equal(payload.error?.message, 'Request failed');
    assert.equal(payload.error?.code, 'SOME_NEW_CODE', 'the code survives; only the message is replaced');
});
