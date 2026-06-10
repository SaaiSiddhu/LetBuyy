# DELETION CANDIDATE REGISTRY — Repository Truth Audit 2026-06-10

**Axis:** Deletion-candidate classification (repository-wide). **DISCOVERY ONLY — nothing was deleted; this file is the only write.**
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · branch `stepup/main` @ HEAD `5cf9e64e` (2026-06-10) · working tree dirty **512 D / 410 M / 77 ??** (`git status --porcelain` count at audit time).
**Baseline:** classifications are against the **working tree** (the intended end-state of executed Phases A–D13, all uncommitted per `EXECUTION_LEDGER.md`). HEAD/`main` divergence is flagged wherever it changes a verdict. `main` is 30 commits behind `stepup/main`; production CI deploys only from `main`.
**Evidence base:** the nine wave-1 axis reports in this directory (cited as `GOV`, `ARCH`, `PROMPT`, `CODE`, `DB`, `THEME`, `IDENT`, `MONEY`, `MOBILE` + section), plus this auditor's own spot-verification (cited as `path:line` or a shell probe described inline). Every row carries evidence; where evidence is insufficient the class is **NEEDS-EVIDENCE**, never DELETE.

## Legend

| Class | Meaning |
|---|---|
| **CANONICAL** | Load-bearing source of truth (law, machine contract, or the runtime itself). Delete-never. |
| **KEEP** | Active and needed (or mandated by current law/validators). |
| **ARCHIVE** | Historical value only; move under `docs/archive/` (or already correctly there). |
| **DELETE** | No remaining value; safe to remove now. |
| **NEEDS-EVIDENCE** | Cannot be classified without a probe/decision named in the row. |

| Tag | Meaning |
|---|---|
| **[DAP]** DELETE-AFTER-PARITY | Deletable only once the stated condition is proven. The condition is stated precisely in the row. |
| **[DBU]** DELETE-BLOCKED-UNCOMMITTED | The verdict only becomes durable/real after the working tree is committed. Applies in two directions: (a) deletions already executed in the worktree that only become final at commit, and (b) untracked keep-items that `git clean -fd` would destroy. |
| **[COMMIT!]** | Untracked or modified-uncommitted; zero git protection today. |
| **[REWRITE]** | Keep the slot, replace the content. |

**Global precondition (applies to every row):** `git add -A && git commit` on `stepup/main` **before any physical deletion or archive move**. The commit trap is real: 60 tracked root docs and 38 governance docs are tracked-deleted while their only archive copies are untracked — a tracked-only commit (`git commit -am`) commits the deletions and orphans the archive; `git clean -fd` destroys the Constitution, both 2026-06-10 archives, EXECUTION_LEDGER, SKIPPED_HUMAN_DECISIONS, and migrations 162–166 (GOV §1.3–1.4, §6#8; ARCH §1.1; DB §8). Also inspect-then-drop `git stash@{0}` (stale `stream/letbuyy-ui-v2` stash; popping it splices old-regime artifacts onto the new state — GOV §6#9, verified `git stash list`).

---

## A. Root files

| Artifact | State | Class | Tags | Evidence |
|---|---|---|---|---|
| `AGENTS.md` | tracked, M | **CANONICAL** (operative law = promoted AGENTS_V2) | [COMMIT!] | GOV §3.1–3.2; `AGENTS.md:1-11` |
| `CLAUDE.md` | tracked, M | **CANONICAL** (entry pointer) | [COMMIT!] | GOV §4.1; `CLAUDE.md:3` |
| `EXECUTION_LEDGER.md` | **untracked** | **CANONICAL** (program record; 18 action-IDs asserted by validator) | [COMMIT!] | `whole-repo-end-state-validator.mjs:122-144`; GOV §4.1 |
| `SKIPPED_HUMAN_DECISIONS.md` | **untracked** | **CANONICAL** (19 human seams asserted by validator) | [COMMIT!] | `whole-repo-end-state-validator.mjs:146-169` |
| `EXECUTABLE_HUMAN_REQUIRED.md` | tracked, clean | KEEP — fold into SKIPPED registry later (19 HR-* rows overlap SKIP-* rows) | | GOV §4.1, §6.3 |
| `MERGE_RUNBOOK.md` | tracked, clean | KEEP slot, **content SUPERSEDED/DANGEROUS** — describes merging two non-existent `stream/*` branches into `develop`, while SKIP-D1 sends the maintainer here for the real `stepup/main`→`main` promotion | [REWRITE]; old text → ARCHIVE. (In `allowedRootMarkdown` but not existence-asserted — `whole-repo-end-state-validator.mjs:16-24` — so replacement is legal.) | GOV §6#1; `MERGE_RUNBOOK.md:1-49` |
| `README.md` | tracked, clean | KEEP (defers to AGENTS.md) | | GOV §4.1 |
| `LETBUYY_BUSINESS_REVIEW_DECK.pptx`, `LETBUYY_MERCHANT_OS_BOARD_DECK.pptx`, `LETBUYY_MERCHANT_OS_ROADMAP.xlsx`, `LETBUYY_PRICING_UNIT_ECONOMICS_MODEL.xlsx` | tracked, clean | **ARCHIVE** → `docs/archive/root-governance-2026-06-10/` (their sibling business .md docs are already there; binaries escape the root-markdown budget only because the validator filters `.endsWith(".md")` — `whole-repo-end-state-validator.mjs:28`) | | CODE §10; shell probe (tracked clean) |
| `pubspec.yaml` | tracked, M | **CANONICAL** (Melos 7 Dart workspace root — intentional, not misplacement) — but its `run:super_admin` script line is **DELETE** (targets sourceless `apps/mobile/operator-app`) and `build:web` filter matches nothing | [COMMIT!] | CODE §10; MOBILE §9; `pubspec.yaml:34-36` |
| `pubspec.lock`, `analysis_options.yaml` | tracked | KEEP — but `analysis_options.yaml:12-27` globally suppresses `dead_code`/`unused_*` (repo-wide dead-Dart blindness by policy) → content fix recommended | | CODE §10 |
| `playwright.config.ts` | tracked, clean | KEEP (testDir `tests/e2e`; used by staging-E2E + prod smoke CI) | | CODE §10; `production-deploy.yml:483` |
| `.stylelintrc.cjs` | tracked, M | KEEP (`lint:css`) | [COMMIT!] | `package.json` `lint:css` |
| `vercel.json` (root) | tracked | KEEP (install command) | | CODE §8 |
| `turbo.json` | tracked | **CANONICAL** (build graph; only working typecheck path) | | CODE §7 |
| `tsconfig.base.json` | tracked | KEEP | | |
| `tsconfig.workspace.json` | tracked, M | KEEP — but reference `./packages/typescript/utils` is **DELETE** (dangling: directory exists neither on disk nor at HEAD; workspace `tsc -b` cannot succeed) | [COMMIT!] | CODE §7 (`tsconfig.workspace.json:68`; `git ls-tree HEAD packages/typescript/`) |
| `package.json` | tracked, M | **CANONICAL** — but 6 theater alias names (`validate:distributed-execution`, `durable-execution`, `distributed-survivability`, `operational-certification`, `replay`, `survivability-intelligence`) all run `no-scan-generated-agents-validator.mjs` → **DELETE [DAP]**: retarget `.github/workflows/architecture-governance.yml:75-81` callers first | [COMMIT!] | CODE §1.7; GOV §5.6; `package.json` (script dump verified) |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc`, `.gitignore`, `.gitattributes` | tracked (first two M) | KEEP | [COMMIT!] | CODE §6 |
| `.codex-dev.log` | untracked, gitignored, **0 bytes** | **DELETE** | | PROMPT §3.1; shell probe |
| `.DS_Store` (root; also `load/.DS_Store`, `docs/research/.DS_Store`) | ignored junk | **DELETE** | | shell probe (`git check-ignore` Y) |

## B. Root directories

| Artifact | State | Class | Tags | Evidence |
|---|---|---|---|---|
| `GOVERNANCE_REWRITE_2026_06_10/` (7 docs incl. `LETBUYY_CONSTITUTION.md`) | **untracked, zero git history** | **CANONICAL** (constitutional stack; Constitution is apex) — `LETBUYY_AGENTS_V2.md` source copy is 3 hunks stale vs the promoted root copy → sync or annotate | [COMMIT!] | GOV §3.2, §4.1; ARCH §3.2 |
| `STRATEGIC_CANONICALIZATION_2026_06_10/` (16 files incl. FADR) | **untracked** | KEEP (ratified decision record; AGENTS.md:37 cites it at root as evidence base — "the why, not authority") | [COMMIT!] | GOV §4.1; ARCH §4.1 |
| `REPOSITORY_TRUTH_AUDIT_2026_06_10/` (this audit, 10 reports) | untracked | KEEP (current verified evidence; archive only when superseded by a later audit set) | [COMMIT!] | self |
| `legacy/` | **empty dir** (37 firebase files tracked-deleted; copies in `docs/archive/firebase-legacy/`) | **DELETE** the empty husk | [DBU] — commit the 37 deletions + the untracked archive first | CODE §9; MONEY §4.4; shell probe (`files=0`) |
| `memory/` (`lessons.md` only) | tracked, clean | **ARCHIVE** — 2026-03-01 fossil; every Location anchor is dead topology; Lesson 36 instructs maintaining the retired generator. **[DAP]** condition: amend `AGENTS.md` AGENT-R16 (line 380, mandates reading it) and resolve the AGENT-R16 ↔ LEG-078 (sentenced-to-DELETE) contradiction first | [DAP] | PROMPT §3.1, §4.6; GOV §4.1 |
| `tasks/todo.md` | tracked, clean | **ARCHIVE** — 2026-03-01; records the now-forbidden "generate AGENTS.md from repository scan" as the completed playbook. Same **[DAP]** condition as `memory/lessons.md` (AGENT-R16 amendment) | [DAP] | PROMPT §3.1, §4.6 |
| `tasks/env-setup-skips.md` | tracked, clean | KEEP (or fold into SKIPPED_HUMAN_DECISIONS) | | PROMPT §3.1 |
| `artifacts/` (208 files, 43 MB: `local-operational-proof/`, `shopify-ux/`) | tracked | KEEP — consumed by operational-proof/evidence validators | | CODE §9; shell probe |
| `chaos/` (3 files) | tracked | **DELETE [DAP]** — rejected-architecture machinery (Constitution forbids chaos certification) but **existence is validator-mandated**: `survivability-governance-validator.mjs:22-23` requires `chaos/run-chaos-evidence.mjs` + `chaos/scenarios/failure-matrix.json`. Condition: execute the SURVIVABILITY-UNHOOK (§I below) first | [DAP] | GOV §5.5; ARCH §7.1; validator read |
| `load/` (9 files) | tracked | **DELETE [DAP]** — same lock: `survivability-governance-validator.mjs:20-21` requires `load/run-load-evidence.mjs` + `load/scenarios/internet-scale-load.json`. Same condition | [DAP] | same |
| `build/` (root, 161 MB Flutter test cache) | untracked, gitignored | **DELETE** (machine-local) | | CODE §10; MOBILE §9 |
| `.dart_tool/`, `.tmp/` (empty), `test-results/`, `.pnpm-store/`, `.turbo/` (6,964 files) | ignored/empty | **DELETE** (local caches/residue) | | shell probe |
| `.codex/` | **empty dir**, not ignored | **DELETE** | | PROMPT §3.1; shell probe |
| `.claude/` (`settings.local.json`) | untracked | KEEP-LOCAL (tool config; gitignore it — reveals worktree lane paths) | | PROMPT §3.1 |
| `.changeset/` (config.json, README, 1 stale changeset `letbuyy-ui-stable-foundation.md`) | tracked | KEEP config; stale changeset entry = NEEDS-EVIDENCE (no release workflow consumes changesets that this audit found; confirm before pruning) | | shell probe |
| `.github/` (11 workflows + configs) | 9 M + 1 untracked (`mobile-merchant-release.yml`) | **CANONICAL** (CI law) — note GitHub executes HEAD definitions until pushed | [COMMIT!] | CODE §8; GOV §5.7 |
| `node_modules/` | ignored | KEEP-LOCAL | | |

## C. apps/*

| Artifact | Class | Tags | Evidence |
|---|---|---|---|
| `apps/storefront-runtime` | **CANONICAL** runtime (124 TS; host middleware; both render engines) | | CODE §3 |
| — `src/app/demo/urban-kicks/` | **DELETE** (previous-product demo residue, live-routed) | | CODE §5/§9; shell probe (dir exists) |
| — `next.config.ts:41-45` `firebasestorage.googleapis.com` remotePattern | **DELETE** (legacy host whitelist; firebase tree is archive-only) | | CODE §9; shell probe (`next.config.ts:43`) |
| — React renderer + 20 frozen sections + header/footer | **CANONICAL today**; **[DAP]** for eventual deletion. Condition (verbatim from theme axis): Liquid header/footer sections + section-group routing; commerce-drop-driven product/collection sections; product/collection/cart/page templates in the first-party bundle; real cart/customer drops; layoutHtml/head adoption decision; canary write path + merchant install/edit surface; per-section Liquid editor preview; per-section settings parity; asset pipeline; **then commit+deploy D7 itself**. Deleting today blanks every storefront | [DAP] | THEME §10 (NOT-READY verdict), §9 gap list |
| — `sections/marquee.tsx` (dead: 0 importers) | **DELETE [DAP]** — frozen by `no-new-react-sections-validator.mjs:9-30` (exactly-20 list) and the 20-entry parity table; condition: amend the freeze list + `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT` | [DAP] | THEME §2.1, §4.1#11 |
| `apps/merchant-control-plane` | **CANONICAL** runtime (164 TS) | | CODE §3 |
| — portfolio/resume residue pages (`ats-score`, `projects`, `certifications`, `education`, `experience`, `skills`, `gallery`, `testimonials`) | **DELETE [DAP]** — previous-product residue cluster (§L); condition: SKIP-D11 live writer probe | [DAP] | CODE §5, §9 |
| — `leads`, `comments` pages | NEEDS-EVIDENCE — `leads` has a live public-insert policy and gateway `/form-submissions` exists; may be active commerce lead capture, not residue | | DB §5; CODE §5 |
| — duplicate backend surface `/api/stores/[store]/*` (~50 routes duplicating gateway domains) | NEEDS-EVIDENCE — "two writers per domain" consolidation decision required; not registry-deletable without per-page call-graph tracing | | CODE §4, §13.4 |
| `apps/identity-platform` | **CANONICAL** runtime. OIDC `/oauth2/*` 501 skeletons = KEEP (deliberate fail-closed seams, `implemented:false`) | | CODE §3; IDENT §7 |
| `apps/marketing-site` | KEEP (small, deployed) | | CODE §3 |
| `apps/platform-console` | **CANONICAL** (PHASE-C ops-console survivor) | | CODE §3; ARCH §9 |
| `apps/app-marketplace` (frozen, 91 TS, full source) | KEEP-FROZEN — **not deletion-ready**: gateway still serves `/app-store` + `/app`, ~50 `app_*` DB tables live, staging still deploys it. Rows to cut now: staging matrix entry (`staging-deploy.yml:192`) **DELETE**; `config/vercel/projects.json:79-93` entry **DELETE** | | CODE §1.3, §3; DB §4 |
| `apps/theme-marketplace` (frozen, 65 TS) | KEEP-FROZEN — gateway `/themes/:slug/reviews|purchases|downloads` + baseline purchase tables live; marketplace Zod types still inside active `packages/theme-engine`. Cut now: staging entry (`staging-deploy.yml:189`) **DELETE**; projects.json:109-123 entry **DELETE** | | THEME §8; CODE §3 |
| `apps/developer-portal` (frozen, 20 TS, UI-only, **no vercel.json**, no API) | KEEP-FROZEN → **ARCHIVE [DAP]** — weakest frozen app; condition: human ARB consolidation decision (CLAUDE.md: "frozen or pending consolidation"). Cut now: projects.json:94-108 entry **DELETE** | [DAP] | CODE §3; PROMPT §4.4 |
| `apps/platform-operations-portal` (frozen, 32 TS, UI-only) | KEEP-FROZEN → **ARCHIVE [DAP]** — PHASE-C resolved the ops-console survivor to `platform-console`; condition: port/verify any unique employee-execution modules into `platform-console`, then archive. Cut now: staging entry (`staging-deploy.yml:198`) **DELETE**; projects.json:124-137 entry **DELETE** | [DAP] | ARCH §9 (PHASE-C row); CODE §3 |
| `apps/mobile/merchant-app` | **CANONICAL** (the only real Flutter app). See §M for dead-screen cluster | [COMMIT!] (D8/D9 uncommitted) | MOBILE §1, §10 |
| `apps/mobile/shopper-app`, `apps/mobile/operator-app` | KEEP (reserved manifest-only; **existence + manifest-only-ness validator-mandated** — `whole-repo-end-state-validator.mjs:59-72`). Delete-never while end-state law stands | | MOBILE §5; validator read |

## D. services/*

| Artifact | Class | Tags | Evidence |
|---|---|---|---|
| `services/api-gateway` | **CANONICAL** (the monolith: 261 TS / 84,549 lines / ~75 mounts) | | CODE §3–4 |
| — `src/routes/portfolio.ts` + `src/routes/resume.ts` + mounts `index.ts:738-739` | **DELETE [DAP]** — residue cluster §L; condition: SKIP-D11 live writer probe | [DAP] | CODE §9; DB §6; shell probe |
| — `graphql/` (3,941 lines) + `extensions/` (623 lines) | KEEP (feature-flagged dark in prod — `wrangler.toml:243-245`; product surfaces, not residue) | | CODE §1.8, §9 |
| — `src/tenant/tenant-tables.registry.ts` (generated, 261 entries) | **CANONICAL** (machine truth for tenant guard; consistent with migration 164) | | DB §10 |
| `services/mobile-bff` | **CANONICAL** (449-line proxy). Allowlist entries `'/v1/portfolio'`, `'/v1/resume'` (`src/index.ts:44-45`) **DELETE** with the gateway routers | [DAP with routers] | CODE §4; MOBILE §5; shell probe |
| `services/webhook-service`, `services/queue-workers` | **CANONICAL** | | CODE §4; MONEY §8 |
| 6 reserved services (`checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`) | KEEP — manifest-only existence is **validator-mandated** (`whole-repo-end-state-validator.mjs:59-85`); topology pins them non-deployable. Their `runtime.manifest.json` prose is sed-garbled ("delegates to service-owned read planners and service-owned read planners") → **[REWRITE]** content; also their `governanceDocs` arrays cite contradicting theater docs (multi-region/failover/chaos) → retarget those references | [REWRITE] | CODE §1.4, §9; ARCH §6.5 |

## E. packages/*

| Artifact | Class | Tags | Evidence |
|---|---|---|---|
| 21 surviving npm lib packages (`shared-types`, `auth-core`, `identity-core`, `token-core`, `session-core`, `permission-core`, `organization-core`, `audit-core`, `tenant-core`, `commerce-core`, `checkout-core`, `billing-core`, `cms-core`, `event-core`, `notification-core`, `payments`, `infrastructure`, `theme-engine`, + `typescript/{api-client,api-types,ui}`) | KEEP — **every one has ≥1 real inbound import** (census: ui 331 … api-types 1) | | CODE §6 |
| — `api-types` + the 5 single-consumer identity satellites (`token/session/permission/organization/audit-core`) | KEEP; flag as consolidation candidates (single consumer = api-gateway; near-minimum usage). NEEDS-EVIDENCE for any merge | | CODE §6 |
| — `theme-engine` marketplace type residue (ThemePurchase/ThemeReview/wordpress|html|react platforms) | KEEP (shared contract; gateway routes still serve marketplace endpoints) — prune only with the theme-marketplace decision | | THEME §8 |
| `packages/dart/{core,api_client,models,ui_kit}` | KEEP (Melos workspace; merchant-app depends) | | MOBILE §5–6 |
| — `ui_kit` internal duplicates: `empty_state.dart` vs `empty_state_widget.dart`; `error_widget.dart` vs `error_view.dart` | **DELETE** one of each pair (kit-internal duplication) | | MOBILE §3 (Duplicates) |
| — `ui_kit` 18-of-19 exported widgets unused by the app | NEEDS-EVIDENCE (library exports; unused ≠ dead) — tokens are the real product | | MOBILE §1.7 |
| **8 worktree-deleted package roots** (`app-engine` 5f, `application-services` 15f, `distributed-runtime` 77f, `extension-host` 4f, `orchestration` 16f, `projection-runtime` 18f, `runtime-composition` 15f, `search-core` 4f = 154 files, present at HEAD) | **DELETE** — already executed in WT; **zero residual `@letbuyy/<pkg>` imports** anywhere; deletion is itself asserted by `whole-repo-end-state-validator.mjs:52-54` | **[DBU]** — finalize by commit; until then `git checkout .` resurrects all eight | CODE §1.5, §6; ARCH §9 (D11 row) |
| `packages/dart/services` (old `letbuyy_services`, deleted in WT) | **DELETE** (zero remaining references — clean removal) | [DBU] | MOBILE §6 |
| `packages/typescript/ui/src/mobile-tokens.ts` (deleted in WT, D9) | **DELETE** (replaced by DTCG bridge; generator `--check` passes) | [DBU] | MOBILE §6; CODE §6 |

## F. docs/ (87 dirs + ~28 loose files; grouped)

| Group | Contents | Class | Tags | Evidence |
|---|---|---|---|---|
| `docs/archive/**` (26 subtrees, **865 files**) | All prior archives + the four new 2026-06-10 archives (`root-governance-2026-06-10/` 227 files incl. 12 audit dirs; `governance-theater-2026-06-10/` 38; `validator-theater-tests-2026-06-10/`; `infra-deployment-legacy-2026-06-10/`; `firebase-legacy/`; `foundation-stepup-archive-2026-06-10/`; `build-missions/`; `codex-prompts/`) | **ARCHIVE (correct location; delete-never — it IS the history)** — the 2026-06-10 sets are **entirely untracked**: the only copies of FORENSIC_MASTER, GOVERNANCE_HARDENING, FOUNDATION_AUTOPSY, IDENTITY_PLATFORM_AUDIT, FOUNDATION_FORENSICS, PHASE2_ARB_CHALLENGE, LETBUYY_FOUNDATION_AUTHORITY exist nowhere else | [COMMIT!] | GOV §4.4, §8; ARCH §3.2; PROMPT §3.5 |
| **Generated intelligence tree: 67 tracked files** — `docs/README.md`, ~65 `docs/<topic>/README.md` (analytics, api, auth, backend, billing, caching, checkout, ci-cd, cloudflare, compliance, config, conflicts, customers, database, deployment, devops, domains, edge, emails, environments, events, frontend, future-roadmap, integrations, inventory, marketing, media, middleware, mobile, monitoring, notifications, observability, operations, orders, payments, performance, permissions, pricing, products, routing, runtime, runtime-manifest, scalability, schemas, search, security, shipping, state-management, storefront, stores, subdomains, subscriptions, technical-debt, tenant-isolation, testing, theme-runtime, themes, tooling, ui, uploads, ux, vercel, webhooks, workers…) + `docs/architecture/master-system-intelligence.md` + `docs/architecture/README.md` | All stamped `GENERATED BY scripts/generate-repository-intelligence.mjs ON 2026-06-08`; describe `letbuyy.store`, "19 migrations" (real 166), deleted packages, archived governance; the generator is hard-retired (exit 1) so they are **permanently frozen falsehoods, unregenerable** | **DELETE** (tracked — git history preserves; delete the generated files, not the dirs where real content coexists) | | ARCH §1.4, §4.3, §6.3; shell census (67 files, `grep -rl "GENERATED BY"`) |
| `docs/agents/` (AGENTS.md + 21 rule files + 19 `subagents/*.md`) | Self-declared "Mandatory Reading Order" frozen at 2026-05-24; dead topology (`backend/workers/api`, `apps/web/consumer/admin`); instructs regenerating via the retired generator; filename makes it a "local AGENTS.md" in the precedence chain | **ARCHIVE** (entire dir) | | PROMPT §3.4, §4.7 |
| `docs/Codex_waves/` (26 tracked files) | Largest at-large prompt cluster: 12 DANGEROUS (declare deleted packages "✅ Stable", create `extension-host`/`developer-portal`, `.store` CI rewiring) incl. the `CLAUDE_OPUS_MASTER_PROMPT.md` **prompt factory**; 6 paste-ready terminal relaunchers | **ARCHIVE** (dated folder under docs/archive/) | | PROMPT §3.3, §4.1–4.5 |
| docs-root prompt/plan family: `CODEX_LETBUYY_FOUNDATION_MISSION.md`, `LETBUYY_MASTER_EXECUTION_PLAN.md`, `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md`, `P0…P4_*_MASTER.md` | Dangerous/obsolete pre-rewrite execution layer (frozen apps as "active runtimes"; superseded plan lineage) | **ARCHIVE** | | PROMPT §3.4, §4.8 |
| Frozen-app audit/mission families: `docs/apps-marketplace-audit/` (3 missions, 2 diverge from archived same-name copies), `docs/themes-marketplace-audit/` (7 missions + 10 ledgers/status incl. GA-closure "Live DB apply / deploy"), `docs/developer-platform-audit/` (1 paste-ready prompt owning two frozen apps), `docs/internal-operating-system-audit/` (mission set that builds the PHASE-C-losing console; documents root-validator evasion), `docs/auth/2026-06-08-identity-platform-transformation/` (3, duplicated in archive) | **ARCHIVE** (reconcile the 2 diverging marketplace copies during the move) | | PROMPT §3.4, §4.4, §4.9 |
| Superseded audit generation at docs root: `LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`, `LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md`, `LETBUYY_DEVELOPER_PLATFORM_MASTER_AUDIT.md`, `LETBUYY_INTERNAL_OPERATING_SYSTEM(.md|_MASTER_REPORT.md)`, `LETBUYY_MERCHANT_MOBILE_MASTER_REPORT.md`, `LETBUYY_CTO_WAR_ROOM_REPORT.md`, `LETBUYY_DEEP_AUDIT_REPORT.md`, `TOP_200_ISSUES.md`, `REMEDIATION_LOG.md`, design-system set (`DESIGN_SYSTEM_MATURITY_SCORECARD`, `DESIGN_TOKEN_AUDIT`, `LETBUYY_DESIGN_SYSTEM_DISCOVERY`, `LETBUYY_PLATFORM_DESIGN_SYSTEM_MASTER_REPORT`, `LETBUYY_UI_SYSTEM_MASTER_AUDIT`, `LETBUYY_UI_FOUNDATION_IMPLEMENTATION_PLAN`), ops logs (`deployment-log.md`, `migration-audit.md`, `performance-audit.md`, `phase-2/3-verification.md`, `pre-deploy-checklist.md`, `production-readiness-report.md`), `theme-urban-kicks.md`, `urban-kicks-sections-audit.md` | Superseded by FORENSIC_MASTER (memory-confirmed "supersedes the June-09 sets") and the rewrite | **ARCHIVE** | | ARCH §5 (generation chain); PROMPT §6 |
| `docs/LETBUYY.md` | "Single source of truth. Consolidated… 2026-03-01" — a third competing self-definition | **ARCHIVE** | | shell probe (header); DOC-R4 competing-fact risk per PROMPT §3.4 |
| `docs/LOCAL_DEV.md` | Live local-dev guide (matches `scripts/dev/` reality) | KEEP | | shell probe; CODE §12 |
| `docs/audit/` (19 docs, committed 2026-06-05) | Replatform blueprints; `13-final-architecture-blueprint.md` activates the entire reserved fleet **+ WASM extension runtime** (Never-Build list) | **ARCHIVE** (dangerous) | | ARCH §1.5, §4.3, §7.3 |
| `docs/commerce-os-audit/` (10) | "Billion-dollar commerce OS" roadmap incl. multi-region read scale — envelope violation by title | **ARCHIVE** (dangerous) | | ARCH §7.4 |
| `docs/audits/` (June-01 audit + apps-platform) | Superseded audit gen-0 | **ARCHIVE** | | shell listing; ARCH §5 |
| `docs/analysis/` (Part1–4) | Pre-V1 full-architecture review | **ARCHIVE** | | ARCH §4.3 |
| `docs/governance/` — 15 modified/retargeted survivors (contract-, dependency-, domain-, event-driven-, event-store-, mobile-, outbox-, package-, repository-topology, runtime-, runtime-manifest-, service-, skipped-human-decisions, storefront-execution) | KEEP — but `repository-topology.md` still shows a 12-app "Canonical Topology" without frozen markings → [REWRITE] | [REWRITE] | GOV §4.2, §5.4 |
| `docs/governance/` — ~61 benign operational survivors (naming, git, import, migration, environment, observability, tooling…) | KEEP (content-level audit UNVERIFIED — GOV §9.3) | | GOV §4.2 |
| `docs/governance/` — contradicting survivors (~12): `multi-region-runtime-`, `failover-`, `failover-certification-`, `chaos-`, `chaos-engineering-`, `chaos-certification-`, `runtime-composition-`, `distributed-execution-survivability-`, `replay-safety-`, `shadow-traffic-`, `global-operations-`, `sre-certification-governance.md` | **ARCHIVE [DAP]** → `governance-theater-2026-06-10/`; condition: SURVIVABILITY-UNHOOK (§I) — note `runtime-composition-governance.md` routes composition through two **deleted, V1-rejected** packages and can move immediately after a reserved-manifest `governanceDocs` retarget | [DAP] | GOV §4.2, §5.4, §6#2-4; ARCH §4.3 |
| `docs/governance/` — 4 validator-required theater docs: `operational-resilience-`, `deployment-proof-`, `deterministic-runtime-`, `infra-recovery-governance.md` | **ARCHIVE [DAP]** — existence asserted by `survivability-governance-validator.mjs:24-27` | [DAP] | validator read |
| `docs/runbooks/` (20) | KEEP most (incident-sev1, deployment-rollback, secret-rotation, queue-dlq-redrive, staging-*, foundation-wave*, custom-domain-cname, app-marketplace-* while gateway app-store routes live). **ARCHIVE [DAP]**: `regional-failover.md`, `survivability-suite.md`, `infra-recovery.md` (last two validator-required, `survivability-governance-validator.mjs:28-29`), `chaos-drill.md`, `event-replay.md`, `live-certification-execute.md` | [DAP] | ARCH §4.3; validator read; shell listing |
| `docs/design-system/` (incl. `empty-states/` 18-motif SVG library), `docs/seo/` (entity+SEO playbook), `docs/research/` (shopify product intelligence), `docs/env-setup/` | KEEP (live reference material) | | shell listing; memory (canonical-domain, empty-states); PROMPT §3.4 (research benign) |
| `docs/conflicts/`, `docs/future-roadmap/` | Contain only generated READMEs enumerating dead `FORENSIC_REPORT/*` rows → covered by the generated-tree **DELETE**; remove emptied dirs | | ARCH §4.3 |
| `docs/mobile-migration-blueprint/` | **Empty directory** (missions deleted 2026-06-06 in `47f29bc6`, no archive copy — git-history-only) | **DELETE** (empty husk) | | PROMPT §3.6; shell probe (`ls` empty) |
| `docs/auth/2026-06-09-*` untracked report sets | KEEP (report-class evidence) | [COMMIT!] | PROMPT §6.6 |
| `_GOVERNANCE_SPINE.md` | **MISSING** — cited 26× by 5 of the 7 canonical docs; does not exist anywhere | Not a deletion row: **author it or strip the citations** (canon integrity gap) | | ARCH §6.1 |

## G. Validators & scripts

| Artifact | Class | Tags | Evidence |
|---|---|---|---|
| `scripts/validate-governance.mjs` (gate orchestrator, 90 validators, PASS) | **CANONICAL** | [COMMIT!] (modified) | GOV §7.2 |
| `scripts/validate-architecture.mjs` | KEEP (wired `validate:architecture`) | | package.json |
| 90 gate-lane validators + 3 common helpers (`governance-common.mjs`, `phase-b-common.mjs`, …) | **CANONICAL/KEEP** — incl. the 22 untracked Phase B/C/D validators (canonical-ledger-only, no-self-custody-rail, commission-bps-zero, identity-sole-issuer, no-blanket-service-role, no-public-using-true, rls-force-coverage, one-system-per-domain, no-rejected-package-imports, no-new-react-sections, whole-repo-end-state, …) | [COMMIT!] — all money/identity gates are untracked; a clean clone has **no money gates at all** | GOV §7.1; MONEY §10; DB §9 |
| **11 orphan validators** — `contracted-domain-event-ingress`, `custom-domain-abuse-screening`, `custom-domain-reconciler`, `gateway-events-client`, `mobile-domain-parity`, `no-orphan-webhook-delivery-queue`, `observability-producer`, `registrar-provider`, `replayable-secret-persistence`, `shopper-identity-seam`, `vercel-domain-automation` (`-validator.mjs`) | **DELETE** — re-verified this audit: **zero external references** from package.json, both orchestrators, .github, tests, scripts/*, infrastructure | | GOV §7.1; CODE §9; shell probe (per-file grep, external-refs=0 for all 11) |
| Survivability/certification lane validators: `survivability-governance-validator.mjs` + the 10 wired under `validate:production-certification` (`provider-execution`, `distributed-contention`, `replay-scale`, `crash-recovery`, `telemetry-ingestion`, `benchmark-certification`, `provider-failover-certification`, `partition-recovery`, `immutable-evidence`, `production-recovery-drill`) + `operational-proof-validator.mjs` | **DELETE [DAP]** — locked by `whole-repo-end-state-validator.mjs:96-109,179-193` (mandates the `validate:survivability`/`validate:production-certification` scripts and their presence in 3 workflows). Condition: SURVIVABILITY-UNHOOK (§I) ratified by ARB — D12/D13 deliberately restored these against Constitution `:98` | [DAP] | GOV §5.5; ARCH §1.2, §7.1; validator reads |
| `scripts/generate-repository-intelligence.mjs` (retired, exits 1) | KEEP — **tombstone is law**: `repository-intelligence-validator.mjs` asserts the generator is retired; deleting the file breaks the assertion | | GOV §7.3 |
| `scripts/generators/` (tenant registry, mobile tokens, design tokens) | KEEP (wired; tokens `--check` passes) | | MOBILE §6; DB §10 |
| `scripts/dev/`, `scripts/git-hooks/`, `scripts/github/`, `scripts/governance/`, `scripts/migration/`, `scripts/staging/`, `scripts/supabase/`, `scripts/utilities/`, `scripts/cloudflare/` | KEEP (wired through package.json/CI; `dev-up.sh`/`dev-backend.sh`/`identity-security-gate.mjs` untracked → [COMMIT!]) | [COMMIT!] | CODE §11–12 |
| 77 validators deleted in WT (HEAD-only) | **DELETE** (done; preserved in git history only — acceptable for code) | [DBU] | GOV §7.1, §8 |
| 38 scan-generated nested `AGENTS.md` (apps/packages/services) | KEEP slots, **[REWRITE]** — embed stale 2026-06-08 scan counts + "Regenerate…" instruction pointing at the exit-1 generator; they are ranked authorities via CLAUDE.md/AUTH-R1; `services/api-gateway/AGENTS.md:10` still authorizes deleted packages (one-line fix); `apps/mobile/merchant-app/AGENTS.md:42` cites the deleted parity file | [REWRITE] | GOV §4.3, §6#5-7; MOBILE §9 |

## H. tests/*

| Artifact | Class | Tags | Evidence |
|---|---|---|---|
| `tests/e2e/` (10 specs) | KEEP (playwright.config testDir; staging-E2E + prod smoke CI) | | CODE §9–10 |
| `tests/contracts/` (67), `tests/executable/` (20, real dockerized-Postgres money/session tests), `tests/governance/` (10), `tests/auth/` (7), `tests/migrations/` (7), `tests/identity-foundation/` (6), `tests/theme-engine/` (7), `tests/feature-flags/`, `tests/security/`, `tests/helpers/` | KEEP — wired via `pnpm test` glob `tests/*/*.test.mjs`, `test:contracts`, wave scripts | | package.json (script dump); MONEY §10 |
| Theater leftovers after the 69-file purge: `tests/chaos/` (1), `tests/survivability/` (4), `tests/replay/` (1), `tests/queues/` (1), `tests/operations/` (10), `tests/production-certification/` (1), remnants of `tests/cloudflare/` (2) | **DELETE [DAP]** with the survivability cluster (note `validate:chaos` runs `tests/operations/* + tests/chaos/*`; `validate:queues` is mandated in 3 workflows by the end-state validator) | [DAP] | CODE §9; shell census; `whole-repo-end-state-validator.mjs:185-192` |
| `tests/projections/` | **Empty orphan dir** | **DELETE** | | CODE §9; shell census (files=0) |
| `tests/federation/` (26), `tests/performance/` (10), `tests/api-graphql/` (4), `tests/app-platform/` (3), 1-file dirs (`billing`, `ci`, `dependency`, `gst`, `localization`, `logistics`, `typescript`) | KEEP (run via the `pnpm test` glob; behavioral value varies) — NEEDS-EVIDENCE for pruning individual source-regex-only files (THEME found 7 of 8 theme `.mjs` are text assertions) | | shell census; THEME §11 |
| 69 worktree-deleted test files (operations 34, contracts 7, replay 7, survivability 7, cloudflare 6, queues 5, projections 3) | **DELETE** (done; copies archived at `docs/archive/validator-theater-tests-2026-06-10/`) | [DBU] | CODE §9 |

## I. config/*  — including the SURVIVABILITY-UNHOOK definition

**SURVIVABILITY-UNHOOK (the single named condition reused across this registry):**
1. ARB decision recorded (new SKIP/ledger row) that the D12/D13 survivability-restore contradicts Constitution `:98/:112` and is repealed;
2. amend `scripts/validators/whole-repo-end-state-validator.mjs` — drop the `validate:survivability`/`validate:production-certification` script mandates (`:99-100`), the `globalRegions` india/apac/eu/us assertion (`:172-177`), and the 4-fragment workflow mandate (`:179-193`);
3. delete/retire `survivability-governance-validator.mjs` and remove `validate:survivability` (+ theater aliases) from `package.json` and from `architecture-governance.yml` / `production-rollout.yml` / `live-production-certification.yml`;
4. remove the `regions.globalRegions` block from `config/runtime/production-topology.json:34-39`;
5. re-run the gate (must stay green).
Only then do the chaos/load/multi-region/certification artifacts below become deletable/archivable.

| Artifact | Class | Tags | Evidence |
|---|---|---|---|
| `config/runtime/production-topology.json` + `deployment-topology.json` + schemas | **CANONICAL** machine truth (11 active / 6 reserved / 4 frozen; matches disk) — **except** the `regions.globalRegions` block = **DELETE [DAP: SURVIVABILITY-UNHOOK]** (the one fabricated multi-region claim inside canon; self-labelled `governance-contract-not-live-evidence`) | [DAP block] | ARCH §8; CODE §3 |
| `config/runtime/multi-region-runtime.json` (+schema) — 4 regions + failover pairs, **23 references** | **DELETE [DAP: SURVIVABILITY-UNHOOK]** — the most-wired rejected-architecture artifact in the repo; declares apac/eu/us queue namespaces that exist in no terraform/wrangler | [DAP] | ARCH §7.1, §8.5; shell ref-census (23) |
| `config/runtime/survivability-execution.json`, `observability-platform.json` (+schemas) | **DELETE [DAP: SURVIVABILITY-UNHOOK]** (3 refs each, all in the locked validator/suite) — note `observability-platform.json` also pins real prometheus rules/dashboards; split the useful observability assertions into a non-theater validator before deletion | [DAP] | validator read (`survivability-governance-validator.mjs:36-91`) |
| Distributed-era contracts with exactly 0–1 consumers: `replay-safety-contract.json` (**0 refs**), `identity-residency.schema.json` (**0 refs**) → **DELETE now**; `convergence-invariants`, `distributed-consistency-contract`, `distributed-execution-contract`, `durable-execution-contract`, `failure-domain-manifest`, `runtime-causality-graph`, `runtime-memory-model`, `runtime-survivability-intelligence`, `runtime-saturation-contract`, `runtime-orchestration-manifest`, `replay-branch-registry`, `database-recovery-policy` (1 ref each) + `projection-recovery-manifest`, `replay-evolution-manifest`, `recovery-slo-contract` (2 refs) → **DELETE [DAP]**: retire each one's single consuming validator/script (mostly the certification lane) first | [DAP] | ARCH §4.3, §6.6; shell ref-census per file |
| `config/runtime/` healthy contracts: `cloudflare-topology` (9 refs), `cloudflare-binding-ownership`, `environment-lifecycle` (5), `environment-lineage`, `deployment-lineage-manifest` (6), `manifest-lineage` (3), `queue-lifecycle-manifest` (3), `rollout-lifecycle` (3), `runtime-topology` (4), `production-safety-preflight`, `live-production-certification` (9), `runtime-manifest.schema.json`, `identity/` | KEEP (consumed by active validators/CI) | | shell ref-census |
| `config/governance/` (anti-fabrication allowlist) | KEEP (gate-consumed) | | GOV §4.1 |
| `config/vercel/projects.json` | KEEP file; the **4 frozen-app project entries (lines 79-137)** = **DELETE** (drift vs frozen/not-deployed topology) | | CODE §3, §8 |
| `config/supabase/{staging,production}.json` | KEEP (placeholder-guarded runner inputs) | | DB §8 |
| `config/env`, `config/eslint`, `config/security`, `config/tailwind`, `config/cloudflare` | KEEP | | CODE §8 |

## J. database/ (+ DB-level deletion rows — all live-DB-gated)

| Artifact | Class | Tags | Evidence |
|---|---|---|---|
| `database/supabase/migrations/` (000 + 91 additive) | **CANONICAL** — append-only chain; **162–166 + 5 rollbacks are UNTRACKED** (the commission-zero, RLS-leak-close, app_tenant GUC, canonical-money, checkout-authority fixes). A clean-HEAD deploy silently omits them; `migration-safety-validator` is structurally blind to them; `rls-force-coverage-validator` would *error* in a clean checkout | **[COMMIT! — highest-priority preserve]** | DB §1, §3, §8–9 |
| `database/supabase/rollback/` (139–166 pairs) | KEEP (073–138, 140, 157 have none — by forward-fix policy, not omission) | | DB §8 |
| `database/cloudflare/d1/` (1 migration; ops audit trail, no tenant/money data) | KEEP | | DB §6 |
| `docs/archive/migrations-history/` (72 pre-baseline .sql) | ARCHIVE-OK | | DB §6 |
| **DB row: dead product-era tables** `portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements` (0–3 code refs) | **DROP [DAP]** — condition (verbatim seam `SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE`): live `pg_stat_user_tables` writer/reader probe proves zero traffic, **and** a first-ever DROP-TABLE migration policy is ratified (the chain currently has zero `DROP TABLE` by construction, so dead tables accumulate forever) | [DAP] | DB §1, §6, §7.6 |
| **DB row:** `gift_card_accounts` / `gift_card_ledger_entries` (mutable `balance numeric`, no RPC writer found) | NEEDS-EVIDENCE (suspect, but gift cards may be a dormant product surface; mobile `gift_cards_screen` exists albeit dead) | | DB §6; MOBILE §3 |
| **DB row: duplicate index** — `107`'s `idx_payment_transactions_provider_payment_global` vs `142`'s `payment_transactions_provider_payment_id_v1_uniq` (functionally identical unique partial indexes) | **DROP one [DAP]** — condition (seam `SKIP-D11-PROVIDER-PAYMENT-ID-INDEX-LIVE-DB`): live `pg_indexes` + query-plan proof in a maintenance window | [DAP] | DB §6 |
| **DB row:** `sites.site_type` CHECK still enumerating `portfolio,resume,landing,blog` (000:12013) | **SHRINK [DAP]** with the §L residue cluster (same writer-probe condition + product decision on non-store site types) | [DAP] | DB §6 |
| **DB row:** the two `129_*` collision files | KEEP both, **never rename** (lexicographic apply order is deterministic; renaming breaks replay) — flag only | | DB §3, §8 |
| **DB row:** 25 residual PUBLIC `USING(true)` policies (incl. `service_role_*`-named-but-PUBLIC on `gift_cards`, `pages`, `collections`, `onboarding_attempts`, `ai_usage`, `auth_password_set_intents`) | Not deletions — **fix-forward migrations needed**; outside the 12-table validator allowlist so nothing blocks them today | | DB §1, §5 |

## K. infrastructure/*

| Artifact | Class | Tags | Evidence |
|---|---|---|---|
| `infrastructure/cloudflare/` (queues.tf etc.), `infrastructure/dns/` | KEEP (live capacity contracts; D6 checkout origin) | | CODE §8 |
| `infrastructure/deployment/helm/` + `kubernetes/` (6 files, deleted in WT → `docs/archive/infra-deployment-legacy-2026-06-10/`) | **DELETE** (done — k8s story removed) | [DBU] | CODE §8–9 |
| `infrastructure/deployment/` survivors (`release-promotion.yaml`, `migration-orchestration.yaml`, AGENTS.md) | KEEP (`migration-orchestration.yaml` is the stated forward-fix-preferred policy source) | | DB §8; shell listing |
| `infrastructure/monitoring/`, `infrastructure/observability/` (prometheus-rules.yaml, dashboards) | KEEP — genuinely useful, but currently also load-bearing for the theater validator (`survivability-governance-validator.mjs:75-91`); keep regardless of unhook | | validator read |
| `infrastructure/scripts/operations/` certification/survivability suite (`run-survivability-suite.mjs`, `run-live-drills.mjs`, `generate-certification-report.mjs`, `phase4-live-certify.mjs`, `phase4-ultimate-validate.mjs`, `run-operational-certification.mjs`, `run-provider-production-certification.mjs`, `verify-live-operations.mjs`) + `infrastructure/scripts/load/` + `infrastructure/scripts/chaos/` | **DELETE [DAP: SURVIVABILITY-UNHOOK]** — `generate-certification-report.mjs` is additionally pinned by the end-state validator's required `certify:production:plan-report` script (`whole-repo-end-state-validator.mjs:101`) | [DAP] | validator reads; shell listing |
| `infrastructure/scripts/{cloudflare,database,deploy,security,observability}/` | KEEP (bootstrap/deploy/rotation tooling wired in package.json + workflows) | | CODE §8 |
| `infrastructure/ci-cd/`, `infrastructure/security/` | KEEP | | shell listing |

## L. Previous-product residue cluster (portfolio/resume/ATS — one coordinated [DAP] batch)

Single condition for the batch: **SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE** (live writer/reader probe) + one ARB product decision that non-store site types are dead. Then delete in one change-set:

| Item | Class | Evidence |
|---|---|---|
| Gateway `src/routes/portfolio.ts`, `src/routes/resume.ts` + mounts `index.ts:738-739` | DELETE [DAP] | CODE §9; shell probe |
| mobile-bff allowlist entries `'/v1/portfolio'`, `'/v1/resume'` (`src/index.ts:44-45`) | DELETE [DAP] | shell probe; MOBILE §5 |
| merchant-control-plane pages: `ats-score`, `projects`, `certifications`, `education`, `experience`, `skills`, `gallery`, `testimonials` | DELETE [DAP] | CODE §5 |
| `apps/storefront-runtime/src/app/demo/urban-kicks/` | **DELETE now** (demo page; no probe needed) | CODE §5; shell probe |
| `firebasestorage.googleapis.com` remotePattern (`storefront next.config.ts:41-45`) | **DELETE now** | CODE §9; shell probe |
| DB tables `portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements` + `sites.site_type` enum members | DROP/SHRINK [DAP] (see §J) | DB §6 |
| React sections `portfolio-grid`, `skills-section`, `experience-timeline` + site-type gating in renderer | DELETE [DAP] — **double-locked**: same product decision **and** the React-section freeze law (exactly-20 list + parity table) must be amended together | THEME §2.1, §4.1; MOBILE n/a |
| `cms-core` portfolio re-exports (`gallery_items` 1 ref, `resume_versions` refs) | DELETE [DAP] with the batch | DB §6 |
| `leads`/`comments` pages + `leads` table | NEEDS-EVIDENCE (live public-insert policy; possibly active lead capture — exclude from the batch until probed separately) | DB §5 |

## M. Mobile dead-code cluster (apps/mobile/merchant-app — 34 dead screens of 64)

| Sub-group | Class | Tags | Evidence |
|---|---|---|---|
| **True dead weight — DELETE now** (with test edits): `platform/platform_blocked_screen.dart` + `services/platform_blocked_service.dart` (features = `[]` const — nothing can ever route here), `premium/upgrade_screen.dart` (duplicates pricing_screen), `splash/splash_screen.dart` (AuthWrapper renders its own loader; one-way street), `widgets/home/activity_timeline.dart` + `widgets/home/quick_actions_grid.dart` (same-name duplicates of the used `widgets/dashboard/*`), `widgets/shared/empty_state.dart` (0 importers), `app/deep_link_router.dart` + the `go_router ^17.0.0` dependency (GoRouter never mounted; no intent filters; test-only refs at `mobile_services_test.dart:3791-3797`) | **DELETE** | tests referencing them must be updated in the same change | MOBILE §1.10, §3, §4 |
| **Theme-editor pair** — `customize/theme_screen.dart` (631L) + `editor/section_editor_screen.dart` (1,200L) + `theme_versions_screen` + all 12 `widgets/editor/*` (≈1,800+ lines total, zero construction sites; historically the app's strongest surface) | **KEEP-pending / DELETE [DAP]** — condition: explicit product decision **wire-or-delete** (re-point `StoreMainScreen.goToEditor()` which now lands on Settings, or remove); 42 source-string test assertions in `mobile_services_test.dart:947-1008` actively "protect" this dead code and must be rewritten either way | [DAP] | MOBILE §1.2, §3, §8 |
| **Capability screens with web parity but no entry point** (25 + 9 transitive: inventory+4 children, coupons+form, gift_cards, pages+editor, blog+editor, navigation, media_library, staff, billing, leads, email_campaigns, apps+app_bridge, ai, shipping, taxes, custom_data, kyc, two_factor, returns, collections) | **DELETE [DAP]** — condition: per-screen product decision wire-navigation-vs-delete (all are real, service-backed implementations; KYC/2FA/returns being invisible is a product gap, not dead code in the classic sense) | [DAP] | MOBILE §3, §4 |
| 36 `/features/*` routes with zero inbound navigation (incl. lying mappings `/features/order-detail`→OrdersScreen) | [REWRITE] with the same decision (route table currently exists to satisfy validators/tests, not users) | | MOBILE §4 |
| 190 hardcoded `Color(0x…)` literals (~63 inside dead editor widgets) | Content fix (token adoption), not deletion rows | | MOBILE §6 |

---

## Summary lists

### 1. CANONICAL registry (delete-never, the load-bearing spine) — 24 entries
1. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (+ the 6 sibling rewrite docs) [COMMIT!]
2. Root `AGENTS.md` (promoted AGENTS_V2) [COMMIT!]
3. Root `CLAUDE.md` [COMMIT!]
4. `EXECUTION_LEDGER.md` [COMMIT!]
5. `SKIPPED_HUMAN_DECISIONS.md` [COMMIT!]
6. `scripts/validate-governance.mjs` + the 90-validator gate lane (incl. 22 untracked Phase B/C/D validators) [COMMIT!]
7. `database/supabase/migrations/` 000–166 (162–166 untracked) + rollbacks [COMMIT!]
8. `services/api-gateway` · 9. `services/mobile-bff` · 10. `services/webhook-service` · 11. `services/queue-workers`
12. `apps/storefront-runtime` · 13. `apps/merchant-control-plane` · 14. `apps/identity-platform` · 15. `apps/platform-console` · 16. `apps/marketing-site` · 17. `apps/mobile/merchant-app`
18. `config/runtime/production-topology.json` + `deployment-topology.json` (minus the globalRegions block)
19. `services/api-gateway/src/tenant/tenant-tables.registry.ts` (+ generator)
20. `.github/workflows/` (11) [COMMIT!]
21. `package.json` + `pnpm-workspace.yaml` + `turbo.json` + lockfiles [COMMIT!]
22. Root `pubspec.yaml` (Melos workspace) + `packages/dart/*`
23. The 21 surviving npm lib packages
24. `config/governance/` + `config/supabase/` + `infrastructure/cloudflare|dns`

### 2. Delete-Never (beyond canon) — 8 entries
1. `docs/archive/**` (865 files — it IS the historical record; AUTH-R2) [COMMIT! — currently one `git clean` from destruction]
2. `STRATEGIC_CANONICALIZATION_2026_06_10/` (ratified ADR evidence; cited by AGENTS.md:37) [COMMIT!]
3. `REPOSITORY_TRUTH_AUDIT_2026_06_10/` (this audit's 10 reports) [COMMIT!]
4. Reserved runtime roots' `AGENTS.md` + `runtime.manifest.json` (8 roots — existence validator-mandated; content [REWRITE])
5. `scripts/generate-repository-intelligence.mjs` (retirement tombstone — validator-asserted)
6. `artifacts/` evidence trees (validator-consumed)
7. `tests/executable/` dockerized-Postgres money/session tests (the only DB-executing proof in the repo)
8. `docs/design-system/` + `docs/seo/` + `docs/LOCAL_DEV.md` (live reference)

### 3. Delete-After-Parity — 14 clusters (conditions stated)
1. **React theme renderer + 20 frozen sections** — condition: full THEME §10 parity list proven + D7 committed/deployed (today deletion blanks every storefront).
2. **Survivability/multi-region/chaos/load/certification cluster** (~60 artifacts: `chaos/`, `load/`, `multi-region-runtime.json`+schema, `survivability-execution.json`, `observability-platform.json` splits, `survivability-governance-validator`, the 10 `validate:production-certification` validators, `operational-proof-validator`, `infrastructure/scripts/{operations,load,chaos}` suite, `production-topology.globalRegions`, ~16 theater governance docs, 6 theater runbooks, tests/{chaos,survivability,replay,queues,operations,production-certification}) — condition: **SURVIVABILITY-UNHOOK** (§I, 5 steps, ARB-ratified).
3. **6 package.json theater aliases** — condition: retarget `architecture-governance.yml:75-81`.
4. **Previous-product residue batch** (§L: gateway routers, BFF allowlist lines, 8 merchant pages, DB tables, site_type enum, portfolio React sections, cms-core re-exports) — condition: SKIP-D11 live writer probe + ARB non-store-site-type decision (+ freeze-list amendment for the React sections).
5. **DB dead tables** (`portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements`) — condition: live `pg_stat_user_tables` probe + first DROP-TABLE migration policy.
6. **Duplicate provider_payment_id index** (107 vs 142) — condition: live `pg_indexes` + plan proof, maintenance window.
7. **Mobile theme-editor pair** (~1,830 lines + 12 editor widgets) — condition: wire-or-delete product decision + rewrite of the 42 protecting source-string tests.
8. **Mobile capability screens** (25 + 9 transitive) — condition: per-screen wire-vs-delete product decision.
9. **`sections/marquee.tsx`** — condition: amend the exactly-20 freeze validator + parity count.
10. **`memory/lessons.md` + `tasks/todo.md`** (archive, not delete) — condition: amend AGENTS.md AGENT-R16:380 + resolve LEG-078 contradiction.
11. **`apps/platform-operations-portal`** (archive) — condition: unique modules ported to `platform-console` (PHASE-C survivor already decided).
12. **`apps/developer-portal`** (archive) — condition: ARB consolidation decision.
13. **Distributed-era config contracts with 1–2 consumers** (12 files §I) — condition: retire each single consuming validator/script.
14. **`tests/federation` / source-regex-only test files** — condition: per-file behavioral-value triage (NEEDS-EVIDENCE first).

### 4. Delete-Immediately — 15 rows (highest confidence; all post-commit)
| # | Item | Why certain |
|---|---|---|
| 1 | **67 generated intelligence docs** (`docs/*/README.md` tree + `docs/architecture/master-system-intelligence.md` + `docs/architecture/README.md`) | Tracked (history preserves); generator hard-retired = unregenerable; verified stale falsehoods (letbuyy.store, "19 migrations", deleted packages) — ARCH §4.3 |
| 2 | **11 orphan validators** (list §G) | Zero external references, re-verified this audit by per-file grep |
| 3 | `.codex/` (empty) + `.codex-dev.log` (0 bytes) | Shell-verified empty |
| 4 | `.DS_Store` ×3 (root, `load/`, `docs/research/`) | macOS junk, gitignored |
| 5 | Root `build/` (161 MB), `.dart_tool/`, `.tmp/`, `test-results/`, `.pnpm-store/`, `.turbo/` | Machine-local caches/residue, all gitignored or empty |
| 6 | `legacy/` empty dir husk | files=0 (after committing the 37 tracked deletions) |
| 7 | `tests/projections/` empty dir | files=0 |
| 8 | `docs/mobile-migration-blueprint/` empty dir | `ls` empty; contents git-history-only since `47f29bc6` |
| 9 | `apps/storefront-runtime/src/app/demo/urban-kicks/` | Demo residue, live-routed |
| 10 | `firebasestorage.googleapis.com` remotePattern (`next.config.ts:43`) | Firebase tree is archive-only; whitelist is a dangling trust grant |
| 11 | 3 frozen-app rows in `staging-deploy.yml:189-200` + 4 frozen-app entries in `config/vercel/projects.json:79-137` | Direct drift vs frozen/not-deployed topology law |
| 12 | `tsconfig.workspace.json:68` dangling `./packages/typescript/utils` reference | Target exists neither on disk nor at HEAD; breaks `tsc -b` |
| 13 | `pubspec.yaml` `run:super_admin` melos script | Targets a sourceless reserved root |
| 14 | Mobile true-dead-weight set (platform_blocked screen+service, upgrade_screen, splash_screen, `widgets/home/` duplicate pair, `widgets/shared/empty_state.dart`, `deep_link_router.dart` + `go_router` dep) | Zero/duplicate function, verified zero inbound nav; requires same-change test edits |
| 15 | `ui_kit` internal duplicates (`empty_state_widget` vs `empty_state`; `error_view` vs `error_widget`) — one of each pair | Kit-internal duplication, MOBILE §3 |
| — | *(Already-executed, finalize by commit [DBU]: 8 rejected package roots/154 files, 77 validators, 69 theater tests, 37 legacy/firebase files, 6 helm/k8s files, 60 root docs, 38 governance docs, 16 task missions, 2 mobile parity files, `packages/dart/services`, `mobile-tokens.ts`)* | The deletion IS the working tree; `git checkout .` undoes all of it |

### 5. Archive-Immediately — 9 groups (~195 files; all moves under docs/archive/, post-commit)
1. `docs/Codex_waves/` — 26 files (12 dangerous incl. the prompt factory).
2. `docs/agents/` — 42 files (stale mandatory-reading instruction layer).
3. docs-root prompt/plan family — `CODEX_LETBUYY_FOUNDATION_MISSION.md`, `LETBUYY_MASTER_EXECUTION_PLAN.md`, `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md`, P0–P4 (8 files).
4. Frozen-app mission/audit families — apps-marketplace-audit (3), themes-marketplace-audit (17), developer-platform-audit (1), internal-operating-system-audit mission set (3), auth/2026-06-08 identity missions (3).
5. `docs/audit/` (19) + `docs/commerce-os-audit/` (10) + `docs/audits/` — dangerous replatform blueprints.
6. `docs/analysis/` Part1–4.
7. Superseded docs-root master audits/reports/logs (~25 files, list §F) + `docs/LETBUYY.md`.
8. Root business decks — 2 `.pptx` + 2 `.xlsx` → `docs/archive/root-governance-2026-06-10/`.
9. `MERGE_RUNBOOK.md` current text (after the replacement runbook for the real `stepup/main`→`main` promotion is written).
*(Conditional archive, after SURVIVABILITY-UNHOOK: ~16 theater governance docs + 6 theater runbooks — counted in §3.2, not here.)*

---

## The 10 most dangerous KEEP-by-accident rows

| # | Artifact | Why dangerous | Source |
|---|---|---|---|
| 1 | `config/runtime/multi-region-runtime.json` (23 refs) + `production-topology.json` `globalRegions` | Machine-enforced 4-region/failover contract the Constitution explicitly forbids; D13's own end-state validator locks it in — the GATE-1 self-block reborn | ARCH §1.2, §7.1-2 |
| 2 | `survivability-governance-validator.mjs` + `validate:survivability` in 3 workflows + `whole-repo-end-state-validator.mjs:179-193` | The new law structurally mandates rejected-architecture artifacts (chaos/, load/, multi-region, 4 theater docs) | GOV §5.5 |
| 3 | `chaos/` + `load/` | Rejected machinery kept alive solely by #2; `chaos:execute`/`load:execute` scripts remain runnable | GOV §5.5; package.json |
| 4 | `validate:production-certification` 10-validator lane + `infrastructure/scripts/operations` suite | Certification theater mandated by the end-state validator (incl. `certify:production:plan-report`); green names assert never-built capabilities | validator reads |
| 5 | `MERGE_RUNBOOK.md` | SKIP-D1 directs the maintainer here for the real promotion; the document merges two non-existent branches and starts with `git add`/`git commit` of obsolete files | GOV §6#1 |
| 6 | `tasks/todo.md` + `memory/lessons.md` | AGENT-R16-mandated pre-edit reading; both are 2026-03-01 fossils that normalize the exact scan-generation pattern the law forbids; lessons.md is simultaneously sentenced to DELETE by LEG-078 | PROMPT §4.6 |
| 7 | 38 scan-generated nested `AGENTS.md` + `docs/agents/` | Stale law inside the live authority chain (CLAUDE.md precedence); instruct regeneration via the exit-1 generator; `services/api-gateway/AGENTS.md:10` authorizes deleted packages | GOV §4.3, §6#5 |
| 8 | `staging-deploy.yml` frozen-app rows + `config/vercel/projects.json` frozen entries | "Frozen" apps still deploy to staging and keep production project IDs/URLs — frozen in production only | CODE §1.3 |
| 9 | `docs/governance/` contradicting survivors (esp. `multi-region-runtime-governance.md`, cited as authority by every reserved runtime manifest, and `runtime-composition-governance.md`, which routes composition through deleted rejected packages) | Present-tense law an agent will ingest; would recreate rejected topology | GOV §6#2-4; ARCH §7.5 |
| 10 | `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` (+ 6 paste-ready terminal relaunchers) until archived | A prompt **factory** that mass-produces new missions from the rejected-package worldview; one paste away from re-execution | PROMPT §4.3 |

*(Honorable mentions: `git stash@{0}` from a deleted branch; the `lb_accounts`/console/customer surfaces still on shared `AUTH_SECRET` — an identity-axis keep-by-accident, IDENT R4; `backfill_wallet_ledger_to_canonical` as a callable cross-tenant mass-writer with no runtime caller, MONEY §4.4.)*

---

## Unknowns / NEEDS-EVIDENCE register
1. `leads`/`comments` merchant pages + `leads` table — residue vs active lead capture (live probe).
2. `gift_card_*` tables — dormant product vs dead (live probe; mobile screen exists but is dead).
3. merchant-control-plane's parallel `/api/stores/[store]/*` surface — two-writers consolidation decision (per-page call-graph).
4. `.changeset/` stale changeset — whether changesets is part of any release flow.
5. `tests/federation/` (26 files) + source-regex-only test files — behavioral value triage.
6. `ui_kit` 18 unused exported widgets — library-surface pruning decision.
7. Content-level audit of the ~61 "benign" `docs/governance` survivors (GOV §9.3 carried forward).
8. Byte-fidelity of archived copies vs HEAD originals beyond the spot-verified V1/Freeze/maximalist (GOV §9.1).
9. Whether the staging matrix's 3 frozen apps are intentional canaries or a PHASE-A-HARD-006 oversight (CODE §13.3) — affects the urgency of the §4#11 deletes.
10. Live deployment state of everything (`mode: governance-contract-not-live-evidence`) — all DB/live-gated [DAP] conditions inherit this.

*End of registry. Discovery only — this report is the sole file written.*
