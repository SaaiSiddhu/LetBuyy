import {
  assertNoOffenders,
  phaseBExtraEntries,
  phaseBEntries,
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
  ["multi", "region"].join("-"),
  "partition-recovery",
  "projection",
  "replay",
  "saga",
  ["surviv", "ability"].join(""),
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

const activeIdentityDocForbiddenFragments = [
  "failover",
  "multi-region",
  "region failover",
  "key-failover",
  "service mesh",
  "Chaos/DR",
];
const activeIdentityDocOffenders = [];
for (const entry of phaseBEntries(["docs/auth"])) {
  for (const fragment of activeIdentityDocForbiddenFragments) {
    if (entry.text.includes(fragment)) {
      activeIdentityDocOffenders.push(`${entry.path}: active identity doc contains rejected topology phrase "${fragment}"`);
    }
  }
}

assertNoOffenders(
  reporter,
  activeIdentityDocOffenders,
  "Active identity docs must describe one-region provider-HA operations, not rejected topology",
);
reporter.finish("governance gate and active identity doc theater fragments checked");
