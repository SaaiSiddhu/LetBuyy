import { createReporter, readFile } from "./governance-common.mjs";

const reporter = createReporter("Phase C forced decisions validator");

const rootAgents = readFile("AGENTS.md");
const sourceAgents = readFile("GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md");
const canonicalSystems = readFile("GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md");
const legacyPlan = readFile("GOVERNANCE_REWRITE_2026_06_10/LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md");
const roadmap = readFile("GOVERNANCE_REWRITE_2026_06_10/LETBUYY_FOUNDATION_ROADMAP.md");
const skipped = readFile("SKIPPED_HUMAN_DECISIONS.md");

const activeGovernanceDocs = [
  ["AGENTS.md", rootAgents],
  ["LETBUYY_AGENTS_V2.md", sourceAgents],
  ["LETBUYY_CANONICAL_SYSTEMS.md", canonicalSystems],
  ["LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md", legacyPlan],
  ["LETBUYY_FOUNDATION_ROADMAP.md", roadmap],
];

for (const [path, text] of activeGovernanceDocs) {
  reporter.assert(
    !/ops[- ]console[\s\S]{0,180}(tentative|UNVERIFIED|ARB decision, not a code fact)/i.test(text),
    `${path} must not leave the ops-console survivor tentative or UNVERIFIED`,
  );
  reporter.assert(
    !/Which ops console survives/i.test(text),
    `${path} must not keep the old unresolved ops-console question`,
  );
}

reporter.assert(
  /GATE-OPS-SURVIVOR/.test(legacyPlan)
    && /\| LEG-022 \| `apps\/platform-console`[\s\S]*\| \*\*KEEP\*\*/.test(legacyPlan)
    && /\| LEG-023 \| `apps\/platform-operations-portal`[\s\S]*\| \*\*MIGRATE-then-DELETE\*\*/.test(legacyPlan),
  "Legacy plan must record GATE-OPS-SURVIVOR with platform-console KEEP and platform-operations-portal MIGRATE-then-DELETE",
);

for (const id of ["LEG-079", "LEG-080", "LEG-081", "LEG-082", "LEG-083"]) {
  reporter.assert(legacyPlan.includes(`| ${id} |`), `Legacy plan must include missing Phase C row ${id}`);
}

for (const required of [
  "client React cart",
  "Inventory direct-decrement side doors",
  "Scalar single-code discount",
  "Merchant shell fork",
  "Web token-source forks",
]) {
  reporter.assert(legacyPlan.includes(required), `Legacy plan must disposition ${required}`);
}

reporter.assert(
  /checkout\.` record is provisioned inside P8/i.test(roadmap)
    || /checkout\.` DNS record is provisioned in this P8 phase/i.test(roadmap),
  "Roadmap must place checkout. DNS provisioning in P8",
);

reporter.assert(
  /P3(?:'s)? reconciliation harness proving zero-drift|P3 reconciliation harness must prove zero-drift/i.test(roadmap),
  "Roadmap must bind money bridge deletion to P3 reconciliation zero-drift",
);

reporter.assert(
  skipped.includes("SKIP-GATE-OPS-SURVIVOR-ARB"),
  "Skipped human decisions must record final ARB ops-survivor signature",
);

reporter.finish("ops survivor, missing legacy rows, and roadmap dependency fixes checked");
