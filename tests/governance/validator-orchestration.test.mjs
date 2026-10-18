/**
 * Proves the governance runner cannot report a false green.
 *
 * Required proofs (Wave 0 validator-runner truthfulness repair):
 *   (a) a failure in validator 1 does not stop validators 2..N from RUNNING and
 *       being REPORTED
 *   (b) the overall exit stays non-zero when any required validator fails
 *   (c) missing validator dependencies are reported as BLOCKED, never as passed
 *   (d) empty discovery CANNOT return green
 *   (e) a skipped REQUIRED validator cannot silently pass
 *
 * Plus the safety-critical proofs for the generated-artifact cleanup that runs
 * at gate index ~70 and had never executed before this repair.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  STATUS,
  buildRunPlan,
  computeGateOutcome,
  createTrackedPathPredicate,
  discoverValidatorModules,
  executeGeneratedArtifactCleanup,
  planGeneratedArtifactCleanup,
  reconcileValidatorInventory,
  runValidators,
} from "../../scripts/governance/validator-orchestrator.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `letbuyy-${prefix}-`));
}

/** Build a fixture validators directory of trivial pass/fail scripts. */
function makeValidatorFixture(spec) {
  const dir = makeTempDir("validators");
  const validatorsDir = path.join(dir, "scripts", "validators");
  fs.mkdirSync(validatorsDir, { recursive: true });

  for (const [name, exitCode] of Object.entries(spec)) {
    fs.writeFileSync(
      path.join(validatorsDir, name),
      `console.log(${JSON.stringify(`${name} ran`)});\nprocess.exit(${exitCode});\n`,
      "utf8",
    );
  }

  return { dir, validatorsDir };
}

function silentRun(options) {
  return runValidators({ writeOut: () => {}, writeErr: () => {}, ...options });
}

/* ------------------------------------------------------------------ (a) + (b) */

test("(a) a failing validator does not stop the remaining validators from running and being reported", () => {
  const { validatorsDir } = makeValidatorFixture({
    "a-validator.mjs": 1,
    "b-validator.mjs": 0,
    "c-validator.mjs": 3,
    "d-validator.mjs": 0,
  });

  const manifest = ["a-validator.mjs", "b-validator.mjs", "c-validator.mjs", "d-validator.mjs"];
  const inventory = reconcileValidatorInventory({
    discovered: discoverValidatorModules(validatorsDir),
    gateManifest: manifest,
  });
  const plan = buildRunPlan({ lane: "gate", gateManifest: manifest, inventory, validatorsDir });
  const results = silentRun({ plan, cwd: validatorsDir });

  assert.equal(results.length, 4, "every declared validator must appear in the report");
  assert.deepEqual(
    results.map((result) => `${result.name}:${result.status}`),
    ["a-validator.mjs:FAIL", "b-validator.mjs:PASS", "c-validator.mjs:FAIL", "d-validator.mjs:PASS"],
    "validators after the first failure must still run and be reported",
  );
  // Individual exit codes are preserved, not collapsed.
  assert.equal(results[0].exitCode, 1);
  assert.equal(results[2].exitCode, 3);
});

test("(b) the overall outcome is non-zero when any required validator fails", () => {
  const { validatorsDir } = makeValidatorFixture({ "ok-validator.mjs": 0, "bad-validator.mjs": 7 });
  const manifest = ["ok-validator.mjs", "bad-validator.mjs"];
  const inventory = reconcileValidatorInventory({ discovered: discoverValidatorModules(validatorsDir), gateManifest: manifest });
  const plan = buildRunPlan({ lane: "gate", gateManifest: manifest, inventory, validatorsDir });
  const results = silentRun({ plan, cwd: validatorsDir });

  const outcome = computeGateOutcome({ results, inventoryProblems: inventory.problems });

  assert.equal(outcome.ok, false);
  assert.notEqual(outcome.exitCode, 0);
  assert.equal(outcome.exitCode, 7, "the failing validator's own exit code is preserved");
  assert.ok(outcome.problems.some((problem) => problem.includes("bad-validator.mjs")));
});

test("(b) an all-pass run is the only path to exit 0", () => {
  const { validatorsDir } = makeValidatorFixture({ "one-validator.mjs": 0, "two-validator.mjs": 0 });
  const manifest = ["one-validator.mjs", "two-validator.mjs"];
  const inventory = reconcileValidatorInventory({ discovered: discoverValidatorModules(validatorsDir), gateManifest: manifest });
  const plan = buildRunPlan({ lane: "gate", gateManifest: manifest, inventory, validatorsDir });
  const results = silentRun({ plan, cwd: validatorsDir });

  const outcome = computeGateOutcome({ results, inventoryProblems: inventory.problems });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.counts.PASS, 2);
});

/* ------------------------------------------------------------------------ (c) */

test("(c) a declared validator missing from disk is BLOCKED, never PASS", () => {
  const { validatorsDir } = makeValidatorFixture({ "present-validator.mjs": 0 });
  const manifest = ["present-validator.mjs", "absent-validator.mjs"];
  const inventory = reconcileValidatorInventory({ discovered: discoverValidatorModules(validatorsDir), gateManifest: manifest });
  const plan = buildRunPlan({ lane: "gate", gateManifest: manifest, inventory, validatorsDir });
  const results = silentRun({ plan, cwd: validatorsDir });

  const blocked = results.find((result) => result.name === "absent-validator.mjs");
  assert.equal(blocked.status, STATUS.BLOCKED);
  assert.match(blocked.reason, /missing dependency/);
  assert.notEqual(blocked.status, STATUS.PASS);

  const outcome = computeGateOutcome({ results, inventoryProblems: inventory.problems });
  assert.equal(outcome.ok, false);
  assert.notEqual(outcome.exitCode, 0);
  assert.ok(inventory.missing.includes("absent-validator.mjs"));
});

test("(c) an unreadable/unspawnable validator is BLOCKED, never PASS", () => {
  const { validatorsDir } = makeValidatorFixture({ "spawn-fail-validator.mjs": 0 });
  const manifest = ["spawn-fail-validator.mjs"];
  const inventory = reconcileValidatorInventory({ discovered: discoverValidatorModules(validatorsDir), gateManifest: manifest });
  const plan = buildRunPlan({ lane: "gate", gateManifest: manifest, inventory, validatorsDir });

  const results = silentRun({
    plan,
    cwd: validatorsDir,
    spawnSync: () => ({ error: new Error("spawn ENOENT"), status: null, stdout: "", stderr: "" }),
  });

  assert.equal(results[0].status, STATUS.BLOCKED);
  assert.match(results[0].reason, /could not execute validator/);
  assert.equal(computeGateOutcome({ results }).ok, false);
});

test("(c) a validator that exceeds its timeout is BLOCKED, never PASS", () => {
  const { validatorsDir } = makeValidatorFixture({ "hang-validator.mjs": 0 });
  const manifest = ["hang-validator.mjs"];
  const inventory = reconcileValidatorInventory({ discovered: discoverValidatorModules(validatorsDir), gateManifest: manifest });
  const plan = buildRunPlan({ lane: "gate", gateManifest: manifest, inventory, validatorsDir });

  const timeoutError = new Error("spawnSync ETIMEDOUT");
  timeoutError.code = "ETIMEDOUT";
  const results = silentRun({
    plan,
    cwd: validatorsDir,
    spawnSync: () => ({ error: timeoutError, status: null, signal: "SIGTERM", stdout: "", stderr: "" }),
  });

  assert.equal(results[0].status, STATUS.BLOCKED);
  assert.match(results[0].reason, /timeout/);
  assert.equal(computeGateOutcome({ results }).ok, false);
});

test("(c) a validator whose imports cannot be resolved is BLOCKED, never PASS or a bare FAIL", () => {
  const { validatorsDir } = makeValidatorFixture({ "unresolvable-validator.mjs": 0 });
  fs.writeFileSync(
    path.join(validatorsDir, "unresolvable-validator.mjs"),
    'import "definitely-not-installed-package";\n',
    "utf8",
  );

  const manifest = ["unresolvable-validator.mjs"];
  const inventory = reconcileValidatorInventory({ discovered: discoverValidatorModules(validatorsDir), gateManifest: manifest });
  const plan = buildRunPlan({ lane: "gate", gateManifest: manifest, inventory, validatorsDir });
  const results = silentRun({ plan, cwd: validatorsDir });

  assert.equal(results[0].status, STATUS.BLOCKED, "an unresolvable import means the invariant never ran");
  assert.match(results[0].reason, /missing dependency/);
  assert.notEqual(results[0].exitCode, 0, "the validator's own exit code is preserved");

  const outcome = computeGateOutcome({ results, inventoryProblems: inventory.problems });
  assert.equal(outcome.ok, false);
  assert.notEqual(outcome.exitCode, 0);
});

/* ------------------------------------------------------------------------ (d) */

test("(d) empty discovery cannot return green", () => {
  const emptyDir = path.join(makeTempDir("empty"), "scripts", "validators");
  fs.mkdirSync(emptyDir, { recursive: true });

  const discovered = discoverValidatorModules(emptyDir);
  assert.deepEqual(discovered, []);

  const inventory = reconcileValidatorInventory({ discovered, gateManifest: [] });
  assert.ok(inventory.problems.length > 0, "an empty inventory must raise problems");

  const plan = buildRunPlan({ lane: "gate", gateManifest: [], inventory, validatorsDir: emptyDir });
  const results = silentRun({ plan, cwd: emptyDir });

  const outcome = computeGateOutcome({ results, inventoryProblems: inventory.problems });
  assert.equal(outcome.ok, false, "an empty run must never be green");
  assert.notEqual(outcome.exitCode, 0);
  assert.ok(outcome.problems.some((problem) => /empty governance run|zero modules|no executable/i.test(problem)));
});

test("(d) a missing validators directory cannot return green", () => {
  const missingDir = path.join(makeTempDir("missing"), "does-not-exist");

  const discovered = discoverValidatorModules(missingDir);
  assert.deepEqual(discovered, []);

  const inventory = reconcileValidatorInventory({ discovered, gateManifest: [] });
  const outcome = computeGateOutcome({ results: [], inventoryProblems: inventory.problems });
  assert.equal(outcome.ok, false);
  assert.notEqual(outcome.exitCode, 0);
});

test("(d) an undeclared validator on disk is drift, not a silent pass", () => {
  const { validatorsDir } = makeValidatorFixture({ "declared-validator.mjs": 0, "orphan-validator.mjs": 0 });
  const inventory = reconcileValidatorInventory({
    discovered: discoverValidatorModules(validatorsDir),
    gateManifest: ["declared-validator.mjs"],
  });

  assert.deepEqual(inventory.undeclared, ["orphan-validator.mjs"]);
  assert.ok(inventory.problems.some((problem) => problem.includes("orphan-validator.mjs")));

  const plan = buildRunPlan({ lane: "gate", gateManifest: ["declared-validator.mjs"], inventory, validatorsDir });
  const results = silentRun({ plan, cwd: validatorsDir });
  const outcome = computeGateOutcome({ results, inventoryProblems: inventory.problems });

  assert.equal(outcome.ok, false, "inventory drift must never be reported as green");
});

/* ------------------------------------------------------------------------ (e) */

test("(e) a skipped REQUIRED validator cannot silently pass", () => {
  const { validatorsDir } = makeValidatorFixture({ "skipped-validator.mjs": 0, "other-validator.mjs": 0 });
  const manifest = ["skipped-validator.mjs", "other-validator.mjs"];
  const inventory = reconcileValidatorInventory({ discovered: discoverValidatorModules(validatorsDir), gateManifest: manifest });
  const plan = buildRunPlan({ lane: "gate", gateManifest: manifest, inventory, validatorsDir });

  const results = silentRun({
    plan,
    cwd: validatorsDir,
    beforeValidator: (entry) =>
      entry.name === "skipped-validator.mjs" ? { status: STATUS.SKIP, reason: "fixture skip" } : null,
  });

  const skipped = results.find((result) => result.name === "skipped-validator.mjs");
  assert.equal(skipped.status, STATUS.SKIP);
  assert.equal(skipped.required, true, "manifest validators are required unless explicitly declared optional");
  assert.equal(skipped.reason, "fixture skip");

  const outcome = computeGateOutcome({ results, inventoryProblems: inventory.problems });
  assert.equal(outcome.ok, false);
  assert.notEqual(outcome.exitCode, 0);
  assert.ok(outcome.problems.some((problem) => /SKIP of a REQUIRED validator/.test(problem)));
});

test("(e) a preflight hook cannot upgrade a validator to PASS", () => {
  const { validatorsDir } = makeValidatorFixture({ "guarded-validator.mjs": 1 });
  const manifest = ["guarded-validator.mjs"];
  const inventory = reconcileValidatorInventory({ discovered: discoverValidatorModules(validatorsDir), gateManifest: manifest });
  const plan = buildRunPlan({ lane: "gate", gateManifest: manifest, inventory, validatorsDir });

  const results = silentRun({
    plan,
    cwd: validatorsDir,
    beforeValidator: () => ({ status: STATUS.PASS, reason: "attempted rubber stamp" }),
  });

  assert.equal(results[0].status, STATUS.BLOCKED, "only SKIP and BLOCKED may withhold execution");
  assert.equal(computeGateOutcome({ results }).ok, false);
});

test("(e) SKIP and BLOCKED always carry an explicit reason", () => {
  const { validatorsDir } = makeValidatorFixture({ "reasonless-validator.mjs": 0 });
  const manifest = ["reasonless-validator.mjs"];
  const inventory = reconcileValidatorInventory({ discovered: discoverValidatorModules(validatorsDir), gateManifest: manifest });
  const plan = buildRunPlan({ lane: "gate", gateManifest: manifest, inventory, validatorsDir });

  const results = silentRun({
    plan,
    cwd: validatorsDir,
    beforeValidator: () => ({ status: STATUS.SKIP }),
  });

  assert.equal(results[0].status, STATUS.SKIP);
  assert.ok(results[0].reason && results[0].reason.length > 0, "a reasonless skip must still be given a reason");
});

/* --------------------------------------------------------- lane accounting */

test("validators outside the selected lane are NOT_APPLICABLE with a reason, not omitted", () => {
  const { validatorsDir } = makeValidatorFixture({ "gate-validator.mjs": 0, "report-validator.mjs": 0 });
  const inventory = reconcileValidatorInventory({
    discovered: discoverValidatorModules(validatorsDir),
    gateManifest: ["gate-validator.mjs"],
    reportManifest: ["report-validator.mjs"],
  });
  const plan = buildRunPlan({
    lane: "gate",
    gateManifest: ["gate-validator.mjs"],
    reportManifest: ["report-validator.mjs"],
    inventory,
    validatorsDir,
  });
  const results = silentRun({ plan, cwd: validatorsDir });

  const notApplicable = results.find((result) => result.name === "report-validator.mjs");
  assert.equal(notApplicable.status, STATUS.NOT_APPLICABLE);
  assert.match(notApplicable.reason, /lane=gate/);
  assert.equal(computeGateOutcome({ results, inventoryProblems: inventory.problems }).ok, true);
});

/* --------------------------------------------- generated-artifact cleanup */

test("Next session runtime cleanup planning is narrow and preserves tracked or linked roots", () => {
  const root = makeTempDir("cleanup-next-runtime");
  const outside = makeTempDir("cleanup-next-runtime-outside");
  for (const name of [".next-session-runtime-123-commerce-next", ".next-session-runtime-456-identity-next", ".next-source", ".next-session-runtime_invalid"]) {
    fs.mkdirSync(path.join(root, "apps", "web", name), {recursive:true});
  }
  fs.symlinkSync(outside, path.join(root, "apps", "web", ".next-session-runtime-789-linked"), "dir");
  const plan = planGeneratedArtifactCleanup({
    repoRoot:root,
    isTracked:relPath => relPath === "apps/web/.next-session-runtime-456-identity-next",
  });
  assert.deepEqual(plan.targets.map(target => target.relPath), ["apps/web/.next-session-runtime-123-commerce-next"]);
  assert.ok(plan.refusals.some(refusal => refusal.relPath.endsWith("456-identity-next") && /git-tracked/.test(refusal.reason)));
  assert.ok(plan.refusals.some(refusal => refusal.relPath.endsWith("789-linked") && /symlink/.test(refusal.reason)));
  assert.equal(fs.existsSync(path.join(root, "apps", "web", ".next-source")),true);
});

test("cleanup only targets generated directory names inside the repository root", () => {
  const root = makeTempDir("cleanup-scope");
  fs.mkdirSync(path.join(root, "apps", "web", "node_modules", "pkg"), { recursive: true });
  fs.mkdirSync(path.join(root, "apps", "web", "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "apps", "web", "src", "index.ts"), "export {};\n");

  const plan = planGeneratedArtifactCleanup({ repoRoot: root, isTracked: () => false });

  assert.deepEqual(plan.targets.map((target) => target.relPath), ["apps/web/node_modules"]);

  executeGeneratedArtifactCleanup(plan, { repoRoot: root });
  assert.equal(fs.existsSync(path.join(root, "apps", "web", "node_modules")), false);
  assert.equal(fs.existsSync(path.join(root, "apps", "web", "src", "index.ts")), true, "user source must survive");
});

test("cleanup refuses git-tracked directories", () => {
  const root = makeTempDir("cleanup-tracked");
  fs.mkdirSync(path.join(root, "packages", "core", "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "packages", "core", "dist", "committed.js"), "// tracked\n");

  const plan = planGeneratedArtifactCleanup({
    repoRoot: root,
    isTracked: (relPath) => relPath === "packages/core/dist",
  });

  assert.deepEqual(plan.targets, []);
  assert.ok(plan.refusals.some((refusal) => /git-tracked/.test(refusal.reason)));

  executeGeneratedArtifactCleanup(plan, { repoRoot: root });
  assert.equal(fs.existsSync(path.join(root, "packages", "core", "dist", "committed.js")), true);
});

test("cleanup never follows or deletes symlinks", () => {
  const root = makeTempDir("cleanup-symlink");
  const outside = makeTempDir("cleanup-outside");
  fs.mkdirSync(path.join(outside, "precious"), { recursive: true });
  fs.writeFileSync(path.join(outside, "precious", "user-file.txt"), "do not delete\n");

  fs.mkdirSync(path.join(root, "services", "api"), { recursive: true });
  fs.symlinkSync(path.join(outside, "precious"), path.join(root, "services", "api", "node_modules"), "dir");

  const plan = planGeneratedArtifactCleanup({ repoRoot: root, isTracked: () => false });

  assert.deepEqual(plan.targets, [], "a symlinked generated directory must never be a deletion target");
  assert.ok(plan.refusals.some((refusal) => /symlink/.test(refusal.reason)));

  executeGeneratedArtifactCleanup(plan, { repoRoot: root });
  assert.equal(fs.existsSync(path.join(outside, "precious", "user-file.txt")), true, "files outside the repo must survive");
});

test("cleanup refuses a non-absolute or non-existent repository root", () => {
  const relative = planGeneratedArtifactCleanup({ repoRoot: "apps", isTracked: () => false });
  assert.equal(relative.refusedEntirely, true);
  assert.deepEqual(relative.targets, []);

  const missing = planGeneratedArtifactCleanup({
    repoRoot: path.join(os.tmpdir(), "letbuyy-definitely-missing-root"),
    isTracked: () => false,
  });
  assert.equal(missing.refusedEntirely, true);
  assert.deepEqual(missing.targets, []);
});

test("cleanup refuses start directories that escape the repository root", () => {
  const root = makeTempDir("cleanup-escape");
  fs.mkdirSync(path.join(root, "apps"), { recursive: true });

  const plan = planGeneratedArtifactCleanup({
    repoRoot: root,
    startDirs: ["../..", "/", "apps"],
    isTracked: () => false,
  });

  assert.deepEqual(plan.targets, []);
  assert.ok(plan.refusals.some((refusal) => /outside the repository root/.test(refusal.reason)));
});

test("cleanup execution re-asserts its guards and refuses a widened plan", () => {
  const root = makeTempDir("cleanup-widen");
  const outside = makeTempDir("cleanup-widen-outside");
  fs.mkdirSync(path.join(outside, "node_modules"), { recursive: true });
  fs.writeFileSync(path.join(outside, "node_modules", "keep.txt"), "keep\n");

  const forged = { targets: [{ absPath: path.join(outside, "node_modules"), relPath: "../escaped/node_modules" }] };
  const executed = executeGeneratedArtifactCleanup(forged, { repoRoot: root });

  assert.deepEqual(executed.removed, []);
  assert.ok(executed.errors.some((error) => /outside the repository root/.test(error.reason)));
  assert.equal(fs.existsSync(path.join(outside, "node_modules", "keep.txt")), true);
});

test("the tracked-path predicate fails CLOSED when git state cannot be read", () => {
  const predicate = createTrackedPathPredicate("/nonexistent-repo-root", {
    exec: () => {
      throw new Error("not a git repository");
    },
  });

  assert.equal(predicate("apps/web/node_modules"), true, "unknown tracked state must block deletion, not allow it");
});

/* ------------------------------------------------------- real runner wiring */

test("the real gate discovers its validators dynamically and declares no hardcoded count", () => {
  const source = fs.readFileSync(path.join(repoRoot, "scripts/validate-governance.mjs"), "utf8");

  assert.match(source, /discoverValidatorModules\(/, "the runner must discover validators from disk");
  assert.match(source, /reconcileValidatorInventory\(/, "the runner must reconcile disk against the declared lanes");
  assert.doesNotMatch(
    source,
    /\b10[78]\s+validators?\b/i,
    "the runner must not restate a frozen validator count",
  );

  const onDisk = discoverValidatorModules(path.join(repoRoot, "scripts", "validators"));
  assert.ok(onDisk.length > 0, "the real validator directory must not be empty");
});

test("the real gate reports a truthful inventory in --plan mode", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-governance.mjs", "--lane=gate", "--plan"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.match(result.stdout, /NO VALIDATORS EXECUTED/, "--plan must never be mistaken for a gate result");
  assert.match(result.stdout, /discovered on disk\s+:\s+\d+ \.mjs modules/);
  assert.match(result.stdout, /executable validators:\s+\d+/);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("the real gate rejects an unknown lane", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-governance.mjs", "--lane=green"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid governance lane/);
});

test("no gate-lane validator can report a non-blocking finding without declaring it", () => {
  const validatorsDir = path.join(repoRoot, "scripts", "validators");
  const offenders = [];

  for (const name of discoverValidatorModules(validatorsDir)) {
    if (name === "governance-common.mjs") continue;
    const source = fs
      .readFileSync(path.join(validatorsDir, name), "utf8")
      .split(/\r?\n/)
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    if (/reporter\.warn\(/.test(source)) offenders.push(name);
  }

  assert.deepEqual(
    offenders,
    [],
    "reporter.warn() is the silent non-blocking path; use assert() to block or advisory() to declare",
  );
});
