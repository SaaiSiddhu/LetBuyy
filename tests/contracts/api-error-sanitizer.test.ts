import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { sanitizePublicErrorPayload } from '../../services/api-gateway/src/lib/public-errors';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const securityMiddlewarePath = join(repoRoot, 'services/api-gateway/src/middleware/security.ts');
const validatorPath = join(repoRoot, 'scripts/validators/raw-error-message-validator.mjs');
const governanceRunnerPath = join(repoRoot, 'scripts/validate-governance.mjs');

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

test('public error sanitizer replaces raw database, auth, and provider messages', () => {
    const db = sanitizePublicErrorPayload({
        success: false,
        error: {
            code: 'DB_ERROR',
            message: 'relation "customers" does not exist',
            details: 'select * from customers',
        },
    });
    assert.equal(db.changed, true);
    assert.deepEqual(db.payload.error, {
        code: 'DB_ERROR',
        message: 'Database operation failed',
    });

    const auth = sanitizePublicErrorPayload({
        error: { code: 'AUTH_ERROR', message: 'invalid_grant: raw upstream auth failure' },
    });
    assert.equal(auth.payload.error?.message, 'Authentication failed');

    const provider = sanitizePublicErrorPayload({
        error: { code: 'PAYMENT_PROVIDER_ERROR', message: 'Razorpay secret key rejected request' },
    });
    assert.equal(provider.payload.error?.message, 'Payment provider request failed');
});

test('public error sanitizer preserves allowlisted client-actionable validation messages', () => {
    const validation = sanitizePublicErrorPayload({
        error: { code: 'VALIDATION', message: 'store_id is required' },
    });

    assert.equal(validation.changed, false);
    assert.equal(validation.payload.error?.message, 'store_id is required');
});

test('error response middleware and governance validator use the public sanitizer', () => {
    const middleware = read(securityMiddlewarePath);
    const validator = read(validatorPath);
    const governanceRunner = read(governanceRunnerPath);

    assert.match(middleware, /sanitizePublicErrorPayload/);
    assert.doesNotMatch(middleware, /const SANITIZED_ERROR_MESSAGES/);
    assert.match(validator, /sanitizePublicErrorPayload/);
    assert.match(validator, /raw error\.message/);
    assert.match(governanceRunner, /raw-error-message-validator\.mjs/);
});
