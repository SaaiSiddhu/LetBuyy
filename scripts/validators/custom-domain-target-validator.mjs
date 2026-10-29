import path from "node:path";
import {
  createReporter,
  listWorkspaceFiles,
  readFile,
  sourceExtensions,
} from "./governance-common.mjs";

const reporter = createReporter("Custom domain target validator");

const workerTemplate = readFile("config/env/templates/worker.env.example");
const nextTemplate = readFile("config/env/templates/next-app.env.example");
const dns = readFile("infrastructure/dns/dns.tf");
const gateway = readFile("services/api-gateway/src/routes/custom-domains.ts");
const config = readFile("services/api-gateway/src/lib/custom-domain-config.ts");
const wizard = readFile("apps/merchant/web/src/components/domains/ConnectDomainWizard.tsx");
const mobile = readFile("apps/merchant/mobile/lib/services/custom_domains.dart");

for (const fragment of [
  "CUSTOM_DOMAIN_CNAME_TARGET=connect.letbuyy.com",
  "NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET=connect.letbuyy.com",
]) {
  reporter.assert(workerTemplate.includes(fragment), `worker template missing ${fragment}`);
}
reporter.assert(
  nextTemplate.includes("NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET=connect.letbuyy.com"),
  "next app template must document NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET",
);
reporter.assert(
  /resource "cloudflare_record" "connect"[\s\S]*name\s*=\s*"connect"[\s\S]*content\s*=\s*"cname\.vercel-dns\.com"/.test(dns),
  "dns.tf must create connect CNAME to Vercel",
);
reporter.assert(gateway.includes("getCustomDomainCnameTarget"), "custom-domain route must resolve target from env");
reporter.assert(config.includes("CUSTOM_DOMAIN_CNAME_TARGET"), "target helper must require custom-domain target env");
// The integrated wizard consumes the current server/env-derived DNS plan.
// An unused browser env fallback could differ from the provider target and used
// to satisfy this gate without affecting any displayed record.
reporter.assert(wizard.includes("connected.records.cname.value") && wizard.includes("checkout?.dns_records.map")
  && gateway.includes("connectedDomainCheckoutPlan"), "merchant UI must display both gateway-derived DNS targets");
reporter.assert(!/NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET\s*\|\|/.test(wizard), "merchant wizard must not guess a fallback DNS target");
reporter.assert(mobile.includes("NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET"), "mobile UI must read public target env");

for (const root of [
  "services/api-gateway/src",
  "apps/merchant/web/src",
  "apps/merchant/mobile/lib",
]) {
  for (const file of listWorkspaceFiles([root]).filter((candidate) => sourceExtensions.has(path.extname(candidate)))) {
    const source = readFile(file);
    reporter.assert(!source.includes("cname.vercel-dns.com"), `${file} must not hardcode Vercel's CNAME target`);
  }
}

reporter.finish("custom-domain target is LetBuyy-owned, env-driven, and source-clean");
