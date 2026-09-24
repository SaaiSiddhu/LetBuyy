// Reference isolation validator (APPID-P2, 2026-09-24; Constitution §16 Amendment 3, REFERENCE class).
//
// Founder, verbatim: "Reference code: Excluded from runtime/workspace/build/deploy discovery. Not
// imported by active applications. Still subject to appropriate secret scanning. Retains provenance and
// capability-transfer checklists." and "External donor paths must not become mandatory CI filesystem
// dependencies."
//
// runtime-validator already fixes WHAT may sit under reference/ (only the approved donor roots). This
// validator fixes how the rest of the repository may relate to it: nothing depends on it, nothing
// builds or deploys it, and each donor carries the record a port needs. Secret scanning of reference/
// is environment-validator's job; since APPID-P2 it has no path exemption at all.

import path from "node:path";
import {
  createReporter,
  exists,
  formatOffenderList,
  getTrackedFiles,
  readFile,
  referenceAppRoots,
  referenceRoot,
  startsWithPrefix,
} from "./governance-common.mjs";

const reporter = createReporter("Reference isolation validator");
const trackedFiles = getTrackedFiles();
const inReference = (file) => startsWithPrefix(file, referenceRoot);
const outside = trackedFiles.filter((file) => !inReference(file));
const intoReference = (resolved) => resolved === referenceRoot || resolved.startsWith(`${referenceRoot}/`);
const resolveFrom = (file, specifier) => path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));

// --- 1. Provenance and capability-transfer record -------------------------------------------------

const REQUIRED_HEADINGS = ["## Provenance", "## Intended recipient", "## Unique capabilities", "## Transfer gates"];
const indexDoc = readFile(`${referenceRoot}/README.md`);
reporter.assert(indexDoc !== "", `${referenceRoot}/README.md must exist and index every donor`);
for (const donor of referenceAppRoots) {
  reporter.assert(indexDoc.includes(donor), `${referenceRoot}/README.md must list ${donor}`);
  const readme = readFile(`${donor}/README.md`);
  reporter.assert(readme !== "", `${donor}/README.md must exist (provenance and transfer checklist)`);
  for (const heading of REQUIRED_HEADINGS) {
    reporter.assert(
      readme.split("\n").some((line) => line.trim() === heading),
      `${donor}/README.md must have a "${heading}" section`,
    );
  }
}

// --- 2. No workspace membership -------------------------------------------------------------------

// Minimal glob semantics for workspace patterns: ** spans directories, * stays inside one segment.
function globToRegExp(pattern) {
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*" && pattern[i + 1] === "*") { source += ".*"; i += 1; if (pattern[i + 1] === "/") i += 1; }
    else if (char === "*") source += "[^/]*";
    else source += char.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}/?$`);
}

const yamlListUnder = (text, key) => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start === -1) return [];
  const items = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const item = line.match(/^\s*-\s*["']?([^"'#]+?)["']?\s*(?:#.*)?$/);
    if (item) items.push(item[1].trim());
  }
  return items;
};

const pnpmPatterns = yamlListUnder(readFile("pnpm-workspace.yaml"), "packages");
const pnpmOffenders = pnpmPatterns
  .filter((pattern) => !pattern.startsWith("!"))
  .filter((pattern) => referenceAppRoots.some((donor) => globToRegExp(pattern).test(donor)) || pattern.startsWith(referenceRoot));
reporter.assert(
  pnpmOffenders.length === 0,
  `pnpm-workspace.yaml patterns reach reference/ (a donor would install, build and lint as a package): ${formatOffenderList(pnpmOffenders)}`,
);

const pubMembers = yamlListUnder(readFile("pubspec.yaml"), "workspace");
const pubOffenders = pubMembers.filter((member) => intoReference(path.posix.normalize(member)));
reporter.assert(
  pubOffenders.length === 0,
  `The Dart pub workspace (pubspec.yaml) includes reference/ members: ${formatOffenderList(pubOffenders)}`,
);

const lockImporters = [...readFile("pnpm-lock.yaml").matchAll(/^ {2}([^\s:][^:]*):\s*$/gm)].map((match) => match[1].replace(/^['"]|['"]$/g, ""));
const lockOffenders = lockImporters.filter((importer) => intoReference(importer));
reporter.assert(lockOffenders.length === 0, `pnpm-lock.yaml has reference/ importers: ${formatOffenderList(lockOffenders)}`);

const pubLockPaths = [...readFile("pubspec.lock").matchAll(/^\s+path:\s*"?([^"\n]+)"?\s*$/gm)].map((match) => match[1]);
const pubLockOffenders = pubLockPaths.filter((entry) => intoReference(path.posix.normalize(entry)));
reporter.assert(pubLockOffenders.length === 0, `pubspec.lock resolves packages from reference/: ${formatOffenderList(pubLockOffenders)}`);

// --- 3. Nothing outside reference/ depends on it ---------------------------------------------------

const donorPackageNames = referenceAppRoots
  .map((donor) => readFile(`${donor}/pubspec.yaml`).match(/^name:\s*([A-Za-z0-9_]+)/m)?.[1])
  .filter(Boolean);
reporter.assert(
  donorPackageNames.length === referenceAppRoots.length,
  `every reference donor must declare its Dart package name in pubspec.yaml (found ${donorPackageNames.length} of ${referenceAppRoots.length})`,
);

const dependencyOffenders = [];
const noteEdge = (file, what) => dependencyOffenders.push(`${file} -> ${what}`);

for (const file of outside) {
  const base = path.posix.basename(file);
  if (base === "pubspec.yaml") {
    for (const match of readFile(file).matchAll(/^\s+path:\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/gm)) {
      if (intoReference(resolveFrom(file, match[1]))) noteEdge(file, `path dependency ${match[1]}`);
    }
    continue;
  }
  if (base === "package.json") {
    let manifest = null;
    try { manifest = JSON.parse(readFile(file)); } catch { continue; }
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const [name, spec] of Object.entries(manifest?.[field] ?? {})) {
        const local = typeof spec === "string" ? spec.match(/^(?:link|file|portal):(.+)$/) : null;
        if (local && intoReference(resolveFrom(file, local[1]))) noteEdge(file, `${field}.${name} ${spec}`);
      }
    }
    continue;
  }
  if (/^tsconfig.*\.json$/.test(base)) {
    const text = readFile(file);
    for (const match of text.matchAll(/"((?:\.\.?\/)[^"]*)"/g)) {
      if (intoReference(resolveFrom(file, match[1]))) noteEdge(file, `tsconfig path ${match[1]}`);
    }
    continue;
  }
  const isScript = /\.(?:[cm]?[jt]sx?)$/.test(base);
  const isDart = base.endsWith(".dart");
  if (!isScript && !isDart) continue;
  const text = readFile(file);
  const specifiers = [
    ...text.matchAll(/\b(?:import|export)\s[^;'"]*?\bfrom\s*["']([^"']+)["']/g),
    ...text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...text.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...text.matchAll(/^\s*(?:import|export|part)\s+["']([^"']+)["']/gm),
  ].map((match) => match[1]);
  for (const specifier of specifiers) {
    if (specifier.startsWith(".") && intoReference(resolveFrom(file, specifier))) noteEdge(file, specifier);
    else if (specifier.includes(`${referenceRoot}/apps/`)) noteEdge(file, specifier);
    else if (isDart && donorPackageNames.some((name) => specifier.startsWith(`package:${name}/`))) noteEdge(file, specifier);
  }
}
reporter.assert(
  dependencyOffenders.length === 0,
  `Active code depends on reference/ donor source (port the capability into its recipient instead): ${formatOffenderList(dependencyOffenders)}`,
);

// --- 4. Nothing builds or deploys it ----------------------------------------------------------------

const discoveryFiles = outside.filter(
  (file) =>
    startsWithPrefix(file, ".github/workflows") ||
    startsWithPrefix(file, "config/runtime") ||
    startsWithPrefix(file, "config/vercel") ||
    ["turbo.json", "package.json", "codemagic.yaml", "firebase.json", "vercel.json"].includes(file),
);
const discoveryOffenders = discoveryFiles.filter((file) => readFile(file).includes(`${referenceRoot}/apps`));
reporter.assert(
  discoveryOffenders.length === 0,
  `Build, CI or deploy configuration names reference/ donors (they are never built or deployed): ${formatOffenderList(discoveryOffenders)}`,
);

const DEPLOY_CONFIG = /(?:^|\/)(?:vercel\.json|wrangler\.toml|wrangler\.jsonc?|firebase\.json|\.firebaserc|codemagic\.ya?ml|netlify\.toml|fly\.toml|app\.ya?ml|Dockerfile)$/;
const donorDeployConfig = trackedFiles.filter(
  (file) => inReference(file) && (DEPLOY_CONFIG.test(file) || file.includes("/.github/")),
);
reporter.assert(
  donorDeployConfig.length === 0,
  `reference/ donors must carry no deployment configuration: ${formatOffenderList(donorDeployConfig)}`,
);

// --- 5. Donor locations never become filesystem dependencies ----------------------------------------

// Absolute paths into the donor systems' old checkouts or the out-of-tree history bundles. Markdown and
// docs/ may cite them as provenance; nothing executable or generated may depend on them.
const DONOR_LOCATION = /(?:\/Users\/|~\/|\$HOME\/|\$\{HOME\}\/)[^\s'"`]*?(?:Agrimore|Ecommerce\/LetBuyy|LetBuyy-history-preservation|LetBuyy-credential-evidence)/;
const donorLocationOffenders = trackedFiles.filter(
  (file) => !file.endsWith(".md") && !startsWithPrefix(file, "docs") && DONOR_LOCATION.test(readFile(file)),
);
reporter.assert(
  donorLocationOffenders.length === 0,
  `Tracked non-documentation files depend on a donor system's machine path: ${formatOffenderList(donorLocationOffenders)}`,
);

reporter.assert(exists(referenceRoot), `${referenceRoot}/ must exist while the REFERENCE class has members`);
reporter.finish(`${referenceAppRoots.length} donors, ${outside.length} files outside reference/ checked for dependency edges`);
