import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  readFile,
  root,
} from "./governance-common.mjs";

const reporter = createReporter("Merchant domains settings validator");

const page = readFile("apps/merchant_web/src/app/[store]/settings/domains/page.tsx");
const wizard = readFile("apps/merchant_web/src/components/domains/ConnectDomainWizard.tsx");
const detail = readFile("apps/merchant_web/src/components/domains/DomainDetailView.tsx");
const client = readFile("apps/merchant_web/src/lib/domains/client.ts");
const combined = `${page}\n${wizard}\n${detail}\n${client}`;

for (const fragment of [
  "NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET",
  "domainsClient",
  "Buy a",
  "Ownership",
  "DNS",
  "SSL",
  "Live",
]) {
  reporter.assert(combined.includes(fragment), `domains settings subsystem missing ${fragment}`);
}

reporter.assert(
  combined.includes("apex_mx_warning") || combined.includes("This domain receives email"),
  "domains settings subsystem missing apex MX warning handling",
);

reporter.assert(
  client.includes("/api/stores/") && client.includes("/domains"),
  "domainsClient must route through same-origin store domain endpoints",
);

reporter.assert(
  !/createSupabase|SUPABASE_SERVICE_ROLE|\.from\(/.test(combined),
  "domains settings subsystem must not access the database directly",
);

reporter.finish("merchant custom-domain settings are gateway-backed and include domain management controls");
