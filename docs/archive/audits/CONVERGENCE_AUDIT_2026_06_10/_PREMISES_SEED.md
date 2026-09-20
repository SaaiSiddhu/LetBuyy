# Convergence Audit — Shared Premise Seed (derived, not invented)

This file is the shared input for all 10 phases of the Convergence Audit (2026-06-10). It records the **authority reconciliation** and the **per-domain winner spine** that were already established and code-verified by the prior REPOSITORY_TRUTH_AUDIT_2026_06_10 (13 reports + master). Nothing here is new architecture — it is a restatement of winners the **ratified canon itself already names**, with the evidence pointers carried forward. All 10 phase reports must stay consistent with this spine; where a phase finds evidence that contradicts it, the phase must say so explicitly and cite the conflict.

## Repository state (audit baseline)
- Branch `stepup/main`, HEAD `c4fc3cd6` (2026-06-10). Working tree: **512 deleted / 410 modified / 76 untracked**. Deploy branch `main` is **30 commits behind** and ships the pre-hardening platform.
- **Temporal triplication** is the master fact: three realities per domain — `main` (condemned, deployable), `HEAD` (+30), `working tree` (hardened Phases A–D13 end-state, uncommitted, zero git history). `EXECUTION_LEDGER.md`: every row "not committed."

## Authority reconciliation (user ordering vs in-repo ordering)
- **User-declared supremacy:** EXECUTABLE_ARCHITECTURE_V1 > FINAL_ARCHITECTURE_FREEZE > AGENTS.md > everything.
- **In-repo reality:** V1 + Freeze were deleted from the working-tree root; verbatim copies preserved in `docs/archive/root-governance-2026-06-10/`; their content was absorbed into `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (ART-01..24) and the Constitution self-declares "RATIFIED. SUPREME." while `SKIPPED_HUMAN_DECISIONS.md:5` (SKIP-GATE1-ARB-RATIFICATION) shows ratification is **mechanical-complete but human-unsigned**. AGENTS_V2 was promoted to root `AGENTS.md` (tracked-modified, uncommitted).
- **Reconciliation rule for this audit:** treat V1/Freeze *content* as supreme (per user); treat the Constitution + root AGENTS_V2 + Canonical Systems as their promoted embodiment; treat the **uncommitted + unratified** status as a first-class risk, not a blocker to naming winners. Convergence assumes commit + ratify happens at Phase 0.

## Convergence assumption (from user's stated constraints)
"No production users / no production data / no migration constraints" + aggressive-deletion mandate ⇒ the convergence spine is: **(0) commit the working tree as the Truth Freeze → (1) ratify governance → (2..) make each winner canonical and delete its loser.** Migration paths may therefore be DELETE-not-MIGRATE wherever the only constraint was production safety.

## Per-domain WINNER SPINE (code-verified by prior audit; cite these forward)

| Domain | WINNER (canonical) | LOSER(s) to converge away | Key evidence | Removability today |
|---|---|---|---|---|
| Governance | Constitution stack → root AGENTS_V2 → Canonical Systems (worktree) | scan-generated AGENTS.md regime (HEAD/main) + 38 nested scan AGENTS.md + `docs/agents/` "agent OS" | GOVERNANCE_TRUTH_REPORT; ANTI-R8/DOC-R1 | Blocked on commit+ratify; nested AGENTS.md unpoliced |
| Identity | identity-platform asymmetric ES256/EdDSA **sole issuer** (worktree) | gateway `randomHex(32)` sessions (HEAD/main) + shared `AUTH_SECRET` HS256 family (lb_accounts, console/customer/app/federation, media/checkout/export signing, webhook dispatch) | IDENTITY_TRUTH_REPORT; IDN-R1/R2 | Winner uncommitted; loser is what `main` deploys |
| Money — ledger | append-only canonical ledger (`ledger_entries/transactions/accounts`, mig 139) | mutable `wallet_ledger_entries`/`payout_statements`/`commission_*` (mig 119) | MONEY_TRUTH_REPORT; PAY-R2 | Winner not fully wired even in worktree (see below) |
| Money — capture | (target) ledgered capture | `confirm_order_payment_with_ledger` (baseline:1590) writes **zero** ledger lines — naming theater; the path every shopper hits | MONEY_TRUTH_REPORT (lead-verified) | **Genuine gap — survives any merge** |
| Money — commission | 0 bps (worktree, mig 162 + code) | 300 bps default + `?? 300` fallbacks (HEAD/main, payouts.ts:344) | MONEY_TRUTH (lead-verified) | Winner uncommitted |
| Money — payout rail | provider-aggregator split (Razorpay Route/Cashfree) | RazorpayX self-custody fallback (HEAD) | MONEY_TRUTH | No provider client exists — `initiateTransfer` throws |
| Themes | Liquid renderer (ratified winner) | React renderer (runtime default, 22-24 types, editors) | THEME_PARITY_REPORT; THEME-R1/WIN-R3 | **React NOT deletion-ready** — type-only parity, no Liquid header/footer, no data binding, index-only template, no canary write path, editors React/JSON-only |
| Tenancy | `withTenantTx` / `app_tenant` GUC + FORCE RLS (mig 164) | 664 `getSupabaseAdmin` guarded-proxy sites + raw-REST `supabaseServiceHeaders` bypass + anon clients + fail-open queue envelope | IDENTITY/DATABASE/MONEY reports; SEC-R9 | mig 164 untracked; validator polices little of it |
| Storefront backend | `services/api-gateway` monolith | `apps/merchant-control-plane` second backend (~62 `/api/stores/[store]/*` + `/api/themes/*` routes) | CODEBASE_REALITY/DUPLICATE reports; ARCH-R1/R17 | Blocked on per-page call-graph trace |
| Deployment topology | one region, `.com`, monolith + 4 satellites | multi-region/distributed/CQRS config layer (7 `config/runtime/*` contracts) + survivability validator 4-region requirement + `chaos/` + `load/` + multi-region governance docs | ARCHITECTURE/GOVERNANCE reports; Constitution :98/:112 | **Self-mandated by the new gate** — `whole-repo-end-state-validator.mjs:172-193` requires `globalRegions:[india,apac,eu,us]` + survivability CI; needs ARB repeal |
| Mobile nav/tokens | Navigator routes + composite BFF dashboard + ui_kit generated tokens | dead GoRouter `deep_link_router` + app-local tokens (deleted) + 34/64 unreachable screens + 2 dead theme editors | MOBILE_TRUTH_REPORT | Login double-spend + reachability are genuine gaps |
| Branch reality | working tree (stepup end-state) = intended truth | `main` = condemned deployable; `HEAD` = interim | all reports | Phase 0 = commit working tree |

## Genuine capability gaps that survive ANY commit/merge (not fixable by convergence alone — name them, don't design fixes)
1. Storefront capture path writes no ledger entries; 2 of 3 refund paths un-ledgered.
2. No payout provider client — `initiateTransfer` always throws → merchants can't be paid.
3. Step-up is mock theater (≥12-char self-served token guards refund/payout/DSR-erase); OIDC = 501 skeleton.
4. Reconciliation RPCs have zero runtime callers; wallet 409s forever; `merchant_payable` has 3 un-deduped credit writers.
5. Mobile login double-spends single-use Turnstile token (BFF consumes → identity re-verifies); 34/64 screens unreachable incl. 1,800-line theme editor.
6. 25 PUBLIC `USING(true)` RLS policies survive final state outside the validator allowlist.
7. No alerting end-to-end (Prometheus watches metrics nothing emits; otel exports to nonexistent cluster; no error SDK).

## The 14 prior reports (evidence base — read as needed)
`REPOSITORY_TRUTH_AUDIT_2026_06_10/`: 000_TRUTH_AUDIT_INDEX, LETBUYY_REPOSITORY_TRUTH_MASTER_REPORT, GOVERNANCE_TRUTH_REPORT, ARCHITECTURE_TRUTH_REPORT, PROMPT_DRIFT_REPORT, CODEBASE_REALITY_REPORT, DATABASE_TRUTH_REPORT, THEME_PARITY_REPORT, IDENTITY_TRUTH_REPORT, MONEY_TRUTH_REPORT, MOBILE_TRUTH_REPORT, DELETION_CANDIDATE_REGISTRY, DUPLICATE_REALITY_REPORT, PRODUCTION_READINESS_REPORT.
