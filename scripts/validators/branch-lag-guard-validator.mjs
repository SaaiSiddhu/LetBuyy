import { execFileSync } from "node:child_process";
import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Branch lag guard validator");
const workflow = readFile(".github/workflows/production-deploy.yml");
const gate = readFile("scripts/validate-governance.mjs");

const productionBranch = process.env.LETBUYY_PRODUCTION_BRANCH || "main";
const integrationBranch = process.env.LETBUYY_RELEASE_INTEGRATION_BRANCH || "stepup/main";
const enforceLag = process.env.LETBUYY_ENFORCE_BRANCH_LAG === "1";

reporter.assert(
  workflow.includes("branch-lag-guard:"),
  "Production deploy workflow must define a branch-lag-guard job before release gates",
);
reporter.assert(
  workflow.includes("fetch-depth: 0"),
  "Production deploy branch-lag-guard checkout must fetch full history",
);
reporter.assert(
  workflow.includes('LETBUYY_ENFORCE_BRANCH_LAG: "1"'),
  "Production deploy branch-lag-guard must enable live branch-lag enforcement",
);
reporter.assert(
  workflow.includes("node scripts/validators/branch-lag-guard-validator.mjs"),
  "Production deploy workflow must run the branch-lag guard validator",
);
reporter.assert(
  /release-preflight:\s+name: Release credential preflight\s+needs:\s+- branch-lag-guard\s+- governance-gate/s.test(workflow),
  "Release credential preflight must depend on the branch-lag guard and governance gate",
);
reporter.assert(
  gate.includes('"branch-lag-guard-validator.mjs"'),
  "Branch lag guard validator must be wired into the governance gate lane",
);

function git(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function maybeFetchReleaseBranches() {
  if (process.env.LETBUYY_SKIP_BRANCH_LAG_FETCH === "1") return;

  git([
    "fetch",
    "--no-tags",
    "origin",
    `+refs/heads/${productionBranch}:refs/remotes/origin/${productionBranch}`,
    `+refs/heads/${integrationBranch}:refs/remotes/origin/${integrationBranch}`,
  ]);
}

if (enforceLag) {
  const githubRefName = process.env.GITHUB_REF_NAME;
  reporter.assert(
    !githubRefName || githubRefName === productionBranch,
    `Production deploy must run from ${productionBranch}; current ref is ${githubRefName}`,
  );

  try {
    maybeFetchReleaseBranches();
    const lagCount = Number(git(["rev-list", "--count", `HEAD..origin/${integrationBranch}`]));
    reporter.assert(
      Number.isFinite(lagCount) && lagCount === 0,
      `${productionBranch} is behind ${integrationBranch} by ${lagCount} commit(s); execute MERGE_RUNBOOK.md before production deploy`,
    );
  } catch (error) {
    reporter.assert(
      false,
      `Unable to verify ${productionBranch} branch lag against ${integrationBranch}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
} else {
  try {
    const localLagCount = Number(git(["rev-list", "--count", `${productionBranch}..HEAD`]));
    reporter.warn(
      Number.isFinite(localLagCount) && localLagCount === 0,
      `Local working branch is ${localLagCount} commit(s) ahead of ${productionBranch}; CI enforces the live release-branch comparison`,
    );
  } catch {
    reporter.warn(false, "Local branch lag could not be inspected; CI enforces the live release-branch comparison");
  }
}

reporter.finish(
  enforceLag
    ? `${productionBranch} is not behind ${integrationBranch}`
    : "workflow and governance wiring checked",
);
