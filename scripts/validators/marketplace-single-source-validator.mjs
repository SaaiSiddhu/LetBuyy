import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Marketplace single-source validator");

const uiPackage = readJson("packages/typescript/ui/package.json");
reporter.assert(
  uiPackage?.exports?.["./logging"] === "./src/logging.ts",
  "@letbuyy/ui must expose the shared logging subpath",
);
reporter.assert(
  uiPackage?.exports?.["./marketplace"] === "./src/marketplace.tsx",
  "@letbuyy/ui must expose the shared marketplace UI subpath",
);

const loggingSource = readFile("packages/typescript/ui/src/logging.ts");
reporter.assert(
  /export function createStructuredLogger\b/.test(loggingSource),
  "@letbuyy/ui/logging must own createStructuredLogger",
);
reporter.assert(
  /app,\s*\n\s*message,\s*\n\s*timestamp: new Date\(\)\.toISOString\(\)/.test(loggingSource),
  "shared logger must emit app, message, and timestamp fields",
);

const marketplaceSource = readFile("packages/typescript/ui/src/marketplace.tsx");
reporter.assert(
  /export function MarketplaceUnavailable\b/.test(marketplaceSource),
  "@letbuyy/ui/marketplace must own the retryable unavailable component",
);
reporter.assert(
  /role="alert"/.test(marketplaceSource) && /aria-live="polite"/.test(marketplaceSource),
  "shared MarketplaceUnavailable must keep the accessible alert contract",
);

for (const file of [
  "apps/app-marketplace/src/lib/logger.ts",
  "apps/theme-marketplace/src/lib/logger.ts",
]) {
  const source = readFile(file);
  reporter.assert(
    source.includes("createStructuredLogger") && source.includes("@letbuyy/ui/logging"),
    `${file} must use the shared structured logger factory`,
  );
  reporter.assert(
    !/\bfunction\s+emit\b/.test(source) && !/console\.(?:log|error|warn|debug|info)/.test(source),
    `${file} must not reimplement logger emission`,
  );
}

for (const file of [
  "apps/app-marketplace/src/components/MarketplaceUnavailable.tsx",
  "apps/theme-marketplace/src/components/marketplace-unavailable.tsx",
]) {
  const source = readFile(file);
  reporter.assert(
    source.includes("@letbuyy/ui/marketplace"),
    `${file} must wrap the shared MarketplaceUnavailable component`,
  );
  reporter.assert(
    !/<div\s+role="alert"/.test(source),
    `${file} must not reimplement the unavailable component markup`,
  );
}

reporter.finish("marketplace logger and unavailable UI implementations are single-sourced through @letbuyy/ui");
