#!/usr/bin/env node
/**
 * Creates the GitHub repository shell and branch protection for LetBuyy.
 *
 * Requires: authenticated gh CLI session with repository administration scope.
 * Usage: node scripts/github/setup-repo.mjs
 */
import { spawnSync } from "node:child_process";

const repo = process.env.GITHUB_REPOSITORY_TARGET || "letbuyy/letbuyy-store";

function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.input ? ["pipe", "pipe", "inherit"] : ["ignore", "pipe", "inherit"],
    input: options.input,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function repoExists() {
  const result = spawnSync("gh", ["repo", "view", repo], { stdio: "ignore" });
  return result.status === 0;
}

if (!repoExists()) {
  run("gh", [
    "repo",
    "create",
    repo,
    "--private",
    "--description",
    "LetBuyy Commerce SaaS Platform",
  ]);
} else {
  console.log(`Repository already exists: ${repo}`);
}

run("gh", ["api", `repos/${repo}`, "-X", "PATCH", "-f", "default_branch=main"]);
run("git", ["push", "origin", "main:develop"], { allowFailure: true });

const protection = {
  required_status_checks: {
    strict: true,
    contexts: ["Validate"],
  },
  enforce_admins: false,
  required_pull_request_reviews: {
    required_approving_review_count: 0,
  },
  restrictions: null,
};

for (const branch of ["main", "develop"]) {
  run("gh", ["api", `repos/${repo}/branches/${branch}/protection`, "-X", "PUT", "--input", "-"], {
    input: JSON.stringify(protection),
  });
}

console.log("GitHub repository setup complete");
console.log("Next: set secrets with scripts/github/set-secrets.mjs");
