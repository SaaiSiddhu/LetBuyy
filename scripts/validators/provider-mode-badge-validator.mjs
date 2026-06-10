import {
  assertNoOffenders,
  phaseBEntries,
  pushRegexOffenders,
} from "./phase-b-common.mjs";
import { createReporter, exists, readFile } from "./governance-common.mjs";

const reporter = createReporter("Provider mode badge validator");

for (const required of [
  "services/api-gateway/src/routes/payouts.ts",
  "services/api-gateway/src/routes/payments.ts",
  "services/api-gateway/src/routes/kyc.ts",
  "services/api-gateway/src/routes/whatsapp.ts",
  "services/api-gateway/src/routes/shipping-labels.ts",
  "services/api-gateway/src/routes/stores.ts",
  "services/mobile-bff/src/index.ts",
  "apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx",
  "apps/merchant-control-plane/src/app/[store]/settings/billing/page.tsx",
  "apps/merchant-control-plane/src/app/[store]/settings/shipping/page.tsx",
  "apps/merchant-control-plane/src/app/[store]/orders/page.tsx",
  "apps/mobile/merchant-app/lib/screens/money/money_screen.dart",
  "apps/mobile/merchant-app/lib/screens/settings/billing_screen.dart",
  "apps/mobile/merchant-app/lib/screens/orders/order_detail_screen.dart",
  "apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart",
]) {
  reporter.assert(readFile(required).includes("provider_mode"), `${required} must expose provider_mode honesty evidence`);
}

for (const required of [
  "apps/merchant-control-plane/src/components/ProviderModeBadge.tsx",
  "apps/mobile/merchant-app/lib/widgets/shared/provider_mode_badge.dart",
]) {
  reporter.assert(readFile(required).includes("ProviderModeBadge"), `${required} must implement a visible provider mode badge`);
}

const bff = readFile("services/mobile-bff/src/index.ts");
reporter.assert(bff.includes("app.get('/v1/mobile/dashboard'"), "mobile BFF must expose the composite dashboard endpoint");
reporter.assert(bff.includes("Promise.all"), "mobile BFF dashboard must fan into one composite response");
reporter.assert(bff.includes("/v1/payouts/summary"), "mobile BFF dashboard must include payout summary");
reporter.assert(bff.includes("/v1/analytics/dashboard"), "mobile BFF dashboard must include analytics dashboard");

const capabilityBacklog = readFile("CAPABILITY_BACKLOG.md");
const skippedHumanDecisions = readFile("SKIPPED_HUMAN_DECISIONS.md");
const kycAdapter = readFile("packages/infrastructure/kyc-verification-adapter/index.ts");
const checkoutCore = readFile("packages/checkout-core/src/index.ts");
const taxRoute = readFile("services/api-gateway/src/routes/tax.ts");
const queueWorker = readFile("services/queue-workers/src/platform-queue-consumer.ts");
const themesRoute = readFile("services/api-gateway/src/routes/themes.ts");
const storePaymentConfig = readFile("services/api-gateway/src/lib/store-payment-config.ts");
const merchantPaymentsPage = readFile("apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx");
const notificationCore = readFile("packages/notification-core/src/index.ts");
const emailRoute = readFile("services/api-gateway/src/routes/email.ts");
const aiRoute = readFile("services/api-gateway/src/routes/ai.ts");
const aiAdapter = readFile("packages/infrastructure/ai-generation-adapter/index.ts");
reporter.assert(!kycAdapter.includes("live_provider_stub"), "KYC adapter must not turn sandbox verification into live-provider success");
reporter.assert(kycAdapter.includes("KYC_LIVE_PROVIDER_UNAVAILABLE"), "KYC adapter must fail closed while live provider integration is absent");
reporter.assert(capabilityBacklog.includes("CAP-C15"), "CAPABILITY_BACKLOG.md missing CAP-C15 live KYC provider gap");
reporter.assert(skippedHumanDecisions.includes("SKIP-CAP-KYC-LIVE-PROVIDER"), "SKIPPED_HUMAN_DECISIONS.md missing SKIP-CAP-KYC-LIVE-PROVIDER");
reporter.assert(checkoutCore.includes("SANDBOX-IRN-"), "GST/IRP invoice generation must use sandbox IRN labels while live IRP is human-gated");
reporter.assert(!checkoutCore.includes("MOCK-IRN-"), "GST/IRP invoice generation must not emit MOCK-IRN labels");
reporter.assert(taxRoute.includes("irp_mode: 'sandbox'"), "tax route must expose sandbox IRP mode, not mock IRP mode");
reporter.assert(!taxRoute.includes("irp_mode: 'mock'"), "tax route must not expose mock IRP mode");
reporter.assert(queueWorker.includes("sandbox_send"), "WhatsApp queue-worker dispatch metadata must expose sandbox_send");
reporter.assert(!queueWorker.includes("mock_send"), "WhatsApp queue-worker dispatch metadata must not expose mock_send");
for (const fragment of [
  "payment_provider: 'mock'",
  "provider: 'mock'",
  "theme_mock",
  "theme.purchase.completed:mock",
  "PAYMENTS_PROVIDER is not mock",
]) {
  reporter.assert(!themesRoute.includes(fragment), `theme marketplace paid purchase must not use mock payment labels: ${fragment}`);
}
reporter.assert(themesRoute.includes("payment_provider: 'sandbox'"), "theme marketplace local paid purchase must be sandbox-labelled");
reporter.assert(themesRoute.includes("provider: 'sandbox'"), "theme marketplace paid purchase response/event must be sandbox-labelled");
reporter.assert(themesRoute.includes("isProductionLikeRuntime"), "theme marketplace sandbox purchase fallback must fail closed in production-like runtimes");
reporter.assert(!storePaymentConfig.includes("provider_mode: 'mock'"), "store payment config fallback must not expose mock provider_mode");
reporter.assert(storePaymentConfig.includes("provider_mode: 'sandbox'"), "store payment config fallback must expose sandbox provider_mode");
reporter.assert(!merchantPaymentsPage.includes("|| 'mock'"), "merchant payments page must not fall back to mock provider mode");
reporter.assert(merchantPaymentsPage.includes("|| 'sandbox'"), "merchant payments page must fall back to sandbox provider mode");
for (const fragment of [
  "mock_resend",
  "mock_ses",
  "mock_sendgrid",
  "input.mode || 'mock'",
]) {
  reporter.assert(!notificationCore.includes(fragment), `notification-core email providers must be sandbox-labelled: ${fragment}`);
}
for (const fragment of [
  "LETBUYY_EMAIL_MODE || 'mock'",
  "mock_failed_providers",
  "`mock_${",
  "mock_failover_fixture",
]) {
  reporter.assert(!emailRoute.includes(fragment), `email route must not use mock ESP labels: ${fragment}`);
}
reporter.assert(notificationCore.includes("sandbox_resend"), "notification-core must expose sandbox ESP providers");
reporter.assert(emailRoute.includes("email_sandbox_"), "email route must emit sandbox provider message ids");
for (const fragment of [
  "LETBUYY_AI_MODEL_MODE || 'mock'",
  "mode?: 'mock'",
  "mode: 'mock'",
  "const mode = input.mode === 'live' ? 'live' : 'mock'",
]) {
  reporter.assert(!aiRoute.includes(fragment), `AI route seam must not use mock model-mode labels: ${fragment}`);
  reporter.assert(!aiAdapter.includes(fragment), `AI generation adapter seam must not use mock model-mode labels: ${fragment}`);
}
reporter.assert(aiRoute.includes("LETBUYY_AI_MODEL_MODE === 'live' ? 'live' : 'sandbox'"), "AI seam route must default model mode to sandbox");
reporter.assert(aiAdapter.includes("mode: 'sandbox' | 'live'"), "AI capability seam must expose sandbox/live modes");
reporter.assert(!exists("packages/infrastructure/identity-otp-adapter/index.ts"), "retired identity OTP mock adapter must not exist");
reporter.assert(!readFile("packages/infrastructure/src/index.ts").includes("identity-otp-adapter"), "infrastructure barrel must not export retired identity OTP mock adapter");
reporter.assert(!readFile("packages/infrastructure/package.json").includes("identity-otp-adapter"), "infrastructure package must not expose retired identity OTP mock adapter");

const routes = readFile("apps/mobile/merchant-app/lib/app/routes.dart");
reporter.assert(!routes.includes("MerchantFeatureDefinitions"), "mobile routes must not depend on the parity feature catalog");
reporter.assert(!routes.includes("MerchantFeatureScreen"), "mobile routes must not render parity feature screens");

const offenders = [];
for (const entry of phaseBEntries(["apps", "services", "packages"])) {
  pushRegexOffenders(
    offenders,
    entry,
    /success\s*:\s*true[\s\S]{0,240}(provider_mode\s*:\s*['"]mock['"]|mock\s*:\s*true)|(provider_mode\s*:\s*['"]mock['"]|mock\s*:\s*true)[\s\S]{0,240}success\s*:\s*true/gi,
    () => "mock provider path must not present as success",
  );
}

assertNoOffenders(reporter, offenders, "Provider mocks must be honestly badged, not success-shaped");
reporter.finish("provider-mode honesty surfaces checked");
