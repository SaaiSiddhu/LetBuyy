import path from "node:path";
import {
  createReporter,
  extractSpecifiers,
  getTrackedFiles,
  listWorkspaceFiles,
  packageRootForManifest,
  readFile,
  readJson,
  rootForFile,
  sourceExtensions,
} from "./governance-common.mjs";

const reporter = createReporter("Provider isolation validator");
const files = [...new Set([...getTrackedFiles(), ...listWorkspaceFiles()])].sort();
const allowedProviderRoots = new Set([
  "packages/infrastructure",
  "packages/lcis-adapters",
  // services/compatibility/* — bounded, non-deployed bridges (Stage 5, Phase M,
  // 2026-09-02); verbatim copies of foreign systems, not wired into any
  // canonical ACTIVE runtime. See governance-common.mjs's compatibilityBridgeRoots.
  // rootForFile() only returns the first two path segments for services/*, so
  // "services/compatibility" covers every source-file check; packageRootForManifest()
  // returns the literal package.json's own dirname, so the four package roots are
  // also listed for the manifest-dependency check.
  "services/compatibility",
  "services/compatibility/firebase_bridge",
  "services/compatibility/agrimore_bridge/api-gateway",
  "services/compatibility/agrimore_bridge/media-gateway",
  "services/compatibility/agrimore_bridge/realtime-gateway",
]);

const providerPackagePrefixes = [
  "@supabase/supabase-js",
  "@supabase/ssr",
  "stripe",
  "@stripe/",
  "resend",
  "@upstash/",
  "@paypal/",
  "paypal",
  "razorpay",
  "firebase",
  "firebase/",
  "algoliasearch",
  "meilisearch",
  "ioredis",
  "redis",
  "@aws-sdk/",
  "aws-sdk",
  "cloudflare",
  "posthog",
  "mixpanel",
  "segment",
];

const providerUrlPatterns = [
  /https:\/\/api\.razorpay\.com\//,
  /https:\/\/api-m(?:\.sandbox)?\.paypal\.com\//,
  /https:\/\/api\.stripe\.com\//,
  /https:\/\/api\.resend\.com\//,
  /https:\/\/api\.cloudflare\.com\//,
  /https:\/\/[^"']*\.r2\.cloudflarestorage\.com\//,
  /https:\/\/s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com\//,
  /https:\/\/[^"']*supabase\.co\/rest\/v1\//,
];

function isProviderSpecifier(specifier) {
  return providerPackagePrefixes.some((prefix) => specifier === prefix || specifier.startsWith(prefix));
}

function providerDependencyNames(packageJson) {
  const blocks = [
    packageJson?.dependencies,
    packageJson?.devDependencies,
    packageJson?.peerDependencies,
    packageJson?.optionalDependencies,
  ];

  return blocks.flatMap((block) => Object.keys(block ?? {}).filter(isProviderSpecifier));
}

function isInfrastructureSpecifier(specifier) {
  return specifier === "@letbuyy/infrastructure" || specifier.startsWith("@letbuyy/infrastructure/");
}

for (const file of files.filter((candidate) => sourceExtensions.has(path.extname(candidate)) && path.extname(candidate) !== ".dart")) {
  const ownerRoot = rootForFile(file);
  if (allowedProviderRoots.has(ownerRoot)) continue;
  if (!file.startsWith("apps/") && !file.startsWith("services/") && !file.startsWith("packages/")) continue;

  const content = readFile(file);
  for (const specifier of extractSpecifiers(content)) {
    if (ownerRoot.startsWith("apps/") && isInfrastructureSpecifier(specifier)) {
      reporter.errors.push(`Apps must not import infrastructure adapters directly: ${file} -> ${specifier}`);
    }

    if (isProviderSpecifier(specifier)) {
      reporter.errors.push(`Provider SDK imports must use packages/infrastructure adapters: ${file} -> ${specifier}`);
    }
  }

  for (const pattern of providerUrlPatterns) {
    if (pattern.test(content)) {
      reporter.errors.push(`Provider API URL usage must use packages/infrastructure adapters: ${file}`);
    }
  }
}

for (const file of files.filter((candidate) => candidate.endsWith("/package.json") && candidate !== "package.json")) {
  const ownerRoot = packageRootForManifest(file);
  if (allowedProviderRoots.has(ownerRoot)) continue;
  if (!ownerRoot.startsWith("apps/") && !ownerRoot.startsWith("services/") && !ownerRoot.startsWith("packages/")) continue;

  const offenders = providerDependencyNames(readJson(file));
  if (offenders.length > 0) {
    reporter.errors.push(`Provider SDK dependencies must live in packages/infrastructure: ${file} declares ${offenders.join(", ")}`);
  }

  const json = readJson(file);
  if (ownerRoot.startsWith("apps/") && Object.keys(json?.dependencies ?? {}).some(isInfrastructureSpecifier)) {
    reporter.errors.push(`Apps must not declare infrastructure adapter dependencies directly: ${file}`);
  }
}

reporter.finish(`${files.length} workspace files scanned for provider isolation`);
