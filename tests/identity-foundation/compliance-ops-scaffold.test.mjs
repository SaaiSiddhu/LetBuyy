import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('identity OTP mock adapter stays retired and live channels remain human-gated', () => {
  assert.equal(existsSync('packages/infrastructure/identity-otp-adapter/index.ts'), false);
  assert.doesNotMatch(read('packages/infrastructure/src/index.ts'), /identity-otp-adapter/);
  assert.doesNotMatch(read('packages/infrastructure/package.json'), /identity-otp-adapter/);
  assert.match(read('services/api-gateway/src/routes/email.ts'), /HR-ESP-LIVE/);
  const skipped = read('SKIPPED_HUMAN_DECISIONS.md');
  assert.match(skipped, /SKIP-D3-IDENTITY-LIVE-PROVIDERS/);
  assert.match(skipped, /SKIP-D10-WHATSAPP-BSP-WABA-HSM/);
  assert.match(skipped, /SKIP-W7-WHATSAPP-LIVE-CREDS/);
});

test('identity residency config pins ap-south-1 and requires live certification', () => {
  const config = JSON.parse(read('config/runtime/identity/residency.json'));
  assert.equal(config.identityDataResidency.requiredRegion, 'ap-south-1');
  assert.equal(config.identityDataResidency.providerEvidence, 'HR-RESIDENCY-DPDP');
  assert.equal(config.identityDataResidency.liveCertificationRequired, true);
  assert.equal(config.mockAllowed.production, false);
});

test('SOC2 control map references dormant identity foundation evidence without live claims', () => {
  const source = read('docs/auth/2026-06-08-identity-platform-transformation/SOC2_CONTROL_MAP.md');
  assert.match(source, /foundation scaffolding only/i);
  assert.match(source, /HR-HYDRA-LIVE/);
  assert.match(source, /HR-KMS-LIVE/);
  assert.match(source, /FEATURE_AUDIT_DUAL_WRITE/);
});
