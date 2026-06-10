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

const marketplaceFrozenSources = [
  "docs/apps-marketplace-developer/getting-started.md",
  "docs/apps-marketplace-developer/manifest-spec.md",
  "docs/apps-marketplace-developer/api-reference.md",
  "apps/app-marketplace/src/app/(auth)/developers/page.tsx",
  "apps/app-marketplace/src/app/(auth)/developers/docs/page.tsx",
  "apps/app-marketplace/src/app/(auth)/developers/docs/[topic]/page.tsx",
];
for (const sourcePath of marketplaceFrozenSources) {
  const source = readFile(sourcePath);
  reporter.assert(
    source.includes("frozen") ||
      source.includes("Frozen") ||
      source.includes("human-approved") ||
      source.includes("SKIP-CAP-CHECKOUT-WASM-RETIREMENT"),
    `${sourcePath} must disclose the app-marketplace frozen seam before describing developer flows`,
  );
}
const marketplaceLaunchFragments = [
  "goes live in the App Store",
  "Reach thousands of Indian",
  "public app-store launch",
];
const marketplaceLaunchOffenders = [];
for (const sourcePath of marketplaceFrozenSources) {
  const source = readFile(sourcePath);
  for (const fragment of marketplaceLaunchFragments) {
    if (source.includes(fragment)) {
      marketplaceLaunchOffenders.push(`${sourcePath}: active marketplace developer surface contains launch phrase "${fragment}"`);
    }
  }
}
assertNoOffenders(
  reporter,
  marketplaceLaunchOffenders,
  "Active marketplace developer surfaces must be frozen-seam docs, not public launch marketing",
);

reporter.finish("governance gate, active identity doc, and marketplace frozen-seam fragments checked");
