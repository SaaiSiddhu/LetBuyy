/**
 * Governance validator orchestration (truthful execution layer).
 *
 * Authority: GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md -> root
 * AGENTS.md (DOC-R5) -> scripts/validators/README.md. This module owns HOW the
 * governance validators are discovered, executed, and reported. It owns no
 * governance rules of its own.
 *
 * Truth contract enforced here (no false green is representable):
 *   1. Discovery is DYNAMIC. The validator inventory is enumerated from disk on
 *      every run. No count is hardcoded anywhere in this module.
 *   2. Every selected validator either EXECUTES or produces an explicit typed
 *      blocker. A failure in one validator never prevents the remaining
 *      validators from running and being reported.
 *   3. Statuses are typed and each non-PASS status carries a reason:
 *        PASS           - the validator ran and exited 0
 *        FAIL           - the validator ran and exited non-zero (exit code kept)
 *        BLOCKED        - the validator could not run (missing module, spawn
 *                         error, timeout, refused precondition)
 *        SKIP           - the validator was deliberately not run (reason kept)
 *        NOT_APPLICABLE - the validator is not part of the selected lane
 *   4. The aggregate outcome is non-zero when ANY of the following holds:
 *        - any validator FAILED
 *        - any validator was BLOCKED
 *        - any REQUIRED validator was SKIPped
 *        - the discovered/selected set is empty
 *        - the on-disk inventory drifted from the declared manifests
 *        - the orchestrator refused a safety precondition
 *      Failures are never downgraded to warnings and errors are never swallowed.
 */

import { execFileSync, spawnSync as nodeSpawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isNextSessionRuntimeDirectoryName } from "../validators/governance-common.mjs";

export const STATUS = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  BLOCKED: "BLOCKED",
  SKIP: "SKIP",
  NOT_APPLICABLE: "NOT_APPLICABLE",
});

/** Statuses that are acceptable in a green run. Everything else is non-zero. */
const NON_BLOCKING_STATUSES = new Set([STATUS.PASS, STATUS.NOT_APPLICABLE]);

export const ADVISORY_MARKER = "##governance-advisory##";

export const DEFAULT_VALIDATOR_TIMEOUT_MS = 240_000;

/* ------------------------------------------------------------------------- *
 * Dynamic discovery
 * ------------------------------------------------------------------------- */

/**
 * Enumerate every executable validator module on disk. Files only, `.mjs` only,
 * never symlinks, deterministically sorted. Returns [] when the directory is
 * absent — callers MUST treat an empty inventory as a hard failure.
 */
export function discoverValidatorModules(validatorsDir, { fsImpl = fs } = {}) {
  if (!validatorsDir || !fsImpl.existsSync(validatorsDir)) return [];

  return fsImpl
    .readdirSync(validatorsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".mjs"))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Reconcile the on-disk inventory against the declared manifests.
 *
 * `libraryModules` are shared helpers with no standalone entrypoint.
 * `hookOnlyModules` are invoked by git hooks rather than by the gate lane.
 * Anything else on disk MUST be declared in a lane, and anything declared MUST
 * exist on disk. Both directions of drift are reported as problems.
 */
export function reconcileValidatorInventory({
  discovered = [],
  gateManifest = [],
  reportManifest = [],
  libraryModules = [],
  hookOnlyModules = [],
} = {}) {
  const discoveredSet = new Set(discovered);
  const library = new Set(libraryModules);
  const hookOnly = new Set(hookOnlyModules);
  const declared = new Set([...gateManifest, ...reportManifest]);

  const executable = discovered.filter((name) => !library.has(name) && !hookOnly.has(name));

  const undeclared = executable.filter((name) => !declared.has(name)).sort();
  const missing = [...declared].filter((name) => !discoveredSet.has(name)).sort();
  const duplicated = [...declared].filter(
    (name) => gateManifest.includes(name) && reportManifest.includes(name),
  ).sort();

  const problems = [];
  for (const name of undeclared) {
    problems.push(
      `Validator drift: scripts/validators/${name} exists on disk but is declared in no lane. Wire it into a lane or declare it a library/hook-only module.`,
    );
  }
  for (const name of missing) {
    problems.push(
      `Validator drift: ${name} is declared in a lane but is missing from scripts/validators. A declared validator that cannot be found is never a pass.`,
    );
  }
  for (const name of duplicated) {
    problems.push(`Validator drift: ${name} is declared in both the gate and report lanes.`);
  }
  if (discovered.length === 0) {
    problems.push(
      "Validator discovery returned zero modules. An empty governance inventory can never be reported as green.",
    );
  }
  if (executable.length === 0) {
    problems.push(
      "Validator discovery found no executable validators. An empty governance inventory can never be reported as green.",
    );
  }

  return {
    discovered: [...discovered],
    discoveredCount: discovered.length,
    executable,
    executableCount: executable.length,
    library: discovered.filter((name) => library.has(name)),
    hookOnly: discovered.filter((name) => hookOnly.has(name)),
    declaredCount: declared.size,
    undeclared,
    missing,
    duplicated,
    problems,
  };
}

/* ------------------------------------------------------------------------- *
 * Run plan
 * ------------------------------------------------------------------------- */

/**
 * Build the ordered run plan. Every executable validator appears exactly once;
 * validators outside the selected lane are carried as NOT_APPLICABLE entries so
 * the report accounts for the whole inventory rather than silently omitting it.
 */
export function buildRunPlan({
  lane,
  gateManifest = [],
  reportManifest = [],
  inventory,
  validatorsDir,
  requiredValidators,
}) {
  const selectedNames =
    lane === "report" ? [...reportManifest] : lane === "all" ? [...gateManifest, ...reportManifest] : [...gateManifest];
  const selected = new Set(selectedNames);
  // Absent an explicit allow-list every selected validator is REQUIRED. There is
  // no implicit optional tier — optionality must be declared, never inferred.
  const required = requiredValidators ? new Set(requiredValidators) : selected;

  const plan = selectedNames.map((name) => ({
    name,
    lane: reportManifest.includes(name) && !gateManifest.includes(name) ? "report" : "gate",
    script: validatorsDir ? path.join(validatorsDir, name) : name,
    selected: true,
    required: required.has(name),
  }));

  for (const name of inventory?.executable ?? []) {
    if (selected.has(name)) continue;
    plan.push({
      name,
      lane: reportManifest.includes(name) ? "report" : "gate",
      script: validatorsDir ? path.join(validatorsDir, name) : name,
      selected: false,
      required: false,
      notApplicableReason: `not part of the --lane=${lane} selection`,
    });
  }

  return plan;
}

/* ------------------------------------------------------------------------- *
 * Execution
 * ------------------------------------------------------------------------- */

function clampExitCode(code) {
  if (!Number.isInteger(code)) return 1;
  if (code === 0) return 0;
  const normalized = Math.abs(code) % 256;
  return normalized === 0 ? 1 : normalized;
}

/**
 * A validator that dies because a dependency cannot be resolved did not
 * evaluate its invariant — it is BLOCKED, not FAILED. Both are non-zero, but
 * only BLOCKED tells the reader "this check never ran".
 */
const MISSING_DEPENDENCY_SIGNATURES = [
  // Most specific first so the reported reason names the actual dependency.
  /Cannot find package '([^']+)'/,
  /Cannot find module '([^']+)'/,
  /(ERR_MODULE_NOT_FOUND)/,
  /(ERR_DLOPEN_FAILED)/,
];

export function detectMissingDependency(text) {
  if (!text) return null;
  for (const pattern of MISSING_DEPENDENCY_SIGNATURES) {
    const match = text.match(pattern);
    if (match) return match[1] ?? match[0];
  }
  return null;
}

function parseAdvisories(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .filter((line) => line.includes(ADVISORY_MARKER))
    .map((line) => line.slice(line.indexOf(ADVISORY_MARKER) + ADVISORY_MARKER.length).trim())
    .filter(Boolean);
}

/**
 * Execute the plan. NEVER short-circuits: a FAIL or BLOCKED entry is recorded
 * and the loop continues to the next validator.
 *
 * `beforeValidator(entry)` may return `{ status, reason }` to record an explicit
 * SKIP/BLOCKED for that entry without running it. It can never turn a validator
 * into a PASS — the status is rejected unless it is SKIP or BLOCKED.
 */
export function runValidators({
  plan,
  cwd,
  nodeExecPath = process.execPath,
  spawnSync = nodeSpawnSync,
  timeoutMs = DEFAULT_VALIDATOR_TIMEOUT_MS,
  fsImpl = fs,
  beforeValidator,
  onResult,
  writeOut = (chunk) => process.stdout.write(chunk),
  writeErr = (chunk) => process.stderr.write(chunk),
  now = () => Date.now(),
} = {}) {
  const results = [];

  for (const entry of plan) {
    const base = {
      name: entry.name,
      lane: entry.lane,
      script: entry.script,
      required: Boolean(entry.required),
      exitCode: null,
      durationMs: 0,
      advisories: [],
      reason: null,
    };

    if (!entry.selected) {
      results.push({
        ...base,
        status: STATUS.NOT_APPLICABLE,
        reason: entry.notApplicableReason || "not selected by the requested lane",
      });
      onResult?.(results[results.length - 1]);
      continue;
    }

    if (!fsImpl.existsSync(entry.script)) {
      results.push({
        ...base,
        status: STATUS.BLOCKED,
        reason: `missing dependency: validator module not found at ${entry.script}`,
      });
      onResult?.(results[results.length - 1]);
      continue;
    }

    const preflight = beforeValidator?.(entry);
    if (preflight && preflight.status) {
      if (preflight.status !== STATUS.SKIP && preflight.status !== STATUS.BLOCKED) {
        // A preflight hook may only withhold execution; it may never assert success.
        results.push({
          ...base,
          status: STATUS.BLOCKED,
          reason: `orchestrator preflight returned an unsupported status "${preflight.status}"; only SKIP and BLOCKED may withhold execution`,
        });
        onResult?.(results[results.length - 1]);
        continue;
      }

      results.push({
        ...base,
        status: preflight.status,
        reason: preflight.reason || `${preflight.status.toLowerCase()} without a stated reason`,
      });
      onResult?.(results[results.length - 1]);
      continue;
    }

    const startedAt = now();
    const spawned = spawnSync(nodeExecPath, [entry.script], {
      cwd,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
    const durationMs = now() - startedAt;

    const stdout = spawned.stdout ?? "";
    const stderr = spawned.stderr ?? "";
    if (stdout) writeOut(stdout);
    if (stderr) writeErr(stderr);

    const advisories = [...parseAdvisories(stdout), ...parseAdvisories(stderr)];

    if (spawned.error) {
      const timedOut = spawned.error.code === "ETIMEDOUT" || spawned.signal === "SIGTERM";
      results.push({
        ...base,
        status: STATUS.BLOCKED,
        durationMs,
        advisories,
        exitCode: spawned.status ?? null,
        reason: timedOut
          ? `missing dependency or hang: exceeded the ${timeoutMs}ms per-validator timeout`
          : `could not execute validator: ${spawned.error.message}`,
      });
      onResult?.(results[results.length - 1]);
      continue;
    }

    if (spawned.status === null || spawned.status === undefined) {
      results.push({
        ...base,
        status: STATUS.BLOCKED,
        durationMs,
        advisories,
        exitCode: null,
        reason: `validator terminated without an exit code${spawned.signal ? ` (signal ${spawned.signal})` : ""}`,
      });
      onResult?.(results[results.length - 1]);
      continue;
    }

    // A non-zero exit caused by an unresolvable dependency means the invariant
    // was never evaluated: report BLOCKED (still non-zero), never PASS.
    const missingDependency = spawned.status === 0 ? null : detectMissingDependency(`${stdout}\n${stderr}`);

    results.push({
      ...base,
      status: spawned.status === 0 ? STATUS.PASS : missingDependency ? STATUS.BLOCKED : STATUS.FAIL,
      exitCode: spawned.status,
      durationMs,
      advisories,
      reason:
        spawned.status === 0
          ? null
          : missingDependency
            ? `missing dependency: ${missingDependency} could not be resolved, so the validator never evaluated its invariant (exit ${spawned.status})`
            : `validator exited ${spawned.status}`,
    });
    onResult?.(results[results.length - 1]);
  }

  return results;
}

/* ------------------------------------------------------------------------- *
 * Outcome
 * ------------------------------------------------------------------------- */

/**
 * Aggregate the run into a single truthful outcome. Green requires a non-empty
 * executed set, zero inventory problems, zero orchestrator problems, and every
 * selected validator PASSing.
 */
export function computeGateOutcome({ results = [], inventoryProblems = [], orchestratorProblems = [] } = {}) {
  const problems = [...inventoryProblems, ...orchestratorProblems];

  const selected = results.filter((result) => result.status !== STATUS.NOT_APPLICABLE);
  const executed = results.filter((result) => result.status === STATUS.PASS || result.status === STATUS.FAIL);

  if (selected.length === 0) {
    problems.push(
      "No validator was selected for execution. An empty governance run can never be reported as green.",
    );
  }
  if (executed.length === 0 && selected.length > 0) {
    problems.push(
      "No validator actually executed. A run where nothing ran can never be reported as green.",
    );
  }

  for (const result of results) {
    if (NON_BLOCKING_STATUSES.has(result.status)) continue;

    if (result.status === STATUS.FAIL) {
      problems.push(`${result.name}: FAIL (exit ${result.exitCode})`);
      continue;
    }
    if (result.status === STATUS.BLOCKED) {
      problems.push(`${result.name}: BLOCKED — ${result.reason}`);
      continue;
    }
    if (result.status === STATUS.SKIP) {
      if (result.required) {
        problems.push(
          `${result.name}: SKIP of a REQUIRED validator — ${result.reason}. A skipped required validator is never a pass.`,
        );
      } else {
        problems.push(`${result.name}: SKIP — ${result.reason}`);
      }
      continue;
    }

    problems.push(`${result.name}: unrecognised status "${result.status}"`);
  }

  const firstFailure = results.find(
    (result) => result.status === STATUS.FAIL && Number.isInteger(result.exitCode) && result.exitCode !== 0,
  );

  const exitCode = problems.length === 0 ? 0 : clampExitCode(firstFailure ? firstFailure.exitCode : 1);

  return {
    ok: problems.length === 0,
    exitCode,
    problems,
    counts: countByStatus(results),
    advisories: results.flatMap((result) =>
      (result.advisories ?? []).map((message) => ({ validator: result.name, message })),
    ),
  };
}

export function countByStatus(results = []) {
  const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIP: 0, NOT_APPLICABLE: 0 };
  for (const result of results) {
    if (counts[result.status] === undefined) counts[result.status] = 0;
    counts[result.status] += 1;
  }
  return counts;
}

/* ------------------------------------------------------------------------- *
 * Generated-artifact cleanup (SAFETY CRITICAL)
 * ------------------------------------------------------------------------- *
 * This cleanup exists so stale-artifact-validator sees a clean tree. Because it
 * deletes recursively it is treated as a destructive operation and is fully
 * path-constrained, never follows symlinks, and refuses anything git-tracked.
 * Every refusal is reported; nothing is deleted silently.
 */

export const GENERATED_DIRECTORY_NAMES = Object.freeze(
  new Set([
    ".next",
    ".turbo",
    "dist",
    ".dart_tool",
    "build",
    "coverage",
    ".cache",
    ".wrangler",
    ".vercel",
    ".symlinks",
    "Pods",
  ]),
);

// Installed workspace dependencies are inputs to the following validators/tests.
// Never delete them or descend into their package build directories.
const NEVER_WALK = new Set([".git", "node_modules"]);
const isGeneratedDirectoryName = (name, names = GENERATED_DIRECTORY_NAMES) =>
  names.has(name) || (names === GENERATED_DIRECTORY_NAMES && isNextSessionRuntimeDirectoryName(name));

/** Minimum depth (segments below repoRoot) a deletion target must sit at. */
const MINIMUM_TARGET_DEPTH = 2;

function isInside(parentAbs, childAbs) {
  const relative = path.relative(parentAbs, childAbs);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * Build a predicate answering "does this repository-relative directory contain
 * git-tracked files?". One `git ls-files` call, then prefix matching.
 */
export function createTrackedPathPredicate(repoRoot, { exec = execFileSync } = {}) {
  let trackedDirs;
  try {
    const output = exec("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    trackedDirs = new Set();
    for (const file of output.split("\0")) {
      if (!file) continue;
      const segments = file.split("/");
      for (let index = 1; index < segments.length; index += 1) {
        trackedDirs.add(segments.slice(0, index).join("/"));
      }
    }
  } catch {
    // Fail CLOSED: if tracked state cannot be established, treat every path as
    // tracked so nothing is deleted.
    return () => true;
  }

  return (relPath) => trackedDirs.has(relPath);
}

/**
 * Compute — without deleting anything — which generated directories may be
 * removed and which are refused, with a reason for every refusal.
 */
export function planGeneratedArtifactCleanup({
  repoRoot,
  startDirs = ["apps", "packages", "services"],
  isTracked = () => true,
  fsImpl = fs,
  generatedNames = GENERATED_DIRECTORY_NAMES,
} = {}) {
  const targets = [];
  const refusals = [];

  if (!repoRoot || !path.isAbsolute(repoRoot)) {
    return {
      targets,
      refusals: [{ relPath: String(repoRoot), reason: "repository root is not an absolute path" }],
      refusedEntirely: true,
    };
  }
  if (!fsImpl.existsSync(repoRoot)) {
    return {
      targets,
      refusals: [{ relPath: repoRoot, reason: "repository root does not exist" }],
      refusedEntirely: true,
    };
  }

  let realRoot;
  try {
    realRoot = fsImpl.realpathSync(repoRoot);
  } catch (error) {
    return {
      targets,
      refusals: [{ relPath: repoRoot, reason: `repository root could not be resolved: ${error.message}` }],
      refusedEntirely: true,
    };
  }

  const walk = (absDir) => {
    let entries;
    try {
      entries = fsImpl.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(absDir, entry.name);
      const relPath = path.relative(realRoot, absPath).split(path.sep).join("/");

      // Symlinks are NEVER followed and NEVER deleted: a symlink named
      // `node_modules` could point anywhere on the machine.
      if (entry.isSymbolicLink()) {
        if (isGeneratedDirectoryName(entry.name, generatedNames)) {
          refusals.push({ relPath, reason: "symlink — never followed and never deleted" });
        }
        continue;
      }
      if (!entry.isDirectory()) continue;
      if (NEVER_WALK.has(entry.name)) continue;

      if (!isGeneratedDirectoryName(entry.name, generatedNames)) {
        walk(absPath);
        continue;
      }

      const depth = relPath.split("/").filter(Boolean).length;
      if (depth < MINIMUM_TARGET_DEPTH) {
        refusals.push({ relPath, reason: `refused: depth ${depth} is above the minimum target depth ${MINIMUM_TARGET_DEPTH}` });
        continue;
      }

      let realTarget;
      try {
        realTarget = fsImpl.realpathSync(absPath);
      } catch (error) {
        refusals.push({ relPath, reason: `refused: path could not be resolved (${error.message})` });
        continue;
      }

      if (!isInside(realRoot, realTarget)) {
        refusals.push({ relPath, reason: "refused: resolves outside the repository root" });
        continue;
      }

      if (isTracked(relPath)) {
        refusals.push({ relPath, reason: "refused: contains git-tracked files — generated cleanup never deletes tracked content" });
        continue;
      }

      targets.push({ absPath: realTarget, relPath });
    }
  };

  for (const dir of startDirs) {
    const absStart = path.resolve(realRoot, dir);
    if (!isInside(realRoot, absStart)) {
      refusals.push({ relPath: dir, reason: "refused: start directory resolves outside the repository root" });
      continue;
    }
    if (!fsImpl.existsSync(absStart)) continue;
    walk(absStart);
  }

  targets.sort((a, b) => a.relPath.localeCompare(b.relPath));
  refusals.sort((a, b) => String(a.relPath).localeCompare(String(b.relPath)));

  return { targets, refusals, refusedEntirely: false };
}

/**
 * Execute a plan produced by planGeneratedArtifactCleanup. Only paths present in
 * `plan.targets` are removed; the guards are re-asserted immediately before each
 * removal so a stale plan cannot widen the blast radius.
 */
export function executeGeneratedArtifactCleanup(plan, { repoRoot, fsImpl = fs, log = () => {} } = {}) {
  const removed = [];
  const errors = [];
  const realRoot = fsImpl.realpathSync(repoRoot);

  for (const target of plan.targets ?? []) {
    if (!path.isAbsolute(target.absPath) || !isInside(realRoot, target.absPath)) {
      errors.push({ relPath: target.relPath, reason: "refused at execution time: outside the repository root" });
      continue;
    }
    if (!isGeneratedDirectoryName(path.basename(target.absPath))) {
      errors.push({ relPath: target.relPath, reason: "refused at execution time: basename is not a generated artifact directory" });
      continue;
    }

    try {
      fsImpl.rmSync(target.absPath, { recursive: true, force: true });
      removed.push(target.relPath);
      log(`generated-artifact cleanup: removed ${target.relPath}`);
    } catch (error) {
      errors.push({ relPath: target.relPath, reason: `removal failed: ${error.message}` });
    }
  }

  return { removed, errors };
}
