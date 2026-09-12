import {
  createReporter,
  getTrackedFiles,
  readFile,
  formatOffenderList,
} from "./governance-common.mjs";

const reporter = createReporter("Environment honesty validator");
const trackedFiles = getTrackedFiles();

const activeSourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".dart",
]);

const forbiddenActiveSourcePatterns = [
  { label: "staging LetBuyy URL default", pattern: /https:\/\/(?:[a-z0-9-]+\.)?staging\.letbuyy\.store\b/ },
  { label: "staging CDN URL default", pattern: /https:\/\/cdn-staging\.letbuyy\.store\b/ },
];

function extensionOf(file) {
  const index = file.lastIndexOf(".");
  return index === -1 ? "" : file.slice(index);
}

function isActiveSource(file) {
  if (
    !(
      file.startsWith("apps/") ||
      file.startsWith("packages/") ||
      file.startsWith("services/")
    )
  ) {
    return false;
  }

  if (!activeSourceExtensions.has(extensionOf(file))) return false;
  if (file.includes("/test/") || file.includes("/tests/")) return false;
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) return false;
  return true;
}

const offenders = [];
for (const file of trackedFiles.filter(isActiveSource)) {
  const content = readFile(file);
  for (const { label, pattern } of forbiddenActiveSourcePatterns) {
    if (pattern.test(content)) {
      offenders.push(`${file} (${label})`);
      break;
    }
  }
}

reporter.assert(
  offenders.length === 0,
  `Active source must not hardcode staging/retired LetBuyy production defaults: ${formatOffenderList(offenders, 20)}`,
);

const identityClient = readFile("apps/identity-platform/src/lib/api/client.ts");
reporter.assert(
  identityClient.includes("Identity API base URL is not configured"),
  "Identity API client must fail loudly without an API URL outside production",
);

const operationsClient = readFile("apps/platform-operations-portal/src/lib/api/client.ts");
reporter.assert(
  operationsClient.includes("Platform operations API base URL is not configured"),
  "Platform operations API client must fail loudly without an API URL outside production",
);

const uploadRoute = readFile("services/api-gateway/src/routes/upload.ts");
reporter.assert(
  uploadRoute.includes("Public asset base URL is not configured") &&
    !uploadRoute.includes("cdn-staging.letbuyy.com"),
  "Upload route must require ASSET_PUBLIC_BASE_URL outside production instead of defaulting to staging CDN",
);

const gatewayCors = readFile("services/api-gateway/src/lib/cors.ts");
reporter.assert(
  !gatewayCors.includes("staging.letbuyy.com"),
  "Gateway fixed credentialed CORS origins must not hardcode staging origins; use CORS_CREDENTIAL_ORIGINS",
);

const mobileTemplate = readFile("config/env/templates/mobile.dart-defines.example");
const mobileSchema = readFile("config/env/schemas/mobile.schema.json");
for (const key of ["GEMINI_API_KEY", "GEMINI_BASE_URL", "GEMINI_MODEL"]) {
  reporter.assert(mobileTemplate.includes(`${key}=`), `Mobile env template missing ${key}`);
  reporter.assert(mobileSchema.includes(`"${key}"`), `Mobile env schema missing ${key}`);
}

const nextTemplate = readFile("config/env/templates/next-app.env.example");
const nextSchema = readFile("config/env/schemas/next-app.schema.json");
for (const key of ["NEXT_PUBLIC_MARKETING_URL", "NEXT_PUBLIC_THEME_MARKETPLACE_URL", "STOREFRONT_FRAME_ANCESTORS"]) {
  reporter.assert(nextTemplate.includes(`${key}=`), `Next app env template missing ${key}`);
  reporter.assert(nextSchema.includes(`"${key}"`), `Next app env schema missing ${key}`);
}

const apiWrangler = readFile("services/api-gateway/wrangler.toml");
const queueWrangler = readFile("services/queue-workers/wrangler.toml");
const livePlaceholderPairs = [
  {
    label: "AI provider",
    pattern: /AI_PROVIDER_MODE = "live"[\s\S]*AI_PROVIDER_MODEL = "SKIP_NEEDS_HUMAN_AI_PROVIDER_MODEL"/,
  },
  {
    label: "AI credit purchase",
    pattern: /AI_CREDIT_PURCHASE_MODE = "live"[\s\S]*AI_CREDIT_RAZORPAY_KEY_ID = "SKIP_NEEDS_HUMAN_AI_CREDIT_RAZORPAY_KEY_ID"/,
  },
  {
    label: "WhatsApp provider",
    pattern: /WHATSAPP_PROVIDER_MODE = "live"[\s\S]*TWILIO_ACCOUNT_SID = "SKIP_NEEDS_HUMAN_TWILIO_ACCOUNT_SID"/,
  },
];

for (const { label, pattern } of livePlaceholderPairs) {
  reporter.assert(!pattern.test(apiWrangler), `${label} must not be labelled live while human-secret placeholders remain`);
}

reporter.assert(
  !/PUSH_DISPATCH_MODE = "live"[\s\S]*SKIP_NEEDS_HUMAN_PUSH_/.test(queueWrangler),
  "Queue worker push dispatch must not be labelled live while human-secret placeholders remain",
);

reporter.finish(`${trackedFiles.filter(isActiveSource).length} active source files checked for environment honesty`);
