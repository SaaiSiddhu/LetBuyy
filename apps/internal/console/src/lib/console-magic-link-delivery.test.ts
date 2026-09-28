// Phase 2 / D04.8 independent preparation (Mandate 6, Section 10) -- capture-transport tests for
// the console magic-link delivery boundary. No network call in this file; no external message is
// ever sent by any test here.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CaptureConsoleMagicLinkDeliveryAdapter,
    AlwaysFailingConsoleMagicLinkDeliveryAdapter,
    attemptConsoleMagicLinkDelivery,
    getConfiguredConsoleMagicLinkDeliveryAdapter,
} from './console-magic-link-delivery';

test('the production wiring point returns null until D04.8 is answered -- not a default/fallback adapter', () => {
    assert.equal(getConfiguredConsoleMagicLinkDeliveryAdapter(), null);
});

test('fail-closed: no adapter configured means the attempt is reported undelivered, never silently treated as sent', async () => {
    const result = await attemptConsoleMagicLinkDelivery(null, { email: 'operator@example.test', magicLinkUrl: 'https://console.example/api/console-auth/callback?token=abc' });
    assert.equal(result.delivered, false);
    assert.equal(result.reason, 'delivery_not_configured');
});

test('capture adapter: records what would have been sent, sends nothing over any network', async () => {
    const adapter = new CaptureConsoleMagicLinkDeliveryAdapter();
    const result = await attemptConsoleMagicLinkDelivery(adapter, { email: 'operator@example.test', magicLinkUrl: 'https://console.example/callback?token=xyz' });
    assert.equal(result.delivered, true);
    assert.equal(adapter.captured.length, 1);
    assert.equal(adapter.captured[0].email, 'operator@example.test');
});

test('delivery failure (a real provider error) is reported as undelivered, not thrown or silently ignored', async () => {
    const adapter = new AlwaysFailingConsoleMagicLinkDeliveryAdapter('provider quota exceeded');
    const result = await attemptConsoleMagicLinkDelivery(adapter, { email: 'operator@example.test', magicLinkUrl: 'https://console.example/callback?token=xyz' });
    assert.equal(result.delivered, false);
    assert.equal(result.reason, 'delivery_failed');
});

test('a delivery attempt result never carries the magic-link token/URL itself in any loggable field', async () => {
    const adapter = new CaptureConsoleMagicLinkDeliveryAdapter();
    const result = await adapter.send({ email: 'operator@example.test', magicLinkUrl: 'https://console.example/callback?token=super-secret-token-value' });
    const serializedResult = JSON.stringify(result);
    assert.doesNotMatch(serializedResult, /super-secret-token-value/, 'the RESULT object (the thing a caller would plausibly log) must never itself carry the token');
    assert.ok(result.attemptId, 'a caller can still correlate this attempt via attemptId alone');
});

test('multiple sends each get a distinct attemptId, so a log correlating by attemptId cannot conflate two attempts', async () => {
    const adapter = new CaptureConsoleMagicLinkDeliveryAdapter();
    const first = await adapter.send({ email: 'a@example.test', magicLinkUrl: 'https://console.example/callback?token=t1' });
    const second = await adapter.send({ email: 'b@example.test', magicLinkUrl: 'https://console.example/callback?token=t2' });
    assert.notEqual(first.attemptId, second.attemptId);
});
