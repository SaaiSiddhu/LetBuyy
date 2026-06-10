import {
  assertNoOffenders,
  phaseBEntries,
  pushRegexOffenders,
} from "./phase-b-common.mjs";
import { createReporter } from "./governance-common.mjs";

const reporter = createReporter("Identity sole issuer validator");

const legacyAllowedUntilD3 = new Set([
  "packages/auth-core/src/index.ts",
  "packages/auth-core/src/customer-session.ts",
  "packages/auth-core/src/storefront-access.ts",
  "services/api-gateway/src/identity-foundation/mock-key-service.ts",
]);

const signingPatterns = [
  /\bnew\s+SignJWT\b/g,
  /\bjwt\.sign\s*\(/g,
  /setProtectedHeader\(\s*\{\s*alg:\s*['"]HS(?:256|384|512)['"]/g,
  /\bAUTH_SECRET\b[\s\S]{0,160}\b(sign|signature|jwt|token)\b/gi,
];

const offenders = [];
for (const entry of phaseBEntries(["apps", "services", "packages"])) {
  if (entry.path.startsWith("apps/identity-platform/") && !entry.extra) continue;
  if (legacyAllowedUntilD3.has(entry.path) && !entry.extra) continue;

  for (const pattern of signingPatterns) {
    pushRegexOffenders(
      offenders,
      entry,
      pattern,
      () => "token signing outside apps/identity-platform is forbidden",
    );
  }
}

assertNoOffenders(reporter, offenders, "Identity Platform must remain the only token issuer");
reporter.finish("identity issuer ratchet checked");
