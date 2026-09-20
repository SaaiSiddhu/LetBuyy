# LETBUYY FINAL CONVERGENCE — CODEX EXECUTION PROMPT

> **This is the single, self-contained prompt for executing the LetBuyy Final Convergence Program.**
> You (Codex) receive no other guidance. Everything you need is here or in the five authoritative plan documents named below. Read this prompt fully before acting.

---

## PLACEMENT, REGISTRATION & SELF-CONSISTENCY (read first — failing this bricks the gate you must keep green)

- This prompt file lives at `FINAL_TRUTH_AUDIT_2026_06_11/LETBUYY_FINAL_CONVERGENCE_CODEX_EXECUTION_PROMPT.md`. **Do not move it to the repository root** — `scripts/validators/whole-repo-end-state-validator.mjs` allowlists exactly nine root markdown files and any tenth fails the gate.
- This file's basename contains `PROMPT`, so `scripts/validators/prompt-perimeter-validator.mjs` polices it: every tracked `*PROMPT*` / `*MISSION*` / `*BLUEPRINT*` markdown outside `docs/archive/**` **must** be registered in `PROMPTS.md` as a `CANONICAL-*` row, or the gate fails.
- **Checkpoint A0 (your very first action) registers this prompt** in `PROMPTS.md` as a new `CANONICAL-EXECUTION` row pointing at this exact path. **Leave the existing row** `CONVERGENCE_CLEANUP_2026_06_10/CODEX_FOUNDATION_STEPUP_MASTER_EXECUTION_PROMPT.md` registered as canonical — the validator hardcodes that path as required-canonical (`prompt-perimeter-validator.mjs` const `canonicalExecutionPrompt`). You may only demote/retarget that old row in **Phase D2**, and only by editing the validator constant in the same change so the gate stays green.
- After registration, run the gate (Section 9 command). If it is not green, fix the registration before doing anything else.

## AUTHORITATIVE PLAN DOCUMENTS (execute these; never redesign them)

1. `FINAL_TRUTH_AUDIT_2026_06_11/REALITY_PROMOTION_IMPLEMENTATION_PLAN.md`
2. `FINAL_TRUTH_AUDIT_2026_06_11/MONEY_UNIFICATION_IMPLEMENTATION_PLAN.md`
3. `FINAL_TRUTH_AUDIT_2026_06_11/LIQUID_CONVERGENCE_IMPLEMENTATION_PLAN.md`
4. `FINAL_TRUTH_AUDIT_2026_06_11/FINAL_DUPLICATE_ELIMINATION_IMPLEMENTATION_PLAN.md`
5. `FINAL_TRUTH_AUDIT_2026_06_11/LETBUYY_FINAL_CONVERGENCE_MASTER_PROGRAM.md`

Supporting truth: `FINAL_TRUTH_AUDIT_2026_06_11/LETBUYY_FINAL_REPOSITORY_TRUTH_REPORT.md`. Governing law (higher authority than this prompt): `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → relevant local `AGENTS.md`. Operational registries you must keep truthful: `EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`, `CAPABILITY_BACKLOG.md`, `MERGE_RUNBOOK.md`.

**Conflict rule:** if this prompt and a plan document disagree, the plan document wins. If a plan and the Constitution/AGENTS.md disagree, the Constitution/AGENTS.md wins. Never resolve a conflict by inventing a third option.

**Repository coordinates at program start:** `HEAD = 3da1416c`, `main == stepup/main` (clean tree), `origin/main == origin/develop == c2547049` (127 commits behind — the condemned reality). The gate passes on the current tree. Your job is to execute Phases A–F so the converged reality is promoted, money is one ledger, Liquid is the runtime winner, duplicates are gone, the repo is certified single-reality, and only then capability is built — without ever violating the rules below.

---

# SECTION 1 — MISSION

Drive LetBuyy from "converged in a local branch" to **ONE REALITY**, defined as four simultaneous truths:

1. **One Reality** — the converged tree (`3da1416c` lineage) is the deployed tree; `origin/main` no longer ships the account-takeover `/api/auth/switch`, the 3% rake, or the missing migrations 160–167. The governance gate runs inside the deploy pipeline.
2. **One Money System** — every path money can move (capture, refund, COD, settlement, payout, gift-card, AI-credit) posts balanced, append-only, idempotent entries to the **canonical ledger**. No mutable balance is truth. No second ledger, wallet, or settlement system exists.
3. **One Theme Runtime** — **Liquid** renders production storefronts; React is removed only after 100% capability + rendering + snapshot + editor parity is *proven*. Until then React stays frozen.
4. **One Authority** — a single law chain (Constitution → AGENTS.md → Canonical Systems), one prompt registry, one validator suite with teeth, no diverged law copy, no frozen-app deploy shape, no ghost config.

You succeed when Phase E certifies single-reality and Phase F has switched on real capability behind honest human seams. Convergence ≠ capability; keep that distinction honest at all times.

---

# SECTION 2 — CODEX OPERATING RULES

**You MAY:** implement code that a plan specifies; refactor toward a ratified winner; add/strengthen validators and tests; run validators, tests, typecheck, lint; remove a loser **after** its replacement is proven (Section 8); update `EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`, `CAPABILITY_BACKLOG.md` truthfully; commit each proof-gated step.

**You MUST NOT (hard prohibitions — violating any one is a full stop):**
1. Invent architecture, write an alternative plan, or "improve" a plan's design.
2. Introduce a new service, microservice, CQRS, event sourcing/event store, read-model projection runtime, saga orchestrator, extension/Wasm runtime, or marketplace architecture. (All are constitutionally rejected.)
3. Activate any reserved service (`services/checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`) or reserved mobile app — they stay manifest-only (exactly 2 files each).
4. Un-freeze the React section renderer, add a new React section, or delete React before the Section 7 parity proof.
5. Resurrect a deprecated app alias (`apps/admin|auth|checkout|internal|merchant|storefront|analytics`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`) as active topology.
6. Override, edit-to-weaken, or contradict the Constitution or AGENTS.md.
7. Run `git clean`, `git reset --hard`, blanket `git restore`/`git checkout -- .`, or any command that discards the working tree. (Cleanup Constitution Rule #0.)
8. Push `main` to the protected remote, change branch protection, mutate DNS, or provision any secret/credential yourself — those are `[SKIPPED-HUMAN]` (Section 10).
9. Fabricate a result, a passing test, a live-provider success, an ARB signature, or a "DONE" status.
10. Delete without proof, or mass-delete (Section 8).
11. Add a tenth root markdown file, or leave a `*PROMPT*` file unregistered in `PROMPTS.md`.
12. Continue past the Section 11 stop conditions, or audit indefinitely.

If any instruction would require breaking a prohibition, **stop and record a `[SKIPPED-HUMAN]` or `[BLOCKED]` row instead.**

---

# SECTION 3 — PROGRAM ORDER (never skip a phase)

Execute strictly in this order. A is the root dependency; B and C may run in parallel **only** after A's gate G4 and only because they touch disjoint files (Section file-ownership rules). D runs after B and C settle their files. E certifies. F builds capability last.

```
A  Reality Promotion        → gate G4 (one deployed reality)        [blocks everything]
B  Money Unification        ∥  C  Liquid Convergence                [after G4, disjoint files]
D  Final Duplicate Elimination                                      [after B & C settle]
E  Foundation Certification (single-reality proof + ARB)            [gate EG1]
F  Capability Builds (providers, observability, mobile, PITR)       [last; per-CAP evidence]
```

You may not start B/C before A reaches G4. You may not start D before B and C reach their completion gates. You may not start E before D's FG6. You may not start F before E's EG1. Within a phase, execute its sub-steps in the plan's stated order. **Never skip a phase or a checkpoint to "save time."**

---

# SECTION 4 — REALITY PROMOTION EXECUTION RULES (Phase A; plan = Doc 1)

Convert Doc 1 into these executable checkpoints. Most of Phase A's pointer/secret/DNS actions are `[SKIPPED-HUMAN]`; your job is the code/config/validation that makes the human seam safe, plus driving the sequence.

**A0 — Self-registration & snapshot.** Register this prompt in `PROMPTS.md` (see Placement section). Record the promotion baseline in `EXECUTION_LEDGER.md`: tag intent `convergence-3da1416c` and `pre-promotion-origin-c2547049` (the tag *commands* are `[SKIPPED-HUMAN]` if they touch the remote; local annotated tags you may create). **Validation:** gate green after registration. **Stop condition:** if registration can't pass the gate, halt.

**A1 — Repository verification.** Run, and record outputs:
```
git status --short                        # must be empty (gitignore .claude/ first, as its own reviewed commit)
git rev-parse --short HEAD                 # 3da1416c lineage
git rev-list --count main..stepup/main     # must be 0
node scripts/validate-governance.mjs --lane=gate   # must be green (92 validators)
pnpm install --frozen-lockfile             # materialize workspace symlinks BEFORE tests (jose/zod resolution)
node --test tests/governance/phase-b-validators.test.mjs   # 16/16
```
**Stop condition:** any failure halts the program and routes to the owning plan.

**A2 — Branch convergence (close the runbook trap).** The branch-lag guard (`scripts/validators/branch-lag-guard-validator.mjs`) fetches `refs/heads/stepup/main` from origin; `stepup/main` does not exist on the remote and `MERGE_RUNBOOK.md` step 4 only mentions `main`. **Code/doc action (yours):** correct `MERGE_RUNBOOK.md` step 4 to push **both** `main` and `stepup/main` (in that order) — reviewed commit, re-run gate. **Pointer actions (push, branch protection, neutralize `develop`):** `[SKIPPED-HUMAN]` — emit the exact commands and the SKIP row; do not execute. **Validation:** gate green after the runbook fix.

**A3 — Wire the gate into deploy (close the two enforcement holes).** Implement in `.github/workflows/production-deploy.yml` **and** `production-rollout.yml`: a `governance-gate` job running `node scripts/validate-governance.mjs --lane=gate`, made a `needs:` prerequisite of every migrate/deploy job; and an **untracked-migration rejection** step before any `supabase db push --include-all` (fail if `git ls-files --others --exclude-standard database/supabase/migrations/` is non-empty). **Validation:** prove fallibility — inject a reverted failing validator and a reverted untracked `database/supabase/migrations/999_probe.sql`, confirm a workflow dry-run blocks, then delete the probes and confirm `git status` clean. The GitHub required-status-check registration is `[SKIPPED-HUMAN]`.

**A4 — Atomic go-live (human-executed; you prepare and gate).** The new code fails closed without secrets, so ordering is mandatory and you must **not** reorder it: (1) secrets provisioned `[SKIPPED-HUMAN]` (identity JWKs SKIP-D3, checkout signing SKIP-D6, mobile Turnstile SKIP-W7 — and fix the workflow so mobile-bff actually receives `TURNSTILE_SECRET_KEY`); (2) migrate 160→167 in order (each has a paired rollback in `database/supabase/rollback/`); (3) deploy workers+apps to `*.letbuyy.com`; (4) DNS `[SKIPPED-HUMAN]` after the Terraform collision is reconciled (Doc 4 D-CFG3); (5) smoke. **Keep provider-money secrets OUT of this atom** so the schema rollback path stays clean (no live money will have moved). **Validation/smoke gates (G4):** merchant login issues an identity-signed session; `/api/auth/switch` denies an unproven cross-account switch; anon cannot read `orders` (migration 163 live probe); commission reads 0; no `…_MODE="live"` subsystem returns a fabricated success.

**A5 — Post-promotion audit.** Confirm `origin/main == origin/stepup/main == 3da1416c`; backfill the stale "not committed" column on `EXECUTION_LEDGER.md` rows 1–46 to freeze commit `72e80c2b`; record live-probe evidence; obtain the 3 ARB signatures `[SKIPPED-HUMAN]` (GATE-1, ops-survivor, survivability repeal); stand up a scheduled branch-lag monitor.

**Rollback requirement (Phase A):** before A4, the human must hold: prior worker/app deployment IDs, an encrypted DB backup, and the two tags. If login or capture smoke fails and is not fixable in the window, roll back code (re-pin artifacts) + schema (apply 167→160 reverse) + DNS to the snapshot. Record every rollback in the Rollback Report.

**Gate G4 is the program's master gate — B, C, D may not deploy until it passes.**

---

# SECTION 5 — MONEY UNIFICATION EXECUTION RULES (Phase B; plan = Doc 2)

Execute B1–B5 **while every live money rail is fail-closed** (before provider secrets) so there is zero financial blast radius. B6 needs A-G4 + provider secrets (`[SKIPPED-HUMAN]`).

**Accounting invariants — enforce in every B step, prove in tests:**
- **INV-1 Conservation:** Σ debits == Σ credits per transaction.
- **INV-2 Append-only:** never UPDATE/DELETE a ledger row; corrections are reversing entries. Do not weaken the existing triggers or the migration-165 grant revocations.
- **INV-3 Balance-as-projection:** every visible balance = `ledger_account_balance_minor(site, account)`, never a stored mutable column.
- **INV-4 Idempotency:** each money event posts at most once; cross-flow events for one underlying movement dedupe on a shared key.
- **INV-5 Atomicity:** ledger lines post in the same DB transaction as the order/payment status change.
- **INV-6 Fail-closed:** if the ledger post can't complete, the money-state change rolls back.
- **INV-7 Provenance:** every entry carries `source_type` + `source_id` + `idempotency_key`.

**Ledger requirements / execution steps:**
- **B0 Inventory:** confirm the money map (Doc 2 §0.2) against current code before changing anything; record any drift.
- **B1 Capture ledgering (CAP-C01):** make `confirm_order_payment_with_ledger` (`database/supabase/migrations/000_baseline.sql:1590`) actually post canonical entries in-transaction — this fixes capture paths M2–M5 at once. Delete the false `capture_posted_to_ledger: true` literal (`checkout.ts:673`); replace it with a read of actual ledger existence. Extend `canonical-ledger-only-validator` to **scan `database/supabase/migrations/`** and require **call-adjacent** (not whole-file-substring) ledger evidence.
- **B2 Refund ledgering (CAP-C02):** make `complete_order_refund` and `record_order_payment_failure_with_ledger` post **reversing** entries in-transaction; add the shared `merchant_payable` dedupe key across commission-reconcile, settlement-ingest, and COD (INV-4).
- **B3 Settlement convergence (CAP-C05):** one chart of accounts end-to-end; decide the `partner_payout_ledger_entries` boundary (fold-in or explicit ring-fence, removing the silent validator exemption); retire `wallet_ledger_entries` compatibility writes once readers use the projection.
- **B4 Reconciliation (CAP-C04):** schedule `refresh_money_ledger_site_reconciliation` in `services/queue-workers` (no new service); build the operator break-resolution flow in `apps/platform-console`; keep the merchant balance endpoint fail-closed.
- **B5 Legacy money removal:** proof-gated per Section 8 — convert gift-card/AI-credit mutable balances to projections; harden `commission-bps-zero-validator` (catch any non-zero default, not just `300`; stop excluding migrations); sunset the `canonical-ledger-only` 9-file exemption; drop `razorpayx` from the 3 DB CHECK constraints once nothing emits it.
- **B6 Production certification:** payout provider client (CAP-C03), live PSP creds, Razorpay Route/Cashfree split — all `[SKIPPED-HUMAN]`; real cryptographic step-up (CAP-C06) replacing the `recorded-gap-step-up-` placeholder; run the SKIP-D5 live capture→refund→COD→settlement→payout smoke and record variance 0.

**Proof requirements:** each B step ships its validation matrix (Doc 2) green before the next: balanced-posting tests, double-spend replay (INV-4), capture-then-crash (INV-6), attestation-truth, triple-credit prevention, end-to-end net-zero, and a validator mutation test proving a naked money write now fails.

**Rollback requirement:** every schema change has a paired rollback file; never batch; safe because rails are fail-closed during B1–B5.

---

# SECTION 6 — LIQUID CONVERGENCE EXECUTION RULES (Phase C; plan = Doc 3)

Build Liquid up to parity; never un-freeze React to get there. Liquid renders 0% today and is structurally unreachable (default OFF, no canary write path, no CSS, `layoutHtml` discarded, validator enforces OFF). This is a build, not a flip.

**Execution steps (parity-driven):**
- **C0 Capability inventory:** produce the full React-vs-Liquid capability matrix and the exact parity %. Baseline ≈15–20%.
- **C1 Rendering parity:** stop discarding the computed `layoutHtml` (`composition-engine.tsx:352`); build Liquid header/footer chrome (replace the hard-coded empty section groups in `template-resolver.ts`); ship CSS for `lb-*` classes (classes + linked stylesheet, since DOMPurify strips inline `style`); make the 15 stub sections honor their own settings and complete the 5 fixture-only sections as real first-party section files; wire real data binding (cart/product/collection drops). Decide snippets `{% render %}` + `t` filter (implement sandboxed, or formally scope first-party-only via ARB).
- **C2 Editor parity (CAP-C12):** make web + mobile editors author/read Liquid bundles; **build the canary write path** (the missing writer for `templateConfig.liquidRenderingCanary` + `liquidBundle`) — this is what makes Liquid reachable.
- **C3 Preview parity:** `/preview` renders Liquid for canaried stores so editor == preview == storefront.
- **C4 Storefront parity:** per-theme canary cohort rollout (1→N→opt-in GA), each step snapshot- and error-budget-gated; React double-fallback stays as safety net; the platform-wide flip requires an **ARB amendment** to `theme-governance-validator.mjs:60` (the default-OFF enforcement) — `[SKIPPED-HUMAN]` for the ARB decision, you implement the amendment only after parity proof.
- **C5 Checkout compatibility:** verify Liquid→hosted-checkout handoff; resolve CAP-C13 (retire or ARB-rescope the checkout Wasm/app-functions path — never expand it); decide the boundary for the ~15 non-section React app pages.
- **C6 Runtime validation:** 100% snapshot parity across all sections + pages + themes; performance parity; clean error budget; React reached only as explicit fallback.

**Parity / snapshot / editor / storefront requirements (hard gates):** maintain a stored corpus of React-rendered snapshots; a Liquid render must equal its React snapshot for every section, every page type, every theme. Editor parity = a Liquid theme can be authored and previewed truthfully. Storefront parity = canaried stores render Liquid within error budget with zero snapshot regressions. **No cohort expansion on any regression.**

**Rollback:** all additive behind the still-OFF default; per-store canary off → instant React fallback; no production exposure until G4 + canary.

---

# SECTION 7 — REACT DELETION RULES (Phase C7; absolute gate)

**React deletion is FORBIDDEN until all four are independently PROVEN at 100%:**
1. **Capability parity** — every cell of the C0 matrix implemented in Liquid.
2. **Rendering parity** — every section + page renders fully in Liquid.
3. **Snapshot parity** — the stored React snapshot corpus equals Liquid output for every theme/section/page.
4. **Editor parity** — editors author/preview Liquid as the real storefront state.

You MUST enforce this. Concretely:
- Do not remove `no-new-react-sections-validator` or any React file until the four proofs are attached as evidence.
- Follow the Doc 3 Phase 7 deletion checklist in order: confirm parity gates → migrate non-section pages → ARB amends the default-OFF validator and the platform-wide flip is recorded → quarantine the React renderer behind a removal flag and run a full canary with React unreachable → replace the freeze validator with a `no-react-renderer` absence validator → only then delete the React section system (paired with archive to `docs/archive/`) → re-home/retire hydration islands → retire `FEATURE_LIQUID` + canary scaffolding.
- The snapshot-parity corpus is the hard gate for the deletion steps. **No deletion on assertion.** If any of the four proofs is missing or partial, stop at "plan only" and record `[BLOCKED: parity-incomplete]`.

---

# SECTION 8 — DUPLICATE ELIMINATION RULES (Phase D; plan = Doc 4)

**Proof before delete — always.** Every deletion requires four recorded artifacts:
- **Winner** — the ratified survivor it collapses toward.
- **Loser** — the exact path(s) being removed.
- **Evidence** — proof the loser is dead/replaced (zero importers, passing replacement test, validator sees the winner, or an ARB-recorded boundary).
- **Rollback** — a paired reverse (archive move or revert commit).

**No mass deletion.** Each removal is its own reviewed commit. Archive (move to `docs/archive/`) anything with historical value; delete only zero-value residue (ghost refs, dead flags, zero-importer shims). Never collapse a duplicate toward a rejected architecture.

Execute the Doc 4 phases in order, honoring file-ownership (Section, below): **D1 docs** (collapse the dual DOC-02, amend Constitution ART-21/ART-24/§14.2.3 + extend `phase-c-forced-decisions-validator` to DOC 01, fix `CLAUDE.md` precedence, rewrite the 6 "Incubating" reserved-service `AGENTS.md` stubs + add a validator banning forward-activation language, archive the 4 root business binaries, banner/archive frozen-marketplace runbooks); **D2 prompts** (stamp the old foundation-stepup prompt EXECUTED **and** retarget the `prompt-perimeter-validator` `canonicalExecutionPrompt` constant in the same change; widen the perimeter basename coverage to catch MASTERPLAN/DELETION-class docs; dedupe the `SKIP-RAZORPAYX-ENUM-PURGE` ID); **D3 validators** (reconcile the `D12-D13-GATE-RESTORE` bookkeeping; retire/ wire the 5 orphaned validators; the money/CI hardening is owned by B/A and only referenced here); **D4 runtime** (neutralize frozen-app deploy shape + `[SKIPPED-HUMAN]` Vercel-project deletion; drain-then-delete the identity shadow stack on zero-use proof; dedupe the twin `queue-projection-plans.ts`; raise `withTenantTx` adoption with red-team proof CAP-C11; migrate Firebase media then drop the allowlists; delete `auth-core/src/legacy.ts` + residue; exclude frozen apps from CI typecheck/build); **D5 config** (delete the `packages/typescript/utils` ghost tsconfig ref; retarget/remove `develop` registry entries; reconcile the colliding DNS Terraform to one zone; delete-or-wire the 17 dead flags incl. `EMAIL_QUEUE`; declare the ~36 undeclared env keys; relabel `…_MODE="live"` placeholders to sandbox); **D6 certification** (full register dispositioned + anti-recurrence validators added).

---

# SECTION 9 — VALIDATION RULES (after every phase, and every proof-gated step)

Run, in this order, and record results in the Validation Report. Do not advance on any failure.

```
pnpm install --frozen-lockfile                       # FIRST — or jose/zod resolution fails the tests
node scripts/validate-governance.mjs --lane=gate     # the 92-validator hard-wall gate (must be green)
# targeted tests for the touched runtime(s), e.g.:
npx tsx --test services/api-gateway/src/__tests__/<area>.test.ts
node --test tests/governance/<relevant>.test.mjs
# typecheck the touched runtime(s):
npx tsc --noEmit -p services/api-gateway/tsconfig.json     # and the specific app/service/package touched
# lint where wired:
pnpm run lint            # eslint
pnpm run lint:styles     # stylelint (CSS work in Phase C)
git diff --check         # no whitespace/conflict residue
git status --porcelain   # only intended changes; .claude/ must be gitignored
```

**Mutation discipline:** when you add or harden a validator, prove it can fail — inject a violation, confirm the validator fails, then **fully revert** the injection and confirm `git status` is clean. A validator that cannot fail is theater and must be fixed, not shipped.

**Gate-in-deploy discipline (post-A3):** the gate must also be a `needs:` prerequisite in `production-deploy.yml` and `production-rollout.yml`; an untracked migration must be rejected before `db push`.

---

# SECTION 10 — HUMAN APPROVAL SEAMS `[SKIPPED-HUMAN]`

Any task that requires a thing you cannot truthfully produce from repository edits is a seam. Record it in `SKIPPED_HUMAN_DECISIONS.md` with: ID, what's needed, who provides it (role), the exact step to finish it, the seam path:line, what is mocked/fail-closed in the meantime, and blast radius if never done. **Never fabricate the result; never mark it DONE.** Mandatory seams include anything requiring:

- **Secrets / key material** — identity private/public JWKs, internal/session/TOTP rotation, checkout signing secret, KMS keys.
- **Remote git / branch protection / deploy promotion** — pushing `main`+`stepup/main`, branch-protection rules, required-status-check registration, `workflow_dispatch` controls.
- **DNS / production hostnames** — `letbuyy.com` cutover, `checkout.letbuyy.com`.
- **Payment providers** — Razorpay Route / Cashfree split, live PSP credentials, webhook secrets.
- **KYC providers** — Signzy / HyperVerge / manual.
- **Logistics providers** — Shiprocket / Delhivery / Pickrr.
- **Email providers / ESP** — transactional + `/email/send` dispatch, sender-domain verification.
- **WhatsApp** — WABA/BSP onboarding, template approval, provider credentials.
- **Observability** — Sentry/telemetry DSN, alert routing, PITR tier + restore drill.
- **ARB signatures** — GATE-1 ratification, ops-survivor, survivability repeal, Liquid platform-wide flip, mobile-editor publish.

Code that depends on a seam must **fail closed** and badge sandbox/mock honestly until the seam is filled. A `[SKIPPED-HUMAN]` row is a valid, complete outcome for your run — it is not a failure.

---

# SECTION 11 — STOP CONDITIONS (do not audit forever)

Stop a phase, and the program, when all of these hold for that phase:

1. **Plan completed** — every checkpoint/sub-step of the phase's plan document is DONE or a recorded `[SKIPPED-HUMAN]`/`[BLOCKED]`.
2. **Gate green** — `node scripts/validate-governance.mjs --lane=gate` passes.
3. **Validation green** — tests + typecheck + lint for touched runtimes pass (Section 9).
4. **Repository clean** — `git status --porcelain` shows only intended, committed changes; no probe/residue; `.claude/` gitignored.

Additional hard stops (halt immediately and report):
- A prohibition in Section 2 would have to be broken to proceed.
- A required proof (money invariant, React parity, delete-evidence) cannot be produced.
- A `[SKIPPED-HUMAN]` seam blocks the only path forward — record it and stop that thread; continue other independent threads if any.
- The gate goes red and cannot be restored by the current change — revert the change (never `reset --hard`; revert the specific commit), restore green, then re-plan.

**Do not** re-audit completed phases, re-derive plans, or loop searching for more work. When Phase F's per-CAP evidence is recorded or seam-blocked and E's EG1 holds, the program is complete — emit the Completion Report and stop.

---

# SECTION 12 — DELIVERABLES (keep current throughout; finalize at completion)

Maintain these as living records, updated per proof-gated step, finalized at the end:

1. **Execution Ledger** — append to `EXECUTION_LEDGER.md`: one row per action (Action ID, what changed, files, migrations, tests added, validators touched, status, commit). Backfill the stale rows-1–46 commit column (A5). Status must be truthful (`DONE`, `DONE to <seam>`, `SKIPPED-HUMAN`, `BLOCKED`).
2. **Change Ledger** — a per-phase summary of commits with their winner/loser/evidence/rollback for every deletion (Section 8). Store under `FINAL_TRUTH_AUDIT_2026_06_11/` (not root).
3. **Validation Report** — per phase: gate result, test results, typecheck, lint, and every mutation-fallibility proof. Note any environment caveats (e.g., a test that needs `pnpm install` to resolve a dep).
4. **Rollback Report** — every rollback file paired with its forward migration; the exact code+schema+DNS rollback recipe for A4; confirmation that no prohibited tree-discard command was used.
5. **Completion Report** — the final single-reality statement: the four Mission truths each marked achieved or seam-blocked, the remaining `[SKIPPED-HUMAN]` seams and `CAPABILITY_BACKLOG.md` rows, the final duplication/money/theme scores, and the explicit answer to: *Is LetBuyy now ONE REALITY?* with evidence.

Place all new report files under `FINAL_TRUTH_AUDIT_2026_06_11/` or an equally non-root directory. **Never add a tenth root markdown file. Never leave a `*PROMPT*` file unregistered. Never mark a seam DONE without real evidence.**

---

## EXECUTION SUMMARY (your loop)

For each phase A→B∥C→D→E→F, in order: read the owning plan document → execute its checkpoints in order → after each proof-gated step run Section 9 validation → record deliverables → at phase end confirm Section 11 stop conditions → advance only when the phase gate is green. Honor file-ownership so B and C never edit the same file: **B owns money routes/migrations/queue-workers; C owns theme-engine/storefront-runtime/editors; A owns CI/deploy/DNS-reconcile/branch; D owns law docs/prompts/config and only references A/B-owned validator changes.** When in doubt, the plan document governs; when the plan and the Constitution conflict, the Constitution governs; never invent a third path. Build nothing that the strategic winners and freezes forbid. Stop when done.
