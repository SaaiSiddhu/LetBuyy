import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authRouteSource = readFileSync(new URL('../routes/auth.ts', import.meta.url), 'utf8');
const dartClientSource = readFileSync(new URL('../../../../packages/dart/api_client/lib/src/api_client.dart', import.meta.url), 'utf8');
const mobileAuthSource = readFileSync(new URL('../../../../apps/mobile/merchant-app/lib/services/store_auth_service.dart', import.meta.url), 'utf8');
const authWrapperSource = readFileSync(new URL('../../../../apps/mobile/merchant-app/lib/app/auth_wrapper.dart', import.meta.url), 'utf8');

test('custom auth session validation returns expiry metadata for mobile refresh UX', () => {
    assert.match(authRouteSource, /expires_at:\s*localSession\.expires_at/);
    assert.match(authRouteSource, /expires_at:\s*session\.expires_at/);
    assert.match(dartClientSource, /ApiUnauthorizedHandler\? unauthorizedHandler/);
    assert.match(dartClientSource, /_shouldRetryAfterUnauthorized/);
    assert.match(mobileAuthSource, /AuthChangeEvent\.sessionExpired/);
    assert.match(mobileAuthSource, /sessionExpiresAt/);
    assert.match(mobileAuthSource, /handleUnauthorized\(ApiException exception\)/);
    assert.match(authWrapperSource, /Your session expired\. Please sign in again\./);
});
