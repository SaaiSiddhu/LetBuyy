import path from "node:path";
import {
  createReporter,
  listWorkspaceFiles,
  readFile,
  sourceExtensions,
} from "./governance-common.mjs";

const reporter = createReporter("Storefront access gate validator");

const proxy = readFile("apps/customer_web/src/proxy.ts");
const orderRoute = readFile("apps/customer_web/src/app/api/orders/route.ts");

for (const fragment of [
  "resolveStorefrontHost",
  "verifyStorefrontPreviewToken",
  "verifyStorefrontGateToken",
  "LETBUYY_STOREFRONT_GATE_COOKIE",
  "LETBUYY_STOREFRONT_PREVIEW_QUERY",
  "/v1/internal/store-access/resolve",
  "X-Robots-Tag",
  "x-letbuyy-preview-checkout-mode",
]) {
  reporter.assert(proxy.includes(fragment), `storefront proxy missing ${fragment}`);
}

reporter.assert(
  /access_mode === 'password'/.test(proxy)
    && /access_mode === 'preview_only'/.test(proxy)
    && /access_mode === 'offline'/.test(proxy),
  "storefront proxy must branch on password, preview_only, and offline modes",
);
reporter.assert(
  /response\.cookies\.set\([^)]*LETBUYY_STOREFRONT_PREVIEW_COOKIE/.test(proxy),
  "preview token persistence must use a host-only __Host- preview cookie",
);
reporter.assert(
  /response\.cookies\.set\([^)]*LETBUYY_STOREFRONT_GATE_COOKIE/.test(proxy)
    && /\/v1\/internal\/store-access\/verify/.test(proxy),
  "proxy password submit must set the shared __Host- gate cookie after gateway verification",
);
reporter.assert(
  !/\bdomain\s*:/.test(proxy),
  "storefront gate cookies must not set a domain attribute",
);
reporter.assert(
  /LETBUYY_STOREFRONT_PREVIEW_COOKIE/.test(orderRoute)
    && /Preview checkout uses sandbox mode/.test(orderRoute)
    && /cannot create real orders/.test(orderRoute),
  "preview checkout must block real order creation",
);

for (const file of listWorkspaceFiles(["apps/customer_web/src"]).filter((candidate) => sourceExtensions.has(path.extname(candidate)))) {
  const source = readFile(file);
  reporter.assert(
    !/\.from\(\s*["'](?:sites|site_preview_links|site_gate_attempts)["']\s*\)[\s\S]{0,400}\.(?:insert|update|upsert|delete)\s*\(/.test(source),
    `${file} must not write custom-domain or store-access tables`,
  );
}

reporter.finish("storefront access gate proxy is present, shared, host-only, and API-backed");
