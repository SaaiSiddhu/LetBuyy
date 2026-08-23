import assert from 'node:assert/strict';
import test from 'node:test';

import { generateImpersonationToken } from '../routes/internal-console';
import { sha256Hex } from '../lib/crypto';

// Phase S1 W1 (SEC-R7): the impersonation token used to be an AUTH_SECRET-signed
// HMAC even though the signature was never verified anywhere in this codebase --
// the only real authenticity control is token_hash. Replaced with a CSPRNG-
// generated opaque credential; these tests pin the two properties that made
// the old design safe (a matching hash, non-repeating tokens) so a future
// change can't quietly regress either one.

test('S1 impersonation token: successive calls produce different tokens', async () => {
    const first = await generateImpersonationToken();
    const second = await generateImpersonationToken();

    assert.notEqual(first.token, second.token, 'two generated tokens must not collide');
    assert.notEqual(first.token_hash, second.token_hash, 'two generated token hashes must not collide');
});

test('S1 impersonation token: token_hash is the sha256 of token', async () => {
    const { token, token_hash } = await generateImpersonationToken();

    assert.equal(token_hash, await sha256Hex(token), 'token_hash must equal sha256Hex(token)');
});

test('S1 impersonation token: carries the lb_imp_ prefix and at least 256 bits of hex entropy', async () => {
    const { token } = await generateImpersonationToken();

    assert.match(token, /^lb_imp_[a-f0-9]{64}$/, 'token must be lb_imp_ followed by 64 hex chars (32 bytes / 256 bits)');
});

test('S1 impersonation token: does not embed session material (opaque credential only)', async () => {
    const { token } = await generateImpersonationToken();

    // The old token embedded "sessionId.siteId.operatorId.expiryMs.signature" --
    // a bare hex string after the prefix has no "." separators to parse.
    assert.doesNotMatch(token, /\./, 'token must not contain embedded/parseable session material');
});
