import {
  createReporter,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Single-source crypto validator");
const trackedFiles = getTrackedFiles();

const gatewayCrypto = readFile("services/api-gateway/src/lib/crypto.ts");
for (const [helperName, exportPattern] of [
  ["timingSafeEqualText", /export function timingSafeEqualText\b/],
  ["timingSafeEqualHex", /export function timingSafeEqualHex\b/],
  ["hmacSha256Hex", /export async function hmacSha256Hex\b/],
  ["sha256Hex", /export async function sha256Hex\b/],
]) {
  reporter.assert(
    exportPattern.test(gatewayCrypto),
    `api-gateway crypto module must export ${helperName}`,
  );
}

const routeCryptoDeclarationPattern =
  /\b(?:function|async function)\s+(?:hexToBytes|timingSafeEqualHex|timingSafeEqualText|hmacSha256Hex|sha256Hex)\b/;
const routeOffenders = trackedFiles.filter((file) => {
  if (!file.startsWith("services/api-gateway/src/routes/")) return false;
  if (!file.endsWith(".ts")) return false;
  return routeCryptoDeclarationPattern.test(readFile(file));
});
reporter.assert(
  routeOffenders.length === 0,
  `api-gateway route modules must import shared crypto helpers instead of declaring local copies: ${routeOffenders.join(", ")}`,
);

for (const file of [
  "services/api-gateway/src/routes/storefront/public-routes.ts",
  "services/api-gateway/src/routes/storefront/customer-engagement-routes.ts",
]) {
  reporter.assert(
    readFile(file).includes("from '../../lib/crypto'"),
    `${file} must import storefront crypto helpers from the api-gateway crypto module`,
  );
}

const storefrontRoot = readFile("services/api-gateway/src/routes/storefront.ts");
reporter.assert(
  !routeCryptoDeclarationPattern.test(storefrontRoot) && !storefrontRoot.includes("crypto.subtle"),
  "storefront route root must not retain dead local crypto helper declarations",
);

reporter.finish("api-gateway route crypto helpers are single-sourced through services/api-gateway/src/lib/crypto.ts");
