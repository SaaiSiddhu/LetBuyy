# LETBUYY EXECUTIVE TRUTH REPORT

**Convergence Audit 2026-06-10 · Phase 10 — Final Executive Truth (capstone synthesis)**
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · branch `stepup/main` @ HEAD `5cf9e64e` · deploy branch `main` **30 commits behind** (the only branch production CI triggers from) · working tree **512 D / 410 M / 78 ??** (re-verified this phase).
**Mode:** DISCOVERY / SYNTHESIS ONLY. No implementation, no redesign, no new architecture, no codex prompts. Read-only git. This report synthesizes all 9 prior Convergence-Audit reports + the premise seed, which themselves built on the 14-report `REPOSITORY_TRUTH_AUDIT_2026_06_10/`. Every claim carries a citation (report name + `path:line`).

---

## VERDICT & SCORES

> **LetBuyy is the best platform it has ever been, entirely uncommitted, deployed as its own negation.** The architecture is right, the winners are decided, and the only reality that conforms to the ratified canon — the working tree — has **zero git history** and is one `git clean -fd` from non-existence, while the branch that actually ships (`main`) is the condemned pre-hardening platform: account-takeover live, 3% GMV rake, anon RLS leaks, mutable money. The gap to a launchable platform is **mostly commit + merge + three ARB rulings, but ~6 genuine capability builds gate real money flow** and no commit or secret closes them.

| Score | Value | Source |
|---|---|---|
| **Repository Health** | **3.1 / 10** | `REPOSITORY_TRUTH_REPORT.md:19,232` (carried from prior master) |
| **Production Readiness — as deployable today (`main`)** | **2.3 / 10** | `REPOSITORY_TRUTH_REPORT.md:19,232` |
| **Production Readiness — working-tree end-state** | **5.5 / 10** | `REPOSITORY_TRUTH_REPORT.md:19,232`; `FOUNDATION_GAP_REPORT.md:8` |

**Convergence-readiness, one line:** the gap is *mostly* commit + merge + ARB (Phase 0 commit flips ~6 domains overnight, three ARB rulings unblock ~3 more), but **~6 genuine capability builds — storefront capture ledgering, payout provider client, reconciliation wiring, step-up real crypto, mobile single-verify login, end-to-end alerting — gate the real money flow, and a delete does not fix a capability gap** (`REPOSITORY_CONVERGENCE_ROADMAP.md:14-18,462-478`; `SINGLE_SOURCE_OF_TRUTH_PLAN.md:21,335-337`).

---

## WHAT IS LETBUYY TODAY?

**Three platforms in one repository, separated in time, not space.** The master fact is **temporal triplication**: three realities co-own every load-bearing domain — `main` (the only deploy trigger, condemned), `HEAD stepup/main` (+30 commits, interim), and the **uncommitted working tree** (Phases A–D13 hardened end-state, the only reality conforming to the Constitution, zero version-control protection) (`_PREMISES_SEED.md:6-7`; `REPOSITORY_TRUTH_REPORT.md:11`). For governance, identity, money, themes, tenancy, and deployment these are three different systems with three different security postures, and **authority is inversely correlated with durability** — the correct reality is the least durable one (`DUPLICATE_AUTHORITY_REPORT.md:14,184`).

**What is genuinely real is a concentrated, credible core:** one backend monolith (`services/api-gateway`: 261 TS files / 84,549 lines / 76 mounted route prefixes) + 3 thin satellite workers (`webhook-service`, `queue-workers`, `mobile-bff`) + 5 deployed Next.js apps + 1 real Flutter merchant app; a 96-on-disk additive migration chain; a real append-only double-entry ledger kernel (migration 139); a credible asymmetric identity topology (working-tree only); real RLS FORCE + `app_tenant` GUC tenancy (untracked migration 164); and a 90-validator governance gate that passes end to end (`REPOSITORY_TRUTH_REPORT.md:13,38-73`).

**The system census (counting whole systems, not files):** **~22 REAL** (exist + run/deployable in ≥1 reality), **~14 PAPER-ONLY** (live only in governance/docs/prompts/config, no runnable referent — multi-region, CQRS/distributed runtime, the 6-service reserved fleet, survivability/chaos contracts, k8s/helm/otel observability, end-to-end alerting, WASM extension runtime), and **~9 GHOST** (referenced by name, referent absent on disk — `_GOVERNANCE_SPINE.md` cited 26× yet nowhere, `packages/typescript/utils`, `services/identity-platform`, the otel cluster, the `stream/*` merge branches, the `checkout.letbuyy.com` dedicated runtime) (`REPOSITORY_TRUTH_REPORT.md:17,80-110,232`). Dead-but-often-live-routed artifacts number in the hundreds (80 generated-intelligence docs, 77 theater validators, 69 theater tests, 34/64 unreachable mobile screens, the entire previous-product portfolio/resume cluster still mounted at `index.ts:738-739`) (`DELETE_CANDIDATES.md:116,185,278`; `REPOSITORY_TRUTH_REPORT.md:114-135`).

---

## WHAT IS LETBUYY'S BIGGEST RISK?

**The uncommitted hardened tree with zero git history — and the commit trap that guards it.** The single highest-risk object in the repository is not a file, it is the **state itself**: the only correct reality (Constitution, AGENTS_V2 source, migrations 162–166, 22 money/identity validators, both 2026-06-10 archives) exists only as an uncommitted dirty tree on a non-deploy branch, with zero history on any branch. One `git clean -fd` permanently destroys it; one `git checkout .` resurrects the rejected regime (`REPOSITORY_TRUTH_REPORT.md:20,232`; `FOUNDATION_GAP_REPORT.md:218-219`; `DELETE_CANDIDATES.md:11,383`).

**The commit trap** is the second jaw: 58–60 tracked root `.md` files are staged-deleted while their *only* archive copies are untracked, so a naive `git commit -am` (tracked-only) **orphans the archive** — the deletions land, the new copies do not. The mandatory mitigation is `git add -A` *first*; `git clean -fd` / `git checkout .` are forbidden until the commit is durable (`REPOSITORY_CONVERGENCE_ROADMAP.md:165`; `STRATEGIC_WINNER_DECISIONS.md:201`). Compounding it, the deploy branch `main` currently ships the platform two prior forensic audits condemned — a "breach-and-insolvency generator" carrying the `/api/auth/switch` account-takeover, anon RLS leaks, mutable-money, and the 3% rake (`FOUNDATION_GAP_REPORT.md:218-219`; `STRATEGIC_WINNER_DECISIONS.md:190,197`).

---

## WHAT IS THE BIGGEST DUPLICATION PROBLEM?

**Temporal triplication is the master multiplier; under it sit 39 duplicate-authority conflicts across 27 domains.** Duplication here is an *authority* problem, not a code-count problem: across 27 domains the audit finds **39 distinct duplicate-authority conflicts**, and in nearly every one the canon already names a single owner — the conflicts are *decided conflicts whose losers still hold live authority* because the deciding document is uncommitted, the winner undeployed, or a validator structurally mandates the loser (`DUPLICATE_AUTHORITY_REPORT.md:12,144`).

Three repeatable machines manufacture authorities faster than the canon retires them (`DUPLICATE_AUTHORITY_REPORT.md:20,180-188`):
- **Temporal triplication** — 3 owners per domain via the uncommitted truth.
- **Validator aliasing** — 6 lane names → 1 validator; 5 assertions duplicated 5×.
- **Scan-AGENTS proliferation** — **79 nested non-root `AGENTS.md`** on disk (89 tracked at HEAD; a subset scan-generated), each a ranked local authority by `CLAUDE.md` precedence, all unpoliced because the anti-scan validator reads only root (`SINGLE_SOURCE_OF_TRUTH_PLAN.md:246`; re-verified 79 this phase).

The two deepest spatial duplicates: **the service-role plane — `getSupabaseAdmin` at 915 call sites (917 incl. tests), with 2 definitions in `services/api-gateway/src/lib/supabase.ts`** — plus a raw-REST bypass that skips the tenant Proxy guard entirely (`DUPLICATE_AUTHORITY_REPORT.md:134`; lead-verified count); and **the second backend — `apps/merchant-control-plane` runs 62 `/api/route.ts` writers (48 `/api/stores/*` + 10 `/api/themes/*`) duplicating gateway-owned commerce domains**, two writers per domain across ~20 commerce domains (`STRATEGIC_WINNER_DECISIONS.md:209,220`; `DUPLICATE_AUTHORITY_REPORT.md:100`).

---

## WHAT SHOULD BE DELETED?

Pointing at the `DELETE_CANDIDATES.md` 6-class taxonomy (the global precondition for every physical action is Phase-0 commit; the dominant class is DELETE_AFTER_MIGRATION, not SAFE_DELETE) (`DELETE_CANDIDATES.md:12-13,277-351`):

- **SAFE_DELETE — ~38 rows/clusters** (junk, empties, generated-falsehoods, dead-product residue, already-executed deletions), of which a **highest-confidence ~15** are near-certain: the **80 generated-intelligence docs**, the **11 zero-reference orphan validators**, the **8 worktree-deleted rejected package roots / 154 files** (0 residual imports), empty husks + machine caches, the demo `urban-kicks` residue, the frozen-app staging + `projects.json` rows, the `tsconfig.workspace.json:68` dangling reference, the mobile dead-weight set, and the prompt factory + 6 `TERMINAL_*` relaunchers (`DELETE_CANDIDATES.md:277-294,355-375`).
- **DELETE_AFTER_MIGRATION — ~17 clusters**, each with a precise, testable condition (React renderer behind the 8-item Liquid parity gate; the ~60-artifact survivability/multi-region/chaos/load cluster behind `[SURVIVABILITY-UNHOOK]`; the 62 MCP + 21 storefront-runtime second-backend routes behind a call-graph trace; mobile theme editor behind an ARB pick) (`DELETE_CANDIDATES.md:295-310`).
- **ARCHIVE — ~13 groups (~200 files)**: `docs/Codex_waves/`, `docs/audit/`, `docs/audits/apps-platform/`, `docs/agents/`, the frozen-app mission families, plus the **865-file `docs/archive/**`** whose 8 newest dirs are untracked and need COMMIT (`DELETE_CANDIDATES.md:312-326`).
- **INVESTIGATE — 8 probes** (mostly live-DB writer/grant/index traces) (`DELETE_CANDIDATES.md:341-349`).

**The dangerous-to-delete watchlist** (looks deletable, is load-bearing or canon-protected): the uncommitted working tree itself, the multi-region config (deleting fails CI), `chaos/`+`load/`, the React renderer (deleting blanks every store), the retired generator (its retirement is law), and the nested `AGENTS.md` (ranked authorities by filename) (`DELETE_CANDIDATES.md:379-394`).

---

## WHAT SHOULD SURVIVE? (the KEEP_CANONICAL spine)

The 28-entry delete-never spine (`DELETE_CANDIDATES.md:327-339`):

- **Backends/runtimes:** `services/api-gateway` (the monolith), `services/mobile-bff`, `services/webhook-service`, `services/queue-workers`; apps `storefront-runtime`, `merchant-control-plane` (control plane), `identity-platform`, `platform-console`, `mobile/merchant-app`.
- **Money/data:** the `database/supabase/migrations/` 000–166 chain (**162–166 untracked = highest-priority preserve**) + rollbacks; the canonical append-only ledger kernel (mig 139).
- **Governance:** `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` + 6 sibling docs, root `AGENTS.md` (AGENTS_V2), `CLAUDE.md`, `EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`, `scripts/validate-governance.mjs` + the 90-validator gate (incl. the 22 untracked money/identity validators), the `whole-repo-end-state-validator.mjs` keystone (strip only its region block), the retired-generator tombstone.
- **Build/UI/config:** `.github/workflows/`, `package.json` + workspace roots + tsconfigs, root `pubspec.yaml` (Melos), `packages/typescript/ui`, `packages/dart/ui_kit`, `packages/theme-engine`, `production-topology.json` + `deployment-topology.json` (minus globalRegions), `config/governance/`, `tests/executable/`, the live `docs/design-system/` + `docs/seo/` reference.

---

## WHAT SHOULD BECOME CANONICAL? (the winner registry)

All 14 scored winners match the `_PREMISES_SEED.md` spine with **zero overturns** (`STRATEGIC_WINNER_DECISIONS.md:378-396`):

| Domain | Canonical winner | Composite (win vs lose) |
|---|---|---|
| Themes — renderer | **Liquid (strategic target)** | 4.7 vs 6.6 React (React wins completeness-today 9 vs 2; React NOT deletable) |
| Identity — issuance | **identity-platform asymmetric ES256/EdDSA sole issuer** | 6.3 vs 4.0 |
| Money — model | **canonical append-only double-entry ledger** | 6.7 vs 3.6 |
| Tenancy | **RLS+FORCE+GUC (`withTenantTx`, `app_tenant`)** | 6.3 vs 3.9 |
| Governance | **Constitution stack → AGENTS_V2 → Canonical Systems** | 6.4 vs 3.0 |
| Architecture docs | **Executable Architecture / Constitution** | 6.4 vs 2.1 |
| Branch reality | **`stepup/main` working tree (Reality C)** | 6.6 vs 2.9 |
| Storefront backend | **api-gateway monolith** | 6.7 vs 3.4 |
| Topology | **one-region monolith + 4 satellites** | 7.1 vs 2.6 |
| Mobile nav / tokens / editor | **Navigator + composite BFF + ui_kit tokens** | 5.3 / 6.4 / (re-wire or LivePreview) |
| Commission | **0 bps (permanent)** | 6.4 vs 4.7 |
| Payout rail | **provider-split never-custody (Razorpay Route / Cashfree)** | 5.3 vs 2.9 |
| Storefront capture | **ledgered capture (target)** | 6.0 vs 4.6 (neither side wired today) |

---

## WHAT SHOULD BE BUILT NEXT? (named capability gaps — NOT designed here)

These survive *any* commit, *any* merge, *any* secret; a delete does not fix them. The audit names them and designs none (`REPOSITORY_CONVERGENCE_ROADMAP.md:462-478`; `FOUNDATION_GAP_REPORT.md:316-326`):

1. **Storefront capture ledgering** — `confirm_order_payment_with_ledger` (`000_baseline.sql:1590`) posts **zero** canonical ledger lines on the path every shopper hits, in all three realities (the #1 unfinished winner).
2. **Payout provider client** — `initiateTransfer` unconditionally throws `PayoutProviderUnavailable` (`payout-transfer-adapter/index.ts:104-105`); no `PayoutProviderClient` exists in any branch → merchants can never be paid.
3. **Reconciliation wiring** — `refresh/assert_money_ledger_site_reconciliation` + `backfill_wallet_ledger_to_canonical` have **zero runtime callers**; the merchant wallet fails closed at HTTP 409 forever (`wallet.ts:163-176`).
4. **Step-up real crypto** — `verifySensitiveActionStepUp` accepts a self-served ≥12-char `mock-step-up-${uuid}` token (a validator allowlists the mock), guarding refund/payout/DSR-erase (`security.ts:123`).
5. **Liquid chrome + data binding** — the ratified winner has no header/footer (the plan hard-codes empty groups, `template-resolver.ts:213-216`), hard-coded product strings, an `index`-only template, no canary write path, no editor → cannot run a real store.
6. **Mobile single-verify login** — the Turnstile token is double-spent (BFF consumes at `store_auth_service.dart:379` → identity re-verifies → `timeout-or-duplicate`), so production mobile login fails closed.
7. **Alerting end-to-end** — `prometheus-rules.yaml` alerts on 7 metrics with zero emitters; otel exports to a deleted cluster; no error-tracking SDK in any runtime; no alert delivery channel.

*(Plus the named partials: the 2/3 un-ledgered refund paths and `merchant_payable` cross-source dedup.)*

---

## WHAT SHOULD NOT BE BUILT?

The constitutionally forbidden / formally-rejected / out-of-scope set — and the gate must stop wrongly mandating it (`STRATEGIC_WINNER_DECISIONS.md:230-249,161-180`; `ARCHITECTURAL_DRIFT_REPORT.md:171-218`; `FOUNDATION_GAP_REPORT.md:338`):

- **Multi-region / distributed / CQRS / event-sourcing / chaos / survivability** — the 4-region `globalRegions:[india,apac,eu,us]` topology, failover pairs, replay-runtime, projection-runtime. The Constitution forbids certifying multi-region (`:98,108,112`); the platform's envelope is one region / 10k merchants. **Critically, this is the architecture the new gate *wrongly mandates*** (`whole-repo-end-state-validator.mjs:172-193` + `survivability-governance-validator.mjs:94-107`), and removing it currently fails CI — the GATE-1 self-block reborn (`ARCHITECTURAL_DRIFT_REPORT.md:175-218`).
- **The reserved 6-service fleet** (`checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`) — stays manifest-only; do NOT activate (`SINGLE_SOURCE_OF_TRUTH_PLAN.md:288`; `CLAUDE.md` reserved policy).
- **The frozen apps** (`app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal`) — not production deploy targets; do not build or scaffold them, despite ~24 dangerous prompts that command it (`PROMPT_DRIFT_REPORT.md:15-17,159-164`).
- **Shopify-OS-2.0 maximalism** from the dangerous docs (`docs/audit/13-final-architecture-blueprint.md:3` "Shopify-OS-2.0-class SaaS"; the "billion-dollar commerce OS" multi-region roadmap; the WASM extension runtime) — formally rejected by ADR-021/ENV-R2 (`PROMPT_DRIFT_REPORT.md:172-183`).

---

## WHAT PREVENTS PRODUCTION / SCALE / ONBOARDING / REVENUE?

From `FOUNDATION_GAP_REPORT.md` (11 S0 / 13 S1 / 9 S2 / 4 S3 = 37 ranked gaps; Class A commit-seam ≈4 · Class B human-seam ≈9 · Class C genuine-missing-capability ≈24) and `PRODUCTION_READINESS_REPORT`:

- **What prevents PRODUCTION:** the entire hardened platform is uncommitted (`git clean -fd` destroys it), the deploy branch ships the condemned regime, migrations 162–166 are untracked (silently omitted on a clean deploy), the `/api/auth/switch` takeover is live, anon RLS leaks are open, and **there is no alerting end-to-end** — a money break or breach produces no signal (`FOUNDATION_GAP_REPORT.md:14-22,200-205,256-271`).
- **What prevents SCALE:** the gate *machine-mandates* the rejected multi-region architecture the Constitution forbids (so CI enforces the loser); the second backend doubles the surface; the shared-secret `AUTH_SECRET` monoculture and blanket service-role plane do not scale safely across tenants — but scale is moot before the basics ship (`FOUNDATION_GAP_REPORT.md:23,210-211`; `STRATEGIC_WINNER_DECISIONS.md:243`).
- **What prevents MERCHANT ONBOARDING:** identity live keys are unprovisioned (merchant login fails closed once the new topology deploys without them, `SKIP-D3`); mobile production login is broken by the Turnstile double-spend; 34/64 mobile screens (incl. KYC/2FA/returns) are unreachable; the merchant wallet read 409s forever out of the box (`FOUNDATION_GAP_REPORT.md:61-62,185-190,108-110`).
- **What prevents REVENUE:** the storefront capture path writes no ledger entries, so paid orders never credit `merchant_payable`; **no payout provider client exists**, so no GMV ever settles to a merchant bank account; reconciliation is wiring-dead; and every committed branch still defaults to the **3% rake** the business plan condemned (`FOUNDATION_GAP_REPORT.md:100-110,118-119`).

---

## WHAT IS THE SHORTEST PATH TO PRODUCTION READINESS?

The Phase 0→7 convergence spine, with the load-bearing **survivability-unhook-before-commit** ordering insight (`REPOSITORY_CONVERGENCE_ROADMAP.md:26-46,147-458`):

1. **ARB repeal of the survivability/multi-region contract FIRST** (no SKIP row covers the "keep" decision) — because the act of committing *arms* the self-block, the unhook must precede or accompany the commit, never follow it.
2. **Phase 0 — commit the working tree as the Truth Freeze** with `git add -A` (capturing migrations 162–166, the Constitution, the 22 validators, both archives), avoiding the commit trap, with the region asserts already stripped.
3. **Phase 1 — ratify governance** (sign GATE-1), execute the unhook, collapse the 79 nested + scan-generated `AGENTS.md` to one root law, archive the dangerous prompt corpus.
4. **Phases 2–6 — collapse each winner's losers in dependency order** (identity verify-only drain → money authority commit + rail collapse → theme schema/compose + DOMPurify → mobile dead-nav cleanup → deployment: **fast-forward `main` to lag 0**, delete the multi-region layer, retire the second backend on a call-graph trace).
5. **Phase 7 — resolve the ~9 launch-blocking human seams** (keys, secrets, DNS, PITR, checkout cutover) and **build the ~6 named capability gaps** (capture ledgering, payout client, reconciliation, step-up, mobile login, alerting) — convergence ends here; these builds are the remaining go-live work and are explicitly out of convergence scope.

---

## TOP 10 RISKS

1. **The uncommitted hardened tree has zero git history** — one `git clean -fd` destroys the only correct reality; `git checkout .` resurrects the condemned regime (`REPOSITORY_TRUTH_REPORT.md:20,232`).
2. **`main` (the only deploy branch) is 30 commits behind and ships the condemned platform** — live account-takeover, anon leaks, mutable money, 3% rake (`STRATEGIC_WINNER_DECISIONS.md:197`; `FOUNDATION_GAP_REPORT.md:5`).
3. **The commit trap** — a tracked-only `git commit -am` orphans the only (untracked) archive copies of 58–60 root docs (`REPOSITORY_CONVERGENCE_ROADMAP.md:165`).
4. **The gate machine-mandates the rejected multi-region architecture the Constitution forbids; committing the truth arms the self-block** (`ARCHITECTURAL_DRIFT_REPORT.md:175-218`; `REPOSITORY_CONVERGENCE_ROADMAP.md:32-44`).
5. **Storefront capture writes 0 canonical ledger lines on the path every shopper hits** — primary revenue path is off-book in all three realities (`FOUNDATION_GAP_REPORT.md:100-102`).
6. **No payout provider client — `initiateTransfer` throws unconditionally** — merchants can never be paid; no GMV ever settles (`FOUNDATION_GAP_REPORT.md:104-106`).
7. **No alerting end-to-end** — 7 alert rules, zero emitters, no SDK, no channel; a money break or breach produces no signal (`FOUNDATION_GAP_REPORT.md:200-205`).
8. **`/api/auth/switch` account takeover live on the deploy branch** — any `email_verified` user becomes any merchant/admin (`FOUNDATION_GAP_REPORT.md:57-59`; `DUPLICATE_AUTHORITY_REPORT.md:45`).
9. **Migrations 162–166 untracked → silent omission on a clean deploy** — commission-zero, anon-leak RLS, `app_tenant` GUC, canonical money paths, checkout authority all vanish (`FOUNDATION_GAP_REPORT.md:235-236`).
10. **Step-up is mock theater + reconciliation wiring-dead → wallet 409s forever** — the strongest money-out/data-erase control is a self-served token; the merchant balance is unviewable out of the box (`FOUNDATION_GAP_REPORT.md:65-66,108-110`).

---

## TOP 10 DELETIONS

1. **80 generated-intelligence docs** — unregenerable stale falsehoods (`letbuyy.store`, "19 migrations", deleted packages); generator hard-retired (`DELETE_CANDIDATES.md:116,361`).
2. **The ~60-artifact survivability/multi-region/chaos/load/certification cluster** — DELETE_AFTER_MIGRATION behind `[SURVIVABILITY-UNHOOK]` (config JSONs, chaos/, load/, the survivability validator, 10 certification validators, 13 governance docs) (`DELETE_CANDIDATES.md:297`).
3. **The 62 merchant-control-plane + 21 storefront-runtime second-backend routes** — DELETE_AFTER_MIGRATION behind a per-page call-graph trace (`DELETE_CANDIDATES.md:302,212-213`).
4. **8 worktree-deleted rejected package roots / 154 files** — 0 residual imports; SAFE_DELETE, finalize at commit (`DELETE_CANDIDATES.md:280`).
5. **11 zero-reference orphan validators** — re-verified 0 external refs each (`DELETE_CANDIDATES.md:185,362`).
6. **The prompt factory `CLAUDE_OPUS_MASTER_PROMPT.md` + 6 `TERMINAL_*` relaunchers + 3 rejected-package missions** — manufacture rejected-architecture missions (`DELETE_CANDIDATES.md:291,375`).
7. **The 79 nested + scan-generated root `AGENTS.md`** — DELETE_AFTER_MIGRATION (retarget anti-scan validator below root first) (`SINGLE_SOURCE_OF_TRUTH_PLAN.md:250-251`).
8. **React renderer + 20 frozen sections** — DELETE_AFTER_MIGRATION behind the 8-item Liquid parity gate; deleting today blanks every storefront (`DELETE_CANDIDATES.md:78,296`).
9. **Frozen-app rows in both staging workflows + 4 `config/vercel/projects.json` entries** + the demo `urban-kicks` residue + the `tsconfig.workspace.json:68` dangling reference — SAFE_DELETE drift (`DELETE_CANDIDATES.md:284,367,370`).
10. **The mobile dead-weight set** — dead GoRouter `deep_link_router.dart` + `go_router` dep, `widgets/home/` twins, app-local token forks, the 1,830-line dead theme editor (ARB pick) (`DELETE_CANDIDATES.md:289,303,372`).

---

## TOP 10 CONVERGENCES

1. **Phase 0 — `git add -A` commit the working tree as the Truth Freeze** — the master quick-win that flips PR for ~6 domains overnight (`REPOSITORY_CONVERGENCE_ROADMAP.md:147-182`).
2. **Fast-forward `main` to `stepup/main` (branch lag 30→0)** — the act that finally deploys the hardened truth and retires the condemned platform (`REPOSITORY_CONVERGENCE_ROADMAP.md:391`).
3. **Execute `[SURVIVABILITY-UNHOOK]`** — strip the 4-region asserts, delete `survivability-governance-validator.mjs`, retarget the 3 workflows, make the topology honest (`REPOSITORY_CONVERGENCE_ROADMAP.md:192,209`).
4. **Collapse governance to one root `AGENTS.md`** — delete the 79 nested + scan-gen copies after retargeting the anti-scan validator below root; archive `docs/agents/` (`SINGLE_SOURCE_OF_TRUTH_PLAN.md:250`).
5. **Commit money authority migrations 160/162/165** + demote the mutable wallet model to read-only projection; default commission to 0 bps everywhere (`REPOSITORY_CONVERGENCE_ROADMAP.md:271-273`).
6. **Identity verify-only drain** — gateway verifies the identity-platform issuer; delete the `randomHex(32)` mint + `/switch` branch + 18-file shadow stack after zero-legacy-HS256 telemetry (`REPOSITORY_CONVERGENCE_ROADMAP.md:245-246`).
7. **Commit migrations 163/164** to kill the live anon-leak class; route adoption of `withTenantTx`; delete the raw-REST bypass callers (`SINGLE_SOURCE_OF_TRUTH_PLAN.md:263`).
8. **Collapse the theme schema + compose forks into the engine** and make DOMPurify the deployable sanitizer (closes storefront XSS) (`REPOSITORY_CONVERGENCE_ROADMAP.md:314-316`).
9. **Retire the second backend** — proxy-or-port the 62 MCP + 21 storefront-runtime routes onto the gateway after the call-graph trace (`gift-cards` ported, not proxied) (`REPOSITORY_CONVERGENCE_ROADMAP.md:394`).
10. **Validator cleanup** — delete the 6 lane aliases (paired workflow retarget), the 5 non-region duplicated assertions, the 21 orphan/zero-ref validators, retire the HEAD 181-gate (`SINGLE_SOURCE_OF_TRUTH_PLAN.md:276`).

---

## TOP 10 FOUNDATION PRIORITIES

1. **Commit the working tree (Phase 0)** — the persistence seam in front of every other Class-A fix (`FOUNDATION_GAP_REPORT.md:218-219`).
2. **Build storefront/webhook capture ledgering** — the platform's books for its primary money path do not exist (`FOUNDATION_GAP_REPORT.md:100-102`).
3. **Build a payout provider client** — the core "sell, get paid" promise is unfulfillable (`FOUNDATION_GAP_REPORT.md:104-106`).
4. **Wire reconciliation + make the wallet 409 operator-clearable** — the merchant balance is unviewable out of the box (`FOUNDATION_GAP_REPORT.md:108-110`).
5. **Build end-to-end alerting** (emitters + error SDK + channel) — no money platform launches blind to its own breaks (`FOUNDATION_GAP_REPORT.md:200-205`).
6. **Replace mock step-up with real crypto** (TOTP/passkey/re-auth) on refund/payout/DSR-erase (`FOUNDATION_GAP_REPORT.md:65-66`).
7. **Fix the mobile Turnstile single-verify** so production login works (`FOUNDATION_GAP_REPORT.md:185-187`).
8. **Provision identity live keys (`SKIP-D3`)** — or merchant login fails closed once the asymmetric topology deploys (`FOUNDATION_GAP_REPORT.md:61-62`).
9. **Ledger the 2/3 un-ledgered refund paths + dedup the `merchant_payable` triple-writer** (`FOUNDATION_GAP_REPORT.md:112-116`).
10. **Close the 25 residual PUBLIC `USING(true)` policies + the raw-REST tenant-guard bypass** (`FOUNDATION_GAP_REPORT.md:238-239`; `SINGLE_SOURCE_OF_TRUTH_PLAN.md:263`).

---

## TOP 10 ARCHITECTURAL DECISIONS

1. **Adopt the `stepup/main` working tree as the canonical reality; retire `main` as the operative state** — the branch decision (`STRATEGIC_WINNER_DECISIONS.md:185,197`).
2. **ARB repeal of the survivability/multi-region contract** — repeal the self-mandate so the gate stops enforcing the rejected architecture; the keystone ruling that unblocks convergence (`ARCHITECTURAL_DRIFT_REPORT.md:213-218`).
3. **One-region modular monolith + 4 satellites is the topology; never multi-region/distributed/CQRS** (`STRATEGIC_WINNER_DECISIONS.md:230-243`).
4. **The api-gateway monolith is the sole commerce backend; collapse the second backend** (`STRATEGIC_WINNER_DECISIONS.md:207-220`).
5. **The canonical append-only double-entry ledger is the sole money truth; the mutable wallet model is a read-only projection** (`STRATEGIC_WINNER_DECISIONS.md:92-103`).
6. **identity-platform is the sole asymmetric ES256/EdDSA issuer; retire the gateway `randomHex` mint + shared-`AUTH_SECRET` family** (`STRATEGIC_WINNER_DECISIONS.md:69-82`).
7. **RLS+FORCE+GUC (`withTenantTx`/`app_tenant`) is the load-bearing tenant isolation; service-role demoted to audited break-glass** (`STRATEGIC_WINNER_DECISIONS.md:115-128`).
8. **Liquid is the canonical renderer (strategic target); React stays FROZEN and load-bearing until the 8-item parity gate — it is explicitly NOT deletable** (`STRATEGIC_WINNER_DECISIONS.md:46-63`).
9. **0% commission permanent + never-custody provider-split payout rail** — kill the 3% rake and RazorpayX self-custody (`STRATEGIC_WINNER_DECISIONS.md:307-320,330-343`).
10. **The Constitution stack → AGENTS_V2 → Canonical Systems is the law; ratify GATE-1, retire the scan-generated regime + the maximalist blueprint corpus** (`STRATEGIC_WINNER_DECISIONS.md:138-155,161-174`).

---

## THE ONE DECISION THAT UNBLOCKS EVERYTHING

**Commit the working tree (Phase 0) — but the survivability-unhook must precede or accompany the commit, never follow it.** This is the single most important sequencing fact in the audit, and it is not intuitive (`REPOSITORY_CONVERGENCE_ROADMAP.md:26-46`).

The two validators that hard-mandate the rejected multi-region architecture (`whole-repo-end-state-validator.mjs` + `survivability-governance-validator.mjs`) live only in the untracked working tree. The instant `git add -A && git commit` runs, they become tracked and CI-active and begin enforcing, against committed config, the `globalRegions:[india,apac,eu,us]` topology + survivability CI that the Constitution forbids (`:98,108,112`). **Committing the truth is the act that arms the lie.** Because removing the multi-region artifacts *fails CI* once the validators are live, and the validators go live *at commit*, the ARB repeal + paired retarget must land **in or before** the Phase-0 commit (`REPOSITORY_CONVERGENCE_ROADMAP.md:40-46`).

The ordering, therefore: **(1) ARB records the survivability repeal → (2) Phase 0 stages the tree with `git add -A`, region asserts already stripped, archives captured atomically (never `git clean -fd`/`git checkout .`) → (3) ratify GATE-1.** Get this ordering right and ~6 domains flip to live overnight, ~3 more unblock on their ARB rulings, and what remains is the ~6 honest capability builds that gate real money. Get it wrong and the canonical gate certifies the rejected architecture in a committed window that `main` can fast-forward into.

---

## METHOD & PROVENANCE

- **Synthesis basis:** all **9 prior Convergence-Audit reports** (`_PREMISES_SEED.md`, `REPOSITORY_TRUTH_REPORT.md`, `DUPLICATE_AUTHORITY_REPORT.md`, `SINGLE_SOURCE_OF_TRUTH_PLAN.md`, `STRATEGIC_WINNER_DECISIONS.md`, `DELETE_CANDIDATES.md`, `PROMPT_DRIFT_REPORT.md`, `FOUNDATION_GAP_REPORT.md`, `ARCHITECTURAL_DRIFT_REPORT.md`, `REPOSITORY_CONVERGENCE_ROADMAP.md`) + the **14-report `REPOSITORY_TRUTH_AUDIT_2026_06_10/`** as the code-verified citation base (carrying the 3.1/10 health and 2.3/5.5 readiness scores).
- **Mode:** Discovery / synthesis only. Read-only git. No file modified except this report. No implementation, no redesign, no new architecture, no codex prompts.
- **Repository state (re-verified this phase):** branch `stepup/main` @ HEAD **`5cf9e64e`**; deploy branch `main` **30 commits behind**; working tree **512 D / 410 M / 78 ??**.
- **Corrected numbers (lead-verified, resolving inter-agent conflicts, re-confirmed live this phase):** `getSupabaseAdmin` = **915 call sites (917 incl. tests)**, 2 definitions in `services/api-gateway/src/lib/supabase.ts`; nested non-root `AGENTS.md` = **79 on disk** (89 tracked at HEAD; a subset scan-generated). Where prior phases diverged ([SEED-CONFLICT, magnitude] on the admin count 664–917 and nested AGENTS.md 38–79), these corrected figures are authoritative; **the winner spine is unchanged**.
- **Out of scope (UNVERIFIED):** all live infrastructure/DB/provider/CI-history state — which of `main`/HEAD/working-tree actually serves production, whether 162–166 were applied out-of-band, the per-page call-graph trace gating second-backend deletion, live `pg_policies`/grants, and ARB intent on multi-region. None resolvable by read-only git (`REPOSITORY_CONVERGENCE_ROADMAP.md:482-493`).
- **Date:** 2026-06-10.

*End of Phase 10 — LETBUYY EXECUTIVE TRUTH REPORT. Synthesis only; the single file written is this report. Every claim carries a report-name + path:line citation; all 14 winner calls bind to `_PREMISES_SEED.md` with zero overturns; the capability gaps are named, never designed.*
