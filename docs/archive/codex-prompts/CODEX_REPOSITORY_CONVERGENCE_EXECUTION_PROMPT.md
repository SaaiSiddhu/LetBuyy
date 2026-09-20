<!-- PHASE 9 — CODEX REPOSITORY CONVERGENCE EXECUTION PROMPT. The crown deliverable of the LetBuyy Convergence Cleanup Program. This file is a PROMPT authored for a future Codex agent to FOLLOW; authoring it executed nothing — no code, schema, migration, commit, deletion, archive-move, validator-retarget, or git mutation was performed. Read-only git was used only to re-verify the operative facts inlined below. Baseline: stepup/main @ c4fc3cd6, working tree 512 D / 410 M / 79 ??. -->

# CODEX REPOSITORY CONVERGENCE EXECUTION PROMPT

> **YOU ARE THE EXECUTING CODEX AGENT.** This is your complete operating order for SAFELY converging the LetBuyy monorepo from its triplicated, duplicated state down to the single canonical reality the product canon already names. Everything you need — every rule, every batch, every path, every gate — is in THIS file. You will reference the eight prior reports as your evidence base, but the operative rules are inlined here so you never have to guess.
>
> **THIS IS A SAFETY-CRITICAL CLEANUP.** A naive "clean up the repo" pass here is catastrophic: the only canon-conforming reality is an UNCOMMITTED working tree with ZERO git history, and committing it ARMS a CI gate that mandates an architecture the Constitution forbids. The whole point of this prompt is the guardrails. Obey them literally. When in doubt, HALT and escalate — never improvise, never fabricate, never delete without proof.
>
> **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · **branch:** `stepup/main` · **HEAD:** `c4fc3cd6` (`c4fc3cd6898215f53fb462800ca526f649ce37ae`) · **+30 over `main`** (`git rev-list --count main..HEAD = 30`) · **deploy branch:** `main` (the ONLY branch production CI triggers from — `production-deploy.yml:5-6 on: push: branches:[main]`) · **working tree:** dirty (`512 D / 410 M / 79 ??`). Re-verify these at start; if any differs materially, HALT and report (§ STOP CONDITIONS).
>
> **Your ethos (non-negotiable, applies to YOU as you execute):** Never guess. Never fabricate. Never delete without proof. Archive before delete. Respect the Architecture Freeze, the Executable Architecture V1, the Strategic Winners, the Single Source of Truth, the Governance Constitution, and the Convergence Masterplan — all six are inlined operationally below. A stub must never read as `success`/`live`. A mock must never be presented as real. You evidence every claim with a cited `path:line` or exact command.

---

## 1. Mission & Scope

### 1.1 — What you are doing

You are collapsing **temporal triplication** and **spatial duplication** into ONE reality. Three realities co-own every load-bearing domain today:

- **Plane A = `main`** — the only branch CI deploys; **30 commits behind**; ships the condemned regime (the `/api/auth/switch` account-takeover, the 3% GMV rake default, anon-readable tenant data via `USING(true)` RLS policies, mutable-balance-as-money-truth, un-ledgered capture).
- **Plane B = HEAD `stepup/main`** — `+30`; carries the canonical ledger kernel (migrations 139/160) and most winners as committed code.
- **Plane C = the uncommitted working tree** — adds migrations **162–166** (`162_phase_a_commission_zero`, `163_d2_live_data_leak_rls`, `164_d4_tenant_role_guc`, `165_d5_canonical_money_paths`, `166_d6_checkout_handoff_inventory`), the asymmetric identity issuer, RLS+GUC enforcement, DOMPurify, the Constitution stack, both 2026-06-10 archive trees, the 22 money/identity validators, **and the 512 staged deletions** that remove the rejected distributed/CQRS cluster. **This is the ONLY reality conforming to the Constitution — and it has ZERO version-control protection.** Everything is `??`/`D`/`M`.

**Authority and durability are inversely correlated.** The correct reality is the least durable one — one `git clean -fd` from non-existence. Your job is a gated sequence — **commit → ratify → unhook → delete → archive → retarget → fast-forward** — that makes the already-decided winners durable and live, then removes the already-decided losers in dependency order, **without ever destroying the working tree and without ever committing into the armed self-block.**

### 1.2 — What you are NOT doing

You are **converging**, not building. You add no features, redesign no architecture, invent no systems. The work is exactly: `git add -A` + commit, `git mv` to archive, delete-with-proof, edit-a-validator-to-retarget-not-to-pass, collapse N→1, fast-forward `main`, trace-gated proxy cutover. **The named capability gaps (§ Capability-Gap Out-of-Scope register) are OUT OF SCOPE — a delete does not fix any of them; you name them and escalate, you do not design them.**

### 1.3 — The winners are already decided (do not re-litigate)

The Strategic Winners report re-derived all 14 from canon + code with **0 overturns**. You do NOT re-open "which one wins." The losers are alive only because the winning code is uncommitted/undeployed or a validator structurally mandates the loser. The 14 winners (each is the SOLE owner you converge toward):

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

### 1.4 — Evidence base (read for context; the operative rules are inlined here)

All eight live in `CONVERGENCE_CLEANUP_2026_06_10/`. See § Evidence Base for the per-document map. You do not need to re-read them to execute — but every batch below cites the report that grounds it, and if you find a contradiction between this prompt and a report, the **Authority Chain** (§4.1) resolves it: the product Constitution wins, then root `AGENTS.md` (= AGENTS_V2), then this prompt's procedural law.

---

## 2. RULE #0 — NEVER DISCARD THE WORKING TREE (stated first, repeated everywhere)

> **RULE #0. You MUST NEVER run any command that discards, reverts, or cleans the working tree.** Categorically forbidden, at every step, with no exception and no "just this once":
>
> - `git clean -fd` (and `-fdx`, `-fX`, any `clean`) — **permanently destroys** the only canon-conforming reality (Constitution, AGENTS_V2, migrations 162–166, the 22 money/identity validators, both 2026-06-10 archive trees) — all `??`, zero history anywhere.
> - `git checkout -- .` / `git checkout .` / `git restore .` / `git restore --staged --worktree .` — **resurrects the condemned `main` regime** (account-takeover, 3% rake, anon leaks) over the hardened tree.
> - `git reset --hard` (any ref) — discards uncommitted canon.
> - `git stash` followed by a drop, or `git stash pop` on the existing `stash@{0}` (from the deleted `stream/letbuyy-ui-v2` branch) — splices old-regime artifacts onto the new state; popping/dropping blind is forbidden (inspect-then-decide only, and never before the Phase-0 commit).
> - Any force-checkout of `main` over the working tree, any `git worktree` operation that would overwrite plane C.
>
> **Why this is Rule #0 and not Rule N:** the working tree is the ONLY reality where commission is 0% (mig 162), the anon RLS leaks are closed (mig 163), tenant GUC is enforced (mig 164), money paths are canonical (mig 165), checkout/inventory handoff exists (mig 166), and the money+identity validators exist. **None of this is committed.** A clean checkout has NO money gates at all and silently omits 162–166. (Verified this program: `git ls-files database/supabase/migrations/16[2-6]_*.sql` returns nothing — they are on disk but untracked.)
>
> **The global precondition for EVERY physical deletion in this program is a prior Phase-0 commit of the working tree (§ Batch 0). No batch may precede it except pure machine-junk (Batch 1). The cleanup must NEVER BEGIN with a discard command.**
>
> Restated at the head of Batch 0, Batch 1, and the Final Self-Audit, because it is the single mistake that ends the program irrecoverably.

---

## 3. THINGS YOU MUST NEVER DO

A flat, quotable list. Any one of these is a program-ending error. If a step seems to require one of these, you are misreading the step — HALT and escalate.

1. **NEVER** `git clean -fd` / `git checkout .` / `git restore .` / `git reset --hard` / blind `git stash` drop or pop — anything that discards or reverts the working tree (Rule #0).
2. **NEVER** begin the cleanup with a destructive git op. The FIRST substantive act is the Phase-0 commit (after the gates of §5 pass).
3. **NEVER** commit the working tree before the survivability-unhook is decided and applied in/before that same commit. Committing ARMS the multi-region self-block (`whole-repo-end-state-validator.mjs:174` + `survivability-governance-validator.mjs:94,106` require `globalRegions:[india,apac,eu,us]`; the latter is tracked on `main`, the former is untracked and goes live at commit). A commit into the armed block fails CI against itself and certifies a forbidden topology on the deploy branch.
4. **NEVER** commit the staged deletions (512 `^D`) without `git add -A` first. The archive copies in `docs/archive/*-2026-06-10/` are 100% UNTRACKED (`??`); a tracked-only `git commit -am` orphans the archive and loses both the deletion's provenance and the only surviving copy. This is the "commit trap."
5. **NEVER** delete a loser while its winner is uncommitted OR undeployed. Specifically: do NOT delete the React renderer, the merchant-control-plane/storefront-runtime second-backend routes, the mutable money model as truth, or the legacy identity mint paths until the winner is committed AND `main` is fast-forwarded AND deployed (`[WINNER-DEPLOYED]`). Deleting these early **blanks production**.
6. **NEVER** delete anything without a cited no-consumer proof (a fresh `grep`/import-graph at `path:line` or the exact command) showing zero live importers/callers/references. Negative test assertions asserting *absence* do NOT count as consumers, and do NOT count as a live consumer either — they are the green light. If ANY live consumer is found, ABORT that item.
7. **NEVER** drop a database table/column without a live writer probe (`\dp public.<table>`, an anon-key probe, or DB introspection) proving no RPC/ops-script/trigger writes it. This is OUTSIDE your authority. HALT and escalate every dead-table DROP.
8. **NEVER** touch the named capability gaps as if convergence fixes them (capture ledgering, payout provider client, reconciliation wiring, step-up crypto, Liquid chrome/data-binding, mobile login double-spend, alerting/observability SDK). They are OUT OF SCOPE. You may commit their authority migrations and retarget validators so the gap becomes *visible*, but you NEVER build, complete, fake, or claim them closed (§ Capability-Gap register).
9. **NEVER** silently resolve, complete, fabricate, or self-decide a `SKIPPED_HUMAN_DECISIONS.md` / `EXECUTABLE_HUMAN_REQUIRED.md` / `UNVERIFIED` item (keys, secrets, DNS, PITR, branch protection, the privileged commit/merge, ARB ratification, the ops-console survivor, live-DB probes, the mig-162 in-place rewrite call). HALT and escalate; never fake-complete.
10. **NEVER** force a red governance gate green by editing the validator to pass (deleting the assertion to silence it, weakening a check, removing a validator from the gate array to dodge a failure). That is governance theater. The ONLY legitimate validator edit is the ARB-ratified, named **retarget** (strip the multi-region region-loop, delete `survivability-governance-validator.mjs` wholesale, drop the theater aliases) executed as part of `[SURVIVABILITY-UNHOOK]`. If the gate goes red for any other reason, STOP and report.
11. **NEVER** re-run or re-enable the retired generator `scripts/generate-repository-intelligence.mjs` (it exits 1; its retirement is LAW — `repository-intelligence-validator.mjs:41` asserts the tombstone). Do not delete it either (deleting it breaks the assertion).
12. **NEVER** leave a prompt-class file (`*MISSION*`/`*PROMPT*`/`*BLUEPRINT*`/`TERMINAL_*`/paste-ready `/goal`) live anywhere outside `docs/archive/**` or the one `PROMPTS.md` `CANONICAL-*` registry entry (the prompt-perimeter, Law L7).
13. **NEVER** recreate or reference the rejected/deprecated topology as active: the 7 rejected packages (`packages/{app-engine, application-services, distributed-runtime, extension-host, orchestration, projection-runtime, runtime-composition}`), the deprecated app aliases (`apps/{admin,auth,checkout,internal,merchant,storefront,analytics}`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`), `extension-host`/Wasm Functions, `event-bus`, or the dead domains `letbuyy.store` / `*.letbuyy.store` / `developers.letbuyy.store`.
14. **NEVER** delete the reserved-service/reserved-mobile manifest stubs or treat their build-out missions as live. Their manifest-only existence is validator-MANDATED (`whole-repo-end-state-validator.mjs:59-78`); deleting them FAILS the gate.
15. **NEVER** present this program's completion as "launch-ready." Convergence-complete ≠ launch-ready. The capability gaps remain the go-live backlog.

---

## 4. STOP CONDITIONS / ESCALATE-TO-HUMAN

When ANY of the following holds, you HALT the current batch, record the reason and the exact evidence, and escalate to the human/ARB. You do not proceed, do not work around it, do not fake-complete it.

**Authority / ratification seams (human-only):**
- **The Phase-0 privileged commit is not yet confirmed done by a human, or you lack authority to perform it.** The commit is a human-gated, privileged, clean-tree act. If you cannot confirm the human has authorized/performed it, HALT at Batch 0 and require confirmation — do NOT perform the privileged commit yourself if you lack that authority. (§5.1)
- **The ARB survivability-unhook decision is not recorded.** No `SKIP` row authorizes *keeping* multi-region; an explicit ARB repeal is required. Without it you may NOT commit (committing arms the self-block). HALT. (§5.2)
- **`SKIP-GATE1-ARB-RATIFICATION` is unsigned.** The Constitution self-declares "RATIFIED, SUPREME" but the human ARB signature is the open seam. The constitutional acts (the commit, the validator-baseline retarget, the fast-forward) are ARB-gated. HALT for the signature. (§5.3)
- **`SKIP-GATE-OPS-SURVIVOR-ARB`** (platform-console vs platform-operations-portal), **`SKIP-PROD-DEPLOY-PROMOTION`** (branch protection / privileged merge) — HALT; ARB/human only.

**Proof / authority-boundary seams:**
- **A DELETE has no cited no-consumer proof, or a live consumer IS found.** ABORT that item; do not delete on suspicion.
- **A dead-table/column DROP is required.** Out of your authority — requires a live writer probe a human with DB access must run (`SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE`, `SKIP-D11-PROVIDER-PAYMENT-ID-INDEX-LIVE-DB`, `SKIP-D2-LIVE-ANON-GRANT-PROBE`, `SKIP-D4-LIVE-FORCE-COVERAGE-PROBE`). HALT and escalate.
- **A second-backend route deletion lacks the per-page call-graph trace.** The trace (which UI page calls which of the 62 MCP / 21 storefront routes vs the gateway) is UNVERIFIED and gates the cutover. Without it these stay `KEEP (conditional)`. HALT.
- **A loser's winner is not yet `[WINNER-DEPLOYED]`** (committed on `stepup/main`, `main` fast-forwarded, deployed). HALT the loser's deletion.

**Gate / integrity seams:**
- **The governance gate goes red for any reason other than a planned, ARB-ratified retarget.** STOP and report; never silence it by editing the validator (Never-Do #10).
- **A capability gap is encountered as if it were a cleanup item** (capture ledgering, payout client, recon wiring, step-up crypto, Liquid chrome, mobile login, alerting). Name it, record it as out-of-scope, escalate; do not build it.
- **A `SKIPPED_HUMAN_DECISIONS.md` / `EXECUTABLE_HUMAN_REQUIRED.md` / `UNVERIFIED` item** blocks a step (keys/secrets/DNS/PITR/Sentry/WABA/live probes/mig-162 rewrite). HALT at the seam; proceed only with the human decision in hand.
- **The baseline drifted materially** (HEAD ≠ `c4fc3cd6`, branch ≠ `stepup/main`, lag ≠ 30, or the tree is no longer dirty in the expected shape). HALT and re-derive before any action.

**The known open `SKIP-*` register you must respect as HALT-or-escalate seams** (from `SKIPPED_HUMAN_DECISIONS.md`, verified present this program): `SKIP-GATE1-ARB-RATIFICATION`, `SKIP-GATE-OPS-SURVIVOR-ARB`, `SKIP-D1-MERGE-RUNBOOK-DIRTY-TREE`, `SKIP-D2-LIVE-ANON-GRANT-PROBE`, `SKIP-D3-IDENTITY-LIVE-PROVIDERS`, `SKIP-D4-LIVE-FORCE-COVERAGE-PROBE`, `SKIP-D5-LIVE-MONEY-RECONCILIATION`, `SKIP-D6-LIVE-CHECKOUT-CUTOVER`, `SKIP-D8-MOBILE-RELEASE-SIGNING-SECRETS`, `SKIP-D10-WHATSAPP-BSP-WABA-HSM`, `SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE`, `SKIP-D11-PROVIDER-PAYMENT-ID-INDEX-LIVE-DB`, `SKIP-PROD-DEPLOY-PROMOTION`, `SKIP-PROD-DNS-CUTOVER`, `SKIP-PROVIDER-SECRETS`, `SKIP-W0-PITR-TIER`, `SKIP-W3-DNS-CUTOVER`, `SKIP-W3-SENTRY-DSN`, `SKIP-W4-LIVE-SECRET-ROTATION`, `SKIP-W4-MTLS-CF-ACCESS`, `SKIP-W7-MOBILE-TURNSTILE-SECRET`, `SKIP-W7-WHATSAPP-LIVE-CREDS`.

---

## 5. Preconditions & Authority Gates (HALT if any is unmet)

These three gates govern go/no-go for the entire program. **You may not start Batch 0 (the commit) until ALL THREE are satisfied.** One is non-obvious and pivotal (Gate 2 must precede or accompany Gate 1's commit).

### 5.1 — Gate 1: The Phase-0 commit is human-authorized (and you have authority to perform it, or it is already done)

The Phase-0 commit is a **privileged, clean-tree, human-gated** act. Confirm, before staging anything:
- A human/ARB has authorized the `git add -A && git commit` on `stepup/main`.
- The tree shape matches the expected baseline (`512 D / 410 M / 79 ??`, HEAD `c4fc3cd6`).
- **If you lack authority to perform the privileged commit, HALT and require a human to confirm it is done** before you proceed to any deletion. Do not perform it yourself without that authority. (Law L1; `SKIP-D1`.)

### 5.2 — Gate 2: The survivability-unhook is ARB-decided AND applied in/before the commit (THE PIVOTAL GATE)

**This is the program's keystone and it is counter-intuitive: committing the correct reality ARMS the gate that enforces the forbidden architecture.**

Verified live this program (do not take on faith — re-verify):
- `scripts/validators/survivability-governance-validator.mjs` is **tracked AND on `main`** (`git cat-file -e main:scripts/validators/survivability-governance-validator.mjs` → exists). It asserts `multi-region-runtime.json` must contain regions `india/apac/eu/us` (`:94`), failover pairs with replay + positive RTO/RPO (`:98-102`), and `production-topology.json.regions.globalRegions.length >= 4` (`:106`).
- `scripts/validators/whole-repo-end-state-validator.mjs` is **UNTRACKED / plane-C-only / ABSENT on `main`** (`git cat-file -e main:…whole-repo-end-state-validator.mjs` → fatal). It re-asserts the same 4 regions (`:174`) and wires `validate:survivability` / `validate:production-certification` into 3 workflows.
- The Constitution forbids certifying multi-region (DOC 01 §6/§5.3).

**So the instant Batch 0 runs `git add -A && git commit`, the untracked end-state validator becomes tracked and CI-active, and the gate enforces, repository-wide, the very multi-region topology the Constitution voids — the commit would fail CI against itself.**

**Therefore `[SURVIVABILITY-UNHOOK]` MUST be decided by ARB and applied IN or BEFORE the Phase-0 commit — never after.** Admissible orderings (preference order):
1. **Preferred — unhook IN the Phase-0 commit:** ARB repeal recorded first (governance decision, no code); then stage the tree with the region asserts already stripped and topology honest → green-and-honest on first CI run.
2. **Acceptable — unhook as the FIRST commit, working-tree truth as the SECOND**, both before any push to `main`. The armed-but-not-honest window never reaches the deploy branch.
3. **FORBIDDEN — commit the working tree, then unhook later.** This leaves a committed window where the canonical gate certifies the loser, and `main` could fast-forward into it.

**If the ARB survivability-unhook decision is not recorded, HALT — you may not commit.** (Law L4; `STRATEGIC_WINNERS_FINAL` Decision 8; no `SKIP` row authorizes keeping the contract — Unknown #4.)

### 5.3 — Gate 3: `SKIP-GATE1-ARB-RATIFICATION` is signed

The product Constitution self-declares ratification, but the **human ARB signature is not recorded**. Until a human ARB records the GATE-1 signature, the canon is followed by directive only, and the constitutional acts that complete operativeness — the Phase-0 commit, the survivability repeal, the validator-baseline retarget, the archival of V1/Freeze, the promotion of AGENTS_V2, the fast-forward — are **ARB-gated**. You MUST NOT self-sign GATE-1, MUST NOT treat the self-declared ratification as the human signature, and MUST record/leave the skip in `SKIPPED_HUMAN_DECISIONS.md`. HALT for the signature where a step depends on it. (Law L8; §5.2 of the Governance Constitution.)

> **The pivotal sequencing summary:** Gate 2 (unhook) is *worsened* by Gate 1 (commit), so Gate 2 precedes or accompanies Gate 1. Gate 3 (ratification) authorizes both. **Unhook-decision → commit-with-unhook → ratify → (later, Phase 6) fast-forward.** Never commit before the unhook is in hand.

---

## 6. The Cleanup Laws (L1–L8) — restated operationally

These are binding. Each is MUST/MUST-NOT. They govern every execution act; they retire when convergence completes. (Source: `GOVERNANCE_CONSTITUTION.md` §3.)

- **L1 — COMMIT-BEFORE-DELETE.** No physical deletion / archive-move / destructive git op begins until the Phase-0 `git add -A && git commit` has frozen the working tree onto `stepup/main`, committing the untracked canon together with the 512 tracked deletions. **MUST NOT** begin with `git clean -fd` / `git checkout .` / `git reset --hard` / `git restore` (Rule #0).
- **L2 — ARCHIVE-BEFORE-DELETE.** Any artifact of historical value being removed MUST be `git mv`'d to `docs/archive/<cluster>-2026-06-10/` first, and that archive copy MUST be committed before/with the deletion of the live copy. For artifacts already archived-but-untracked, the action is **COMMIT the archive**, not re-archive. This is how you beat the commit trap (512 `^D` with `??` archive copies).
- **L3 — NEVER DELETE A LOSER WHILE ITS WINNER IS UNCOMMITTED OR UNDEPLOYED.** No loser is physically deleted until `[WINNER-DEPLOYED]`: winner committed on `stepup/main`, `stepup/main` promoted to `main`, `main` deployed. Until then the row is `KEEP (conditional)` with the precondition stated. Check this PER ITEM. The losers this program removes are overwhelmingly the *currently-deployed* reality (React renderer = 100% of stores, no-ledger capture, the 62-route second backend, the multi-region machinery).
- **L4 — SURVIVABILITY-UNHOOK-BEFORE-COMMIT (the keystone).** The ARB-ratified repeal of the multi-region/survivability self-block MUST precede or accompany the Phase-0 commit as one atomic change that keeps the gate green (§5.2). The Phase-0 commit MUST NOT land without it.
- **L5 — PROOF-BEFORE-DELETION.** No artifact deleted without a cited no-consumer proof (`path:line` or exact command; absence-assertions in tests are not consumers). Database table/column drops additionally require a live writer probe — which is outside your authority → HALT and escalate.
- **L6 — ONE-OWNER-PER-DOMAIN.** After convergence, exactly ONE owning system/route/writer/issuer/ledger/token-source/renderer-canonical/ops-console per domain. You MUST NOT leave two writers/surfaces/issuers/ledgers "as a fallback"; the loser is proxied-or-ported-then-removed under L3.
- **L7 — PROMPT-PERIMETER.** After cleanup, no prompt-class file (`/(MISSION|PROMPT|BLUEPRINT|GOAL|RELAUNCH)/i`, `/^TERMINAL_/i`, or paste-ready launch marker) lives anywhere live; permitted only under `docs/archive/**` (with the quarantine sentinel) or registered `CANONICAL-*` in `PROMPTS.md`. The 9 pure drift hazards are DELETED; the ~41 historical missions/blueprints are ARCHIVED-and-quarantined.
- **L8 — HUMAN-SEAM RESPECT.** No agent silently resolves/completes/fabricates/self-decides any `SKIPPED_HUMAN_DECISIONS` / `EXECUTABLE_HUMAN_REQUIRED` / `UNVERIFIED` item. Escalate, badge, leave open. A stub MUST never read as `success`/`live`.

---

## 7. Execution — Batches/Phases 0–8

Execute in order. Each batch states its **precondition gate (halt-if-unmet)**, the **exact action set** (with the per-item proof requirement for deletes), the **post-action validation gate**, and the **roll-forward / abort rule**. The batch numbers map to `SAFE_DELETION_PLAN` Batches 0–6; the Phase numbers map to `LETBUYY_CONVERGENCE_EXECUTION_MASTERPLAN` Phases 0–8. They are interleaved exactly as the masterplan sequences them.

> **Universal roll-forward rule (applies to every batch):** Run `pnpm run validate:governance` AFTER the batch. **Roll forward to the next batch ONLY if it is green.** If the gate goes RED, STOP and report — do NOT force it green by editing a validator to pass (Never-Do #10). The only legitimate validator edits are the named `[SURVIVABILITY-UNHOOK]` retargets, which are themselves gated by ARB.

> **The three reusable preconditions** referenced below:
> - **`[COMMIT]`** = Batch 0 done (working tree committed on `stepup/main`, with the unhook in/before it).
> - **`[WINNER-DEPLOYED]`** = winner committed + `main` fast-forwarded + deployed.
> - **`[SURVIVABILITY-UNHOOK]`** = the ARB-ratified, atomic retarget that releases the self-block (the 6-step change in Batch 6 / Phase 1, below).

---

### BATCH 0 / PHASE 0 — REPOSITORY TRUTH FREEZE (the commit; NOT a delete)

**Maps to:** SAFE_DELETION Batch 0. **Laws:** L1, L2, L4, L8.

**Precondition gate (HALT if unmet):** ALL THREE of §5 — the commit is human-authorized (§5.1); the survivability-unhook is ARB-decided and ready to apply in/before this commit (§5.2); `SKIP-GATE1` is signed (§5.3). **RULE #0 in force: do NOT begin with any discard command.**

**Action set (this is one privileged act, not a deletion):**
1. **Apply the survivability-unhook IN this commit (ordering #1) or as the immediately-preceding commit (ordering #2)** — never after. (Detailed steps in Batch 6 § `[SURVIVABILITY-UNHOOK]`; the unhook *decision/retarget* lands here, the *config/doc deletes it unblocks* land in Phase 6.)
2. **`git add -A`** first (MANDATORY — stages the 512 tracked deletions AND their untracked archive copies AND the untracked canon atomically; a tracked-only commit triggers the commit trap, Never-Do #4).
3. **`git commit`** on `stepup/main`, capturing the untracked canon:
   - Constitutional layer: `GOVERNANCE_REWRITE_2026_06_10/` (Constitution + 6 siblings), `STRATEGIC_CANONICALIZATION_2026_06_10/`, `REPOSITORY_TRUTH_AUDIT_2026_06_10/`, `CONVERGENCE_AUDIT_2026_06_10/`, `CONVERGENCE_CLEANUP_2026_06_10/`, root `AGENTS.md` (AGENTS_V2, tracked-M), `CLAUDE.md`.
   - Migrations `162_phase_a_commission_zero`, `163_d2_live_data_leak_rls`, `164_d4_tenant_role_guc`, `165_d5_canonical_money_paths`, `166_d6_checkout_handoff_inventory` + their 5 rollbacks (the **highest-priority preserve** — a clean clone today has none).
   - The 22 untracked Phase-B/C/D money/identity validators + `scripts/validate-governance.mjs`.
   - `EXECUTION_LEDGER.md` + `SKIPPED_HUMAN_DECISIONS.md` (validator-required verbatim); the untracked `.github` mobile-release workflow; `scripts/dev/dev-up.sh` / `dev-backend.sh` / `identity-security-gate.mjs`.
   - Both 2026-06-10 archive trees under `docs/archive/**` (the only copies of FORENSIC_MASTER / GOVERNANCE_HARDENING / FOUNDATION_AUTOPSY etc.) + the validator-pinned `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md`.
   - This finalizes (makes durable via history) the 512 staged deletions: the 8 rejected package roots/154 files, 77 worktree-deleted theater validators, 69 worktree-deleted theater tests, 6 helm/k8s files, `packages/dart/services`, `packages/typescript/ui/src/mobile-tokens.ts`, the app-local mobile token forks — all already `^D`.

**Proof requirements:** none new (no fresh deletes here — the deletes are pre-staged and become durable). The PROOF that matters is the post-commit clean-clone check below.

**Validation gate (must pass to proceed):**
- `git status --porcelain` shows a clean tree (the `??` count drops to genuinely-ignored machine residue only).
- A **clean clone** (`git clone` + checkout, no dirty tree) contains migrations 162–166 and all 22 money/identity validators.
- `pnpm run validate:governance` PASS **from tracked files only** (not off a dirty disk) — AND the gate is green-and-honest, i.e. the unhook landed so the gate does NOT mandate `globalRegions` (binary check: `git grep globalRegions scripts/validators/` → 0).
- `ls database/supabase/migrations/16{2,3,4,5,6}_*.sql` all present and now tracked (`git ls-files` returns them).

**Roll-forward / abort:** Green → proceed to Batch 1/2/3. **The binary exit test: no `git clean -fd` can now destroy the canon (it is tracked).** If the clean-clone is missing migrations/validators, the commit was tracked-only (commit trap) — ABORT, re-do with `git add -A`. **L8 watch:** `tasks/**` (16 deleted `.md`) have NO archive copy found — confirm pure-delete-vs-loss with a human before committing that removal.

---

### BATCH 1 — PURE JUNK / CACHES / EMPTIES (zero risk, NO precondition)

**Maps to:** SAFE_DELETION Batch 1. **Laws:** none gated (none is tracked canon).

**Precondition gate:** none — these may even precede `[COMMIT]` (none is tracked canon). **Still: never as a `git clean` — delete each path explicitly.**

**Action set (delete each explicitly, ~20 paths, ~2 GB reclaimed):** `.DS_Store` ×11 (root, `database/`, `config/`, `tests/`, `docs/`, `docs/research/`, `docs/auth/`, `docs/themes/`, `load/`, `infrastructure/`, `.git/`) · `.codex-dev.log` (0 bytes) · `.codex/` (empty) · `.tmp/` + `packages/.tmp/` (empty) · `build/` (161 MB Flutter cache) · `.dart_tool/` · `test-results/` · `.pnpm-store/` · `.turbo/` (1.8 GB).

**Proof requirements:** each is gitignored junk, machine-local cache, or verified-empty. Confirm empty/0-byte/gitignored before removing (`find -name .DS_Store`, `du`, `[ -s ]`). These carry no provenance.

**Validation gate:** `git status` shows NO tracked-file changes (all were gitignored/empty); `pnpm install && pnpm run build` regenerates caches cleanly.

**Roll-forward / abort:** if any "empty" dir turns out to contain a tracked file, ABORT that path and reclassify.

---

### BATCH 2 / PHASE 1 (part) — POST-COMMIT ZERO-RISK DELETES (generated-stale + orphan validators + empties + dangling refs)

**Maps to:** SAFE_DELETION Batch 2. **Laws:** L5 (proof), L2 (the residency/replay pairs).

**Precondition gate (HALT if unmet):** `[COMMIT]` (Batch 0) done and green.

**Action set (~95 files + ~10 line/entry edits):**
- **80 generated-intelligence docs** (`docs/README.md` + ~78 `docs/<topic>/README.md` + `docs/architecture/{master-system-intelligence,README}.md`). Proof: each is stamped `<!-- GENERATED BY scripts/generate-repository-intelligence.mjs ON 2026-06-08 -->` on line 1; the generator is hard-retired (exits 1) → unregenerable falsehoods (assert `letbuyy.store`, "19 migrations" vs real 166, deleted packages, dangling `FORENSIC_REPORT/` refs). `master-system-intelligence.md` is 192,565 lines — snapshot already archived; DELETE the live copy.
- `docs/conflicts/` + `docs/future-roadmap/` (generated-README-only) + `docs/mobile-migration-blueprint/` (empty). Proof: 0 files or generated-only.
- **11 orphan validators** (`contracted-domain-event-ingress-`, `custom-domain-abuse-screening-`, `custom-domain-reconciler-`, `gateway-events-client-`, `mobile-domain-parity-`, `no-orphan-webhook-delivery-queue-`, `observability-producer-`, `registrar-provider-`, `replayable-secret-persistence-`, `shopper-identity-seam-`, `vercel-domain-automation-validator.mjs`). Proof: 0 external refs each — NOT in the `validate-governance.mjs` validator array, NOT in `package.json` scripts, NOT in `.github/workflows`; only matches are archived docs/ledgers + the generated `master-system-intelligence.md`. **Re-grep each per-item before deleting; if any is in the gate array, ABORT it.**
- `legacy/` (empty, post the committed firebase deletions) + `tests/projections/` (empty).
- `tsconfig.workspace.json:68` dangling `packages/typescript/utils` ref (target ABSENT on disk; breaks `tsc -b`) + `pubspec.yaml` `run:super_admin` melos script (targets the sourceless reserved `operator-app`).
- `config/runtime/replay-safety-contract.json` (+`.schema.json`) — proof: referenced only by the (archived) `docs/governance/replay-safety-governance.md` + an archived test + the generated intel doc; no live validator/script. **AND** the `config/runtime/identity-residency.schema.json` / `config/runtime/identity/residency.json` **PAIR** — proof: `residency.json` has no live validator/script consumer, and the schema's ONLY consumer is `residency.json` itself (`"$schema":"../identity-residency.schema.json"`). **CUT BOTH TOGETHER — deleting only the schema breaks residency.json** (L2/L5).
- `apps/storefront-runtime/src/app/demo/urban-kicks/` + `src/lib/demo/urban-kicks-demo.ts` (previous-product demo residue, live-routed) + `apps/storefront-runtime/next.config.ts` → `firebasestorage.googleapis.com` remotePattern. Proof: confirm the preview/store-service refs to `urban-kicks` are demo-only before cutting the seam.
- `config/vercel/projects.json` lines 79/94/109/124 (the 4 frozen-app project rows `letbuyy-{app-marketplace,developer-portal,theme-marketplace,platform-operations-portal}`) + frozen-app rows in BOTH staging workflows (`.github/workflows/deploy-staging.yml:99-102` + `staging-deploy.yml:189-198`). Proof: drift vs frozen/not-deployed topology (verified line numbers in both).
- `git stash@{0}` (from the deleted `stream/letbuyy-ui-v2`) — **inspect-then-drop ONLY; never `git stash pop` blind** (Rule #0).

**Proof requirements:** every DELETE above carries a cited no-consumer proof (re-grep `path:line` per item this run). If ANY live consumer is found, ABORT that item and reclassify as `KEEP (conditional)`.

**Validation gate:** `pnpm run validate:governance` PASS (esp. `repository-intelligence-validator`, `marketing-dead-twin`, `theme-editor-dead-shell`, topology validators); `tsc -b` no longer errors on the removed utils ref; `pnpm --filter storefront-runtime build` PASS.

**Roll-forward / abort:** Green → proceed. Red → STOP, report, do not silence the validator.

---

### BATCH 3 / PHASES 1–5 (part) — FINALIZE WORKTREE DELETIONS + MOBILE/UI-KIT DEAD-WEIGHT + PROMPT HARD-CUTS

**Maps to:** SAFE_DELETION Batch 3. **Laws:** L5 (no-consumer proof + same-change test edits), L7 (prompt hard-cuts).

**Precondition gate (HALT if unmet):** `[COMMIT]` done and green.

**Action set (~160 worktree-deletions finalized + ~12 fresh deletes + prompt cuts):**
- The 8 rejected package roots (already worktree-deleted; finalized by the Batch-0 commit) + `packages/dart/services` + `packages/typescript/ui/src/mobile-tokens.ts`. Proof: 0 live imports — the only `@letbuyy/{runtime-composition,…}` matches are NEGATIVE assertions in `tests/federation/*` and `tests/governance/phase-b-validators.test.mjs` asserting absence. **Add `packages/search-core` ONLY if ARB confirms** (it is present at HEAD, distributed by nature, but NOT in the 7-entry `rejectedPackageRoots` — flagged asymmetry; escalate, do not assume — `SKIP`/Unknown #7).
- 77 worktree-deleted theater validators + 69 worktree-deleted theater test files + 6 helm/k8s files (all already `^D`, now durable).
- ui_kit dup pairs (one of `empty_state.dart`/`empty_state_widget.dart`; one of `error_widget.dart`/`error_view.dart`). Proof: pick the un-exported/unused twin via a kit-surface check.
- **Mobile true-dead-weight set** WITH same-change test edits: `lib/app/deep_link_router.dart` (`AppDeepLinkRouter`, zero callers — appears only in its own definition) + the `go_router ^17.0.0` dep; `widgets/home/` duplicate twins; `widgets/shared/empty_state.dart`; `platform_blocked_screen.dart` + `lib/services/platform_blocked_service.dart`; `upgrade_screen.dart`; `splash_screen.dart`. Proof: zero inbound navigation; **deleting `deep_link_router.dart` + `go_router` REQUIRES editing the source-string tests that "protect" it in the SAME change** (L5).
- **Prompt hard-cuts (the 9 DELETE hazards, L7):** `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` (the factory — deleting it removes more drift capacity than archiving the other ~49 combined) + `CODEX_MASTER_SEQUENTIAL_MISSION.md` (orchestrator) + `CODEX_EXTENSION_PLATFORM_MISSION.md` (recreates `extension-host` + Wasm) + `CODEX_LAUNCH_PLAYBOOK.md` + the `TERMINAL_1..6_*` relaunch kit (6 files). Proof: no live consumer; their content is preserved as cautionary quotes in `PROMPT_DRIFT_ELIMINATION_PLAN.md` §3–§7. Record each as `DELETED-2026-06-10` in `PROMPTS.md`. (Archiving a paste-ready `/goal` block leaves a relaunch button one `cp` away — hence DELETE, not archive.)

**Proof requirements:** every package/validator/test/screen/prompt DELETE carries its cited proof above. Mobile deletes carry the same-change test edit. ABORT any item whose proof fails.

**Validation gate:** `pnpm run validate:governance` PASS (esp. `package-ownership`, `import-validator`, `no-rejected-package-imports`, `dart-dead-source`); `flutter analyze` PASS for merchant-app; `tests/federation/*` (assert rejected-package absence) PASS; `go_router` no longer in `pubspec.yaml`.

**Roll-forward / abort:** Green → proceed. Red → STOP and report.

---

### PHASE 1 (the head) — GOVERNANCE & DRIFT-LOCK CONVERGENCE + `[SURVIVABILITY-UNHOOK]` retarget

**Maps to:** SAFE_DELETION Batch 2/4 + the Batch-6 HEAD (the unhook retarget itself). **Laws:** L4, L6, L7, L8.

> **Note:** the `[SURVIVABILITY-UNHOOK]` *retarget* (the validator/topology/workflow edits) lands HERE (in/with the Batch-0 commit, per §5.2). The *config/doc/test DELETES it unblocks* are Batch 6 / Phase 6, after `main` is fast-forwarded. Do not delete the multi-region configs/docs here — only retarget the validators.

**Precondition gate (HALT if unmet):** `[COMMIT]` done; ARB survivability-unhook decision recorded (§5.2); `SKIP-GATE1` signed (§5.3).

**Action set:**
- **Execute the `[SURVIVABILITY-UNHOOK]` paired retarget** (one atomic change, sequenced with/before the Phase-0 commit; this is the ONLY legitimate validator-edit-to-change-coverage in the program):
  1. ARB repeal recorded against the Constitution's no-multi-region clause (governance act, no code — HALT for it if absent).
  2. Strip the `globalRegions:["india","apac","eu","us"]` asserts from `whole-repo-end-state-validator.mjs:174` (KEEP the keystone validator — remove ONLY its region loop) and from `survivability-governance-validator.mjs:94,106`.
  3. **Delete `survivability-governance-validator.mjs` wholesale** and remove `validate:survivability` + `validate:production-certification` (+ the 6 theater aliases) from `package.json` AND the 3 workflows (`architecture-governance.yml`, `production-rollout.yml`, `live-production-certification.yml`) **in the same change**.
  4. Remove `regions.globalRegions` from `config/runtime/production-topology.json`.
  5. Retarget the reserved-service manifests' `governanceDocs` off the theater docs (so archiving those docs in Phase 6 does not break the manifest contracts).
  6. Re-run `pnpm run validate:governance` → green-and-honest.
- **ARB GATE-1 ratification** recorded: `SKIP-GATE1-ARB-RATIFICATION` signed in `SKIPPED_HUMAN_DECISIONS.md`; the Constitution status line corrected from self-declared to ARB-signed (HALT if unsigned — §5.3).
- **Retarget the anti-scan validator below root** so it polices the 61 active nested `AGENTS.md` (today `no-scan-generated-agents-validator.mjs` reads only root). **Then** the nested + scan-gen root copies become REWRITE-or-DELETE (per `DOCUMENT_CONVERGENCE_PLAN`) — NEVER before the retarget (else dangling authority refs). Exactly ONE root `AGENTS.md` (= AGENTS_V2) remains.
- **Install the drift-lock:** create root `PROMPTS.md` (one `CANONICAL-EXECUTION` entry — promote `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md`; add `PROMPTS.md` to `allowedRootMarkdown`) + wire the `docs/`-wide prompt-perimeter guard into `validate:governance` (fails on any `*MISSION*/*PROMPT*/*BLUEPRINT*/TERMINAL_*` outside `docs/archive/`; requires the quarantine sentinel on archived prompts; reuses the `rejectedPackageRoots`/`reservedServiceRoots`/`extension-host`/`Wasm`/`event-bus`/`*.letbuyy.store` token lists).
- **Generated-stale tree REWRITE/DELETE** (per `DOCUMENT_CONVERGENCE_PLAN` §4): 65 `docs/<domain>/README.md` → REWRITE-to-stub (or DELETE scan-noise after human skim); 12 app + 18 package `AGENTS.md` → REWRITE (DELETE the 5 frozen/reserved-root app AGENTS: app-marketplace, developer-portal, theme-marketplace, mobile/operator-app, mobile/shopper-app); the 2 `letbuyy.store`-asserting READMEs → `letbuyy.com`. **Never re-run the generator** to "refresh" them (Never-Do #11).
- **Live self-contradiction fixes:** amend `AGENTS.md` AGENT-R16 to point at living equivalents BEFORE archiving the 2026-03-01 fossils (`tasks/todo.md`, `memory/lessons.md`); resolve `LEG-078` (which sentences `memory/lessons.md` to DELETE while AGENT-R16 mandates reading it) — HALT for the human call if it conflicts; rewrite `MERGE_RUNBOOK.md` so `SKIP-D1` sends the maintainer to the real `stepup/main → main` promotion.

**Proof requirements:** the unhook is ARB-ratified (not a janitor edit). The anti-scan retarget precedes the nested-AGENTS deletes. The perimeter guard is proven by a planted-file test (below).

**Validation gate (must pass to proceed):**
- **Gate green WITHOUT the survivability lock:** `validate-governance.mjs` green AND `production-topology.json` has no `globalRegions` block AND `git grep globalRegions scripts/validators/` → **0**.
- The anti-scan validator **fails on a planted nested `AGENTS.md`** below root; exactly ONE root `AGENTS.md`.
- The perimeter guard **fails on a planted `*MISSION*` outside `docs/archive/`**; every archived prompt carries the `ARCHIVED — REJECTED ARCHITECTURE — DO NOT EXECUTE` sentinel.
- `git grep -l "GENERATED BY scripts/generate-repository-intelligence"` → **0 tracked** live files; `repository-intelligence-validator` PASS.
- `SKIPPED_HUMAN_DECISIONS.md` shows `SKIP-GATE1-ARB-RATIFICATION` signed.

**Roll-forward / abort:** Green-and-honest → proceed. If the gate is green only because a self-block was re-introduced or a check was silenced, that is a FALSE pass — STOP and report.

---

### BATCH 4 / PHASE 1 (part) — ARCHIVE MOVES (historical value → `docs/archive/`)

**Maps to:** SAFE_DELETION Batch 4. **Laws:** L2 (archive-before-delete), L8 (precedence amendments first).

**Precondition gate (HALT if unmet):** `[COMMIT]`; for `docs/agents/`, `tasks/todo.md`, `memory/lessons.md` ALSO amend the precedence/AGENT-R16 wiring first (done in Phase 1 head).

**Action set (~200 files MOVED via `git mv`, not deleted; + the already-untracked 865-file `docs/archive/*-2026-06-10/` trees whose action was the Batch-0 COMMIT):** `docs/Codex_waves/` remainder → `docs/archive/codex-waves-2026-06-10/` (the WS UX missions + both blueprints + GraphQL/dev-ecosystem/theme-block/marketplace/operations/hardening/env/mobile missions — the ~41 ARCHIVE-quarantine set) · `docs/audit/` (19) · `docs/audits/apps-platform/` (23) · `docs/agents/` (40, after precedence check) · `docs/commerce-os-audit/` (10) + `docs/analysis/` (4) · the docs-root prompt/plan family + ~25 superseded master audits + `docs/LETBUYY.md` · the frozen-app mission families (`docs/{apps-marketplace,themes-marketplace,developer-platform}-audit/` mission files, `docs/internal-operating-system-audit/mission/`) · the 4 root business binaries (2 `.pptx` + 2 `.xlsx`) → `docs/archive/root-governance-2026-06-10/` · `tasks/todo.md` + `memory/lessons.md` (after amend) · `apps/developer-portal` + `apps/platform-operations-portal` (ARCHIVE only after the consolidation/ops-survivor decisions — Phase 6; HALT for `SKIP-GATE-OPS-SURVIVOR-ARB`).

**Proof requirements:** prepend the verbatim quarantine header (or a cluster `README.md` the guard recognizes) to every archived prompt/mission. Confirm no LIVE import resolves into a moved path before moving.

**Validation gate:** `pnpm run validate:governance` PASS (esp. `route-line-count`/`allowedRootMarkdown` budget, `no-scan-generated-agents`, the new perimeter guard); confirm no live import resolves into a moved path.

**Roll-forward / abort:** Green → proceed. If a move breaks an import, ABORT the move and reclassify as KEEP.

---

### PHASES 2–5 — IDENTITY / MONEY / THEME / MOBILE convergence (duplicate-writer collapse; capability gaps NAMED only)

**Maps to:** SAFE_DELETION Batch 3 (post-commit, gated) + Batch 5 (the `[WINNER-DEPLOYED]`-gated loser deletes). **Laws:** L3, L5, L6, L8. **These four phases each collapse the duplicate writer/surface that convergence CAN reach, retarget the validator so the gap becomes visible, and STOP at a named `∥` capability gap.** They are convergence-PARTIAL — do NOT cross the capability boundary.

**Precondition gate (HALT if unmet):** `[COMMIT]` done; each loser-delete additionally gated as stated.

**PHASE 2 — Identity** (Decision 2; winner = identity-platform asymmetric sole issuer):
- Retarget the gateway to verify-only against env-injected JWKS (`identity-session-verifier.ts`, now committed); consolidate the ≥4 cookie-realm authorities + 2 CSRF cookie names to one canonical name (L6).
- **DELETE_AFTER_MIGRATION (gated on the `IDN-R2` dual-verify drain showing zero legacy-HS256 verifications):** gateway `randomHex(32)` mint (`auth.ts:1140`) + the `/api/auth/switch` mint branch. **Do NOT delete before the drain telemetry proves zero legacy verifications** (L3). The dev-only `localAuthSessions` Map is SAFE_DELETE (dead in prod).
- **DELETE_AFTER_MIGRATION (gated on identity-platform serving verify-only live, `IDN-R3`):** the 18-file `services/api-gateway/src/identity-foundation/` shadow stack.
- **`∥` OUT OF SCOPE — escalate, do not build:** live identity keypairs/JWKS (`SKIP-D3` — without them the asymmetric topology fails closed in prod); step-up real crypto (a self-served `mock-step-up-${uuid}` guards refund/payout/DSR-erase — convergence only stops the validator allowlisting the mock once a real path exists); OIDC (501 skeleton); per-realm HS256 re-home (4 realms still HS256); JWT revocation.
- **Gate:** dual-verify telemetry = zero legacy-HS256 for the drain window before any mint-path delete; after delete: `git grep "randomHex(32)"` in the session-mint path → 0, `/api/auth/switch` has no mint branch, `identity-foundation/` gone, `identity-sole-issuer-validator` PASS with the allowlist drained.

**PHASE 3 — Money** (Decision 3/11/12/13; winner = canonical append-only ledger):
- Make the committed authority operative (migs 160/162/165 landed at Phase 0): retarget `wallet.ts` reads to derive from the canonical ledger; **demote** `wallet_ledger_entries`/`payout_statements`/`commission_*` (mig 119) + the mini-ledgers to **read-only projections** (L6 — NOT deleted; they back the wallet read until zero-drift). Remove the `razorpayx` self-custody DEFAULTS (the Phase-0 commit removed them).
- **Retarget `canonical-ledger-only-validator`** to see SQL-side writers and add `orders`/capture to its ratchet list — so the capture gap stops being invisible to the gate. **This visibility IS the convergence success on capture — closure is OUT OF SCOPE.**
- **DELETE_AFTER_MIGRATION (demote-then-delete, L3+L5; live writer probe required — HALT per Never-Do #7):** mutable `wallet_ledger_entries`/`payout_statements`/`commission_*` *as truth source* — gated on 160/162/165 committed + reconciliation refreshers wired to a scheduler + zero-drift proof (`SKIP-D5`) + backfill + a live writer probe. The never-consumed `scheduled` `payouts` instruction rows + the `orders.total`-derived gross — gated on ARB picking the surviving writer per flow. The razorpayx enum/CHECK residue (~8–11 sites) — gated on an enum-purge migration after the commit.
- **`∥` OUT OF SCOPE — escalate, do not build:** storefront/webhook capture ledgering (`confirm_order_payment_with_ledger` posts 0 canonical ledger lines on the path every shopper hits, in all 3 realities — **the #1 unfinished winner**); payout provider client (`initiateTransfer` throws `PayoutProviderUnavailable` in every plane; no `PayoutProviderClient` exists); reconciliation wiring (refreshers have 0 callers; wallet 409s forever); 2/3 refund-path ledgering + `merchant_payable` cross-source dedup; the settlement executor. **`SKIP-D5`; the mig-162 in-place commission-history rewrite is an ARB call — HALT (`SKIP`/Unknown #7/#8).**
- **Gate:** a clean clone applies 160/162/165; `commission-bps-zero-validator` PASS; the canonical ledger has UPDATE/DELETE revoked from `service_role` (mig 165 REVOKE live); `canonical-ledger-only-validator` now *reports* the storefront capture writer (gap VISIBLE, not silently passing); committed default commission is 0 bps (no `?? 300` anywhere; DB default not 300).

**PHASE 4 — Theme** (Decision 1; winner = Liquid, React FROZEN-not-deleted):
- Collapse the schema/compose forks (commit-gated, independent of the renderer gate): retarget the ~10 runtime-only schemas from storefront `RUNTIME_SECTION_SCHEMAS` (`renderer-registry.tsx`) into the engine `SECTION_SCHEMAS`; retarget the Liquid render plan/canary out of `template-resolver.ts` into the engine `composeStorefrontTheme`. Make the committed DOMPurify + LiquidJS auto-escape the deployable sanitizer (replaces the 3-regex path). De-duplicate the split `FEATURE_LIQUID` switch to one authority.
- **NOT deletable now (Batch 5, `[WINNER-DEPLOYED]` + the 8-part Liquid parity gate + ARB flip):** the React renderer + 20 frozen sections + `marquee.tsx`. `no-new-react-sections-validator` KEEPS freezing React — **deleting React now blanks every storefront (S0-grade self-harm)** (L3). Liquid has no header/footer, binds no commerce data, is `index`-only, has no write path/editor.
- **`∥` OUT OF SCOPE — escalate, do not build:** Liquid chrome + data binding + full templates + canary write path + editor (the React-deletion prerequisite; the platform-wide flip is ARB-deferred); the 5-of-24 fallback-box section types.
- **Gate:** engine is the single schema + compose source (`git grep "RUNTIME_SECTION_SCHEMAS"` → 0 after migration); deployable sanitizer is DOMPurify; `no-new-react-sections-validator` still freezes React (proving L3 honored); one `FEATURE_LIQUID` authority.

**PHASE 5 — Mobile** (Decision 10a/10b/10c; winner = Navigator + composite mobile-bff + ui_kit tokens):
- SAFE_DELETE items already done in Batch 3 (GoRouter, home twins, token forks, with same-change test edits). Retarget the analytics screen onto the composite BFF `/v1/mobile/dashboard` once the BFF field set covers it, then collapse the 5-call gateway fan-out (L6). Retarget the 5 forked dart models to `packages/dart/models`; delete the app-local shims.
- **DELETE_AFTER_MIGRATION (Batch 5):** the mobile theme-editor pair (`customize/theme_screen.dart` 631L + `editor/section_editor_screen.dart` 1,200L + 12 `widgets/editor/*`) — gated on an **ARB wire-or-delete decision** (L8) + rewriting the 42 protecting source-string tests. The 34 dead capability screens (KYC/2FA/returns/inventory/coupons/gift_cards/…) + 36 `/features/*` routes — gated on a per-screen wire-vs-delete PRODUCT decision (KYC/2FA/returns invisibility is a product gap, not classic dead code).
- **`∥` OUT OF SCOPE — escalate, do not build:** mobile login Turnstile double-spend (the app pre-verifies the single-use token at the BFF, then submits the SAME token to identity login → `timeout-or-duplicate` → login fails closed; a bug fix, not a convergence delete — `SKIP-W7`); the store-publish pipeline.
- **Gate:** `flutter analyze` + `flutter test` green; one navigation system (Navigator); the editor ARB decision recorded and executed; the 5 model forks resolve to `packages/dart/models`.

**Proof requirements (all four phases):** every loser-delete carries its cited no-consumer proof AND its gating condition (`[WINNER-DEPLOYED]` / drain telemetry / ARB / live writer probe). Mobile/identity deletes carry same-change test edits. ANY dead-table DROP → HALT (Never-Do #7).

**Roll-forward / abort:** each phase's gate must pass; capability gaps are recorded as `∥ BLOCKED` and escalated, never crossed.

---

### BATCH 5 / PHASE 6 — DEPLOYMENT CONVERGENCE (fast-forward + trace-gated second-backend retirement)

**Maps to:** SAFE_DELETION Batch 5. **Laws:** L3, L6.

**Precondition gate (HALT if unmet):** `[COMMIT]` + the Phase-1 unhook executed + `SKIP-GATE1` signed; for the second-backend deletes ALSO the per-page call-graph trace (HALT if absent — § STOP CONDITIONS) + `[WINNER-DEPLOYED]`.

**Action set:**
- **Fast-forward `main`** to the committed-and-ratified `stepup/main` (`SKIP-D1`, a privileged clean-tree merge — HALT for `SKIP-PROD-DEPLOY-PROMOTION` / branch protection). **This is the act that finally deploys the hardened truth.** Forbidden to fast-forward before the unhook + ratification (deploying a gate that certifies the rejected topology — Never-Do #3 at deploy scope).
- Collapse the matrices: cut the frozen-app rows from BOTH staging workflows + `config/vercel/projects.json` (if not already in Batch 2); align the production matrix to the lean 6-Vercel-app + 4-worker topology.
- **TRACE-gated second-backend retirement (L6):** per-page call-graph trace, then proxy-or-port + contract tests, then delete the merchant-control-plane **62** `/api/**/route.ts` + storefront-runtime **21** routes. **`gift-cards` must be PORTED, not proxied** (single-writer in the wrong runtime — no gateway mount). The gateway `portfolio.ts`/`resume.ts` + mounts (`index.ts:738-739`) + BFF allowlist (`index.ts:44-45` `/v1/portfolio`,`/v1/resume`) — DELETE_AFTER_MIGRATION gated on the `SKIP-D11` live writer probe + ARB "non-store site types are dead" decision (HALT for both).
- **ARCHIVE (after decision):** `apps/developer-portal` (ARB consolidation) + `apps/platform-operations-portal` (port unique modules to `platform-console` first — `SKIP-GATE-OPS-SURVIVOR-ARB`). Frozen-app SOURCE (`app-marketplace`/`theme-marketplace`) stays KEEP — only the deploy rows are cut (the gateway still serves their endpoints).

**Proof requirements:** the call-graph trace is the hard gate for every route deletion (no UI page may call a deleted route — contract tests green). The fast-forward depends on commit + unhook + ratification all complete.

**Validation gate:** `git rev-list --count main..stepup/main` → **0** (branch lag closed; `main` is the deployed truth); no frozen-app in any staging workflow or `projects.json`; after the trace + cutover, no UI page calls a deleted MCP/storefront route (contract tests green); `one-system-per-domain-validator` PASS (gateway is the single commerce backend); plus production smoke (storefront renders; merchant UI all CRUD paths green).

**Roll-forward / abort:** Green → proceed. If a route turns out to be called by a live page, ABORT its deletion (the trace was wrong). Red gate → STOP and report.

---

### BATCH 6 / PHASE 6 — SURVIVABILITY / MULTI-REGION / CHAOS / LOAD / CERTIFICATION UNHOOK (execute the deletes the retarget unblocked)

**Maps to:** SAFE_DELETION Batch 6 — the highest-risk batch (the GATE-1 self-block). **Laws:** L4 (the deletes the Phase-1 retarget unblocked execute here).

**Precondition gate (HALT if unmet):** `[SURVIVABILITY-UNHOOK]` retarget fully executed in Phase 1 (the gate no longer mandates `globalRegions`) + `main` fast-forwarded. **Do NOT delete any of these BEFORE the Phase-1 retarget made them safe — deleting them while the validators still assert them FAILS the gate (the self-block).**

**Action set (~60 artifacts, as one ARB-ratified change set):**
- `config/runtime/{multi-region-runtime,survivability-execution,observability-platform}.json` (+schemas) — **split `observability-platform.json`'s real prometheus rules into a non-theater validator FIRST**, then delete; the `production-topology.globalRegions` block (already stripped at Phase 1); the ~15 1–2-consumer distributed `config/runtime/*` contracts (`convergence-invariants`, `distributed-consistency-contract`, `durable-execution-contract`, `failure-domain-manifest`, `runtime-causality-graph`, `replay-branch-registry`, `projection-recovery-manifest`, …) — **each ONLY after its single consuming validator retires** (rides the unhook).
- `chaos/` + `load/` (existence was validator-mandated by `survivability-governance-validator.mjs:20-23,152-153`, now deleted) + `infrastructure/scripts/{operations,load,chaos}/` certification suite.
- The 10 `validate:production-certification` validators + `operational-proof-validator.mjs` + `production-certification-common.mjs` (the 10 import the common) + the 6 theater aliases + the `validate:rollback` alias (only after a real rollback validator exists, else KEEP).
- The 13 contradicting + 4 validator-required `docs/governance/*` theater docs (`multi-region-runtime-`, `failover-`, `chaos-`, `runtime-composition-`, `distributed-execution-survivability-`, `replay-safety-`, `operational-resilience-`, `deployment-proof-`, `deterministic-runtime-`, `infra-recovery-governance.md`, …) + 6 theater runbooks (`docs/runbooks/{regional-failover,survivability-suite,infra-recovery,chaos-drill,event-replay,live-certification-execute}.md`). **ARCHIVE these (L2) — `git mv` to `docs/archive/governance-theater-2026-06-10/`, do not hard-delete** (the untracked archive copies of 37 of them already exist — confirm and commit). Retarget any reserved-service manifest `governanceDocs` off them FIRST (done in Phase 1 step 5).
- `tests/{chaos,survivability,replay,queues,operations,production-certification,cloudflare}`.

**Proof requirements:** every config/contract delete is gated on its consuming validator being retired first. Every governance/runbook with historical value is `git mv`'d, not deleted (L2). The split of real prometheus rules out of the theater config precedes the config delete.

**Validation gate:** `pnpm run validate:governance` PASS **after** the validator-strip; no reserved-service manifest `governanceDocs` references a moved doc; `git grep globalRegions scripts/validators/` → nothing; `git grep -l "globalRegions\|failoverPairs\|multi-region" config/` → 0.

**Roll-forward / abort:** Green → proceed. If a delete fails the gate, it means a validator still asserts that artifact — the retarget was incomplete; STOP, complete the retarget under ARB, do NOT silence the assertion.

---

### PHASE 7 — PRODUCTION READINESS (human seams; live-DB-gated deletes; NAME the alerting gap)

**Maps to:** no new batch; the live-DB-gated `SKIP-D11` deletes execute here after probes only a human with DB access can run. **Laws:** L5, L8.

**Precondition gate (HALT if unmet):** Phases 0–6 complete and green; live-DB probes run by a human (you cannot run them).

**Action set (seam resolution + naming — NO features):**
- Resolve (or badge-defer with blast radius) the launch-blocking `SKIP-*` subset: `SKIP-D1` (the merge), `SKIP-D3` (identity live keys/JWKS/OIDC/Turnstile), `SKIP-PROVIDER-SECRETS` (the prod wrangler placeholders), `SKIP-PROD-DNS-CUTOVER`/`SKIP-W3-DNS-CUTOVER` (`.com` resolution), `SKIP-D6` (checkout cutover), `SKIP-PROD-DEPLOY-PROMOTION` (branch protection), `SKIP-D2`/`SKIP-D4` (live RLS/grant/FORCE probes), `SKIP-D5` (live money reconciliation), `SKIP-W0-PITR`. **HALT and escalate each — these are human-only; never fake-complete.**
- **Live-DB-gated deletes (L5; HALT per Never-Do #7 — a human runs the probe):** dead product-era tables (`portfolio_projects`/`resume_versions`/`gallery_items`/`skill_endorsements`) + the `sites.site_type` enum shrink; the duplicate `provider_payment_id` index (107-vs-142); the 25 residual PUBLIC `USING(true)` policies. **You do NOT DROP these — you escalate with the probe named.**
- Retarget the observability config theater to the real Cloudflare Analytics Engine dataset OR archive the Grafana/SLO/prometheus JSONs pointing at deleted k8s / empty reserved roots.

**Proof requirements:** every DB-level delete is gated on a human-run live writer/policy/index probe — you escalate, you do not execute. The Sentry DSN seam (`SKIP-W3`) is MOOT without an error SDK — name it; do not claim "alerting provisioned."

**Validation gate:** `SKIPPED_HUMAN_DECISIONS.md` shows every launch-blocking seam signed/provisioned or explicitly badged-deferred with blast radius; the observability config no longer references a deleted cluster/empty reserved root; a written go-live gate ENUMERATES the named capability prerequisites as out-of-convergence builds.

**Roll-forward / abort:** convergence is complete here regardless of the capability gaps; the platform is NOT declared launch-ready until those ship.

---

### PHASE 8 — CONVERGENCE VERIFICATION & ONE-REALITY LOCK (see § Final Self-Audit)

The verification phase is the Final Self-Audit (§9). Run it as the last step.

---

## 8. Capability-Gap Out-of-Scope Register (NAME and escalate; NEVER build, fake, or claim closed)

These survive ANY commit, ANY merge, ANY secret. **A delete does not fix any of them.** Your ONLY legitimate contributions are convergence-legitimate: COMMIT their authority migrations (160/162/163/164/165/166), RETARGET the validators so the gap becomes VISIBLE, and NAME the build as the BLOCKED prerequisite. You design nothing here; you escalate.

| # | Gap (named, not designed) | Phase | Why out of scope / what you may legitimately do |
|---|---|---|---|
| 1 | **Storefront/webhook capture ledgering** — `confirm_order_payment_with_ledger` posts 0 canonical ledger lines on the path every shopper hits, all 3 realities | 3 | The #1 unfinished winner. You may retarget `canonical-ledger-only-validator` to SEE the SQL writer (visibility); you may NOT wire the posting. |
| 2 | **Payout provider client** — `initiateTransfer` throws; no `PayoutProviderClient` in any branch | 3 | Merchants can never be paid until built. Escalate. |
| 3 | **Reconciliation wiring** — refreshers have 0 callers; wallet 409s forever | 3 | Commit lands the kernel; the scheduled caller + operator-clear action is a build. Escalate. |
| 4 | **2/3 refund-path ledgering + `merchant_payable` cross-source dedup** | 3 | Reversing entries + dedup are builds. Escalate. |
| 5 | **Settlement executor + cross-source dedup** | 3 | The execution side is a build; the writer choice is ARB. Escalate. |
| 6 | **Step-up real crypto** — a self-served mock token guards refund/payout/DSR-erase | 2 | You may stop the validator allowlisting the mock once a real path exists; you may NOT build TOTP/passkey/re-auth. |
| 7 | **Per-realm HS256 re-home + JWT revocation + OIDC** — `oauth2/*` is a 501 skeleton; 4 realms still HS256 | 2 | Commit lands the merchant issuer; re-keying + revocation + OAuth are builds. Escalate. |
| 8 | **Live identity keypairs/JWKS** — unprovisioned (`SKIP-D3`) | 2 | Human seam — the asymmetric topology fails closed without them. HALT/escalate. |
| 9 | **Liquid chrome + data binding + full templates + canary write path + editor** — the ratified winner cannot run a real store | 4 | The React-deletion prerequisite. React stays FROZEN. Designed nowhere here. |
| 10 | **Mobile login Turnstile double-spend** — same token spent twice → login fails closed | 5 | A bug fix, not a convergence delete (`SKIP-W7`). Escalate. |
| 11 | **Alerting end-to-end** — no metric emitters, no error SDK, no delivery channel; the Sentry DSN seam is moot without them | 7 | Name it as a launch blocker; do NOT claim "alerting provisioned" off a DSN. |
| 12 | **RT-1…9 `withTenantTx` adoption proof + raw-REST parity** — commit lands mig 163/164 | 1/6 | The red-team adoption proof + raw-REST removal are builds. Escalate. |

**The four hardest gates are the real critical path: capture ledgering (1), reconciliation wiring (3), payout client + executor (2/5), and Liquid chrome (9).** The money path (1 + 2/5 + 3 + 4) cannot complete by convergence. **You record these as the explicit go-live backlog and STOP.**

---

## 9. Final Self-Audit & One-Reality Lock (the Phase-8 binary exit test)

> **RULE #0 reminder for the close-out:** confirm one last time that no discard command was ever run and the canon is tracked. The exit test below is the proof.

Run this as the last step. Convergence is **Complete when, and ONLY when, ALL of the following hold simultaneously.** If ANY fails, convergence is NOT complete — record the failure and STOP.

1. **One reality (branch + commit).** `git rev-list --count main..stepup/main = 0`; the committed-and-ratified hardened working tree is what `main` deploys; the triplication has collapsed (`main` = `stepup/main` = the committed tree). **No `git clean -fd` can destroy the canon, because it is tracked** (the binary Rule #0 exit test).
2. **One law, no self-block.** `pnpm run validate:governance` is **green WITHOUT any multi-region/survivability/`globalRegions`/failover/replay/chaos/CQRS assertion** in any validator or config — `git grep -l "globalRegions\|failoverPairs\|multi-region\|survivability" scripts/validators/ config/runtime/` → **0**. A green gate MEANS "conforms to the Constitution," permanently. GATE-1 is ARB-signed (not self-declared). **The gate is green because it is honest, NOT because a check was silenced** — verify the absence of the self-block, not merely a green run.
3. **One owner per domain.** `one-system-per-domain-validator` PASS. For EVERY domain the winner is the SOLE owning system/route/writer/issuer/ledger/token-source/renderer-canonical/ops-console: the gateway is the single commerce backend (no MCP/storefront second-writer route survives the trace); identity-platform is the sole issuer (`identity-sole-issuer-validator` PASS, allowlists drained); the canonical ledger is the single money truth (mutable model demoted to projection); one design-token source; one theme schema + compose source; one renderer-canonical (Liquid) with React FROZEN-not-deleted; one ops console. **No domain carries two writers/issuers/ledgers/surfaces/consoles "as a fallback."**
4. **One prompt perimeter.** `PROMPTS.md` is the single registry with exactly ONE `CANONICAL-EXECUTION` entry; the `docs/`-wide guard turns the gate red on any `*MISSION*/*PROMPT*/*BLUEPRINT*/TERMINAL_*` outside `docs/archive/`; every archived prompt carries the quarantine sentinel; the generator stays hard-retired (`repository-intelligence-validator` PASS; `git grep -l "GENERATED BY scripts/generate-repository-intelligence"` → 0 tracked).
5. **One honest boundary.** The residual capability builds (capture ledgering, payout client + executor, reconciliation wiring, step-up crypto, Liquid chrome, mobile login, alerting) are recorded as the explicit go-live backlog. **Convergence is complete, but the platform is NOT declared launch-ready until those ship.**

**Record a convergence-completion attestation** confirming, per domain, that exactly one owner remains (or that the only residual is a named `∥` capability gap), cross-checked against the 14-winner registry and the 22-domain SoT table. **Record a drift-prevention attestation:** PROMPTS.md live (one canonical entry); the `docs/`-wide guard wired; the survivability/multi-region assertions absent from every validator; the generator retired; `main` = `stepup/main`. **Carry the residual capability-gap ledger forward as the go-live backlog.**

At that point the eight Cleanup Laws' execution clauses are DISCHARGED; the authority restatement and the Drift-Prevention Regime persist as standing governance.

---

## 4.1 — Authority Chain (resolves any conflict, including between this prompt and a report)

On ANY conflict, the lower ordinal wins (1 is supreme). Nothing in the repository outranks this:

1. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (DOC 01) — SUPREME: architecture, money/identity/tenancy invariants, scale envelope, Never-Build List. (Carries V1 + Freeze as Articles ART-01…ART-24; cite V1/Freeze as competing authorities is forbidden.)
2. Root `AGENTS.md` (= `LETBUYY_AGENTS_V2`, DOC 02) — the operating rulebook (the `ARCH-R*`/`SEC-R*`/`PAY-R*`/`IDN-R*` rules).
3. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03) — the winner registry (one system per domain).
4. `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md` + `LETBUYY_FOUNDATION_ROADMAP.md` (DOC 04/05) — how/when convergence happens. **THIS prompt is procedural law co-planar with DOC 04/05** — it states the rules of the convergence those documents sequence; it never outranks substance.
5. `LETBUYY_UI_UX_GOVERNANCE.md` + surviving retargeted `docs/governance/*` (DOC 06).
6. The evidence base (the eight Convergence Cleanup reports + prior audits) — the "why," NOT authority. Where law and evidence disagree on a FACT, the law is wrong on that fact and must be amended; where they disagree on what is canonical, the law governs.

**If this prompt and a report disagree, this prompt's PROCEDURE governs the execution; the report's SUBSTANCE (a winner, a path:line) governs the fact — and DOC 01–03 govern both. If a procedure here would violate DOC 01 (e.g. building a capability gap, certifying multi-region), DOC 01 wins and you HALT.**

---

## 10. Evidence Base (the eight reports — read for context; operative rules are inlined above)

All in `CONVERGENCE_CLEANUP_2026_06_10/`. Each batch above cites the report grounding it.

1. **`REPOSITORY_FORENSICS_REPORT.md`** (Phase 1) — the 31-row duplication ledger; the self-block exact lines; the 917 `getSupabaseAdmin` / 62 MCP-route / 79 nested-AGENTS counts; temporal triplication.
2. **`STRATEGIC_WINNERS_FINAL.md`** (Phase 2) — the 14 winners (0 overturns), the Loser Registry with each loser's removal-blocking condition, the four capability-gated losers, the Unknowns.
3. **`SINGLE_SOURCE_OF_TRUTH_MASTERPLAN.md`** (Phase 3) — the 22 domains, each with Current Sources / Target SoT / Convergence Path / Deletion Candidate / Risk / Blocking Dependencies; the 4 buckets.
4. **`SAFE_DELETION_PLAN.md`** (Phase 4) — the KEEP/ARCHIVE/DELETE taxonomy, the per-artifact tables, the Dangerous-to-Delete Watchlist, and **Batches 0–6** (the ordering this prompt drives).
5. **`DOCUMENT_CONVERGENCE_PLAN.md`** (Phase 5) — the document-granular KEEP/ARCHIVE/REWRITE/DELETE cut; the 97-file generated-stale tree; the ARCHIVE-needs-COMMIT list.
6. **`PROMPT_DRIFT_ELIMINATION_PLAN.md`** (Phase 6) — the 9 DELETE hazards, the ~41 ARCHIVE-quarantine set, the verbatim quarantine header, the PROMPTS.md + perimeter-guard requirements, the prompt-factory deep-dive.
7. **`GOVERNANCE_CONSTITUTION.md`** (Phase 7) — the Authority Chain, the eight Cleanup Laws L1–L8 (restated operationally in §6), the Drift-Prevention Regime, the conflicts-resolved table.
8. **`LETBUYY_CONVERGENCE_EXECUTION_MASTERPLAN.md`** (Phase 8) — Phases 0–8 with per-phase precondition/inputs/outputs/risks/validation-gates/exit-criteria; the dependency graph; the capability-gap boundary; the binary one-reality exit test.

Substantive authority defers throughout to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` (AGENTS_V2) → `LETBUYY_CANONICAL_SYSTEMS.md`.

---

*End of the Codex Repository Convergence Execution Prompt (Convergence Cleanup Program, Phase 9). This file is the executing agent's complete, self-contained operating order. It encodes Rule #0 (never discard the working tree), the Things-You-Must-Never-Do list, the Stop-Conditions/Escalate-to-Human list, the three authority gates (with the pivotal unhook-before/with-commit sequencing), the eight Cleanup Laws operationally, the gated Batches/Phases 0–8 (each: precondition → actions → proof requirements → validation gate → roll-forward/abort), the Capability-Gap Out-of-Scope register, and the binary one-reality exit test. Authoring it executed nothing — no code, schema, migration, commit, deletion, archive-move, validator-retarget, or git mutation was performed; read-only git was used only to re-verify the operative facts inlined here. Baseline pinned at `stepup/main` @ `c4fc3cd6`, working tree dirty (512 D / 410 M / 79 ??), 2026-06-10.*
