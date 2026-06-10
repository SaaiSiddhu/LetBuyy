import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  getTrackedFiles,
  normalizePath,
  readJson,
  root,
  sourceExtensions,
} from "./governance-common.mjs";

const reporter = createReporter("Foundation anti-fabrication gate");
const allowlistPath = "config/governance/anti-fabrication-allowlist.json";
const allowlist = readJson(allowlistPath) ?? { entries: [] };

const entryMatches = new Map();
for (const entry of allowlist.entries ?? []) {
  entryMatches.set(entry.id, 0);
}

const activeRootPattern = /^(apps|services|packages)\//;
const ignoredPathPattern = /(^|\/)(__tests__|test|tests)(\/|$)|\.test\.(ts|tsx|js|jsx|mjs|cjs)$|\.spec\.(ts|tsx|js|jsx|mjs|cjs)$/;

const rules = [
  {
    id: "synthetic-utr",
    description: "No fabricated UTRs or synthesized payout rail references",
    pattern: /fake\s*UTR|\butr\s*:\s*['"`][^'"`]*fake|\butr\s*:\s*`?\s*UTR\s*\$\{|`UTR\$\{|UTR\$\{/i,
  },
  {
    id: "mock-true-runtime-payload",
    description: "No runtime payload may advertise mock:true as success evidence",
    pattern: /\bmock\s*:\s*true\b/i,
  },
  {
    id: "hardcoded-payout-released",
    description: "Payout release state must come from a provider-confirmed transition",
    pattern: /\bstatus\s*:\s*['"]released['"]/i,
  },
  {
    id: "synthetic-provider-transaction-id",
    description: "Provider transaction identifiers must not be synthesized from local ids",
    pattern: /\b(providerPaymentId|provider_payment_id|payment_id)\b[\s\S]{0,160}(Date\.now|Math\.random|randomUUID|crypto\.randomUUID|`[^`]*\$\{[^`]*payment\.id)/i,
  },
];

function readExtraFiles() {
  const raw = process.env.LETBUYY_ANTI_FABRICATION_EXTRA_FILES || "";
  return raw
    .split(path.delimiter)
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => (path.isAbsolute(candidate) ? candidate : normalizePath(candidate)));
}

function shouldScan(file) {
  if (!activeRootPattern.test(file)) return false;
  if (ignoredPathPattern.test(file)) return false;
  return sourceExtensions.has(path.extname(file));
}

function allowed(ruleId, file, source) {
  let matched = false;
  for (const entry of allowlist.entries ?? []) {
    if (entry.rule !== ruleId || entry.path !== file) continue;
    const snippets = Array.isArray(entry.snippets) ? entry.snippets : [entry.snippet].filter(Boolean);
    if (snippets.length === 0) continue;
    if (snippets.every((snippet) => source.includes(snippet))) {
      entryMatches.set(entry.id, (entryMatches.get(entry.id) ?? 0) + 1);
      matched = true;
    }
  }
  return matched;
}

const fileEntries = [
  ...getTrackedFiles().filter(shouldScan).map((file) => ({ file, required: false })),
  ...readExtraFiles().map((file) => ({ file, required: true })),
];

const files = [];
const seenFiles = new Set();
for (const entry of fileEntries) {
  if (seenFiles.has(entry.file)) continue;
  seenFiles.add(entry.file);
  files.push(entry);
}

for (const { file, required } of files.sort((a, b) => a.file.localeCompare(b.file))) {
  const absPath = path.isAbsolute(file) ? file : path.join(root, file);
  if (!fs.existsSync(absPath)) {
    if (required) {
      reporter.assert(false, `Configured anti-fabrication scan file does not exist: ${file}`);
    }
    continue;
  }

  const source = fs.readFileSync(absPath, "utf8");
  for (const rule of rules) {
    if (!rule.pattern.test(source)) continue;
    reporter.assert(
      allowed(rule.id, file, source),
      `${file}: ${rule.description} (${rule.id})`,
    );
  }
}

for (const entry of allowlist.entries ?? []) {
  reporter.assert(
    entryMatches.get(entry.id) === 1,
    `${allowlistPath}: allowlist entry ${entry.id} must match exactly one current file`,
  );
  reporter.assert(
    /^Wave [1-7](\.| |$)|^WAVE FINAL/.test(entry.ownerWave || ""),
    `${allowlistPath}: allowlist entry ${entry.id} must name the cleanup owner wave`,
  );
  reporter.assert(
    typeof entry.reason === "string" && entry.reason.length > 20,
    `${allowlistPath}: allowlist entry ${entry.id} must explain why it is temporary`,
  );
}

reporter.finish(`${files.length} active source files scanned; ${allowlist.entries?.length ?? 0} temporary entries tracked`);
