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
  'INTERNAL_API_SECRET?: string',
  'verifyMobileTurnstileToken',
  'createMobileTurnstileProof',
  "TURNSTILE_NOT_CONFIGURED",
  "TURNSTILE_PROOF_SECRET_NOT_CONFIGURED",
  "TURNSTILE_PROVIDER_UNAVAILABLE",
  "proof_token",
  "app.post('/v1/auth/mobile/turnstile/verify'",
]) {
  reporter.assert(mobileBff.includes(fragment), `mobile BFF Turnstile verifier missing: ${fragment}`);
}

const mobileBffTest = readFile('services/mobile-bff/test/session-token.test.ts');
for (const fragment of [
  'mobile Turnstile verification fails closed without a configured secret',
  'mobile Turnstile verification uses Cloudflare siteverify response',
  'mobile Turnstile verification fails closed when proof signing secret is absent',
  'lb-mobile-turnstile-v1',
]) {
  reporter.assert(mobileBffTest.includes(fragment), `mobile BFF test missing: ${fragment}`);
}

const mobileAuthService = readFile('apps/mobile/merchant-app/lib/services/store_auth_service.dart');
for (const fragment of [
  'mobileBffBaseUrl',
  '_exchangeTurnstileWithBff(token)',
  '/auth/mobile/turnstile/verify',
  'proof_token',
]) {
  reporter.assert(mobileAuthService.includes(fragment), `merchant mobile Turnstile BFF flow missing: ${fragment}`);
}
reporter.assert(!mobileAuthService.includes('_verifyTurnstileWithBff(token)'), 'merchant mobile Turnstile flow must exchange the BFF verification for a proof token');
reporter.assert(mobileAuthService.includes('return await _exchangeTurnstileWithBff(token) ?? token'), 'merchant mobile Turnstile flow must submit the BFF proof when the BFF is configured');
const identityTurnstile = readFile('apps/identity-platform/src/lib/turnstile.ts');
for (const fragment of [
  'verifyMobileTurnstileProof',
  'lb-mobile-turnstile-v1',
  'verifyLetbuyySignedPayload',
]) {
  reporter.assert(identityTurnstile.includes(fragment), `identity Turnstile proof verifier missing: ${fragment}`);
}
assertIncludes(
  'apps/mobile/merchant-app/lib/main.dart',
  'mobileBffBaseUrl: AppConfig.bffBaseUrl',
  'merchant mobile app must inject the mobile BFF base URL into auth service',
);
assertIncludes(
  'apps/mobile/merchant-app/test/mobile_services_test.dart',
  'lb-mobile-turnstile-v1.proof.signature',
  'merchant mobile tests must prove BFF Turnstile proof is sent to identity instead of the consumed provider token',
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
  ".from('ledger_transactions')",
  "source_type', 'payment_capture'",
  'capture_posted_to_ledger: capturePostedToLedger',
  'buildHostedCheckoutOrderCommand',
]) {
  reporter.assert(checkoutRoute.includes(fragment), `hosted checkout confirm missing: ${fragment}`);
}
const checkoutPaymentRoute = readFile('services/api-gateway/src/routes/storefront/checkout-payment-routes.ts');
reporter.assert(!checkoutPaymentRoute.includes('evaluateCheckoutAppFunctions'), 'CAP-C13 checkout payment route must not execute app-functions/Wasm');
reporter.assert(!checkoutPaymentRoute.includes('CHECKOUT_FUNCTION_VALIDATION'), 'CAP-C13 checkout payment route must not depend on app-function validation errors');
reporter.assert(checkoutPaymentRoute.includes('extensionFunctions: []'), 'CAP-C13 checkout response must expose an empty compatibility extensionFunctions array');
reporter.assert(
  !exists('apps/storefront-runtime/src/components/checkout-extensions/CheckoutExtensionHost.tsx'),
  'CAP-C13 checkout extension iframe host must stay deleted unless ARB re-scopes checkout extensions',
);
reporter.assert(!capabilityBacklog.includes('| CAP-C13 |'), 'CAP-C13 must not remain an open capability gap after checkout Wasm retirement');
reporter.assert(!skippedHumanDecisions.includes('SKIP-CAP-CHECKOUT-WASM-RETIREMENT'), 'CAP-C13 retired locally, so its skipped-human seam must not remain open');
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
  const merchantEditorPublishRoute = readFile('apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/route.ts');
  for (const fragment of [
    'readPublishTemplateConfig',
    'body.liquidBundle',
    'body.liquidRenderingCanary',
    'template_config: templateConfig',
  ]) {
    reporter.assert(merchantEditorPublishRoute.includes(fragment), `CAP-C12 merchant editor publish route missing: ${fragment}`);
  }

  const merchantEditorPage = readFile('apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx');
  for (const fragment of [
    'const templateConfig = buildDraftConfig(baseConfig, themeId, editorState, selectedTemplateKey)',
    'templateConfig,',
  ]) {
    reporter.assert(merchantEditorPage.includes(fragment), `CAP-C12 merchant editor page publish payload missing: ${fragment}`);
  }

  const themeExecutionAdapter = readFile('services/api-gateway/src/execution/theme-execution.adapter.ts');
  for (const fragment of [
    'const suppliedPublishConfig = hasRenderableThemeTemplate(input.template_config)',
    'mergeThemeIdentity(suppliedPublishConfig, theme)',
  ]) {
    reporter.assert(themeExecutionAdapter.includes(fragment), `CAP-C12 theme execution publish path missing: ${fragment}`);
  }

  const mobileThemeService = readFile('apps/mobile/merchant-app/lib/services/theme_service.dart');
  for (const fragment of [
    'Map<String, dynamic>? templateConfig',
    'Map<String, dynamic>? liquidBundle',
    "'template_config': publishConfig",
  ]) {
    reporter.assert(mobileThemeService.includes(fragment), `CAP-C12 mobile theme publish service missing: ${fragment}`);
  }

  const mobileThemeScreen = readFile('apps/mobile/merchant-app/lib/screens/customize/theme_screen.dart');
  reporter.assert(
    mobileThemeScreen.includes('_editorPayload?.templateConfig') && mobileThemeScreen.includes('templateConfig: templateConfig'),
    'CAP-C12 mobile theme screen must pass canonical template config into publish',
  );

  assertRecordedCapabilityGap(
    'CAP-C12',
    'SKIP-CAP-STORE-PUBLISH-PIPELINE',
    'Store-publish live certification must remain recorded until production publish/rollback smoke proves canonical theme runtime state',
  );
}
assertRecordedCapabilityGap(
  'CAP-C10',
  'SKIP-CAP-ALERTING-END-TO-END',
  'Alerting must remain recorded as an end-to-end capability gap; DSN presence alone is not live alert delivery',
);
const runtimeAlerting = readFile('services/api-gateway/src/lib/runtime-alerting.ts');
for (const fragment of [
  'RUNTIME_ALERT_METRIC_NAME',
  "RUNTIME_ALERT_JOB_TYPE = 'incident.page.dry_run'",
  'redactRuntimeAlertPayload',
  'enqueueRuntimeAlert',
  'missing-runtime-queue-binding',
  'CAP-C10 automated runtime alert dry-run',
]) {
  reporter.assert(runtimeAlerting.includes(fragment), `CAP-C10 runtime alerting implementation missing: ${fragment}`);
}
const observabilityMiddleware = readFile('services/api-gateway/src/middleware/observability.ts');
for (const fragment of [
  'enqueueRuntimeAlert',
  'RUNTIME_QUEUE',
  'RUNTIME_QUEUE_NAME',
  'statusCodeFromThrownError',
]) {
  reporter.assert(observabilityMiddleware.includes(fragment), `CAP-C10 observability middleware missing: ${fragment}`);
}
const incidentCommandWorker = readFile('services/queue-workers/src/incident-command.ts');
for (const fragment of [
  "jobType === 'incident.page.dry_run'",
  'incident.page.dry_run.worker',
  'currentOncallSchedule',
]) {
  reporter.assert(incidentCommandWorker.includes(fragment), `CAP-C10 incident command worker missing: ${fragment}`);
}
// Phase N3: routes/employee.ts's only transactional-email path
// (POST /invite) was intentionally retired -- it enqueued an email whose
// completion link never worked (see EXECUTION_LEDGER.md's PHASE-N3 row).
// The file legitimately no longer participates in the CAP-C14
// queue-based delivery pattern this loop checks; routes/admin.ts's
// separate /admin/employees/invite flow (not touched this phase) still
// does, and contacts.ts is unaffected.
for (const file of [
  'services/api-gateway/src/routes/admin.ts',
  'services/api-gateway/src/routes/contacts.ts',
]) {
  assertIncludes(file, 'enqueue', `${file} must enqueue transactional email delivery after persistence`);
  assertNotIncludes(file, 'SKIP-CAP-TRANSACTIONAL-EMAILS', `${file} must not retain the CAP-C14 delivery seam after queue wiring`);
  assertNotIncludes(file, 'TODO: Send', `${file} must not carry loose transactional email TODOs`);
}
assertNotIncludes(
  'services/api-gateway/src/routes/employee.ts',
  'TODO: Send',
  'services/api-gateway/src/routes/employee.ts must not carry loose transactional email TODOs',
);
const transactionalEmail = readFile('services/api-gateway/src/lib/transactional-email.ts');
for (const fragment of [
  "jobType: 'email.employee_invite'",
  "jobType: 'email.contact_owner_notification'",
  'NOTIFICATION_QUEUE.send',
  'signQueueTenantEnvelope',
  'missing-notification-queue',
]) {
  reporter.assert(transactionalEmail.includes(fragment), `CAP-C14 transactional email helper missing: ${fragment}`);
}
const queueWorker = readFile('services/queue-workers/src/index.ts');
for (const fragment of [
  "jobType === 'email.employee_invite'",
  "jobType === 'email.contact_owner_notification'",
  '!isTransactionalEmailJob(delivery.input.jobType)',
]) {
  reporter.assert(queueWorker.includes(fragment), `CAP-C14 queue worker dispatch missing: ${fragment}`);
}
reporter.assert(!capabilityBacklog.includes('| CAP-C14 |'), 'CAP-C14 must not remain an open capability gap after invite/contact queue wiring');
reporter.assert(!skippedHumanDecisions.includes('SKIP-CAP-TRANSACTIONAL-EMAILS'), 'CAP-C14 queue wiring is repo-side complete, so its skipped-human seam must not remain open');

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

reporter.finish('mobile Turnstile, checkout capture, sandbox COD/WhatsApp, OIDC honesty, runtime alerting, deploy exclusions, D11 package deletion, and recorded capability gaps checked');
