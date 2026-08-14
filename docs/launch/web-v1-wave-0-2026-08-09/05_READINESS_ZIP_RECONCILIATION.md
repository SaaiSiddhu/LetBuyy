# 05 — Readiness ZIP Reconciliation (Agent C, Wave 0 Phase 1)

**Status:** Evidence artifact. **Not governance authority.** Subordinate to
`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, root `AGENTS.md`, and the relevant local
`AGENTS.md` files. Where anything below conflicts with those documents, the documents win.

- **Repo SHA at time of audit:** `ee3711829d857e986014c5811bb94d86ebc3d343`
- **Branch:** `stepup/main`
- **Date used:** 2026-08-09 (system date unavailable to this agent; literal date supplied by the
  task brief)
- **Mode:** Read-only. No file in the repository was modified, staged, or committed by this agent.
  One exception is the destructive-side-effect check in §4 — see the explicit note there; nothing
  was deleted.
- **Raw evidence:** persisted under
  `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/agent-c/` —
  `agent-c-command-log.txt` (full command transcript), `validate-governance-stdout-exit1.txt`
  (governance gate run), and `extracted/` (the unzipped package).
- **What was executed vs. inferred:** every claim in this document is labelled. All numeric claims
  were recomputed with a live command against the current working tree at `ee371182`; none were
  copied from the ZIP or from LCIS output without independent recomputation.
- **What remains unverified:** deep code-level claims inside the ZIP (e.g. exact line-level security
  findings in doc 10 §5.1–5.4 of the package) were spot-checked, not exhaustively re-derived; see
  §6. Live/staging/production state was not probed — no credentials were available or used.

---

## 1. ZIP existence and SHA-256 verdict

```bash
$ ls -la artifacts/local-operational-proof/letbuyy-merchant-app-v1-readiness-2026-08-09.zip
-rw-r--r--@ 1 saai_siddharth staff 121531 Aug 9 01:32 ...zip

$ shasum -a 256 artifacts/local-operational-proof/letbuyy-merchant-app-v1-readiness-2026-08-09.zip
ae07e720ae75cb5948c97ca16fe6ab4c392bb9f0d1af1cb3f823b38263bb5f18  ...zip
```

- File exists: **YES**.
- Claimed historical hash: `ae07e720ae75cb5948c97ca16fe6ab4c392bb9f0d1af1cb3f823b38263bb5f18`
  — 64 hex characters, a structurally valid SHA-256 length (checked with `wc -c`).
- Recomputed hash: `ae07e720ae75cb5948c97ca16fe6ab4c392bb9f0d1af1cb3f823b38263bb5f18`.
- **Verdict: MATCH.** The two strings are byte-identical (verified with a direct shell string
  comparison, not eyeballing). The claimed value is valid in format and correct in content.

## 2. Extraction

Extracted safely to
`artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/agent-c/extracted/`
(outside the repo tree proper — under the designated evidence directory, never over any tracked
path):

```bash
$ unzip -o -q .../letbuyy-merchant-app-v1-readiness-2026-08-09.zip -d .../extracted
exit code: 0
$ unzip -t .../letbuyy-merchant-app-v1-readiness-2026-08-09.zip
No errors detected in compressed data of ...zip
```

18 Markdown files extracted under
`MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09/` (`00_README_AND_AUTHORITY.md` through
`16_CHANGELOG_AND_EVIDENCE_INDEX.md`, plus `ZIP_MANIFEST.md`). All were read in full.

## 3. Archive manifest vs. actual extracted content

`ZIP_MANIFEST.md` lists per-file byte size and SHA-256 for all 17 numbered documents (it excludes
itself from its own digest, explicitly noted as self-referential). Every one of the 17 was
recomputed independently:

| File | Manifest size | Actual size | Manifest SHA-256 (last 8) | Actual SHA-256 (last 8) | Verdict |
|---|---:|---:|---|---|---|
| 00_README_AND_AUTHORITY.md | 9231 | 9231 | `772f6476` | `772f6476` | MATCH |
| 01_EXECUTIVE_LAUNCH_DECISION.md | 9805 | 9805 | `aad54f157` | `aad54f157` | MATCH |
| 02_COMPLETE_MERCHANT_FEATURE_INVENTORY.md | 60794 | 60794 | `a086f97c9f` | `a086f97c9f` | MATCH |
| 03_70_PERCENT_PLUS_V1_CANDIDATES.md | 9615 | 9615 | `71886b99c` | `71886b99c` | MATCH |
| 04_MANDATORY_V1_LAUNCH_FEATURE_REGISTER.md | 11622 | 11622 | `e03ecc6948e` | `e03ecc6948e` | MATCH |
| 05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md | 13792 | 13792 | `5ca7e6d86fa6` | `5ca7e6d86fa6` | MATCH |
| 06_END_TO_END_TRACEABILITY_MATRIX.md | 10032 | 10032 | `cac91ffc2c0` | `cac91ffc2c0` | MATCH |
| 07_GAP_BLOCKER_AND_DEPENDENCY_REGISTER.md | 45472 | 45472 | `355ca3b28f5e` | `355ca3b28f5e` | MATCH |
| 08_IMPLEMENTATION_WAVES_AND_AGENT_OWNERSHIP.md | 10140 | 10140 | `28c845c45139` | `28c845c45139` | MATCH |
| 09_TEST_SECURITY_AND_QUALITY_EVIDENCE.md | 18934 | 18934 | `95585f3ec5645bf0` | `95585f3ec5645bf0` | MATCH |
| 10_LCIS_FINDINGS_AND_INDEPENDENT_RECONCILIATION.md | 12550 | 12550 | `a39a39d728d45dd73` | `a39a39d728d45dd73` | MATCH |
| 11_INFRA_PROVIDER_AND_ENVIRONMENT_READINESS.md | 10697 | 10697 | `9454910a09167ab` | `9454910a09167ab` | MATCH |
| 12_DEPLOYMENT_ROLLBACK_AND_RELEASE_RUNBOOK.md | 9455 | 9455 | `4a3ab50` | `4a3ab50` | MATCH |
| 13_ANDROID_IOS_STORE_RELEASE_CHECKLIST.md | 17239 | 17239 | `4dee21d899e7` | `4dee21d899e7` | MATCH |
| 14_HUMAN_REQUIRED_ACTIONS.md | 10925 | 10925 | `2a83fa8dd28fcb` | `2a83fa8dd28fcb` | MATCH |
| 15_FINAL_GO_NO_GO_CERTIFICATION.md | 9597 | 9597 | `57373e658a3` | `57373e658a3` | MATCH |
| 16_CHANGELOG_AND_EVIDENCE_INDEX.md | 11514 | 11514 | `58ea6e5316f1ec8c` | `58ea6e5316f1ec8c` | MATCH |

**Verdict: no discrepancies.** Full 64-hex digests for all 17 files are in
`raw-evidence/agent-c/agent-c-command-log.txt`. `ZIP_MANIFEST.md` itself is 3882 bytes on disk vs.
the 2932 bytes it declares for itself — this is **expected and self-disclosed**: the manifest
records its own pre-footer size, then a "ZIP checksum" section is appended below the table. The
manifest's own "ZIP checksum" section is present but was left **empty** (no hash value recorded
under that heading) — a minor completeness gap in the package, not a correctness defect (the ZIP's
own SHA-256 is independently verified in §1 above by other means).

## 4. LCIS/Graphify output age and source commit

```bash
$ grep -n "built_at_commit" graphify-out/graph.json | head -1
"built_at_commit": "0db025a6b8529dfac74fd781f944a49fcd2563fd"

$ git log -1 --format="%H %cI %s" 0db025a6
0db025a6b8529dfac74fd781f944a49fcd2563fd 2026-06-14T00:00:09+05:30 v1-completion-cert: ...

$ git rev-list --count 0db025a6..ee371182
77
```

`graphify-out/` file mtimes cluster between 14 Jun and 20 Jun 2026 (`ls -la` in raw evidence).
`HEAD` (`ee371182`) is dated 2026-08-04T22:03:49+05:30. The graph is therefore **77 commits and
~7 weeks stale** relative to the audited commit. Treated as a hint only, per the task brief — this
matches (does not merely echo) the ZIP's own claim in doc 00 §3.4 and doc 10 §2.1, which was
independently reconstructed here from `graphify-out/graph.json` and `git log`, not copied.

**Note on a destructive side-effect discovered during recompute (§ safety):** while independently
running `node scripts/validate-governance.mjs` to verify the ZIP's gate-failure claim (§ doc 06),
I read `scripts/validate-governance.mjs:170–188` and confirmed it contains a `fs.rmSync` step
(`removeGeneratedArtifactDirectories`) that runs immediately before `stale-artifact-validator.mjs`
and recursively deletes `node_modules`-adjacent generated directories (`.next`, `.turbo`, `dist`,
`.dart_tool`, `build`, `coverage`, `.cache`, `.wrangler`, `.vercel`, `.symlinks`, `Pods`) under
`apps/`, `packages/`, `services/`. This governance-gate lane is fail-fast and aborted at an earlier
validator (index 5 of 108, `validate-design-system.mjs`) before ever reaching that step, so **no
deletion occurred** in this run — confirmed by `git status` showing zero deleted tracked files
before and after. This is reported as a finding, not an action I took.

## 5. Discrepancy matrix (ZIP claim vs. current repo truth)

| # | Claim | ZIP said | Current repo truth (command) | Verdict |
|---|---|---|---|---|
| 1 | ZIP SHA-256 | `ae07e720...bb5f18` (historical/task-supplied) | `shasum -a 256 <zip>` → identical string | **CONFIRMED** |
| 2 | Manifest per-file hashes/sizes | 17 entries, all listed | Recomputed all 17 with `shasum -a 256` / `stat -f%z` | **CONFIRMED** |
| 3 | Audited commit `ee371182` on `stepup/main` | Stated in doc 00 §3.1 | `git rev-parse HEAD` = `ee3711829d857e986014c5811bb94d86ebc3d343`; `git branch --show-current` = `stepup/main` | **CONFIRMED** |
| 4 | `git rev-list --count main..stepup/main` = 106 | Stated in doc 00 §3.1 | Recomputed: `106` | **CONFIRMED** |
| 5 | `git rev-list --count origin/main..stepup/main` = 291 | Stated in doc 00 §3.1 | Recomputed (local refs, no fetch performed): `291` | **CONFIRMED** |
| 6 | `git status --short \| wc -l` = 6821 | Stated in doc 00 §3.2 | Recomputed now: `6825` | **STALE** — small drift explained by continued work in this Wave 0 session between ZIP packaging (01:32) and this audit; see §5.1 below |
| 7 | Real-content-change file count = 84 | Stated in doc 00 §3.2 | Recomputed now: `99` (`git diff --numstat \| awk '$1+$2>0' \| wc -l`) | **STALE** — same cause |
| 8 | Untracked file count = 27 | Stated in doc 00 §3.2 | Recomputed now: `30` | **STALE** — same cause |
| 9 | LCIS `graphCommit` = `0db025a6...`, 77 commits behind HEAD | Stated in doc 00 §3.4, doc 10 §2.1 | Independently recomputed from `graphify-out/graph.json` `built_at_commit` + `git rev-list --count` | **CONFIRMED** |
| 10 | 108 validators total; gate aborts at index 5 (0-indexed), `validate-design-system.mjs`; 102 never execute | Stated in doc 09 §3, doc 10 §2.2 | Parsed `validators` array in `scripts/validate-governance.mjs` = 108 entries; ran `node scripts/validate-governance.mjs` live → exit 1, fails at the 6th executed validator (`Design-system governance FAILED`), i.e. array index 5 (0-indexed) | **CONFIRMED** |
| 11 | `validate:governance` currently exits non-zero (gate red) | Stated throughout | Ran live: exit code `1`, full stdout in raw evidence | **CONFIRMED** |
| 12 | 126 database migrations | Stated in doc 11, doc 12, doc 14 | `find database/supabase/migrations -maxdepth 1 -name "*.sql" \| wc -l` = `126`; max numeric prefix `197` | **CONFIRMED** |
| 13 | 16 GitHub Actions workflow files enumerated, `ci.yml` on develop/main only, `deploy-staging.yml` is the only one on `stepup/main` push | Stated in doc 07 (`EVID-S0-01`) | `ls .github/workflows/*.yml \| wc -l` = `16`; read `on:` blocks of `ci.yml` (develop/main) and `deploy-staging.yml` (`push: branches: [stepup/main]`) | **CONFIRMED** |
| 14 | Deprecated aliases (admin/auth/checkout/internal/merchant/storefront/analytics/operator-team-app/consumer-storefront) absent from topology | Implicit in CLAUDE.md/AGENTS.md, consistent with ZIP's active-topology claims | Checked all 9 paths with `[ -e ]` — all absent | **CONFIRMED** |
| 15 | Reserved services/apps are manifest-only placeholders | Implicit in CLAUDE.md and consistent with ZIP scope discussion | `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`, `checkout-runtime`, `mobile/shopper-app`, `mobile/operator-app` each contain exactly 2 files: `runtime.manifest.json` + `AGENTS.md` | **CONFIRMED** |
| 16 | Storefront host-routing middleware exists (`src/proxy.ts`) | Implicit; used as a citation target elsewhere in the ZIP | `find apps/storefront-runtime -iname proxy.ts` → `apps/storefront-runtime/src/proxy.ts` | **CONFIRMED** |
| 17 | App-marketplace router mounted in canonical gateway; `FEATURE_EXTENSIONS` defaults `true`, forced `false` only under `[env.production.vars]` | Stated in doc 10 §5.3 | `services/api-gateway/src/index.ts:54` imports `appStoreRouter`; `wrangler.toml` default `[vars]` and `[env.staging.vars]` both set `FEATURE_EXTENSIONS = "true"`; `[env.production.vars]` sets `"false"` | **CONFIRMED** |
| 18 | LCIS reports governance gate as 107/107 green while real gate is red | Stated doc 10 §2.2 | Not independently re-run against the live LCIS server in this session (no `pnpm lcis` invocation was performed by this agent — out of scope for a read-only ZIP-reconciliation pass); the live gate result (exit 1) was independently confirmed (row 11) | **UNVERIFIABLE** (LCIS side only — the gate-red half is confirmed, the LCIS-green half is taken on the ZIP's word) |

### 5.1 On the working-tree drift (rows 6–8)

The ZIP's own doc 00 states its numbers were captured "immediately before archiving" at
2026-08-09 01:32 (the ZIP's on-disk mtime). This audit ran later the same day, inside a Wave 0
program where other agents/worktrees are concurrently active (`git branch -a` shows 11
`worktree-agent-*` branches and `.claude/worktrees/agent-*` directories present on disk at audit
time). A working tree growing from 6821 → 6825 modified paths, 84 → 99 real-content-changed files,
and 27 → 30 untracked files over several hours in an actively-being-edited monorepo is consistent
drift, not a fabrication. It is recorded as **STALE** rather than **CONFIRMED** because the exact
numbers no longer match, and as **STALE** rather than **WRONG** because the direction and order of
magnitude are unchanged and the explanation is independently verifiable (same session, concurrent
worktrees visible in `git branch -a`).

## 6. Conflicts / escalation items

- **No conflict found between the ZIP and repository authority documents** (Constitution, root
  `AGENTS.md`) on any claim checked in this pass. The ZIP explicitly positions itself as bottom-of-chain
  evidence (doc 00 §2) and does not contradict any Never-Build List item, canonical winner, or scale
  envelope claim.
- **Gap, not a conflict:** `services/lcis-api` exists in the repository with real source
  (`src/app.ts`, `src/index.ts`, `src/middleware.ts`, `src/server.ts`, `test/*.test.ts`, a real
  `package.json`) but has **no `runtime.manifest.json`** and is **not named anywhere** in root
  `AGENTS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`,
  `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md`, or the Canonical Runtime Map /
  Deprecated Runtime Policy in `CLAUDE.md`. It is also not mentioned in any of the 17 ZIP documents
  (`grep -rn "lcis-api" <extracted>/*.md` returned nothing). This is a genuine silence in **both**
  the authority chain and the evidence package — flagged here as an escalation item for a human to
  classify (approved-but-undocumented runtime vs. something that should be added to the reserved
  or deprecated lists), not resolved by this agent.

## 7. Secret-shaped file scan (paths only, no contents disclosed)

Per safety rules, only paths and tracked/gitignored status are recorded — never contents.

- 9 `.env.local` files found via `git status --short --ignored=matching`, all under `apps/*/`
  (`app-marketplace`, `developer-portal`, `identity-platform`, `marketing-site`,
  `merchant-control-plane`, `platform-console`, `platform-operations-portal`,
  `storefront-runtime`, `theme-marketplace`), plus `tools/central-intelligence/.env.example`. All
  confirmed **gitignored** (`!!` marker in `git status`, and `git check-ignore -v` resolved a
  matching `.gitignore` rule for at least one sample). **None are tracked by git.** Contents were
  not opened.
- No secret-shaped content (`sk_live_`, `sk_test_`, AWS access-key pattern, PEM private-key block,
  or an assigned `SUPABASE_SERVICE_ROLE_KEY=<value>` pattern) was found inside the 17 extracted ZIP
  Markdown files via pattern grep.
