import {
  createReporter,
  getTrackedFiles,
  readFile,
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
  `Active source must not hardcode staging/retired LetBuyy production defaults: ${offenders.slice(0, 20).join(", ")}`,
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
    !uploadRoute.includes("cdn-staging.letbuyy.store"),
  "Upload route must require ASSET_PUBLIC_BASE_URL outside production instead of defaulting to staging CDN",
);

const gatewayCors = readFile("services/api-gateway/src/lib/cors.ts");
reporter.assert(
  !gatewayCors.includes("staging.letbuyy.store"),
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

reporter.finish(`${trackedFiles.filter(isActiveSource).length} active source files checked for environment honesty`);
