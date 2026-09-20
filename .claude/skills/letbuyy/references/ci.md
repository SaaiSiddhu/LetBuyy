# GitHub Actions — what runs, why the owner may get "Run failed" mail, how to read a red run

**Measured 2026-09-04 at `develop` = `a751a2ff`.** Re-measure before quoting.

## 0. The signal is unreadable from this machine (finding, not a verdict)

```
gh auth status            → only account: Edynox-hq
gh api repos/SaaiSiddhu/Letbuyy_Store   → HTTP 404 Not Found
GIT_TERMINAL_PROMPT=0 git ls-remote --heads origin → "Repository not found"
git log -1 --format=%cd FETCH_HEAD      → last fetch 2026-08-25
```

Two explanations fit and this repository cannot tell them apart: the remote is **private** and the
logged-in account has no access, or the remote was **renamed/moved**. Both are `UNKNOWN_LIVE_STATE`.
**Never call CI "blocked" or "billing-blocked" on this evidence** — the EDYNOX programme carried that
wrong note for four days. Owner action (D-CI-ACCOUNT in `decisions.md`): log the repository-owning
account into `gh` (`gh auth login` or `gh auth switch`) and confirm the remote URL. Then:

```bash
gh run list --repo SaaiSiddhu/Letbuyy_Store --limit 30 --json databaseId,name,headBranch,headSha,conclusion,createdAt,event
gh run view <run-id> --repo SaaiSiddhu/Letbuyy_Store --json jobs --jq '.jobs[] | "\(.conclusion)\t\(.name)"'
gh run view <run-id> --repo SaaiSiddhu/Letbuyy_Store --log-failed | sed 's/\x1b\[[0-9;]*m//g' | grep -B8 '##\[error\]Process completed'
```

## 1. Why the mail arrives (when it does)

GitHub e-mails the account that **triggered** a run when it fails. Nothing was pushed since
2026-08-15, so today's mail can only come from **scheduled** workflows: `branch-lag-monitor.yml`
(hourly, `17 * * * *`) fails whenever `origin/main` is behind `origin/stepup/main` — they were level at
`f52abca7`, so it should pass until the owner's first push moves one of them; after GOV-3 it measures
`main` against `staging` instead. `full-security-audit.yml` (Mondays 04:30 UTC) needs
`ANTHROPIC_API_KEY`; `hot-table-partition-maintenance.yml` (monthly) runs plan-only without secrets.
Reducing mail honestly means fixing or retiring failing jobs, never muting notifications.

## 2. Workflows and triggers (`.github/workflows/`, 17 files)

| Workflow | File | Trigger (after GOV-3) | Role under `develop → staging → main` |
|---|---|---|---|
| CI | `ci.yml` | push + PR on `develop` · `staging` · `main` · `stepup/main` · `codex/web-v1-integration` | the cloud signal for `develop` merges and promotions; jobs: typecheck · secret-hygiene · lint · unit-tests · merge-safety-gate (full typecheck, gateway unit, behavioral, contracts, merchant_app analyze/test) · governance (`pnpm run validate:governance`, the REAL lane) · mobile-merchant (macOS: analyze, test, debug APK, iOS no-codesign) · build |
| Architecture governance | `architecture-governance.yml` | PR (path-scoped) + push `codex/**`, `main` | aggregates every gate step (`gate-aggregate`), never fail-fasts |
| Branch lag monitor | `branch-lag-monitor.yml` | hourly cron + dispatch | `branch-lag-guard-validator` with `LETBUYY_RELEASE_INTEGRATION_BRANCH: staging` |
| Production deploy | `production-deploy.yml` | **`workflow_dispatch` only (GOV-3, D-DEPLOY)** — was push `main` | migrates the production DB (`supabase db push`, encrypted backup first, untracked migrations rejected), deploys 4 Workers, Vercel apps; branch-lag guard (`main` not behind `origin/staging`) → governance gate (red today: stops safely) → credential preflight |
| Deploy Staging | `deploy-staging.yml` | **`workflow_dispatch` only (GOV-3)** — was push `stepup/main` | governance gate → `wrangler deploy --env staging` ×4 → Vercel; skips without credentials |
| Staging deploy (legacy) | `staging-deploy.yml` | dispatch only (since 2026-06-12) | duplicate lane to be collapsed (`AGENTS.md` DEPLOY-R2) |
| Staging runtime deployment | `staging-runtime-deployment.yml` | dispatch + push `main`/`release/**` (path-scoped) | Terraform **plan** only on push; execute needs the dispatch input |
| Production rollout | `production-rollout.yml` | dispatch only | `production-deploy.mjs` plan/execute per environment |
| Live production certification | `live-production-certification.yml` | dispatch only | `phase4-live-certify.mjs` |
| Environment lifecycle | `environment-lifecycle.yml` | PR (path-scoped) + dispatch | staging bootstrap gated behind `inputs.deploy_staging` |
| Mobile merchant release | `mobile-merchant-release.yml` | dispatch only | signed AAB from a base64 keystore secret; **uploads an artifact, never to the Play Store** |
| Hot-table partition maintenance | `hot-table-partition-maintenance.yml` | monthly cron + dispatch | plan-only unless `execute` |
| Security review | `security-review.yml` | PR | `anthropics/claude-code-security-review` (needs `ANTHROPIC_API_KEY`) |
| Full security audit | `full-security-audit.yml` | Monday cron + dispatch | same action, whole repo |
| Graph intelligence | `graph-intelligence.yml` | push/PR (path-scoped: migrations, gateway, graph-server) | LCIS graph refresh |
| LCIS PR analysis | `lcis-pr-analysis.yml` | PR | comment bot |
| Architecture governance (others) | — | — | — |

**No workflow can reach the Firebase project `letbuy-y` or the Play Store on a push** (verified: no
`firebase deploy` anywhere; the mobile release lane is dispatch-only and artifact-only). That is why
D-DEPLOY's P0 class was empty and the dispatch-only change is about the **canonical** estate.

**Why the push triggers were removed (D-DEPLOY, 2026-09-04):** `production-deploy.yml` would run a
production DB migration and four Worker deploys on any `main` push the moment secrets exist and the
governance gate goes green; nothing has ever been deployed and the Vercel project IDs are
placeholders. Under the new model `main` = production, so an automatic deploy on push may return
**only** after a DEPLOY-1 phase proves the targets (`promote.md` §4). `deployment-safety-validator`
now asserts "exactly one production deploy workflow, reachable only from `main` or dispatch";
`workflow-trigger-coverage-validator` asserts the same shape for both deploy lanes.

## 3. What would be red today — attributed from local evidence (CI itself unread)

| Job | Local reproduction — rows marked RE-MEASURED are from a clean worktree at `develop` = `6edbbf0e` (2026-09-12); the rest are still the `a751a2ff` GOV-3 rehearsal (2026-09-04). Details in `hazards.md` § Ambient reds | Class | Owner action |
|---|---|---|---|
| CI · typecheck | **RE-MEASURED 2026-09-12: typecheck now exits 0, CLEAN.** The 29 `TS2322` in the retired cashfree/paypal/stripe adapters are gone — `letbuyy-ambient-red-masked-the-gateway-build` records that this red used to hide the api-gateway build, because turbo cancels dependents | stale code after the rail retirement | deletion-gated cleanup (DEL-R2), CI-1 |
| CI · lint | **RE-MEASURED 2026-09-12, UNCHANGED and exact:** `@letbuyy/customer-web#lint` 921 problems / 38 errors, first offender `apps/customer_web/scripts/liquid-parity-harness.mjs`. The 38 split 37 `no-hardcoded-hex` (CAP-C77 — none of them wants a token) + 1 `no-new-next-api-route` (CAP-C76). Only this package exits non-zero; the other four apps emit warnings only | governance debt | CI-1 |
| CI · governance (real lane) | **RE-MEASURED 2026-09-12: individual sweep 111/113.** Only `environment-validator` and `stale-artifact-validator` are red, both attributed and discharged (F-SECSCAN-1, F-STALECOUNT-1). `foundation-antifabrication-gate`, `sequential-migration` and `tenant-isolation` now PASS | mixed: other session's uncommitted work · validator false positive · governance debt | the migration owner commits 208–210 with rollbacks; an `environment-validator` exemption design; the identity theming session restores the reachability target (UX-1) |
| CI · unit-tests / merge-safety-gate (contracts) | **RE-MEASURED 2026-09-12: 277 tests, 277 pass, 0 fail.** All 7 former failures were stale assertions, not regressions; see `hazards.md` | stale checks after the Phase M rename | CI-1 |
| CI · merge-safety-gate (gateway unit) | **RE-MEASURED 2026-09-12: 962 tests, 953 pass, 0 fail, 9 skipped.** Two of the Phase M trio were repaired as stale assertions; the third is not in the current failure set. See `hazards.md` | stale check or code defect — undetermined | security lane + CI-1 |
| CI · merge-safety-gate (behavioral, Flutter) | behavioral suite needs the ephemeral Postgres in CI; merchant_app 172/172 at Phase S | unknown until read | read the run |
| CI · mobile-merchant | macOS runner: analyze + test + debug APK + iOS no-codesign | iOS never built locally (no Xcode); `UNKNOWN_LIVE_STATE` | read the run |
| CI · secret-hygiene | validators only; no gitleaks in this repo | passes locally | — |
| Branch lag monitor | `origin/main` vs `origin/stepup/main` level at `f52abca7` → passes; after GOV-3 measures `staging` | policy | push all three branches together |
| Deploy Staging / Production deploy | not triggerable by push any more | — | dispatch only after DEPLOY-1 |

## 4. Rules for every mode

- **A red run is evidence, not a verdict.** Attribute each failing job to: code defect · stale check
  after a rename/deletion · missing generator run · missing infrastructure · policy conflict with a
  frozen decision · another session's uncommitted work. Never delete a gate to go green; never bump
  a ratchet baseline or a date to go green.
- **Local gates first.** `scripts/gate.sh` reproduces every laptop-runnable lane (typecheck, lint,
  the full validator sweep run individually, contracts, gateway unit, per-package suites, Flutter
  analyze/test/build). CI adds the real governance lane (with its artefact cleanup), the ephemeral
  Postgres behavioral suite, the macOS iOS build, and the Claude security review. A phase that
  changes CI-only lanes states that it could not run them.
- **CI runs on `develop` pushes.** Pushing `develop` (when `run.md` config allows and the harness
  permits) is how cloud signal is obtained before promotion. Read the run, attribute, record the run
  id in the phase report and the `Promotions` row.
- **Never widen `permissions:`**, never add a secret to a workflow without naming the key and its
  rotation owner, never reintroduce the retired `.store` domain literal (DEPLOY-R3), never point a deploy lane at a branch
  other than `staging` (staging lanes) or `main` (production lanes).
- **The CI-1 phase** (unowned as of 2026-09-04): (1) the owner logs the right account into `gh`;
  (2) read the last 30 runs per branch and attribute every red job with the table above as the
  starting hypothesis; (3) fix real defects; retire stale references (`.github/CODEOWNERS` still names
  `apps/storefront-runtime`, `merchant-control-plane`, `platform-console`, `apps/mobile/`); collapse
  the duplicate staging lane (DEPLOY-R2); (4) decide the `environment-validator` exemption design and
  the `foundation-antifabrication-gate` bridge literal; (5) success = a green `CI` on `develop` with
  **no gate deleted**.
