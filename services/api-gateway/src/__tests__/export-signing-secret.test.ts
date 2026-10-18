import assert from 'node:assert/strict';
import test from 'node:test';
import { requireExportSigningSecret } from '../lib/export-signing-secret';

test('export download signing requires its dedicated internal secret', () => {
    assert.equal(requireExportSigningSecret('dedicated-export-secret'), 'dedicated-export-secret');
    assert.throws(() => requireExportSigningSecret(undefined), /INTERNAL_API_SECRET/);
    assert.throws(() => requireExportSigningSecret(''), /INTERNAL_API_SECRET/);
});

test('customer session credentials cannot be substituted for export signing credentials', () => {
    // The API receives only the dedicated export secret; there is no customer-session fallback.
    assert.throws(() => requireExportSigningSecret(undefined), /INTERNAL_API_SECRET/);
});
