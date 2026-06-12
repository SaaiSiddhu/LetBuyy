# FOUNDATION CLOSURE PROGRAM — LETBUYY

**DOC: FC-01 · Date: 2026-06-12 · Baseline HEAD: `da83ba92` (`stepup/main`, clean tree, gate green 106)**
**Authority:** subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (DOC 01) and root `AGENTS.md` (DOC 02). This program changes NOTHING by itself — documentation only. Execution happens only via the registered execution prompt (FC-04/FC-05).
**Input:** `FINAL_REPOSITORY_TRUTH_CERTIFICATION_2026_06_12/FINAL_REPOSITORY_TRUTH_CERTIFICATION.md` (7 blockers B1–B7).
**Objective:** every blocker closed with committed evidence → `FOUNDATION_FREEZE_CERTIFICATION.md` activates → **FOUNDATION ERA CLOSED** → handoff to Launch Readiness.

---

## PHASE A — BLOCKER RE-VERIFICATION (fresh evidence, 2026-06-12, HEAD `da83ba92`)

| # | Blocker | Re-verified state | Evidence (re-checked this session) | Verdict |
|---|---|---|---|---|
| B1 | Production reality divergence | origin/main = `41b6ea49` (2026-06-09 12:25 IST), **170 commits behind** `stepup/main`; zero pushes ever; origin lacks a `stepup/main` ref the prod branch-lag guard resolves (MERGE_RUNBOOK.md:60) | `git rev-list --count origin/main..stepup/main` = 170; `git log origin/main -1` | **STILL VALID** |
| B2 | Branch invariant violation | `git rev-list --count main..stepup/main` = **6** (law mandates 0: MERGE_RUNBOOK.md:9,34; AGENTS.md DEPLOY-R1 :330) | command output = 6 | **STILL VALID** |
| B3 | Active-branch deploy ungated | `.github/workflows/deploy-staging.yml` (push → `stepup/main`) contains **0** occurrences of `validate-governance`/`validate:governance`; no untracked-migration guard; `deployment-safety-validator.mjs:72-91` scopes only main+production | grep count = 0 | **STILL VALID** |
| B4 | Untracked-migration blind spot | `sequential-migration-validator.mjs:1,9` imports and iterates `getTrackedFiles()` only; never compares tracked-vs-disk | validator source lines 1, 9 | **STILL VALID** |
| B5 | False-green invariant runner | `check-invariants.mjs:57` → `const passed = result.status === 0;`; all 8 `invariants/i*.sql` are plain SELECTs, 0 `RAISE`/`ON_ERROR_STOP` — psql exits 0 while printing violation rows | grep counts = 0 across all 8 | **STILL VALID** |
| B6 | AI-credit purchase un-ledgered | `services/api-gateway/src/routes/ai.ts:1063-1112` builds `purchaseRecord`, returns it in JSON with `credit_grant_deferred_until_canonical_ledger: true`; **no insert, no RPC, no ledger row, no webhook consumer** (0 matches in queue-workers); S11 (`scripts/money-certification/scenarios/s11*.mjs:2-3,48,118`) defines the intended contract: payment link → webhook → ledger evidence → grant unlock | route source; S11 source | **STILL VALID** |
| B7 | Shared internal signing secrets | One `STAGING_INTERNAL_API_SECRET` fanned to api-gateway, webhook-service, queue-workers AND Vercel app builds (`staging-deploy.yml:88,89,115,134,152,232`); same pattern in prod (`production-deploy.yml:315-319`); matrix lists one shared set for all 5 Next apps (`config/env/staging-production-secret-matrix.json:29-79`); `set-secrets.mjs` generates **one value per suffix per env** (`generatedSecretSuffixes` incl. `INTERNAL_API_SECRET`, `AUTH_SECRET`, `CUSTOMER_SESSION_SECRET`) | workflow + matrix + script sources | **STILL VALID** |

**No blocker is partially fixed. No blocker is obsolete. All seven stand at HEAD `da83ba92`.**

Useful pre-existing machinery discovered during re-verification (reduces closure cost):
- `governance-common.mjs:196` already exports `getUntrackedFiles()` (used by `stale-artifact-validator`) → B4 is a small-diff fix.
- `internal-auth.ts:23-25` already supports `INTERNAL_API_SECRET_PREVIOUS` / `WORKER_INTERNAL_API_SECRET` → a dual-accept rotation window already exists for B7.
- S11 already encodes the correct B6 contract (deferred grant until ledger evidence) → B6 is "make the code honor the committed contract," not new design.
- `production-deploy.yml` already contains the gate + untracked guard → B3 is replication into one workflow, not invention.

---

## PHASE B — CLOSURE PLAN PER BLOCKER

> Conventions used below — **Touch perimeter**: only files an executor may modify for that blocker. **Validation gates**: all must pass before the closure commit counts. **Closure evidence**: artifacts that must exist in `FOUNDATION_CLOSURE_2026_06_12/evidence/bN/` + an `EXECUTION_LEDGER.md` row `CLOSURE-BN`. Every closure commit must leave `node scripts/validate-governance.mjs` green and the tree clean.

---

### B4 — Untracked-migration blind spot *(execute FIRST)*

**Root cause.** `sequential-migration-validator.mjs` (added `fa3228cf`) filters `getTrackedFiles()` — the git index — so a migration present on disk but never `git add`ed cannot enter `prefixes`/`byNum`. The gate's file universe is split: most content validators walk disk (`phaseBEntries`), migration validators read git. The historically probe-proven hole (untracked 162–166 invisible) survived P2.2.

**Risk.** A schema change can exist locally, pass the gate, ship to staging via B3's ungated path (compounding), and silently diverge from the committed migration chain. Deploy-time `supabase db push` ordering breaks; recovery requires forensic diffing. Likelihood: medium (it already happened once). Impact: high (schema truth).

**Required changes.**
1. Rework `scripts/validators/sequential-migration-validator.mjs` to build the migration set from **tracked ∪ disk ∪ untracked** and FAIL on: (a) any untracked `database/supabase/migrations/*.sql` (message names the file), (b) duplicates/gaps computed over the union, using existing `getUntrackedFiles()` (`governance-common.mjs:196`).
2. Keep CI semantics unchanged (CI checkouts have no untracked files → no behavior change in CI; the protection is local/pre-push, where the hole was exploited).

**Validation gates.** Gate lane green (count becomes the new baseline; record it). **Mutation probe (mandatory, repo convention):** create untracked `database/supabase/migrations/170_closure_probe.sql` → gate must FAIL naming it → delete probe → gate green. Transcript saved.

**Rollback plan.** Single-commit revert of the validator file (`git revert <closure-commit>`); no runtime code touched; gate returns to prior baseline.

**Closure evidence.** Probe transcript (fail + pass) at `evidence/b4/probe-transcript.txt`; validator diff; ledger row `CLOSURE-B4`.

**Closure criteria.** Gate fails on any untracked migration; probe transcript committed; ledger row present.

---

### B3 — Active-branch deploy bypasses the gate *(execute SECOND)*

**Root cause.** `deploy-staging.yml` was authored as a fast deploy lane for `stepup/main` before the gate became deploy-coupled; `deployment-safety-validator.mjs:72-91` only constrains workflows that push to `main` with production deploy patterns, so staging fell outside every assertion. Nothing forces the gate onto the branch where 100% of development happens.

**Risk.** Any commit on `stepup/main` — including one that would fail the gate — deploys to staging Cloudflare + Vercel automatically. Staging is the evidence environment for the entire launch program (S1–S12, parity, pilot); ungated staging poisons every downstream certification.

**Required changes.**
1. Add a `governance-gate` job to `.github/workflows/deploy-staging.yml` (checkout → pnpm install → `node scripts/validate-governance.mjs --lane=gate`) and make `deploy-workers`, `deploy-apps` depend on it (`needs: governance-gate`).
2. Add the untracked-migration guard step used by production (`git ls-files --others --exclude-standard database/supabase/migrations/` must be empty — mirrors `deployment-safety-validator.mjs:123`). Vacuous in CI but keeps the two deploy lanes textually symmetric and validator-checkable.
3. Extend `deployment-safety-validator.mjs` with a staging clause: `deploy-staging.yml` MUST contain the gate invocation and the deploy jobs MUST declare `needs` on it; FAIL otherwise. (Document-content check, but the workflow execution itself is the reality check.)
4. Decide-and-record for `staging-deploy.yml` (push → `develop`, runs `supabase db push --include-all`, no gate): `develop` is fully merged and stale → either add the same gate or disable the trigger with a comment pointing at this program. Either is acceptable; silence is not.

**Validation gates.** Gate lane green including the extended deployment-safety assertions. Mutation probe: temporarily strip the `needs:` line in a scratch copy → extended validator must FAIL → restore.

**Rollback plan.** Revert the workflow + validator commit. Staging deploys revert to fast-ungated (pre-closure state); no runtime impact.

**Closure evidence.** Workflow diff; extended validator diff + probe transcript at `evidence/b3/`; first post-change staging run URL or run-log excerpt showing `governance-gate` job executed before deploys (may be appended post-push as launch evidence); ledger row `CLOSURE-B3`.

**Closure criteria.** No workflow in `.github/workflows/` deploys any branch without the gate ordered first; validator enforces it; ledger row present.

---

### B5 — False-green money invariant runner *(execute THIRD)*

**Root cause.** `check-invariants.mjs:53-58` spawns `psql --file iN.sql` with `stdio: 'inherit'` and equates `exit 0` with PASS. The 8 invariant SQLs are diagnostic SELECTs ("Expected: 0 rows") with no `RAISE`/`ON_ERROR_STOP`; psql exits 0 after successfully *printing violation rows*. The runner can only fail on connection/syntax error — never on a money violation.

**Risk.** This runner is GO/NO-GO row 4 and exit-gate G-D3 of the launch program. As built, a corrupt ledger (unbalanced transaction, nonzero rake, duplicate idempotency key) certifies GREEN. It converts the strongest money evidence into the weakest.

**Required changes.**
1. Change the runner to capture stdout (`stdio: ['ignore','pipe','pipe']`, keep `--tuples-only --no-align`) and define `passed = (exit === 0) && (stdout.trim() === '')`. Print captured rows on failure. Exit nonzero if any invariant fails.
2. Do NOT rewrite the 8 SQL files into DO/RAISE blocks (keeps them human-runnable diagnostics); the assertion moves to the runner. (DB-write-time enforcement already exists independently via `139:378` balance trigger — the runner is the audit layer.)
3. Add npm script `money:invariants` → `node scripts/money-certification/check-invariants.mjs` so the harness is invocable by name (satisfies the no-noop-test-script pattern without entering the default `test` chain, which has no DB).
4. Add a **negative-control fixture**: `scripts/money-certification/invariants/fixtures/violation-probe.sql` (`SELECT 'probe-violation';` — returns 1 row) + runner flag `--probe` that runs it and asserts the runner FAILS on it. This makes false-green structurally impossible to reintroduce silently.

**Validation gates.** `node check-invariants.mjs --probe` exits nonzero (negative control proves detection); gate lane green; `tooling-governance-validator` allowlist updated if paths change.

**Rollback plan.** Revert runner commit; SQL files untouched, so diagnostics remain usable by hand.

**Closure evidence.** Probe run transcript (runner FAILS on violation fixture) + clean-run semantics description at `evidence/b5/`; ledger row `CLOSURE-B5`. *(A green run against live staging DB is launch-phase evidence — G-D3 — not foundation-closure evidence; foundation closes on instrument correctness.)*

**Closure criteria.** Runner fails on nonempty result rows; negative control committed and passing (i.e., failing correctly); npm script wired; ledger row present.

---

### B6 — AI-credit purchase path un-ledgered *(execute FOURTH)*

**Root cause.** The purchase endpoint (`ai.ts:1063-1112`) was committed as a promissory note: it fabricates a `purchaseRecord` object, returns HTTP 202 with `credit_grant_deferred_until_canonical_ledger: true`, and persists nothing. The deferred-grant consumer it promises was never built (0 matches in `services/queue-workers`). S11 (`scenarios/s11*.mjs`) already encodes the intended contract — grant must stay 0 pre-payment, unlock only after webhook + canonical ledger evidence — so code and committed contract have diverged.

**Risk.** Today it fails closed (no money lost, no credits granted) — but it is a live route advertising a money flow that doesn't exist: revenue would be collected by the payment link with **no ledger row, no record, no grant**, the exact class of defect (un-ledgered capture) the foundation era was declared to have eliminated. It also poisons S11: the scenario can only pass by exercising RPCs directly, not the product path.

**Required changes — exactly one of two closure forms (executor picks per the decision rule; no third option):**
- **Form A — implement the committed contract (preferred if ≤ the effort budget):**
  1. Persist a purchase-intent row at request time (status `pending_payment`, idempotency key, amount, site_id).
  2. Handle the payment-provider webhook (existing webhook-service / queue-workers patterns) → atomically: post a canonical ledger transaction (new `source_type: 'ai_credit_purchase'`, balanced entries consistent with `post_ledger_transaction` authority `139:251`; settlement-writer constraint respected) → mark intent `paid` → grant credits into `ai_credits` keyed by the same idempotency key.
  3. The 202 response keeps its deferred-grant semantics — now true.
  4. Add `ai_credits` + the intent table to `canonical-ledger-only-validator.mjs`'s money-table list so any future write site requires ledger adjacency.
- **Form B — honest retirement (mandatory fallback if Form A would require new money design beyond the S11 contract):**
  1. The route returns `501 AI_CREDIT_PURCHASE_NOT_AVAILABLE` behind `FEATURE_AI_CREDIT_PURCHASE` defaulting OFF in **all** environments (note: `featureFlags.ts:25` fails open in non-prod — this flag must therefore be explicitly set `"false"` in all `wrangler.toml` env blocks, not left unset).
  2. Delete the fabricated `purchaseRecord` JSON; record a `SKIPPED_HUMAN_DECISIONS.md` row (`SKIP-B6-AI-CREDIT-DESIGN-ARB`) deferring the money design to ARB.
  3. S11 is annotated to assert the 501 (path closed = no un-ledgered mutation possible).

**Decision rule.** Form A only if the webhook consumer can reuse the existing capture-webhook pattern and `post_ledger_transaction` without schema redesign; anything more = Form B. Both forms close the blocker because the blocker is "un-ledgered money path exists," and both end with **no reachable un-ledgered path**.

**Validation gates.** Gate lane green (incl. extended canonical-ledger-only list under Form A); S11 passes against its updated contract semantics in dry-inspection; mutation evidence per repo convention (e.g., under Form A, removing the ledger post must make the S11/I-runner detect it; under Form B, unsetting the flag must still yield 501 in prod-simulation).

**Rollback plan.** Form A: revert commit; route returns to today's fail-closed 202 (no money risk window because grant only ever happens post-ledger). Form B: revert restores the 202 promissory behavior — equally fail-closed.

**Closure evidence.** Route diff + (A) webhook-consumer diff + ledger-transaction shape, or (B) flag matrix + SKIP row; S11 alignment note; `evidence/b6/`; ledger row `CLOSURE-B6`.

**Closure criteria.** Zero reachable money-mutation paths without a canonical ledger post — re-grep `ai.ts` shows either a real persist+ledger chain or an unconditional 501; ledger row present.

---

### B7 — Shared internal signing secrets *(execute FIFTH — largest item)*

**Root cause.** Secret topology was designed for operational simplicity: `set-secrets.mjs` generates **one value per suffix per environment** and the deploy workflows fan that single value into every runtime (workers via `wrangler secret put`, Next apps via build env). The trust model ("internal HMAC = trusted identity," `internal-auth.ts:128-152`) was layered on top without per-caller keys, so possession of the one secret = ability to mint identity assertions the gateway trusts.

**Risk.** Any compromise of ANY of ~10 runtimes (including frozen-but-deployed-to-staging apps) yields platform-wide identity forgery: forged `X-LetBuyy-Internal-User-ID/Email` headers, forged customer/platform sessions (shared `AUTH_SECRET`/`CUSTOMER_SESSION_SECRET`). This is the single largest lateral-movement amplifier in the architecture.

**Required changes (repo-side; live rotation is a human seam — see B7-live):**
1. **Per-caller internal auth.** Extend `internal-auth.ts` to a keyring model: callers send a caller-id header (e.g. `X-LetBuyy-Internal-Caller`); the gateway verifies the HMAC against `INTERNAL_API_KEYRING` (JSON: callerId → secret). Build on the existing dual-accept machinery (`INTERNAL_API_SECRET_PREVIOUS`, `internal-auth.ts:23-25`): legacy single-secret acceptance stays behind `INTERNAL_AUTH_LEGACY_ACCEPT` with a dated sunset comment, so rotation is non-breaking.
2. **Per-runtime generation.** `set-secrets.mjs`: move `INTERNAL_API_SECRET` out of the global `generatedSecretSuffixes` into per-project generation (`STAGING_<PROJECT>_INTERNAL_API_SECRET`), emit the gateway keyring value, and stop emitting one shared value.
3. **Workflow fan-out split.** `staging-deploy.yml` / `production-deploy.yml`: each runtime receives ITS OWN secret name; the gateway additionally receives the keyring. The grep signature "same `${{ secrets.X }}` appearing for multiple runtimes" must disappear for `INTERNAL_API_SECRET`.
4. **Matrix least-privilege.** `staging-production-secret-matrix.json`: per-runtime `INTERNAL_API_SECRET` entries; remove `AUTH_SECRET` from runtimes that only *verify* via gateway introspection (every Next app that does not itself sign — per the identity audit, console falls back to `AUTH_SECRET` (`console-session.ts:24`): give console its own `PLATFORM_CONSOLE_SESSION_SECRET` (suffix already exists in `set-secrets.mjs`) and remove the fallback); `CUSTOMER_SESSION_SECRET` restricted to its two legitimate parties (gateway + storefront) pending full issuer consolidation (a Launch-era identity item, NOT reopened here).
5. **Enforcement validator.** New `secret-topology-validator.mjs` (gate lane): asserts (a) matrix declares per-runtime `INTERNAL_API_SECRET`, (b) no deploy workflow assigns one `secrets.*INTERNAL_API_SECRET` expression to >1 runtime, (c) legacy-accept flag carries the sunset marker.
6. **Out of scope (do NOT do here):** consolidating the 9 token issuers, removing GoTrue, enforcing EdDSA in non-prod — that is Launch-era identity work (LAUNCH_HANDOFF §identity); B7 closes the *shared-secret* surface only. Reopening issuer architecture under this blocker = constitution violation (FC-04/FC-05 never-dos).

**Validation gates.** Gate lane green incl. new validator; existing internal-auth tests extended (keyring verify positive/negative + legacy window); mutation probe: duplicate one secret across two runtimes in a scratch matrix copy → validator FAILs.

**Rollback plan.** Keyring verify is additive; legacy accept stays on until humans complete rotation — reverting the workflows/matrix restores fan-out with zero downtime at any point. Single `git revert` per commit.

**Closure evidence.** internal-auth + set-secrets + 2 workflow + matrix diffs; validator + probe transcript; rotation runbook appended to `MERGE_RUNBOOK.md` or `EXECUTABLE_HUMAN_REQUIRED.md` as `HR-SECRET-ROTATION` (currently 19 HR rows → 20); `evidence/b7/`; ledger row `CLOSURE-B7`.

**Closure criteria (B7-code, foundation).** Architecture no longer *requires* sharing: keyring verify live, per-runtime generation + fan-out committed, validator enforcing, legacy path sunset-marked, HR row registered. **B7-live (launch, human):** GitHub secrets actually regenerated per-runtime, legacy accept disabled — tracked in LAUNCH_HANDOFF.

---

### B2 — `main..stepup/main` invariant violation *(execute SIXTH — final repo-side act)*

**Root cause.** P1 ran `git branch -f main stepup/main` once (`762e84bf` era) and no later step re-ran it; `stepup/main` advanced 6 commits (P4→P2.1-blocked) and the lag "silently re-accumulated" — the exact failure mode AGENTS.md DEPLOY-R1 (:330) forbids. The invariant is enforced remotely (`LETBUYY_ENFORCE_BRANCH_LAG=1` in `production-deploy.yml:36`) but only *warned* locally.

**Risk.** Pushing per the runbook with main≠stepup publishes a stale `main` → the production workflow (push→main) builds 6-commits-old code, and the runbook's own invariant gate (MERGE_RUNBOOK.md:9) blocks step 4. B1 cannot close while B2 is open.

**Required changes.**
1. After ALL other closure commits (B4,B3,B5,B6,B7 + program-tracking commit): `git branch -f main stepup/main` (or `git checkout main && git merge --ff-only stepup/main`). This is a ref move, not a content change — permitted under "documentation/refs" even in a code-frozen end-state, and mandated by DEPLOY-R1.
2. Process hardening (small, allowed): extend `branch-lag-guard-validator.mjs` so the LOCAL gate lane FAILS (not warns) when `main..stepup/main > 0` **and** env `LETBUYY_FOUNDATION_CLOSED=1` is set; the closure commit sets that env var in the gate invocation documented in MERGE_RUNBOOK. (Keeps day-to-day dev ergonomics; makes the closed-state invariant self-enforcing.)

**Validation gates.** `git rev-list --count main..stepup/main` = 0 at the final tree; gate green with no branch-lag warning; runbook step 3 invariant satisfied.

**Rollback plan.** `git branch -f main <previous-sha>` (reflog retains it). No content risk.

**Closure evidence.** Command transcript + `git rev-parse main stepup/main` showing identical SHAs; `evidence/b2/`; ledger row `CLOSURE-B2` (this row is appended BEFORE the final ff so the ff captures it — see ordering note in FC-04 §batch-7).

**Closure criteria.** `main == stepup/main` at the certified closure SHA; (optional hardening) closed-mode gate failure verified by probe.

---

### B1 — Production reality divergence *(execute SEVENTH — HUMAN SEAM)*

**Root cause.** Deliberate governance: `MERGE_RUNBOOK.md:16` forbids pushing until the human owner completes branch protection; no human has executed the seam since `41b6ea49` (2026-06-09). Everything after — 170 commits including the `/api/auth/switch` takeover fix, `commission_bps 300→0`, RLS hardening 160/162/163/164, the EdDSA verifier — exists only locally. Compounding: the prod branch-lag guard resolves `origin/stepup/main` (MERGE_RUNBOOK.md:60), a ref that does not exist on the remote yet.

**Risk.** The deployed product continues to ship a known unauthenticated account takeover and a 3% rake the business has publicly killed. Every day of non-push is unmitigated production exposure + growing divergence. This is simultaneously the era's exit door and its most urgent security remediation.

**Required changes (no code).** Human owner executes MERGE_RUNBOOK steps in order: (1) branch protection on `main` (+ `stepup/main` if protected-ref policy requires), (2) verify local invariants (clean tree, gate green, `main..stepup/main == 0` — i.e., B2 closed), (3) push **`stepup/main` first**, then `main` (runbook :53-57 — order matters because the guard resolves `origin/stepup/main`), (4) delete stale `origin/develop` (fully merged, 0 unmerged commits — verified), (5) record completion.

**Validation gates.** `git ls-remote origin` shows `refs/heads/main` and `refs/heads/stepup/main` both at the closure SHA; `git rev-list --count origin/main..main` = 0.

**Rollback plan.** Branch protection prevents force-push regression; if a push must be unwound, revert commits forward (never force-push — NEVER-DO in FC-04/FC-05). Note: rollback of a push does NOT re-secure anything (origin was already worse); there is no scenario where un-pushing reduces risk.

**Closure evidence.** `git ls-remote` transcript; `SKIPPED_HUMAN_DECISIONS.md` SKIP-A2 row updated to RESOLVED with date+operator; ledger row `CLOSURE-B1A`.

**Closure criteria.** **B1-a (foundation):** origin == local converged reality (both refs at closure SHA) + branch protection active. **B1-b (NOT foundation — first act of Launch Readiness):** first gated production deploy + G4 atomic go-live smoke (switch denied / anon denied / `commission_bps=0` live). B1-b is deliberately excluded from foundation closure because it depends on provider/human seams (19 HR rows) that belong to launch — see LAUNCH_HANDOFF_DOCUMENT.md. The Foundation Era closes when the truth is *published and protected*; it is *promoted* in the Launch era.

---

## PHASE C — EXECUTION ORDER

```
CP-0   Track program dirs + register prompts (same-commit rule, P0 precedent)
  │
  B4   Gate self-trust: untracked-migration visibility      [repo, small]
  │     └─ rationale: harden the instrument before extending or relying on it
  B3   Extend trusted gate to the active-branch deploy path [repo, small]
  │     └─ rationale: every later closure commit auto-deploys to staging — gate that lane first
  B5   Fix the money-evidence instrument                    [repo, small]
  │     └─ rationale: B6's closure proof is produced by this runner; instrument before evidence
  B6   Close the un-ledgered money path                     [repo, medium]
  │
  B7   Split internal signing secrets (code+matrix+validator)[repo, large]
  │     └─ rationale: must be IN the tree before the push so humans rotate exactly once at go-live
  B2   Fast-forward main == stepup/main                     [repo, ref-move — must be LAST commit-wise:
  │        every prior closure commit reopens the lag; ff only after the final content commit]
  B1a  Human pushes stepup/main → then main; branch protection; delete origin/develop   [HUMAN]
  │
  CERT FOUNDATION_FREEZE_CERTIFICATION activates (all CLOSURE-B* rows present)
  │
  B1b  First gated production deploy + G4 smoke  →  ★ belongs to LAUNCH READINESS, not foundation
```

Direct answers to the posed ordering questions: **B2 before B1 — yes, strictly** (runbook invariant gates the push; pushing with lag publishes stale `main`). **B4 before B3 — yes** (don't wire an untrusted gate into a deploy lane). **B7 before launch — yes, before B1-a even** (the push must carry the per-runtime secret architecture so the one human rotation event at go-live lands on final topology, not on the shared-secret model). B5 before B6 (instrument before evidence). B6 and B7 are independent and could swap; B6 first keeps money risk-burndown earliest.

**Commit discipline:** one closure commit per blocker (B7 may be 2–3 commits: lib+script, workflows+matrix, validator), each with its `CLOSURE-B*` ledger row appended in the same commit or the immediately following ledger-append commit (existing repo pattern), gate green at every commit, tree clean at every stop point.

---

## DEFINITION OF DONE — FOUNDATION ERA CLOSED

All of the following true simultaneously, each with committed evidence:

1. `EXECUTION_LEDGER.md` contains `CLOSURE-B4, CLOSURE-B3, CLOSURE-B5, CLOSURE-B6, CLOSURE-B7, CLOSURE-B2, CLOSURE-B1A` rows, each diff-verifiable.
2. `node scripts/validate-governance.mjs` green at the closure SHA (new baseline count recorded; expected 106 + B4 rework ±0 + B3 extension ±0 + B7 validator +1 ⇒ **~107**).
3. `git status --porcelain` empty; `main == stepup/main == origin/main == origin/stepup/main` at the closure SHA.
4. The mutation/negative-control probes for B4, B5, B7 (and B3 needs-strip) are committed under `FOUNDATION_CLOSURE_2026_06_12/evidence/`.
5. `FOUNDATION_FREEZE_CERTIFICATION.md` countersigned per its activation clause.
6. No new root-level `.md` (root budget stays 9/9 — all program files live in this directory); `PROMPTS.md` registers both execution prompts with exactly one CANONICAL.

Anything less is **FOUNDATION ERA — OPEN**.
