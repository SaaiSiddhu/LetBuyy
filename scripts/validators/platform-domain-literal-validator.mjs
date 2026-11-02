import { isApprovedStorefrontDomainLiteral } from './storefront-domain-policy.mjs';
import path from "node:path";
import {
  compatibilityBridgeRoots,
  createReporter,
  listWorkspaceFiles,
  readFile,
  startsWithPrefix,
  textExtensions,
  formatOffenderList,
} from "./governance-common.mjs";

const reporter = createReporter("Platform domain literal validator");

const scanRoots = [
  ".github",
  "apps",
  "services",
  "packages",
  "config",
  "infrastructure",
  "scripts",
  "tests",
  "docs/governance",
  "docs/operations",
];

const allowedTokens = [
  /^com\.letbuyy\.store(?:[./A-Za-z0-9_-]*)?$/,
  /^group\.com\.letbuyy\.store(?:[./A-Za-z0-9_-]*)?$/,
  /^letbuyy\.storeId$/,
];

function tokenAt(text, index) {
  let start = index;
  let end = index + "letbuyy.store".length;
  while (start > 0 && /[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]/.test(text[start - 1])) start -= 1;
  while (end < text.length && /[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]/.test(text[end])) end += 1;
  return text.slice(start, end);
}

function isAllowedToken(token, file) {
  const normalized = token.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9_./-]+$/, "");
  // These are three exact OS callback schemes from the first-party registry,
  // not HTTPS hosts. Keep the exception bound to the generated native contract.
  if (file === 'apps/merchant/mobile/lib/services/merchant_auth_contract.g.dart'
      && /^com\.letbuyy\.store\.accounts(?:\.(?:development|staging))?:\/\/auth\/callback$/.test(normalized)) return true;
  if (
    !normalized.includes("://") &&
    !normalized.includes("@") &&
    (normalized.includes("com.letbuyy.store") || normalized.includes("group.com.letbuyy.store"))
  ) {
    return true;
  }
  if (normalized.includes("letbuyy.storeId")) return true;
  return allowedTokens.some((pattern) => pattern.test(normalized));
}

const offenders = [];
for (const file of listWorkspaceFiles(scanRoots)) {
  if (file === "scripts/validators/platform-domain-literal-validator.mjs") continue;
  if (compatibilityBridgeRoots.some((prefix) => startsWithPrefix(file, prefix))) continue;
  if (!textExtensions.has(path.extname(file)) && !file.endsWith(".env.template")) continue;

  const text = readFile(file);
  for (const match of text.matchAll(/letbuyy\.store/g)) {
    const token = tokenAt(text, match.index || 0);
    if (isAllowedToken(token, file) || isApprovedStorefrontDomainLiteral(file, text, match.index || 0)) continue;

    const line = text.slice(0, match.index).split("\n").length;
    offenders.push(`${file}:${line}: ${token}`);
  }
}

reporter.assert(
  offenders.length === 0,
  `Unapproved domain literals: platform accounts/admin/API stay on the platform root; storefront roots must use the canonical declaration or approved env keys: ${formatOffenderList(offenders, 20, "; ")}`,
);

reporter.finish("functional platform domain literals checked");
