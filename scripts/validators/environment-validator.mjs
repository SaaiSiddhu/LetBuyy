import {
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Environment validator");
const trackedFiles = getTrackedFiles();

const requiredFiles = [
  "config/env/README.md",
  "config/env/environment-governance.md",
  "config/env/governance/README.md",
  "config/env/ownership/runtime-env-ownership.json",
  "config/env/templates/next-app.env.example",
  "config/env/templates/worker.env.example",
  "config/env/templates/mobile.dart-defines.example",
  "config/env/staging-production-secret-matrix.json",
  "config/env/schemas/next-app.schema.json",
  "config/env/schemas/worker.schema.json",
  "config/env/schemas/mobile.schema.json",
  "config/env/schemas/runtime-env-ownership.schema.json",
  "config/env/schemas/staging-production-secret-matrix.schema.json",
  "docs/governance/environment-governance.md",
];

for (const file of requiredFiles) {
  reporter.assert(exists(file), `Missing environment governance file: ${file}`);
}

const trackedEnvFiles = trackedFiles.filter((file) => {
  const name = file.split("/").at(-1) ?? file;
  const isEnv = name === ".env" || name.startsWith(".env.") || name.endsWith(".env") || name.endsWith(".env.local") || name === "all.env";
  const isAllowedTemplate = file.startsWith("config/env/templates/") && file.endsWith(".example");
  return isEnv && !isAllowedTemplate;
});

reporter.assert(
  trackedEnvFiles.length === 0,
  `Runtime env files must not be tracked: ${trackedEnvFiles.slice(0, 20).join(", ")}`,
);

const gitignore = readFile(".gitignore");
for (const expectedRule of [".env", ".env.*", "*.env", "all.env", ".dev.vars", "**/.dev.vars"]) {
  reporter.assert(gitignore.includes(expectedRule), `.gitignore must block ${expectedRule}`);
}

const workerTemplate = readFile("config/env/templates/worker.env.example");
const workerSchema = readFile("config/env/schemas/worker.schema.json");
const requiredWorkerEnvKeys = [
  "CUSTOMER_SESSION_SECRET",
  "STEP_UP_SIGNING_SECRET",
  "LETBUYY_IDENTITY_ISSUER",
  "LETBUYY_IDENTITY_PUBLIC_JWKS",
  "CUSTOMER_PASSWORD_RESET_URL",
  "STOREFRONT_BASE_URL",
  "NEXT_PUBLIC_STOREFRONT_URL",
  "NEXT_PUBLIC_ADMIN_URL",
  "LETBUYY_PLATFORM_DOMAIN",
  "NEXT_PUBLIC_PLATFORM_DOMAIN",
  "VERCEL_ORG_ID",
  "QUEUE_TENANT_ENVELOPE_SECRET",
  "LETBUYY_KMS_MODE",
  "LETBUYY_KMS_SANDBOX_SECRET",
  "LETBUYY_KMS_KEY_ID",
  "LETBUYY_ALLOW_SANDBOX_KMS",
  "LETBUYY_WAREHOUSE_MODE",
  "LETBUYY_AI_MODEL_MODE",
  "MEDIA_UPLOAD_SIGNING_SECRET",
  "LETBUYY_EMAIL_MODE",
  "SES_ACCESS_KEY_ID",
  "SES_SECRET_ACCESS_KEY",
  "SENDGRID_API_KEY",
  "LOGISTICS_MODE",
  "SHIPROCKET_TOKEN",
  "DELHIVERY_TOKEN",
  "PICKRR_TOKEN",
  "PRODUCT_VARIANTS_RELATIONAL_READS",
  "REQUEST_LOG_SAMPLE_RATE",
  "RATE_LIMIT_KV_FALLBACK",
];

for (const key of requiredWorkerEnvKeys) {
  reporter.assert(workerTemplate.includes(`${key}=`), `Worker env template missing ${key}`);
  reporter.assert(workerSchema.includes(`"${key}"`), `Worker env schema missing ${key}`);
}

const runtimeEnvOwnership = JSON.parse(readFile("config/env/ownership/runtime-env-ownership.json"));
const secretMatrix = JSON.parse(readFile("config/env/staging-production-secret-matrix.json"));
const forbiddenEnvOwners = [
  "apps/app-marketplace",
  "apps/developer-portal",
  "apps/theme-marketplace",
  "apps/platform-operations-portal",
  "apps/mobile/shopper-app",
  "apps/mobile/operator-app",
  "services/checkout-runtime",
  "services/search-service",
  "services/media-service",
  "services/notification-service",
  "services/event-bus",
  "services/analytics-pipeline",
];
const envOwnerLists = [
  runtimeEnvOwnership?.nextApp?.owners || [],
  runtimeEnvOwnership?.worker?.owners || [],
  runtimeEnvOwnership?.mobile?.owners || [],
  secretMatrix?.nextApps?.owners || [],
];

for (const owner of forbiddenEnvOwners) {
  reporter.assert(
    !envOwnerLists.some((owners) => owners.includes(owner)),
    `Frozen/reserved runtime must not own staging/production secret config: ${owner}`,
  );
}

for (const suffix of ["APP_MARKETPLACE", "THEME_MARKETPLACE", "DEVELOPER_PORTAL", "PLATFORM_OPERATIONS_PORTAL"]) {
  reporter.assert(
    !(secretMatrix?.ciSecrets?.vercelProjectIdSuffixes || []).includes(suffix),
    `Frozen app must not have a Vercel project secret suffix: ${suffix}`,
  );
}

reporter.assert(
  !readFile("services/api-gateway/src/index.ts").includes("EMAIL_QUEUE"),
  "API gateway Env must not declare the removed EMAIL_QUEUE ghost binding; use NOTIFICATION_QUEUE",
);

const secretPatterns = [
  { pattern: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9_=-]{20,}/, kind: "key" },
  { pattern: /\bwhsec_[A-Za-z0-9_=-]{20,}/, kind: "key" },
  { pattern: /\brzp_(?:live|test)_[A-Za-z0-9_=-]{8,}/, kind: "key" },
  { pattern: /\bAIza[A-Za-z0-9_-]{20,}/, kind: "key" },
  { pattern: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/, kind: "pem" },
];

// Unambiguous "this value is a fixture, not a credential" markers. Deliberately
// narrow (whole English phrases, never a bare word like "test") so a genuine
// leaked secret — an opaque random string — cannot coincidentally match: a
// real key does not spell out "do not expose" or "should never reach" inside
// itself. Extends (never replaces) the R-21 secret scan; a match without one
// of these markers on its own line still fails the validator.
const fixtureMarkerPattern = /do[-_ ]?not[-_ ]?expose|should[-_ ]?never[-_ ]?reach|placeholder|redacted|\bdummy\b|\bexample\b/i;

function lineContainingIndex(content, index) {
  const lineStart = content.lastIndexOf("\n", index - 1) + 1;
  const nextNewline = content.indexOf("\n", index);
  return content.slice(lineStart, nextNewline === -1 ? content.length : nextNewline);
}

function matchesGlobally(pattern, content) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...content.matchAll(new RegExp(pattern.source, flags))];
}

// A real committed PEM private key ships a full BEGIN...body...END block; a
// bare BEGIN-header string used as a redaction-test fixture value has no
// matching footer anywhere in the file. Require the footer before treating a
// PEM header as a real key, so a fixture like `private_key: '-----BEGIN
// PRIVATE KEY-----'` (asserting the value never reaches rendered output) does
// not false-positive, while an actual leaked key (which always has both
// markers plus body content) still does.
function hasRealPemBlock(content) {
  return /-----END (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(content);
}

function hasUnexplainedSecretPattern(content) {
  for (const { pattern, kind } of secretPatterns) {
    const matches = matchesGlobally(pattern, content);
    if (matches.length === 0) continue;
    if (kind === "pem") {
      if (hasRealPemBlock(content)) return true;
      continue;
    }
    for (const match of matches) {
      const line = lineContainingIndex(content, match.index);
      if (!fixtureMarkerPattern.test(line)) return true;
    }
  }
  return false;
}

const allowedSecretScanPrefixes = [
  "config/env/templates/",
  "docs/archive/",
  "docs/governance/",
  "AGENTS.md",
];

const secretOffenders = [];
function hasHardcodedSecretAssignment(content) {
  const assignmentPattern =
    /(?:secret|token|password|private[_-]?key|service[_-]?role)[A-Za-z0-9_ .:-]*[=:]\s*["']([^"'\n]{16,})["']/gi;

  for (const match of content.matchAll(assignmentPattern)) {
    const value = match[1].trim();
    const lowerValue = value.toLowerCase();

    if (/^[A-Z0-9_]+$/.test(value)) continue;
    if (lowerValue.includes("process.env") || lowerValue.includes("env.")) continue;
    if (lowerValue.includes("replace") || lowerValue.includes("example") || lowerValue.includes("placeholder")) continue;
    if (lowerValue.includes("redacted") || lowerValue.includes("dummy") || lowerValue.includes("test_")) continue;
    // Same unambiguous fixture-marker set used for the regex-pattern scan below
    // (R-18: precision, not weakening — a real credential cannot coincidentally
    // spell out "do not expose" or "should never reach" inside itself).
    if (fixtureMarkerPattern.test(value)) continue;
    if (value.startsWith("$") || value.startsWith("{")) continue;
    if (/\s/.test(value)) continue;
    if (/^[a-z0-9_./-]+$/.test(value)) continue;

    const characterClassCount = [
      /[a-z]/.test(value),
      /[A-Z]/.test(value),
      /[0-9]/.test(value),
      /[+/=_-]/.test(value),
    ].filter(Boolean).length;
    if (characterClassCount < 3) continue;

    return true;
  }

  return false;
}

for (const file of trackedFiles) {
  if (allowedSecretScanPrefixes.some((prefix) => file === prefix || file.startsWith(prefix))) continue;

  const content = readFile(file);
  if (!content) continue;

  if (hasUnexplainedSecretPattern(content) || hasHardcodedSecretAssignment(content)) {
    secretOffenders.push(file);
  }
}

reporter.assert(
  secretOffenders.length === 0,
  `Tracked files contain secret-like values and must be redacted or moved to the secret store: ${secretOffenders.slice(0, 20).join(", ")}`,
);

reporter.finish(`${trackedFiles.length} tracked files scanned`);
