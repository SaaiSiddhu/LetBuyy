import {
  assertNoOffenders,
  phaseBExtraEntries,
} from "./phase-b-common.mjs";
import { createReporter, readFile } from "./governance-common.mjs";

const reporter = createReporter("Meta no-theater validator");

const forbiddenGateFragments = [
  "benchmark-certification",
  "convergence",
  "crdt",
  "distributed",
  "durable-execution",
  "failover",
  "lease",
  "multi-region",
  "partition-recovery",
  "projection",
  "replay",
  "saga",
  "survivability",
  "wal-",
];

const gateSources = [
  { path: "scripts/validate-governance.mjs", text: readFile("scripts/validate-governance.mjs") },
  ...phaseBExtraEntries().filter((entry) => entry.path === "scripts/validate-governance.mjs"),
];

const offenders = [];
for (const entry of gateSources) {
  const validatorsBlock = entry.text.match(/const\s+validators\s*=\s*\[[\s\S]*?\];/)?.[0] || "";
  for (const fragment of forbiddenGateFragments) {
    if (validatorsBlock.includes(fragment)) {
      offenders.push(`${entry.path}: gate lane contains theater validator fragment "${fragment}"`);
    }
  }
}

assertNoOffenders(reporter, offenders, "Governance gate must not certify rejected never-build capabilities");
reporter.finish("governance gate theater fragments checked");
