import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decryptTextAesGcm, encryptTextAesGcm } from '../lib/crypto';
import { generateTotpSecret, otpauthUri, verifyTotpCode } from '../lib/totp';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const twoFactorSource = readFileSync(new URL('../routes/two-factor.ts', import.meta.url), 'utf8');
const bffSource = readFileSync(new URL('../../../mobile-bff/src/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../../../database/supabase/migrations/121_mobile_merchant_2fa_factors.sql', import.meta.url), 'utf8');

test('merchant 2FA route is mounted and mobile allowlisted', () => {
    assert.match(indexSource, /import twoFactorRouter from '\.\/routes\/two-factor'/);
    assert.match(indexSource, /api\.route\('\/2fa', twoFactorRouter\)/);
    assert.match(bffSource, /'\/v1\/2fa'/);
});

test('2FA route stores encrypted TOTP factors without platform-blocked leaks', () => {
    assert.match(twoFactorSource, /router\.get\('\/'/);
    assert.match(twoFactorSource, /router\.get\('\/sessions'/);
    assert.match(twoFactorSource, /router\.post\('\/totp\/enroll'/);
    assert.match(twoFactorSource, /router\.post\('\/totp\/verify'/);
    assert.match(twoFactorSource, /router\.post\('\/disable'/);
    assert.match(twoFactorSource, /requireCustomUser\(c\)/);
    assert.match(twoFactorSource, /\.from\('merchant_2fa_factors'\)[\s\S]*\.insert/);
    assert.match(twoFactorSource, /\.from\('merchant_2fa_factors'\)[\s\S]*\.update/);
    assert.match(twoFactorSource, /encryptTextAesGcm/);
    assert.match(twoFactorSource, /decryptTextAesGcm/);
    assert.doesNotMatch(twoFactorSource, /S-023|backend contract|SKIP-NEEDS-BACKEND/);
});

test('2FA migration declares owner RLS and approved updated_at trigger', () => {
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.merchant_2fa_factors/);
    assert.match(migrationSource, /custom_user_id uuid NOT NULL REFERENCES public\.users_custom\(id\)/);
    assert.match(migrationSource, /ALTER TABLE public\.merchant_2fa_factors ENABLE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /CREATE POLICY merchant_2fa_factors_service_all ON public\.merchant_2fa_factors[\s\S]*FOR ALL TO service_role/);
    assert.match(migrationSource, /CREATE POLICY merchant_2fa_factors_owner_all ON public\.merchant_2fa_factors[\s\S]*FOR ALL TO authenticated/);
    assert.match(migrationSource, /update_merchant_2fa_factors_updated_at[\s\S]*EXECUTE FUNCTION public\.update_updated_at\(\)/);
});

test('TOTP helpers generate app-compatible setup URIs and verify RFC-compatible codes', async () => {
    const secret = generateTotpSecret();
    assert.match(secret, /^[A-Z2-7]+$/);
    assert.match(otpauthUri({
        issuer: 'LetBuyy',
        label: 'merchant@example.com',
        accountName: 'merchant@example.com',
        secret,
    }), /^otpauth:\/\/totp\/LetBuyy%3Amerchant%40example\.com\?/);

    assert.equal(await verifyTotpCode({
        secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
        code: '287082',
        nowMs: 59_000,
        window: 0,
    }), true);
    assert.equal(await verifyTotpCode({
        secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
        code: '000000',
        nowMs: 59_000,
        window: 0,
    }), false);
});

test('TOTP secrets are encrypted before persistence', async () => {
    const token = await encryptTextAesGcm('test-encryption-secret', 'JBSWY3DPEHPK3PXP');
    assert.notEqual(token, 'JBSWY3DPEHPK3PXP');
    assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(await decryptTextAesGcm('test-encryption-secret', token), 'JBSWY3DPEHPK3PXP');
});
