import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  readFile,
  root,
} from "./governance-common.mjs";

const reporter = createReporter("Merchant domains settings validator");

const page = readFile("apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx");

for (const fragment of [
  "NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET",
  "apexMxWarning",
  "Buy a domain",
  "Ownership",
  "DNS",
  "SSL",
  "Live",
  "Store access",
  "preview_only",
  "Create preview link",
  "Your domain has email (MX) records",
]) {
  reporter.assert(page.includes(fragment), `domains settings page missing ${fragment}`);
}

for (const fragment of [
  "gatewayUrl('/custom/domains')",
  "gatewayUrl('/custom/domains/verify')",
  "gatewayUrl('/store-access')",
  "gatewayUrl('/store-access/preview-links')",
  "gatewayUrl('/domains/purchase')",
  "gatewayUrl(`/domains/search?query=",
  "credentials: 'include'",
]) {
  reporter.assert(page.includes(fragment), `domains settings page missing ${fragment}`);
}

reporter.assert(
  !/createSupabase|SUPABASE_SERVICE_ROLE|\.from\(/.test(page),
  "domains settings page must not access the database directly",
);

for (const route of [
  "apps/merchant-control-plane/src/app/api/stores/[store]/custom-domain/route.ts",
  "apps/merchant-control-plane/src/app/api/stores/[store]/store-access/route.ts",
]) {
  reporter.assert(!fs.existsSync(path.join(root, route)), `${route} must not be recreated as an app-local proxy route`);
}

reporter.finish("merchant custom-domain settings are gateway-backed and include access controls");
