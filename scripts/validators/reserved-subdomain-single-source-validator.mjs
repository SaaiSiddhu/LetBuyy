import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Reserved subdomain single-source validator");

const tenantCore = readFile("packages/tenant-core/src/index.ts");
const gatewaySchema = readFile("services/api-gateway/src/schemas/store.schema.ts");
const gatewayAuth = readFile("services/api-gateway/src/routes/auth.ts");
const gatewayOnboarding = readFile("services/api-gateway/src/routes/onboarding.ts");
const storefrontSeo = readFile("apps/storefront-runtime/src/lib/seo.ts");

for (const label of [
  "www",
  "api",
  "admin",
  "accounts",
  "apps",
  "themes",
  "developer",
  "console",
  "team",
  "webhooks",
  "assets",
  "cdn",
  "static",
  "mail",
  "dcv",
  "connect",
]) {
  reporter.assert(
    new RegExp(`['"]${label}['"]`).test(tenantCore),
    `tenant-core RESERVED_STOREFRONT_LABELS must include ${label}`,
  );
}

reporter.assert(
  /export const RESERVED_STOREFRONT_LABELS/.test(tenantCore),
  "tenant-core must own RESERVED_STOREFRONT_LABELS",
);
reporter.assert(
  /export function resolveStorefrontHost/.test(tenantCore),
  "tenant-core must own the storefront host parser",
);
reporter.assert(
  /RESERVED_STOREFRONT_LABELS/.test(gatewaySchema),
  "api-gateway schema facade must re-export RESERVED_STOREFRONT_LABELS",
);
reporter.assert(
  /validateSubdomainFormat/.test(gatewayAuth),
  "auth custom subdomain validation must use tenant-core validateSubdomainFormat",
);
reporter.assert(
  /CheckSubdomainSchema/.test(gatewayOnboarding),
  "onboarding subdomain validation must use tenant-core CheckSubdomainSchema",
);
reporter.assert(
  /resolveStorefrontHost/.test(storefrontSeo),
  "storefront host parsing must call tenant-core resolveStorefrontHost",
);
reporter.assert(
  !/const\s+RESERVED_SUBDOMAINS\s*=\s*new Set\(\[/.test(storefrontSeo),
  "storefront-runtime must not define an app-local reserved-label set",
);

reporter.finish("reserved storefront labels and host parsing are single-sourced in @letbuyy/tenant-core");
