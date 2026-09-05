import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createReporter, root } from "./governance-common.mjs";

/**
 * Branch dispositions validator.
 *
 * Authority: LETBUYY_CONSTITUTION ART-02/ART-03, AGENTS.md DEPLOY-R1 (as amended by
 * OWNER_DECISION D-BRANCH, 2026-09-04: `develop` → `staging` → `main`, fast-forward only),
 * `.claude/skills/letbuyy/references/merge.md` and `promote.md`.
 *
 * `docs/active/BRANCH_DISPOSITIONS.md` is the ONLY branch-disposition authority. This validator
 * re-derives its claims from git and blocks when the ledger and the repository disagree:
 *   - the environment chain holds: main ⊆ staging ⊆ develop (fast-forward-only promotion);
 *   - every MERGED_DEVELOP row's SHA is an ancestor of develop;
 *   - every ACTIVE row's recorded SHA is an ancestor of (or equal to) its branch tip;
 *   - every LEGACY_INTEGRATED row is still contained in develop (never advanced);
 *   - every Promotions row's source SHA is an ancestor of its target;
 *   - no branch has two rows; every status token is known.
 * Refs that do not exist locally (a shallow CI clone checks out one branch) are SKIPPED with an
 * advisory, never failed — the chain is only measurable where the refs are. A local branch without a
 * row is an advisory: another session may have created it a minute ago.
 */

const reporter = createReporter("Branch dispositions validator");

const LEDGER = process.env.LETBUYY_BRANCH_DISPOSITIONS_PATH || "docs/active/BRANCH_DISPOSITIONS.md";
const ledgerPath = path.isAbsolute(LEDGER) ? LEDGER : path.join(root, LEDGER);
const KNOWN_STATUS = new Set(["ACTIVE", "MERGED_DEVELOP", "ENVIRONMENT", "LEGACY_INTEGRATED", "PRESERVED_REFERENCE"]);
const ENVIRONMENT_BRANCHES = ["develop", "staging", "main"];

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
function refExists(name) {
  return git(["show-ref", "--verify", "--quiet", `refs/heads/${name}`]) !== null;
}
function objectExists(sha) {
  return git(["cat-file", "-e", `${sha}^{commit}`]) !== null;
}
function isAncestor(a, b) {
  return git(["merge-base", "--is-ancestor", a, b]) !== null;
}
const shallow = git(["rev-parse", "--is-shallow-repository"]) === "true";

reporter.assert(fs.existsSync(ledgerPath), `Branch-disposition ledger must exist: ${LEDGER}`);
const text = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, "utf8") : "";

// ---- parse the Rows table: | `branch` | `sha` | STATUS | Decided | Decided by | Why | Merged into |
const rows = [];
const promotions = [];
// A disposition row that is not inside `## Rows` is invisible to every check below, because the
// parser never collects it. Not hypothetical: on 2026-09-05 an insertion helper anchored on the
// STRING "## Promotions", which line 5 of this ledger mentions in prose, and spliced two claim rows
// into the middle of that sentence. This validator passed on the corrupted file.
const misplacedRows = [];
let section = null;
for (const line of text.split("\n")) {
  if (/^## /.test(line)) { section = line.slice(3).trim(); continue; }
  const rowMatch = line.match(/^\| `([^`]+)` \| `([^`]+)` \| ([A-Za-z_]+(?::[^ |]+)?) \|/);
  if (section === "Rows") {
    if (rowMatch) rows.push({ branch: rowMatch[1], sha: rowMatch[2], status: rowMatch[3], line });
  } else if (section === "Promotions") {
    const m = line.match(/^\| (\d{4}-\d{2}-\d{2}) \| `([^`]+)` \| `([a-z]+)`/);
    if (m) promotions.push({ date: m[1], sha: m[2], target: m[3], line });
  } else if (rowMatch) {
    misplacedRows.push({ branch: rowMatch[1], section: section || "(before any heading)" });
  }
}
reporter.assert(rows.length > 0, "BRANCH_DISPOSITIONS.md must contain a `## Rows` table with at least one row");

// Headings are matched LINE-ANCHORED and counted. text.includes("## Promotions") was satisfied by the
// prose mention on line 5, so the heading could have been destroyed entirely and the old check would
// still have passed -- the same use-versus-mention defect as the bug above, inside the check meant to
// catch it.
const headingCount = (name) => text.split("\n").filter((line) => line.trim() === "## " + name).length;
for (const heading of ["Rows", "Promotions"]) {
  reporter.assert(
    headingCount(heading) === 1,
    "BRANCH_DISPOSITIONS.md must contain exactly one `## " + heading + "` HEADING (found " + headingCount(heading) + "); a prose mention is not a heading",
  );
}
for (const misplaced of misplacedRows) {
  reporter.assert(
    false,
    "Disposition row for " + misplaced.branch + " is outside `## Rows` -- it sits in " + misplaced.section
      + ", where every check below silently ignores it. An insertion anchored on a STRING rather than a line-anchored heading is how this happens.",
  );
}

// ---- duplicates and tokens
const seen = new Map();
for (const row of rows) {
  reporter.assert(!seen.has(row.branch), `Branch has more than one row: ${row.branch}`);
  seen.set(row.branch, row);
  const base = row.status.split(":")[0];
  reporter.assert(
    KNOWN_STATUS.has(base) || base === "SUPERSEDED_BY" || base === "ARCHIVED_TAG",
    `Unknown status token "${row.status}" on ${row.branch} (allowed: ${[...KNOWN_STATUS].join(", ")}, SUPERSEDED_BY:<branch>, ARCHIVED_TAG:<tag>)`,
  );
}
for (const name of ENVIRONMENT_BRANCHES) {
  const row = seen.get(name);
  reporter.assert(Boolean(row) && row.status === "ENVIRONMENT", `${name} must have an ENVIRONMENT row`);
}

// ---- the fast-forward chain
const present = ENVIRONMENT_BRANCHES.filter(refExists);
if (present.length === ENVIRONMENT_BRANCHES.length) {
  reporter.assert(isAncestor("main", "staging"), "main must be an ancestor of staging (promotion is fast-forward only: main ⊆ staging)");
  reporter.assert(isAncestor("staging", "develop"), "staging must be an ancestor of develop (promotion is fast-forward only: staging ⊆ develop)");
} else {
  reporter.advisory(false, `environment chain not measurable here (missing local refs: ${ENVIRONMENT_BRANCHES.filter((b) => !present.includes(b)).join(", ")}) — expected in a shallow CI clone`);
}

// ---- per-row claims
const developExists = refExists("develop");
for (const row of rows) {
  const base = row.status.split(":")[0];
  const known = objectExists(row.sha);
  if (!known) {
    reporter[shallow ? "advisory" : "assert"](false, `Recorded SHA ${row.sha} for ${row.branch} is not a commit in this repository${shallow ? " (shallow clone)" : ""}`);
    continue;
  }
  if (base === "MERGED_DEVELOP") {
    if (developExists) reporter.assert(isAncestor(row.sha, "develop"), `MERGED_DEVELOP row ${row.branch} (${row.sha}) is not an ancestor of develop`);
    else reporter.advisory(false, `MERGED_DEVELOP row ${row.branch} not checked: develop ref missing locally`);
  } else if (base === "ACTIVE") {
    if (refExists(row.branch)) reporter.assert(isAncestor(row.sha, row.branch), `ACTIVE row ${row.branch}: recorded SHA ${row.sha} is not an ancestor of the branch tip`);
    else reporter.advisory(false, `ACTIVE row ${row.branch}: branch not present locally (claimed in another clone?)`);
  } else if (base === "LEGACY_INTEGRATED") {
    if (developExists && refExists(row.branch)) reporter.assert(isAncestor(row.branch, "develop"), `LEGACY_INTEGRATED row ${row.branch} has advanced past develop — legacy branches are never advanced`);
  } else if (base === "PRESERVED_REFERENCE") {
    if (developExists && refExists(row.branch)) reporter.advisory(!isAncestor(row.branch, "develop"), `PRESERVED_REFERENCE row ${row.branch} is now fully contained in develop — reclassify it as LEGACY_INTEGRATED`);
  } else if (base === "ENVIRONMENT") {
    reporter.assert(ENVIRONMENT_BRANCHES.includes(row.branch), `ENVIRONMENT status is reserved for develop/staging/main, not ${row.branch}`);
  }
}

// ---- promotions
for (const promo of promotions) {
  reporter.assert(promo.target === "staging" || promo.target === "main", `Promotions row targets an unknown branch: ${promo.target}`);
  if (!objectExists(promo.sha)) { reporter[shallow ? "advisory" : "assert"](false, `Promotions row ${promo.date} → ${promo.target}: SHA ${promo.sha} is not a commit here`); continue; }
  if (refExists(promo.target)) reporter.assert(isAncestor(promo.sha, promo.target), `Promotions row ${promo.date}: ${promo.sha} is not an ancestor of ${promo.target}`);
}

// ---- every local branch has a row (advisory: sibling sessions create branches)
const localBranches = (git(["for-each-ref", "--format=%(refname:short)", "refs/heads"]) || "").split("\n").filter(Boolean);
for (const b of localBranches) {
  reporter.advisory(seen.has(b), `Local branch without a ledger row: ${b} (add a row before building on it)`);
}

reporter.finish(`${rows.length} rows, ${promotions.length} promotions, chain ${present.length === 3 ? "verified" : "not measurable"}${shallow ? ", shallow clone" : ""}`);
