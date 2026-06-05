import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { redactReplayableSecrets } from '../../services/api-gateway/src/lib/replayable-secret-redaction';

const testDir = dirname(fileURLToPath(import.meta.url));
const adapterSource = readFileSync(
    join(testDir, '../../services/api-gateway/src/execution/idempotency-execution.adapter.ts'),
    'utf8',
);

test('idempotency replay persistence redacts app OAuth tokens and signing secrets', () => {
    const persisted = redactReplayableSecrets({
        success: true,
        data: {
            oauth: {
                access_token: 'app-access-token',
                token_type: 'Bearer',
            },
            webhooks: {
                signing_secret: 'show-once-webhook-secret',
                subscriptions: [
                    { id: 'sub_1', signingSecret: 'camel-secret' },
                ],
            },
        },
    });

    const serialized = JSON.stringify(persisted);
    assert.equal(serialized.includes('app-access-token'), false);
    assert.equal(serialized.includes('show-once-webhook-secret'), false);
    assert.equal(serialized.includes('camel-secret'), false);
    assert.match(serialized, /REDACTED_REPLAY_SECRET/);
});

test('idempotency adapter persists the redacted response body, not the original response body', () => {
    assert.match(adapterSource, /const persistedResponseBody = redactReplayableSecrets\(params\.responseBody\)/);
    assert.match(adapterSource, /response_body:\s*persistedResponseBody/);
    assert.doesNotMatch(adapterSource, /response_body:\s*params\.responseBody/);
});
