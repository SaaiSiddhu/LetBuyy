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
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9_=-]{20,}/,
  /\bwhsec_[A-Za-z0-9_=-]{20,}/,
  /\brzp_(?:live|test)_[A-Za-z0-9_=-]{8,}/,
  /\bAIza[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
];

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

  if (secretPatterns.some((pattern) => pattern.test(content)) || hasHardcodedSecretAssignment(content)) {
    secretOffenders.push(file);
  }
}

reporter.assert(
  secretOffenders.length === 0,
  `Tracked files contain secret-like values and must be redacted or moved to the secret store: ${secretOffenders.slice(0, 20).join(", ")}`,
);

reporter.finish(`${trackedFiles.length} tracked files scanned`);
