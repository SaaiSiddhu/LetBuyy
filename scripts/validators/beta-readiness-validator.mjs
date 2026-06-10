#!/usr/bin/env node
import {
  createReporter,
  exists,
  readFile,
  rejectedPackageRoots,
} from './governance-common.mjs';

const reporter = createReporter('Beta readiness validator');

function assertIncludes(file, fragment, message) {
  reporter.assert(readFile(file).includes(fragment), message || `${file} must include ${fragment}`);
}

function assertNotIncludes(file, fragment, message) {
  reporter.assert(!readFile(file).includes(fragment), message || `${file} must not include ${fragment}`);
}

const skippedHumanDecisions = readFile('SKIPPED_HUMAN_DECISIONS.md');
const capabilityBacklog = readFile('CAPABILITY_BACKLOG.md');

function assertRecordedCapabilityGap(gapId, skipId, message) {
  reporter.assert(capabilityBacklog.includes(gapId), `${message}: CAPABILITY_BACKLOG.md missing ${gapId}`);
  reporter.assert(skippedHumanDecisions.includes(skipId), `${message}: SKIPPED_HUMAN_DECISIONS.md missing ${skipId}`);
}

const mobileBff = readFile('services/mobile-bff/src/index.ts');
for (const fragment of [
  'TURNSTILE_SECRET_KEY?: string',
  'verifyMobileTurnstileToken',
  "TURNSTILE_NOT_CONFIGURED",
  "TURNSTILE_PROVIDER_UNAVAILABLE",
  "app.post('/v1/auth/mobile/turnstile/verify'",
]) {
  reporter.assert(mobileBff.includes(fragment), `mobile BFF Turnstile verifier missing: ${fragment}`);
}

const mobileBffTest = readFile('services/mobile-bff/test/session-token.test.ts');
for (const fragment of [
  'mobile Turnstile verification fails closed without a configured secret',
  'mobile Turnstile verification uses Cloudflare siteverify response',
]) {
  reporter.assert(mobileBffTest.includes(fragment), `mobile BFF test missing: ${fragment}`);
}

const mobileAuthService = readFile('apps/mobile/merchant-app/lib/services/store_auth_service.dart');
for (const fragment of [
  'mobileBffBaseUrl',
  '_verifyTurnstileWithBff(token)',
  '/auth/mobile/turnstile/verify',
]) {
  reporter.assert(mobileAuthService.includes(fragment), `merchant mobile Turnstile BFF flow missing: ${fragment}`);
}
if (
  mobileAuthService.includes('_verifyTurnstileWithBff(token)') &&
  mobileAuthService.includes("'turnstileToken': await _requireTurnstileToken(turnstileToken)")
) {
  assertRecordedCapabilityGap(
    'CAP-C09',
    'SKIP-CAP-MOBILE-TURNSTILE-DOUBLE-SPEND',
    'Mobile Turnstile double-spend residue must remain recorded while BFF preverify and identity login consume the same token',
  );
}
assertIncludes(
  'apps/mobile/merchant-app/lib/main.dart',
  'mobileBffBaseUrl: AppConfig.bffBaseUrl',
  'merchant mobile app must inject the mobile BFF base URL into auth service',
);
assertIncludes(
  'apps/mobile/merchant-app/test/mobile_services_test.dart',
  'verifies Turnstile with the mobile BFF before password login',
  'merchant mobile tests must prove BFF Turnstile verification before login',
);

for (const file of [
  'config/env/templates/worker.env.example',
  'config/env/schemas/worker.schema.json',
  'services/mobile-bff/wrangler.toml',
]) {
  assertIncludes(file, 'TURNSTILE_SECRET_KEY', `${file} must declare mobile Turnstile secret ownership`);
}

const checkoutRoute = readFile('services/api-gateway/src/routes/checkout.ts');
for (const fragment of [
  'new OrderExecutionAdapter(db).createOrder(orderPlan.command, tenant)',
  'new PaymentExecutionAdapter(db).confirmPayment({',
  'CHECKOUT_PROVIDER_PAYMENT_REQUIRED',
  'capture_posted_to_ledger: orderPlan.provider !== \'cod\'',
  'buildHostedCheckoutOrderCommand',
]) {
  reporter.assert(checkoutRoute.includes(fragment), `hosted checkout confirm missing: ${fragment}`);
}
const checkoutPaymentRoute = readFile('services/api-gateway/src/routes/storefront/checkout-payment-routes.ts');
const checkoutExtensionHost = readFile('apps/storefront-runtime/src/components/checkout-extensions/CheckoutExtensionHost.tsx');
if (
  checkoutPaymentRoute.includes('evaluateCheckoutAppFunctions') ||
  checkoutExtensionHost.includes('CheckoutExtensionHost')
) {
  assertRecordedCapabilityGap(
    'CAP-C13',
    'SKIP-CAP-CHECKOUT-WASM-RETIREMENT',
    'Residual checkout app-functions/Wasm live path must remain recorded until ARB/product scoping and deletion are complete',
  );
}
assertIncludes(
  'services/api-gateway/src/__tests__/checkout.test.ts',
  'Wave 7 checkout confirm creates server order and posts provider capture to ledger',
  'checkout tests must prove server order creation and capture posting',
);

const orderRisk = readFile('services/api-gateway/src/routes/order-risk.ts');
for (const fragment of [
  "provider: 'letbuyy_sandbox'",
  "mode: 'sandbox'",
  'HR-WHATSAPP-LIVE',
  'cod.confirmation_requested',
]) {
  reporter.assert(orderRisk.includes(fragment), `COD/WhatsApp sandbox gating missing: ${fragment}`);
}
reporter.assert(!orderRisk.includes('mock_whatsapp'), 'COD confirmation must not persist mock_whatsapp provider labels');
reporter.assert(!orderRisk.includes("mode: 'mock'"), 'COD confirmation must not emit mock mode runtime payloads');
assertIncludes(
  'services/api-gateway/src/__tests__/orders-v1.test.ts',
  'sandbox WhatsApp gated',
  'orders tests must describe sandbox WhatsApp gating, not mock gating',
);

const oidcDisabled = readFile('apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts');
reporter.assert(oidcDisabled.includes('implemented: false'), 'OIDC scaffold must remain honest-disabled');
reporter.assert(oidcDisabled.includes('status: 501'), 'OIDC scaffold must return an honest 501');
reporter.assert(!oidcDisabled.includes('mock: true'), 'OIDC scaffold must not emit mock:true runtime payloads');

const reservedDeployRoots = [
  'services/checkout-runtime',
  'services/notification-service',
  'services/search-service',
  'services/media-service',
  'services/analytics-pipeline',
  'services/event-bus',
  'apps/mobile/operator-app',
  'apps/mobile/shopper-app',
];
const deployFiles = [
  '.github/workflows/deploy-staging.yml',
  '.github/workflows/staging-deploy.yml',
  '.github/workflows/production-deploy.yml',
  '.github/workflows/staging-runtime-deployment.yml',
  'scripts/cloudflare/update-wrangler-ids.mjs',
  'infrastructure/deployment/release-promotion.yaml',
  'infrastructure/scripts/deploy/production-deploy.mjs',
];
for (const file of deployFiles) {
  const source = readFile(file);
  for (const root of reservedDeployRoots) {
    reporter.assert(!source.includes(`working-directory: ${root}`), `${file} must not deploy reserved root ${root}`);
    reporter.assert(!source.includes(`--dir ${root}`), `${file} must not deploy reserved root ${root}`);
    reporter.assert(!source.includes(`--dir", "${root}"`), `${file} must not deploy reserved root ${root}`);
    reporter.assert(!source.includes(`--config ${root}/wrangler.toml`), `${file} must not deploy reserved root ${root}`);
    reporter.assert(!source.includes(`"${root}"`), `${file} must not enumerate reserved root ${root} as an active deploy target`);
  }
}
for (const file of [
  '.github/workflows/deploy-staging.yml',
  '.github/workflows/staging-deploy.yml',
  '.github/workflows/production-deploy.yml',
  'scripts/cloudflare/update-wrangler-ids.mjs',
]) {
  assertIncludes(file, 'services/mobile-bff', `${file} must include the active mobile BFF worker in active worker handling`);
}

const survivingRejectedRoots = rejectedPackageRoots.filter((root) => exists(root));
reporter.assert(
  survivingRejectedRoots.length === 0,
  `Phase D11 rejected architecture packages must be deleted after live migration: ${survivingRejectedRoots.join(", ")}`,
);

const skipped = readFile('SKIPPED_HUMAN_DECISIONS.md');
for (const skipId of ['SKIP-W7-MOBILE-TURNSTILE-SECRET', 'SKIP-W7-WHATSAPP-LIVE-CREDS']) {
  reporter.assert(skipped.includes(skipId), `SKIPPED_HUMAN_DECISIONS.md missing ${skipId}`);
}
if (exists('apps/mobile/merchant-app/lib/widgets/editor/website_preview.dart')) {
  assertRecordedCapabilityGap(
    'CAP-C12',
    'SKIP-CAP-STORE-PUBLISH-PIPELINE',
    'Residual mobile/editor preview surface must remain recorded until store-publish writes canonical theme runtime state',
  );
}
assertRecordedCapabilityGap(
  'CAP-C10',
  'SKIP-CAP-ALERTING-END-TO-END',
  'Alerting must remain recorded as an end-to-end capability gap; DSN presence alone is not live alert delivery',
);
for (const file of [
  'services/api-gateway/src/routes/admin.ts',
  'services/api-gateway/src/routes/employee.ts',
  'services/api-gateway/src/routes/contacts.ts',
]) {
  assertIncludes(
    file,
    'SKIP-CAP-TRANSACTIONAL-EMAILS',
    `${file} must record transactional email delivery as a capability seam while persistence succeeds without sends`,
  );
  assertNotIncludes(file, 'TODO: Send', `${file} must not carry loose transactional email TODOs`);
}
assertRecordedCapabilityGap(
  'CAP-C14',
  'SKIP-CAP-TRANSACTIONAL-EMAILS',
  'Transactional invite/contact email delivery must remain recorded until queue/provider-backed sends are wired',
);

const aiSidebar = readFile('apps/merchant-control-plane/src/components/AISidebar.tsx');
const headerBar = readFile('apps/merchant-control-plane/src/components/HeaderBar.tsx');
const merchantGlobals = readFile('apps/merchant-control-plane/src/app/globals.css');
for (const fragment of [
  'AI-powered suggestions are coming soon',
  'AI-powered responses are coming soon',
  "placeholder=\"Ask LetBuyy AI...\"",
  "setTimeout(() =>",
  "activeTab === 'chat'",
  'admin-ai-message',
  'admin-ai-panel-footer',
]) {
  reporter.assert(!aiSidebar.includes(fragment), `merchant setup assistant must not expose fake AI chat residue: ${fragment}`);
}
reporter.assert(
  aiSidebar.includes('Setup assistant'),
  'merchant setup assistant must present the real setup checklist instead of a fake AI chat surface',
);
reporter.assert(
  headerBar.includes('title="Setup assistant"'),
  'merchant header must label the panel as setup assistant, not live AI',
);
reporter.assert(!headerBar.includes('title="LetBuyy AI"'), 'merchant header must not advertise a fake live AI panel');
for (const fragment of [
  '.admin-ai-tab',
  '.admin-ai-message',
  '.admin-ai-input',
  '.admin-ai-send-btn',
]) {
  reporter.assert(!merchantGlobals.includes(fragment), `merchant setup assistant CSS must not retain fake chat selectors: ${fragment}`);
}

const packageJson = readFile('package.json');
for (const fragment of [
  '"validate:beta-readiness": "node scripts/validators/beta-readiness-validator.mjs"',
  '"test:foundation:wave7":',
]) {
  reporter.assert(packageJson.includes(fragment), `package.json missing Wave 7 script: ${fragment}`);
}

reporter.finish('mobile Turnstile, checkout capture, sandbox COD/WhatsApp, OIDC honesty, deploy exclusions, D11 package deletion, and recorded capability gaps checked');
