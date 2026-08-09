/**
 * Web V1 scope perimeter validator.
 *
 * Enforces config/governance/web-v1-scope-registry.json as a RATCHET.
 *
 * It does NOT assume the repository is clean. Nine capabilities the Web V1 brief
 * excludes are already live and unflagged at the recorded baseline SHA; those are
 * itemised in the registry under knownActivationsBaseline. This validator fails when
 * the set of activation signals GROWS beyond that recorded set, and when a recorded
 * signal disappears without the baseline being tightened in the same change.
 *
 * Usage:
 *   node scripts/validators/web-v1-scope-perimeter-validator.mjs            # enforce
 *   node scripts/validators/web-v1-scope-perimeter-validator.mjs --report   # print probe states, never fails
 *
 * There is deliberately no --update flag. The baseline is edited by a human so that
 * absorbing a new activation is always a reviewable diff.
 */

import fs from "node:fs";
import path from "node:path";

import {
  createReporter,
  exists,
  ignoredDirectoryNames,
  readFile,
  readJson,
  root,
  sourceExtensions,
} from "./governance-common.mjs";

const reporter = createReporter("Web V1 scope perimeter validator");
const reportOnly = process.argv.slice(2).includes("--report");

const registryPath = "config/governance/web-v1-scope-registry.json";
const gatePath = "scripts/validate-governance.mjs";

const registry = readJson(registryPath);

if (!registry) {
  reporter.assert(false, `${registryPath}: Web V1 scope registry is missing or unreadable`);
  reporter.finish("registry unreadable");
}

const enforcedClassifications = new Set([
  "WEB_V1_DEFERRED",
  "FORBIDDEN_FROZEN",
  "HUMAN_DECISION_REQUIRED",
]);
const knownClassifications = new Set([...enforcedClassifications, "WEB_V1_REQUIRED"]);
const knownEnforcementModes = new Set(["ratchet", "delegated", "none"]);

/* -------------------------------------------------------------------------- */
/* Registry structure                                                          */
/* -------------------------------------------------------------------------- */

reporter.assert(registry.schemaVersion === 1, `${registryPath}: schemaVersion must be 1`);
reporter.assert(
  registry.artifactClass === "GOVERNANCE_CONFIG_NOT_AUTHORITY",
  `${registryPath}: artifactClass must stay GOVERNANCE_CONFIG_NOT_AUTHORITY — this file must never present itself as governance authority`,
);
reporter.assert(
  typeof registry.baselineSha === "string" && /^[0-9a-f]{40}$/.test(registry.baselineSha),
  `${registryPath}: baselineSha must be a full 40-character commit SHA`,
);
reporter.assert(
  Array.isArray(registry.capabilities) && registry.capabilities.length > 0,
  `${registryPath}: capabilities must be a non-empty array`,
);

const capabilities = Array.isArray(registry.capabilities) ? registry.capabilities : [];
const capabilityById = new Map();

for (const capability of capabilities) {
  reporter.assert(
    typeof capability.id === "string" && capability.id.length > 0,
    `${registryPath}: every capability needs an id`,
  );
  if (typeof capability.id !== "string") continue;

  reporter.assert(
    !capabilityById.has(capability.id),
    `${registryPath}: duplicate capability id ${capability.id}`,
  );
  capabilityById.set(capability.id, capability);

  reporter.assert(
    knownClassifications.has(capability.classification),
    `${registryPath}: capability ${capability.id} has unknown classification ${capability.classification}`,
  );
  reporter.assert(
    knownEnforcementModes.has(capability.enforcement),
    `${registryPath}: capability ${capability.id} has unknown enforcement mode ${capability.enforcement}`,
  );

  // Anti-theater: an excluded capability must actually be enforced by something.
  if (enforcedClassifications.has(capability.classification)) {
    const hasProbes = Array.isArray(capability.probes) && capability.probes.length > 0;
    const hasDelegates =
      Array.isArray(capability.delegatedValidators) && capability.delegatedValidators.length > 0;
    reporter.assert(
      (capability.enforcement === "ratchet" && hasProbes) ||
        (capability.enforcement === "delegated" && hasDelegates),
      `${registryPath}: capability ${capability.id} is ${capability.classification} but carries no probe and no delegated validator — an unenforced perimeter entry is theater`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Human-decision invariants (Wave 0 must not manufacture a deferral)          */
/* -------------------------------------------------------------------------- */

const mustBeHumanDecision = registry.invariants?.mustBeHumanDecisionRequired ?? [];
reporter.assert(
  Array.isArray(mustBeHumanDecision) && mustBeHumanDecision.length > 0,
  `${registryPath}: invariants.mustBeHumanDecisionRequired must be a non-empty array`,
);

for (const id of mustBeHumanDecision) {
  const capability = capabilityById.get(id);
  reporter.assert(capability != null, `${registryPath}: invariant references unknown capability ${id}`);
  if (!capability) continue;
  reporter.assert(
    capability.classification === "HUMAN_DECISION_REQUIRED",
    `${registryPath}: capability ${id} must stay HUMAN_DECISION_REQUIRED (found ${capability.classification}). No ARB amendment authorises reclassifying it.`,
  );
  reporter.assert(
    typeof capability.humanDecisionNote === "string" && capability.humanDecisionNote.length > 40,
    `${registryPath}: capability ${id} must carry a humanDecisionNote explaining why the decision is still open`,
  );
}

const forbiddenClassificationsFor = registry.invariants?.forbiddenClassificationsFor ?? {};
for (const [id, forbidden] of Object.entries(forbiddenClassificationsFor)) {
  const capability = capabilityById.get(id);
  if (!capability) continue;
  reporter.assert(
    !forbidden.includes(capability.classification),
    `${registryPath}: capability ${id} must not be classified ${capability.classification}`,
  );
}

/* -------------------------------------------------------------------------- */
/* Delegated enforcement must stay real and wired                              */
/* -------------------------------------------------------------------------- */

const gateSource = exists(gatePath) ? readFile(gatePath) : "";
reporter.assert(gateSource.length > 0, `${gatePath} must be readable to verify delegated validators`);

for (const capability of capabilities) {
  if (capability.enforcement !== "delegated") continue;
  for (const delegate of capability.delegatedValidators ?? []) {
    reporter.assert(
      exists(`scripts/validators/${delegate}`),
      `${registryPath}: capability ${capability.id} delegates to scripts/validators/${delegate}, which does not exist`,
    );
    reporter.assert(
      gateSource.includes(`"${delegate}"`),
      `${registryPath}: capability ${capability.id} delegates to ${delegate}, which is not wired into the ${gatePath} gate lane`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Probe evaluation                                                            */
/* -------------------------------------------------------------------------- */

const scanCache = new Map();

function listSourceFiles(relRoot) {
  if (scanCache.has(relRoot)) return scanCache.get(relRoot);

  const files = [];
  const absRoot = path.join(root, relRoot);

  function walk(absDir, relDir) {
    if (!fs.existsSync(absDir)) return;
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (ignoredDirectoryNames.has(entry.name)) continue;
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const absPath = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        walk(absPath, relPath);
      } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
        files.push(`${relRoot}/${relPath}`);
      }
    }
  }

  walk(absRoot, "");
  scanCache.set(relRoot, files);
  return files;
}

function compile(probe) {
  return new RegExp(probe.pattern, probe.patternFlags ?? "");
}

/**
 * Returns { active: boolean, hits: string[] }.
 * `hits` is capped so a failure message stays readable.
 */
function evaluateProbe(capability, probe) {
  const hits = [];

  if (probe.kind === "path") {
    for (const candidate of probe.paths ?? []) {
      if (exists(candidate)) hits.push(candidate);
    }
  } else if (probe.kind === "content") {
    const pattern = compile(probe);
    for (const file of probe.files ?? []) {
      if (!exists(file)) continue;
      const source = readFile(file);
      if (pattern.test(source)) hits.push(file);
    }
  } else if (probe.kind === "scan") {
    const pattern = compile(probe);
    const exclude = probe.excludePathPattern ? new RegExp(probe.excludePathPattern) : null;
    outer: for (const scanRoot of probe.roots ?? []) {
      for (const file of listSourceFiles(scanRoot)) {
        if (exclude && exclude.test(file)) continue;
        if (pattern.test(readFile(file))) {
          hits.push(file);
          if (hits.length >= 5) break outer;
        }
      }
    }
  } else {
    reporter.assert(false, `${registryPath}: capability ${capability.id} probe ${probe.id} has unknown kind ${probe.kind}`);
  }

  return { active: hits.length > 0, hits };
}

const observed = new Map(); // signal id -> { capability, probe, hits }

for (const capability of capabilities) {
  if (capability.enforcement !== "ratchet") continue;
  const seenProbeIds = new Set();
  for (const probe of capability.probes ?? []) {
    reporter.assert(
      typeof probe.id === "string" && probe.id.length > 0,
      `${registryPath}: capability ${capability.id} has a probe without an id`,
    );
    if (typeof probe.id !== "string") continue;
    reporter.assert(
      !seenProbeIds.has(probe.id),
      `${registryPath}: capability ${capability.id} has duplicate probe id ${probe.id}`,
    );
    seenProbeIds.add(probe.id);

    const signal = `${capability.id}::${probe.id}`;
    const result = evaluateProbe(capability, probe);
    if (result.active) observed.set(signal, { capability, probe, hits: result.hits });
  }
}

/* -------------------------------------------------------------------------- */
/* Baseline integrity                                                          */
/* -------------------------------------------------------------------------- */

const baseline = registry.knownActivationsBaseline ?? {};
const baselineSignals = Array.isArray(baseline.signals) ? baseline.signals : [];

reporter.assert(
  typeof baseline.heading === "string" && baseline.heading.includes("NOT A CLEAN STATE"),
  `${registryPath}: knownActivationsBaseline.heading must state plainly that the baseline is NOT a clean state`,
);
reporter.assert(
  baseline.recordedCount === baselineSignals.length,
  `${registryPath}: knownActivationsBaseline.recordedCount (${baseline.recordedCount}) must equal the number of recorded signals (${baselineSignals.length})`,
);

const baselineById = new Map();
for (const entry of baselineSignals) {
  reporter.assert(
    typeof entry.signal === "string" && entry.signal.includes("::"),
    `${registryPath}: baseline entry must use the <capability>::<probe> signal form`,
  );
  if (typeof entry.signal !== "string") continue;
  reporter.assert(
    !baselineById.has(entry.signal),
    `${registryPath}: duplicate baseline signal ${entry.signal}`,
  );
  baselineById.set(entry.signal, entry);

  reporter.assert(
    typeof entry.evidence === "string" && entry.evidence.length > 20,
    `${registryPath}: baseline signal ${entry.signal} must carry evidence naming the file or mount that makes it active`,
  );

  const [capabilityId, probeId] = entry.signal.split("::");
  const capability = capabilityById.get(capabilityId);
  reporter.assert(
    capability != null,
    `${registryPath}: baseline signal ${entry.signal} references unknown capability ${capabilityId}`,
  );
  if (!capability) continue;
  reporter.assert(
    (capability.probes ?? []).some((probe) => probe.id === probeId),
    `${registryPath}: baseline signal ${entry.signal} references unknown probe ${probeId}`,
  );
  reporter.assert(
    enforcedClassifications.has(capability.classification),
    `${registryPath}: baseline signal ${entry.signal} belongs to ${capability.classification} capability ${capabilityId}; only excluded, forbidden or unratified capabilities are baselined`,
  );
}

/* -------------------------------------------------------------------------- */
/* The ratchet                                                                 */
/* -------------------------------------------------------------------------- */

const newActivations = [];
for (const [signal, detail] of [...observed.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (baselineById.has(signal)) continue;
  newActivations.push(
    `${signal} [${detail.capability.classification}] activated by: ${detail.hits.join(", ")}`,
  );
}

reporter.assert(
  newActivations.length === 0,
  [
    "NEW activation of an excluded or forbidden Web V1 capability detected.",
    "The Web V1 perimeter is frozen at " + registry.baselineSha + ".",
    "If this activation is intended, it needs a human decision recorded in " + registryPath + " before the gate can pass.",
    ...newActivations.map((line) => `  - ${line}`),
  ].join("\n"),
);

const staleBaseline = [];
const expectedRemovals = [];
for (const entry of baselineSignals) {
  if (observed.has(entry.signal)) continue;
  if (entry.expectedRemoval === true) {
    expectedRemovals.push(entry.signal);
    continue;
  }
  staleBaseline.push(entry.signal);
}

reporter.assert(
  staleBaseline.length === 0,
  [
    "Stale known-violations baseline entries: these capabilities are no longer active, so the ratchet must tighten.",
    "Remove these entries from knownActivationsBaseline.signals (and decrement recordedCount) in the same change:",
    ...staleBaseline.map((signal) => `  - ${signal}`),
  ].join("\n"),
);

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

if (reportOnly) {
  console.log(`Web V1 scope perimeter report — registry baseline ${registry.baselineSha}`);
  console.log(`Known-violations baseline: ${baselineSignals.length} signal(s) recorded as ALREADY ACTIVE. This is NOT a clean state.`);
  for (const capability of capabilities) {
    if (capability.enforcement !== "ratchet") continue;
    for (const probe of capability.probes ?? []) {
      const signal = `${capability.id}::${probe.id}`;
      const isActive = observed.has(signal);
      const isBaselined = baselineById.has(signal);
      const state = isActive
        ? isBaselined
          ? "ACTIVE (baselined)"
          : "ACTIVE (NEW — would fail)"
        : isBaselined
          ? "INACTIVE (stale baseline entry)"
          : "INACTIVE";
      console.log(`  ${capability.classification.padEnd(24)} ${signal.padEnd(58)} ${state}`);
    }
  }
  console.log(`Report mode: no assertions enforced. Exit 0.`);
  process.exit(0);
}

for (const signal of expectedRemovals) {
  console.log(
    `Web V1 scope perimeter note: baselined signal ${signal} is no longer active and was marked expectedRemoval; tighten the baseline when the owning change lands.`,
  );
}

const ratchetedCapabilities = capabilities.filter((capability) => capability.enforcement === "ratchet").length;
const delegatedCapabilities = capabilities.filter((capability) => capability.enforcement === "delegated").length;

reporter.finish(
  `${capabilities.length} capabilities registered; ${ratchetedCapabilities} ratcheted, ${delegatedCapabilities} delegated; ${baselineSignals.length} known pre-existing activations held flat; 0 new activations`,
);
