import { execFileSync } from "node:child_process";
import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Branch lag guard validator");
const workflow = readFile(".github/workflows/production-deploy.yml");
const monitorWorkflow = readFile(".github/workflows/branch-lag-monitor.yml");
const gate = readFile("scripts/validate-governance.mjs");

// OWNER_DECISION D-BRANCH (2026-09-04): the integration/pre-production branch is `staging`
// (`develop` → `staging` → `main`, fast-forward only); `stepup/main` is a preserved alias.
// See .claude/skills/letbuyy/references/promote.md and docs/active/BRANCH_DISPOSITIONS.md.
const productionBranch = process.env.LETBUYY_PRODUCTION_BRANCH || "main";
const integrationBranch = process.env.LETBUYY_RELEASE_INTEGRATION_BRANCH || "staging";
const developBranch = process.env.LETBUYY_DEVELOP_BRANCH || "develop";
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
  workflow.includes("LETBUYY_RELEASE_INTEGRATION_BRANCH: staging"),
  "Production deploy branch-lag-guard must measure main against staging (D-BRANCH)",
);
reporter.assert(
  /release-preflight:\s+name: Release credential preflight\s+needs:\s+- branch-lag-guard\s+- governance-gate/s.test(workflow),
  "Release credential preflight must depend on the branch-lag guard and governance gate",
);
reporter.assert(
  gate.includes('"branch-lag-guard-validator.mjs"'),
  "Branch lag guard validator must be wired into the governance gate lane",
);
reporter.assert(
  monitorWorkflow.includes("schedule:") &&
    monitorWorkflow.includes('cron: "17 * * * *"') &&
    monitorWorkflow.includes("workflow_dispatch:"),
  "Branch lag monitor workflow must run on a standing schedule and support manual dispatch",
);
reporter.assert(
  monitorWorkflow.includes("fetch-depth: 0") &&
    monitorWorkflow.includes("node scripts/validators/branch-lag-guard-validator.mjs") &&
    monitorWorkflow.includes('LETBUYY_ENFORCE_BRANCH_LAG: "1"') &&
    monitorWorkflow.includes("LETBUYY_PRODUCTION_BRANCH: main") &&
    monitorWorkflow.includes("LETBUYY_RELEASE_INTEGRATION_BRANCH: staging"),
  "Branch lag monitor workflow must enforce main against staging with full history",
);

function git(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function hasLocalRef(name) {
  try {
    git(["show-ref", "--verify", "--quiet", `refs/heads/${name}`]);
    return true;
  } catch {
    return false;
  }
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
      `${productionBranch} is behind ${integrationBranch} by ${lagCount} commit(s); promote ${integrationBranch} → ${productionBranch} (fast-forward only, .claude/skills/letbuyy/references/promote.md) before production deploy`,
    );
  } catch (error) {
    reporter.assert(
      false,
      `Unable to verify ${productionBranch} branch lag against ${integrationBranch}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
} else {
  try {
    const currentBranch = git(["branch", "--show-current"]);
    if (process.env.LETBUYY_PRODUCTION_BRANCH) {
      // Explicit override: the caller names the production ref and asks whether HEAD has drifted from it.
      const localLagCount = Number(git(["rev-list", "--count", `${productionBranch}..HEAD`]));
      reporter.assert(
        Number.isFinite(localLagCount) && localLagCount === 0,
        `Local working branch is ${localLagCount} commit(s) ahead of ${productionBranch}; ${productionBranch} must be fast-forwarded (execute MERGE_RUNBOOK.md) before this branch can be treated as release-integrated`,
      );
    } else {
      // D-BRANCH (2026-09-04): under develop → staging → main a phase branch is ahead of main BY DESIGN, so
      // "HEAD equals main" is no longer the local invariant. The invariant is the fast-forward chain
      // main ⊆ staging ⊆ develop: no commit on a downstream environment branch may be absent from the
      // one that feeds it. Every pair whose refs exist locally is asserted; a pair whose refs are
      // missing (a shallow CI clone checks out one branch) is reported, not failed — the enforce path
      // above measures the deploy-time pair against origin with full history.
      const chain = [
        [productionBranch, integrationBranch],
        [integrationBranch, developBranch],
      ];
      let measured = 0;
      for (const [downstream, upstream] of chain) {
        if (!hasLocalRef(downstream) || !hasLocalRef(upstream)) continue;
        measured += 1;
        const strayCount = Number(git(["rev-list", "--count", `${upstream}..${downstream}`]));
        reporter.assert(
          Number.isFinite(strayCount) && strayCount === 0,
          `${downstream} holds ${strayCount} commit(s) absent from ${upstream}; promotion is fast-forward only (${downstream} ⊆ ${upstream}) — classify the divergence (MERGE_RUNBOOK.md §Divergence) before anything else`,
        );
      }
      if (measured === 0) {
        console.log(
          `branch chain not measurable on ${currentBranch || "detached HEAD"}: local refs ${productionBranch}/${integrationBranch}/${developBranch} are missing (shallow clone?) — the enforce mode covers the deploy-time pair`,
        );
      }
    }
  } catch (error) {
    reporter.assert(
      false,
      `Local branch lag could not be inspected: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

reporter.finish(
  enforceLag
    ? `${productionBranch} is not behind ${integrationBranch}`
    : "workflow wiring and the fast-forward chain checked",
);
