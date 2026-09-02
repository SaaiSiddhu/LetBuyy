import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("API client runtime base validator");

const apiClientSource = readFile("packages/typescript/api-client/src/index.ts");
for (const symbol of [
  "LETBUYY_PRODUCTION_API_BASE_URL",
  "normalizeLetbuyyApiBaseUrl",
  "resolveLetbuyyApiBaseUrl",
  "apiClientInputToLetbuyyApiPath",
]) {
  reporter.assert(
    apiClientSource.includes(`export ${symbol}`) || apiClientSource.includes(`export function ${symbol}`) || apiClientSource.includes(`export const ${symbol}`),
    `@letbuyy/api-client must export ${symbol}`,
  );
}
reporter.assert(
  !apiClientSource.includes("process.env"),
  "@letbuyy/api-client URL helpers must remain framework-free and caller-injected",
);

const baseWrapperFiles = [
  "apps/merchant_web/src/lib/api/client.ts",
  "apps/customer_web/src/lib/api/client.ts",
  "apps/customer_web/src/lib/api/browser-client.ts",
  "apps/identity-platform/src/lib/api/client.ts",
  "apps/app-marketplace/src/lib/api/client.ts",
  "apps/theme-marketplace/src/lib/api/client.ts",
  "apps/admin_web/src/lib/console-api.ts",
  "apps/platform-operations-portal/src/lib/api/client.ts",
  "apps/marketing-site/src/app/[locale]/create/page.tsx",
];

for (const file of baseWrapperFiles) {
  const source = readFile(file);
  reporter.assert(
    source.includes("resolveLetbuyyApiBaseUrl") && source.includes("@letbuyy/api-client"),
    `${file} must use the shared API base URL resolver`,
  );
  reporter.assert(
    !/\bfunction\s+get(?:Public)?ApiBaseUrl\b/.test(source),
    `${file} must not reintroduce an app-local getApiBaseUrl helper`,
  );
  reporter.assert(
    !/\bDEFAULT_(?:PRODUCTION_)?API_BASE_URL\b/.test(source),
    `${file} must not own a local default API base URL constant`,
  );
  reporter.assert(
    !/pathname\.replace\(\s*\/\\\/\$\/\s*,\s*['"]{2}\s*\)/.test(source) && !/path\.endsWith\(['"]\/v1['"]\)/.test(source),
    `${file} must not reimplement /v1 path normalization`,
  );
}

for (const file of [
  "apps/merchant_web/src/lib/api/client.ts",
  "apps/customer_web/src/lib/api/client.ts",
]) {
  const source = readFile(file);
  reporter.assert(
    source.includes("apiClientInputToLetbuyyApiPath"),
    `${file} must use the shared API client input path converter`,
  );
  reporter.assert(
    !/\bfunction\s+apiClientInputTo[A-Za-z]+ApiPath\b/.test(source),
    `${file} must not reimplement API client input path conversion`,
  );
}

const marketingPackage = readJson("apps/marketing-site/package.json");
reporter.assert(
  marketingPackage?.dependencies?.["@letbuyy/api-client"] === "workspace:*",
  "marketing-site must declare @letbuyy/api-client when using shared API base helpers",
);

const marketingManifest = readJson("apps/marketing-site/runtime.manifest.json");
reporter.assert(
  marketingManifest?.allowedDependencies?.workspacePackages?.includes("@letbuyy/api-client"),
  "marketing-site runtime manifest must allow @letbuyy/api-client",
);

reporter.finish("app API base URL and API-client path helpers are single-sourced through @letbuyy/api-client");
