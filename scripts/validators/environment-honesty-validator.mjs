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

const identityClient = readFile("apps/platform/identity/src/lib/api/client.ts");
reporter.assert(
  identityClient.includes("Identity API base URL is not configured"),
  "Identity API client must fail loudly without an API URL outside production",
);

const operationsClient = readFile("apps/frozen/operations-portal/src/lib/api/client.ts");
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
// Native builds must never receive provider credentials/model configuration.
// Buyer purpose/profile/caps live only at the canonical server boundary.
export function buyerAiConfigurationProblems(input) {
  const problems = [];
  for (const key of ["GEMINI_API_KEY", "GEMINI_BASE_URL", "GEMINI_MODEL", "BUYER_AI_API_KEY", "BUYER_AI_PROFILE", "BUYER_AI_FINGERPRINT_KEY"]) {
    if (input.mobileTemplate.includes(key) || input.mobileSchema.includes(key)) problems.push(`Native provider configuration is forbidden: ${key}`);
  }
  if (/gemini_config|GeminiConfig/.test(input.coreExports)) problems.push("Native core must not export retired provider configuration");
  if (/google_generative_ai|GenerativeModel|GEMINI_(API_KEY|BASE_URL|MODEL)|generativelanguage\.googleapis\.com|generateContent/.test(input.nativeSource)) problems.push("Native source must not contain provider key/model/endpoint or SDK calls");
  let worker;
  try { worker = JSON.parse(input.workerSchema); } catch { problems.push("Worker schema must be valid"); return problems; }
  const required = ["BUYER_AI_PROFILE", "BUYER_AI_API_KEY", "BUYER_AI_FINGERPRINT_KEY"];
  const gated = worker.allOf?.some(rule => rule.if?.properties?.BUYER_AI_ENABLED?.const === "true" &&
    required.every(key => rule.then?.required?.includes(key)));
  if (!gated) problems.push("Enabled buyer AI must require server-only profile and secrets");
  const profile = worker.$defs?.BuyerAiProfile;
  if (profile?.properties?.approved?.const !== true || profile?.properties?.purpose?.const !== "buyer_shopping_public" ||
      profile?.properties?.content_scope?.const !== "submitted_message_and_visible_chat") problems.push("Buyer AI must require its explicitly approved purpose/content profile");
  for (const cap of ["requests_per_day", "token_bound_per_day", "max_input_bytes", "max_output_tokens", "timeout_ms", "input_token_bound_per_byte", "input_framing_token_bound"]) {
    const limit = profile?.properties?.[cap];
    if (!profile?.required?.includes(cap) || limit?.type !== "integer" || !(limit.minimum > 0) || !Number.isFinite(limit.maximum)) problems.push(`Buyer AI must require bounded server cap: ${cap}`);
  }
  return problems;
}
const buyerProblems = buyerAiConfigurationProblems({
  mobileTemplate, mobileSchema,
  coreExports: [readFile("packages/dart/core/lib/letbuyy_core.dart"), readFile("packages/dart/marketplace_core/lib/letbuyy_marketplace_core.dart")].join("\n"),
  nativeSource: [readFile("packages/dart/core/lib/src/config/gemini_config.dart"), readFile("packages/dart/marketplace_core/lib/src/config/gemini_config.dart"), readFile("packages/dart/marketplace_services/lib/src/ai_chat_service.dart")].join("\n"),
  workerSchema: readFile("config/env/schemas/worker.schema.json"),
});
for (const problem of buyerProblems) reporter.assert(false, problem);

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
