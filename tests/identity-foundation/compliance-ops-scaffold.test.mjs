import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('identity OTP adapter is mock-first and maps live channels to HR rows', () => {
  const source = read('packages/infrastructure/identity-otp-adapter/index.ts');
  assert.match(source, /createMockIdentityOtpAdapter/);
  assert.match(source, /orderedIdentityOtpChannels/);
  assert.match(source, /HR-WHATSAPP-LIVE/);
  assert.match(source, /HR-ESP-LIVE/);
  assert.match(source, /HR-DLT-TRAI-LIVE/);
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
