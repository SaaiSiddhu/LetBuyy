# LETBUYY REPOSITORY TRUTH — MASTER REPORT

**Repository Truth Audit 2026-06-10 · FINAL SYNTHESIS**
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · branch `stepup/main` @ HEAD `5cf9e64e` ("fix(foundation): resolve final audit drift", 2026-06-10 08:42 +0530) · `main` @ `bf8c18c1` (2026-06-09, the **only** production deploy trigger, 30 commits behind) · working tree **512 deleted / 410 modified / 76→77 untracked** (wave-1 baseline 76 `??`; the 77th entry is this audit directory itself — verified `git status --porcelain` 2026-06-10).
**Mode:** DISCOVERY ONLY. This report synthesizes the 12 evidence-backed axis reports in this directory. No redesign, no roadmap. Every item traces to a report finding; citations carry `path:line` plus the source report. Required actions appear only as **what must become true**.

---

## 1. Executive Summary

**The headline is temporal triplication.** LetBuyy is three coexisting platforms in one repository: **`main`** (the only branch production CI deploys from — `production-deploy.yml:3-7`), **HEAD `stepup/main`** (+30 commits of waves 0–7), and the **uncommitted working tree** (Phases A–D13; every one of the 40 `EXECUTION_LEDGER.md` rows says "not committed"). For governance, identity, money, tenancy, themes, validators, deploy matrices, and mobile, these are three different systems with three different security postures (DUPLICATE_REALITY §1.1, §2). The only reality that conforms to the platform's own ratified canon is the working tree — and it is the only one with **zero version-control protection**.

**What's real.** A concentrated, genuinely substantial core: one backend monolith (`services/api-gateway`, 261 TS files / 84,549 lines / ~75 mounted prefixes) + 3 thin satellite workers + 5 production Next.js apps + 1 real Flutter app (CODEBASE_REALITY §1.1); a 92-file additive migration chain delivering 419 tables (DATABASE_TRUTH §3); a well-built append-only double-entry ledger kernel with balance-enforcing triggers (migration `139`, MONEY_TRUTH §1.1); a credible asymmetric identity topology — ES256/EdDSA sole-issuer with gateway JWKS verification (working tree only, IDENTITY_TRUTH §1); real RLS `FORCE` + `app_tenant` GUC tenancy (untracked `163/164`); DOMPurify+auto-escape theme sanitization (working tree, THEME_PARITY §3.2); a 90-validator governance gate that **passes** end to end (GOVERNANCE_TRUTH §7.2).

**What's theater.** Step-up authorization for refunds/payouts/DSR-erase is a self-served mock token, and its validator allowlists the mock (IDENTITY_TRUTH §7). `confirm_order_payment_with_ledger` — the function every shopper payment terminates in — writes **zero** ledger entries; the name is fiction (MONEY_TRUTH §2a, `000_baseline.sql:1590`). Prometheus rules alert on seven metrics nothing emits; otel exports to a Kubernetes cluster deleted from the repo; SLOs are assigned to empty reserved roots; no error-tracking SDK or alert channel exists anywhere (PRODUCTION_READINESS §3.10). Six `package.json` lanes named for distributed-execution coverage all run one scan-check validator (CODEBASE_REALITY §1.7). 36 mobile `/features/*` routes exist to satisfy validators and are navigable by no user (MOBILE_TRUTH §4). 67 generated "intelligence" docs are permanently frozen falsehoods — their generator now exits 1 by design (ARCHITECTURE_TRUTH §1.4).

**The commit trap.** 60 tracked root docs (including the constitutional sources V1 + Freeze) and 38 governance docs are staged-as-deleted while their only archive copies are **untracked**: a tracked-only commit (`git commit -am`) commits the deletions and orphans the archive; `git clean -fd` permanently destroys the Constitution, AGENTS_V2 source, the 15 ratifying ABRs, both 2026-06-10 archives, `EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`, migrations 162–166, and the only copies of seven prior audit programs — none of which has a single commit on any branch (GOVERNANCE_TRUTH §1.3–1.4, §6#8; ARCHITECTURE_TRUTH §3.2). A stale `stash@{0}` from a deleted branch waits to splice the old regime back in (GOVERNANCE_TRUTH §6#9; verified `git stash list`).

**Gate-passes-but.** The 90-validator gate is green on this machine — and structurally cannot mean what it claims. `rls-force-coverage-validator` reads **untracked** `164_d4_tenant_role_guc.sql` from disk: it passes on the dirty tree and would **error in a clean CI checkout** (DATABASE_TRUTH §9). `migration-safety-validator` iterates `getTrackedFiles()` only — structurally blind to the five highest-risk migrations (DATABASE_TRUTH §8). `canonical-ledger-only-validator` scans TS sources, so SQL money writers are invisible and `orders` isn't even in its table list (MONEY_TRUTH §4.2). And the program's own final acceptance check, `whole-repo-end-state-validator.mjs:172-193`, **mandates** the 4-region/survivability artifacts the Constitution forbids — the GATE-1 self-block reborn (ARCHITECTURE_TRUTH §1.2; GOVERNANCE_TRUTH §5.5). GitHub, meanwhile, still executes HEAD's 181-validator lane (GOVERNANCE_TRUTH §5.7).

**What survives any merge.** Even with everything committed, merged, deployed, and every human seam resolved, genuine capability holes remain: the storefront capture path and 2 of 3 refund paths are un-ledgered in **all three realities**; no payout provider client exists (`initiateTransfer` unconditionally throws — merchants can never be paid); reconciliation RPCs have zero runtime callers and the merchant wallet 409s forever; step-up is mock; mobile login double-spends its Turnstile token by design; Liquid — the constitutionally mandated renderer — cannot serve a real store (no header/footer, one template, no data binding, no canary write path, no editor awareness); OIDC is a 501 skeleton; the merchant-control-plane carries a 62-route second backend; 25 PUBLIC `USING(true)` policies survive outside every validator's allowlist; 34 of 64 mobile screens are unreachable (PRODUCTION_READINESS §8, C1–C18).

**Net verdict:** as-deployable today **2.3/10**; working-tree end-state **5.5/10**; repository health **3.1/10**. The single highest-risk object in this repository is not a file — it is the uncommitted state itself.

---

## 2. Top 25 Risks (ranked)

Each row: risk → evidence → which reality (main / HEAD / WT).

1. **The uncommitted state itself** — the entire constitutional layer, archives, ledger/seam registries, migrations 162–166, and 23 validators are untracked with zero git history; `git clean -fd` destroys them, `git reset --hard` restores the rejected law. GOVERNANCE_TRUTH §1.3, §6#8; ARCHITECTURE_TRUTH §1.1. **WT.**
2. **The commit trap** — 60 root docs + 38 governance docs tracked-deleted with untracked-only archive copies; `git commit -am` orphans the archive (verified for `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md`). GOVERNANCE_TRUTH §1.4, §6#8. **WT.**
3. **Account takeover live in committed reality** — `main`'s `/api/auth/switch` mints a session for any `email_verified` user with no session/ownership proof (quoted from `git show main:`); the fix exists only uncommitted. IDENTITY_TRUTH §2, R1. **main + HEAD.**
4. **Storefront money is un-ledgered everywhere** — every shopper payment confirm (public verify + 4 provider webhooks) ends in `confirm_order_payment_with_ledger` (`000_baseline.sql:1590`), which writes zero canonical ledger rows. MONEY_TRUTH §1.2, §2a. **main + HEAD + WT.**
5. **Anon RLS leak class deployed** — migration `163` (closes PUBLIC `USING(true)` on 11 sensitive tables) and `164` (`app_tenant` NOBYPASSRLS + GUC FORCE) are untracked; every committed state runs the leak. DATABASE_TRUTH §1, §3. **main + HEAD.**
6. **Clean-checkout deploy silently omits the fixes** — `supabase db push --include-all` from HEAD applies only 000–161; `migration-safety-validator` cannot see 162–166 (`getTrackedFiles()` only). DATABASE_TRUTH §8. **HEAD.**
7. **The gate lies in clean CI** — `rls-force-coverage-validator.mjs:11` reads untracked `164_…sql` from disk; green locally, error on a clean checkout. DATABASE_TRUTH §9. **WT vs HEAD divergence.**
8. **3% commission rake at every committed state** — `commission_bps` defaults 300 in DB (`119:81,108`) and code fallbacks (`?? 300` at main and HEAD); the zero-rake exists only in untracked `162` + WT code. MONEY_TRUTH §6. **main + HEAD.**
9. **The survivability self-block** — `whole-repo-end-state-validator.mjs:172-193` + `survivability-governance-validator.mjs:10-30,93-108` machine-mandate the 4-region/chaos/failover artifacts the Constitution forbids (`LETBUYY_CONSTITUTION.md:98,112`); deleting the rejected architecture fails CI. GOVERNANCE_TRUTH §5.5; ARCHITECTURE_TRUTH §1.2. **WT.**
10. **Step-up is mock theater on money paths** — `security.ts:123` mints `mock-step-up-${uuid}` pre-verified; verification = length ≥ 12 + timestamp window; `stepup-crypto-validator` allowlists it. IDENTITY_TRUTH §7, R3. **All.**
11. **No payout provider client** — `initiateTransfer` unconditionally throws (`payout-transfer-adapter/index.ts:103-105`); fail-closed, but no merchant can ever be paid. MONEY_TRUTH §1.6. **All.**
12. **Reconciliation is wiring-dead and the wallet fails closed forever** — `refresh/assert_money_ledger_site_reconciliation` have zero runtime callers; `wallet.ts:163-176` 409s until a manual backfill that nothing schedules. MONEY_TRUTH §1.9, §5. **All.**
13. **Mobile production login broken by code** — the app spends the single-use Turnstile token at the BFF, then identity re-verifies the same token (`timeout-or-duplicate`); alternate failure: unprovisioned prod secret → BFF 503. MOBILE_TRUTH §1.3. **WT (bug) + live seam.**
14. **Shared `AUTH_SECRET` monoculture** — one symmetric secret signs the PII `lb_accounts` cookie (90d), console + customer sessions, media/checkout/export signing, and is an accepted webhook-service internal credential. IDENTITY_TRUTH R4; MONEY_TRUTH §8. **All.**
15. **Raw-REST service-role bypass** — `packages/infrastructure/supabase-adapter/index.ts:65-150` fetches with the service-role key, bypassing the tenant Proxy guard entirely; 664 `getSupabaseAdmin()` sites are the norm. IDENTITY_TRUTH R5, §6. **All.**
16. **`merchant_payable` triple-writer, no cross-source dedup** — capture, commission-reconcile, and self-declared settlement ingest can credit the same rupee twice; payout gross derives from a fourth ledger-independent number (`orders.total`). MONEY_TRUTH §1.5, §4.3. **All.**
17. **Signature-only payment verification** — storefront Razorpay verify never fetches capture status/amount; an authorized-not-captured payment can mark an order paid. MONEY_TRUTH §8. **All.**
18. **No alerting end-to-end** — zero metric emitters behind the prometheus rules, no error-tracking SDK, no pager/Slack/email channel; the first breach signal is a customer tweet. PRODUCTION_READINESS §3.10, C11. **All.**
19. **Recovery is one pg_dump deep** — PITR human-gated (SKIP-W0), restore drill has only run in `plan` mode (`database-recovery-policy.json`). PRODUCTION_READINESS §3.11. **All.**
20. **`MERGE_RUNBOOK.md` directs the wrong merge** — SKIP-D1 sends the maintainer to a runbook that merges two non-existent `stream/*` branches into `develop`, starting with `git add`/`git commit` of obsolete files on a trapped tree. GOVERNANCE_TRUTH §6#1. **WT procedure / committed doc.**
21. **12+ DANGEROUS live prompts under `docs/`** — declare deleted packages "✅ Stable", instruct creating `packages/extension-host`/`apps/developer-portal`, rewire CI to `.store`; `CLAUDE_OPUS_MASTER_PROMPT.md` is a prompt **factory** for the rejected worldview. PROMPT_DRIFT §3.3–3.4, §4.3. **Committed (tracked, live).**
22. **"Frozen" apps are frozen in production only** — `staging-deploy.yml:189-200` still deploys 3 of the 4; `config/vercel/projects.json:79-137` declares production project IDs/URLs for all four; HEAD's prod matrix deploys all 9. CODEBASE_REALITY §1.3. **main + HEAD (+ WT staging).**
23. **Ratification fiction** — `LETBUYY_CONSTITUTION.md:5-8` self-declares "RATIFIED. SUPREME." while `SKIPPED_HUMAN_DECISIONS.md:5` records the ARB ratification as skipped; the supreme law asserts a constitutional fact that has not occurred. GOVERNANCE_TRUTH §5.2. **WT.**
24. **25 residual PUBLIC `USING(true)` policies** — including `service_role_*`-named-but-PUBLIC on `gift_cards`, `pages`, `collections`, `onboarding_attempts`, `ai_usage`, `auth_password_set_intents`; outside the 12-table validator allowlist, so nothing blocks them. DATABASE_TRUTH §5. **All.**
25. **The instruction loop reads fossils** — `AGENTS.md` AGENT-R16:380 mandates pre-edit reading of `memory/lessons.md` + `tasks/todo.md` (2026-03-01, dead topology, "generate AGENTS.md from scan" recorded as the completed playbook) while LEG-078 simultaneously sentences `lessons.md` to deletion; plus stale `stash@{0}` from a deleted branch. PROMPT_DRIFT §4.6; GOVERNANCE_TRUTH §6#9. **WT law / committed files.**

---

## 3. Top 25 Duplications

From DUPLICATE_REALITY_REPORT (§2–§13): ~60 documented duplicate pairs across 10 cluster families; the 25 most consequential, winner/loser one-liners.

1. **Temporal triplication (main / HEAD / WT)** — Winner: working-tree end-state; Loser: both committed realities — which are what deploys. (§2)
2. **Scan-generated AGENTS regime vs promoted AGENTS_V2/Constitution** — Winner: AGENTS_V2; Loser: the scan regime, still committed law at HEAD/main + 38 nested copies. (§3 r1)
3. **One-region monolith vs distributed/multi-region contract layer** — Winner: one region; Loser: `multi-region-runtime.json` + chaos/load + theater docs — machine-mandated by the new law's own validators. (§3 r3)
4. **Identity-issued ES256/EdDSA session vs gateway `randomHex(32)` mint** — Winner: identity-platform sole issuer; Loser: gateway mint — the deployable reality. (§4 r1)
5. **Asymmetric plane vs `AUTH_SECRET` symmetric family** — Winner: per-audience asymmetric; Loser: 7-domain HS256 family covering every realm except merchant sessions. (§4 r3)
6. **identity-platform vs gateway `identity-foundation/` shadow stack (18 files)** — Winner: identity-platform; Loser: the shadow stack, validator-allowlisted, SAFE_DELETE only after verify-only live. (§4 r2)
7. **One Turnstile verification vs BFF pre-verify + identity re-verify** — Winner: single identity-boundary verify; Loser: the double-spend pair that breaks prod mobile login. (§4 r5)
8. **One session service vs per-realm stateless JWTs** — Winner: revocable identity session service; Loser: unrevocable 7d customer / 8h console JWTs + dev in-memory Map. (§4 r6)
9. **Canonical append-only ledger vs mutable wallet model (`119`)** — Winner: ledger; Loser: `wallet_ledger_entries`/`payout_statements` as truth — demoted to compatibility projection pending zero-drift proof. (§5 r1)
10. **Ledgered V1 capture vs `confirm_order_payment_with_ledger`** — Winner: ledgered capture; Loser: the no-ledger storefront chain — live on the buyer path in all three realities. (§5 r2)
11. **Three refund paths** — Winner: V1 `/payments/:id/refund` (step-up, cap, canonical posting); Losers: orders-RPC and webhook `refund.created` paths, both un-ledgered. (§5 r3)
12. **3+1 `merchant_payable` writers** — Winner: single settlement writer; Loser: duplicate writers without cross-source dedup + `orders.total` gross. (§5 r4)
13. **Atomic COD ledger RPC (`165`) vs two-step wallet credit** — Winner: the RPC; Loser: HEAD's non-atomic path — and `165` is untracked, so deploying WT code without it breaks COD outright. (§5 r5)
14. **0 bps vs 300 bps commission** — Winner: 0% permanent; Loser: the 3% rake — the default in every committed state. (§5 r6)
15. **`razorpay_route` PA-split vs `razorpayx` self-custody** — Winner: never-custody Route; Loser: razorpayx defaults at HEAD + legal enum residue in ~8 schema/type sites. (§5 r7)
16. **Two payout object models** — Winner: `payout_statements` with the `claim_payout_statement_release` guard; Loser: settlement-scheduled `payouts` instruction rows that nothing ever consumes. (§5 r9)
17. **Liquid vs React renderer** — Winner: Liquid (strategic, constitutional); Loser: React — explicitly FROZEN-not-deletable; deleting it today blanks every storefront (THEME §10 NOT-READY). (§6 r1)
18. **Engine schemas/compose vs storefront re-declarations** — Winner: `packages/theme-engine` sources; Losers: `RUNTIME_SECTION_SCHEMAS` + the `template-resolver` fork — which currently hosts the winner's own Liquid canary. (§6 r2-3)
19. **Gateway vs merchant-control-plane second backend** — Winner: gateway; Loser: ~62 MCP `/api/stores/[store]/*` + `/api/themes/*` routes — two writers per domain across ~20 domains; storefront-runtime carries a third partial surface. (§7.1)
20. **One deploy matrix vs staging/projects.json drift** — Winner: the 8-runtime topology; Losers: 3 frozen-app staging rows + 4 frozen production entries in `config/vercel/projects.json`. (§7.2)
21. **Four tenancy access planes** — Winner: RLS+FORCE+GUC (`withTenantTx`); Losers: blanket service-role as the operative plane and the raw-REST bypass. (§8)
22. **Six lane names → one validator + five duplicated assertions** — Winner: honest lanes / one domain-owning validator per fact; Losers: the theater aliases and the duplicated 4-region assertions (both of which contradict the Constitution). (§9)
23. **Diverged prompt twins + the prompt factory** — Winner: archived copies as historical record; Losers: `docs/apps-marketplace-audit/*` diverged twins and the `CLAUDE_OPUS_MASTER_PROMPT.md` factory. (§10)
24. **EXECUTION_LEDGER/SKIPPED registries vs `tasks/todo.md` + `memory/lessons.md` fossils (+ stale MERGE_RUNBOOK)** — Winner: the validator-pinned registries; Losers: the 2026-03-01 fossils that AGENT-R16 still mandates reading, and the wrong-merge runbook. (§11)
25. **Mobile duplicates** — Winners: live Navigator, `widgets/dashboard/*`, composite BFF dashboard, one restored theme editor; Losers: dead GoRouter `deep_link_router.dart` + `go_router` dep, same-name `widgets/home/*` twins, the 5-call analytics fan-out, and one of the two dead editor implementations. (§12)

---

## 4. Top 25 Legacy Systems

Previous-product residue, firebase era, scan-generated regime, mutable money model, and the other strata of dead generations still embedded in the tree.

1. **Portfolio/resume/ATS previous-product platform** — gateway `/portfolio` + `/resume` routers still mounted (`index.ts:738-739`), 8 merchant-control-plane pages (`ats-score`, `projects`, `certifications`, `education`, `experience`, `skills`, `gallery`, `testimonials`), BFF allowlist entries, DB tables (`portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements`), `sites.site_type` CHECK still enumerating `portfolio,resume,landing,blog` (`000:12013`). CODEBASE_REALITY §1.9, §9; DATABASE_TRUTH §6.
2. **Firebase era** — entire `legacy/firebase` tree (37 files incl. commission/settlement/wallet services) relocated to `docs/archive/firebase-legacy/` in WT; `firebasestorage.googleapis.com` still whitelisted in storefront `next.config.ts:41-45`. CODEBASE_REALITY §9; MONEY_TRUTH §4.4.
3. **Scan-generated governance regime** — root `AGENTS.md` at HEAD/main (2026-06-08 generator stamp) + 38 nested scan-generated `AGENTS.md` still ranked authorities, instructing regeneration via a generator that exits 1. GOVERNANCE_TRUTH §4.3.
4. **Generated intelligence doc tree (67 files)** — `docs/*/README.md` + `docs/architecture/master-system-intelligence.md`: `letbuyy.store` hosts, "19 migrations" (real 166), deleted packages — permanently frozen falsehoods. ARCHITECTURE_TRUTH §1.4, §4.3.
5. **`docs/agents/` agent OS (42 files)** — self-declared "Mandatory Reading Order" frozen at 2026-05-24; topology two restructures old (`backend/workers/api`, `apps/web/consumer/admin`). PROMPT_DRIFT §3.4, §4.7.
6. **Mutable money model (`119`)** — `wallet_ledger_entries`, `payout_statements`, `commission_*`; bridged to the canonical ledger by dual-model reconciliation tables that nothing schedules. MONEY_TRUTH §4.1; DATABASE_TRUTH §6.
7. **Mini-ledgers and mutable balances** — `gift_card_ledger_entries` (`balance_after`), `gift_cards.balance`, `gift_card_accounts.balance` (no RPC writer found), `store_credit.balance_minor`, `ai_credits.balance`. DATABASE_TRUTH §6.
8. **`razorpayx` self-custody rail residue** — HEAD code defaults + legal enum member in ~8 type/schema sites + `partner_payout_ledger_entries.rail` CHECK (`baseline:10252`). MONEY_TRUTH §1.8, §7.
9. **CQRS/distributed package cluster** — 8 rejected roots / 154 files (`distributed-runtime` 77f, `projection-runtime`, `orchestration`, `runtime-composition`, `application-services`, `app-engine`, `search-core`, `extension-host`) deleted in WT, fully alive at HEAD. CODEBASE_REALITY §1.5.
10. **Theater governance survivors (~16 docs)** — `multi-region-runtime-`, `failover*`, `chaos*`, `distributed-execution-survivability-`, `replay-safety-`, `shadow-traffic-`, `runtime-composition-governance.md` (routes composition through deleted packages) + 4 validator-required theater docs. GOVERNANCE_TRUTH §4.2; ARCHITECTURE_TRUTH §4.3.
11. **Distributed-era `config/runtime` contracts** — `multi-region-runtime.json` (23 refs), `survivability-execution.json`, `distributed-consistency-contract.json`, `runtime-causality-graph.json` + ~12 siblings with 0–2 consumers each. ARCHITECTURE_TRUTH §4.3, §6.6; DELETION_REGISTRY §I.
12. **`chaos/` + `load/` machinery** — rejected-architecture drill tooling kept alive solely by the survivability validator lock; `chaos:execute`/`load:execute` remain runnable. DELETION_REGISTRY §B.
13. **The 181-validator theater lane** — HEAD's gate (187 files) incl. CRDT/replay/failover/durable-object validators; 77 deleted in WT, preserved only in git history. GOVERNANCE_TRUTH §7.1.
14. **2026-03-01 task/memory system** — `tasks/todo.md` + `memory/lessons.md`: dead topology anchors, scan-generation playbook recorded as completed, still AGENT-R16-mandated reading. PROMPT_DRIFT §3.1, §4.6.
15. **`MERGE_RUNBOOK.md` stream-era procedure** — describes merging `stream/letbuyy-foundation-v2` + `stream/letbuyy-ui-foundation` into `develop`; both branches no longer exist. GOVERNANCE_TRUTH §6#1.
16. **Codex wave prompt corpus (June 05–06 era)** — `docs/Codex_waves/` 26 files: blueprints declaring rejected packages "✅ Stable", 6 paste-ready terminal relaunchers, the prompt factory. PROMPT_DRIFT §3.3.
17. **June-05 replatform blueprints** — `docs/audit/` (19 docs; `13-final-architecture-blueprint.md` activates the reserved fleet + WASM) and `docs/commerce-os-audit/` ("billion-dollar" multi-region roadmap). ARCHITECTURE_TRUTH §1.5, §7.3-7.4.
18. **June-05 master-plan family** — `docs/LETBUYY_MASTER_EXECUTION_PLAN.md` + `P0…P4_*_MASTER.md` + `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md` ("AGENTS.md is canonical" — the scan law). PROMPT_DRIFT §3.4.
19. **Frozen marketplace pair** — `apps/app-marketplace` (91 TS) + `apps/theme-marketplace` (65 TS) with ~50 `app_*` tables and live gateway purchase/review/download routes; marketplace Zod types embedded in active `theme-engine`. CODEBASE_REALITY §3; THEME_PARITY §8.
20. **Frozen console/portal pair** — `apps/developer-portal` (no deploy config) + `apps/platform-operations-portal` (PHASE-C loser to `platform-console`). CODEBASE_REALITY §3; ARCHITECTURE_TRUTH §9.
21. **Mobile parity-catalog era** — catalog deleted in WT (D8) but its skeleton persists as 36 dead `/features/*` routes with lying mappings, plus `apps/mobile/merchant-app/AGENTS.md:42` still citing the deleted parity file. MOBILE_TRUTH §4, §9.
22. **Dead mobile theme-editor generation** — `theme_screen.dart` (631L) + `section_editor_screen.dart` (1,200L) + 12 editor widgets: historically the app's strongest surface, now zero construction sites; the "editor tab" lands on Settings. MOBILE_TRUTH §1.2.
23. **Never-mounted GoRouter system** — `lib/app/deep_link_router.dart` + `go_router ^17.0.0`: second navigation system, tests-only consumer, no intent filters. MOBILE_TRUTH §1.10.
24. **Kubernetes/helm era** — `infrastructure/deployment/helm|kubernetes` deleted in WT; `otel-collector.yaml` still exports to `*.letbuyy-observability.svc.cluster.local` — the cluster that no longer exists in any form. CODEBASE_REALITY §8; PRODUCTION_READINESS §3.10.
25. **Pre-baseline migration history + demo residue** — `docs/archive/migrations-history/` (72 collapsed .sql, correct as archive), `apps/storefront-runtime/src/app/demo/urban-kicks/` live-routed demo, `docs/archive/legacy-theme-editor/`, and the gateway's dev `localAuthSessions` in-memory Map. DATABASE_TRUTH §6; CODEBASE_REALITY §5; IDENTITY_TRUTH §3.

---

## 5. Top 25 Deletion Candidates

From DELETION_CANDIDATE_REGISTRY. Class + condition per row. **Global precondition for every row: `git add -A && git commit` first** (the commit trap, registry header).

| # | Candidate | Class | Condition |
|---|---|---|---|
| 1 | 67 generated intelligence docs (`docs/*/README.md` tree + `docs/architecture/{master-system-intelligence,README}.md`) | DELETE | None beyond commit — tracked, history preserves; generator hard-retired (registry §4#1) |
| 2 | 11 orphan validators (`contracted-domain-event-ingress`, `custom-domain-abuse-screening`, `custom-domain-reconciler`, `gateway-events-client`, `mobile-domain-parity`, `no-orphan-webhook-delivery-queue`, `observability-producer`, `registrar-provider`, `replayable-secret-persistence`, `shopper-identity-seam`, `vercel-domain-automation`) | DELETE | Zero external refs re-verified per-file (registry §G; GOV §7.1) |
| 3 | 3 frozen-app rows in `staging-deploy.yml:189-200` + 4 frozen entries in `config/vercel/projects.json:79-137` | DELETE | Direct drift vs frozen/not-deployed law (registry §4#11) |
| 4 | `tsconfig.workspace.json:68` dangling `./packages/typescript/utils` reference | DELETE | Target exists neither on disk nor at HEAD (CODE §7) |
| 5 | `pubspec.yaml` `run:super_admin` melos script (+ dead `build:web` filter) | DELETE | Targets sourceless `apps/mobile/operator-app` (MOBILE §9) |
| 6 | Mobile true-dead-weight set: `platform_blocked_screen`+service, `upgrade_screen`, `splash_screen`, `widgets/home/{activity_timeline,quick_actions_grid}`, `widgets/shared/empty_state.dart`, `deep_link_router.dart` + `go_router` dep | DELETE | Same-change test edits (`mobile_services_test.dart:3791-3797`) (registry §M, §4#14) |
| 7 | `ui_kit` internal duplicates (one each of `empty_state*`, `error_*`) | DELETE | Pick kit-internal winner per pair (MOBILE §3) |
| 8 | `apps/storefront-runtime/src/app/demo/urban-kicks/` + `firebasestorage.googleapis.com` remotePattern | DELETE | None — demo residue + dangling trust grant (registry §4#9-10) |
| 9 | Empty husks: `legacy/`, `tests/projections/`, `docs/mobile-migration-blueprint/`, `.codex/` + `.codex-dev.log` (0 bytes) | DELETE | files=0 verified (registry §4#3,6-8) |
| 10 | Machine-local residue: root `build/` (161 MB), `.dart_tool/`, `.tmp/`, `test-results/`, `.pnpm-store/`, `.turbo/`, `.DS_Store` ×3 | DELETE | Gitignored/local only (registry §4#4-5) |
| 11 | 8 rejected package roots (154 files) — already deleted in WT | DELETE [DBU] | Finalize by commit; `git checkout .` resurrects all eight (registry §E) |
| 12 | 77 theater validators + 69 theater test files — already deleted in WT | DELETE [DBU] | Commit; tests archived at `docs/archive/validator-theater-tests-2026-06-10/` (registry §G, §H) |
| 13 | `infrastructure/deployment/helm/` + `kubernetes/` (6 files) — deleted in WT | DELETE [DBU] | Commit (registry §K) |
| 14 | `packages/dart/services` + `packages/typescript/ui/src/mobile-tokens.ts` — deleted in WT | DELETE [DBU] | Commit; zero remaining refs (MOBILE §6) |
| 15 | 6 `package.json` theater aliases (`validate:distributed-execution` … `survivability-intelligence`) | DELETE [DAP] | Retarget `architecture-governance.yml:75-81` callers first (registry §A) |
| 16 | Survivability/multi-region/chaos/load/certification cluster (~60 artifacts) | DELETE [DAP] | **SURVIVABILITY-UNHOOK** (§18, 5 steps, ARB-ratified) (registry §3.2) |
| 17 | `config/runtime/production-topology.json:34-39` `globalRegions` block | DELETE [DAP] | Same SURVIVABILITY-UNHOOK (registry §I) |
| 18 | Previous-product residue batch (§L: gateway routers, BFF allowlist lines, 8 MCP pages, cms-core re-exports) | DELETE [DAP] | SKIP-D11 live writer probe + ARB non-store-site-type decision (registry §L) |
| 19 | DB dead tables (`portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements`) + `sites.site_type` enum shrink | DROP [DAP] | Live `pg_stat_user_tables` probe **and** a first-ever DROP-TABLE migration policy (registry §J) |
| 20 | Duplicate `provider_payment_id` index (`107` vs `142`) | DROP one [DAP] | Live `pg_indexes` + plan proof in a maintenance window (SKIP-D11) (DB §6) |
| 21 | `sections/marquee.tsx` (dead, 0 importers) | DELETE [DAP] | Amend the exactly-20 freeze validator + `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT` (THEME §2.1) |
| 22 | Mobile theme-editor pair (~1,830 lines + 12 editor widgets) | DELETE-or-WIRE [DAP] | ARB wire-or-delete pick + rewrite of 42 protecting source-string tests; canon protects the *capability* (registry §M) |
| 23 | 25+9 mobile capability screens with no entry point | DELETE-or-WIRE [DAP] | Per-screen product decision — all are real service-backed implementations (MOBILE §3) |
| 24 | Distributed-era config contracts with 0 refs (`replay-safety-contract.json`, `identity-residency.schema.json`) | DELETE | Zero consumers verified now; 1–2-ref siblings gated on retiring their single consuming validator (registry §I) |
| 25 | React renderer + 20 frozen sections | DELETE [DAP] — **explicitly NOT now** | Full THEME §10 parity condition (§18 below); deleting today blanks every storefront (registry §3.1) |

---

## 6. Top 25 Archive Candidates

All moves under `docs/archive/`, post-commit (DELETION_REGISTRY §5; PROMPT_DRIFT §6; ARCHITECTURE_TRUTH §4.3).

1. `docs/Codex_waves/` — 26 files, 12 DANGEROUS incl. the `CLAUDE_OPUS_MASTER_PROMPT.md` prompt factory and 6 paste-ready terminal relaunchers (PROMPT §3.3).
2. `docs/agents/` — 42-file stale mandatory-reading agent OS, 2026-05-24 facts, dead topology (PROMPT §3.4).
3. `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md` — treats the four frozen apps as "Active runtimes (edit these)" (PROMPT §4.8).
4. `docs/LETBUYY_MASTER_EXECUTION_PLAN.md` + `P0…P4_*_MASTER.md` + `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md` — superseded June-05 execution layer (PROMPT §3.4).
5. `docs/apps-marketplace-audit/` 3 missions — two diverge from same-named archived copies; reconcile newest during the move (PROMPT §3.4).
6. `docs/themes-marketplace-audit/` — 7 missions + 10 ledgers/status incl. the GA-closure "Live DB apply / deploy" mission for a frozen app (PROMPT §3.4).
7. `docs/developer-platform-audit/CODEX_DEVELOPER_APP_FOUNDATION_PROMPT.md` — paste-ready prompt owning two frozen apps (PROMPT §3.4).
8. `docs/internal-operating-system-audit/mission/` — builds the PHASE-C-losing console; documents the root-validator evasion precedent (PROMPT §3.4, §4.9).
9. `docs/auth/2026-06-08-identity-platform-transformation/` 3 mission files — duplicated in `docs/archive/prompts/` (PROMPT §3.4).
10. `docs/audit/` (19 docs) — replatform blueprints; `13-final-architecture-blueprint.md` activates the reserved fleet + WASM (ARCH §7.3).
11. `docs/commerce-os-audit/` (10 docs) — billion-dollar multi-region roadmap; envelope violation by title (ARCH §7.4).
12. `docs/audits/` — gen-0 audit set, superseded (ARCH §5).
13. `docs/analysis/Part1–4` — pre-V1 full-architecture review (ARCH §4.3).
14. Superseded docs-root master audits/reports (~25 files): `LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`, `LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md`, `LETBUYY_DEVELOPER_PLATFORM_MASTER_AUDIT.md`, `LETBUYY_INTERNAL_OPERATING_SYSTEM*`, `LETBUYY_MERCHANT_MOBILE_MASTER_REPORT.md`, `LETBUYY_CTO_WAR_ROOM_REPORT.md`, `LETBUYY_DEEP_AUDIT_REPORT.md`, `TOP_200_ISSUES.md`, `REMEDIATION_LOG.md`, ops logs (registry §F).
15. Design-system superseded set: `DESIGN_SYSTEM_MATURITY_SCORECARD`, `DESIGN_TOKEN_AUDIT`, `LETBUYY_DESIGN_SYSTEM_DISCOVERY`, `LETBUYY_PLATFORM_DESIGN_SYSTEM_MASTER_REPORT`, `LETBUYY_UI_SYSTEM_MASTER_AUDIT`, `LETBUYY_UI_FOUNDATION_IMPLEMENTATION_PLAN` (registry §F).
16. `docs/LETBUYY.md` — a third competing "single source of truth" (2026-03-01) (registry §F).
17. Root business binaries — `LETBUYY_BUSINESS_REVIEW_DECK.pptx`, `LETBUYY_MERCHANT_OS_BOARD_DECK.pptx`, `LETBUYY_MERCHANT_OS_ROADMAP.xlsx`, `LETBUYY_PRICING_UNIT_ECONOMICS_MODEL.xlsx` → `docs/archive/root-governance-2026-06-10/` (escape the root budget only because the validator filters `.md`) (registry §A).
18. `MERGE_RUNBOOK.md` current text — after the real `stepup/main`→`main` runbook replaces it (registry §5#9).
19. `memory/lessons.md` [DAP] — after AGENT-R16 amendment + LEG-078 contradiction resolution (registry §B).
20. `tasks/todo.md` [DAP] — same condition (registry §B).
21. ~16 contradicting `docs/governance/*` theater survivors [DAP: SURVIVABILITY-UNHOOK] — `multi-region-runtime-governance.md` (cited as authority by every reserved runtime manifest), `runtime-composition-governance.md` (movable immediately after a manifest `governanceDocs` retarget), failover/chaos/replay/shadow-traffic family + 4 validator-required docs (registry §F).
22. 6 theater runbooks [DAP: SURVIVABILITY-UNHOOK] — `regional-failover.md`, `survivability-suite.md`, `infra-recovery.md`, `chaos-drill.md`, `event-replay.md`, `live-certification-execute.md` (registry §F).
23. `apps/platform-operations-portal` [DAP] — after unique employee-execution modules are ported to `platform-console` (PHASE-C survivor already decided) (registry §C).
24. `apps/developer-portal` [DAP] — weakest frozen app (UI-only, no deploy config); ARB consolidation decision (registry §C).
25. `docs/conflicts/` + `docs/future-roadmap/` dirs — only generated READMEs enumerating dead `FORENSIC_REPORT/*` rows; remove the emptied dirs after the generated-tree delete (registry §F).

---

## 7. Top 25 Governance Drifts

1. **Two complete governance regimes in one repo** — scan-generated law + 124 gov docs + 181-validator gate at HEAD/main vs AGENTS_V2 + 7-doc constitutional stack + 86 docs + 90-validator gate in WT; none of the new regime committed. GOVERNANCE_TRUTH §1.1.
2. **Promotion mechanical-complete, human-unratified** — `SKIP-GATE1-ARB-RATIFICATION` (`SKIPPED_HUMAN_DECISIONS.md:5`); GATE-1's "ARB-only constitutional act" performed by automation. GOVERNANCE_TRUTH §3.3.
3. **Self-declared ratification** — `LETBUYY_CONSTITUTION.md:5,8` "Date ratified: 2026-06-10 … RATIFIED. SUPREME." vs the recorded skip. GOVERNANCE_TRUTH §5.2.
4. **Two texts of DOC 02** — promoted root `AGENTS.md` vs `GOVERNANCE_REWRITE…/LETBUYY_AGENTS_V2.md`: 3 hunks/12 lines apart; CODE-R1 reads differently depending on which a reader opens. GOVERNANCE_TRUTH §3.2, §5.3.
5. **`_GOVERNANCE_SPINE.md` does not exist** — cited 26× across 5 of the 7 canonical docs as the anchor for the authority chain and winner decisions. ARCHITECTURE_TRUTH §6.1.
6. **Stale evidence-base paths in the canon itself** — Constitution `:39` and `LETBUYY_CANONICAL_SYSTEMS.md:24` cite `FORENSIC_MASTER_2026_06_10/` at root; it lives only under the archive. ARCHITECTURE_TRUTH §6.2.
7. **The recreated mini self-block** — `whole-repo-end-state-validator.mjs:179-193` mandates `validate:survivability` in 3 workflows; `survivability-governance-validator.mjs:10-30` mandates `multi-region-runtime.json`, `chaos/`, `load/…`, and 4 theater docs. GOVERNANCE_TRUTH §5.5.
8. **`globalRegions` fabrication locked into canon config** — `production-topology.json:34-39` declares india/apac/eu/us against the one-region law; required by two validators. ARCHITECTURE_TRUTH §8.1.
9. **Theater lane-name shims** — six `package.json` lanes named for distributed coverage all run `no-scan-generated-agents-validator.mjs`; workflow readers are misled. GOVERNANCE_TRUTH §5.6.
10. **`validate:rollback` is `migration-safety-validator`** — the real rollback-pairing check does not exist; 68 migrations have no rollback pair. DUPLICATE §9 r2; DATABASE_TRUTH §8.
11. **Anti-scan validators are root-only** — both read only root `AGENTS.md`; the 38 nested scan-generated files are unpoliced authorities via `CLAUDE.md:3`/AUTH-R1. GOVERNANCE_TRUTH §7.3.
12. **`services/api-gateway/AGENTS.md:10`** still authorizes imports of the deleted "application-service" packages. GOVERNANCE_TRUTH §4.3.
13. **`docs/agents/AGENTS.md:3`** calls root AGENTS.md "the central constitution" — pre-rewrite framing inside a filename that ranks as local law. PROMPT_DRIFT §4.7.
14. **`docs/governance/repository-topology.md`** presents a 12-app "Canonical Topology" with no frozen markings vs ARCH-R1's 8-runtime law. GOVERNANCE_TRUTH §5.4.
15. **`multi-region-runtime-governance.md`** declares an APAC failover region as present-tense law; cited as authority by every reserved runtime manifest. GOVERNANCE_TRUTH §5.4; ARCHITECTURE_TRUTH §7.5.
16. **`runtime-composition-governance.md:15,22`** routes app composition through two deleted, V1-rejected packages. GOVERNANCE_TRUTH §5.4.
17. **Theater purge incomplete** — 38 docs archived 1:1, but ≥10 equally contradictory siblings survive untouched (failover/chaos/replay/shadow-traffic family). GOVERNANCE_TRUTH §1.8.
18. **`docs/governance/validator-reality.md:21`** references root `CODEX_FOUNDATION_STEPUP_V2_*` docs deleted/archived in D11. GOVERNANCE_TRUTH §5.4.
19. **Two human-seam registries** — `EXECUTABLE_HUMAN_REQUIRED.md` (19 HR-*) overlaps `SKIPPED_HUMAN_DECISIONS.md` (22 SKIP-*). GOVERNANCE_TRUTH §4.1.
20. **AGENT-R16 ↔ LEG-078 self-contradiction** — the law mandates reading `memory/lessons.md` while the elimination plan sentences it to DELETE. PROMPT_DRIFT §4.6.
21. **`MERGE_RUNBOOK.md` is the wrong procedure** — SKIP-D1 directs maintainers to a runbook for branches that no longer exist. GOVERNANCE_TRUTH §6#1.
22. **11 true-orphan validators** referenced by nothing — package.json, lanes, workflows, scripts, tests, or other validators. GOVERNANCE_TRUTH §7.1.
23. **CLAUDE.md ordering quirk** — lists `AGENTS.md` before the Constitution; AGENTS.md's own AUTH-CHAIN puts the Constitution supreme. GOVERNANCE_TRUTH §3.1.
24. **CI regime disjoint** — GitHub executes HEAD's 181-lane; the HEAD orchestrator would crash on this tree (77 of its validators are deleted files); the WT orchestrator does not exist remotely. GOVERNANCE_TRUTH §5.7.
25. **Archive-evasion precedent on record** — `CODEX_INTERNAL_OS_FOUNDATION_STATUS.md:20` documents placing mission artifacts under `docs/` because root validators reject them; the enforcement perimeter is root-only and `docs/` is the unpoliced dumping ground. PROMPT_DRIFT §1.5, §6.

---

## 8. Top 25 Architecture Drifts

1. **The canon is uncommitted while HEAD asserts the opposite law** — the entire Gen-5 architecture (Constitution → AGENTS_V2 → winner registry) exists only as working-tree files. ARCHITECTURE_TRUTH §1.1, §3.2.
2. **The rejected multi-region architecture is machine-enforced into the end-state** — `multi-region-runtime.json` (4 regions + failover pairs, 23 references) + the validator lock. ARCHITECTURE_TRUTH §1.2, §7.1.
3. **A second backend inside `apps/merchant-control-plane`** — 62 Next API routes duplicating gateway-owned domains; two writers per domain for ~20 domains; ARCH-R17 violation. CODEBASE_REALITY §1.9; DUPLICATE §7.1.
4. **A third partial backend in storefront-runtime** — `/api/customer/*`, `/api/orders*`, `/api/reviews`, `/api/coupons/validate`, `/api/themes` overlapping gateway mounts. CODEBASE_REALITY §4; DUPLICATE §7.1.
5. **Frozen apps deploy to staging** — `staging-deploy.yml:189-200` (WT **and** HEAD) ships `theme-marketplace`, `app-marketplace`, `platform-operations-portal`. CODEBASE_REALITY §1.3.
6. **`config/vercel/projects.json:79-137`** declares production projects/URLs for all 9 apps including the frozen four; no validator reads it. CODEBASE_REALITY §3; DUPLICATE §7.2.
7. **Sibling topology files disagree on "frozen"** — production-topology lists frozen rows; deployment-topology omits the apps entirely. ARCHITECTURE_TRUTH §8.4.
8. **Root TS build graph broken in all states** — `tsconfig.workspace.json:68` references nonexistent `packages/typescript/utils`; workspace `tsc -b` cannot succeed. CODEBASE_REALITY §1.6, §7.
9. **No `dist/` in any of the 21 lib packages** — every composite/`emitDeclarationOnly` tsconfig demands built declarations; standalone `tsc -p` hits TS6305; only the turbo path works. CODEBASE_REALITY §7.
10. **Reserved runtime manifests are sed-garbled** — D11's mechanical find/replace left nonsense prose ("delegates to service-owned read planners and service-owned read planners", `checkout-runtime/runtime.manifest.json:83`). CODEBASE_REALITY §1.4.
11. **Reserved manifests cite theater governance as authority** — `governanceDocs` arrays list multi-region/failover/chaos docs. ARCHITECTURE_TRUTH §6.5.
12. **`docs/audit/13-final-architecture-blueprint.md`** — a live "Final Target Architecture Blueprint" activating all 6 reserved services + a WASM extension runtime (Never-Build list). ARCHITECTURE_TRUTH §7.3.
13. **`docs/commerce-os-audit/10_BILLION_DOLLAR…ROADMAP.md:14`** — multi-region read scale as a roadmap phase; envelope violation by title. ARCHITECTURE_TRUTH §7.4.
14. **67-file generated intelligence tree as the only content of `docs/architecture/`** — `letbuyy.store` mermaid, "19 migrations", deleted packages, archived governance; unregenerable. ARCHITECTURE_TRUTH §1.4.
15. **`multi-region-runtime.json` declares apac/eu/us queue namespaces** that exist in no terraform or wrangler config — fabricated capacity. ARCHITECTURE_TRUTH §8.5.
16. **`AGENTS.md:73` names runtime #4 `services/identity-platform`** — no such directory; every config keys `apps/identity-platform`. ARCHITECTURE_TRUTH §8.2.
17. **`CHECKOUT_ORIGIN=https://checkout.letbuyy.com`** in gateway prod vars while `services/checkout-runtime` is reserved/empty — the host has no dedicated runtime owner in code (served by the monolith per canon, ambiguous on disk). CODEBASE_REALITY §8.
18. **Production-dark feature topology** — `FEATURE_GRAPHQL/EXTENSIONS/LIQUID = "false"` in prod, `"true"` in staging: 3,941 GraphQL lines + 623 extension lines + the Liquid path ship dark. CODEBASE_REALITY §1.8.
19. **`FEATURE_LIQUID` is decorative** — no `featureGate('FEATURE_LIQUID', …)` exists; only GRAPHQL/EXTENSIONS gates are constructed. THEME_PARITY §5.
20. **Published JWKS endpoints serve a disabled placeholder key** while real verification keys are env-injected — the live JWKS URL is non-functional by design but exists. IDENTITY_TRUTH §1.
21. **`docs/conflicts/` + `docs/future-roadmap/`** enumerate `FORENSIC_REPORT/*` rows that no longer exist at those paths. ARCHITECTURE_TRUTH §6.3.
22. **Two same-named "master execution plans"** — `docs/LETBUYY_MASTER_EXECUTION_PLAN.md` (2026-06-05) vs the archived FORENSIC_MASTER document of the same name. PROMPT_DRIFT §3.4; DUPLICATE §10.
23. **7 distributed-era `config/runtime` manifests orphaned** — touched by the program yet retaining `projection-runtime`/event-store precedence semantics; only `manifest-lineage.json` has a consumer. ARCHITECTURE_TRUTH §6.6.
24. **Melos workspace drift** — `run:super_admin` targets the sourceless `apps/mobile/operator-app`; `build:web` filter matches nothing. CODEBASE_REALITY §10; MOBILE_TRUTH §9.
25. **`pnpm test` glob + CI build the frozen apps** — `turbo build` in `ci.yml:248` includes all frozen apps with no exclusion; the freeze exists only in the production matrix. CODEBASE_REALITY §1.3, §8.

---

## 9. Top 25 Security Risks (ranked by exploitability × impact; reality plane stated)

1. **`/api/auth/switch` unauthenticated account takeover** — any verified user's email → their session; CSRF-only "protection". IDENTITY_TRUTH §2 (quoted from `git show main:`). **main + HEAD (deployable reality).**
2. **PUBLIC `USING(true)` anon leak class on 11 sensitive tables** — fix is untracked `163`; any anon-key holder reads cross-tenant data at committed states. DATABASE_TRUTH §1; PRODUCTION_READINESS §10. **main + HEAD.**
3. **No `app_tenant` role — everything runs service_role** at committed states (`164` untracked); RLS bypass is the operative access plane. DATABASE_TRUTH §3; IDENTITY_TRUTH §6. **main + HEAD.**
4. **Settlement writer trusts caller `p_site_id`** — HEAD's `post_settlement_ledger_transaction` (`151:23`) sets the tenant GUC from the caller: a cross-tenant money-posting surface; source-row fix is untracked `165`. MONEY_TRUTH §2a. **main + HEAD.**
5. **Step-up mock guards refund/payout/DSR-erase** — any ≥12-char token + fresh timestamp passes; the validator allowlists the mock. IDENTITY_TRUTH §7. **All.**
6. **No payout double-release guard at `main`** — migration 160 absent; double-release is a race; default rail `razorpayx` self-custody. MONEY_TRUTH §9. **main.**
7. **Shared symmetric `AUTH_SECRET`** signs the PII `lb_accounts` cookie (90d), console + customer sessions, media/checkout/export helpers, and is an accepted webhook-service internal credential — one secret = identity + money forgery surface. IDENTITY_TRUTH R4; MONEY_TRUTH §8. **All.**
8. **Raw-REST service-role bypass of the tenant Proxy guard** — `supabase-adapter/index.ts:65-150`; plus direct unguarded `createSupabaseServiceClient` in the gateway auth path. IDENTITY_TRUTH R5, R6. **All.**
9. **Signature-only Razorpay storefront verify** — never fetches capture status/amount; authorized-not-captured marks orders paid (the subscription path does it correctly). MONEY_TRUTH §8. **All.**
10. **Regex-only theme sanitizer at committed states** — 3 chained `.replace()` between merchant HTML and shopper browsers; DOMPurify+auto-escape is WT-only. THEME_PARITY §3.2, §6. **main + HEAD.**
11. **`backfill_wallet_ledger_to_canonical`** — callable SECURITY DEFINER cross-tenant mass-writer with zero runtime callers; function EXECUTE grants UNVERIFIED (PostgreSQL default = PUBLIC). MONEY_TRUTH §4.4, §11. **All.**
12. **Queue tenant envelope fails open** — returns the body unsigned when `siteId` missing or secret is a placeholder. IDENTITY_TRUTH R9 (`queue-tenant-envelope.ts:38-40`). **All (WT code).**
13. **Per-isolate in-memory replay-JTI cache** — internal HMAC replay protection not globally consistent across Workers isolates. IDENTITY_TRUTH R13. **All.**
14. **Stateless customer (7d) and console (8h) JWTs cannot be revoked** before expiry. IDENTITY_TRUTH R10. **All.**
15. **Committed `SKIP_NEEDS_HUMAN_*` placeholders in production wrangler vars** — AI model, Razorpay key id, WhatsApp/Twilio, FCM/APNS (`api-gateway/wrangler.toml:255-267`; `queue-workers:39-47`). CODEBASE_REALITY §8. **All.**
16. **Debug-signed Android release builds** — `signingConfig = getByName("debug")` at HEAD; fail-closed lane is an uncommitted 52-line diff. MOBILE_TRUTH §7. **main + HEAD.**
17. **Mobile Turnstile double-spend** — the WT's own login flow consumes then re-submits the single-use token; no test catches the cross-service bug. MOBILE_TRUTH §1.3, §8. **WT.**
18. **JS-readable CSRF cookie + parent-domain SSO `lb_session`** — one XSS on any platform app rides the shared cookie across all platform apps. IDENTITY_TRUTH R12. **All.**
19. **Migration `162` rewrites historical commission rows in place** — financial history mutated with no ledger/audit entry, inside the very program whose premise is append-only money. DATABASE_TRUTH §7.1. **WT (untracked).**
20. **25 residual PUBLIC `USING(true)` policies** beyond the 11 fixed — `service_role_*`-named-but-PUBLIC on `gift_cards`, `pages`, `collections`, `onboarding_attempts`, `ai_usage`, `auth_password_set_intents`; outside every allowlist. DATABASE_TRUTH §5. **All.**
21. **Validator theater certifying security posture** — `no-blanket-service-role` checks one wrapper string + an `apps/` literal ban (not the 664 uses); `identity-sole-issuer` allowlists auth-core HS256 + mock-key-service. IDENTITY_TRUTH R7. **WT (the gates themselves).**
22. **Internal perimeter checks credential *presence*, not validity** — `hasInternalCredential` header-presence only; signature validation deferred to handlers. IDENTITY_TRUTH §6. **All.**
23. **Storefront cookie `secure` gated on `NODE_ENV==='production'` only** — weaker than the platform cookies' hard `secure:true`. IDENTITY_TRUTH R11. **All.**
24. **Identity issuer/JWKS default fallback** — verifier falls back to `https://accounts.letbuyy.com` strings if env unset; a misconfigured gateway verifies against a default issuer. IDENTITY_TRUTH R14. **WT.**
25. **No detection at all** — no error-tracking SDK, no alert delivery channel, money-reconciliation alerting exists only as an unclaimed preflight flag name; breaches are invisible by construction. PRODUCTION_READINESS §3.10. **All.**

---

## 10. Top 25 Technical Debt Items

1. **Broken workspace build graph** — dangling `packages/typescript/utils` ref + zero `dist/` anywhere → TS6305 on any standalone project-reference build; turbo is the only working typecheck path. CODEBASE_REALITY §7.
2. **Six theater `package.json` aliases → one validator** — and `architecture-governance.yml:75-81` still calls the alias names. CODEBASE_REALITY §1.7.
3. **11 orphan validators + ~10 zero/one-reference validators** — dead enforcement code in the live `scripts/validators/` tree. GOVERNANCE_TRUTH §7.1; CODEBASE_REALITY §9.
4. **Heuristic validator gaps** — canonical-ledger (TS-only, file-level token match, `orders` absent from its list), no-blanket-service-role (wrapper-string only), stepup-crypto (allowlists the mock), identity-sole-issuer (allowlists auth-core). MONEY_TRUTH §4.2; IDENTITY_TRUTH R7.
5. **`migration-safety-validator` scans tracked files only** — structurally blind to the 5 most dangerous migrations. DATABASE_TRUTH §8.
6. **`129` migration numbering collision** — two files share the prefix; lexicographic apply order is deterministic but a rename foot-gun. DATABASE_TRUTH §3.
7. **68 migrations with no rollback pair** (073–138, 140, 157) — forward-fix by policy; no scripted reverse path for the app-marketplace + mobile-V2 + internal-OS body. DATABASE_TRUTH §8.
8. **Duplicate `provider_payment_id` unique index** (`107` vs `142`) — wasted write throughput per acknowledged seam. DATABASE_TRUTH §6.
9. **Zero `DROP TABLE` in the entire chain** — dead product-era tables accumulate forever; no DROP policy exists. DATABASE_TRUTH §7.6.
10. **MCP 62-route duplicate backend + storefront third surface** — every shared domain has 2–3 writers to keep aligned by hand. CODEBASE_REALITY §1.9, §5.
11. **34/64 mobile screens unreachable** (incl. KYC, 2FA, returns, the theme editor) + 36 dead `/features/*` routes with lying mappings (`/features/order-detail` → a list screen). MOBILE_TRUTH §1.1, §4.
12. **42 source-string test assertions protecting dead code** — `mobile_services_test.dart:947-1008` "verifies" the dead section editor; 7 of 8 theme `.mjs` tests are text-regex, not behavior. MOBILE_TRUTH §8; THEME_PARITY §11.
13. **No executed test covers migration `165`'s RPCs** — D5's SQL has never run in CI; money tests that do execute cover only 139/160. MONEY_TRUTH §10.
14. **190 hardcoded `Color(0x…)` literals** in the mobile app (~63 inside dead editor widgets) against a verified-in-sync DTCG token bridge. MOBILE_TRUTH §6.
15. **ui_kit ships 19 widgets; the app uses 1** — plus kit-internal duplicate pairs (`empty_state*`, `error_*`). MOBILE_TRUTH §1.7.
16. **`go_router ^17.0.0` dependency feeding only dead code** — the never-mounted deep-link router. MOBILE_TRUTH §1.10.
17. **Root `analysis_options.yaml:12-27` suppresses `dead_code`/`unused_*` globally** — repo-wide dead-Dart blindness by policy. CODEBASE_REALITY §10.
18. **Reserved manifest garbled prose** across all 10 service manifests (5–11 "service-local event helpers" repetitions each). CODEBASE_REALITY §9.
19. **Payout statement dedup via `metadata.source_order_ids` JSON** — fragile JSON-metadata exclusion logic for money math (`payouts.ts:292-311`). MONEY_TRUTH §2e.
20. **Dual dashboard contracts** — 5 sequential gateway calls (analytics screen) vs 1 composite BFF call (home); two field sets to keep aligned by hand. MOBILE_TRUTH §3.
21. **`RUNTIME_SECTION_SCHEMAS` re-declaration + `template-resolver` compose fork** — the fork hosts the Liquid canary, making the legacy path load-bearing for the strategic winner. THEME_PARITY §2.5; DUPLICATE §6.
22. **5 schema-only built-in section types render a fallback box** — incl. `announcementBar`, which the default Urban Kicks template ships. THEME_PARITY §2.3.
23. **Liquid sources live as TS string literals** — zero `.liquid` files on disk; no partials/snippets; 5,000-char template_config cap vs 200 KB bundle cap means draft/publish can't carry real Liquid sources. THEME_PARITY §3.3, §9#11.
24. **Empty husks and stale residue** — `legacy/`, `tests/projections/`, `docs/mobile-migration-blueprint/`, `.codex/`, stale `stash@{0}`, `.changeset` stale entry, 161 MB root `build/` cache. DELETION_REGISTRY §B, §4.
25. **Single-consumer package fragmentation** — `api-types` (1 real import) and the 5 identity satellite packages all consumed only by api-gateway at near-minimum usage. CODEBASE_REALITY §6.

---

## 11. Top 25 Production Blockers (classed per PRODUCTION_READINESS §6–§8)

**Class A — repo-fixable but uncommitted (the merge/commit seam):**

1. **A1** — All Phase A–D13 security/money/tenancy hardening uncommitted: `/switch` fix, asymmetric identity + CI key wiring, migrations 162–166, COD atomic ledger, settlement ownership fix, checkout digest binding, DOMPurify, fail-closed signing, all Phase B/C/D validators. (READINESS §6 A1)
2. **A2** — `main` is 30 commits behind and is the only deploy trigger; the merge is gated by SKIP-D1 and a runbook describing the wrong merge. (A2)
3. **A3** — Untracked constitutional layer + archives + ledger + 7 audit programs; `git clean -fd` destruction risk; archive-orphan commit trap. (A3)
4. **A4** — Worktree code ↔ untracked migration coupling: COD route calls a 165-only RPC; `rls-force-coverage-validator` requires untracked 164 on disk. (A4)
5. **A5** — Mobile release lane + signing fix untracked; HEAD ships debug-signed releases. (A5)
6. **A6** — Staging deploys 3 frozen apps; `projects.json` declares 9 production projects. (A6)

**Class B — human-only seams (`SKIPPED_HUMAN_DECISIONS.md`), launch-blocking subset:**

7. **SKIP-D1-MERGE-RUNBOOK-DIRTY-TREE** — nothing reaches production until the privileged clean-tree merge happens. (READINESS §7)
8. **SKIP-D3-IDENTITY-LIVE-PROVIDERS** — without ES256/Ed25519 keypairs + JWKS secrets, merchant login fails closed in staging and production.
9. **SKIP-PROVIDER-SECRETS** — payment/ESP/Cloudflare/Vercel production secrets; `SKIP_NEEDS_HUMAN_*` placeholders sit in prod wrangler vars today.
10. **SKIP-PROD-DNS-CUTOVER + SKIP-W3-DNS-CUTOVER** — canonical `letbuyy.com` hostnames may not resolve/attach.
11. **SKIP-D6-LIVE-CHECKOUT-CUTOVER** — `checkout.letbuyy.com` DNS + `CHECKOUT_SIGNING_SECRET` + migration 166 apply; without it production checkout URLs fail closed.
12. **SKIP-PROD-DEPLOY-PROMOTION** — branch protection/environment approvals; without it the next push to `main` is the deploy.
13. **SKIP-D2 + SKIP-D4 live RLS probes** — until probed, the repo cannot prove the leak class is closed in the deployed DB.
14. **SKIP-D5-LIVE-MONEY-RECONCILIATION** — wallet reads 409 until zero-variance evidence exists; split-rail credentials unprovisioned.
15. **SKIP-W0-PITR-TIER** — running real money on pg_dump-only recovery (restore drill never executed beyond plan mode).
16. **SKIP-W3-SENTRY-DSN** — production error visibility; note the DSN alone fixes nothing because no SDK exists (→ C11).

**Class C — genuine missing capability (no commit or secret fixes these):**

17. **C1** — Storefront capture path un-ledgered (`confirm_order_payment_with_ledger`, `baseline:1590`). (READINESS §8 C1)
18. **C2** — Refunds split-brained: orders-RPC and webhook paths un-ledgered. (C2)
19. **C3** — No payout provider client; `initiateTransfer` unconditionally throws. (C3)
20. **C4** — Reconciliation wiring-dead; wallet 409s permanently; no scheduler. (C4)
21. **C5** — Step-up is mock theater; validator certifies the mock. (C5)
22. **C6** — Mobile login Turnstile token double-spend — a code bug beyond the secret seam. (C6)
23. **C7** — 25 surviving PUBLIC `USING(true)` policies + raw-REST service-role bypass. (C7)
24. **C8** — `merchant_payable` triple-writer with no cross-source dedup; payout gross from `orders.total`. (C8)
25. **C11** — No alerting end-to-end: zero metric emitters, otel→nonexistent k8s, no error SDK, no paging channel; money-reconciliation alerting exists only as a flag name. (C11)

*Remaining Class-C items carried in full by PRODUCTION_READINESS §8: C9 Liquid unsalvageable (~10 gaps), C10 OIDC/OAuth/passkeys absent, C12 MCP second backend, C13 mobile navigation + no store-publish pipeline, C14 signature-only verify, C15 machine-enforced multi-region, C16 envelope/replay/AUTH_SECRET, C17 broken `tsc -b`, C18 subscription + app-fee revenue outside the ledger.*

---

## 12. Repository Health Score

**Method.** Five dimensions, each scored 0–10 against the 12 reports' evidence, weighted by how much each dimension governs whether the repository can be trusted as a record and operated as a system. This scores the **repository as an artifact** (not the product — that is §13).

| Dimension | Weight | What it measures |
|---|---|---|
| History integrity & version-control protection | 0.25 | Is the operative state committed, branch-aligned, and archive-protected? |
| Governance coherence | 0.20 | One law, internally consistent, ratified, honestly enforced |
| Code/doc truth alignment | 0.20 | Do docs/validators/names tell the truth about the code? |
| Duplication burden | 0.20 | One system per domain vs parallel implementations |
| Dead-weight ratio | 0.15 | Dead code/docs/screens/tables vs live surface |

**Working:**

- **History integrity — 1.5/10.** The operative platform is 512 D / 410 M / 77 ?? uncommitted; the constitutional layer, both archives, the program ledger, and migrations 162–166 have zero git history on any branch; the deploy branch is 30 commits behind; the commit trap and a stale stash threaten the state in both directions (GOVERNANCE_TRUTH §1.3-1.4; PRODUCTION_READINESS §5). The audit history of the company exists exclusively as loose files in one dirty working tree. This is the worst axis and is weighted accordingly.
- **Governance coherence — 4.0/10.** The WT law is the best-formed LetBuyy has ever had and its gate passes 90/90 (GOVERNANCE_TRUTH §7.2) — but it is unratified (with a self-declared ratification fiction), exists in two diverging texts of DOC 02, cites a spine document that doesn't exist, rebuilt its own self-block, and leaves 38 scan-generated nested authorities + ~16 contradicting governance docs in force (§7 above).
- **Code/doc truth alignment — 3.5/10.** `confirm_order_payment_with_ledger` writes no ledger; six lanes assert coverage one validator provides; step-up/sole-issuer/service-role validators allowlist what they claim to ban; prometheus/otel/SLO configs point at nothing; 67 generated docs are frozen falsehoods; 36 mobile routes exist for validators, not users (MONEY_TRUTH §2a; IDENTITY_TRUTH R7; PRODUCTION_READINESS §3.10). Honest counterweights: the seam registries, `mode: governance-contract-not-live-evidence` self-labeling, and provider-mode badging.
- **Duplication burden — 3.0/10.** ~60 documented duplicate pairs across 10 cluster families; every load-bearing domain has ≥2 live implementations; the saving grace is that the canon names a winner for ~90% of pairs — these are decided conflicts whose losers are still alive (DUPLICATE_REALITY §1.2-1.3).
- **Dead-weight ratio — 4.0/10.** 34/64 mobile screens dead; 67 generated docs; ~55 at-large prompts; 11 orphan validators; dead DB tables that can never be dropped; ~16 theater governance docs; 161 MB local cache at root — offset by the executed D11 purge (154 package files, 77 validators, 69 tests, 60 root docs already cut in WT) (DELETION_REGISTRY; CODEBASE_REALITY §9).

**Score: 0.25×1.5 + 0.20×4.0 + 0.20×3.5 + 0.20×3.0 + 0.15×4.0 = 0.375 + 0.80 + 0.70 + 0.60 + 0.60 = 3.075 → 3.1 / 10.**

**Reading:** a repository whose *content* has been dramatically improved by an uncommitted program, scored down to 3.1 almost entirely by the fact that none of that improvement is persisted, ratified, or honestly enforced yet. Committing alone (no code change) would move History integrity to ~6 and the composite to ~4.2; ratification + the self-block repeal + the theater retargets are what would push it past 5.

---

## 13. Production Readiness Score

Carried verbatim from PRODUCTION_READINESS_REPORT (§3–§4): **dual-scored** because the repository contains two candidate products.

- **(a) As-deployable today (from `main`, the only deploy path): 2.3 / 10** — "a system that would actively harm its first real users (takeover, leaks, rake, unguarded payouts)."
- **(b) Working-tree end-state (committed + merged + deployed + all human seams resolved): 5.5 / 10** — "a supervised closed beta of ~100 merchants on online payments with manual finance operations is plausible **after** the Class-C capability items in money/identity/mobile are closed; it is not 'ship to the open market'."
- The 3.2-point gap "is not a quality gap — it is a version-control and human-seam gap, plus a hard core of genuine missing capability that no commit fixes." (READINESS §1)

| Domain | Weight | (a) As-deployable today (`main`) | (b) Working-tree end-state |
|---|---|---|---|
| Payments / money | 0.16 | 1.5 | 4.5 |
| Identity | 0.13 | 2.0 | 5.5 |
| Tenancy | 0.13 | 2.0 | 6.5 |
| Security | 0.12 | 2.0 | 6.0 |
| Checkout | 0.10 | 3.0 | 6.0 |
| Operations | 0.08 | 3.0 | 5.5 |
| Observability | 0.07 | 2.5 | 4.0 |
| Themes | 0.07 | 4.0 | 6.0 |
| Architecture | 0.06 | 3.0 | 6.5 |
| Mobile | 0.05 | 1.5 | 3.5 |
| Governance | 0.03 | 2.0 | 7.0 |
| **Weighted overall** | 1.00 | **2.3 / 10** | **5.5 / 10** |

Verdict carried: **do not launch from `main` under any circumstances** (READINESS §10 — "shipping the exact artifact two forensic audits condemned, minus every fix, with the lights off").

---

## 14. Canonical System Registry

One row per domain: the canonical system per the WT canon (`AGENTS.md` AUTH-CHAIN; `LETBUYY_CANONICAL_SYSTEMS.md`), where it physically lives, and whether it is committed.

| Domain | Canonical system | Location | Committed? | Evidence |
|---|---|---|---|---|
| Supreme law | `LETBUYY_CONSTITUTION.md` (DOC 01) | `GOVERNANCE_REWRITE_2026_06_10/` | **NO — untracked, zero history** | GOV §3.1; ARCH §3.2 |
| Operative law | Promoted AGENTS_V2 | root `AGENTS.md` | Tracked, **modified uncommitted** (HEAD copy = scan law) | GOV §3.2 |
| Agent entry pointer | `CLAUDE.md` | root | Tracked, modified uncommitted | GOV §3.1 |
| Winner registry | `LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03) | `GOVERNANCE_REWRITE_2026_06_10/` | **NO — untracked** | ARCH §3.1 |
| Program record | `EXECUTION_LEDGER.md` + `SKIPPED_HUMAN_DECISIONS.md` | root | **NO — untracked** (validator-asserted) | GOV §4.1 |
| Commerce backend | `services/api-gateway` (monolith, 261 TS / 84,549 lines) | services/ | YES (modified) | CODE §3-4 |
| Mobile BFF | `services/mobile-bff` (449-line proxy) | services/ | YES (modified) | CODE §4 |
| Webhook ingress/egress | `services/webhook-service` | services/ | YES | CODE §4; MONEY §8 |
| Async/queues | `services/queue-workers` | services/ | YES (+1 untracked file) | CODE §4 |
| Storefront | `apps/storefront-runtime` | apps/ | YES (modified) | CODE §3 |
| Merchant admin (control plane) | `apps/merchant-control-plane` — *control plane only; its 62-route API surface is a non-canonical second backend* | apps/ | YES (modified) | CODE §1.9; DUPLICATE §7.1 |
| Identity | `apps/identity-platform` — sole issuer | apps/ | App YES; **asymmetric topology UNCOMMITTED** (`identity-issued-session.ts`/`identity-session-verifier.ts` untracked) | IDENT §1-2 |
| Ops console | `apps/platform-console` (PHASE-C survivor) | apps/ | YES | ARCH §9 |
| Marketing | `apps/marketing-site` | apps/ | YES | CODE §3 |
| Mobile | `apps/mobile/merchant-app` (only real Flutter app) | apps/mobile/ | App YES; **D8/D9 hardening uncommitted** | MOBILE §10 |
| Database schema | `database/supabase/migrations/` 000–166 | database/ | **000–161 YES; 162–166 + 5 rollbacks UNTRACKED** | DB §3 |
| Money truth | Canonical double-entry ledger (`139`/`160`/`165`) | migrations + `routes/payments.ts` | 139–161 at HEAD; **165 untracked; buyer path not yet wired in any state** | MONEY §1-3 |
| Tenancy | RLS+FORCE+GUC `app_tenant` (`164`) + `withTenantTx` | migrations + `lib/tenant-transaction.ts` | **UNTRACKED / uncommitted** | DB §5; IDENT §5 |
| Tenant registry | `tenant-tables.registry.ts` (261 entries, generated 2026-06-10) | api-gateway/src/tenant/ | YES (tracked) | DB §10 |
| Theme renderer (operative) | React section registry (20 frozen + header/footer) | `apps/storefront-runtime` | YES — frozen by validator (untracked) | THEME §2 |
| Theme renderer (strategic) | Liquid (canary default OFF, flip ARB-deferred) | `packages/theme-engine` | **Engine changes uncommitted**; HEAD has regex sanitizer | THEME §1, §5 |
| Theme editor | MCP web editor (JSON/schema) + (canon-protected) mobile editor | apps/merchant-control-plane; mobile pair currently dead | Web YES; mobile editor unreachable | THEME §7; MOBILE §1.2 |
| Commission | 0 bps permanent | migration `162` + WT code | **NO — untracked; every committed state = 3%** | MONEY §6 |
| Payout rail | `razorpay_route` PA-split, never-custody, `claim_payout_statement_release` guard | `payouts.ts` + `160` | Guard at HEAD (not `main`); **rail default uncommitted; no provider client in any state** | MONEY §7 |
| Checkout | Hosted `checkout.letbuyy.com` served by the monolith/storefront; reserve→commit inventory (`166`) | gateway + storefront | Core YES; **D6 binding + 166 untracked** | MONEY §2; READINESS §3.7 |
| Canonical domain | `letbuyy.com` | `production-topology.json:5` | YES (modified file) | ARCH §8 |
| Design tokens | DTCG `tokens.json` → `@letbuyy/ui` + Dart bridge (`--check` passes) | packages/typescript/ui + packages/dart/ui_kit | **Bridge rewrite uncommitted** | MOBILE §6 |
| Validator gate | `scripts/validate-governance.mjs` 90-lane | scripts/ | Orchestrator modified; **22 Phase B/C/D validators untracked** — a clean clone has no money/identity gates | GOV §7; MONEY §10 |
| Topology contract | `production-topology.json` + `deployment-topology.json` (minus `globalRegions`) | config/runtime/ | Modified uncommitted | ARCH §8 |
| Deploy lane | `production-deploy.yml` (5 apps + 4 workers, branch-lag guard) | .github/workflows/ | Modified uncommitted — **GitHub executes HEAD's 9-app matrix** | CODE §8, §11 |

---

## 15. Strategic Winner Registry

Winners per the ratified canon (root `AGENTS.md` WIN-R rules; `LETBUYY_CANONICAL_SYSTEMS.md`; FADR ADRs), as confirmed by DUPLICATE_REALITY winner columns.

1. **Working-tree end-state** over both committed realities (DUPLICATE §2).
2. **AGENTS_V2 + Constitution stack** over the scan-generated regime (DOC-R1/ANTI-R8).
3. **One-region modular monolith + 4 satellites** over the distributed/multi-region layer (Constitution §6; ARCH-R8).
4. **Monolith + manifest-only reserved seams** over the reserved-fleet/WASM blueprints (ARCH-R3/R4, ADR-019).
5. **identity-platform as sole asymmetric issuer** over gateway `randomHex` mint (IDN-R1/R2).
6. **Per-audience asymmetric tokens** over the `AUTH_SECRET` HS256 family (SEC-R7).
7. **identity-platform** over the gateway `identity-foundation/` shadow stack (IDN-R3).
8. **Single identity-boundary Turnstile verification** over the BFF-pre-verify double-spend (CANONICAL_SYSTEMS #4).
9. **One revocable identity session service** over per-realm stateless JWTs (CANONICAL_SYSTEMS #6).
10. **Canonical append-only double-entry ledger** over the mutable wallet model (PAY-R1; CANONICAL_SYSTEMS #12).
11. **Ledgered V1 capture/refund surface** over `confirm_order_payment_with_ledger` and the un-ledgered refund paths (PAY-R2).
12. **Single settlement writer per account** over the 3+1 `merchant_payable` writers (PAY-R6; CANONICAL_SYSTEMS #13).
13. **Atomic `reconcile_cod_remittance_with_ledger` RPC** over the two-step wallet credit (CANONICAL_SYSTEMS #14).
14. **0 bps commission, permanent** over the 3% rake (PAY-R3/NEVER-R5).
15. **`razorpay_route` PA-split never-custody** over `razorpayx` self-custody (PAY-R4/NEVER-R2).
16. **`payout_statements` + `claim_payout_statement_release` guard** over orphan settlement-scheduled `payouts` rows (CANONICAL_SYSTEMS #13).
17. **Liquid renderer (server-authoritative)** over React — with React explicitly frozen-not-deleted until the parity condition (THEME-R1; Rule C3).
18. **`packages/theme-engine` schemas + compose** over the storefront re-declaration and `template-resolver` fork (THEME-R3).
19. **Gateway as the only commerce backend** over the MCP 62-route surface and the storefront partial surface (ARCH-R1/R17; CANONICAL_SYSTEMS #27).
20. **The 8-runtime deploy matrix applied to all lanes** over the 9-app/frozen-app staging + projects.json drift (DEPLOY-R2).
21. **RLS+FORCE+GUC (`withTenantTx`/`app_tenant`)** over blanket service-role and the raw-REST plane (SEC-R9; WIN-R3).
22. **Honest validator lanes, one domain-owning assertion per fact** over the 6 aliases and 5 duplicated assertions (ANTI-R3; DOC-R4).
23. **`EXECUTION_LEDGER.md` + `SKIPPED_HUMAN_DECISIONS.md`** over `tasks/todo.md` + `memory/lessons.md` (DOC-R4).
24. **Branch-lag guard + a real promotion runbook** over `MERGE_RUNBOOK.md` (DEPLOY-R1).
25. **Mobile winners** — live Navigator over GoRouter; `widgets/dashboard/*` over `widgets/home/*` twins; composite BFF dashboard over the 5-call fan-out; DTCG token bridge over app-local authorities; one restored theme editor over two dead ones (CANONICAL_SYSTEMS #25/#28/#29/#35).

---

## 16. Strategic Loser Registry

Each loser: why it is still alive + the condition that makes it removable (DUPLICATE_REALITY §13 carried; conditions verbatim where load-bearing).

| # | Loser | Why it survives | Removability condition |
|---|---|---|---|
| 1 | `main`/HEAD as operative realities | `main` is the only deploy trigger; the winner is uncommitted | Commit (avoiding the trap) → ARB GATE-1 ratification → fast-forward `main` → deploy → live-seam probes (SKIP-D2/D3/D4/D5/D6) |
| 2 | Scan-generated regime (root @HEAD + 38 nested) | Committed law at HEAD/main; nested files unpoliced (validators root-only) | Commit + re-author/strip the 38 + extend the anti-scan validator below root |
| 3 | Distributed/multi-region contract layer (~60 artifacts) | **The new law's own validators mandate it** (end-state + survivability validators) | SURVIVABILITY-UNHOOK (§18.2), ARB-ratified |
| 4 | Gateway `randomHex(32)` session mint | The deployable reality; asymmetric files absent at HEAD/main | Commit + deploy + IDN-R2 dual-verify drain ("zero legacy-HS256 verifications" telemetry) |
| 5 | `AUTH_SECRET` HS256 family (7 domains) | Asymmetric covers exactly one token type; every other realm has no replacement | Asymmetric/dedicated-secret issuance for shopper/console/app/federation/`lb_accounts` realms first |
| 6 | Gateway `identity-foundation/` shadow stack (18 files) | IDN-R3 marks it SAFE_DELETE only after identity-platform serves verify-only live; not yet deployed | Identity-platform live + verify-only in production (V-SMOKE) |
| 7 | BFF Turnstile pre-verify (double-spend half) | No design decision yet on which verification yields | Design decision (drop pre-verify or per-verifier tokens), preserving fail-closed (SEC-R1) |
| 8 | Stateless customer/console JWTs | Buyer/ops issuance hasn't moved to identity-platform | Realm migration + revocation parity proven |
| 9 | Mutable wallet model (`wallet_ledger_entries` etc.) | Compatibility projection; wallet reads depend on it; reconciliation unproven | DEL-R2: zero-drift reconciliation-harness proof + live backfill (SKIP-D5) |
| 10 | `confirm_order_payment_with_ledger` no-ledger chain | It IS the buyer path in all three realities; the winner was never wired onto it | Storefront confirm chain posts canonical entries (or routes through the canonical adapter) + harness green + deploy |
| 11 | Un-ledgered orders-RPC + webhook refund paths | Live buyer/ops paths; only the V1 surface was fixed | Canonical reversing entries on both paths (TEST-R3 harness as deletion gate) |
| 12 | 3+1 `merchant_payable` writers | Per-source idempotency only; no cross-writer design exists | Cross-writer dedup / single-writer consolidation + ARB call per flow (AGENT-R15.1) |
| 13 | HEAD two-step COD path | Migration 165 untracked — the winner doesn't exist at HEAD | Commit 165 + apply to live DB |
| 14 | 3% commission defaults | Every committed state carries them; 162 untracked | Commit 162 + validator; ARB call on the in-place history rewrite; live rows UNVERIFIED |
| 15 | `razorpayx` defaults + enum residue | HEAD defaults; enum/CHECK-level legality needs a migration | Commit + enum/CHECK cleanup migration; live Route creds are HR-PA-SPLIT-LIVE |
| 16 | Settlement-scheduled `payouts` instruction rows | PA-split instruction flow design is human-gated | ARB unify-vs-drop decision + live Route credentials |
| 17 | React renderer (THE flagship frozen loser) | **Deleting it today blanks every storefront**; Liquid is NOT-READY (THEME §10) | Full §18.1 parity condition + Wave-6 data decision (flip record is ARB-deferred) |
| 18 | `RUNTIME_SECTION_SCHEMAS` + `template-resolver` fork | The fork hosts the Liquid canary — the loser is load-bearing for the winner | Engine absorbs plan/canary resolution + schema parity of the 10 runtime-only schemas |
| 19 | MCP 62-route second backend | Which surface each UI page calls is untraced; cutover untested | Per-page call-graph trace + proxy-or-port cutover with contract tests per route |
| 20 | Frozen-app staging rows + projects.json production entries | Canary-vs-oversight intent undecided; live Vercel state UNVERIFIED | Intent decision + live Vercel confirmation, then config cuts |
| 21 | Blanket service-role + raw-REST planes | 164 untracked; per-route `withTenantTx` adoption unproven; raw helpers have callers | Commit 164 + per-route adoption proof (RT-1…9, TEST-R4) + guard-or-delete the raw helpers |
| 22 | 6 theater aliases + duplicated 4-region assertions | Workflows still call the alias names; the 4-region assertions are validator-mandated | Workflow retarget in the same change; ARB repeal for the multi-region pair |
| 23 | Diverged prompt twins + `docs/` prompt corpus | `docs/` is outside the enforcement perimeter; recorded evasion precedent | Newest-copy reconcile into archive + a prompt-archive ratchet below root |
| 24 | `tasks/todo.md` + `memory/lessons.md` fossils | AGENT-R16 mandates reading them | Amend AGENT-R16 to point at living equivalents; resolve LEG-078 contradiction |
| 25 | Mobile dead duo: GoRouter system + dead editor pair | Source-string tests protect them; editor capability is canon-protected (THEME-R5) | Test retarget (GoRouter); ARB wire-or-delete pick + nav re-entry (editor — protect the capability, collapse the duplicate) |

---

## 17. Delete-Never List

The load-bearing spine (DELETION_REGISTRY summary lists 1–2). **[COMMIT!]** = currently untracked/uncommitted and one `git clean` from destruction.

1. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` + the 6 sibling rewrite docs **[COMMIT!]**
2. Root `AGENTS.md` (promoted AGENTS_V2) + `CLAUDE.md` **[COMMIT!]**
3. `EXECUTION_LEDGER.md` + `SKIPPED_HUMAN_DECISIONS.md` (validator-asserted program record) **[COMMIT!]**
4. `scripts/validate-governance.mjs` + the 90-validator gate lane incl. the 22 untracked Phase B/C/D validators **[COMMIT!]**
5. `database/supabase/migrations/` 000–166 + rollbacks (162–166 untracked — highest-priority preserve) **[COMMIT!]**
6. The 4 canonical services: `api-gateway`, `mobile-bff`, `webhook-service`, `queue-workers`
7. The 6 canonical apps: `storefront-runtime`, `merchant-control-plane`, `identity-platform`, `platform-console`, `marketing-site`, `mobile/merchant-app`
8. `config/runtime/production-topology.json` + `deployment-topology.json` (minus the `globalRegions` block, which is DAP)
9. `services/api-gateway/src/tenant/tenant-tables.registry.ts` + its generator
10. `.github/workflows/` (11 workflows) **[COMMIT!]**
11. `package.json` + `pnpm-workspace.yaml` + `turbo.json` + lockfiles **[COMMIT!]**
12. Root `pubspec.yaml` (Melos workspace) + `packages/dart/{core,api_client,models,ui_kit}`
13. The 21 surviving npm lib packages (every one has ≥1 real inbound import — CODE §6)
14. `config/governance/` + `config/supabase/` + `infrastructure/cloudflare|dns`
15. `docs/archive/**` (865 files — it IS the historical record, AUTH-R2; the 2026-06-10 sets are the **only copies** of seven audit programs) **[COMMIT!]**
16. `STRATEGIC_CANONICALIZATION_2026_06_10/` (ratified ADR evidence, cited by `AGENTS.md:37`) **[COMMIT!]**
17. `REPOSITORY_TRUTH_AUDIT_2026_06_10/` (this audit's reports) **[COMMIT!]**
18. Reserved runtime roots' `AGENTS.md` + `runtime.manifest.json` (8 roots — existence validator-mandated; content [REWRITE])
19. `scripts/generate-repository-intelligence.mjs` — the retirement tombstone is law (validator-asserted exit-1)
20. `artifacts/` evidence trees (validator-consumed)
21. `tests/executable/` dockerized-Postgres money/session tests (the only DB-executing proof in the repo)
22. `docs/design-system/` + `docs/seo/` + `docs/LOCAL_DEV.md` (live reference)
23. React renderer + 20 frozen sections + header/footer — delete-never **today** (frozen loser; §18.1 governs its eventual fate)
24. `apps/mobile/{shopper-app,operator-app}` manifest-only roots (existence + manifest-only-ness validator-mandated while end-state law stands)

---

## 18. Delete-After-Parity List

The 14 clusters with their precise parity/repeal conditions (DELETION_CANDIDATE_REGISTRY §3 + §I, conditions carried verbatim). **Nothing on this list is deletable until its condition is provably true — and nothing is deletable at all before the global commit.**

**18.1 React theme renderer + 20 frozen sections + header/footer.**
Condition (verbatim from THEME_PARITY §10): Liquid header/footer sections + section-group routing; commerce-drop-driven product/collection sections; product/collection/cart/page templates in the first-party bundle; real cart/customer drops; layoutHtml/head adoption decision (or an explicit decision to keep Next-controlled head); a canary write path + merchant install/edit surface; per-section Liquid editor preview; per-section settings-schema parity; asset pipeline; **then commit + deploy of D7 itself**; per-section parity harness green (TEST-R6) + security suite green + live canary cohort data; the ARB Wave-6 flip decision (`THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'`, `theme-governance.ts:16-21`, hard-failed by `theme-governance-validator.mjs:58-63` if flipped without it). Deleting today blanks every storefront.

**18.2 Survivability/multi-region/chaos/load/certification cluster (~60 artifacts).**
Condition = **SURVIVABILITY-UNHOOK**, the 5-step ARB repeal (registry §I, verbatim):
1. ARB decision recorded (new SKIP/ledger row) that the D12/D13 survivability-restore contradicts Constitution `:98/:112` and is repealed;
2. amend `scripts/validators/whole-repo-end-state-validator.mjs` — drop the `validate:survivability`/`validate:production-certification` script mandates (`:99-100`), the `globalRegions` india/apac/eu/us assertion (`:172-177`), and the 4-fragment workflow mandate (`:179-193`);
3. delete/retire `survivability-governance-validator.mjs` and remove `validate:survivability` (+ theater aliases) from `package.json` and from `architecture-governance.yml` / `production-rollout.yml` / `live-production-certification.yml`;
4. remove the `regions.globalRegions` block from `config/runtime/production-topology.json:34-39`;
5. re-run the gate (must stay green).
Only then do `chaos/`, `load/`, `multi-region-runtime.json` (+schema), `survivability-execution.json`, the `observability-platform.json` split, the 10 `validate:production-certification` validators, `operational-proof-validator`, the `infrastructure/scripts/{operations,load,chaos}` suite, ~16 theater governance docs, 6 theater runbooks, and `tests/{chaos,survivability,replay,queues,operations,production-certification}` become deletable/archivable.

**18.3 Six `package.json` theater aliases** — condition: retarget `architecture-governance.yml:75-81` callers in the same change.
**18.4 Previous-product residue batch** (§L: gateway `portfolio.ts`/`resume.ts` + mounts, BFF allowlist lines, 8 MCP pages, DB tables, `site_type` enum, portfolio React sections, cms-core re-exports) — condition: `SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE` live writer/reader probe + one ARB product decision that non-store site types are dead (+ freeze-list/parity-count amendment for the React sections, which are double-locked).
**18.5 DB dead tables** (`portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements`) — condition: live `pg_stat_user_tables` probe **and** ratification of a first-ever DROP-TABLE migration policy (the chain has zero `DROP TABLE` by construction).
**18.6 Duplicate `provider_payment_id` index** (`107` vs `142`) — condition: live `pg_indexes` + query-plan proof in a maintenance window (`SKIP-D11-PROVIDER-PAYMENT-ID-INDEX-LIVE-DB`).
**18.7 Mobile theme-editor pair** (~1,830 lines + 12 editor widgets) — condition: ARB wire-or-delete product decision + rewrite of the 42 protecting source-string tests (canon protects the editor capability — THEME-R5).
**18.8 Mobile capability screens** (25 + 9 transitive) — condition: per-screen wire-navigation-vs-delete product decision (all are real, service-backed implementations).
**18.9 `sections/marquee.tsx`** — condition: amend the exactly-20 freeze validator (`no-new-react-sections-validator.mjs:9-30`) + `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT`.
**18.10 `memory/lessons.md` + `tasks/todo.md`** (archive, not delete) — condition: amend `AGENTS.md` AGENT-R16:380 + resolve the LEG-078 contradiction.
**18.11 `apps/platform-operations-portal`** (archive) — condition: unique employee-execution modules ported/verified into `platform-console` (PHASE-C survivor already decided).
**18.12 `apps/developer-portal`** (archive) — condition: ARB consolidation decision (CLAUDE.md "frozen or pending consolidation").
**18.13 Distributed-era config contracts with 1–2 consumers** (12 files, registry §I) — condition: retire each one's single consuming validator/script (mostly the certification lane) first.
**18.14 `tests/federation/` + source-regex-only test files** — condition: per-file behavioral-value triage (NEEDS-EVIDENCE first).

---

## 19. Delete-Immediately List

All post-commit (the global precondition); highest-confidence rows (DELETION_REGISTRY §4).

1. 67 generated intelligence docs (`docs/*/README.md` tree + `docs/architecture/{master-system-intelligence,README}.md`) — tracked, history preserves; generator hard-retired; verified stale falsehoods.
2. 11 orphan validators (full list §5 row 2) — zero external references, re-verified per file.
3. `.codex/` (empty dir) + `.codex-dev.log` (0 bytes).
4. `.DS_Store` ×3 (root, `load/`, `docs/research/`).
5. Root `build/` (161 MB Flutter test cache), `.dart_tool/`, `.tmp/`, `test-results/`, `.pnpm-store/`, `.turbo/` — machine-local.
6. `legacy/` empty husk (after committing the 37 tracked deletions; archive copies in `docs/archive/firebase-legacy/`).
7. `tests/projections/` empty dir.
8. `docs/mobile-migration-blueprint/` empty dir (contents git-history-only since `47f29bc6`).
9. `apps/storefront-runtime/src/app/demo/urban-kicks/` — live-routed demo residue.
10. `firebasestorage.googleapis.com` remotePattern (`storefront next.config.ts:43`) — dangling trust grant.
11. 3 frozen-app rows in `staging-deploy.yml:189-200` + 4 frozen-app entries in `config/vercel/projects.json:79-137`.
12. `tsconfig.workspace.json:68` dangling `./packages/typescript/utils` reference.
13. `pubspec.yaml` `run:super_admin` melos script.
14. Mobile true-dead-weight set (platform_blocked screen+service, upgrade_screen, splash_screen, `widgets/home/` duplicate pair, `widgets/shared/empty_state.dart`, `deep_link_router.dart` + `go_router` dep) — with same-change test edits.
15. `ui_kit` internal duplicates — one each of `empty_state_widget` vs `empty_state`, `error_view` vs `error_widget`.

*Already executed in the working tree — finalize by commit [DBU]: 8 rejected package roots (154 files), 77 validators, 69 theater tests, 37 firebase files, 6 helm/k8s files, 60 root docs, 38 governance docs, 16 task missions, 2 mobile parity files, `packages/dart/services`, `mobile-tokens.ts`. The deletion IS the working tree; `git checkout .` undoes all of it.*

---

## 20. Archive-Immediately List

All moves under `docs/archive/`, post-commit (DELETION_REGISTRY §5 — 9 groups, ~195 files).

1. `docs/Codex_waves/` — 26 files (12 DANGEROUS incl. the prompt factory + 6 paste-ready terminal relaunchers).
2. `docs/agents/` — 42 files (stale mandatory-reading instruction layer, 2026-05-24).
3. Docs-root prompt/plan family — `CODEX_LETBUYY_FOUNDATION_MISSION.md`, `LETBUYY_MASTER_EXECUTION_PLAN.md`, `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md`, `P0…P4_*_MASTER.md` (8 files).
4. Frozen-app mission/audit families — `apps-marketplace-audit/` (3; reconcile the 2 diverged twins during the move), `themes-marketplace-audit/` (17), `developer-platform-audit/` (1), `internal-operating-system-audit/` mission set (3), `auth/2026-06-08` identity missions (3).
5. `docs/audit/` (19) + `docs/commerce-os-audit/` (10) + `docs/audits/` — dangerous replatform blueprints.
6. `docs/analysis/` Part1–4.
7. Superseded docs-root master audits/reports/logs (~25 files, §6 rows 14–15) + `docs/LETBUYY.md`.
8. Root business binaries — 2 `.pptx` + 2 `.xlsx` → `docs/archive/root-governance-2026-06-10/`.
9. `MERGE_RUNBOOK.md` current text — after the replacement runbook for the real `stepup/main`→`main` promotion exists.

*(Conditional archive, after SURVIVABILITY-UNHOOK: ~16 theater governance docs + 6 theater runbooks — counted in §18.2, not here.)*

---

## 21. Consolidated Unknowns / UNVERIFIED

All out-of-scope seams, merged from the 12 reports. Nothing below was guessed; each is explicitly unverifiable from the repository.

**A. Live infrastructure (no access; repo self-labels `mode: governance-contract-not-live-evidence`, `production-topology.json:6`):**
1. Which reality actually serves production — deployed worker/app versions, whether the frozen four still serve, DNS, Vercel project truth, whether any out-of-band hotfix shipped the `/switch` fix (READINESS §11; IDENT §9; CODE §13.1).
2. Whether GitHub branch protection / environment approvals exist (SKIP-PROD-DEPLOY-PROMOTION) (READINESS §11.7).
3. Whether the `letbuyy-production-telemetry` AE dataset is provisioned/queried anywhere (READINESS §11.6).
4. Live CI execution of the restored workflows and `verify-health-gates.mjs` probes (ARCH §10.3; READINESS §11.9).

**B. Live database (no DB access):**
5. Whether migrations 162–166 were ever applied out-of-band; whether the live DB even has 159–161 (`main` ends at 158) (DB §11.2; MONEY §11).
6. Live RLS/grant truth — `pg_policies`, `role_table_grants`, `relforcerowsecurity`; whether the 25 residual PUBLIC policies are anon-reachable at runtime (DB §11.1, §11.5).
7. Dead-table writer/reader proof (`pg_stat_user_tables`) for the portfolio/resume/gift-card cluster (SKIP-D11) (DB §11.3).
8. Duplicate-index physical state + plan proof (SKIP-D11) (DB §11.4).
9. EXECUTE grant state of `backfill_wallet_ledger_to_canonical` (PostgreSQL function default = PUBLIC) (MONEY §11).
10. Whether any production store row carries `liquidRenderingCanary: true` or a `liquidBundle` (no setter exists; presumed none) (THEME §11).
11. Whether `main`'s payout adapter at `bf8c18c1` fabricates UTRs or fails (inferred from migration absence, not read line-by-line) (READINESS §11.2).

**C. Live providers (not exercised):**
12. Cloudflare Turnstile siteverify verdicts — the mobile double-spend is code-derived; real (non-test) site keys are pinned (MOBILE §11; IDENT §9).
13. Supabase Auth behavior, KMS real-provider path, Razorpay Route/Cashfree split rails, webhook secrets, provider settlement feeds (IDENT §9; MONEY §11 — SKIP-D5 by design).
14. Whether `INTERNAL_API_SECRET`/`TURNSTILE_SECRET_KEY` are actually provisioned on deployed workers (wrangler comments say Turnstile prod is deliberately unprovisioned) (MOBILE §11).

**D. Repo-level unresolved (in-repo but not determinable):**
15. Whether any human ARB reviewed/accepted GATE-1 outside the repo (only the skip is recorded) (GOV §9.4).
16. Whether the D12 multi-region restoration was directed or improvised — no SKIP row covers the decision (ARCH §10.1).
17. `_GOVERNANCE_SPINE.md` — authored-and-lost vs never-written (ARCH §10.2; DUPLICATE §14.9).
18. Content-level audit of the ~61 "benign" `docs/governance` survivors; byte-fidelity of archive copies with no HEAD original (the 12 archived audit dirs); `git stash@{0}` contents (GOV §9.1-9.3, §9.7).
19. Newest-copy direction of the diverged prompt twins; the mission that generated `tasks/env-setup-skips.md`; `AGENT_PROMPT_claude_setup.md` rename lineage (PROMPT §7).
20. Which backend surface each merchant UI page actually calls (MCP vs gateway) — winner/loser stands on canon; removability needs the per-page trace (CODE §13.4; DUPLICATE §14.2).
21. Whether the staging matrix's 3 frozen apps are intentional canaries or a PHASE-A-HARD-006 oversight (CODE §13.3).
22. Out-of-band consumers of the 11 orphan validators and the dead mobile `/features/*`/deep-link paths (none found in-repo) (DUPLICATE §14.7).
23. Whether HEAD's own 181-validator gate passes at HEAD (not runnable read-only from this tree) (GOV §9.2).

**E. Execution-environment seams of this audit:**
24. `flutter analyze`/`flutter test` and the tsx/esbuild-blocked behavioral suites (theme-engine, auth-switch-guard) — source read and quoted; execution blocked by darwin/linux binary mismatch in the sandbox; D-phase VERIFY rows claim implementer runs (THEME §11; IDENT §9; MOBILE §11).
25. The first ~66 gate validators were attested by "passed" log lines in a timed run; the resumed 24 all passed individually (GOV §9.5).

---

## 22. Method & Provenance

**Audit:** Repository-wide forensic truth audit, 2026-06-10 — multi-agent, discovery-only (no repository file modified except the reports in this directory). Two waves: nine axis reports (wave 1), then three synthesis/classification reports (wave 2), then this master synthesis.

**Repo state at audit:** branch `stepup/main` @ HEAD `5cf9e64e` ("fix(foundation): resolve final audit drift", 2026-06-10 08:42 +0530); `main` @ `bf8c18c1` (2026-06-09) — 30 commits behind, fast-forwardable, and the only production deploy trigger. Working tree massively dirty: **512 deleted / 410 modified / 76 untracked** at wave-1 baseline; **77 untracked** re-verified at synthesis time (`git status --porcelain` — the 77th entry is `REPOSITORY_TRUTH_AUDIT_2026_06_10/` itself; the DELETION_CANDIDATE_REGISTRY's "77 ??" and the wave-1 reports' "76 ??" are both correct for their timestamps). One stale `stash@{0}` ("On stream/letbuyy-ui-v2: branch-consolidation-local-artifacts"). All Phase A–D13 changes per `EXECUTION_LEDGER.md` (40 rows, every row "not committed"). Three temporal realities — `main` / HEAD / working tree — were distinguished per finding throughout.

**The 12 source reports** (all in `REPOSITORY_TRUTH_AUDIT_2026_06_10/`):

| # | Report | Axis |
|---|---|---|
| 1 | `GOVERNANCE_TRUTH_REPORT.md` | Canonical law, supersession, validator system, audit-history fate |
| 2 | `ARCHITECTURE_TRUTH_REPORT.md` | Canonical architecture, contradictions, dangling refs, runtime-map reality |
| 3 | `PROMPT_DRIFT_REPORT.md` | Prompt/mission/execution-artifact inventory and drift |
| 4 | `CODEBASE_REALITY_REPORT.md` | Actual topology, package graph, deploy configs, dead code, runnability |
| 5 | `DATABASE_TRUTH_REPORT.md` | Migration chain, schema census, RLS/grant final state, dead schema |
| 6 | `THEME_PARITY_REPORT.md` | React vs Liquid renderers, sanitizer, editor, marketplace |
| 7 | `IDENTITY_TRUTH_REPORT.md` | Auth, sessions, tokens, tenancy, service_role, OIDC, step-up |
| 8 | `MONEY_TRUTH_REPORT.md` | Capture, refund, COD, settlement, payout, commission, webhooks |
| 9 | `MOBILE_TRUTH_REPORT.md` | Flutter app, BFF, token bridge, release lanes, navigation truth |
| 10 | `DELETION_CANDIDATE_REGISTRY.md` | Repository-wide deletion classification (CANONICAL/KEEP/ARCHIVE/DELETE/NEEDS-EVIDENCE + DAP/DBU tags) |
| 11 | `DUPLICATE_REALITY_REPORT.md` | Every two-implementations-for-one-thing pair; winner/loser per ratified canon |
| 12 | `PRODUCTION_READINESS_REPORT.md` | Dual-scored readiness synthesis (2.3 / 5.5), A/B/C blocker classes |

**Method notes carried from the reports:** read-only git throughout (`status`, `diff`, `show`, `ls-tree`, `ls-files`, `log --all`, `rev-list`, `stash list`); validators executed read-only (gate lane 90/90 PASS; money/identity/DB/theme validators individually, outputs quoted in the axis reports); static final-state replay of the 92-migration chain for RLS/grant truth; no installs, no builds, no live network, no live DB; the harness Glob tool returned empty against this mount and findings relied on `find`/Grep instead (CODE §2). Conflicts between reports were resolved against the files themselves; the only material count discrepancy (76 vs 77 untracked) is resolved above. Synthesis rule: every list entry traces to a report finding with its citation; no invented items.

*End of master report. Discovery only — this synthesis is the sole file written by this pass.*
