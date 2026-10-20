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

test('mobile excludes provider configuration while next public values remain explicit', () => {
  const mobileTemplate = read('config/env/templates/mobile.dart-defines.example');
  const mobileSchema = read('config/env/schemas/mobile.schema.json');
  const nextTemplate = read('config/env/templates/next-app.env.example');
  const nextSchema = read('config/env/schemas/next-app.schema.json');

  for (const key of ['GEMINI_API_KEY', 'GEMINI_BASE_URL', 'GEMINI_MODEL']) {
    assert.doesNotMatch(mobileTemplate, new RegExp(key));
    assert.doesNotMatch(mobileSchema, new RegExp(key));
  }

  for (const key of ['NEXT_PUBLIC_MARKETING_URL', 'NEXT_PUBLIC_THEME_MARKETPLACE_URL', 'STOREFRONT_FRAME_ANCESTORS']) {
    assert.match(nextTemplate, new RegExp(`${key}=`));
    assert.match(nextSchema, new RegExp(`"${key}"`));
  }
});


test('native provider key/export/endpoint mutation controls fail while approved server caps remain mandatory', async () => {
  const { buyerAiConfigurationProblems } = await import('../../scripts/validators/environment-honesty-validator.mjs');
  const base = {
    mobileTemplate: read('config/env/templates/mobile.dart-defines.example'),
    mobileSchema: read('config/env/schemas/mobile.schema.json'),
    coreExports: read('packages/dart/core/lib/letbuyy_core.dart') + read('packages/dart/marketplace_core/lib/letbuyy_marketplace_core.dart'),
    nativeSource: read('packages/dart/marketplace_services/lib/src/ai_chat_service.dart'),
    workerSchema: read('config/env/schemas/worker.schema.json'),
  };
  assert.deepEqual(buyerAiConfigurationProblems(base), []);
  assert.ok(buyerAiConfigurationProblems({ ...base, mobileTemplate: base.mobileTemplate + '\nGEMINI_API_KEY=synthetic-marker' }).some(p => p.includes('GEMINI_API_KEY')));
  assert.ok(buyerAiConfigurationProblems({ ...base, coreExports: base.coreExports + "\nexport 'src/config/gemini_config.dart';" }).some(p => p.includes('export')));
  assert.ok(buyerAiConfigurationProblems({ ...base, nativeSource: base.nativeSource + "\nconst endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/synthetic:generateContent';" }).some(p => p.includes('endpoint')));
  const noProfile = JSON.parse(base.workerSchema); noProfile.allOf = [];
  assert.ok(buyerAiConfigurationProblems({ ...base, workerSchema: JSON.stringify(noProfile) }).some(p => p.includes('server-only')));
  const noCaps = JSON.parse(base.workerSchema); noCaps.$defs.BuyerAiProfile.required = [];
  assert.ok(buyerAiConfigurationProblems({ ...base, workerSchema: JSON.stringify(noCaps) }).some(p => p.includes('bounded server cap')));
});

test('upload delivery configuration guard rejects the legacy CDN, missing production/internal fence and staging defaults', async () => {
  const { uploadDeliveryConfigurationProblems: check } = await import('../../scripts/validators/environment-honesty-validator.mjs');
  const source = read('services/api-gateway/src/routes/upload.ts');
  assert.deepEqual(check(source), []);
  const legacy = source.replace('c.env.UPLOAD_PUBLIC_BASE_URL', 'c.env.ASSET_PUBLIC_BASE_URL');
  assert.notEqual(legacy, source);assert.ok(check(legacy).some(message => message.includes('Scoped')));
  const unfenced = source.replace("if (isProductionEnv(c.env) || requestUrl.hostname.endsWith('.internal')) return null;", '');
  assert.notEqual(unfenced, source);assert.ok(check(unfenced).some(message => message.includes('Production/internal')));
  assert.ok(check(source + '\nconst stagingFallback = "https://cdn-staging.letbuyy.com";').some(message => message.includes('staging CDN')));
});
