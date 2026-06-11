import assert from 'node:assert/strict';
import test from 'node:test';
import {
    signSensitiveActionStepUp,
    verifySensitiveActionStepUp,
} from '../lib/security-controls';

const signingSecret = '0123456789abcdef0123456789abcdef';
const actorId = '11111111-1111-4111-8111-111111111111';
const siteId = '22222222-2222-4222-8222-222222222222';
const challengeId = '33333333-3333-4333-8333-333333333333';
const verifiedAt = '2026-06-11T10:00:00.000Z';
const nowMs = Date.parse(verifiedAt);

test('signed step-up proof verifies only for its bound action actor and site', async () => {
    const signed = await signSensitiveActionStepUp({
        action: 'refund.approve',
        actorId,
        siteId,
        challengeId,
        signingSecret,
        verifiedAt,
        nowMs,
    });

    const accepted = await verifySensitiveActionStepUp({
        action: 'refund.approve',
        actorId,
        siteId,
        token: signed.token,
        verifiedAt: signed.verifiedAt,
        signingSecret,
        nowMs,
    });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.metadata.step_up_crypto, 'hmac-sha256');
    assert.equal(accepted.metadata.challenge_id, challengeId);

    const wrongAction = await verifySensitiveActionStepUp({
        action: 'payout.release',
        actorId,
        siteId,
        token: signed.token,
        verifiedAt: signed.verifiedAt,
        signingSecret,
        nowMs,
    });
    assert.equal(wrongAction.ok, false);
    assert.equal(wrongAction.code, 'STEP_UP_INVALID');
});

test('signed step-up proof fails closed without a real secret or after expiry', async () => {
    const signed = await signSensitiveActionStepUp({
        action: 'payout.release',
        actorId,
        siteId,
        challengeId,
        signingSecret,
        verifiedAt,
        nowMs,
    });

    const missingSecret = await verifySensitiveActionStepUp({
        action: 'payout.release',
        actorId,
        siteId,
        token: signed.token,
        verifiedAt: signed.verifiedAt,
        signingSecret: 'replace-with-worker-secret',
        nowMs,
    });
    assert.equal(missingSecret.ok, false);
    assert.equal(missingSecret.code, 'STEP_UP_REQUIRED');

    const expired = await verifySensitiveActionStepUp({
        action: 'payout.release',
        actorId,
        siteId,
        token: signed.token,
        verifiedAt: signed.verifiedAt,
        signingSecret,
        nowMs: nowMs + (11 * 60 * 1000),
    });
    assert.equal(expired.ok, false);
    assert.equal(expired.code, 'STEP_UP_EXPIRED');
});
