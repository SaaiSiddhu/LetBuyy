<!-- FOUNDATION STEPUP MASTER EXECUTION PROMPT. The single-go, all-in-one Codex order that performs the ENTIRE LetBuyy repository convergence cleanup in ONE local run. This file is a PROMPT authored for a future Codex agent to FOLLOW; authoring it executed nothing — no code, schema, migration, commit, deletion, archive-move, validator-retarget, or git mutation was performed. Read-only git was used only to re-verify the operative facts inlined below. It is a TRANSFORM of CODEX_REPOSITORY_CONVERGENCE_EXECUTION_PROMPT.md (Phase 9 HALT-mode): every mechanical safety guard is KEPT NON-SKIPPABLE; every human-HALT gate is CONVERTED to SKIP-AND-CONTINUE (append to SKIPPED_HUMAN_DECISIONS.md, continue); every capability gap is KEPT as RECORD-DON'T-FABRICATE. Baseline (re-verified this authoring): branch stepup/main @ 5cf9e64e (5cf9e64e7e62482adaf4b65e74d8cbca754a0a15), +30 over main, working tree 512 D / 410 M / 79 ??. -->

# CODEX FOUNDATION STEPUP — MASTER EXECUTION PROMPT (single-go)

> **YOU ARE THE EXECUTING CODEX AGENT, and this is a SINGLE-GO ORDER.** In ONE local run you will perform the ENTIRE LetBuyy monorepo convergence cleanup — collapse the triplicated, duplicated repository down to the one canonical reality the product canon already names — and you will NOT stop and wait for a human at any point. This is the **foundation stepup**: the make-it-fundamentally-strong pass. Everything you need — every rule, every batch, every path, every gate — is in THIS file. The nine prior reports are your evidence base, but the operative rules are inlined here so you never have to guess.
>
> **The operating discipline that makes one-go safe is three gate categories (this distinction is the entire prompt):**
> - **Category A — MECHANICAL SAFETY (NON-SKIPPABLE).** You perform these yourself, in order. "Continue" NEVER means skip these. They are the guardrails that keep a one-go run from being catastrophic.
> - **Category B — HUMAN-APPROVAL SEAMS (SKIP-AND-CONTINUE).** Wherever a step needs a human signature / a privileged remote toggle / a live credential / a live-DB probe, you do the LOCAL/code-completable side, **APPEND a row to `SKIPPED_HUMAN_DECISIONS.md`**, **write an `EXECUTION_LEDGER.md` row marked `SKIPPED-HUMAN`**, and **CONTINUE** with everything else. This is the user's established pattern: do the mechanical work, record the human seam, keep going.
> - **Category C — CAPABILITY GAPS (RECORD-DON'T-FABRICATE).** These are real feature builds, not cleanup. You make them HONEST and VISIBLE (commit their authority migrations so the gap is real; retarget validators so the gap is DETECTED not hidden) and you **NEVER write fake passing money/crypto/feature code, NEVER make a stub read as success/live, NEVER claim them closed.** You append each to `SKIPPED_HUMAN_DECISIONS.md` AND to a new `CAPABILITY_BACKLOG.md`. **Faking any of these reproduces the exact money-theater bug class the audit caught — forbidden.**
>
> **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · **branch:** `stepup/main` · **HEAD:** `5cf9e64e` (`5cf9e64e7e62482adaf4b65e74d8cbca754a0a15`) · **+30 over `main`** (`git rev-list --count main..HEAD = 30`) · **deploy branch:** `main` (the ONLY branch production CI triggers from — `production-deploy.yml` `on: push: branches:[main]`) · **working tree:** dirty (`512 D / 410 M / 79 ??`). Re-verify at start; if any differs materially, do NOT discard anything — record the drift as a `SKIPPED-HUMAN` ledger row and re-derive before mutating (§ Drift).
>
> **Your ethos (non-negotiable):** Never guess. Never fabricate. Never delete without proof. Archive before delete. Never discard the working tree. Respect the Constitution, the Executable Architecture V1, the Strategic Winners, the Single Source of Truth, the Cleanup Governance Constitution, and the Convergence Masterplan — all inlined operationally below. A stub MUST never read as `success`/`live`. A mock MUST never be presented as real. You evidence every claim with a cited `path:line` or exact command, and you write a ledger row for **every** action.

---

## 1. Mission

### 1.1 — What this single run does

You collapse **temporal triplication** and **spatial duplication** into ONE reality, in one continuous local run, by executing a gated sequence — **backup → unhook → commit → archive → delete-with-proof → retarget → collapse → fast-forward-locally** — and recording every human seam as `SKIPPED-HUMAN` instead of stopping for it. Three realities co-own every load-bearing domain today:

- **Plane A = `main`** — the only branch CI deploys; **30 commits behind**; ships the condemned regime (the `/api/auth/switch` account-takeover, the 3% GMV rake default, anon-readable tenant data via `USING(true)` RLS policies, mutable-balance-as-money-truth, un-ledgered capture).
- **Plane B = HEAD `stepup/main`** — `+30`; carries the canonical ledger kernel (migrations 139/160) and most winners as committed code.
- **Plane C = the uncommitted working tree** — adds migrations **162–166** (`162_phase_a_commission_zero`, `163_d2_live_data_leak_rls`, `164_d4_tenant_role_guc`, `165_d5_canonical_money_paths`, `166_d6_checkout_handoff_inventory`), the asymmetric identity issuer, RLS+GUC enforcement, DOMPurify, the Constitution stack, both 2026-06-10 archive trees, the 22 money/identity validators, **and the 512 staged deletions** that remove the rejected distributed/CQRS cluster. **This is the ONLY reality conforming to the Constitution — and it has ZERO version-control protection.** Everything is `??`/`D`/`M`.

**Authority and durability are inversely correlated.** The correct reality is the least durable one — one `git clean -fd` from non-existence. Your job is to make the already-decided winners durable and locally-live, then remove the already-decided losers in dependency order, **without ever destroying the working tree and without ever committing into the armed self-block** — and to do it in one pass, recording the remote/privileged/credential/signature seams as `SKIPPED-HUMAN` and proceeding.

### 1.2 — What you do at a human seam (Category B — the heart of this prompt)

The Phase-9 prompt told you to HALT at every human gate. **You do the opposite, mechanically and safely:** at each human-approval seam you (a) perform the LOCAL, code-completable side (the commit, the archive, the deletes, the validator retargets, the local fast-forward of `main`), (b) **append a row to `SKIPPED_HUMAN_DECISIONS.md`** using its exact existing table schema, (c) **write an `EXECUTION_LEDGER.md` row marked `SKIPPED-HUMAN`**, and (d) **CONTINUE** with the next independent unit of work. You never fake the human side; you make it explicit and keep building. The remote/privileged/credential/signature parts are SKIPPED; the local convergence is DONE.

### 1.3 — What you do NOT do

You are **converging**, not building. You add no features, redesign no architecture, invent no systems. The work is exactly: `git bundle` + tar backup, the survivability-unhook retarget, `git add -A` + commit, `git mv` to archive, delete-with-proof, edit-a-validator-to-retarget-not-to-pass, collapse N→1, fast-forward `main` **locally**, trace-gated proxy-or-port. **The named capability gaps (§7) are OUT OF SCOPE — a delete does not fix any of them; you make them honest and visible, you escalate them in writing, you NEVER build, fake, complete, or claim them closed.**

### 1.4 — The winners are already decided (do not re-litigate)

`STRATEGIC_WINNERS_FINAL.md` re-derived all 14 from canon + code with **0 overturns**. You do NOT re-open "which one wins." The losers are alive only because the winning code is uncommitted/undeployed or a validator structurally mandates the loser. The 14 winners (each is the SOLE owner you converge toward):

| # | Domain | The ONE winner | Loser you remove (gated) |
|---|---|---|---|
| 1 | Theme runtime | **Liquid / portable-theme renderer** | React section-registry renderer — **FROZEN, NOT deletable now** |
| 2 | Identity / sessions | **identity-platform asymmetric (ES256/EdDSA) sole issuer** | gateway `randomHex(32)` mint + shared-`AUTH_SECRET` HS256 family |
| 3 | Money model | **canonical 8-account append-only double-entry ledger** | mutable wallet/commission/payout balances as truth |
| 4 | Tenant isolation | **RLS ENABLE+FORCE+per-tx GUC (`app_tenant`/`withTenantTx`)** | blanket `service_role` + raw-REST `supabaseServiceHeaders` |
| 5 | Governance | **Constitution + AGENTS_V2 + Canonical Systems** | scan-generated `AGENTS.md` regime |
| 6 | Architecture docs | **Executable Architecture / Constitution (monolith + 4 satellites)** | maximalist CQRS/multi-region/Wasm blueprint corpus |
| 7 | Branch reality | **`stepup/main` working tree (plane C)** | `main` as operative state (condemned) |
| 8 | Topology | **one-region modular monolith + 4 satellites, `letbuyy.com`** | multi-region/distributed/CQRS/survivability topology |
| 9 | Commerce backend | **api-gateway monolith (single backend)** | merchant-control-plane 62-route + storefront-runtime 21-route second/third surfaces |
| 10a | Mobile nav | **classic Navigator + composite mobile-bff** | dead `AppDeepLinkRouter` (GoRouter) + `go_router` dep |
| 10b | Mobile tokens | **ui_kit generated DTCG token bridge** | app-local token/color forks |
| 10c | Mobile theme editor | **re-wire section editor (else read-only LivePreview)** | dead `SectionEditorScreen` (~1,200 LOC) |
| 11 | Commission | **0 bps (0% fee, permanent)** | `commission_bps DEFAULT 300` (3% rake) |
| 12 | Payout rail | **PA-split (Razorpay Route / Cashfree, never custody)** | `razorpayx` self-custody enum residue |
| 13 | Storefront capture | **ledgered capture (target; NOT yet wired)** | `confirm_order_payment_with_ledger` (posts 0 ledger lines) |
| 14 | Notifications | **WhatsApp-first router, honest mock-by-default; reserved svc empty** | dead Prometheus/otel config (no SDK in any runtime) |

---

## 2. RULE #0 (NEVER DISCARD THE WORKING TREE) + BACKUP-FIRST

> **RULE #0 — stated first, repeated everywhere. You MUST NEVER run any command that discards, reverts, or cleans the working tree.** Categorically forbidden, at every step, with no exception and no "just this once" — and "continue" never authorizes one of these:
>
> - `git clean -fd` (and `-fdx`, `-fX`, any `clean`) — **permanently destroys** the only canon-conforming reality (Constitution, AGENTS_V2, migrations 162–166, the 22 money/identity validators, both 2026-06-10 archive trees) — all `??`, zero history anywhere.
> - `git checkout -- .` / `git checkout .` / `git restore .` / `git restore --staged --worktree .` — **resurrects the condemned `main` regime** (account-takeover, 3% rake, anon leaks) over the hardened tree.
> - `git reset --hard` (any ref) — discards uncommitted canon.
> - `git stash` then a blind drop, or `git stash pop` on the existing `stash@{0}` (from the deleted `stream/letbuyy-ui-v2` branch) — splices old-regime artifacts onto the new state; inspect-then-decide only, and never before the Phase-0 commit.
> - Any force-checkout of `main` over the working tree, any `git worktree` op that would overwrite plane C.
>
> **Why this is Rule #0 and not Rule N:** the working tree is the ONLY reality where commission is 0% (mig 162), the anon RLS leaks are closed (mig 163), tenant GUC is enforced (mig 164), money paths are canonical (mig 165), checkout/inventory handoff exists (mig 166), and the money+identity validators exist. **None of this is committed.** A clean checkout has NO money gates at all and silently omits 162–166. (Verified this authoring: `git ls-files database/supabase/migrations/16[2-6]_*.sql` returns nothing; the files exist on disk only.)
>
> **In a one-go run the temptation to "reset and retry" is highest exactly when a batch goes red. RULE #0 holds harder then.** When a batch fails, you revert ONLY the files that batch touched via targeted `git restore --source=HEAD -- <those exact paths>` (after Phase-0, so HEAD is the canon) or by re-applying from the backup bundle — NEVER a blanket discard. See § Batch roll-forward rule.

> **BACKUP-FIRST (Category A, mandatory step 1 — before ANY mutation).** Before the survivability-unhook, before `git add -A`, before deleting a single byte, you create and verify a safety backup that lives OUTSIDE the repo working set:
> 1. `git bundle create <BK>/letbuyy-allrefs-<ts>.bundle --all` — a bundle of every ref (so `main`, `stepup/main`, and all history are recoverable).
> 2. A tar snapshot of the **untracked + modified** set: `git status --porcelain` → take the `^??` and `^ M`/`^M ` paths → `tar czf <BK>/letbuyy-worktree-<ts>.tgz -T <listfile>` (this captures migrations 162–166, the Constitution stack, the archive trees, the 22 validators, and every `M` file — the things git history alone does not yet hold).
> 3. Store `<BK>` OUTSIDE the repo (e.g. a sibling dir) or in a gitignored path that no cleanup step touches; **verify** both artifacts (`git bundle verify`, `tar tzf | wc -l` non-zero) and record their paths in the first `EXECUTION_LEDGER.md` row of this run (`BACKUP-000`).
> 4. If the backup cannot be created or verified, **do not proceed to any mutation** — record `BACKUP-000` as `BLOCKED`, append a SKIP row, and stop the mutating work (you may still do read-only discovery). This is the one place a one-go run legitimately cannot continue mutating: with no verified backup, Rule #0's safety net is absent.
>
> The backup is your recovery path; Rule #0 is your prevention. You keep both.

---

## 3. THE THREE GATE CATEGORIES (the core operating model)

Every gate you meet in this run is exactly one of these three. Classify it, then apply its handling rule. When unsure, treat it as the **more conservative** class (B over A only if it is genuinely a human signature/credential; C over B if it is genuinely a feature build) and escalate in writing.

### CATEGORY A — MECHANICAL SAFETY (NON-SKIPPABLE; you perform it, in order)

"Continue" NEVER means skip these. Each is a guard that keeps the one-go run from being destructive. You perform them yourself, in sequence, and you do not proceed past one until it is satisfied:

- **RULE #0** (above) — never discard/revert/clean the tree. State first, repeat.
- **BACKUP-FIRST** (above) — verified `git bundle` + tar snapshot before any mutation.
- **UNHOOK-IN-OR-BEFORE-COMMIT** — committing arms the multi-region self-block (`whole-repo-end-state-validator.mjs:172,174` re-asserts `globalRegions:["india","apac","eu","us"]`; `survivability-governance-validator.mjs:94,106` asserts the same + `globalRegions.length >= 4`; the latter is tracked on `main`, the former is untracked and goes CI-live at commit — both re-verified this authoring at those exact lines). You resolve this by **CONFORMING** the validators/topology/workflows to the Constitution — one region wins, the SUPREME doc already decided (DOC 01 §6/§5.3). You apply the unhook retarget mechanically; you record only the ARB *signature* for that decision as `SKIPPED-HUMAN`. **The unhook edits MUST be staged INTO the Phase-0 commit (or as the immediately-preceding commit). NEVER commit into the armed block.**
- **GIT ADD -A BEFORE THE TRUTH-FREEZE COMMIT** — the commit trap: 512 staged deletions have untracked-only archive copies; a tracked-only `git commit -am` orphans them. `git add -A` is mandatory and first.
- **ARCHIVE-BEFORE-DELETE (L2)** — `git mv` historical-value items to `docs/archive/` and commit before any deletion. **SPECIAL CASE (verified this authoring): the 16 `tasks/executable/*.md` build-task specs (`001-foundation.md` … `016-observability.md`) are staged-deleted (part of the 512) and have NO archive copy anywhere (`find docs/archive -path '*tasks*'` → empty).** Committing the Phase-0 truth-freeze as-is would erase them from existence. You MUST **un-stage their deletion and `git mv` them into `docs/archive/tasks-executable-2026-06-10/` FIRST** (so the commit preserves them), and record a SKIP note that a human should review whether they are pure-delete or carry forward value. This is a mechanical archive (Category A) plus a recorded seam (Category B) — never a silent pure-delete.
- **PROOF-BEFORE-DELETE (L5)** — every deletion requires a fresh cited no-consumer grep/import-graph at `path:line` (negative test assertions of *absence* are not consumers and are the green light). If any live consumer is found, ABORT that item, write a ledger row, and CONTINUE with the others.
- **VALIDATION GATE PER BATCH** — run `node scripts/validate-governance.mjs --lane=gate` (and the batch's specific check) AFTER each batch. If green, roll forward. If it goes red for an UNPLANNED reason, do NOT force it green by gutting the validator — record the failure in the ledger, revert ONLY that batch's files (targeted `git restore --source=HEAD -- <paths>`, NEVER a blanket discard), and CONTINUE with the next independent batch.
- **NEVER FORCE A RED GATE GREEN** by deleting/weakening an assertion (that is theater). The ONLY legitimate validator edits are the named ARB-ratified retargets (the survivability-unhook; the anti-scan-below-root retarget; the perimeter guard; the `canonical-ledger-only` visibility extension).
- **NEVER RE-RUN the retired generator** `scripts/generate-repository-intelligence.mjs` (it exits 1; its retirement is LAW — `repository-intelligence-validator.mjs:41` asserts the tombstone). Do not delete it either (deleting it breaks the assertion).

### CATEGORY B — HUMAN-APPROVAL SEAMS (SKIP-AND-CONTINUE; the user's pattern)

For each seam below: do the LOCAL/code-completable side, **append a row to `SKIPPED_HUMAN_DECISIONS.md`** (id · what's needed · who/role · exact finishing step · seam `path:line` · what's mocked meanwhile · blast radius), write an **`EXECUTION_LEDGER.md` row marked `SKIPPED-HUMAN`**, and **CONTINUE**. Do NOT fake, self-sign, or self-decide any of these. The seams (from `SKIPPED_HUMAN_DECISIONS.md` + the masterplan), each with the SKIP-id you reuse or extend:

- **ARB GATE-1 ratification signature** — `SKIP-GATE1-ARB-RATIFICATION`. (The mechanical promotion of AGENTS_V2 + the Constitution status-line correction are DONE; only the human signature is skipped.)
- **ARB survivability-unhook signature** — the EDIT is performed mechanically per Category A; only the **signature** authorizing the multi-region repeal is skipped. Append a SKIP row (extend the GATE-1 deliverables, or a dedicated `SKIP-SURVIVABILITY-REPEAL-ARB`) recording that the retarget landed and awaits ARB minutes.
- **ARB ops-console survivor signature** — `SKIP-GATE-OPS-SURVIVOR-ARB` (`platform-console` vs `platform-operations-portal`).
- **Remote branch protection / privileged push-to-main / production deploy promotion** — `SKIP-PROD-DEPLOY-PROMOTION`, `SKIP-D1-MERGE-RUNBOOK-DIRTY-TREE`. (The LOCAL fast-forward of `main` is DONE; the privileged remote push + branch-protection toggles are skipped.)
- **Prod provider secrets** (Razorpay/Cashfree/Resend/Turnstile/FCM/APNS/WhatsApp) — `SKIP-PROVIDER-SECRETS`, `SKIP-D3-IDENTITY-LIVE-PROVIDERS`, `SKIP-W7-MOBILE-TURNSTILE-SECRET`, `SKIP-W7-WHATSAPP-LIVE-CREDS`, `SKIP-D10-WHATSAPP-BSP-WABA-HSM`.
- **DNS cutover** to `letbuyy.com` (+ `checkout.`) — `SKIP-PROD-DNS-CUTOVER`, `SKIP-W3-DNS-CUTOVER`, `SKIP-D6-LIVE-CHECKOUT-CUTOVER`.
- **PITR tier + restore drill** — `SKIP-W0-PITR-TIER`.
- **Sentry/telemetry DSN + alert routing** — `SKIP-W3-SENTRY-DSN`.
- **Live secret rotation / mTLS-CF-Access** — `SKIP-W4-LIVE-SECRET-ROTATION`, `SKIP-W4-MTLS-CF-ACCESS`.
- **Live-DB probes** (a human with DB access runs these; you cannot) — `SKIP-D2-LIVE-ANON-GRANT-PROBE`, `SKIP-D4-LIVE-FORCE-COVERAGE-PROBE`, `SKIP-D5-LIVE-MONEY-RECONCILIATION`, `SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE`, `SKIP-D11-PROVIDER-PAYMENT-ID-INDEX-LIVE-DB`. **Every dead-table/column DROP and every "is the policy live-closed" check is THIS class — you escalate it, you do NOT execute the DROP.**
- **Mobile release signing** (keystore / Play / Apple) — `SKIP-D8-MOBILE-RELEASE-SIGNING-SECRETS`.

**The rule of thumb:** the LOCAL commit, archive, deletes, validator retargets, and **local** fast-forward of `main` are all DONE (not skipped); only the **remote / privileged / credential / signature / live-DB-probe** parts are SKIPPED-and-continued.

### CATEGORY C — CAPABILITY GAPS (RECORD-DON'T-FABRICATE; the one hard floor)

These are real feature builds, NOT cleanup. **A delete does not fix any of them. Faking any of them reproduces the exact money-theater bug class the audit caught — the very thing this whole program exists to end.** Your ONLY legitimate contributions are convergence-legitimate:

- **COMMIT their authority migrations** (160/162/163/164/165/166) so the gap is REAL and version-controlled (not silently absent).
- **RETARGET the validators** so the gap is **DETECTED, not hidden** (e.g. extend `canonical-ledger-only-validator` to SEE the SQL capture writer; keep `no-new-react-sections-validator` freezing React; stop the step-up validator allowlisting the mock only once a real path exists).
- **NAME the build** as the BLOCKED prerequisite in **`SKIPPED_HUMAN_DECISIONS.md` AND a new root `CAPABILITY_BACKLOG.md`**, with the precise missing behavior stated.

You **MUST NOT**: write fake passing money/crypto/feature code; make a stub read as `success`/`live`; claim any of these closed; "complete" them to make a gate pass. The gaps (full register in §7):

1. Storefront capture ledgering (`confirm_order_payment_with_ledger` writes 0 ledger lines — `000_baseline.sql:1590`, re-verified).
2. 2/3 refund paths un-ledgered + `merchant_payable` cross-source dedup.
3. Payout provider client (`initiateTransfer` throws `PayoutProviderUnavailable` — `payout-transfer-adapter/index.ts:82`, re-verified; no `PayoutProviderClient` exists).
4. Reconciliation wiring (refreshers have 0 callers; wallet 409s forever).
5. Settlement executor + cross-source dedup.
6. Step-up real crypto (a self-served `mock-step-up-${uuid}` guards refund/payout/DSR-erase — mock theater).
7. OIDC (501 skeleton) + per-realm HS256 re-home + JWT revocation.
8. Liquid chrome (no header/footer) + data binding + full templates + canary write path + editor.
9. Mobile login Turnstile double-spend (same token spent twice → login fails closed).
10. Alerting/observability SDK (no emitters, no error SDK, no delivery channel; the Sentry DSN seam is moot without them).

**Say it plainly to yourself before every money/identity/theme/mobile step: if I am about to write code that makes one of these read as working, I am building governance theater and I must stop and record instead.**

---

## 4. THINGS YOU MUST NEVER DO

A flat, quotable list. Any one is a program-ending error. If a step seems to require one of these, you are misreading the step — record the seam and route around it; never improvise into one of these.

1. **NEVER** `git clean -fd` / `git checkout .` / `git restore .` / `git reset --hard` / blind `git stash` drop or pop — anything that discards or reverts the working tree (Rule #0). **This holds hardest when a batch fails** — revert only that batch's files, never the tree.
2. **NEVER** mutate before the verified BACKUP-FIRST artifacts exist (`git bundle --all` + tar of the `??`/`M` set, both verified). No backup ⇒ no mutation.
3. **NEVER** begin the cleanup with a destructive git op. The FIRST substantive mutation is the backup, then the unhook, then the Phase-0 commit.
4. **NEVER** commit the working tree before the survivability-unhook is applied in/before that same commit. Committing ARMS the multi-region self-block; a commit into the armed block fails CI against itself and certifies a forbidden topology on the deploy branch.
5. **NEVER** `git add -A` omit / commit the 512 staged deletions without `git add -A` first. The archive copies in `docs/archive/*-2026-06-10/` are 100% UNTRACKED; a tracked-only `git commit -am` orphans them (the commit trap).
6. **NEVER** delete a loser while its winner is uncommitted OR not locally-deployed (`main` fast-forwarded locally). Specifically: do NOT delete the React renderer, the merchant-control-plane/storefront-runtime second-backend routes, the mutable money model as truth, or the legacy identity mint paths until the winner is committed AND `main` is fast-forwarded (`[WINNER-DEPLOYED-LOCAL]`). Deleting these early blanks the deployed reality.
7. **NEVER** delete anything without a cited no-consumer proof (fresh `grep`/import-graph at `path:line` or the exact command). If ANY live consumer is found, ABORT that item, log it, and CONTINUE with others.
8. **NEVER** drop a database table/column. Every dead-table/column DROP is a Category-B live-DB-probe seam — append the SKIP row with the probe named and CONTINUE; you do NOT run the DROP.
9. **NEVER** fake, complete, "wire to success," or claim closed any Category-C capability gap (capture ledgering, refund ledgering, payout client, reconciliation wiring, settlement executor, step-up crypto, OIDC/HS256 re-home, Liquid chrome, mobile login double-spend, alerting SDK). You may commit their authority migrations and retarget validators so the gap becomes VISIBLE; you NEVER make a stub read as live.
10. **NEVER** force a red governance gate green by editing a validator to pass (deleting an assertion, weakening a check, removing a validator from the gate array). That is theater. The ONLY legitimate validator edits are the named retargets in §6.
11. **NEVER** re-run or re-enable the retired generator `scripts/generate-repository-intelligence.mjs`, and never delete it (deleting it breaks `repository-intelligence-validator.mjs:41`).
12. **NEVER** leave a prompt-class file (`*MISSION*`/`*PROMPT*`/`*BLUEPRINT*`/`TERMINAL_*`/paste-ready `/goal`) live anywhere outside `docs/archive/**` or the one `PROMPTS.md` `CANONICAL-*` registry entry (the prompt-perimeter, Law L7). **This very file is a `*PROMPT*` — when the run completes, it is itself subject to the perimeter: it must be registered `CANONICAL-EXECUTION` in `PROMPTS.md` or archived with the quarantine sentinel.**
13. **NEVER** recreate or reference the rejected/deprecated topology as active: the 7 rejected packages (`packages/{app-engine, application-services, distributed-runtime, extension-host, orchestration, projection-runtime, runtime-composition}`), the deprecated app aliases (`apps/{admin,auth,checkout,internal,merchant,storefront,analytics}`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`), `extension-host`/Wasm Functions, `event-bus`, or the dead domains `letbuyy.store` / `*.letbuyy.store` / `developers.letbuyy.store`.
14. **NEVER** delete the reserved-service/reserved-mobile manifest stubs or treat their build-out missions as live. Their manifest-only existence is validator-MANDATED (`whole-repo-end-state-validator.mjs:59-78`); deleting them FAILS the gate.
15. **NEVER** present this run's completion as "launch-ready." Convergence-complete ≠ launch-ready. The capability gaps (§7) remain the go-live backlog, recorded in `CAPABILITY_BACKLOG.md`.

---

## 5. THE RUN LEDGER PROTOCOL (this single run must be fully auditable)

A one-go run is only safe if it is fully recorded. You append to three files as you work — never silently. Use the **exact existing schemas** so the new rows are consistent with the established waves.

### 5.1 — `EXECUTION_LEDGER.md` (one row PER action)

Append a row for every action — backup, unhook, commit, each batch, each archive move, each delete cluster, each validator retarget, each verification, and each skipped seam. The existing header and schema (do not change it):

```
| Action ID | What changed | Files | Migrations | Tests added | Validators touched | Status | Commit |
```

- `Action ID` — stable, e.g. `BACKUP-000`, `STEPUP-UNHOOK`, `STEPUP-COMMIT-0`, `STEPUP-B1-JUNK`, `STEPUP-B2-ZERORISK`, `STEPUP-PHASE1-GOV`, `STEPUP-PHASE3-MONEY`, `STEPUP-B6-SURVIVABILITY`, `STEPUP-FF-MAIN-LOCAL`, etc.
- `Status` — `DONE` (mechanical work complete) · `DONE to <seam>` (local side done, a human seam remains) · `SKIPPED-HUMAN` (the seam itself, recorded) · `BLOCKED` (could not complete and not a human seam — rare; record why) · `RECORDED-GAP` (a Category-C gap made visible, not built).
- `Commit` — the commit SHA once Phase-0 lands; before that, `not committed`.
- Follow the existing rows (`PHASE-A-HARD-001` … `D13-END-STATE-VERIFY`) as the template for tone and granularity.

### 5.2 — `SKIPPED_HUMAN_DECISIONS.md` (APPEND one row per human seam)

Append (never rewrite existing rows) using the exact existing table schema:

```
| ID | What is needed | Who provides it (role) | Exact step to finish it | Where the seam is (path:line) | What is mocked in the meantime | Blast radius if never done |
```

- Reuse an existing `SKIP-*` ID if the seam already has one (mark the new run's contribution in `Exact step` / `What is mocked`); add a new `SKIP-*` ID only for a genuinely new seam (e.g. a newly-surfaced dead-table probe).
- "What is mocked in the meantime" MUST be truthful — name the mock/sandbox/fail-closed behavior; never write "live" for something that isn't.

### 5.3 — `CAPABILITY_BACKLOG.md` (NEW root file — one entry per Category-C gap)

Create this file (add it to `allowedRootMarkdown` so the root-budget validator accepts it, same as `PROMPTS.md`). One entry per gap with: the precise missing behavior (named, not designed), the `path:line` where the gap lives, the validator that now makes it VISIBLE, the `SKIP-*` cross-reference, and the blast radius (what cannot happen until it ships). Suggested schema:

```
| Gap ID | Missing behavior (named, not designed) | Where (path:line) | Validator that now detects it | SKIP cross-ref | Blast radius |
```

This file is the explicit go-live backlog. Its existence is part of the run's exit criteria (§8).

> **Discipline:** before you mark any Action `DONE`, confirm the ledger row, and any SKIP/backlog rows it implies, are written. A `DONE` with no ledger row did not happen.

---

## 6. EXECUTION — Phases 0–8 / Batches 0–6 in ONE continuous run

Run these in order, in one pass. Each carries: **entry preconditions** (mechanical, self-satisfied — you do not wait for a human), an **action set**, a **per-batch validation gate**, a **roll-forward / record-and-continue-on-failure rule**, and **which Category-B seams are recorded-and-skipped here**. Batch numbers map to `SAFE_DELETION_PLAN` Batches 0–6; phase numbers map to `LETBUYY_CONVERGENCE_EXECUTION_MASTERPLAN` Phases 0–8; they interleave exactly as the masterplan sequences them.

> **Three reusable preconditions:**
> - **`[COMMIT]`** = Batch 0 done (working tree committed on `stepup/main`, with the unhook in/before it).
> - **`[WINNER-DEPLOYED-LOCAL]`** = winner committed + `main` fast-forwarded **locally** (the remote push is a SKIP seam).
> - **`[SURVIVABILITY-UNHOOK]`** = the conform-to-Constitution retarget that releases the self-block (applied in/with the Phase-0 commit; the ARB signature is a SKIP seam).

> **Universal roll-forward rule (every batch).** Run `node scripts/validate-governance.mjs --lane=gate` (and the batch's specific check) AFTER the batch. **Green → roll forward.** If the gate goes RED for an UNPLANNED reason: write the ledger row with the failure, revert ONLY that batch's files via targeted `git restore --source=HEAD -- <paths>` (NEVER a blanket discard — Rule #0), append a SKIP/`BLOCKED` row explaining the unexpected failure, and **CONTINUE with the next independent batch**. A one-go run does not stop dead on one bad batch; it records, reverts that batch, and presses on. The ONLY legitimate way to turn a planned red green is the named retarget — never silencing.

---

### STEP −1 / BACKUP — SAFETY BUNDLE + WORKTREE SNAPSHOT (Category A, before anything)

**Precondition:** none. **This is the first mutation-adjacent act of the run.**

**Action set:** perform BACKUP-FIRST (§2): `git bundle create --all`; tar the `??`+`M` set; store OUTSIDE the repo set; verify both; write `EXECUTION_LEDGER` row `BACKUP-000` with the artifact paths.

**Gate:** both artifacts verify (`git bundle verify`, `tar tzf | wc -l` > 0).

**Roll-forward:** verified → proceed to the unhook. Unverifiable → `BACKUP-000 = BLOCKED`, append a SKIP row, stop mutating (read-only discovery may continue). This is the single legitimate stop in the run.

---

### STEP 0a / `[SURVIVABILITY-UNHOOK]` retarget — CONFORM TO THE CONSTITUTION (Category A edit + Category B signature)

**Maps to:** the Batch-6 HEAD (the retarget) + SAFE_DELETION `[SURVIVABILITY-UNHOOK]`. **Laws:** L4.

**Why this is first and non-skippable:** committing plane C turns the untracked `whole-repo-end-state-validator.mjs` into a tracked, CI-active gate that re-asserts `globalRegions:["india","apac","eu","us"]` (`:172,174`) and wires `validate:survivability` into 3 workflows, while `survivability-governance-validator.mjs` (tracked on `main`) asserts the same (`:94,106`). The Constitution voids multi-region (DOC 01 §6/§5.3). **So you must conform the validators/topology/workflows to the Constitution IN or BEFORE the Phase-0 commit — never after.** The decision is already made by the SUPREME doc; only the ARB *signature* recording the repeal is a human seam.

**Action set (one atomic change, staged into the Phase-0 commit):**
1. Strip the `globalRegions:["india","apac","eu","us"]` region loop from `whole-repo-end-state-validator.mjs:172-174` (KEEP the keystone validator — remove ONLY its region loop) and from `survivability-governance-validator.mjs:94,106`.
2. **Delete `survivability-governance-validator.mjs` wholesale**, and remove `validate:survivability` + `validate:production-certification` (+ the 6 theater aliases) from `package.json` AND the 3 workflows (`architecture-governance.yml`, `production-rollout.yml`, `live-production-certification.yml`) **in the same change**.
3. Remove `regions.globalRegions` from `config/runtime/production-topology.json`.
4. Retarget the reserved-service manifests' `governanceDocs` off the theater docs (so archiving those docs later does not break the manifest contracts).
5. Re-run `node scripts/validate-governance.mjs --lane=gate` → green-and-honest.

**Category-B seam recorded here:** append/extend the ARB survivability-repeal signature SKIP (under `SKIP-GATE1-ARB-RATIFICATION`'s deliverables or a dedicated `SKIP-SURVIVABILITY-REPEAL-ARB`) — the retarget is DONE; the signature awaits ARB minutes. Ledger: `STEPUP-UNHOOK`, status `DONE to ARB signature`.

**Gate:** `git grep globalRegions scripts/validators/` → **0**; gate green-and-honest (green because honest, not because silenced).

**Roll-forward:** green → proceed to Phase 0. If the gate is green only because a self-block was re-introduced or a check was silenced, that is a FALSE pass — revert this change's files, record `BLOCKED`, and do not commit (you cannot safely commit while the block is armed; this is a true stop until the retarget is honest).

---

### BATCH 0 / PHASE 0 — REPOSITORY TRUTH FREEZE (the commit; NOT a delete)

**Maps to:** SAFE_DELETION Batch 0. **Laws:** L1, L2, L4, L8.

**Precondition:** BACKUP-000 verified; the `[SURVIVABILITY-UNHOOK]` retarget staged (Step 0a). RULE #0 in force.

**Action set (one privileged-but-local act):**
1. **Apply the `tasks/executable/*.md` archive rescue FIRST (Category A special case):** un-stage the 16 deletions and `git mv` the files into `docs/archive/tasks-executable-2026-06-10/` so the commit preserves them; append SKIP note (`SKIP-TASKS-EXECUTABLE-DISPOSITION`) for human review of pure-delete-vs-carry. (Verified: no archive copy exists today.)
2. **`git add -A`** first (MANDATORY — stages the 512 tracked deletions AND their untracked archive copies AND the untracked canon atomically; a tracked-only commit triggers the commit trap, Never-Do #5).
3. **`git commit`** on `stepup/main`, with the unhook retarget already staged, capturing the untracked canon:
   - Constitutional layer: `GOVERNANCE_REWRITE_2026_06_10/` (Constitution + 6 siblings), `STRATEGIC_CANONICALIZATION_2026_06_10/`, `REPOSITORY_TRUTH_AUDIT_2026_06_10/`, `CONVERGENCE_AUDIT_2026_06_10/`, `CONVERGENCE_CLEANUP_2026_06_10/`, root `AGENTS.md` (AGENTS_V2, tracked-M), `CLAUDE.md`.
   - Migrations `162`–`166` + their 5 rollbacks (the **highest-priority preserve** — a clean clone today has none).
   - The 22 untracked money/identity validators + `scripts/validate-governance.mjs`.
   - `EXECUTION_LEDGER.md` + `SKIPPED_HUMAN_DECISIONS.md` + the new `CAPABILITY_BACKLOG.md` (validator-required verbatim where applicable); the untracked `.github` mobile-release workflow; `scripts/dev/dev-up.sh` / `dev-backend.sh` / `identity-security-gate.mjs`.
   - Both 2026-06-10 archive trees under `docs/archive/**` (the only copies of FORENSIC_MASTER / GOVERNANCE_HARDENING / FOUNDATION_AUTOPSY etc.) + the validator-pinned `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md` + the rescued `docs/archive/tasks-executable-2026-06-10/`.
   - This finalizes (makes durable via history) the 512 staged deletions: the 8 rejected package roots/154 files, 77 worktree-deleted theater validators, 69 worktree-deleted theater tests, 6 helm/k8s files, `packages/dart/services`, `packages/typescript/ui/src/mobile-tokens.ts`, the app-local mobile token forks.
4. Correct the Constitution status line from self-declared to ARB-pending (do NOT write "ARB-signed" — that is the seam).

**Category-B seams recorded here:** `SKIP-GATE1-ARB-RATIFICATION` (the human signature; the mechanical promotion + status-line correction are DONE) and `SKIP-TASKS-EXECUTABLE-DISPOSITION`. Ledger: `STEPUP-COMMIT-0`, status `DONE to ARB ratification`.

**Validation gate:**
- `git status --porcelain` shows a clean tree (the `??` count drops to genuinely-ignored machine residue only).
- A **clean clone** contains migrations 162–166 and all 22 money/identity validators, and `docs/archive/tasks-executable-2026-06-10/` is present.
- `node scripts/validate-governance.mjs --lane=gate` PASS **from tracked files only** — AND green-and-honest: `git grep globalRegions scripts/validators/` → 0.
- `git ls-files database/supabase/migrations/16{2,3,4,5,6}_*.sql` returns all five (now tracked).

**Roll-forward:** Green → proceed. If the clean-clone is missing migrations/validators/tasks-archive, the commit was tracked-only (commit trap) or the rescue was skipped — restore from the backup bundle, re-do with `git add -A` and the rescue, do NOT blanket-discard.

---

### BATCH 1 — PURE JUNK / CACHES / EMPTIES (zero risk, no precondition)

**Maps to:** SAFE_DELETION Batch 1. **Laws:** none gated.

**Precondition:** none (none is tracked canon). **Still: never as a `git clean` — delete each path explicitly.**

**Action set (~20 paths, ~2 GB):** `.DS_Store` ×11 (root, `database/`, `config/`, `tests/`, `docs/`, `docs/research/`, `docs/auth/`, `docs/themes/`, `load/`, `infrastructure/`, `.git/`) · `.codex-dev.log` (0 bytes) · `.codex/` (empty) · `.tmp/` + `packages/.tmp/` (empty) · `build/` (161 MB Flutter cache) · `.dart_tool/` · `test-results/` · `.pnpm-store/` · `.turbo/` (1.8 GB). Confirm empty/0-byte/gitignored before removing.

**Validation gate:** `git status` shows NO tracked-file changes; `pnpm install && pnpm run build` regenerates caches cleanly.

**Roll-forward:** if any "empty" dir contains a tracked file, ABORT that path, reclassify, CONTINUE.

---

### BATCH 2 / PHASE 1 (part) — POST-COMMIT ZERO-RISK DELETES (generated-stale + orphan validators + empties + dangling refs)

**Maps to:** SAFE_DELETION Batch 2. **Laws:** L5, L2.

**Precondition:** `[COMMIT]` done and green.

**Action set (~95 files + ~10 line/entry edits):**
- **80 generated-intelligence docs** (`docs/README.md` + ~78 `docs/<topic>/README.md` + `docs/architecture/{master-system-intelligence,README}.md`). Proof: each is stamped `<!-- GENERATED BY scripts/generate-repository-intelligence.mjs ON 2026-06-08 -->`; the generator is hard-retired → unregenerable falsehoods. `master-system-intelligence.md` (192,565 lines) — snapshot already archived; DELETE the live copy.
- `docs/conflicts/` + `docs/future-roadmap/` (generated-README-only) + `docs/mobile-migration-blueprint/` (empty).
- **11 orphan validators** (`contracted-domain-event-ingress-`, `custom-domain-abuse-screening-`, `custom-domain-reconciler-`, `gateway-events-client-`, `mobile-domain-parity-`, `no-orphan-webhook-delivery-queue-`, `observability-producer-`, `registrar-provider-`, `replayable-secret-persistence-`, `shopper-identity-seam-`, `vercel-domain-automation-validator.mjs`). Proof: 0 external refs each — re-grep per item; if any is in the gate array, ABORT it.
- `legacy/` (empty) + `tests/projections/` (empty).
- `tsconfig.workspace.json:68` dangling `packages/typescript/utils` ref + `pubspec.yaml` `run:super_admin` melos script.
- `config/runtime/replay-safety-contract.json` (+`.schema.json`) **AND** the `config/runtime/identity-residency.schema.json` / `config/runtime/identity/residency.json` **PAIR** — **CUT BOTH TOGETHER** (the schema's only consumer is `residency.json`; deleting only the schema breaks it).
- `apps/storefront-runtime/src/app/demo/urban-kicks/` + `src/lib/demo/urban-kicks-demo.ts` + the `firebasestorage.googleapis.com` remotePattern in `next.config.ts`. Confirm the preview/store-service refs are demo-only before cutting.
- `config/vercel/projects.json` lines 79/94/109/124 (the 4 frozen-app rows) + frozen-app rows in BOTH staging workflows (`deploy-staging.yml:99-102`, `staging-deploy.yml:189-198`).
- `git stash@{0}` — **inspect-then-drop ONLY; never `git stash pop` blind** (Rule #0).

**Proof:** every DELETE carries a cited no-consumer proof re-grepped this run. Any live consumer → ABORT that item, reclassify `KEEP (conditional)`, CONTINUE.

**Validation gate:** gate PASS (esp. `repository-intelligence-validator`, `marketing-dead-twin`, `theme-editor-dead-shell`, topology validators); `tsc -b` no longer errors on the removed utils ref; `pnpm --filter storefront-runtime build` PASS.

**Roll-forward:** Green → proceed. Red (unplanned) → record, revert this batch's files, CONTINUE.

---

### BATCH 3 / PHASES 1–5 (part) — FINALIZE WORKTREE DELETIONS + MOBILE/UI-KIT DEAD-WEIGHT + PROMPT HARD-CUTS

**Maps to:** SAFE_DELETION Batch 3. **Laws:** L5, L7.

**Precondition:** `[COMMIT]` done and green.

**Action set (~160 worktree-deletions finalized + ~12 fresh deletes + prompt cuts):**
- The 8 rejected package roots (already worktree-deleted; finalized by the Batch-0 commit) + `packages/dart/services` + `packages/typescript/ui/src/mobile-tokens.ts`. Proof: 0 live imports (the only `@letbuyy/{runtime-composition,…}` matches are NEGATIVE absence-assertions in `tests/federation/*` and `tests/governance/phase-b-validators.test.mjs`). **`packages/search-core` is an ARB-confirm seam** (present at HEAD, distributed by nature, NOT in the 7-entry `rejectedPackageRoots`) — append `SKIP-SEARCH-CORE-DISPOSITION`, do NOT assume; keep it until confirmed.
- 77 worktree-deleted theater validators + 69 worktree-deleted theater test files + 6 helm/k8s files (all already `^D`, now durable).
- ui_kit dup pairs (one of `empty_state.dart`/`empty_state_widget.dart`; one of `error_widget.dart`/`error_view.dart`) — pick the un-exported/unused twin via a kit-surface check.
- **Mobile true-dead-weight set** WITH same-change test edits: `lib/app/deep_link_router.dart` (`AppDeepLinkRouter`, zero callers) + the `go_router ^17.0.0` dep; `widgets/home/` duplicate twins; `widgets/shared/empty_state.dart`; `platform_blocked_screen.dart` + `lib/services/platform_blocked_service.dart`; `upgrade_screen.dart`; `splash_screen.dart`. **Deleting `deep_link_router.dart` + `go_router` REQUIRES editing the source-string tests that "protect" it in the SAME change** (L5).
- **Prompt hard-cuts (the 9 DELETE hazards, L7):** `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` (the factory) + `CODEX_MASTER_SEQUENTIAL_MISSION.md` + `CODEX_EXTENSION_PLATFORM_MISSION.md` + `CODEX_LAUNCH_PLAYBOOK.md` + the `TERMINAL_1..6_*` relaunch kit (6 files). Proof: no live consumer; content preserved as cautionary quotes in `PROMPT_DRIFT_ELIMINATION_PLAN.md` §3–§7. Record each as `DELETED-2026-06-10` in `PROMPTS.md`.

**Proof:** every package/validator/test/screen/prompt DELETE carries its cited proof. Mobile deletes carry the same-change test edit. ABORT any item whose proof fails; CONTINUE.

**Validation gate:** gate PASS (esp. `package-ownership`, `import-validator`, `no-rejected-package-imports`, `dart-dead-source`); `flutter analyze` PASS for merchant-app; `tests/federation/*` PASS; `go_router` no longer in `pubspec.yaml`.

**Roll-forward:** Green → proceed. Red (unplanned) → record, revert this batch's files, CONTINUE.

---

### PHASE 1 (the head) — GOVERNANCE & DRIFT-LOCK CONVERGENCE

**Maps to:** SAFE_DELETION Batch 2/4 + the Batch-6 HEAD. **Laws:** L4, L6, L7, L8.

> The `[SURVIVABILITY-UNHOOK]` retarget already landed in Step 0a / the Phase-0 commit. The *config/doc/test DELETES it unblocks* are Batch 6 / Phase 6 (after the local fast-forward). Here you do the governance collapse and the drift-lock.

**Precondition:** `[COMMIT]` done.

**Action set:**
- **ARB GATE-1 ratification recorded as SKIPPED:** `SKIP-GATE1-ARB-RATIFICATION` row appended; Constitution status line = ARB-pending (the mechanical promotion is DONE; the signature is the seam).
- **Retarget the anti-scan validator below root** so it polices the 61 active nested `AGENTS.md` (today `no-scan-generated-agents-validator.mjs` reads only root — verified 61 active nested). **Then** the nested + scan-gen root copies become REWRITE-or-DELETE — NEVER before the retarget (else dangling authority refs). Exactly ONE root `AGENTS.md` (= AGENTS_V2) remains.
- **Install the drift-lock:** create root `PROMPTS.md` (one `CANONICAL-EXECUTION` entry — promote `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md`; add `PROMPTS.md` to `allowedRootMarkdown`) + wire the `docs/`-wide prompt-perimeter guard into `validate:governance` (fails on any `*MISSION*/*PROMPT*/*BLUEPRINT*/TERMINAL_*` outside `docs/archive/`; requires the quarantine sentinel; reuses the `rejectedPackageRoots`/`reservedServiceRoots`/`extension-host`/`Wasm`/`event-bus`/`*.letbuyy.store` token lists). **Register THIS file** (`CODEX_FOUNDATION_STEPUP_MASTER_EXECUTION_PROMPT.md`) in `PROMPTS.md` (as `CANONICAL-EXECUTION` alongside or superseding the master-implementation prompt, or as `ARCHIVED-QUARANTINED` if the run is its last use) so the perimeter guard does not red on it.
- **Generated-stale tree REWRITE/DELETE:** 65 `docs/<domain>/README.md` → REWRITE-to-stub (or DELETE scan-noise); 12 app + 18 package `AGENTS.md` → REWRITE (DELETE the 5 frozen/reserved-root app AGENTS: app-marketplace, developer-portal, theme-marketplace, mobile/operator-app, mobile/shopper-app); the 2 `letbuyy.store`-asserting READMEs → `letbuyy.com`. **Never re-run the generator** (Never-Do #11).
- **Live self-contradiction fixes:** amend `AGENTS.md` AGENT-R16 to point at living equivalents BEFORE archiving the 2026-03-01 fossils; resolve `LEG-078` (sentences `memory/lessons.md` to DELETE while AGENT-R16 mandates reading it) — if it genuinely conflicts and cannot be resolved mechanically, record `SKIP-LEG-078-CONFLICT` and CONTINUE; rewrite `MERGE_RUNBOOK.md` so `SKIP-D1` sends the maintainer to the real `stepup/main → main` promotion.

**Category-B seams recorded here:** `SKIP-GATE1-ARB-RATIFICATION`; `SKIP-SURVIVABILITY-REPEAL-ARB` (if not already under GATE-1); `SKIP-LEG-078-CONFLICT` (only if unresolvable mechanically).

**Validation gate (green-and-honest):**
- `validate-governance.mjs` green AND `production-topology.json` has no `globalRegions` block AND `git grep globalRegions scripts/validators/` → **0**.
- The anti-scan validator **fails on a planted nested `AGENTS.md`**; exactly ONE root `AGENTS.md`.
- The perimeter guard **fails on a planted `*MISSION*` outside `docs/archive/`**; every archived prompt carries the `ARCHIVED — REJECTED ARCHITECTURE — DO NOT EXECUTE` sentinel; THIS prompt is registered or archived (no live unregistered `*PROMPT*`).
- `git grep -l "GENERATED BY scripts/generate-repository-intelligence"` → **0 tracked** live files; `repository-intelligence-validator` PASS.
- `SKIPPED_HUMAN_DECISIONS.md` shows `SKIP-GATE1-ARB-RATIFICATION` recorded (not signed — that's the human's job).

**Roll-forward:** Green-and-honest → proceed. Green only because a self-block returned or a check was silenced → FALSE pass; revert, record, CONTINUE the unaffected work.

---

### BATCH 4 / PHASE 1 (part) — ARCHIVE MOVES (historical value → `docs/archive/`)

**Maps to:** SAFE_DELETION Batch 4. **Laws:** L2, L8.

**Precondition:** `[COMMIT]`; for `docs/agents/`, `tasks/todo.md`, `memory/lessons.md` the precedence/AGENT-R16 wiring was amended in the Phase-1 head.

**Action set (~200 files MOVED via `git mv`):** `docs/Codex_waves/` remainder → `docs/archive/codex-waves-2026-06-10/` (the ~41 ARCHIVE-quarantine set) · `docs/audit/` (19) · `docs/audits/apps-platform/` (23) · `docs/agents/` (40, after precedence check) · `docs/commerce-os-audit/` (10) + `docs/analysis/` (4) · the docs-root prompt/plan family + ~25 superseded master audits + `docs/LETBUYY.md` · the frozen-app mission families · the 4 root business binaries (2 `.pptx` + 2 `.xlsx`) → `docs/archive/root-governance-2026-06-10/` · `tasks/todo.md` + `memory/lessons.md` (after amend). **`apps/developer-portal` + `apps/platform-operations-portal` ARCHIVE is gated on the ops-survivor decision — record `SKIP-GATE-OPS-SURVIVOR-ARB` and DEFER those two app-dir moves to Phase 6 (do the doc/mission archives now).**

**Proof:** prepend the verbatim quarantine header (or a cluster `README.md` the guard recognizes) to every archived prompt/mission. Confirm no LIVE import resolves into a moved path before moving.

**Validation gate:** gate PASS (esp. `route-line-count`/`allowedRootMarkdown` budget, `no-scan-generated-agents`, the new perimeter guard); no live import resolves into a moved path.

**Roll-forward:** Green → proceed. A move that breaks an import → ABORT that move, reclassify KEEP, CONTINUE.

---

### PHASES 2–5 — IDENTITY / MONEY / THEME / MOBILE convergence (duplicate-writer collapse; capability gaps RECORDED not built)

**Maps to:** SAFE_DELETION Batch 3 (post-commit, gated) + Batch 5 (the `[WINNER-DEPLOYED-LOCAL]`-gated loser deletes). **Laws:** L3, L5, L6, L8. **Each phase collapses the duplicate writer/surface convergence CAN reach, retargets the validator so the gap becomes VISIBLE, and STOPS at a named Category-C gap — recording it, never crossing it.**

**Precondition:** `[COMMIT]` done; each loser-delete additionally gated as stated.

**PHASE 2 — Identity** (winner = identity-platform asymmetric sole issuer):
- Retarget the gateway to verify-only against env-injected JWKS (`identity-session-verifier.ts`, committed); consolidate the ≥4 cookie-realm authorities + 2 CSRF cookie names to one canonical name (L6).
- **DELETE_AFTER_MIGRATION (gated on the `IDN-R2` dual-verify drain showing zero legacy-HS256 verifications):** gateway `randomHex(32)` mint (`auth.ts:1140`) + the `/api/auth/switch` mint branch. The drain telemetry is a live-signal seam — if it cannot be observed locally, record `SKIP-IDN-R2-DRAIN-TELEMETRY` and DEFER the mint-path delete (do NOT delete on suspicion). The dev-only `localAuthSessions` Map is SAFE_DELETE (dead in prod).
- **DELETE_AFTER_MIGRATION (gated on identity-platform serving verify-only live, `IDN-R3`):** the 18-file `services/api-gateway/src/identity-foundation/` shadow stack — defer-with-SKIP if the live-serving signal is absent.
- **Category-C RECORDED (do not build):** live identity keypairs/JWKS (`SKIP-D3`); step-up real crypto (a self-served `mock-step-up-${uuid}` guards refund/payout/DSR-erase — you may stop the validator allowlisting the mock once a real path exists; you may NOT build TOTP/passkey/re-auth); OIDC (501 skeleton); per-realm HS256 re-home; JWT revocation → all into `CAPABILITY_BACKLOG.md`.
- **Gate:** after any landed delete: `git grep "randomHex(32)"` in the session-mint path → 0, `/api/auth/switch` has no mint branch, `identity-foundation/` gone, `identity-sole-issuer-validator` PASS with the allowlist drained. (If deferred, the gate asserts the seam is recorded, not that the delete happened.)

**PHASE 3 — Money** (winner = canonical append-only ledger):
- Make the committed authority operative (migs 160/162/165 landed at Phase 0): retarget `wallet.ts` reads to derive from the canonical ledger; **demote** `wallet_ledger_entries`/`payout_statements`/`commission_*` (mig 119) + the mini-ledgers to **read-only projections** (L6 — NOT deleted; they back the wallet read until zero-drift). The Phase-0 commit removed the `razorpayx` self-custody DEFAULTS.
- **Retarget `canonical-ledger-only-validator`** to see SQL-side writers and add `orders`/capture to its ratchet list — so the capture gap stops being invisible to the gate. **This VISIBILITY is the convergence success on capture — closure is Category C, do not wire it.**
- **DELETE_AFTER_MIGRATION (demote-then-delete, L3+L5):** mutable `wallet_ledger_entries`/`payout_statements`/`commission_*` *as truth source* — gated on 160/162/165 committed + reconciliation refreshers wired to a scheduler (Category C — not done here) + zero-drift proof (live-DB seam) + backfill + a **live writer probe**. Because the live writer probe and the reconciliation wiring are not available in this run, **DEFER these deletes with SKIP rows** (`SKIP-D5-LIVE-MONEY-RECONCILIATION`, `SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE`); the demote-to-projection stands. The `razorpayx` enum/CHECK residue purge needs a migration — author it only as an enum-purge migration AFTER the commit if mechanical; else record `SKIP-RAZORPAYX-ENUM-PURGE`.
- **Category-C RECORDED (do not build):** storefront/webhook capture ledgering (`confirm_order_payment_with_ledger` posts 0 ledger lines on the every-shopper path — **the #1 unfinished winner**); payout provider client (`initiateTransfer` throws; no `PayoutProviderClient`); reconciliation wiring (refreshers 0 callers; wallet 409s forever); 2/3 refund-path ledgering + `merchant_payable` dedup; settlement executor → all into `CAPABILITY_BACKLOG.md`. **The mig-162 in-place commission-history rewrite is an ARB call — record `SKIP-MIG162-INPLACE-REWRITE`.**
- **Gate:** a clean clone applies 160/162/165; `commission-bps-zero-validator` PASS; the canonical ledger has UPDATE/DELETE revoked from `service_role`; `canonical-ledger-only-validator` now *reports* the storefront capture writer (gap VISIBLE, not silently passing); committed default commission is 0 bps (no `?? 300`; DB default not 300).

**PHASE 4 — Theme** (winner = Liquid, React FROZEN-not-deleted):
- Collapse the schema/compose forks: retarget the ~10 runtime-only schemas from storefront `RUNTIME_SECTION_SCHEMAS` (`renderer-registry.tsx`) into the engine `SECTION_SCHEMAS`; retarget the Liquid render plan/canary out of `template-resolver.ts` into the engine `composeStorefrontTheme`. Make the committed DOMPurify + LiquidJS auto-escape the deployable sanitizer (replaces the 3-regex path). De-duplicate the split `FEATURE_LIQUID` switch to one authority.
- **NOT deletable now (Batch 5-gated):** the React renderer + 20 frozen sections + `marquee.tsx`. `no-new-react-sections-validator` KEEPS freezing React — **deleting React now blanks every storefront (S0-grade self-harm)** (L3).
- **Category-C RECORDED (do not build):** Liquid chrome (no header/footer) + data binding + full templates + canary write path + editor (the React-deletion prerequisite; the platform-wide flip is ARB-deferred); the 5-of-24 fallback-box section types → `CAPABILITY_BACKLOG.md`.
- **Gate:** engine is the single schema + compose source (`git grep "RUNTIME_SECTION_SCHEMAS"` → 0 after migration); deployable sanitizer is DOMPurify; `no-new-react-sections-validator` still freezes React (proving L3 honored); one `FEATURE_LIQUID` authority.

**PHASE 5 — Mobile** (winner = Navigator + composite mobile-bff + ui_kit tokens):
- SAFE_DELETE items already done in Batch 3 (GoRouter, home twins, token forks, with same-change test edits). Retarget the analytics screen onto the composite BFF `/v1/mobile/dashboard` once the BFF field set covers it, then collapse the 5-call gateway fan-out (L6). Retarget the 5 forked dart models to `packages/dart/models`; delete the app-local shims.
- **DELETE_AFTER_MIGRATION:** the mobile theme-editor pair (`customize/theme_screen.dart` 631L + `editor/section_editor_screen.dart` 1,200L + 12 `widgets/editor/*`) — gated on an **ARB wire-or-delete decision** (record `SKIP-MOBILE-EDITOR-ARB`) + rewriting the 42 protecting source-string tests; DEFER until the ARB pick. The 34 dead capability screens + 36 `/features/*` routes — gated on a per-screen wire-vs-delete PRODUCT decision (record `SKIP-MOBILE-DEAD-SCREENS-PRODUCT`); DEFER.
- **Category-C RECORDED (do not build):** mobile login Turnstile double-spend (the app pre-verifies the single-use token at the BFF, then submits the SAME token to identity login → `timeout-or-duplicate` → login fails closed; a bug fix, not a convergence delete — `SKIP-W7`); the store-publish pipeline → `CAPABILITY_BACKLOG.md`.
- **Gate:** `flutter analyze` + `flutter test` green; one navigation system (Navigator); the editor ARB decision recorded (executed only if the pick is in hand — else DEFERRED with SKIP); the 5 model forks resolve to `packages/dart/models`.

**Proof (all four phases):** every loser-delete carries its cited no-consumer proof AND its gating condition. Mobile/identity deletes carry same-change test edits. ANY dead-table DROP → Category-B SKIP (Never-Do #8), never executed.

**Roll-forward:** each phase's gate must pass; capability gaps are RECORDED in `CAPABILITY_BACKLOG.md` and SKIP-cross-referenced, never crossed. Deletes whose gating signal is absent in this run are DEFERRED-with-SKIP, not forced.

---

### BATCH 5 / PHASE 6 — DEPLOYMENT CONVERGENCE (local fast-forward + trace-gated second-backend retirement)

**Maps to:** SAFE_DELETION Batch 5. **Laws:** L3, L6.

**Precondition:** `[COMMIT]` + the unhook executed (Step 0a) + `SKIP-GATE1` recorded; for the second-backend deletes ALSO the per-page call-graph trace + `[WINNER-DEPLOYED-LOCAL]`.

**Action set:**
- **Fast-forward `main` LOCALLY** to the committed `stepup/main`. **This is the local act that makes the hardened truth the local `main`.** Forbidden to fast-forward before the unhook + the Phase-0 commit (deploying a gate that certifies the rejected topology — Never-Do #4 at deploy scope). **The privileged REMOTE push to `origin/main` + branch-protection toggles are a Category-B seam — record `SKIP-PROD-DEPLOY-PROMOTION` + `SKIP-D1-MERGE-RUNBOOK-DIRTY-TREE` and CONTINUE.** Verify locally `git rev-list --count main..stepup/main` → 0.
- Collapse the matrices: cut the frozen-app rows from BOTH staging workflows + `config/vercel/projects.json` (if not already in Batch 2); align the production matrix to the lean 6-Vercel-app + 4-worker topology.
- **TRACE-gated second-backend retirement (L6):** the per-page call-graph trace (which UI page calls which of the 62 MCP / 21 storefront routes vs the gateway) is the hard gate. If the trace can be derived from the code statically this run, do proxy-or-port + contract tests, then delete the merchant-control-plane **62** `/api/**/route.ts` + storefront-runtime **21** routes (**`gift-cards` PORTED, not proxied** — single-writer in the wrong runtime). **If the trace cannot be completed safely from static analysis, record `SKIP-SECONDBACKEND-CALLGRAPH-TRACE` and DEFER the route deletes** (they stay `KEEP (conditional)`); do the proxy wiring you can prove, leave the rest recorded. The gateway `portfolio.ts`/`resume.ts` + mounts (`index.ts:738-739`) + BFF allowlist (`index.ts:44-45`) — DELETE_AFTER_MIGRATION gated on the `SKIP-D11` live writer probe + ARB "non-store site types are dead" decision → record and DEFER.
- **ARCHIVE (after decision):** `apps/developer-portal` (ARB consolidation) + `apps/platform-operations-portal` (port unique modules to `platform-console` first — `SKIP-GATE-OPS-SURVIVOR-ARB`). Since both depend on the ops-survivor signature, **record the SKIP and DEFER the app-dir archive** unless the unique-module port is mechanically clean. Frozen-app SOURCE (`app-marketplace`/`theme-marketplace`) stays KEEP — only the deploy rows are cut.

**Category-B seams recorded here:** `SKIP-PROD-DEPLOY-PROMOTION`, `SKIP-D1-MERGE-RUNBOOK-DIRTY-TREE`, `SKIP-SECONDBACKEND-CALLGRAPH-TRACE` (if needed), `SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE`, `SKIP-GATE-OPS-SURVIVOR-ARB`.

**Validation gate:** `git rev-list --count main..stepup/main` → **0** (local branch lag closed); no frozen-app in any staging workflow or `projects.json`; after any trace + cutover, no UI page calls a deleted MCP/storefront route (contract tests green); `one-system-per-domain-validator` PASS for the surfaces actually retired.

**Roll-forward:** Green → proceed. If a route turns out to be called by a live page, ABORT its deletion (the trace was wrong), record, CONTINUE.

---

### BATCH 6 / PHASE 6 — SURVIVABILITY / MULTI-REGION / CHAOS / LOAD / CERTIFICATION (execute the deletes the retarget unblocked)

**Maps to:** SAFE_DELETION Batch 6 — the highest-risk batch. **Laws:** L4.

**Precondition:** `[SURVIVABILITY-UNHOOK]` retarget fully executed (Step 0a; gate no longer mandates `globalRegions`) + `main` fast-forwarded locally. **Do NOT delete any of these BEFORE the retarget made them safe — deleting them while the validators still assert them FAILS the gate (the self-block).**

**Action set (~60 artifacts, as one change set):**
- `config/runtime/{multi-region-runtime,survivability-execution,observability-platform}.json` (+schemas) — **split `observability-platform.json`'s real prometheus rules into a non-theater validator FIRST**, then delete; the `production-topology.globalRegions` block (already stripped at Step 0a); the ~15 1–2-consumer distributed `config/runtime/*` contracts (`convergence-invariants`, `distributed-consistency-contract`, `durable-execution-contract`, `failure-domain-manifest`, `runtime-causality-graph`, `replay-branch-registry`, `projection-recovery-manifest`, …) — **each ONLY after its single consuming validator retires** (rides the unhook).
- `chaos/` + `load/` (existence was validator-mandated by `survivability-governance-validator.mjs:20-23,152-153`, now deleted) + `infrastructure/scripts/{operations,load,chaos}/` certification suite.
- The 10 `validate:production-certification` validators + `operational-proof-validator.mjs` + `production-certification-common.mjs` + the 6 theater aliases + the `validate:rollback` alias (only after a real rollback validator exists, else KEEP).
- The 13 contradicting + 4 validator-required `docs/governance/*` theater docs + 6 theater runbooks. **ARCHIVE these (L2) — `git mv` to `docs/archive/governance-theater-2026-06-10/`, do not hard-delete** (the untracked archive copies of 37 already exist — confirm and commit). Retarget any reserved-service manifest `governanceDocs` off them FIRST (done in Step 0a / Phase 1).
- `tests/{chaos,survivability,replay,queues,operations,production-certification,cloudflare}`.

**Proof:** every config/contract delete is gated on its consuming validator being retired first. Every governance/runbook with historical value is `git mv`'d, not deleted (L2). The split of real prometheus rules precedes the config delete.

**Validation gate:** gate PASS **after** the validator-strip; no reserved-service manifest `governanceDocs` references a moved doc; `git grep globalRegions scripts/validators/` → nothing; `git grep -l "globalRegions\|failoverPairs\|multi-region" config/` → 0.

**Roll-forward:** Green → proceed. A delete that fails the gate means a validator still asserts that artifact — the retarget was incomplete; revert that delete, complete the retarget (the only legitimate validator edit), or record `BLOCKED` and CONTINUE; do NOT silence the assertion.

---

### PHASE 7 — PRODUCTION READINESS (record all human seams; NAME the alerting gap; never DROP)

**Maps to:** the live-DB-gated `SKIP-D11` deletes — **all recorded-and-skipped, none executed**. **Laws:** L5, L8.

**Precondition:** Phases 0–6 complete and green.

**Action set (seam recording + naming — NO features, NO DROPs):**
- **Record (don't fake) the launch-blocking `SKIP-*` subset:** `SKIP-D1` (the remote merge), `SKIP-D3` (identity live keys/JWKS/OIDC/Turnstile), `SKIP-PROVIDER-SECRETS` (the prod wrangler placeholders), `SKIP-PROD-DNS-CUTOVER`/`SKIP-W3-DNS-CUTOVER` (`.com` resolution), `SKIP-D6` (checkout cutover), `SKIP-PROD-DEPLOY-PROMOTION` (branch protection), `SKIP-D2`/`SKIP-D4` (live RLS/grant/FORCE probes), `SKIP-D5` (live money reconciliation), `SKIP-W0-PITR`, `SKIP-W3-SENTRY-DSN`, `SKIP-W4-LIVE-SECRET-ROTATION`, `SKIP-D8-MOBILE-RELEASE-SIGNING-SECRETS`, `SKIP-D10`/`SKIP-W7` (WhatsApp/Turnstile). Each gets an appended/updated `SKIPPED_HUMAN_DECISIONS.md` row with truthful "what's mocked" and blast radius, and a `SKIPPED-HUMAN` ledger row.
- **Live-DB-gated deletes (L5; Category-B — record, do NOT DROP):** dead product-era tables (`portfolio_projects`/`resume_versions`/`gallery_items`/`skill_endorsements`) + the `sites.site_type` enum shrink; the duplicate `provider_payment_id` index (107-vs-142); the 25 residual PUBLIC `USING(true)` policies. **You escalate each with the probe named (`SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE`, `SKIP-D11-PROVIDER-PAYMENT-ID-INDEX-LIVE-DB`, `SKIP-D2`/`SKIP-D4`) — you do NOT execute the DROP.**
- Retarget the observability config theater to the real Cloudflare Analytics Engine dataset OR archive the Grafana/SLO/prometheus JSONs pointing at deleted k8s / empty reserved roots.

**Category-C RECORDED (do not build):** **alerting end-to-end** — no metric emitters, no error SDK, no delivery channel; the Sentry DSN seam is moot without them. NAME it in `CAPABILITY_BACKLOG.md`; do NOT claim "alerting provisioned" off a DSN. Plus all carried Phase-2–5 gaps.

**Validation gate:** `SKIPPED_HUMAN_DECISIONS.md` shows every launch-blocking seam recorded with blast radius; the observability config no longer references a deleted cluster/empty reserved root; `CAPABILITY_BACKLOG.md` ENUMERATES the named capability prerequisites as out-of-convergence builds.

**Roll-forward:** convergence is complete here regardless of the gaps; the platform is NOT declared launch-ready until those ship.

---

### PHASE 8 — CONVERGENCE VERIFICATION & ONE-REALITY LOCK (see §8)

The verification phase is the Final Self-Audit (§8). Run it as the last step of the single run.

---

## 7. Capability-Gap Out-of-Scope Register (Category C — NAME and escalate; NEVER build, fake, or claim closed)

These survive ANY commit, ANY merge, ANY secret. **A delete does not fix any of them.** Your ONLY legitimate contributions: COMMIT their authority migrations (160/162/163/164/165/166), RETARGET the validators so the gap becomes VISIBLE, and NAME the build in `CAPABILITY_BACKLOG.md` + `SKIPPED_HUMAN_DECISIONS.md`. You design nothing here; you record.

| # | Gap (named, not designed) | Phase | Why out of scope / what you may legitimately do |
|---|---|---|---|
| 1 | **Storefront/webhook capture ledgering** — `confirm_order_payment_with_ledger` (`000_baseline.sql:1590`) posts 0 canonical ledger lines on the path every shopper hits, all 3 realities | 3 | The #1 unfinished winner. Retarget `canonical-ledger-only-validator` to SEE the SQL writer (visibility); NEVER wire the posting. |
| 2 | **Payout provider client** — `initiateTransfer` throws (`payout-transfer-adapter/index.ts:82`); no `PayoutProviderClient` in any branch | 3 | Merchants can never be paid until built. Record. |
| 3 | **Reconciliation wiring** — refreshers have 0 callers; wallet 409s forever | 3 | Commit lands the kernel; the scheduled caller + operator-clear action is a build. Record. |
| 4 | **2/3 refund-path ledgering + `merchant_payable` cross-source dedup** | 3 | Reversing entries + dedup are builds. Record. |
| 5 | **Settlement executor + cross-source dedup** | 3 | The execution side is a build; the writer choice is ARB. Record. |
| 6 | **Step-up real crypto** — a self-served `mock-step-up-${uuid}` guards refund/payout/DSR-erase | 2 | Stop the validator allowlisting the mock once a real path exists; NEVER build TOTP/passkey/re-auth. |
| 7 | **Per-realm HS256 re-home + JWT revocation + OIDC** — `oauth2/*` is a 501 skeleton; 4 realms still HS256 | 2 | Commit lands the merchant issuer; re-keying + revocation + OAuth are builds. Record. |
| 8 | **Live identity keypairs/JWKS** — unprovisioned (`SKIP-D3`) | 2 | Human seam — the asymmetric topology fails closed without them. Record (Category B + C overlap). |
| 9 | **Liquid chrome + data binding + full templates + canary write path + editor** — the ratified winner cannot run a real store | 4 | The React-deletion prerequisite. React stays FROZEN. Designed nowhere. |
| 10 | **Mobile login Turnstile double-spend** — same token spent twice → login fails closed | 5 | A bug fix, not a convergence delete (`SKIP-W7`). Record. |
| 11 | **Alerting end-to-end** — no metric emitters, no error SDK, no delivery channel; the Sentry DSN seam is moot without them | 7 | Name it as a launch blocker; NEVER claim "alerting provisioned" off a DSN. |
| 12 | **RT-1…9 `withTenantTx` adoption proof + raw-REST parity** — commit lands mig 163/164 | 1/6 | The red-team adoption proof + raw-REST removal are builds. Record. |

**The four hardest are the real critical path: capture ledgering (1), reconciliation wiring (3), payout client + executor (2/5), and Liquid chrome (9).** The money path (1 + 2/5 + 3 + 4) cannot complete by convergence. **You record these as the explicit go-live backlog and STOP.** Faking any reproduces the money-theater bug class the audit caught — the prohibition is absolute.

---

## 8. Final Self-Audit & One-Reality Lock (the binary exit test) + Run Summary

> **RULE #0 reminder for close-out:** confirm one last time that no discard command was ever run and the canon is tracked. The exit test below is the proof.

Run this as the last step. The run is **convergence-complete when, and ONLY when, ALL hold simultaneously** (a deferred-with-SKIP loser-delete or a recorded Category-C gap does NOT block completion — those are honestly carried, not failures):

1. **One reality (branch + commit, local).** `git rev-list --count main..stepup/main = 0` **locally**; the committed hardened working tree is what local `main` carries; the triplication has collapsed locally (`main` = `stepup/main` = the committed tree). The remote push is a recorded SKIP, not a blocker. **No `git clean -fd` can destroy the canon, because it is tracked** (the binary Rule #0 exit test).
2. **One law, no self-block.** `node scripts/validate-governance.mjs --lane=gate` is **green WITHOUT any multi-region/survivability/`globalRegions`/failover/replay/chaos/CQRS assertion** — `git grep -l "globalRegions\|failoverPairs\|multi-region\|survivability" scripts/validators/ config/runtime/` → **0**. The gate is green because it is honest, NOT because a check was silenced — verify the absence of the self-block, not merely a green run. GATE-1 is recorded as a SKIP (the ARB signature), not self-signed.
3. **One owner per domain (or a recorded gap/deferral).** `one-system-per-domain-validator` PASS for every domain actually converged. For EVERY domain the winner is the SOLE owning system/route/writer/issuer/ledger/token-source/renderer-canonical/ops-console, OR the only residual is (a) a Category-C capability gap recorded in `CAPABILITY_BACKLOG.md`, or (b) a loser-delete DEFERRED with a SKIP row because its gating signal (live probe / call-graph trace / ARB pick) was unavailable this run. No domain carries two writers/issuers/ledgers "as a fallback" with NO recorded reason.
4. **One prompt perimeter.** `PROMPTS.md` is the single registry; the `docs/`-wide guard turns the gate red on any `*MISSION*/*PROMPT*/*BLUEPRINT*/TERMINAL_*` outside `docs/archive/`; every archived prompt carries the quarantine sentinel; **THIS prompt is registered `CANONICAL-EXECUTION` or archived-with-sentinel** (no live unregistered `*PROMPT*`); the generator stays hard-retired (`repository-intelligence-validator` PASS; `git grep -l "GENERATED BY scripts/generate-repository-intelligence"` → 0 tracked).
5. **One honest boundary.** `CAPABILITY_BACKLOG.md` exists and records the residual builds (capture ledgering, payout client + executor, reconciliation wiring, step-up crypto, Liquid chrome, mobile login, alerting). **Convergence is complete, but the platform is NOT declared launch-ready until those ship.**
6. **Full auditability.** `EXECUTION_LEDGER.md` has a row for every action of this run; `SKIPPED_HUMAN_DECISIONS.md` has an appended row for every human seam encountered; both are committed.

**Record a convergence-completion attestation** (per domain: exactly one owner, or a named gap/deferral), cross-checked against the 14-winner registry and the 22-domain SoT. **Record a drift-prevention attestation:** PROMPTS.md live; the `docs/`-wide guard wired; survivability/multi-region absent from every validator; generator retired; local `main` = `stepup/main`. **Carry `CAPABILITY_BACKLOG.md` forward as the go-live backlog.**

### Run Summary — emit this at the end of the single run

Print a concise, factual summary (and write it as the final `EXECUTION_LEDGER` block, `STEPUP-RUN-SUMMARY`):
- **Backup:** the verified bundle + tar paths.
- **Commit:** the Phase-0 commit SHA; clean-clone reproduces canon (migs 162–166 + 22 validators + tasks-executable archive): yes/no.
- **Unhook:** `git grep globalRegions scripts/validators/` = 0: yes/no.
- **Local one-reality:** `git rev-list --count main..stepup/main` value (target 0).
- **Gate:** green-and-honest: yes/no.
- **Batches:** which of 0–6 completed, which items were DEFERRED-with-SKIP and why.
- **SKIPPED-HUMAN seams:** the full list of `SKIP-*` ids appended/updated this run (the exact set you are handing to the human).
- **CAPABILITY_BACKLOG:** the Category-C gaps recorded (count + ids).
- **NOT launch-ready:** state it explicitly, naming the four hardest gaps.
- **Recovery:** the backup artifacts are intact and how to restore from them.

---

## 9. Evidence base (the nine Convergence Cleanup reports — read for context; operative rules are inlined above)

All in `CONVERGENCE_CLEANUP_2026_06_10/`. Each phase/batch above cites the report grounding it.

1. **`REPOSITORY_FORENSICS_REPORT.md`** — the 31-row duplication ledger; the self-block exact lines; the 917 `getSupabaseAdmin` / 62 MCP-route / 79 nested-AGENTS counts; temporal triplication.
2. **`STRATEGIC_WINNERS_FINAL.md`** — the 14 winners (0 overturns), the Loser Registry with each loser's removal-blocking condition, the four capability-gated losers, the Unknowns.
3. **`SINGLE_SOURCE_OF_TRUTH_MASTERPLAN.md`** — the 22 domains (Current Sources / Target SoT / Convergence Path / Deletion Candidate / Risk / Blocking Dependencies); the 4 buckets.
4. **`SAFE_DELETION_PLAN.md`** — the KEEP/ARCHIVE/DELETE taxonomy, the per-artifact tables, the Dangerous-to-Delete Watchlist, and **Batches 0–6** (the ordering this prompt drives).
5. **`DOCUMENT_CONVERGENCE_PLAN.md`** — the document-granular KEEP/ARCHIVE/REWRITE/DELETE cut; the 97-file generated-stale tree; the ARCHIVE-needs-COMMIT list.
6. **`PROMPT_DRIFT_ELIMINATION_PLAN.md`** — the 9 DELETE hazards, the ~41 ARCHIVE-quarantine set, the verbatim quarantine header, the PROMPTS.md + perimeter-guard requirements.
7. **`GOVERNANCE_CONSTITUTION.md`** — the Authority Chain, the eight Cleanup Laws L1–L8, the Drift-Prevention Regime, the conflicts-resolved table.
8. **`LETBUYY_CONVERGENCE_EXECUTION_MASTERPLAN.md`** — Phases 0–8 with per-phase precondition/inputs/outputs/risks/validation-gates/exit-criteria; the dependency graph; the capability-gap boundary; the binary one-reality exit test.
9. **`CODEX_REPOSITORY_CONVERGENCE_EXECUTION_PROMPT.md`** — the Phase-9 HALT-mode prompt that THIS file transforms into single-go (HALT gates → SKIP-and-continue; mechanical safety kept; capability gaps kept as record-don't-fabricate).

Substantive authority defers throughout to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` (AGENTS_V2) → `LETBUYY_CANONICAL_SYSTEMS.md`. On ANY conflict, the lower-ranked (1=supreme) wins: (1) Constitution, (2) root AGENTS.md, (3) Canonical Systems, (4) Legacy Plan + Roadmap (THIS prompt is procedural law co-planar here — it states the rules of the convergence those documents sequence; it never outranks substance), (5) UI/UX governance, (6) the evidence base (the "why," not authority). **If a procedure here would violate DOC 01 (e.g. building a capability gap, certifying multi-region, faking a money path), DOC 01 wins and you record-and-skip instead.**

---

*End of the Codex Foundation Stepup Master Execution Prompt (single-go). This file is the executing agent's complete, self-contained order for performing the ENTIRE LetBuyy convergence in ONE local run. It encodes the three gate categories (A mechanical-safety non-skippable / B human-approval skip-and-continue / C capability-gap record-don't-fabricate), Rule #0 + Backup-First, the 15-item never-do list, the three-file run ledger protocol (EXECUTION_LEDGER + SKIPPED_HUMAN_DECISIONS + CAPABILITY_BACKLOG), the gated Phases/Batches 0–8 in one continuous pass (each: preconditions → actions → proof → gate → roll-forward/record-and-continue, with the Category-B seams recorded per phase), the Category-C out-of-scope register, and the binary one-reality exit test + Run Summary. It sequences backup → survivability-unhook → Phase-0 commit → Batches 1–6 → local fast-forward → verification in a single run, recording every remote/privileged/credential/signature/live-DB-probe seam as SKIPPED-and-continue and every capability build as RECORDED-not-fabricated. Authoring it executed nothing — no code, schema, migration, commit, deletion, archive-move, validator-retarget, or git mutation was performed; read-only git was used only to re-verify the operative facts inlined here. Baseline pinned at `stepup/main` @ `5cf9e64e`, working tree dirty (512 D / 410 M / 79 ??), 2026-06-10.*
