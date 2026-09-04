import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  readFile,
  root,
} from "./governance-common.mjs";

/**
 * Workflow trigger coverage validator.
 *
 * Authority: LETBUYY_CONSTITUTION ART-02 (one validator suite; a green gate means
 * "conforms"), ART-03 / AGENTS.md DEPLOY-R1 (the deploy meta-blocker: a branch that
 * cannot be gated cannot be shipped), R-18 (no validator certifies a forbidden
 * capability).
 *
 * It proves three things deterministically, without network access:
 *   1. Every governed branch is actually covered by the non-deploying CI gates.
 *   2. No production-deploying workflow can be triggered by an integration branch.
 *   3. `architecture-governance.yml` reports every gate step instead of fail-fasting
 *      on the first one and hiding typecheck/test results behind it.
 *
 * GitHub branch protection itself (required-checks configuration on github.com)
 * lives outside the repository and is NOT verifiable here. That remains a
 * human-owned seam, documented in .github/BRANCH_STRATEGY.md.
 */

const reporter = createReporter("Workflow trigger coverage validator");

const WORKFLOW_DIR = ".github/workflows";

/* ------------------------------------------------------------------ *
 * Minimal, dependency-free YAML subset reader.
 *
 * Deliberately self-contained: no validator in this repository may depend on an
 * undeclared transitive package (undeclared-import-validator), and the root
 * workspace declares no YAML parser. This reader covers exactly the GitHub
 * Actions workflow subset: block mappings, block sequences, flow sequences,
 * quoted/plain scalars, comments and block scalars (`|`, `>`), which are read as
 * opaque strings.
 * ------------------------------------------------------------------ */

function stripComment(line) {
  let out = "";
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) break;
    out += ch;
  }
  return out.replace(/\s+$/, "");
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === "") return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
    (value.startsWith("'") && value.endsWith("'") && value.length > 1)
  ) {
    return value.slice(1, -1);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => parseScalar(item));
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") return {};
    const obj = {};
    for (const pair of inner.split(",")) {
      const idx = pair.indexOf(":");
      if (idx === -1) continue;
      obj[parseScalar(pair.slice(0, idx))] = parseScalar(pair.slice(idx + 1));
    }
    return obj;
  }
  return value;
}

function tokenize(text) {
  const tokens = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    if (/^\s*$/.test(rawLine)) continue;
    if (/^\s*#/.test(rawLine)) continue;
    if (/^\s*---\s*$/.test(rawLine) || /^\s*\.\.\.\s*$/.test(rawLine)) continue;
    if (rawLine.includes("\t")) {
      throw new Error(`line ${i + 1}: YAML indentation must not contain tab characters`);
    }
    const content = stripComment(rawLine);
    if (content.trim() === "") continue;
    const indent = content.length - content.replace(/^ +/, "").length;
    tokens.push({ indent, text: content.trim(), line: i + 1 });
  }
  return tokens;
}

function parseBlock(tokens, cursor, indent) {
  const first = tokens[cursor.i];
  if (!first) return null;
  return first.text.startsWith("- ")
    || first.text === "-"
    ? parseSequence(tokens, cursor, indent)
    : parseMapping(tokens, cursor, indent);
}

function parseSequence(tokens, cursor, indent) {
  const items = [];
  while (cursor.i < tokens.length) {
    const token = tokens[cursor.i];
    if (token.indent < indent) break;
    if (token.indent > indent) {
      throw new Error(`line ${token.line}: unexpected indentation inside sequence`);
    }
    if (!(token.text === "-" || token.text.startsWith("- "))) break;

    const rest = token.text === "-" ? "" : token.text.slice(2).trim();
    cursor.i += 1;

    if (rest === "") {
      const next = tokens[cursor.i];
      if (next && next.indent > indent) {
        items.push(parseBlock(tokens, cursor, next.indent));
      } else {
        items.push(null);
      }
      continue;
    }

    const keyMatch = rest.match(/^([^:\s][^:]*):(\s.*)?$/);
    if (keyMatch) {
      // Inline mapping start inside a sequence entry: "- name: value".
      // The entry's key column is the source column where `rest` begins, so
      // "-   name: value" is handled as well as "- name: value".
      const dashRun = token.text.length - token.text.slice(1).replace(/^\s+/, "").length;
      const entryIndent = indent + dashRun;
      const synthetic = [{ indent: entryIndent, text: rest, line: token.line }];
      while (cursor.i < tokens.length && tokens[cursor.i].indent >= entryIndent) {
        synthetic.push(tokens[cursor.i]);
        cursor.i += 1;
      }
      const innerCursor = { i: 0 };
      items.push(parseMapping(synthetic, innerCursor, entryIndent));
      continue;
    }

    items.push(parseScalar(rest));
  }
  return items;
}

function parseMapping(tokens, cursor, indent) {
  const map = {};
  while (cursor.i < tokens.length) {
    const token = tokens[cursor.i];
    if (token.indent < indent) break;
    if (token.indent > indent) {
      throw new Error(`line ${token.line}: unexpected indentation inside mapping`);
    }
    if (token.text.startsWith("- ") || token.text === "-") break;

    const match = token.text.match(/^("[^"]*"|'[^']*'|[^:]+):(.*)$/);
    if (!match) {
      throw new Error(`line ${token.line}: expected "key: value", found "${token.text}"`);
    }
    const key = parseScalar(match[1]);
    const inline = match[2].trim();
    cursor.i += 1;

    if (inline === "|" || inline === ">" || /^[|>][-+]?\d*$/.test(inline)) {
      // Block scalar: consume every more-indented line as opaque text.
      const chunks = [];
      while (cursor.i < tokens.length && tokens[cursor.i].indent > indent) {
        chunks.push(tokens[cursor.i].text);
        cursor.i += 1;
      }
      map[key] = chunks.join("\n");
      continue;
    }

    if (inline !== "") {
      map[key] = parseScalar(inline);
      continue;
    }

    const next = tokens[cursor.i];
    if (!next || next.indent < indent) {
      map[key] = null;
      continue;
    }
    if (next.indent === indent && (next.text.startsWith("- ") || next.text === "-")) {
      // A sequence may be written at the same indentation as its key.
      map[key] = parseSequence(tokens, cursor, indent);
      continue;
    }
    if (next.indent <= indent) {
      map[key] = null;
      continue;
    }
    map[key] = parseBlock(tokens, cursor, next.indent);
  }
  return map;
}

export function parseWorkflowYaml(text) {
  const tokens = tokenize(text);
  const cursor = { i: 0 };
  const doc = tokens.length === 0 ? {} : parseBlock(tokens, cursor, tokens[0].indent);
  if (cursor.i !== tokens.length) {
    const token = tokens[cursor.i];
    throw new Error(`line ${token.line}: unparsed trailing content "${token.text}"`);
  }
  return doc;
}

/* ------------------------------------------------------------------ *
 * GitHub branch-filter glob matching.
 * `*` matches any character except `/`; `**` matches across `/`.
 * ------------------------------------------------------------------ */

function branchPatternMatches(pattern, branch) {
  if (typeof pattern !== "string" || pattern === "") return false;
  const negated = pattern.startsWith("!");
  const body = negated ? pattern.slice(1) : pattern;
  let regex = "";
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === "*") {
      if (body[i + 1] === "*") {
        regex += ".*";
        i += 1;
      } else {
        regex += "[^/]*";
      }
      continue;
    }
    if (ch === "?") {
      regex += "[^/]";
      continue;
    }
    regex += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return { negated, matched: new RegExp(`^${regex}$`).test(branch) };
}

function branchListCovers(patterns, branch) {
  const list = toList(patterns);
  let covered = false;
  for (const pattern of list) {
    const result = branchPatternMatches(pattern, branch);
    if (!result) continue;
    if (result.matched) covered = !result.negated;
  }
  return covered;
}

function toList(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function triggerFor(workflow, event) {
  const on = workflow?.on ?? workflow?.true ?? workflow?.["on"];
  if (!on) return undefined;
  if (Array.isArray(on)) return on.includes(event) ? {} : undefined;
  if (typeof on === "string") return on === event ? {} : undefined;
  if (!(event in on)) return undefined;
  return on[event] ?? {};
}

/**
 * Does `event` on `branch` reach this workflow?
 * A trigger without a `branches:` filter matches every branch.
 * `branches-ignore` is honoured as an exclusion list.
 */
function eventReachesBranch(workflow, event, branch) {
  const trigger = triggerFor(workflow, event);
  if (trigger === undefined) return false;
  if (trigger === null || typeof trigger !== "object") return true;
  if (Array.isArray(trigger)) return true;
  if (trigger["branches-ignore"] !== undefined) {
    return !branchListCovers(trigger["branches-ignore"], branch);
  }
  if (trigger.branches === undefined) return true;
  return branchListCovers(trigger.branches, branch);
}

/* ------------------------------------------------------------------ *
 * 0. Every workflow file must parse.
 * ------------------------------------------------------------------ */

const workflowFiles = fs.existsSync(path.join(root, WORKFLOW_DIR))
  ? fs
      .readdirSync(path.join(root, WORKFLOW_DIR), { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
      .map((entry) => `${WORKFLOW_DIR}/${entry.name}`)
      .sort()
  : [];

reporter.assert(workflowFiles.length > 0, `No workflow files found under ${WORKFLOW_DIR}`);

const workflows = new Map();
for (const file of workflowFiles) {
  try {
    const parsed = parseWorkflowYaml(readFile(file));
    workflows.set(file, parsed);
    reporter.assert(
      parsed && typeof parsed === "object" && !Array.isArray(parsed),
      `Workflow must parse to a mapping: ${file}`,
    );
    reporter.assert(
      Boolean(parsed?.jobs) && typeof parsed.jobs === "object",
      `Workflow must declare a jobs: block: ${file}`,
    );
    reporter.assert(
      triggerFor(parsed, "push") !== undefined ||
        triggerFor(parsed, "pull_request") !== undefined ||
        triggerFor(parsed, "schedule") !== undefined ||
        triggerFor(parsed, "workflow_dispatch") !== undefined ||
        triggerFor(parsed, "workflow_call") !== undefined,
      `Workflow must declare at least one recognised trigger: ${file}`,
    );
  } catch (error) {
    workflows.set(file, null);
    reporter.assert(false, `Workflow YAML failed to parse: ${file} (${error instanceof Error ? error.message : String(error)})`);
  }
}

/* ------------------------------------------------------------------ *
 * 1. Gated branches must be covered by the non-deploying CI lanes.
 * ------------------------------------------------------------------ */

const CI_WORKFLOW = `${WORKFLOW_DIR}/ci.yml`;
const GOVERNANCE_WORKFLOW = `${WORKFLOW_DIR}/architecture-governance.yml`;

/**
 * Branches that MUST be gated by ci.yml on both pull_request and push.
 * `develop` is intentionally retained (never removed) as a fail-safe: if the
 * retired branch is ever recreated it stays gated by default.
 */
const gatedBranches = [
  "main",
  "develop",
  "staging",
  "stepup/main",
  "codex/web-v1-integration",
];

const ci = workflows.get(CI_WORKFLOW);
reporter.assert(Boolean(ci), `Missing CI workflow: ${CI_WORKFLOW}`);

if (ci) {
  for (const branch of gatedBranches) {
    reporter.assert(
      eventReachesBranch(ci, "pull_request", branch),
      `ci.yml must gate pull requests targeting "${branch}"`,
    );
    reporter.assert(
      eventReachesBranch(ci, "push", branch),
      `ci.yml must gate direct pushes to "${branch}"`,
    );
  }

  // The required-check job set named by .github/BRANCH_STRATEGY.md must exist.
  for (const job of [
    "typecheck",
    "lint",
    "build",
    "unit-tests",
    "governance",
    "merge-safety-gate",
    "secret-hygiene",
  ]) {
    reporter.assert(
      Boolean(ci.jobs?.[job]),
      `ci.yml must define the required-check job "${job}" named in .github/BRANCH_STRATEGY.md`,
    );
  }
}

const governance = workflows.get(GOVERNANCE_WORKFLOW);
reporter.assert(Boolean(governance), `Missing governance workflow: ${GOVERNANCE_WORKFLOW}`);

if (governance) {
  reporter.assert(
    eventReachesBranch(governance, "push", "codex/web-v1-integration"),
    "architecture-governance.yml must run on pushes to codex/web-v1-integration",
  );
  reporter.assert(
    eventReachesBranch(governance, "push", "main"),
    "architecture-governance.yml must keep running on pushes to main",
  );
}

/* ------------------------------------------------------------------ *
 * 2. No deploying workflow may be reachable from an integration branch.
 * ------------------------------------------------------------------ */

const deployingWorkflows = [
  `${WORKFLOW_DIR}/production-deploy.yml`,
  `${WORKFLOW_DIR}/production-rollout.yml`,
  `${WORKFLOW_DIR}/live-production-certification.yml`,
  `${WORKFLOW_DIR}/deploy-staging.yml`,
  `${WORKFLOW_DIR}/staging-deploy.yml`,
  `${WORKFLOW_DIR}/staging-runtime-deployment.yml`,
  `${WORKFLOW_DIR}/mobile-merchant-release.yml`,
  `${WORKFLOW_DIR}/hot-table-partition-maintenance.yml`,
];

const nonDeployingBranches = [
  "codex/web-v1-integration",
  "codex/w0-ci-coverage",
  "codex/emergency-appbridge-killswitch",
];

for (const file of deployingWorkflows) {
  const workflow = workflows.get(file);
  reporter.assert(Boolean(workflow), `Missing deploy-lane workflow: ${file}`);
  if (!workflow) continue;

  for (const branch of nonDeployingBranches) {
    reporter.assert(
      !eventReachesBranch(workflow, "push", branch),
      `${path.posix.basename(file)} must not deploy automatically from "${branch}" (push trigger reaches it)`,
    );
    reporter.assert(
      !eventReachesBranch(workflow, "pull_request", branch),
      `${path.posix.basename(file)} must not run from pull requests targeting "${branch}"`,
    );
  }
}

// Production must stay on the approved release path: main push or manual dispatch.
// OWNER_DECISION D-DEPLOY (2026-09-04): the lane is dispatch-only until a DEPLOY-1 phase retargets it with
// verified cloud targets; a push trigger, when present, must be explicitly restricted to main.
const productionDeploy = workflows.get(`${WORKFLOW_DIR}/production-deploy.yml`);
if (productionDeploy) {
  const pushTrigger = triggerFor(productionDeploy, "push");
  reporter.assert(
    triggerFor(productionDeploy, "workflow_dispatch") !== undefined,
    "production-deploy.yml must be dispatchable (workflow_dispatch)",
  );
  if (pushTrigger !== undefined) {
    reporter.assert(
      toList(pushTrigger?.branches).length > 0,
      "production-deploy.yml push trigger must be explicitly branch-filtered",
    );
    reporter.assert(
      toList(pushTrigger?.branches).every((pattern) => pattern === "main"),
      `production-deploy.yml push trigger must be restricted to main (found: ${toList(pushTrigger?.branches).join(", ")})`,
    );
  }
  reporter.assert(
    triggerFor(productionDeploy, "pull_request") === undefined,
    "production-deploy.yml must not run on pull_request",
  );
  reporter.assert(
    Boolean(productionDeploy.jobs?.["branch-lag-guard"]),
    "production-deploy.yml must keep the branch-lag guard job (AGENTS.md DEPLOY-R1)",
  );
}

const productionRollout = workflows.get(`${WORKFLOW_DIR}/production-rollout.yml`);
if (productionRollout) {
  reporter.assert(
    triggerFor(productionRollout, "push") === undefined &&
      triggerFor(productionRollout, "pull_request") === undefined,
    "production-rollout.yml must remain manual-dispatch only",
  );
}

const deployStaging = workflows.get(`${WORKFLOW_DIR}/deploy-staging.yml`);
if (deployStaging) {
  // D-BRANCH / D-DEPLOY (2026-09-04): the staging lane belongs to `staging`; dispatch-only until DEPLOY-1.
  reporter.assert(
    toList(triggerFor(deployStaging, "push")?.branches).every((pattern) => pattern === "staging"),
    "deploy-staging.yml push trigger, when present, must be restricted to staging",
  );
  reporter.assert(
    triggerFor(deployStaging, "workflow_dispatch") !== undefined,
    "deploy-staging.yml must be dispatchable (workflow_dispatch)",
  );
}

// environment-lifecycle.yml runs on pull_request for EVERY base branch (path-scoped), so it is
// reachable from integration-branch PRs. Its provider-mutating bootstrap step must therefore stay
// gated behind the manual workflow_dispatch input and must never become event-triggered.
const environmentLifecycle = workflows.get(`${WORKFLOW_DIR}/environment-lifecycle.yml`);
if (environmentLifecycle) {
  reporter.assert(
    triggerFor(environmentLifecycle, "push") === undefined,
    "environment-lifecycle.yml must not gain a push trigger; it is reachable from every pull request",
  );
  const lifecycleSteps = Object.values(environmentLifecycle.jobs ?? {})
    .flatMap((job) => toList(job?.steps))
    .filter((step) => step && typeof step === "object");
  const bootstrapStep = lifecycleSteps.find((step) =>
    String(step.run ?? "").includes("bootstrap-staging.mjs"),
  );
  reporter.assert(
    Boolean(bootstrapStep),
    "environment-lifecycle.yml must keep its staging bootstrap step addressable",
  );
  reporter.assert(
    String(bootstrapStep?.if ?? "").includes("inputs.deploy_staging"),
    "environment-lifecycle.yml staging bootstrap must stay gated behind the manual deploy_staging input",
  );
}

/* ------------------------------------------------------------------ *
 * 3. architecture-governance.yml must report every gate step.
 *
 * The historical defect: "Validate governance" ran first and, on failure, the
 * job stopped — so typecheck and test failures were never observed. Every gate
 * step now carries continue-on-error plus an id, and a final always() aggregate
 * step re-imposes the hard failure. That aggregate step must reference every
 * continue-on-error step, or a failure could be silently swallowed.
 * ------------------------------------------------------------------ */

if (governance) {
  const job = governance.jobs?.["validate-architecture"];
  reporter.assert(Boolean(job), "architecture-governance.yml must define the validate-architecture job");

  const steps = toList(job?.steps).filter((step) => step && typeof step === "object");
  reporter.assert(steps.length > 0, "architecture-governance.yml validate-architecture job must define steps");

  const tolerantSteps = steps.filter((step) => String(step["continue-on-error"]) === "true");
  reporter.assert(
    tolerantSteps.length >= 12,
    `architecture-governance.yml must run all gate steps independently; found ${tolerantSteps.length} continue-on-error steps (expected >= 12)`,
  );

  for (const step of tolerantSteps) {
    reporter.assert(
      Boolean(step.id),
      `architecture-governance.yml continue-on-error step must declare an id: "${step.name ?? "(unnamed)"}"`,
    );
  }

  const aggregate = steps[steps.length - 1];
  reporter.assert(
    Boolean(aggregate) && String(aggregate.id) === "gate-aggregate",
    "architecture-governance.yml must end with the gate-aggregate step so no failure is swallowed",
  );
  reporter.assert(
    aggregate && String(aggregate.if).trim() === "always()",
    "architecture-governance.yml gate-aggregate step must run with if: always()",
  );
  reporter.assert(
    aggregate && String(aggregate["continue-on-error"] ?? "false") !== "true",
    "architecture-governance.yml gate-aggregate step must be able to fail the job",
  );

  const aggregateSource = `${JSON.stringify(aggregate?.env ?? {})}\n${String(aggregate?.run ?? "")}`;
  for (const step of tolerantSteps) {
    reporter.assert(
      aggregateSource.includes(`steps.${step.id}.outcome`),
      `architecture-governance.yml gate-aggregate must inspect steps.${step.id}.outcome`,
    );
  }
  reporter.assert(
    /exit 1/.test(String(aggregate?.run ?? "")),
    "architecture-governance.yml gate-aggregate must exit non-zero when any gate step failed",
  );

  // The ordering defect must not be reintroduced by pinning typecheck/test last.
  const stepIds = steps.map((step) => String(step.id ?? ""));
  for (const requiredId of ["validate-governance", "governance-tests", "typecheck"]) {
    reporter.assert(
      stepIds.includes(requiredId),
      `architecture-governance.yml must keep an addressable "${requiredId}" step`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 4. BRANCH_STRATEGY.md must not claim coverage the workflows do not provide.
 * ------------------------------------------------------------------ */

const branchStrategy = readFile(".github/BRANCH_STRATEGY.md");
reporter.assert(
  branchStrategy.includes("codex/web-v1-integration"),
  ".github/BRANCH_STRATEGY.md must document the Web V1 integration branch lane",
);
reporter.assert(
  branchStrategy.includes("UNVERIFIED") || branchStrategy.includes("not verifiable from the repository"),
  ".github/BRANCH_STRATEGY.md must state that GitHub-side branch protection is not verifiable from the repository",
);

reporter.finish(
  `${workflowFiles.length} workflows parsed; ${gatedBranches.length} gated branches and ${deployingWorkflows.length} deploy lanes checked`,
);
