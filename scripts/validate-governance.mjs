#!/usr/bin/env node
/**
 * LetBuyy governance gate entrypoint.
 *
 * Authority: GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md -> root
 * AGENTS.md (DOC-R5) -> scripts/validators/README.md.
 *
 * This file declares WHICH validators belong to which lane. HOW they are
 * discovered, executed and reported lives in
 * scripts/governance/validator-orchestrator.mjs.
 *
 * Execution contract (no false green is representable):
 *   - The validator inventory is discovered from disk on every run; no count is
 *     hardcoded. Drift between disk and the declared lanes is a hard failure.
 *   - A failing validator does NOT stop the remaining validators from running.
 *     Every validator is executed and reported, or carries an explicit
 *     BLOCKED/SKIP/NOT_APPLICABLE reason.
 *   - The process exits NON-ZERO if any validator FAILs, any validator is
 *     BLOCKED, any required validator is SKIPped, discovery is empty, or the
 *     inventory drifted. Failures are never downgraded to warnings.
 *
 * Usage:
 *   node scripts/validate-governance.mjs [--lane=gate|report|all]
 *                                        [--plan]
 *                                        [--report-json=<path>]
 *                                        [--validator-timeout-ms=<ms>]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  STATUS,
  DEFAULT_VALIDATOR_TIMEOUT_MS,
  buildRunPlan,
  computeGateOutcome,
  createTrackedPathPredicate,
  discoverValidatorModules,
  executeGeneratedArtifactCleanup,
  planGeneratedArtifactCleanup,
  reconcileValidatorInventory,
  runValidators,
} from "./governance/validator-orchestrator.mjs";

const argv = process.argv.slice(2);
const args = new Set(argv);

function argValue(prefix, fallback) {
  const found = argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const lane = argValue("--lane=", "gate");
const planOnly = args.has("--plan");
const reportJsonPath = argValue("--report-json=", null);
const validatorTimeoutMs = Number(argValue("--validator-timeout-ms=", String(DEFAULT_VALIDATOR_TIMEOUT_MS)));
const validLanes = new Set(["gate", "report", "all"]);

if (!validLanes.has(lane)) {
  console.error(`Invalid governance lane: ${lane}. Expected one of: ${[...validLanes].join(", ")}`);
  process.exit(1);
}

if (!Number.isFinite(validatorTimeoutMs) || validatorTimeoutMs <= 0) {
  console.error(`Invalid --validator-timeout-ms: ${validatorTimeoutMs}`);
  process.exit(1);
}

const validators = [
  "foundation-antifabrication-gate.mjs",
  "tenant-isolation-validator.mjs",
  "production-safety-validator.mjs",
  "session-security-validator.mjs",
  "operational-lifecycle-validator.mjs",
  "validate-design-system.mjs",
  "mobile-token-validator.mjs",
  "theme-governance-validator.mjs",
  "beta-readiness-validator.mjs",
  "architecture-validator.mjs",
  "runtime-validator.mjs",
  "runtime-manifest-validator.mjs",
  "runtime-topology-validator.mjs",
  "topology-drift-validator.mjs",
  "package-ownership-validator.mjs",
  "import-validator.mjs",
  "dependency-manifest-validator.mjs",
  "undeclared-import-validator.mjs",
  "dependency-graph-validator.mjs",
  "circular-import-validator.mjs",
  "cycle-budget-validator.mjs",
  "package-export-validator.mjs",
  "provider-isolation-validator.mjs",
  "supply-chain-validator.mjs",
  "typescript-governance-validator.mjs",
  "cloudflare-topology-validator.mjs",
  "wrangler-env-validator.mjs",
  "cloudflare-environment-validator.mjs",
  "cloudflare-binding-validator.mjs",
  "env-isolation-validator.mjs",
  "environment-honesty-validator.mjs",
  "cookie-realm-validator.mjs",
  "reserved-subdomain-single-source-validator.mjs",
  "storefront-access-gate-validator.mjs",
  "custom-domain-target-validator.mjs",
  "merchant-domains-settings-validator.mjs",
  "storefront-seo-access-validator.mjs",
  "platform-domain-literal-validator.mjs",
  "route-ownership-validator.mjs",
  "legacy-site-type-validator.mjs",
  "app-utils-service-role-edge-validator.mjs",
  "migration-safety-validator.mjs",
  "sequential-migration-validator.mjs",
  "deployment-safety-validator.mjs",
  "secret-topology-validator.mjs",
  "domain-boundary-validator.mjs",
  "single-writer-ownership-validator.mjs",
  "fail-closed-internal-routes-validator.mjs",
  "source-ledger-residue-validator.mjs",
  "foundation-sql-policy-residue-validator.mjs",
  "dead-residue-validator.mjs",
  "repository-intelligence-validator.mjs",
  "mobile-topology-honesty-validator.mjs",
  "route-line-count-validator.mjs",
  "single-source-crypto-validator.mjs",
  "cms-slugify-validator.mjs",
  "inr-currency-format-validator.mjs",
  "date-format-validator.mjs",
  "marketplace-single-source-validator.mjs",
  "api-client-runtime-base-validator.mjs",
  "marketing-dead-twin-validator.mjs",
  "theme-editor-dead-shell-validator.mjs",
  "typescript-dead-source-validator.mjs",
  "dart-dead-source-validator.mjs",
  "settings-apps-dead-twin-validator.mjs",
  "raw-error-message-validator.mjs",
  "dev-auth-bypass-validator.mjs",
  "no-noop-test-script-validator.mjs",
  "environment-validator.mjs",
  "generated-artifact-validator.mjs",
  "stale-artifact-validator.mjs",
  "tooling-governance-validator.mjs",
  "ci-simulation-validator.mjs",
  "workflow-trigger-coverage-validator.mjs",
  "committed-secret-placeholder-validator.mjs",
  "d1-governance-validator.mjs",
  "deployment-lineage-validator.mjs",
  "durable-object-validator.mjs",
  "manifest-lineage-validator.mjs",
  "production-readiness-validator.mjs",
  "provider-evidence-validator.mjs",
  "queue-topology-validator.mjs",
  "rollback-integrity-validator.mjs",
  "test-coverage-governance-validator.mjs",
  "workspace-lifecycle-validator.mjs",
  "commission-bps-zero-validator.mjs",
  "pricing-catalog-validator.mjs",
  "canonical-ledger-only-validator.mjs",
  "no-self-custody-rail-validator.mjs",
  "payment-rail-allowlist-validator.mjs",
  "stepup-crypto-validator.mjs",
  "identity-sole-issuer-validator.mjs",
  "no-blanket-service-role-validator.mjs",
  "no-public-using-true-validator.mjs",
  "rls-force-coverage-validator.mjs",
  "provider-mode-badge-validator.mjs",
  "one-system-per-domain-validator.mjs",
  "no-rejected-package-imports-validator.mjs",
  "no-reserved-service-activation-validator.mjs",
  "no-new-react-sections-validator.mjs",
  "token-source-single-validator.mjs",
  "shell-single-validator.mjs",
  "meta-no-theater-validator.mjs",
  "phase-c-forced-decisions-validator.mjs",
  "branch-lag-guard-validator.mjs",
  "deploy-matrix-topology-validator.mjs",
  "topology-json-antifabrication-validator.mjs",
  "no-scan-generated-agents-validator.mjs",
  "prompt-perimeter-validator.mjs",
  "whole-repo-end-state-validator.mjs",
  "web-v1-scope-perimeter-validator.mjs",
];

const reportValidators = [
  "foundation-stepup-report-validator.mjs",
];

// Shared modules with no standalone entrypoint. Declared here so dynamic
// discovery can tell "library" apart from "unwired validator".
const libraryModules = [
  "governance-common.mjs",
  "phase-b-common.mjs",
];

// Invoked by git hooks (scripts/git-hooks/*), not by a governance lane.
const hookOnlyModules = [
  "frozen-path-override-gate.mjs",
];

const criticalGateValidators = [
  "dependency-manifest-validator.mjs",
  "undeclared-import-validator.mjs",
  "package-export-validator.mjs",
  "dependency-graph-validator.mjs",
  "circular-import-validator.mjs",
];

const demotedValidators = [];

const orchestratorProblems = [];

for (const validator of criticalGateValidators) {
  if (!validators.includes(validator)) {
    orchestratorProblems.push(`Critical validator must stay in the gate lane: ${validator}`);
  }
}

if (demotedValidators.length) {
  orchestratorProblems.push(
    `Validator demotions are forbidden without a Wave 0 governance entry: ${demotedValidators.join(", ")}`,
  );
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validatorsDir = path.join(repoRoot, "scripts", "validators");
const cwd = process.cwd();

// The generated-artifact cleanup below deletes recursively. It is anchored to
// the repository that owns THIS script, never to an arbitrary cwd, so a run
// launched from elsewhere can never delete another checkout's directories.
const cwdMatchesRepoRoot = path.resolve(cwd) === repoRoot;
if (!cwdMatchesRepoRoot) {
  orchestratorProblems.push(
    `Governance gate must run from the repository root it belongs to. cwd=${cwd} repoRoot=${repoRoot}. Refusing to treat this as a gate result.`,
  );
}

/* --------------------------------------------------------------------------
 * Dynamic discovery + inventory reconciliation
 * -------------------------------------------------------------------------- */

const discovered = discoverValidatorModules(validatorsDir);
const inventory = reconcileValidatorInventory({
  discovered,
  gateManifest: validators,
  reportManifest: reportValidators,
  libraryModules,
  hookOnlyModules,
});

const plan = buildRunPlan({
  lane,
  gateManifest: validators,
  reportManifest: reportValidators,
  inventory,
  validatorsDir,
});

const selectedCount = plan.filter((entry) => entry.selected).length;

console.log("=".repeat(78));
console.log(`LetBuyy governance gate — lane=${lane}`);
console.log(`repository root       : ${repoRoot}`);
console.log(`validator directory   : ${path.relative(repoRoot, validatorsDir) || validatorsDir}`);
console.log(`discovered on disk    : ${inventory.discoveredCount} .mjs modules`);
console.log(`  executable validators: ${inventory.executableCount}`);
console.log(`  library modules      : ${inventory.library.length} (${inventory.library.join(", ") || "none"})`);
console.log(`  hook-only modules    : ${inventory.hookOnly.length} (${inventory.hookOnly.join(", ") || "none"})`);
console.log(`declared in lanes     : ${inventory.declaredCount} (gate ${validators.length}, report ${reportValidators.length})`);
console.log(`selected for this run : ${selectedCount}`);
console.log(`per-validator timeout : ${validatorTimeoutMs}ms`);
console.log("=".repeat(78));

for (const problem of inventory.problems) console.error(`INVENTORY PROBLEM: ${problem}`);

if (planOnly) {
  console.log("");
  console.log("--plan: NO VALIDATORS EXECUTED. This is an inventory listing, not a gate result.");
  for (const entry of plan) {
    console.log(`  ${entry.selected ? "SELECTED" : "NOT_APPLICABLE"}  ${entry.name}${entry.selected ? (entry.required ? " (required)" : " (optional)") : ""}`);
  }
  process.exit(inventory.problems.length === 0 && orchestratorProblems.length === 0 ? 0 : 1);
}

/* --------------------------------------------------------------------------
 * Generated-artifact cleanup — SAFETY CRITICAL, path-constrained, non-silent
 * -------------------------------------------------------------------------- */

let cleanupBlockedReason = null;

function runGeneratedArtifactCleanup() {
  if (!cwdMatchesRepoRoot) {
    cleanupBlockedReason = `generated-artifact cleanup refused: cwd (${cwd}) is not the repository root (${repoRoot})`;
    console.error(`CLEANUP REFUSED: ${cleanupBlockedReason}`);
    return { refused: true };
  }

  const isTracked = createTrackedPathPredicate(repoRoot);
  const cleanupPlan = planGeneratedArtifactCleanup({
    repoRoot,
    startDirs: ["apps", "packages", "services"],
    isTracked,
  });

  for (const refusal of cleanupPlan.refusals) {
    console.warn(`CLEANUP REFUSED: ${refusal.relPath} — ${refusal.reason}`);
  }

  if (cleanupPlan.refusedEntirely) {
    cleanupBlockedReason = "generated-artifact cleanup refused at planning time; see CLEANUP REFUSED lines above";
    return { refused: true };
  }

  const executed = executeGeneratedArtifactCleanup(cleanupPlan, {
    repoRoot,
    log: (message) => console.log(message),
  });

  console.log(
    `generated-artifact cleanup: ${executed.removed.length} directory(ies) removed, ${cleanupPlan.refusals.length} refused, ${executed.errors.length} error(s)`,
  );

  for (const error of executed.errors) {
    console.error(`CLEANUP ERROR: ${error.relPath} — ${error.reason}`);
  }

  if (executed.errors.length) {
    cleanupBlockedReason = `generated-artifact cleanup reported ${executed.errors.length} error(s)`;
    return { refused: true };
  }

  return { refused: false };
}

/* --------------------------------------------------------------------------
 * Execution — continues past failures, records every outcome
 * -------------------------------------------------------------------------- */

let index = 0;
const results = runValidators({
  plan,
  cwd,
  timeoutMs: validatorTimeoutMs,
  beforeValidator(entry) {
    if (entry.name !== "stale-artifact-validator.mjs") return null;

    const outcome = runGeneratedArtifactCleanup();
    if (outcome.refused) {
      return {
        status: STATUS.BLOCKED,
        reason:
          cleanupBlockedReason ||
          "stale-artifact-validator requires the generated-artifact cleanup, which was refused",
      };
    }
    return null;
  },
  onResult(result) {
    if (result.status === STATUS.NOT_APPLICABLE) return;
    index += 1;
    const suffix = result.reason ? ` — ${result.reason}` : "";
    console.log(
      `[${String(index).padStart(3, " ")}/${selectedCount}] ${result.status.padEnd(14, " ")} ${result.name} (${result.durationMs}ms)${suffix}`,
    );
  },
});

const outcome = computeGateOutcome({
  results,
  inventoryProblems: inventory.problems,
  orchestratorProblems,
});

/* --------------------------------------------------------------------------
 * Report
 * -------------------------------------------------------------------------- */

console.log("");
console.log("=".repeat(78));
console.log(`GOVERNANCE ${lane.toUpperCase()} LANE MATRIX`);
console.log("=".repeat(78));
console.log("status         exit  ms       validator");
for (const result of results) {
  if (result.status === STATUS.NOT_APPLICABLE) continue;
  console.log(
    `${result.status.padEnd(14, " ")} ${String(result.exitCode ?? "-").padStart(4, " ")}  ${String(result.durationMs).padStart(7, " ")}  ${result.name}${result.reason ? `  — ${result.reason}` : ""}`,
  );
}

const notApplicable = results.filter((result) => result.status === STATUS.NOT_APPLICABLE);
if (notApplicable.length) {
  console.log("");
  console.log(`NOT_APPLICABLE (${notApplicable.length}):`);
  for (const result of notApplicable) console.log(`  ${result.name} — ${result.reason}`);
}

if (outcome.advisories.length) {
  console.log("");
  console.log(`DECLARED ADVISORIES (${outcome.advisories.length}) — non-blocking BY DECLARATION, not by accident:`);
  for (const advisory of outcome.advisories) console.log(`  ${advisory.validator}: ${advisory.message}`);
}

console.log("");
console.log(
  `TOTALS: PASS=${outcome.counts.PASS} FAIL=${outcome.counts.FAIL} BLOCKED=${outcome.counts.BLOCKED} SKIP=${outcome.counts.SKIP} NOT_APPLICABLE=${outcome.counts.NOT_APPLICABLE}`,
);

if (reportJsonPath) {
  const payload = {
    generatedAt: new Date().toISOString(),
    lane,
    repoRoot,
    discovered: inventory.discovered,
    inventory: {
      discoveredCount: inventory.discoveredCount,
      executableCount: inventory.executableCount,
      declaredCount: inventory.declaredCount,
      gateDeclared: validators.length,
      reportDeclared: reportValidators.length,
      library: inventory.library,
      hookOnly: inventory.hookOnly,
      undeclared: inventory.undeclared,
      missing: inventory.missing,
      problems: inventory.problems,
    },
    counts: outcome.counts,
    advisories: outcome.advisories,
    problems: outcome.problems,
    ok: outcome.ok,
    exitCode: outcome.exitCode,
    results: results.map((result) => ({
      name: result.name,
      lane: result.lane,
      status: result.status,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      required: result.required,
      reason: result.reason,
      advisories: result.advisories,
    })),
  };
  fs.mkdirSync(path.dirname(path.resolve(reportJsonPath)), { recursive: true });
  fs.writeFileSync(path.resolve(reportJsonPath), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Machine-readable matrix written to ${path.resolve(reportJsonPath)}`);
}

if (!outcome.ok) {
  console.error("");
  console.error(`Governance ${lane} lane FAILED with ${outcome.problems.length} problem(s):`);
  for (const problem of outcome.problems) console.error(`- ${problem}`);
  process.exit(outcome.exitCode);
}

console.log("");
console.log(
  `Governance ${lane} lane passed (${outcome.counts.PASS} validators executed and passed; ${inventory.executableCount} discovered on disk).`,
);
