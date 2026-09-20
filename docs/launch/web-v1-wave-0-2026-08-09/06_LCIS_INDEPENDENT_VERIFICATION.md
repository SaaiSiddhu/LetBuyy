# 06 — LCIS Independent Verification (Agent C, Wave 0 Phase 1)

**Status:** Evidence artifact. **Not governance authority.** Subordinate to
`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, root `AGENTS.md`, and the relevant local
`AGENTS.md` files.

- **Repo SHA at time of audit:** `bf35062eda22f4d881efd61fb1d36c8fc83baed1`
- **Branch:** `stepup/main`
- **Date used:** 2026-08-09
- **Mode:** Read-only. No `pnpm lcis` write/mutating command was invoked; no LCIS server process was
  started or stopped by this agent. Structural claims below were checked against `graphify-out/`
  files already on disk and against direct repo commands — not against a live LCIS HTTP query,
  since standing up `tools/graph-server` / `tools/central-intelligence` was out of scope for a
  read-only audit pass and neither service was already running.
- **What was executed vs. inferred:** file-existence, mtimes, embedded commit SHAs, and validator/
  migration/workflow counts were all executed with real commands (transcript in raw evidence).
  Claims about *why* LCIS's `pnpm lcis health` reports `graphCommit 0f257ca1...` are inferred from
  the embedded `built_at_commit` field inside `graphify-out/graph.json`, which is the same value —
  this agent did not run `pnpm lcis health` itself.
- **What remains unverified:** the ZIP's LCIS doc (10) reports live output from `pnpm lcis`
  subcommands (`health`, `readiness`, `decision launch`, etc.) captured under
  `/tmp/letbuyy-v1-run-2026-08-09/lcis/` on the machine that produced the ZIP. That `/tmp` path
  does not exist in this session (temp directories are not preserved across sessions/agents), so
  those specific command outputs could not be re-run and re-diffed here. Everything checkable from
  static `graphify-out/` state and from direct repo commands was checked and is reported below.

---

## 1. Locating LCIS/Graphify outputs

```bash
$ ls -d tools/graph-server tools/central-intelligence
tools/graph-server
tools/central-intelligence

$ ls docs/central-intelligence | wc -l
# 60+ generated report files present (AI_CONTEXT_PACK.md, AUTONOMOUS_DISCOVERY_*.md, ...)

$ ls -la graphify-out/ | head -20
# 70 top-level entries: db-intel.json, graph.json, GRAPH_REPORT.md, autonomous-operations/,
# context-intelligence/, operating-loop/, execution-audit/, ...
```

All four locations named in the task exist: `graphify-out/`, `docs/central-intelligence/`,
`tools/graph-server`, `tools/central-intelligence`. `graphify-out/` is gitignored (per CLAUDE.md,
"output gitignored") — confirmed present on disk but not tracked by git.

## 2. Age and source commit of the graph (treated as a hint only)

```bash
$ grep -n "built_at_commit" graphify-out/graph.json | head -1
"built_at_commit": "0f257ca1992d4473634c3893f87f633c48eff470"

$ grep -rn "0f257ca1" graphify-out/GRAPH_REPORT.md
- Built from commit: `0f257ca1`

$ git log -1 --format="%H %cI %s" 0f257ca1
0f257ca1992d4473634c3893f87f633c48eff470 2026-06-14T00:00:09+05:30 v1-completion-cert: FINAL_V1_CERTIFICATION + DEPLOYMENT_GAP_REPORT

$ git log -1 --format="%H %cI %s" bf35062e   # HEAD
bf35062eda22f4d881efd61fb1d36c8fc83baed1 2026-08-04T22:03:49+05:30 feat(demo): mount Turnstile so the form works in production

$ git rev-list --count 0f257ca1..bf35062e
77
```

- The graph was built at `0f257ca1` on **2026-06-14**.
- `HEAD` at audit time is `bf35062e` on **2026-08-04** (committer date; the working tree audited
  is `2026-08-09`, further ahead again — see doc 05 §5.1 for the uncommitted-changes count).
- **77 commits** separate the graph build from `HEAD`.
- `graphify-out/` file mtimes (`ls -la`) cluster 14–20 Jun 2026, consistent with the embedded
  commit date and giving no evidence of a later regeneration.
- **Verdict: the LCIS code graph is materially stale relative to the audited commit** — independently
  reconstructed, not copied from the ZIP's own claim (doc 00 §3.4 / doc 10 §2.1 make the same
  claim; this agent's number, `77` commits, matches theirs exactly, which is a strong internal
  consistency signal rather than something taken on faith).

## 3. Independent recomputation of material claims (not read from the ZIP or from LCIS)

| Claim | LCIS/ZIP said | Repo command run | Result | Verdict |
|---|---|---|---|---|
| Branch divergence `main..stepup/main` | 106 | `git rev-list --count main..stepup/main` | `106` | CONFIRMED |
| Branch divergence `origin/main..stepup/main` | 291 | `git rev-list --count origin/main..stepup/main` | `291` | CONFIRMED |
| Runtime topology (`apps/*`, `services/*`) | Canonical Runtime Map in CLAUDE.md (13 active/reserved apps+services, 9 deprecated aliases) | `ls -d apps/*/ services/*/ apps/mobile/*/` | 10 `apps/*` dirs, 11 `services/*` dirs, 3 `apps/mobile/*` dirs — every CLAUDE.md-named active/reserved/frozen path present; all 9 deprecated aliases absent; **one extra path not in CLAUDE.md's list at all: `services/lcis-api`** (real source, no manifest) | PARTIAL — see §4 |
| CI workflow file count | 16 (doc 07 `EVID-S0-01` enumerates "all 16 workflows") | `ls .github/workflows/*.yml \| wc -l` | `16` | CONFIRMED |
| Validator count | 108 total, gate aborts at index 5 of 108 | Parsed `validators` array in `scripts/validate-governance.mjs`; ran `node scripts/validate-governance.mjs` live | Array has exactly `108` entries; live run exits `1` after the 6th validator executes (`Design-system governance FAILED`) = 0-indexed position `5`, matching `validate-design-system.mjs` at that array index | CONFIRMED |
| Migration count / max prefix | 126 migrations (doc 11, 12, 14) | `find database/supabase/migrations -maxdepth 1 -name "*.sql" \| wc -l` | `126`; max numeric prefix `197` (`197_letbuyy_core_first_class_theme.sql`) | CONFIRMED |
| Forbidden deprecated aliases absent | Implicit — CLAUDE.md Deprecated Runtime Policy | Checked all 9 paths (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`) with `[ -e <path> ]` | All 9 absent | CONFIRMED |
| Reserved services empty (manifest-only) | Implicit — CLAUDE.md "manifest-only placeholders" | `find <path> -type f` on all 8 reserved paths | Each contains exactly 2 files: `runtime.manifest.json` + `AGENTS.md` — no source, no tests | CONFIRMED |
| Storefront host-routing middleware | Implicit — `src/proxy.ts` cited across the ZIP as the routing entry point | `find apps/storefront-runtime -iname proxy.ts` | `apps/storefront-runtime/src/proxy.ts` exists | CONFIRMED |
| App-marketplace mounted in canonical gateway (ART-16/NEVER-R3 tension) | doc 10 §5.3: `services/api-gateway/src/index.ts:727` mounts `appStoreRouter`; `FEATURE_EXTENSIONS` default/staging `true`, production `false` | `grep -n "app-store" services/api-gateway/src/index.ts`; `sed -n` on `wrangler.toml` `[vars]`, `[env.staging.vars]`, `[env.production.vars]` | Import at line 54, gate/rate-limit middleware applied at lines 715–720; `[vars]` and `[env.staging.vars]` both set `FEATURE_EXTENSIONS = "true"`; `[env.production.vars]` sets `FEATURE_EXTENSIONS = "false"` | CONFIRMED |

## 4. Discrepancy: `services/lcis-api` is unlisted anywhere in the authority chain

```bash
$ find services/lcis-api -maxdepth 2 -type f
services/lcis-api/package.json
services/lcis-api/tsconfig.json
services/lcis-api/src/app.ts
services/lcis-api/src/index.ts
services/lcis-api/src/middleware.ts
services/lcis-api/src/server.ts
services/lcis-api/test/app.test.ts
services/lcis-api/test/execution.test.ts
services/lcis-api/dist/tsconfig.tsbuildinfo    # build output
services/lcis-api/.turbo/...                    # build cache

$ find services/lcis-api -iname runtime.manifest.json
# (no output — none exists)

$ grep -n "lcis-api" AGENTS.md GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md \
    GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md
# (no output in any of the three)
```

`package.json` describes it as: `"LCIS API — internal read-only HTTP service over the LCIS engine
(Hono). Consumes @letbuyy/lcis-core."` It is a real, buildable, tested service (two test files,
`tsconfig.json`, compiled `dist/` output present), unlike the manifest-only reserved services in
§3. It is:

- **Not** in CLAUDE.md's Canonical Runtime Map (active topology).
- **Not** in CLAUDE.md's Deprecated Runtime Policy list.
- **Not** described as a reserved/manifest-only placeholder (it has real source, not a manifest).
- **Not** mentioned in any of the 17 documents inside the readiness ZIP
  (`grep -rn "lcis-api" <extracted>/*.md` → no matches).

This is a **silence in both directions** — the authority chain doesn't name it, and neither does
the evidence package. Per the task brief's instruction not to resolve conflicts between authoritative
documents, and since this is not strictly a document-vs-document conflict but an **undocumented
active runtime**, it is recorded here as an escalation item rather than adjudicated. It should be
either (a) added to CLAUDE.md's Canonical Runtime Map with an owner and a `runtime.manifest.json`,
or (b) explicitly frozen/deprecated, by a human with governance authority.

## 5. LCIS's own internal reconciliation (doc 10) — spot-checked, not fully re-derived

The ZIP's own doc `10_LCIS_FINDINGS_AND_INDEPENDENT_RECONCILIATION.md` already performs an
LCIS-vs-source reconciliation and reaches 15 claim-by-claim verdicts. This agent's task is to
independently re-verify, not to trust that document. The following rows were re-derived from
scratch in this session; the rest of doc 10's 15-row table was read but not independently
re-executed line-by-line (out of scope/time for a ZIP-reconciliation pass — flagged as
**unverified** rather than silently accepted):

| Doc 10 claim | Re-verified here? | Result |
|---|---|---|
| Governance gate reported green by LCIS (`107/107`) but red in reality | Red half only | `node scripts/validate-governance.mjs` → exit `1`, fails at validator index 5 of 108 (`validate-design-system.mjs`), 2 hard violations + 9 ratchet regressions in the design-system governance validator's own output. **The "LCIS reports 107/107 green" half was not re-queried against a live LCIS process in this session** — taken as reported, not confirmed independently. |
| Code graph 77 commits stale, no staleness detection | YES | Independently reconstructed in §2 above — commit distance matches exactly (`77`) |
| `validate-governance.mjs` contains a destructive `rmSync` step that did not fire in this run | YES | Read `scripts/validate-governance.mjs:170–188`; confirmed `removeGeneratedArtifactDirectories()` exists, confirmed via live run that the gate aborted at index 5 (before `stale-artifact-validator.mjs` at index 70), confirmed via `git status` that 0 tracked files were deleted |
| App-marketplace mounted + `FEATURE_EXTENSIONS` flag posture | YES | See §3 table row above — confirmed |
| `rls-force-coverage-validator` is a no-op; 326 tables ENABLE-without-FORCE | **NOT independently re-derived** | Out of scope for this pass — would require enumerating every `CREATE POLICY`/`ALTER TABLE ... FORCE ROW LEVEL SECURITY` across 126 migrations, which is RLS-audit-scope work, not ZIP-reconciliation scope. Recorded as **UNVERIFIABLE by this agent in this pass** — a follow-up `rls-audit` pass should confirm or refute the 326 figure directly. |

## 6. Summary verdict

- The LCIS structural graph (`graphify-out/`) is genuinely, materially stale — 77 commits / ~7
  weeks behind the audited commit, independently confirmed from the embedded `built_at_commit`
  field and `git log`, not merely repeated from the ZIP.
- Every numeric/topological claim in the ZIP that was checked against a live repo command in this
  pass (branch divergence x2, CI workflow count, validator count and abort position, migration
  count and max prefix, deprecated-alias absence, reserved-service emptiness, storefront proxy
  existence, app-marketplace mount + feature-flag posture) **matches exactly**.
- The working-tree "dirty" counts (paths modified, untracked count) have drifted slightly since the
  ZIP was packaged (see doc 05 §5.1) — expected in an actively-worked branch, not a correctness
  defect in the ZIP.
- One genuine gap was found that neither the repository's own authority documents nor the ZIP
  address: `services/lcis-api` is a real, tested runtime with no entry anywhere in the Canonical
  Runtime Map, Deprecated Runtime Policy, or the 17-document evidence package. This is an
  escalation item, not resolved here.
- The deepest security-flavored claims inside the ZIP's own LCIS-reconciliation document (doc 10),
  specifically the RLS-FORCE no-op claim and the exact LCIS `107/107` green readout, were not
  independently re-run in this pass and are marked UNVERIFIABLE by this agent rather than accepted
  on the ZIP's word.
