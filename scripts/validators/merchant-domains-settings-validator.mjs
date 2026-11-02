import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  readFile,
  root,
} from "./governance-common.mjs";

const reporter = createReporter("Merchant domains settings validator");

const page = readFile("apps/merchant/web/src/app/[store]/settings/domains/page.tsx");
const wizard = readFile("apps/merchant/web/src/components/domains/ConnectDomainWizard.tsx");
const detail = readFile("apps/merchant/web/src/components/domains/DomainDetailView.tsx");
const client = readFile("apps/merchant/web/src/lib/domains/client.ts");
const combined = `${page}\n${wizard}\n${detail}\n${client}`;

for (const fragment of [
  "checkout?.dns_records.map",
  "domainsClient",
  "Find a new domain",
  "Ownership",
  "DNS",
  "SSL",
  "Live",
]) {
  reporter.assert(combined.includes(fragment), `domains settings subsystem missing ${fragment}`);
}

// Registration stays unavailable until server-owned payment proof is implemented.
// A source guard must not force the UI to advertise an unavailable purchase.
reporter.assert(page.includes('Registration through LetBuyy will be available after secure payment verification is ready.'),
  'domain search must disclose the live registration gate');

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
