import {
  assertNoOffenders,
  phaseBEntries,
} from "./phase-b-common.mjs";
import { createReporter } from "./governance-common.mjs";

const reporter = createReporter("Step-up crypto validator");

const legacyAllowedUntilD5 = new Set([
  "services/api-gateway/src/lib/security-controls.ts",
]);

const weakStepUpPatterns = [
  /step[_-]?up[\w.]*\.length\s*[><=]/i,
  /token\.trim\(\)\.length\s*[><=]/i,
  /typeof\s+token\s*===\s*['"]string['"][\s\S]{0,120}length\s*[><=]/i,
  /verified_at[\s\S]{0,160}Date\.parse[\s\S]{0,160}return\s+\{\s*ok:\s*true/i,
];

const requiredSecurityControls = phaseBEntries(["services"])
  .find((entry) => entry.path === "services/api-gateway/src/lib/security-controls.ts");

reporter.assert(
  requiredSecurityControls?.text.includes("verifySensitiveActionStepUp"),
  "security-controls must expose the shared sensitive-action step-up verifier",
);
reporter.assert(
  phaseBEntries(["services"]).some((entry) => entry.path === "services/api-gateway/src/routes/security.ts" && entry.text.includes("step_up_challenges")),
  "step-up challenge route must persist challenge evidence",
);

const offenders = [];
for (const entry of phaseBEntries(["apps", "services", "packages"])) {
  if (legacyAllowedUntilD5.has(entry.path) && !entry.extra) continue;
  for (const pattern of weakStepUpPatterns) {
    if (pattern.test(entry.text)) {
      offenders.push(`${entry.path}:1 weak string/timestamp step-up verification is forbidden`);
    }
  }
}

assertNoOffenders(reporter, offenders, "Sensitive refund/payout step-up must be cryptographic or challenge-backed");
reporter.finish("step-up crypto ratchet checked");
