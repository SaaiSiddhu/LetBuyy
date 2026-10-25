const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const sources = [
  'packages/commerce-core/src/product-facts-summary.ts',
  'packages/commerce-core/test/product-facts-summary.test.ts',
  'services/api-gateway/src/lib/buyer-order-item-view.ts',
  'services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts',
  'services/api-gateway/src/__tests__/buyer-order-item-view.test.ts',
  'apps/commerce/web/src/app/api/buyer/orders/route.ts',
  'apps/commerce/web/src/app/api/buyer/orders/order-facts.test.ts',
  'apps/commerce/web/src/lib/order-fact-readback.ts',
  'apps/commerce/web/src/lib/order-fact-readback.test.ts',
  'apps/commerce/web/src/lib/order-facts.test-support.ts',
  'apps/commerce/web/src/lib/customer-drop.ts',
  'apps/commerce/web/src/lib/customer-order-facts.test.ts',
  'apps/commerce/web/src/app/store/[subdomain]/account/orders/[id]/order-detail-client.tsx',
  'apps/commerce/web/src/components/storefront/account-orders-identity.test.tsx',
  'apps/commerce/web/src/components/storefront/niche-order-facts.tsx',
  'apps/commerce/web/src/components/storefront/niche-order-facts.test.tsx',
  'apps/merchant/web/src/app/[store]/orders/[orderId]/page.tsx',
  'apps/merchant/web/src/components/orders/order-line-items.ts',
  'apps/merchant/web/src/components/orders/order-line-items.test.tsx',
  'apps/merchant/web/src/components/orders/niche-order-facts.tsx',
  'apps/merchant/web/src/components/orders/niche-order-facts.test.tsx',
  'packages/theme-engine/src/niche-order-presentation.ts',
  'packages/theme-engine/test/niche-order-presentation.test.ts',
];
const dependencies = [
  'packages/commerce-core/src/index.ts', 'packages/commerce-core/src/product-fact-snapshot.ts',
  'packages/checkout-core/src/index.ts', 'packages/theme-engine/src/first-party-theme-catalog.ts',
  'apps/commerce/web/src/lib/buyer-order-drop.ts', 'packages/typescript/api-client/src/index.ts',
];
const hash = file => ({ path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') });
const before = sources.map(hash);
const serverEnv = { TSX_TSCONFIG_PATH: 'apps/commerce/web/tsconfig.json' };
const commands = [
  ['readback-gateway-and-reader', ['--import', 'tsx', '--test', 'services/api-gateway/src/__tests__/buyer-order-routes.test.ts', 'services/api-gateway/src/__tests__/buyer-order-item-view.test.ts', 'apps/commerce/web/src/lib/order-fact-readback.test.ts']],
  ['readback-server', ['--conditions=react-server', '--import', 'tsx', '--test', 'apps/commerce/web/src/lib/customer-order-facts.test.ts', 'apps/commerce/web/src/lib/customer-order-money.test.ts', 'apps/commerce/web/src/app/api/buyer/orders/order-facts.test.ts'], '.', serverEnv],
  ['readback-existing-buyer-proxy', ['--conditions=react-server', '--import', 'tsx', '--test', 'apps/commerce/web/src/app/api/buyer/buyer-proxy-routes.test.ts'], '.', serverEnv],
  ['readback-buyer-mounted', ['--import', 'tsx', '--test', 'apps/commerce/web/src/components/storefront/account-orders-identity.test.tsx'], '.', serverEnv],
  ['readback-merchant-mounted-sdk', ['--import', 'tsx', '--test', 'apps/merchant/web/src/components/orders/order-line-items.test.tsx'], '.', { TSX_TSCONFIG_PATH: 'apps/merchant/web/tsconfig.json' }],
  ['readback-summary-and-wrappers', ['--import', 'tsx', '--test', 'packages/commerce-core/test/product-facts-summary.test.ts', 'apps/commerce/web/src/components/storefront/niche-order-facts.test.tsx', 'apps/merchant/web/src/components/orders/niche-order-facts.test.tsx']],
  ['readback-catalog-cohort', ['--import', 'tsx', '--test', 'packages/theme-engine/test/niche-order-presentation.test.ts', 'packages/theme-engine/test/first-party-design-version.test.ts', 'packages/theme-engine/test/niche-catalog-dispatch.test.ts']],
  ['readback-commerce-typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'docs/implementation/niche-themes-2026-10-23/dewdrop/tsconfig.order-readback-commerce.json']],
  ['readback-merchant-typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'docs/implementation/niche-themes-2026-10-23/dewdrop/tsconfig.order-readback-merchant.json']],
  ['readback-core-typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', '--tsBuildInfoFile', '/private/tmp/dewdrop-readback-core.tsbuildinfo', '-p', 'packages/commerce-core/tsconfig.json']],
  ['readback-gateway-typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', '--tsBuildInfoFile', '/private/tmp/dewdrop-readback-gateway.tsbuildinfo', '-p', 'services/api-gateway/tsconfig.json']],
  ['readback-engine-typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', '--tsBuildInfoFile', '/private/tmp/dewdrop-readback-engine.tsbuildinfo', '-p', 'packages/theme-engine/tsconfig.json']],
  ['readback-commerce-lint', ['node_modules/eslint/bin/eslint.js', 'src/app/api/buyer/orders/route.ts', 'src/app/api/buyer/orders/order-facts.test.ts', 'src/lib/order-fact-readback.ts', 'src/lib/order-fact-readback.test.ts', 'src/lib/order-facts.test-support.ts', 'src/lib/customer-drop.ts', 'src/lib/customer-order-facts.test.ts', 'src/app/store/[subdomain]/account/orders/[id]/order-detail-client.tsx', 'src/components/storefront/account-orders-identity.test.tsx', 'src/components/storefront/niche-order-facts.tsx', 'src/components/storefront/niche-order-facts.test.tsx'], 'apps/commerce/web'],
  ['readback-merchant-lint', ['node_modules/eslint/bin/eslint.js', 'src/app/[store]/orders/[orderId]/page.tsx', 'src/components/orders/order-line-items.ts', 'src/components/orders/order-line-items.test.tsx', 'src/components/orders/niche-order-facts.tsx', 'src/components/orders/niche-order-facts.test.tsx'], 'apps/merchant/web'],
];
const checks = commands.map(([name, args, cwd = '.', env = {}]) => {
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, args, { cwd: path.join(root, cwd), encoding: 'utf8', env: { ...process.env, ...env } });
  const output = (result.stdout || '') + (result.stderr || '');
  fs.writeFileSync(path.join(__dirname, `${name}.log`), output);
  const check = { name, command: ['node', ...args], cwd, env, startedAt, exitCode: result.status, success: result.status === 0, log: `${name}.log`, summary: output.match(/# (tests|pass|fail|skipped) \d+/g) || [] };
  console.log(JSON.stringify({ name, exitCode: check.exitCode, summary: check.summary }));
  return check;
});
const after = sources.map(hash);
const sourcesStableDuringVerification = JSON.stringify(before) === JSON.stringify(after);
const report = {
  generatedAt: new Date().toISOString(), scope: 'Authorized historical order readback source, pure presentation and actual in-process handlers/UI/Liquid only.',
  checks, sources: after, dependencies: dependencies.map(hash), sourcesStableDuringVerification,
  complete: checks.every(check => check.success) && sourcesStableDuringVerification,
  priorDewdropQualification: 'verification.json (34 tests, retained separately)',
  priorOrderFactsSupportQualification: 'order-facts-verification.json (16 tests, retained separately; formatter/wrapper cohort now rerun with saved-options regression)',
  limitations: ['No database, RLS, production-worker, browser or purchase-flow acceptance in this allocation.', 'Product mutation/deletion is simulated in fixtures.', 'Existing merchant Banner unused-import warning remains; no lint errors.', 'Root owns builder hashes, immutable release freeze and promotion.'],
  resourcesUsed: { database: false, browser: false, server: false, fullBuild: false, migration: false },
};
fs.writeFileSync(path.join(__dirname, 'order-readback-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ complete: report.complete, sourcesStableDuringVerification }));
if (!report.complete) process.exitCode = 1;
