# ARCHITECTURAL DRIFT REPORT — Convergence Audit Phase 8

**Phase:** 8 — ARCHITECTURAL DRIFT (CODE / DOCS / PROMPTS / VALIDATORS / DATABASE / TOPOLOGY != ARCHITECTURE)
**Mode:** DISCOVERY ONLY. No code changes, no new architecture, no codex prompts. Read-only git.
**Date:** 2026-06-10 · **Branch:** `stepup/main` @ HEAD `5cf9e64e` · **Working tree:** 512 D / 410 M / 76 ?? (temporal triplication: `main` = deployable+condemned, `HEAD` = +30, working tree = hardened end-state, uncommitted, zero git history).
**Authority basis:** `_PREMISES_SEED.md` reconciliation (V1/Freeze *content* supreme per user; Constitution + root AGENTS_V2 + Canonical Systems = its promoted embodiment) + the 6 REPOSITORY_TRUTH_AUDIT_2026_06_10 axis reports, re-read through the single lens **"where does the artifact disagree with the architecture?"**

---

## 1. Executive Summary

**"Architecture" here is one sentence** (`LETBUYY_CONSTITUTION.md` §3/§6, `AGENTS.md:60`): a **one-region modular monolith** (`api-gateway`) + 4 satellites (`queue-workers`, `mobile-bff`, `identity-platform`, `webhook-service`) + Next read/admin apps + **one** ops console over **one** RLS+GUC Postgres; **canonical double-entry ledger** as sole money truth; **identity-platform sole asymmetric issuer**; **fail-closed RLS+FORCE+GUC**; **Liquid-first** themes; **10,000-merchant envelope, never 100k+/1M+**; 4 frozen apps de-deployed; 6 reserved services manifest-only; **0% fee, never custody**.

The decision layer is, for the first time, coherent and singular. **The drift is everywhere the rest of the repository has not caught up to it** — and, uniquely, in **the validators that are supposed to enforce it but instead mandate the architecture the Constitution explicitly rejects.**

**This phase registers 41 distinct drift instances** spanning six surfaces. The five highest-order facts:

1. **The architecture is uncommitted; the deployable reality is its negation.** Every winner (asymmetric identity, canonical money paths, RLS-GUC role, commission-zero, 4-app de-deploy) lives only in the working tree with **zero git history**; `main` (the only deploy branch) and `HEAD` still encode the condemned regime. Almost every "CODE != ARCH" drift below is really "the *fix* is real but un-shipped, and the *shipped* code is the drift." This is the master multiplier — **root cause `executed-but-uncommitted` touches 11 of 41 drifts.**

2. **The new gate self-mandates the rejected multi-region architecture** (the special case, §9). Two validators *in the canonical gate* — `whole-repo-end-state-validator.mjs:171-177` and `survivability-governance-validator.mjs:94-107` — **hard-require** `globalRegions: [india, apac, eu, us]`, failover pairs with RTO/RPO, and `validate:survivability` in 3 CI workflows. The Constitution it claims to enforce **forbids exactly this** (§5.3 "validators … may not certify … multi-region survivability"; §6 one region; Never-Build #3). The original GATE-1 self-block was inverted at the root, then **reborn in new clothes** in the end-state law.

3. **A fabricated multi-region claim sits inside the canonical topology file.** `config/runtime/production-topology.json:34-39` declares 4 `globalRegions` while the same file admits `mode: governance-contract-not-live-evidence` (`:6`) and `multi-region-runtime.json` declares `letbuyy-apac/eu/us` queue namespaces that exist in **no** wrangler/terraform config. The topology JSON asserts capacity that does not exist and a topology the Constitution voids.

4. **Two full second-systems still ship inside the "monolith" topology.** (a) `apps/merchant-control-plane` carries **~62 `/api/stores/[store]/*` + ~9 `/api/themes/*`** route handlers duplicating gateway-owned commerce domains — a *second backend* against ART-04 "all commerce capabilities live in the monolith." (b) The gateway itself carries **3,941-line GraphQL + 623-line extension-host + previous-product `/portfolio` & `/resume` routers** (`index.ts:738-739`) — production-dark or product-dead code inside the frozen-scope monolith.

5. **Stale generated artifacts are frozen falsehoods in living space.** ~42 `docs/**/README.md` "intelligence" docs (stamped `generate-repository-intelligence.mjs ON 2026-06-08`) still assert `letbuyy.store`, "19 migrations" (real: 166), and deleted packages; the generator is hard-retired (`exit 1`) so they **can never be refreshed** — permanent stale law. ~55 Codex mission prompts (Phase 6 axis) still declare the 7 deleted rejected packages "✅ Stable" and command building frozen apps + `.store` CI. The reserved-service manifests carry **sed-garble** ("service-owned read planners and service-owned read planners") *and* embed CQRS/projection/replay/regional ownership fields — the rejected vocabulary fossilized into the canonical reserved roots.

**Net:** the architecture is right; **the repository around it is a museum of every prior architecture, and the enforcement layer actively defends one of them.** Convergence is overwhelmingly *delete/archive/commit/retarget*, not design — but two self-mandating validators must be **repealed by ARB** before the topology files can be made honest, or the gate will block its own truth.

---

## 2. Method — what "architecture" is (authority reconciliation)

Per `_PREMISES_SEED.md`:
- **User-declared supremacy:** EXECUTABLE_ARCHITECTURE_V1 > FINAL_ARCHITECTURE_FREEZE > AGENTS.md.
- **In-repo embodiment:** V1+Freeze were absorbed verbatim into `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (Articles ART-01…24, §9) which self-declares "RATIFIED. SUPREME."; AGENTS_V2 was promoted to root `AGENTS.md`; `LETBUYY_CANONICAL_SYSTEMS.md` is the winner registry.
- **Reconciliation rule used here:** treat the **V1/Freeze content as the architecture**, read through the Constitution + AGENTS_V2 + Canonical Systems as its promoted form. Where a Constitution clause and the V1/Freeze content agree (they do, by construction of §9), I cite the Constitution Article/§ as the rule. The **uncommitted + unratified** status (`SKIPPED_HUMAN_DECISIONS.md:5` SKIP-GATE1-ARB-RATIFICATION) is treated as a first-class risk, not a blocker to naming drift. Convergence assumes commit+ratify at Phase 0.

**A "drift" is logged when an artifact (code / doc / prompt / validator / migration / topology config) asserts, enforces, builds, or depends on something the architecture forbids, replaces, freezes, or supersedes.** Every row gives: architectural rule → drift (path:line) → root cause → impact → convergence-level fix → priority. Evidence is carried forward from the 6 axis reports (all claims there were code-verified at file:line) plus this phase's direct re-verification of the load-bearing items (validators, topology JSON, reserved manifest, second-backend routes, gateway routers — §§9, verified below).

**Priority key:** P0 = ships/enforces a forbidden architecture *now* or blocks its own convergence; P1 = contradicts canon and will mislead an agent/operator into rebuilding a loser; P2 = stale/duplicate drift, low blast radius but pollutes the truth; P3 = cosmetic naming drift inside otherwise-correct artifacts.

---

## 3. DRIFT REGISTER (master table, priority-ordered)

> Surface key: **C**=code, **D**=docs, **P**=prompts, **V**=validators, **DB**=database, **T**=topology/config. Root-cause key: **UC**=executed-but-uncommitted, **SG**=scan-generated-from-drift, **SMV**=self-mandating-validator, **NCL**=never-converged-legacy, **SED**=sed/mechanical-garble, **DUP**=duplicate-system-coexistence.

| # | Pri | Surf | Architectural rule (cite) | Drift (path:line) | Root cause |
|---|-----|------|---------------------------|-------------------|-----------|
| D01 | P0 | V | Const §5.3 validators may NOT certify multi-region survivability; §6 one region; Never-Build #3 | `whole-repo-end-state-validator.mjs:171-177` asserts `globalRegions` ⊇ {india,apac,eu,us}; `:185-191` mandates `validate:survivability` in 3 workflows | SMV |
| D02 | P0 | V | same | `survivability-governance-validator.mjs:94-95` requires 4 regions; `:98-102` requires failoverPairs RTO/RPO; `:106-107` requires `globalRegions.length>=4` | SMV |
| D03 | P0 | T | Const §6 one region; ART-04 one PostgreSQL ap-south; Never-Build #3 | `config/runtime/production-topology.json:34-39` `globalRegions:[india,apac,eu,us]` inside the canonical topology file (self-labels `mode:governance-contract-not-live-evidence` `:6`) | SMV/UC |
| D04 | P0 | T | Const §3/§6 honesty; ART-04 | `config/runtime/multi-region-runtime.json:4-60` 4 regions + failoverPairs + `letbuyy-apac/eu/us` queue namespaces absent from all wrangler/terraform | NCL |
| D05 | P0 | C | ART-04 "all commerce capabilities live in the monolith"; Canonical Systems "one system per domain" | `apps/merchant-control-plane/src/app/api/stores/[store]/*` ~62 routes + `/api/themes/*` ~9 routes = second backend (products/orders/inventory/taxes/coupons/billing/payment-config) | DUP |
| D06 | P0 | DB | Const §4.4 0% fee permanent; ART-12 no GMV/transaction fee | `main`+`HEAD` ship 300 bps: `119_mobile_money_ledgers.sql:81,108` DEFAULT 300; `payouts.ts ?? 300`; `commission.ts commission_bps:300`. 0-bps fix (mig 162 + code) is **untracked** | UC |
| D07 | P0 | C | ART-05/identity sole asymmetric issuer; §4 fail-closed | `main`/`HEAD` gateway `/custom/sessions/create` mints `randomHex(32)` opaque tokens, no JWKS verify; `/api/auth/switch` mints session for any `email_verified` user (account-takeover). Asymmetric fix untracked | UC |
| D08 | P0 | C | Const §4 canonical ledger = sole money truth; ART (ledger SSOT) | `confirm_order_payment_with_ledger` (000_baseline.sql:1590) writes **zero** ledger lines — the path every shopper hits; 2 of 3 refund paths un-ledgered (orders.ts:1294, webhook refund) | NCL |
| D09 | P0 | DB | ART-02/§14 migrations are law; deploy-from-clean-HEAD must equal canon | mig 162–166 + 5 rollbacks **untracked**; `supabase db push` from clean HEAD silently omits the 4 CRITICAL fixes (commission-zero, RLS leak, app_tenant GUC, canonical money paths) | UC |
| D10 | P0 | V | Const §5.5 fail-closed tenancy; ART-08/09 RLS default-deny | `migration-safety-validator.mjs:28` scans `getTrackedFiles()` only → structurally blind to untracked 162–166; `rls-force-coverage-validator.mjs:11` `readFile`s untracked 164 → **errors in clean CI** | SMV/UC |
| D11 | P1 | DB | Const §3.6/§4 single source of truth; canonical append-only ledger | Mutable money model coexists: `wallet_ledger_entries`/`payout_statements`/`commission_*` (mig 119) + `gift_card_accounts.balance`/`store_credit.balance_minor` mutated in place vs append-only `ledger_*` (mig 139) | DUP |
| D12 | P1 | DB | Const §5.5 RLS default-deny; ART-08 | 25 PUBLIC/anon `USING(true)`/`WITH CHECK(true)` policies survive final state outside the 12-table validator allowlist (e.g. `gift_cards`, `pages`, `collections`, `onboarding_attempts`, `ai_usage` service_role_* policies missing `TO`) | NCL |
| D13 | P1 | C | Const §3.6 single source of truth; ART-08/09 tenant boundary | 664 `getSupabaseAdmin()` service-role sites + raw-REST `supabaseServiceHeaders` fetch bypass the Proxy guard; `no-blanket-service-role-validator` polices 1 wrapper + apps/ literal only | NCL |
| D14 | P1 | C | Const §7 not a third-party app/extension platform now; ART-16/22; Never-Build #8 | gateway `extensions/` 623-line extension-host + 3,941-line GraphQL layer ship in monolith, `FEATURE_GRAPHQL/EXTENSIONS=false` in prod only (`wrangler.toml:243-245`) — frozen scope present as live code | NCL |
| D15 | P1 | C | ART-17 Liquid-first canonical renderer | React renderer is the runtime default (22–24 section types, 2 React/JSON editors); Liquid path `FEATURE_LIQUID=false` in prod; no Liquid header/footer, no data binding, index-only template | NCL |
| D16 | P1 | D | Const §5.3/§6; ART-19/23 reserved services not filled; Never-Build | `docs/audit/13-final-architecture-blueprint.md:23-24` activates all 6 reserved services + `extension-runtime ◇ WASM`; `docs/commerce-os-audit/10_BILLION_DOLLAR…ROADMAP.md:14` "multi-region read scale" | NCL |
| D17 | P1 | D | Const §6 one region; Never-Build #3; ART-23 | `docs/governance/multi-region-runtime-governance.md:3-19` declares APAC failover region as **present-tense law**, cited as authority by reserved runtime manifests | NCL |
| D18 | P1 | D | ART-23 CQRS/saga/replay/projection deleted | `docs/governance/runtime-composition-governance.md:15,22` routes app composition through `runtime-composition → application-services` — both V1-rejected, deleted packages | NCL |
| D19 | P1 | D | Const §6; ART-23; Never-Build #2,#3 | `docs/governance/{failover,failover-certification,chaos,chaos-engineering,chaos-certification,distributed-execution-survivability,replay-safety,shadow-traffic,global-operations,sre-certification}-governance.md` survive as live law (4 are *required to exist* by D02 validator) | NCL/SMV |
| D20 | P1 | P | ART-23 rejected packages deleted; `governance-common.mjs:142-150` rejectedPackageRoots | `docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT.md:40-45`, `CLAUDE_OPUS_MASTER_PROMPT.md:97-107` declare all 7 deleted packages "✅ Stable"; `CLAUDE_OPUS_MASTER_PROMPT` is a **prompt factory** seeding the rejected worldview | NCL |
| D21 | P1 | P | ART-16/22 create-nothing; Never-Build #8 | `docs/Codex_waves/CODEX_EXTENSION_PLATFORM_MISSION.md:5,54` instructs **creating** `packages/extension-host` + `packages/app-engine` (both deleted/rejected) | NCL |
| D22 | P1 | P | ART-22 frozen apps de-deployed | `LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md:139`, `CODEX_DEVELOPER_APP_FOUNDATION_PROMPT.md:21-26`, `CODEX_THEME_MARKETPLACE_GA_CLOSURE_MISSION.md:64` command building/scaffolding frozen `developer-portal`/`theme-marketplace` + `developers.letbuyy.store` | NCL |
| D23 | P1 | P | LEG-077 `.store` literal ban; canonical domain letbuyy.com | `docs/Codex_waves/CODEX_ENV_CLEANUP_MISSION.md:34` rewires CI to `*.staging.letbuyy.store`; `CODEX_MOBILE_PARITY_MISSION.md:65-66` pins `api.letbuyy.store/v1` | NCL |
| D24 | P1 | T | ART-22 frozen apps de-deployed from active topology | `staging-deploy.yml:189-200` deploys `theme-marketplace`, `app-marketplace`, `platform-operations-portal` (3 of 4 frozen) to staging | NCL |
| D25 | P1 | T | ART-22 frozen not production deploy targets | `config/vercel/projects.json:79-137` declares prod project IDs + URLs (`apps/developers/themes/ops.letbuyy.com`) for all 4 frozen apps; at HEAD `production-deploy.yml` matrix still lists all 9 apps | UC/NCL |
| D26 | P1 | V | ART-01 no competing authority; canon supreme | `tasks/todo.md:9-13` + `memory/lessons.md` (dated 2026-03-01, dead topology) are **mandated reading** by `AGENTS.md` AGENT-R16:380 while LEG-078 sentences `memory/lessons.md` to DELETE — law requires reading what it deletes | SG/NCL |
| D27 | P1 | C | Const §3 mock-by-default honest-always; ART-20 stub≠success | gateway payout `initiateTransfer` throws `PayoutProviderUnavailable` (no provider client) — merchants cannot be paid; step-up is `mock-step-up-${uuid}` self-served theater guarding refund/payout/DSR-erase | NCL |
| D28 | P2 | D | ART-04 8-runtime topology; canonical domain letbuyy.com | ~42 `docs/**/README.md` "intelligence" docs (`generate-repository-intelligence.mjs ON 2026-06-08`) assert `letbuyy.store`, "19 migrations", deleted `search-core`/`extension-host`; generator hard-retired (`exit 1`) → unrefreshable | SG |
| D29 | P2 | DB | Const §3.6 single source; mutating financial history forbidden by append-only premise | `162_phase_a_commission_zero.sql:14-22` (untracked) issues bare `UPDATE` rewriting settled commission rows in place — no ledger entry, in an append-only-ledger system | UC/NCL |
| D30 | P2 | DB | one-system-per-domain; index hygiene | duplicate unique partial index on `payment_transactions(gateway, provider_payment_id)`: `107:135` and `142:148` functionally identical (SKIP-D11 defers drop) | NCL |
| D31 | P2 | DB | ART-24 gated deletion; §6 no dead weight | zero `DROP TABLE` in the entire 073→166 forward chain → product-dead tables (`portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements`) physically defined forever | NCL |
| D32 | P2 | V | ART-02 validators enforce canon, not theater | 6 `validate:*` aliases (`distributed-execution`, `durable-execution`, `distributed-survivability`, `operational-certification`, `replay`, `survivability-intelligence`) all → `no-scan-generated-agents-validator.mjs` — green names asserting coverage that isn't checked | NCL |
| D33 | P2 | V | ART-02 one coherent suite | ~10–11 orphan validators referenced nowhere (`custom-domain-reconciler`, `registrar-provider`, `vercel-domain-automation`, `shopper-identity-seam`, `mobile-domain-parity`, …) | NCL |
| D34 | P2 | C | Const §4.4 0% fee; canonical ledger SSOT | app-marketplace 15% platform fee (`billing-core:458-459`) + partner payouts (`partner_payout_ledger_entries`) sit **outside** the canonical ledger (intentional exemption, but a second money system) | DUP |
| D35 | P2 | D | ART-01 canon supreme; one reading order | `docs/agents/AGENTS.md:7-14,43` self-declares "Mandatory Reading Order" + "regenerate repository intelligence" (retired); subagent briefs own `apps/web/consumer/admin` (dead) | SG/NCL |
| D36 | P2 | D | ART-04 8-runtime law + frozen markings | `docs/governance/repository-topology.md:9-23` presents 12-app "Canonical Topology" with no frozen/pending markings | SG |
| D37 | P2 | C | ART-04 monolith owns commerce; no product residue | previous-product residue: gateway `/portfolio` `/resume` routers (`index.ts:738-739`); merchant-control-plane `ats-score`/`projects`/`certifications`/`skills` pages; storefront `/demo/urban-kicks`; firebasestorage whitelisted | NCL |
| D38 | P3 | T | ART-04 names `apps/identity-platform` | `AGENTS.md:73` names runtime `services/identity-platform` (no such dir; every config keys `apps/identity-platform`) — naming drift inside canonical law | SED |
| D39 | P3 | T | one representation of "frozen" | `deployment-topology.json` omits frozen apps as nodes while `production-topology.json:202-233` lists them as frozen rows — inconsistent sibling files | NCL |
| D40 | P3 | C/T | ART-19 reserved manifests honest | reserved `runtime.manifest.json` sed-garble: `checkout-runtime:13` "payment service-local event helpers entrypoints"; `:83` "service-owned read planners and service-owned read planners"; CQRS/projection/replay/regional ownership fields fossilize rejected vocab; `governanceDocs` cite multi-region/failover/chaos docs (`:21,22,27`) | SED |
| D41 | P3 | C | tsconfig build-graph integrity | `tsconfig.workspace.json:68` references `./packages/typescript/utils` — nonexistent on disk and at HEAD; workspace `tsc -b` cannot succeed | NCL |

---

## 4. CODE != ARCHITECTURE (detail)

**Rule spine:** ART-04 (one modular monolith owns all commerce; one ops console); §3.6 (single source of truth, "two of everything is a constitutional defect"); §4 (canonical ledger sole money truth, Liquid-first); ART-05/identity sole asymmetric issuer; §3 mock-honest, stub≠success; Never-Build #8 (no app/extension platform now).

- **D05 — Second backend in merchant-control-plane (P0, DUP).** *Rule:* ART-04 "All commerce capabilities live **in the monolith**." *Drift:* `apps/merchant-control-plane/src/app/api/stores/[store]/*` carries write-capable handlers for products/orders/inventory/taxes/coupons/billing/payment-config (~62 routes, verified: `media/`, `coupons/`, `notifications/`, `upload/` route.ts present with GET/POST/PATCH/DELETE exports) **plus** `/api/themes/*` (~9: editor, draft, sections, releases, rollback, publish, install, preview-session). These domains are *also* mounted in api-gateway (`/products`, `/orders`, `/themes`, `/billing`). **Two writers per domain across two runtimes.** *Root cause:* DUP (a Next-app backend that was never collapsed into the monolith). *Impact:* violates the load-bearing "one system per domain"; doubles the attack surface and the money/tenant-enforcement surface. *Fix:* **retarget** — per-page call-graph trace, then delete the merchant-control-plane API routes whose gateway equivalent is authoritative (blocked on the trace the CODEBASE_REALITY report flagged as out of scope). *Priority:* P0.

- **D07 — randomHex sessions + account-takeover are what deploys (P0, UC).** *Rule:* ART-05 identity-platform sole asymmetric (ES256/EdDSA) issuer; §4 fail-closed. *Drift:* at `main`/`HEAD`, gateway `/custom/sessions/create` mints `randomHex(32)` opaque tokens with no JWKS verification, and `/api/auth/switch` mints a session for **any** `email_verified` user (the SEC-C1 account-takeover, quoted in IDENTITY_TRUTH §2 from `git show main:`). The asymmetric mint + verifier + switch-fix exist **only** in the untracked working tree. *Root cause:* UC. *Impact:* the live identity plane is the insecure one until a deploy from the working tree lands. *Fix:* **commit** the working tree (Phase 0) then deploy; nothing to design. *Priority:* P0.

- **D08 — Storefront capture writes no ledger (P0, NCL).** *Rule:* §4 canonical ledger is the sole money truth; ledger is the SSOT winner (`_PREMISES_SEED` money-capture row). *Drift:* `confirm_order_payment_with_ledger` (`000_baseline.sql:1590`) — the path every shopper hits — flips `orders.payment_status`, upserts `payment_transactions`, inserts `payment_attempts`, and writes **zero** `ledger_entries` (the `_with_ledger` suffix is naming theater). 2 of 3 refund paths (`orders.ts:1294` → `complete_order_refund`; webhook `refund.created`) are likewise un-ledgered. *Root cause:* NCL — the canonical ledger was added (mig 139) but the legacy storefront RPC was never rebound to it. *Impact:* the dominant customer money path is off-ledger; **survives any commit/merge** (genuine capability gap, not convergence-fixable). *Fix:* name it; the fix is real engineering (rebind `confirm_order_payment*` to `post_ledger_transaction`), out of convergence scope. *Priority:* P0 (flagged, not convergence-resolved).

- **D13 — service-role bypass vs single tenant boundary (P1, NCL).** *Rule:* §5.5 fail-closed tenancy; §3.6 single source. *Drift:* 664 `getSupabaseAdmin()` server sites (RLS-bypassing service-role) rely on a pattern-based `Proxy` guard that only covers registry tables; raw-REST helpers (`supabaseServiceHeaders` + `fetch`, `supabase-adapter/index.ts:65-150`) bypass the Proxy entirely; `middleware/auth.ts`+`routes/auth.ts` construct a **raw** unguarded service client. `no-blanket-service-role-validator` asserts only the one wrapper + an apps/ literal ban. *Root cause:* NCL — the RLS-GUC role (`app_tenant`, mig 164) is the intended boundary but most server code still goes through service-role, not `withTenantTx`. *Impact:* the runtime tenant-isolation surface is far larger than the validator bounds. *Fix:* **retarget** code to `withTenantTx`/`app_tenant` (engineering) + extend the validator; convergence can delete the raw-REST helpers once callers migrate. *Priority:* P1.

- **D14/D15 — production-dark GraphQL/extension-host + React-default renderer vs frozen scope (P1, NCL).** *Rule:* ART-16/22 + Never-Build #8 (no extension/app platform now); ART-17 Liquid-first. *Drift:* the 3,941-line GraphQL layer + 623-line extension host ship in the gateway behind `FEATURE_GRAPHQL/EXTENSIONS=false` (prod) / `true` (staging) (`wrangler.toml:243-245`); the **React** renderer is the runtime default with 2 React/JSON editors while `FEATURE_LIQUID=false` in prod and the Liquid path has no header/footer, no data binding, index-only template (THEME_PARITY). *Root cause:* NCL — frozen-scope machinery present as code; Liquid winner not deletion-ready. *Impact:* large frozen surfaces masquerade as latent features; the ratified renderer winner is not actually the runtime. *Fix:* convergence = archive/flag-delete the extension+GraphQL surfaces (or keep as explicit seam, not code); React deletion is **blocked** until Liquid parity (name as gap). *Priority:* P1.

- **D27 — no payout client + mock step-up (P1, NCL).** *Rule:* §3 mock-honest, ART-20 stub must never read success. *Drift:* `initiateTransfer` unconditionally throws (no `PayoutProviderClient` exists) → merchants cannot be paid; `/security/step-up/challenges` mints `mock-step-up-${uuid}` and marks `verified` immediately; verification only checks token length ≥12 + a timestamp window — the "step-up" guarding refund/payout/DSR-erase is satisfied by any self-served mock token. *Root cause:* NCL (genuine gap; `_PREMISES_SEED` gaps #2/#3). *Impact:* survives any merge. *Fix:* name as gap; not convergence-resolvable. *Priority:* P1.

- **D37/D41 — previous-product residue + dangling tsconfig ref (P2/P3, NCL).** gateway `/portfolio` `/resume` routers (`index.ts:738-739`, verified), merchant-control-plane resume/portfolio pages, storefront `/demo/urban-kicks`, firebasestorage remotePattern; `tsconfig.workspace.json:68` → nonexistent `packages/typescript/utils`. *Fix:* delete residue routers/pages; remove the dangling reference.

---

## 5. DOCS != ARCHITECTURE (detail)

**Rule spine:** §5.3/§6 (no certifying/asserting multi-region or reserved-service activation); §6 one region; ART-23 (CQRS/saga/replay/projection deleted); AGENTS.md AUTH-R2 (history lives only under `docs/archive/`); canonical domain `letbuyy.com`.

- **D16 — replatform blueprints live in docs (P1, NCL).** `docs/audit/13-final-architecture-blueprint.md:23-24` "Final Target Architecture Blueprint" activates `search-service ◇ media-service ◇ checkout-runtime ◇ notification-service ◇ analytics-pipeline ◇` **plus** `EXRT[extension-runtime ◇ WASM]` — every item on the Never-Build list; `docs/commerce-os-audit/10_BILLION_DOLLAR_COMMERCE_OS_IMPLEMENTATION_ROADMAP.md:14` targets "multi-region read scale." *Fix:* `git mv` both doc sets to `docs/archive/`. *Priority:* P1.

- **D17/D18/D19 — multi-region/CQRS/chaos governance survivors (P1, NCL).** 38 theater docs were archived; ≥10 equally contradictory ones were left live: `multi-region-runtime-governance.md:3-19` (APAC failover as present-tense law, cited by reserved manifests), `runtime-composition-governance.md:15,22` (routes through 2 deleted packages), and the `failover/chaos*/distributed-execution-survivability/replay-safety/shadow-traffic/global-operations`-governance family. **4 of these are *required to exist* by the D02 survivability validator** — so they cannot be archived until the validator is repealed (the self-mandate, §9). *Fix:* repeal D01/D02, then `git mv` the family to `docs/archive/governance-theater-2026-06-10/`. *Priority:* P1.

- **D28/D35/D36 — ~42 stale generated intelligence docs (P2, SG).** `docs/architecture/master-system-intelligence.md` + `docs/architecture/README.md` + ~40 sibling `docs/*/README.md` (stamped `generate-repository-intelligence.mjs ON 2026-06-08`) assert `letbuyy.store` mermaid hosts, "19 migrations" (`:14`, real 166), deleted packages (`search-core`/`extension-host`), and `FORENSIC_REPORT/*` rows that no longer exist. The generator is **hard-retired** (`exit 1`) so these are permanently frozen falsehoods. `docs/agents/` (22 rule files + 19 subagent briefs, "Last analysis 2026-05-24") self-declares a "Mandatory Reading Order" and "regenerate repository intelligence." `docs/governance/repository-topology.md:9-23` shows a 12-app topology with no frozen markings. *Root cause:* SG (scan-generated from the drifted pre-canon state). *Fix:* delete/archive the generated tree + `docs/agents/`; convergence-only. *Priority:* P2.

- **D26 — the live instruction loop reads 2026-03-01 fossils (P1, SG/NCL).** `AGENTS.md` AGENT-R16:380 mandates reading `memory/lessons.md` + `tasks/todo.md` before any edit; both are dated 2026-03-01, describe a topology two generations gone (`backend/workers/api`, `apps/web/consumer/admin`), and `tasks/todo.md:9-13` records "generate root AGENTS.md from repository scan" as the completed playbook — the exact act the live law (`no-scan-generated-agents-validator`) forbids. `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:216` (LEG-078) sentences `memory/lessons.md` to DELETE: **the law mandates reading what it deletes.** *Fix:* rewrite/archive both files and amend AGENT-R16 to point at living equivalents. *Priority:* P1.

---

## 6. PROMPTS != ARCHITECTURE (detail) — cross-ref Phase 6 PROMPT_DRIFT

**Rule spine:** ART-23 (rejected packages deleted, `governance-common.mjs:142-150`); ART-16/22 (create nothing; frozen apps de-deployed); LEG-077 (`.store` ban); ART-01 (no competing authority).

Phase 6 (PROMPT_DRIFT_REPORT) inventoried ~55 at-large mission prompts under `docs/`; this phase cites the **architecture rule each violates**:

- **D20 — rejected packages declared "✅ Stable" (P1).** *Rule:* ART-23 + rejectedPackageRoots. *Drift:* `docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT.md:40-45,59` and `CLAUDE_OPUS_MASTER_PROMPT.md:97-107` list all 7 deleted packages (`app-engine`, `application-services`, `distributed-runtime`, `orchestration`, `projection-runtime`, `runtime-composition`, `extension-host`) + `services/event-bus` as canon. `CLAUDE_OPUS_MASTER_PROMPT.md` is a **prompt factory** (`:6` "Attach the entire `docs/Codex_waves/` folder") that mass-generates new missions from the rejected worldview — highest-leverage prompt drift (manufactures violations).
- **D21 — mission to CREATE rejected packages (P1).** `CODEX_EXTENSION_PLATFORM_MISSION.md:5,54` "OWN: packages/extension-host/** (create), packages/app-engine extension contracts" — both deleted/rejected; would fail `no-rejected-package-imports-validator`.
- **D22 — build frozen apps (P1).** `LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md:139`, `CODEX_DEVELOPER_APP_FOUNDATION_PROMPT.md:21-26`, `CODEX_THEME_MARKETPLACE_GA_CLOSURE_MISSION.md:64` (incl. "Live DB apply / deploy" to prod) command scaffolding/GA-ing frozen `developer-portal`/`theme-marketplace` against ART-22.
- **D23 — `.store` CI rewiring (P1).** `CODEX_ENV_CLEANUP_MISSION.md:34` rewires `.github/workflows/*` to `*.staging.letbuyy.store`; `CODEX_MOBILE_PARITY_MISSION.md:65-66` pins `api.letbuyy.store/v1` — re-poisons CI with the banned dead domain (LEG-077).

*Root cause (all):* NCL — June-05/06 wave prompts never archived after the canon rewrite; the enforcement perimeter is the **root directory only**, and `docs/` became the unpoliced dumping ground (evasion documented at `CODEX_INTERNAL_OS_FOUNDATION_STATUS.md:20`). *Fix:* convergence = `git mv docs/Codex_waves/` and the audit-dir mission sets into dated `docs/archive/`; optionally extend `whole-repo-end-state-validator` to fail on `*MISSION*`/`*PROMPT*` outside `docs/archive/`. *Priority:* P1 for the create/build/`.store` prompts; the factory (D20) is the keystone.

---

## 7. VALIDATORS != ARCHITECTURE (detail)

**Rule spine:** §5.3 ("Validators must enforce *this* Constitution, never the rejected end-state … may **not** certify … multi-region survivability, partition recovery, CQRS, chaos"); ART-02 (theater validators deleted, real-invariant kept); §5.2 (enforceable contracts, not green theater).

This is the surface where the architecture is not merely *un-enforced* but **actively contradicted by its own enforcer** (full treatment in §9). Summary rows:

- **D01/D02 — the self-mandate (P0, SMV).** Two gate validators require the 4-region multi-region contract + failover + survivability CI. **Verified this phase** (file:line below in §9). Repeal-required.
- **D10 — validators blind to / dependent on untracked migrations (P0, SMV/UC).** `migration-safety-validator.mjs:28` scans `getTrackedFiles()` → cannot see the highest-risk untracked migrations 162–166 (they could hide any hazard and pass); `rls-force-coverage-validator.mjs:11` directly `readFile`s untracked `164_d4_tenant_role_guc.sql` → passes on the dirty tree but **errors in a clean HEAD checkout**. The governance suite currently depends on an uncommitted file existing on disk. *Fix:* commit 162–166 (resolves both). *Priority:* P0.
- **D32 — 6 theater aliases (P2, NCL).** `validate:distributed-execution|durable-execution|distributed-survivability|operational-certification|replay|survivability-intelligence` all → `no-scan-generated-agents-validator.mjs`: six green names asserting distributed/replay/survivability coverage that is never checked. Honesty hazard. *Fix:* delete the aliases or rename to truth.
- **D33 — ~10–11 orphan validators (P2, NCL).** referenced nowhere (`custom-domain-reconciler`, `registrar-provider`, `vercel-domain-automation`, `shopper-identity-seam`, `mobile-domain-parity`, `observability-producer`, `replayable-secret-persistence`, `contracted-domain-event-ingress`, `gateway-events-client`, `custom-domain-abuse-screening`). *Fix:* delete or wire.

---

## 8. DATABASE != ARCHITECTURE (detail)

**Rule spine:** §4/§3.6 (canonical append-only ledger = sole money truth, single-source); §5.5/ART-08/09 (RLS default-deny, FORCE+GUC); ART-24 (gated deletion, no dead weight kept indefinitely); ART-02/§14 (migrations are law; clean-HEAD deploy must equal canon).

- **D06/D29 — commission rake + in-place financial rewrite (P0/P2).** `main`+`HEAD` default **300 bps** (`119:81,108`; `payouts.ts ?? 300`; `commission.ts 300`) against §4.4/ART-12 0%-fee. The 0-bps end-state is **untracked** (mig 162 + code + `commission-bps-zero-validator`). Worse, mig `162:14-22` (untracked) issues a bare `UPDATE … SET commission_bps=0` rewriting **settled** commission rows in place — mutating financial history with no ledger entry, in a system whose premise is an append-only ledger. *Fix:* commit 162 + code (D06); for D29, name the in-place rewrite as an audit contradiction to resolve before apply.
- **D09 — uncommitted 162–166 vs deploy reality (P0, UC).** `supabase db push --include-all` from a clean HEAD checkout silently omits the 4 CRITICAL fixes (commission-zero, live-data-leak RLS, app_tenant GUC, canonical money paths) + the checkout authority (166). Their effect exists only on one dirty working tree. *Fix:* commit (Phase 0).
- **D11 — mutable wallet/commission model coexists with canonical ledger (P1, DUP).** `wallet_ledger_entries`/`payout_statements`/`commission_*` (mig 119) + `gift_card_accounts.balance`/`gift_cards.balance`/`store_credit.balance_minor`/`ai_credits.balance` are mutable-balance stores alongside the append-only `ledger_*` (mig 139); `dual_model_reconciliation_reports` + `money_ledger_site_reconciliations` exist precisely to reconcile the two — the "two parallel systems" anti-pattern in money. *Fix:* convergence = once canonical ledger is the wired truth, freeze→prove-zero-drift→delete the mutable model per ART-24 (DELETE_AFTER_MIGRATION gate); not a clean delete today (wallet read still derives from it).
- **D12 — 25 PUBLIC `USING(true)` vs RLS default-deny (P1, NCL).** static final-state replay finds 25 PUBLIC/anon `USING(true)`/`WITH CHECK(true)` policies surviving outside the 12-table validator allowlist — chiefly `service_role_*`-named baseline policies missing a `TO` clause (so they grant to PUBLIC: `gift_cards`, `pages`, `collections`, `onboarding_attempts`, `ai_usage`, `auth_password_set_intents`) — the exact `163` bug class, never fixed for these. *Fix:* extend the allowlist/migration to re-scope these off PUBLIC; convergence-adjacent (needs a migration, not a design).
- **D30 — duplicate provider_payment_id index (P2, NCL).** `107:135` and `142:148` create functionally identical unique partial indexes on `payment_transactions(gateway, provider_payment_id)`. SKIP-D11 defers the drop to a live window. *Fix:* drop one (deferred, acknowledged).
- **D31 — zero-DROP-TABLE additive chain leaves dead tables (P2, NCL).** the 073→166 forward chain has **zero** `DROP TABLE`; product-era dead tables (`portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements`) remain physically defined. *Fix:* a deletion migration after a live writer-probe (correctly deferred).
- **D34 — app-marketplace 15% fee outside the ledger (P2, DUP).** `billing-core:458-459` + `partner_payout_ledger_entries` form a second money system outside the canonical ledger (intentional exemption, but a coexisting money truth). *Fix:* name; out of 0%-fee scope (partner revenue, not merchant sale).

---

## 9. The Self-Mandating-Drift special case (validators enforcing the rejected architecture)

This is the single most important finding of the phase and the reason convergence cannot be pure delete/commit. **Verified directly this phase** against the working-tree validator source:

### 9.1 `whole-repo-end-state-validator.mjs` — mandates 4 regions + survivability CI
```
:171  reporter.assert(productionTopology?.canonicalDomain === "letbuyy.com", …);
:172  for (const region of ["india", "apac", "eu", "us"]) {
:173    reporter.assert(
:174      productionTopology?.regions?.globalRegions?.includes(region),
:175      `Production topology must include global region contract ${region}`,
:176    );
:177  }
:179  for (const workflow of [architecture-governance, production-rollout, live-production-certification]) {
:185    for (const fragment of ["pnpm run validate:survivability", …]) {
:191      reporter.assert(source.includes(fragment), …);
```
This validator **is the program's final acceptance gate** (D13-WHOLE-REPO-END-STATE) and **is in the gate lane**. It makes *removing* the 4-region contract a CI failure.

### 9.2 `survivability-governance-validator.mjs` — requires the multi-region runtime + failover + ≥4 regions
```
:10  requiredFiles = [ multi-region-runtime.json, chaos/run-chaos-evidence.mjs,
                       load/scenarios/internet-scale-load.json,
                       operational-resilience/deployment-proof/deterministic-runtime/infra-recovery-governance.md, … ]
:94  for (const region of ["india", "apac", "eu", "us"])
:95    reporter.assert(regionIds.has(region), `Multi-region runtime contract missing region: ${region}`);
:98  for (const pair of multiRegion?.failoverPairs || [])
:101    reporter.assert(pair.replayRequired === true, …);
:102    reporter.assert(Number(pair.rtoSeconds)>0 && Number(pair.rpoSeconds)>0, …);
:106  reporter.assert(productionTopology?.regions?.globalRegions?.length >= 4,
:107    "Production topology must project globalRegions from the multi-region runtime contract");
```
It also asserts the existence of `chaos/`, `load/internet-scale-load.json`, and four "operational-resilience/…" governance docs — i.e. **the elimination plan's own delete-targets are pinned alive by this validator** (which feeds D04, D17, D19).

### 9.3 The contradiction, stated against the architecture
- **Constitution §5.3:** validators "may **not** certify capabilities the Constitution forbids (**multi-region survivability**, partition recovery, CQRS, chaos for a distributed system that does not exist)."
- **Constitution §6 / Never-Build #3:** one region; "no … multi-region … is in scope … any artifact … that designs for 100,000+/1,000,000+ … is **out of scope by constitutional rule**."
- **ART-04:** one PostgreSQL on Cloudflare **ap-south**.

So the **gate that exists to enforce the Constitution requires three artifacts the Constitution voids**: the `globalRegions:[india,apac,eu,us]` block in `production-topology.json` (D03), the `multi-region-runtime.json` 4-region+failover contract (D04), and `validate:survivability` wiring in 3 CI workflows (which transitively pins the survivor chaos/failover docs, D17/D19).

### 9.4 Why it happened and the convergence move
**Root cause:** SMV (self-mandating validator), born from D12-D13-GATE-RESTORE — the program "restored survivability/production-certification gates" and "declared production global regions" with no ARB/skip entry covering the *decision to keep* (not delete) the survivability contract (`SKIPPED_HUMAN_DECISIONS.md` has no multi-region seam — UNVERIFIED whether directed or improvised). It is the **GATE-1 self-block reborn**: the original was "a validator asserts the drifted AGENTS.md must stay" (inverted at the root); this is "the end-state validator asserts the rejected topology must stay."

**Convergence (ARB-level, not design):**
1. **Repeal** D01/D02 — delete the 4-region asserts (`whole-repo-end-state-validator.mjs:172-177`, `survivability-governance-validator.mjs:94-107`) and the `validate:survivability` mandate (`:185-191`), or delete `survivability-governance-validator.mjs` outright (it is a theater validator per ART-02). **Requires an ARB repeal act** because the validator is self-protecting (removing the topology lines fails the gate; removing the validator requires editing the gate wiring).
2. Then **make honest** — delete `globalRegions` from `production-topology.json` (D03), `git mv multi-region-runtime.json` + the survivor governance docs to archive (D04/D17/D19), drop the `validate:*` survivability aliases (D32).
**Ordering matters:** the topology files cannot be made truthful until the validators are repealed, or the gate blocks its own convergence — the literal failure mode the Constitution §5.3 was written to end.

---

## 10. Root-Cause Taxonomy (counts — the systemic pattern)

41 drifts cluster into **6 recurring causes**. The count reveals the systemic shape: this is overwhelmingly a *persistence + convergence-lag* problem, not a design problem.

| Root cause | Code | What it means | Count | Drift IDs |
|---|---|---|---|---|
| **Never-converged legacy** | NCL | the architecture changed; this artifact was never archived/retargeted to match | **17** | D04, D08, D12, D13, D14, D15, D16, D17, D18, D19, D27, D30, D31, D33, D37, D39, D41 |
| **Executed-but-uncommitted** | UC | the *fix* is real but lives only in the untracked working tree; the *shipped* artifact is the drift | **8** | D03(also SMV), D06, D07, D09, D10(also SMV), D24(partial), D25, D29(also NCL) |
| **Scan-generated-from-drift** | SG | a generator (now retired) emitted this from the pre-canon drifted state; permanently stale | **4** | D26, D28, D35, D36 |
| **Self-mandating validator** | SMV | a validator in the gate enforces the rejected architecture / its own un-removability | **4** | D01, D02, D03, D10 |
| **Duplicate-system coexistence** | DUP | "two of everything" — a loser system was never deleted after the winner was named | **4** | D05, D11, D34 (+ the second-backend/second-money pattern recurs in D08/D13) |
| **Sed / mechanical garble** | SED | a mechanical find/replace (D11 package-deletion propagation) left nonsense or fossil vocabulary | **3** | D38, D40 (+ the manifest CQRS/projection fields) |
| **Prompts (NCL sub-cluster)** | NCL-P | the ~55-prompt corpus is one NCL instance with many heads | **(5 rows)** | D20, D21, D22, D23 (+ Phase 6's full ~55) |

*(Some drifts carry two causes — e.g. D03 is both UC and SMV; D10 is both. They are counted under the dominant cause for the taxonomy and cross-listed.)*

**The pattern in one line:** **NCL (17) + UC (8) = 25 of 41 drifts are "the architecture moved and the repository/branch did not follow it"** — pure convergence lag, fixed by archive/delete/commit/retarget with zero design. **SG (4) + SED (3) = 7 are generator/mechanical residue** — fixed by deletion. **The only drifts that need an *act of governance* rather than a janitor are the 4 SMV rows** (and the topology files they lock) — because a validator cannot be retargeted by the same convergence pass it is blocking; it needs ARB repeal first. **DUP (4)** is the deepest: deleting a coexisting money/backend/renderer system is gated (ART-24) on the winner being live + proven, which several winners are not yet.

---

## 11. Unknowns / UNVERIFIED

1. **Whether the multi-region `globalRegions`/survivability restoration was directed or program-improvised** — the D12 ledger records the act but `SKIPPED_HUMAN_DECISIONS.md` has no multi-region seam covering the *keep* decision. The contradiction (D01–D04) is verified; the *intent* is UNVERIFIED. This is the single decision the ARB must adjudicate to unblock convergence.
2. **Live deployment truth** — which topology actually serves production (one region or four), and whether 162–166 are already applied out-of-band. Repo evidence self-labels `mode: governance-contract-not-live-evidence`; all "live" claims are out of scope (no live DB/infra access).
3. **Per-page call-graph for D05** — exactly which of merchant-control-plane's `/api/stores/[store]/*` routes the UI calls vs the gateway equivalent was not exhaustively traced (both surfaces are routable); the delete set for the second backend depends on this trace.
4. **`_GOVERNANCE_SPINE.md`** — cited 26× across 5 canonical governance docs as the authority anchor; exists nowhere (no git history, no archive). The canon's own spine document is a dangling reference (carried from ARCHITECTURE_TRUTH §6.1) — not a drift *against* architecture but a hole *in* it; flagged for the governance phase.
5. **React-deletion readiness (D15)** — THEME_PARITY rates the Liquid winner not deletion-ready; whether convergence can flag-delete the React renderer or must keep it until Liquid parity is a theme-axis call, not resolvable here.
6. **Exhaustive `docs/governance/` content sweep** — the rejected-family survivors (D17/D19) were classified by title+grep+sampling; a per-file read of all ~85 survivors was not performed (carried from GOVERNANCE_TRUTH §9).
7. **Bash workspace contention** — the shared Linux mount intermittently blocked git/grep RPCs; all direct re-verifications in §§3–9 were captured via the file Read/Grep tools (validators, topology JSON, reserved manifest, second-backend routes, gateway routers, staging matrix) on successful calls.

---

*End of Phase 8 report. Discovery only — no remediation performed. The only file written is this report at `CONVERGENCE_AUDIT_2026_06_10/ARCHITECTURAL_DRIFT_REPORT.md`. Every file:line citation is a working-tree path unless prefixed `HEAD:`/`main:`; load-bearing items (the self-mandating validators, the topology JSON, the reserved manifest, the second-backend routes, the gateway product routers, the staging matrix) were re-verified directly this phase, the remainder carried forward from the 6 code-verified REPOSITORY_TRUTH_AUDIT_2026_06_10 axis reports.*
