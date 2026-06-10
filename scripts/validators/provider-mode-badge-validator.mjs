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
reporter.assert(!kycAdapter.includes("live_provider_stub"), "KYC adapter must not turn sandbox verification into live-provider success");
reporter.assert(kycAdapter.includes("KYC_LIVE_PROVIDER_UNAVAILABLE"), "KYC adapter must fail closed while live provider integration is absent");
reporter.assert(capabilityBacklog.includes("CAP-C15"), "CAPABILITY_BACKLOG.md missing CAP-C15 live KYC provider gap");
reporter.assert(skippedHumanDecisions.includes("SKIP-CAP-KYC-LIVE-PROVIDER"), "SKIPPED_HUMAN_DECISIONS.md missing SKIP-CAP-KYC-LIVE-PROVIDER");
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
