import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('environment honesty validator passes and is wired into governance', () => {
  const result = spawnSync(process.execPath, ['scripts/validators/environment-honesty-validator.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(read('scripts/validate-governance.mjs'), /environment-honesty-validator\.mjs/);
});

test('active runtime source has no staging LetBuyy URL defaults', () => {
  for (const file of [
    'apps/platform/identity/src/lib/api/client.ts',
    'apps/platform/identity/src/lib/email/resend.ts',
    'apps/platform/identity/src/lib/auth/cookies.ts',
    'apps/merchant/web/src/lib/public-urls.ts',
    'apps/marketing/web/src/lib/public-urls.ts',
    'apps/frozen/operations-portal/src/lib/api/client.ts',
    'apps/commerce/web/src/app/storefront-landing.tsx',
    'apps/commerce/web/src/lib/seo.ts',
    'services/api-gateway/src/lib/cors.ts',
    'services/api-gateway/src/routes/upload.ts',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /staging\.letbuyy\.store|cdn-staging\.letbuyy\.store/);
  }
});

test('mobile and next environment contracts name newly consumed public values', () => {
  const mobileTemplate = read('config/env/templates/mobile.dart-defines.example');
  const mobileSchema = read('config/env/schemas/mobile.schema.json');
  const nextTemplate = read('config/env/templates/next-app.env.example');
  const nextSchema = read('config/env/schemas/next-app.schema.json');

  for (const key of ['GEMINI_API_KEY', 'GEMINI_BASE_URL', 'GEMINI_MODEL']) {
    assert.match(mobileTemplate, new RegExp(`${key}=`));
    assert.match(mobileSchema, new RegExp(`"${key}"`));
  }

  for (const key of ['NEXT_PUBLIC_MARKETING_URL', 'NEXT_PUBLIC_THEME_MARKETPLACE_URL', 'STOREFRONT_FRAME_ANCESTORS']) {
    assert.match(nextTemplate, new RegExp(`${key}=`));
    assert.match(nextSchema, new RegExp(`"${key}"`));
  }
});
