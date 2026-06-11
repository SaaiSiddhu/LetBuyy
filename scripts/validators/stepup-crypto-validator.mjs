import {
  assertNoOffenders,
  phaseBEntries,
} from "./phase-b-common.mjs";
import { createReporter } from "./governance-common.mjs";

const reporter = createReporter("Step-up crypto validator");

const weakStepUpPatterns = [
  /step[_-]?up[\w.]*\.length\s*[><=]/i,
  /token\.trim\(\)\.length\s*[><=]/i,
  /typeof\s+token\s*===\s*['"]string['"][\s\S]{0,120}length\s*[><=]/i,
  /verified_at[\s\S]{0,160}Date\.parse[\s\S]{0,160}return\s+\{\s*ok:\s*true/i,
  /recorded-gap-step-up-/i,
];

const requiredSecurityControls = phaseBEntries(["services"])
  .find((entry) => entry.path === "services/api-gateway/src/lib/security-controls.ts");
const securityRoute = phaseBEntries(["services"])
  .find((entry) => entry.path === "services/api-gateway/src/routes/security.ts");

reporter.assert(
  requiredSecurityControls?.text.includes("verifySensitiveActionStepUp"),
  "security-controls must expose the shared sensitive-action step-up verifier",
);
reporter.assert(
  requiredSecurityControls?.text.includes("signSensitiveActionStepUp")
    && requiredSecurityControls?.text.includes("HMAC")
    && requiredSecurityControls?.text.includes("STEP_UP_SIGNING_SECRET_REQUIRED"),
  "security-controls must sign sensitive-action step-up tokens with HMAC evidence",
);
reporter.assert(
  Boolean(securityRoute?.text.includes("step_up_challenges")),
  "step-up challenge route must persist challenge evidence",
);
reporter.assert(
  Boolean(securityRoute?.text.includes("verifyTotpCode") && securityRoute?.text.includes("STEP_UP_SIGNING_SECRET")),
  "step-up challenge route must require TOTP proof and a configured signing secret",
);
reporter.assert(
  !securityRoute?.text.includes("recorded-gap-step-up-")
    && !securityRoute?.text.includes("mock-step-up-")
    && !securityRoute?.text.includes("mode: 'mock'")
    && !securityRoute?.text.includes("mode: 'recorded_gap'"),
  "step-up challenge route must not emit recorded-gap or mock-labelled security evidence",
);

const offenders = [];
for (const entry of phaseBEntries(["apps", "services", "packages"])) {
  for (const pattern of weakStepUpPatterns) {
    if (pattern.test(entry.text)) {
      offenders.push(`${entry.path}:1 weak string/timestamp step-up verification is forbidden`);
    }
  }
}

assertNoOffenders(reporter, offenders, "Sensitive refund/payout step-up must be cryptographic or challenge-backed");
reporter.finish("step-up crypto ratchet checked");
