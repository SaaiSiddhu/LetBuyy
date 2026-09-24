import { createReporter, readFile } from "./governance-common.mjs";

const reporter = createReporter("Secret topology validator");

const stagingDeploy = readFile(".github/workflows/staging-deploy.yml");
const productionDeploy = readFile(".github/workflows/production-deploy.yml");
const setSecrets = readFile("scripts/github/set-secrets.mjs");
const consoleSession = readFile("apps/internal/console/src/lib/console-session.ts");

// --- set-secrets.mjs: shared INTERNAL_API_SECRET must be retired ---
reporter.assert(
  !setSecrets.match(/generatedSecretSuffixes\s*=\s*\[[^\]]*"INTERNAL_API_SECRET"/s),
  "set-secrets.mjs must not list \"INTERNAL_API_SECRET\" in generatedSecretSuffixes (retired as shared global — use per-caller secrets)"
);

// --- set-secrets.mjs: INTERNAL_API_KEYRING must be in generatedSecretSuffixes ---
reporter.assert(
  setSecrets.includes('"INTERNAL_API_KEYRING"'),
  "set-secrets.mjs must include INTERNAL_API_KEYRING in generatedSecretSuffixes"
);

// --- set-secrets.mjs: per-caller suffix array must exist ---
reporter.assert(
  setSecrets.includes("perCallerInternalSecretSuffixes"),
  "set-secrets.mjs must declare perCallerInternalSecretSuffixes for HR-SECRET-ROTATION runbook"
);

// --- staging-deploy.yml: workers must use per-caller secrets ---
for (const [service, suffix] of [
  ["api-gateway",     "API_GATEWAY_INTERNAL_SECRET"],
  ["webhook-service", "WEBHOOK_SERVICE_INTERNAL_SECRET"],
  ["queue-workers",   "QUEUE_WORKERS_INTERNAL_SECRET"],
  ["mobile-bff",      "MOBILE_BFF_INTERNAL_SECRET"],
]) {
  reporter.assert(
    stagingDeploy.includes(`STAGING_${suffix}`),
    `staging-deploy.yml must reference STAGING_${suffix} for ${service}`
  );
}

// --- staging-deploy.yml: api-gateway must push INTERNAL_API_KEYRING ---
reporter.assert(
  stagingDeploy.includes("STAGING_INTERNAL_API_KEYRING"),
  "staging-deploy.yml must push STAGING_INTERNAL_API_KEYRING to api-gateway"
);

// --- production-deploy.yml: workers must use per-caller secrets ---
for (const [service, suffix] of [
  ["api-gateway",     "API_GATEWAY_INTERNAL_SECRET"],
  ["webhook-service", "WEBHOOK_SERVICE_INTERNAL_SECRET"],
  ["queue-workers",   "QUEUE_WORKERS_INTERNAL_SECRET"],
  ["mobile-bff",      "MOBILE_BFF_INTERNAL_SECRET"],
]) {
  reporter.assert(
    productionDeploy.includes(`PRODUCTION_${suffix}`),
    `production-deploy.yml must reference PRODUCTION_${suffix} for ${service}`
  );
}

// --- production-deploy.yml: api-gateway must push INTERNAL_API_KEYRING ---
reporter.assert(
  productionDeploy.includes("PRODUCTION_INTERNAL_API_KEYRING"),
  "production-deploy.yml must push PRODUCTION_INTERNAL_API_KEYRING to api-gateway"
);

// --- internal-auth.ts: keyring helpers must exist ---
const internalAuth = readFile("services/api-gateway/src/lib/internal-auth.ts");
for (const symbol of ["getInternalApiKeyring", "isLegacyAcceptEnabled", "getSecretsForCaller"]) {
  reporter.assert(
    internalAuth.includes(`export function ${symbol}`),
    `internal-auth.ts must export ${symbol} (B7a keyring model)`
  );
}

// --- internal-auth.ts: sunset comment must reference HR-SECRET-ROTATION ---
reporter.assert(
  internalAuth.includes("HR-SECRET-ROTATION"),
  "internal-auth.ts must include sunset comment referencing HR-SECRET-ROTATION"
);

// --- console-session.ts: AUTH_SECRET fallback must be removed ---
reporter.assert(
  !consoleSession.includes("process.env.AUTH_SECRET"),
  "apps/internal/console/src/lib/console-session.ts must not use process.env.AUTH_SECRET as a fallback (different security domain)"
);

reporter.finish("Secret topology: per-caller secrets, keyring provisioning, console session isolation checked");
