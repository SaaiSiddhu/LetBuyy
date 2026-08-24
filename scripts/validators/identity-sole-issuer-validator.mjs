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

// N1/N3: Supabase Auth (GoTrue) itself is a second, independent token
// issuer -- a route that calls these methods mints a real Supabase
// session, which is exactly the "legacy Supabase /auth/*" surface ART-05
// requires to collapse into identity-platform. Phase N1 removed
// routes/auth.ts's 7 GoTrue-minting handlers; Phase N3 removed
// routes/employee.ts's last 2 (/auth/login, /auth/accept-invite) and the
// supabase-bearer token-acceptance path. No allowlist remains -- ART-05
// is satisfied, and this check now forbids GoTrue session minting under
// services/api-gateway/src/routes/ unconditionally.
const gotrueMintingPattern = /\bsupabase\.auth\.(?:signInWithPassword|signInWithOtp|verifyOtp|signOut|resetPasswordForEmail|updateUser|admin\.createUser)\s*\(/g;
const gotrueOffenders = [];
for (const entry of phaseBEntries(["services"], { filePattern: /\.ts$/ })) {
  if (!entry.path.startsWith("services/api-gateway/src/routes/")) continue;

  pushRegexOffenders(
    gotrueOffenders,
    entry,
    gotrueMintingPattern,
    () => "Supabase Auth (GoTrue) session minting is a second token issuer, forbidden by ART-05 -- identity-platform is the sole issuer",
  );
}
assertNoOffenders(reporter, gotrueOffenders, "No gateway route may mint a Supabase Auth session; identity-platform is the sole issuer");

const skippedHumanDecisions = readFile("SKIPPED_HUMAN_DECISIONS.md");
const capabilityBacklog = readFile("CAPABILITY_BACKLOG.md");
const gatewayAuthRoute = readFile("services/api-gateway/src/routes/auth.ts");
const legacyAuthCore = readFile("packages/auth-core/src/index.ts");
const gatewayIdentityMock = readFile("services/api-gateway/src/identity-foundation/mock-key-service.ts");
const operationsScaffold = readFile("services/api-gateway/src/identity-foundation/operations-scaffold.ts");
const tokenCoreAgents = readFile("packages/token-core/AGENTS.md");

reporter.assert(!operationsScaffold.includes("mode: 'mock'"), "identity operations scaffold must not emit mock mode labels");
reporter.assert(operationsScaffold.includes("mode: 'scaffold'"), "identity operations scaffold must label dormant metric hooks as scaffold");
reporter.assert(!tokenCoreAgents.includes("Mock signing"), "token-core AGENTS must not authorize mock signing");
reporter.assert(
  tokenCoreAgents.includes("Sandbox signing is allowed only for dormant/local runtime implementations"),
  "token-core AGENTS must constrain sandbox signing to dormant/local implementations",
);

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
