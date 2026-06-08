import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Mobile domain parity validator");

const service = readFile("apps/mobile/merchant-app/lib/services/custom_domains.dart");
const screen = readFile("apps/mobile/merchant-app/lib/screens/settings/domain_settings_screen.dart");
const test = readFile("apps/mobile/merchant-app/test/mobile_services_test.dart");
const dartClient = readFile("packages/dart/api_client/lib/src/api_client.dart");

for (const fragment of [
  "/custom/domains",
  "/custom/domains/verify",
  "/store-access",
  "/store-access/preview-links",
  "NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET",
]) {
  reporter.assert(service.includes(fragment), `mobile domain service missing ${fragment}`);
}

for (const fragment of [
  "_api.domains.search",
  "_api.domains.purchase",
]) {
  reporter.assert(service.includes(fragment), `mobile domain service missing typed domain client call ${fragment}`);
}

for (const fragment of [
  "/domains/search",
  "/domains/purchase",
]) {
  reporter.assert(dartClient.includes(fragment), `Dart API client missing ${fragment}`);
}

for (const fragment of [
  "Store access",
  "preview_only",
  "Create preview link",
  "Buy a domain",
  "Your domain has email (MX) records",
  "lb_preview",
]) {
  reporter.assert(screen.includes(fragment), `mobile domain settings screen missing ${fragment}`);
}

reporter.assert(!service.includes("MOBILE_DOMAIN_LIFECYCLE"), "mobile custom-domain service must not keep the backend-skip lifecycle marker");
reporter.assert(test.includes("DomainService uses gateway custom-domain and access endpoints"), "mobile domain service test must cover gateway endpoints");

reporter.finish("mobile custom-domain and store-access parity is wired to gateway contracts");
