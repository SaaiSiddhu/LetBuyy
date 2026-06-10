import { createReporter, readJson } from "./governance-common.mjs";
import {
  assertNoOffenders,
  phaseBEntries,
  pushRegexOffenders,
} from "./phase-b-common.mjs";

const reporter = createReporter("One system per domain validator");
const productionTopology = readJson("config/runtime/production-topology.json");

const activeRoots = new Set((productionTopology?.runtimes || [])
  .filter((runtime) => runtime.status === "active")
  .map((runtime) => runtime.runtimeRoot));

for (const frozenRoot of [
  "apps/app-marketplace",
  "apps/developer-portal",
  "apps/theme-marketplace",
  "apps/platform-operations-portal",
]) {
  reporter.assert(!activeRoots.has(frozenRoot), `${frozenRoot} must not be active production authority`);
}

const duplicateAuthorityPattern =
  /\b(canonical|primary|sole|sourceOfTruth|source_of_truth|winner)\w*\s*(?:Money|Ledger|Identity|Checkout|Theme|Tenant|Event|Notification|Storefront)?\s*(?:System|Authority|Owner)?\s*=\s*['"][^'"]+['"]/g;
const offenders = [];
for (const entry of phaseBEntries(["apps", "services", "packages", "config"])) {
  if (!entry.extra) continue;
  pushRegexOffenders(
    offenders,
    entry,
    duplicateAuthorityPattern,
    () => "new canonical domain authority declarations must go through CANONICAL_SYSTEMS governance",
  );
}

assertNoOffenders(reporter, offenders, "Domain winners must remain single-source");
reporter.finish("canonical domain authority checked");
