import {
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
  formatOffenderList,
} from "./governance-common.mjs";
import {
  SECRET_SCAN_EXCEPTIONS_PATH,
  exceptionMatches,
  exceptionRegistryProblems,
  findSecretLikeValues,
} from "./secret-scan-core.mjs";

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
  `Runtime env files must not be tracked: ${formatOffenderList(trackedEnvFiles)}`,
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
  "apps/frozen/app-store",
  "apps/frozen/developer-portal",
  "apps/frozen/theme-store",
  "apps/frozen/operations-portal",
  "apps/reserved/legacy-shopper-mobile",
  "apps/reserved/legacy-operator-mobile",
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

// R-21 secret scan. Every tracked file is scanned, documentation and donor source included: APPID-P2
// removed the docs/, AGENTS.md and config/env/templates/ prefix exemptions (the founder: "Do not exempt
// all documentation or Markdown from secret scanning"). A reviewed exception binds one exact value in
// one exact file through config/governance/secret-scan-exceptions.json; see secret-scan-core.mjs.
// Messages carry path, line and kind, never a value.
const trackedSet = new Set(trackedFiles);
let exceptionRegistry = null;
try {
  exceptionRegistry = JSON.parse(readFile(SECRET_SCAN_EXCEPTIONS_PATH));
} catch (error) {
  reporter.assert(false, `Secret-scan exception registry ${SECRET_SCAN_EXCEPTIONS_PATH} must exist and parse: ${error.message}`);
}
const exceptions = exceptionRegistry?.exceptions ?? [];
const registryProblems = exceptionRegistry ? exceptionRegistryProblems(exceptionRegistry, (file) => trackedSet.has(file)) : [];
reporter.assert(
  registryProblems.length === 0,
  `Secret-scan exception registry is malformed: ${formatOffenderList(registryProblems, 20, "; ")}`,
);

const unexcepted = [];
const usedExceptions = new Set();
for (const file of trackedFiles) {
  const content = readFile(file);
  if (!content) continue;
  for (const finding of findSecretLikeValues(content)) {
    const index = exceptions.findIndex((entry) => exceptionMatches(entry, file, finding));
    if (index === -1) unexcepted.push(`${file}:${finding.line} (${finding.kind})`);
    else usedExceptions.add(index);
  }
}

reporter.assert(
  unexcepted.length === 0,
  `Tracked files contain secret-like values and must be redacted or moved to the secret store: ${formatOffenderList(unexcepted)}`,
);

// Fails in the other direction too: an exception whose value has left its file is removed, not kept.
const staleExceptions = exceptions
  .map((entry, index) => ({ entry, index }))
  .filter(({ index }) => !usedExceptions.has(index))
  .map(({ entry }) => `${entry.path} (${entry.kind})`);
reporter.assert(
  staleExceptions.length === 0,
  `Secret-scan exceptions no longer match any value and must be removed: ${formatOffenderList(staleExceptions)}`,
);

reporter.finish(`${trackedFiles.length} tracked files scanned, ${exceptions.length} reviewed exceptions`);
