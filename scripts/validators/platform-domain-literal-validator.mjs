import path from "node:path";
import {
  createReporter,
  listWorkspaceFiles,
  readFile,
  textExtensions,
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

function isAllowedToken(token) {
  const normalized = token.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9_./-]+$/, "");
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
  if (!textExtensions.has(path.extname(file))) continue;

  const text = readFile(file);
  for (const match of text.matchAll(/letbuyy\.store/g)) {
    const token = tokenAt(text, match.index || 0);
    if (isAllowedToken(token)) continue;

    const line = text.slice(0, match.index).split("\n").length;
    offenders.push(`${file}:${line}: ${token}`);
  }
}

reporter.assert(
  offenders.length === 0,
  `Functional letbuyy.store literals must be migrated to letbuyy.com: ${offenders.slice(0, 20).join("; ")}`,
);

reporter.finish("functional platform domain literals checked");
