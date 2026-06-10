import {
  assertNoOffenders,
  phaseBEntries,
  pushRegexOffenders,
} from "./phase-b-common.mjs";
import { createReporter, readFile } from "./governance-common.mjs";

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

const skippedHumanDecisions = readFile("SKIPPED_HUMAN_DECISIONS.md");
const capabilityBacklog = readFile("CAPABILITY_BACKLOG.md");
const gatewayAuthRoute = readFile("services/api-gateway/src/routes/auth.ts");
const legacyAuthCore = readFile("packages/auth-core/src/index.ts");
const gatewayIdentityMock = readFile("services/api-gateway/src/identity-foundation/mock-key-service.ts");
const operationsScaffold = readFile("services/api-gateway/src/identity-foundation/operations-scaffold.ts");

reporter.assert(!operationsScaffold.includes("mode: 'mock'"), "identity operations scaffold must not emit mock mode labels");
reporter.assert(operationsScaffold.includes("mode: 'scaffold'"), "identity operations scaffold must label dormant metric hooks as scaffold");

const legacySessionResidue =
  gatewayAuthRoute.includes("randomHex(32)") ||
  gatewayAuthRoute.includes("localAuthSessions") ||
  legacyAuthCore.includes("HS256") ||
  gatewayIdentityMock.includes("AUTH_SECRET");

if (legacySessionResidue) {
  reporter.assert(
    skippedHumanDecisions.includes("SKIP-IDN-R2-DRAIN-TELEMETRY"),
    "Residual gateway/HS256 identity scaffolding must carry the IDN-R2 drain telemetry seam before deletion",
  );
  reporter.assert(
    capabilityBacklog.includes("CAP-C07"),
    "Residual gateway/HS256 identity scaffolding must remain visible in CAP-C07 until OIDC/revocation/HS256 drain ships",
  );
}

reporter.finish("identity issuer ratchet and drain seam checked");
