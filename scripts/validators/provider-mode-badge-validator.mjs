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
const aiCreditAdapter = readFile("packages/infrastructure/ai-credit-purchase-adapter/index.ts");
const analyticsRoute = readFile("services/api-gateway/src/routes/analytics.ts");
const billingCore = readFile("packages/billing-core/src/index.ts");
const billingRoute = readFile("services/api-gateway/src/routes/billing.ts");
const providerModeBadge = readFile("apps/merchant-control-plane/src/components/ProviderModeBadge.tsx");
const mobileProviderModeBadge = readFile("apps/mobile/merchant-app/lib/widgets/shared/provider_mode_badge.dart");
const mobileRazorpayConnectScreen = readFile("apps/mobile/merchant-app/lib/screens/subscription/connect_razorpay_screen.dart");
const paymentsPackage = readFile("packages/payments/src/index.ts");
const paymentsRoute = readFile("services/api-gateway/src/routes/payments.ts");
const paymentSupport = readFile("services/api-gateway/src/lib/payment-route-support.ts");
const paymentSchema = readFile("services/api-gateway/src/schemas/payment.schema.ts");
const paymentSessionsMigration = readFile("database/supabase/migrations/142_executable_payment_sessions.sql");
const notificationsRoute = readFile("services/api-gateway/src/routes/notifications.ts");
const cryptoSource = readFile("services/api-gateway/src/lib/crypto.ts");
const registrarSource = readFile("services/api-gateway/src/lib/registrar/index.ts");
const domainRoutes = readFile("services/api-gateway/src/routes/domains.ts");
const sharedTypes = readFile("packages/shared-types/src/index.ts");
const gatewayIndex = readFile("services/api-gateway/src/index.ts");
const checkoutRoute = readFile("services/api-gateway/src/routes/checkout.ts");
const storefrontCartRoutes = readFile("services/api-gateway/src/routes/storefront/cart-routes.ts");
const mediaRoute = readFile("services/api-gateway/src/routes/media.ts");
const shippingRoute = readFile("services/api-gateway/src/routes/shipping.ts");
const shippingLabelsRoute = readFile("services/api-gateway/src/routes/shipping-labels.ts");
const logisticsAdapter = readFile("packages/infrastructure/logistics-adapter/index.ts");
const workerEnvSchema = readFile("config/env/schemas/worker.schema.json");
const identityResidencyConfig = readFile("config/runtime/identity/residency.json");
const identityResidencySchema = readFile("config/runtime/identity-residency.schema.json");
const baselineMigration = readFile("database/supabase/migrations/000_baseline.sql");
const customDomainsMigration = readFile("database/supabase/migrations/090_custom_domains_and_store_access.sql");
const taxInvoiceMigration = readFile("database/supabase/migrations/144_executable_tax_gst_invoices.sql");
const settlementMigration = readFile("database/supabase/migrations/151_executable_settlement_ledger.sql");
const billingAutopayMigration = readFile("database/supabase/migrations/152_executable_billing_autopay.sql");
const aiSeamMigration = readFile("database/supabase/migrations/154_executable_analytics_media_ai_seam.sql");
const moneyAuthorityRollback = readFile("database/supabase/rollback/160_foundation_money_ledger_authority.rollback.sql");
reporter.assert(!kycAdapter.includes("live_provider_stub"), "KYC adapter must not turn sandbox verification into live-provider success");
reporter.assert(!kycAdapter.includes("KYC_LIVE_PROVIDER_CREDENTIALS_REQUIRED"), "KYC live provider gap must not imply credentials alone activate the missing provider client");
reporter.assert(kycAdapter.includes("KYC_LIVE_PROVIDER_UNAVAILABLE"), "KYC adapter must fail closed while live provider integration is absent");
reporter.assert(!identityResidencyConfig.includes("mockAllowed"), "identity residency config must use sandboxAllowed instead of mockAllowed");
reporter.assert(!identityResidencySchema.includes("mockAllowed"), "identity residency schema must use sandboxAllowed instead of mockAllowed");
reporter.assert(identityResidencyConfig.includes("sandboxAllowed"), "identity residency config must retain sandboxAllowed environment gating");
reporter.assert(identityResidencySchema.includes("sandboxAllowed"), "identity residency schema must retain sandboxAllowed environment gating");
reporter.assert(capabilityBacklog.includes("CAP-C15"), "CAPABILITY_BACKLOG.md missing CAP-C15 live KYC provider gap");
reporter.assert(skippedHumanDecisions.includes("SKIP-CAP-KYC-LIVE-PROVIDER"), "SKIPPED_HUMAN_DECISIONS.md missing SKIP-CAP-KYC-LIVE-PROVIDER");
reporter.assert(checkoutCore.includes("SANDBOX-IRN-"), "GST/IRP invoice generation must use sandbox IRN labels while live IRP is human-gated");
reporter.assert(!checkoutCore.includes("MOCK-IRN-"), "GST/IRP invoice generation must not emit MOCK-IRN labels");
reporter.assert(!checkoutCore.includes("z.enum(['mock', 'sandbox', 'live'])"), "checkout payment intent schema must not accept mock payment modes");
reporter.assert(checkoutCore.includes("mode: z.enum(['sandbox', 'live']).default('sandbox')"), "checkout payment intent schema must accept sandbox/live only");
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
reporter.assert(themesRoute.includes("THEME_MARKETPLACE_GSTIN_REQUIRED"), "theme marketplace receipts must fail closed without production GSTIN");
reporter.assert(!themesRoute.includes("dev_placeholder"), "theme marketplace receipts must not label dev GSTIN as a placeholder provider fact");
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
reporter.assert(emailRoute.includes("liveEmailProviderDispatchAvailable"), "email route live mode must fail closed until provider dispatch is implemented");
reporter.assert(emailRoute.includes("EMAIL_PROVIDER_SETUP_REQUIRED"), "email route must return setup-required for unavailable live provider dispatch");
reporter.assert(capabilityBacklog.includes("CAP-C18"), "CAPABILITY_BACKLOG.md missing CAP-C18 live email dispatch gap");
reporter.assert(skippedHumanDecisions.includes("SKIP-CAP-LIVE-EMAIL-DISPATCH"), "SKIPPED_HUMAN_DECISIONS.md missing SKIP-CAP-LIVE-EMAIL-DISPATCH");
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
reporter.assert(aiCreditAdapter.includes("AI_CREDIT_PURCHASE_LIVE_PROVIDER_UNAVAILABLE"), "AI credit purchase live mode must fail closed while provider checkout client is absent");
reporter.assert(!aiCreditAdapter.includes("providerMode: 'live'"), "AI credit purchase adapter must not return live provider mode without a real provider checkout order");
reporter.assert(!aiCreditAdapter.includes("requires_checkout"), "AI credit purchase adapter must not advertise checkout-required state before a real checkout provider exists");
reporter.assert(!sharedTypes.includes("requires_checkout"), "shared AI credit purchase contract must not advertise checkout-required state before a real checkout provider exists");
reporter.assert(capabilityBacklog.includes("CAP-C17"), "CAPABILITY_BACKLOG.md missing CAP-C17 AI credit purchase provider gap");
reporter.assert(skippedHumanDecisions.includes("SKIP-CAP-AI-CREDIT-PURCHASE-PROVIDER"), "SKIPPED_HUMAN_DECISIONS.md missing SKIP-CAP-AI-CREDIT-PURCHASE-PROVIDER");
for (const fragment of [
  "LETBUYY_WAREHOUSE_MODE || 'mock'",
  "mode: 'mock'",
]) {
  reporter.assert(!analyticsRoute.includes(fragment), `analytics warehouse seam must not use mock labels: ${fragment}`);
}
reporter.assert(analyticsRoute.includes("mode: 'sandbox'"), "analytics warehouse seam must default to sandbox while live warehouse is human-gated");
for (const fragment of [
  "z.enum(['mock', 'sandbox', 'live'])",
  "default('mock')",
  "mock_payment_status",
  "planMockUpiAutopayMandate",
  "providerMode || 'mock'",
]) {
  reporter.assert(!billingCore.includes(fragment), `billing-core must use sandbox-labelled AutoPay contracts: ${fragment}`);
  reporter.assert(!billingRoute.includes(fragment), `billing route must use sandbox-labelled AutoPay contracts: ${fragment}`);
}
for (const fragment of [
  "mock_autopay",
  "mock_failed",
  "mock-irn",
  "mock-qr",
  "mock: mandate",
]) {
  reporter.assert(!billingRoute.includes(fragment), `billing route must not persist mock AutoPay labels: ${fragment}`);
}
reporter.assert(billingCore.includes("BillingProviderModeSchema = z.enum(['sandbox', 'live'])"), "billing provider mode schema must be sandbox/live only");
reporter.assert(billingCore.includes("planSandboxUpiAutopayMandate"), "billing-core must expose the sandbox AutoPay planner");
reporter.assert(billingRoute.includes("sandbox_autopay"), "billing route must persist sandbox AutoPay identifiers");
reporter.assert(!providerModeBadge.includes("'mock'"), "web ProviderModeBadge must not expose mock as a valid provider mode");
reporter.assert(!mobileProviderModeBadge.includes("ProviderMode.mock"), "Flutter ProviderModeBadge must not expose mock as a valid provider mode");
reporter.assert(!mobileProviderModeBadge.includes("'test' => ProviderMode.sandbox"), "Flutter ProviderModeBadge must not accept test as a provider mode alias");
reporter.assert(!mobileRazorpayConnectScreen.includes("'Test Mode'"), "mobile Razorpay connect screen must use sandbox mode copy");
reporter.assert(!mobileRazorpayConnectScreen.includes("Test Mode Active"), "mobile Razorpay connect screen must use sandbox active-state copy");
reporter.assert(!mobileRazorpayConnectScreen.includes("Use test credentials for development"), "mobile Razorpay connect screen must not use test-credentials copy");
reporter.assert(mobileRazorpayConnectScreen.includes("'Sandbox Mode'"), "mobile Razorpay connect screen must expose sandbox mode copy");
reporter.assert(mobileRazorpayConnectScreen.includes("Sandbox Mode Active"), "mobile Razorpay connect screen must expose sandbox active-state copy");
for (const fragment of [
  "PaymentProviderMode = 'mock'",
  "buildMockPaymentSessionPlan",
  "normalized === 'mock' || normalized === 'sandbox'",
  "mode === 'mock'",
  "external_rail: mode === 'mock'",
]) {
  reporter.assert(!paymentsPackage.includes(fragment), `payments package must use sandbox-labelled session planning: ${fragment}`);
  reporter.assert(!paymentsRoute.includes(fragment), `payments route must use sandbox-labelled session planning: ${fragment}`);
  reporter.assert(!paymentSupport.includes(fragment), `payment route support must use sandbox-labelled session planning: ${fragment}`);
}
for (const fragment of [
  "z.enum(['mock', 'sandbox', 'live'])",
  "DEFAULT 'mock'",
  "mock-kms://",
  "CHECK (mode IN ('mock', 'sandbox', 'live'))",
]) {
  reporter.assert(!paymentSchema.includes(fragment), `payment schema must not accept mock mode: ${fragment}`);
  reporter.assert(!paymentSessionsMigration.includes(fragment), `payment sessions migration must not replay mock mode: ${fragment}`);
}
reporter.assert(paymentsPackage.includes("PaymentProviderMode = 'sandbox' | 'live'"), "payments package provider mode must be sandbox/live only");
reporter.assert(paymentsPackage.includes("buildSandboxPaymentSessionPlan"), "payments package must expose the sandbox payment-session planner");
reporter.assert(paymentSchema.includes("z.enum(['sandbox', 'live'])"), "payment session schema must accept sandbox/live modes only");
reporter.assert(paymentSessionsMigration.includes("DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'live'))"), "payment sessions migration must default mode to sandbox/live only");
reporter.assert(!notificationsRoute.includes("`mock_${selectedChannel}`"), "notification route must not persist mock provider labels");
reporter.assert(notificationsRoute.includes("`sandbox_${selectedChannel}`"), "notification route must persist sandbox provider labels");
for (const fragment of [
  "KmsMode = 'mock'",
  "createMockKmsProvider",
  "LETBUYY_KMS_MOCK_SECRET",
  "LETBUYY_ALLOW_MOCK_KMS",
  "mode: 'mock'",
  "mock-local-kms-key",
  "letbuyy-local-mock-kms-envelope-secret",
]) {
  reporter.assert(!cryptoSource.includes(fragment), `KMS envelope provider must use sandbox labels: ${fragment}`);
}
reporter.assert(cryptoSource.includes("KmsMode = 'sandbox' | 'live'"), "KMS provider mode must be sandbox/live only");
reporter.assert(cryptoSource.includes("createSandboxKmsProvider"), "KMS envelope provider must use sandbox helper naming");
for (const fragment of [
  "REGISTRAR_MOCK_ENABLED",
  "MockRegistrarProvider",
  "provider === 'mock'",
  "registrarOrderId: `mock-",
  "Mock registrar is only allowed",
]) {
  reporter.assert(!registrarSource.includes(fragment), `registrar seam must use sandbox labels: ${fragment}`);
  reporter.assert(!domainRoutes.includes(fragment), `domain routes must use sandbox registrar labels: ${fragment}`);
  reporter.assert(!gatewayIndex.includes(fragment), `gateway env surface must use sandbox registrar labels: ${fragment}`);
}
reporter.assert(registrarSource.includes("SandboxRegistrarProvider"), "registrar seam must expose SandboxRegistrarProvider");
reporter.assert(registrarSource.includes("REGISTRAR_SANDBOX_ENABLED"), "registrar sandbox provider must be explicitly gated");
reporter.assert(sharedTypes.includes("DomainRegistrarProviderSchema = z.enum(['resellerclub', 'opensrs', 'sandbox'])"), "shared domain registrar schema must use sandbox, not mock");
reporter.assert(sharedTypes.includes("provider_mode: z.enum(['sandbox', 'live']).default('sandbox')"), "store payment config schema must use sandbox/live provider modes");
reporter.assert(!bff.includes("type ProviderMode = 'mock'"), "mobile BFF provider mode union must not accept mock");
reporter.assert(!bff.includes("value !== 'mock'"), "mobile BFF provider mode parser must not accept mock");
reporter.assert(bff.includes("type ProviderMode = 'sandbox' | 'live'"), "mobile BFF provider mode union must be sandbox/live only");
reporter.assert(!workerEnvSchema.includes('"mock"'), "worker env schema must not allow mock registrar provider");
reporter.assert(workerEnvSchema.includes('"sandbox"'), "worker env schema must allow sandbox registrar provider");
for (const [label, source] of [
  ["baseline migration", baselineMigration],
  ["custom domains migration", customDomainsMigration],
  ["tax invoice migration", taxInvoiceMigration],
  ["settlement migration", settlementMigration],
  ["billing autopay migration", billingAutopayMigration],
  ["AI seam migration", aiSeamMigration],
  ["money authority rollback", moneyAuthorityRollback],
]) {
  reporter.assert(!source.includes("DEFAULT 'mock'"), `${label} must not replay mock defaults`);
  reporter.assert(!source.includes("DEFAULT 'mock'::text"), `${label} must not replay mock text defaults`);
  reporter.assert(!source.includes("IN ('mock'"), `${label} must not allow mock provider modes`);
  reporter.assert(!source.includes("'mock'::text"), `${label} must not allow mock text enum values`);
}
reporter.assert(settlementMigration.includes("provider_mode text NOT NULL DEFAULT 'sandbox'"), "settlement migration must default provider modes to sandbox");
reporter.assert(billingAutopayMigration.includes("provider_mode text NOT NULL DEFAULT 'sandbox'"), "billing AutoPay migration must default provider mode to sandbox");
reporter.assert(aiSeamMigration.includes("mode text NOT NULL DEFAULT 'sandbox'"), "AI seam migration must default mode to sandbox");
reporter.assert(taxInvoiceMigration.includes("irp_mode text NOT NULL DEFAULT 'sandbox' CHECK (irp_mode IN ('sandbox', 'live'))"), "tax invoice migration must default IRP mode to sandbox/live");
for (const [label, source] of [
  ["checkout route", checkoutRoute],
  ["storefront cart route", storefrontCartRoutes],
  ["media route", mediaRoute],
]) {
  reporter.assert(!source.includes("letbuyy-local-mock"), `${label} local fallback secrets must use sandbox labels`);
}
reporter.assert(checkoutRoute.includes("letbuyy-local-sandbox-checkout-handoff-secret"), "checkout route local handoff secret must be sandbox-labelled");
reporter.assert(storefrontCartRoutes.includes("letbuyy-local-sandbox-checkout-handoff-secret"), "storefront cart route local handoff secret must be sandbox-labelled");
reporter.assert(mediaRoute.includes("letbuyy-local-sandbox-media-upload-secret"), "media route local upload secret must be sandbox-labelled");
reporter.assert(!shippingRoute.includes("mock-standard"), "shipping route local fallback rate must be sandbox-labelled");
reporter.assert(shippingRoute.includes("sandbox-standard"), "shipping route local fallback rate must expose sandbox-standard");
reporter.assert(logisticsAdapter.includes("LOGISTICS_LIVE_PROVIDER_UNAVAILABLE"), "logistics adapter live mode must fail closed while real carrier clients are absent");
reporter.assert(logisticsAdapter.includes("assertSandboxScaffold"), "logistics adapter must restrict scaffold labels to sandbox mode");
reporter.assert(!logisticsAdapter.includes("live mode requires provider credentials"), "logistics adapter must not treat credentials alone as a live provider implementation");
reporter.assert(shippingRoute.includes("isLogisticsLiveProviderUnavailableError"), "shipping tracking route must translate unavailable live logistics providers to setup-required responses");
reporter.assert(shippingLabelsRoute.includes("liveLogisticsProviderAvailable"), "shipping label route must not expose live provider mode until a real logistics provider exists");
reporter.assert(shippingLabelsRoute.includes("CARRIER_SETUP_REQUIRED"), "shipping label route must fail closed when live carrier setup is unavailable");
reporter.assert(capabilityBacklog.includes("CAP-C16"), "CAPABILITY_BACKLOG.md missing CAP-C16 live logistics provider gap");
reporter.assert(skippedHumanDecisions.includes("SKIP-CAP-LOGISTICS-LIVE-PROVIDER"), "SKIPPED_HUMAN_DECISIONS.md missing SKIP-CAP-LOGISTICS-LIVE-PROVIDER");
reporter.assert(!exists("packages/infrastructure/identity-otp-adapter/index.ts"), "retired identity OTP mock adapter must not exist");
reporter.assert(!readFile("packages/infrastructure/src/index.ts").includes("identity-otp-adapter"), "infrastructure barrel must not export retired identity OTP mock adapter");
reporter.assert(!readFile("packages/infrastructure/package.json").includes("identity-otp-adapter"), "infrastructure package must not expose retired identity OTP mock adapter");
reporter.assert(!exists("packages/infrastructure/upi-adapter/index.ts"), "retired native UPI scaffold adapter must not exist");
reporter.assert(!readFile("packages/infrastructure/src/index.ts").includes("upi-adapter"), "infrastructure barrel must not export retired native UPI scaffold adapter");
reporter.assert(!readFile("packages/infrastructure/package.json").includes("upi-adapter"), "infrastructure package must not expose retired native UPI scaffold adapter");

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
