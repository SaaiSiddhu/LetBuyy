import {
  assertNoOffenders,
  phaseBEntries,
  pushRegexOffenders,
} from "./phase-b-common.mjs";
import { createReporter, readFile } from "./governance-common.mjs";

const reporter = createReporter("No self-custody rail validator");
const offenders = [];
const hardcodedSelfCustodyPattern =
  /(return\s+['"]razorpayx['"]|(?:rail|payout_rail|provider)\s*[:=]\s*['"]razorpayx['"]|default\(\s*['"]razorpayx['"]\s*\)|(?:\?\?|\|\|)\s*['"]razorpayx['"])/g;

for (const entry of phaseBEntries(["apps", "services", "packages", "config"])) {
  pushRegexOffenders(
    offenders,
    entry,
    hardcodedSelfCustodyPattern,
    () => "hardcoded razorpayx self-custody rail is forbidden; use PA split rails such as razorpay_route/cashfree",
  );
}

assertNoOffenders(reporter, offenders, "Self-custody payout rails must not be hardcoded as defaults");

const residualRazorpayxEntries = phaseBEntries(["apps", "services", "packages", "database"], {
  includeTests: true,
}).filter((entry) => entry.text.includes("razorpayx"));

if (residualRazorpayxEntries.length > 0) {
  const skippedHumanDecisions = readFile("SKIPPED_HUMAN_DECISIONS.md");
  reporter.assert(
    skippedHumanDecisions.includes("SKIP-RAZORPAYX-ENUM-PURGE"),
    "Residual razorpayx contract/database values must carry the enum/check purge seam",
  );
}

reporter.finish("self-custody payout rail defaults and purge seam checked");
