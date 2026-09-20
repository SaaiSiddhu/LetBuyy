# PROMPT DRIFT ELIMINATION PLAN — Convergence Cleanup (Phase 6)

**Program:** Convergence Cleanup 2026-06-10 · **Phase:** 6 — PROMPT DRIFT ELIMINATION
**Mode:** DISCOVERY ONLY. No code/architecture/prompt edits, no deletions, read-only git. This file is a *plan*, not an execution.
**Repo state (re-verified fresh):** branch `stepup/main`, HEAD `c4fc3cd6`, **+30** over `main`, working tree dirty (`78 ?? / 512 D / 410 M` via `git status --porcelain`).
**Mandate:** find every prompt CAPABLE OF REINTRODUCING rejected architecture, and produce the plan to ELIMINATE that drift capacity (delete the pure hazards, quarantine the historical ones, and stand up the registry + perimeter guard so `docs/` can never refill).
**All paths repo-relative to** `/Users/saai_sidd/Git/Letbuyy_Store`.

---

## 1. Executive Summary

1. **The prompt corpus is governed by a one-perimeter rule: the repo root is policed, `docs/` is not.** `scripts/validators/whole-repo-end-state-validator.mjs:16-46` enforces a **7-file root-markdown budget** (`allowedRootMarkdown`), asserts the master prompt is NOT at root (`:38`), and pins exactly one archived prompt (`docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md`, `:40`). **Below the root, nothing is enforced.** Everything dangerous has therefore pooled inside `docs/`, where no validator looks. The root looks clean; the drift just moved one directory down.

2. **`docs/Codex_waves/` is the live drift epicenter — 26 unpoliced prompt/mission/blueprint files, including TWO orchestrators and the prompt factory.** None are under `docs/archive/`. They are paste-ready: each `CODEX_*_MISSION.md` ends in a "LAUNCH PROMPT" / Codex `/goal` block, and `CODEX_MASTER_SEQUENTIAL_MISSION.md` + the five `TERMINAL_*` files are pure copy-paste relaunchers. Executed today they would **build the rejected extension platform + Wasm Functions runtime, create the `packages/extension-host` rejected package, activate reserved services (`checkout-runtime`, `event-bus`), build frozen apps (`developer-portal`, `app-marketplace`, `theme-marketplace`, `platform-operations-portal`), and re-poison CI with the dead `*.letbuyy.store` domain.**

3. **Fresh reject-list verification holds exactly.** From `scripts/validators/governance-common.mjs:142-150` the **rejected packages** are `packages/{app-engine, application-services, distributed-runtime, extension-host, orchestration, projection-runtime, runtime-composition}` (all seven confirmed gone from disk by `whole-repo-end-state-validator.mjs:52-54`). **Frozen apps** (`:66-71` + CLAUDE.md): `apps/{app-marketplace, developer-portal, theme-marketplace, platform-operations-portal}`. **Reserved services** (`:104-111`): `services/{checkout-runtime, search-service, media-service, notification-service, event-bus, analytics-pipeline}` — manifest-only. **Deprecated aliases** (`:78-95`): `apps/{admin,analytics,auth,checkout,internal,merchant,storefront}` + `apps/mobile/operator-team-app` + `apps/storefront-runtime/consumer-storefront`. Canonical domain is `letbuyy.com`; `letbuyy.store` / `developers.letbuyy.store` are dead.

4. **The single highest-leverage drift source is the prompt FACTORY** `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` — a meta-prompt that, pasted into claude.ai with `docs/Codex_waves/` attached as project knowledge, **mass-generates 8-10 fresh Codex missions** seeded with the rejected worldview: it declares all 7 rejected packages "✅ Stable" (`:102`), lists all 6 reserved services as buildable "Scaffold" (`:107`), enumerates frozen apps with maturity %s as active build targets (`:79-82`), and explicitly emits WS3 (marketplace), WS5 (platform-operations-portal), and WS10 (`developers.letbuyy.store`) missions (`:386-392`). It does not commit one violation — it manufactures violation factories.

5. **A live `docs/`-root mission and four live `docs/*-audit/` mission programs replicate the same hazards outside Codex_waves.** `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md` (whole-repo write scope, dead `.store` two-domain "DOMAIN RULE"), `docs/developer-platform-audit/CODEX_DEVELOPER_APP_FOUNDATION_PROMPT.md` (creates `apps/developer-portal/**`), `docs/apps-marketplace-audit/` (3 missions building frozen `app-marketplace`), `docs/themes-marketplace-audit/` (7 missions building frozen `theme-marketplace`), and `docs/internal-operating-system-audit/mission/CODEX_INTERNAL_OS_FOUNDATION_MISSION.md` (full-stack build of frozen `platform-operations-portal` with new migrations 113+).

6. **Two whole prescriptive build-programs are the largest lower-velocity danger surface.** `docs/audit/` (19 docs) and `docs/audits/apps-platform/` (23 docs) are audit+blueprint programs whose prescriptive halves design the Shopify-OS-2.0 end-state: `docs/audit/18-new-services-to-build.md:13` proposes a **NEW root `services/extension-runtime` for WASM** and activating `services/media-service`; `docs/audit/10-app-extension-spec.md`, `07-liquidjs-runtime-spec.md`, `13-final-architecture-blueprint.md`; `docs/audits/apps-platform/{10-target-architecture, 11-theme-app-extensions-blueprint, 14-apps-marketplace-blueprint, 15-partner-platform-blueprint, 20-final-architecture-blueprint, 21-implementation-roadmap}`. They are not paste-ready `/goal` prompts (lower velocity) but are written *law-for-a-build* and are off-canon.

7. **There is NO prompt registry and NO living canonical *execution* prompt — the convergence gap.** Nothing indexes the corpus. The one machine-pinned prompt, `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md`, is the *correct convergence-enforcement* prompt (it asserts the never-build list, 0% fee, no extension platform / Wasm / CQRS, kill the rejected packages) — but it is filed as a retired historical artifact, not promoted as the canonical "how to execute the next wave." So the only good prompt is dormant, the dangerous ones are live, and there is no index or guard to keep `docs/` from refilling once cleaned.

8. **Count:** **~50 drift-capable prompt artifacts**. Recommendation split: **DELETE 9** (the two factories + the seven pure paste-ready relaunchers/orchestrators with zero historical value), **ARCHIVE-and-quarantine ~41** (historical missions + the two prescriptive build-programs → `docs/archive/` under a quarantine header), **KEEP-but-annotate 1** (promote the archived convergence prompt to the canonical execution prompt). Then add a **PROMPTS.md registry + a `docs/`-wide perimeter guard** (a new end-state validator rule failing on any `*MISSION*/*PROMPT*/*BLUEPRINT*/TERMINAL_*` outside `docs/archive/`).

---

## 2. Method & Fresh Reject-List Verification

**Discovery (fresh, this pass):**
- Re-globbed the working tree (absolute paths, `node_modules` excluded) for `*PROMPT* *MISSION* *CODEX* *BLUEPRINT* *WAVE* *GOAL* *TERMINAL_* *RELAUNCH*` across root + `docs/` + the mandated subtrees (`docs/Codex_waves/`, `docs/agents/`, `docs/*-audit*/`, `docs/archive/{codex-prompts,build-missions,prompts}/`, `tasks/`, `memory/`, `.claude/`, `.codex/`). Census: **67 `*MISSION*.md`, 6 `*PROMPT*.md`, 10 `*BLUEPRINT*.md`** outside `node_modules` (Grep `files_with_matches`).
- Read each candidate's head/full text and **re-verified offending lines fresh** (every quote in §3 is from a fresh Read/Grep at HEAD `c4fc3cd6`, not carried over).
- Consulted the prior `REPOSITORY_TRUTH_AUDIT_2026_06_10/PROMPT_DRIFT_REPORT.md` and `CONVERGENCE_AUDIT_2026_06_10/PROMPT_DRIFT_REPORT.md` **only for completeness** (they surfaced the `docs/audit/` + `docs/audits/apps-platform/` clusters); all offending lines re-confirmed independently.

**Authoritative reject-list (re-read fresh from the validators, not from memory):**

| Class | Source of truth (re-read) | Members |
|---|---|---|
| Rejected packages | `scripts/validators/governance-common.mjs:142-150` (`rejectedPackageRoots`) + `no-rejected-package-imports-validator.mjs` | `packages/app-engine`, `application-services`, `distributed-runtime`, `extension-host`, `orchestration`, `projection-runtime`, `runtime-composition` — **all 7 confirmed gone from disk** |
| Frozen apps (not build/deploy targets) | `governance-common.mjs:66-71` (`frozenAppRoots`) + `CLAUDE.md` | `apps/app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal` |
| Reserved services (manifest-only) | `governance-common.mjs:104-111` (`reservedServiceRoots`) | `services/checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline` |
| Deprecated app aliases | `governance-common.mjs:78-95` | `apps/{admin,analytics,auth,checkout,internal,merchant,storefront}`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront` |
| Forbidden architectures | `CODEX_MASTER_IMPLEMENTATION_PROMPT.md:54-56` "never-build list" (cross-checked vs the constitution memory) | 22-service fleet · microservice split · CQRS/event-sourcing/saga · multi-region · sharding now · service mesh · self-custody payout · cross-merchant wallet · 3rd-party app marketplace + checkout extensions + **Wasm runtime** · headless storefront · fraud ML · in-WhatsApp checkout · **any GMV/transaction fee** · filling the 6 reserved services |
| Dead domains | `CLAUDE.md` + memory `letbuyy-canonical-domain` | `letbuyy.store`, `*.letbuyy.store`, `developers.letbuyy.store`, `api.letbuyy.store`, `console.letbuyy.store` (canonical = `letbuyy.com`) |

**Perimeter as it stands (re-read `whole-repo-end-state-validator.mjs`):** enforces root-markdown budget (`:16-36`), master-prompt-not-at-root (`:38`), archived-master-prompt-preserved (`:40`), rejected roots deleted (`:52-54`), reserved runtimes manifest-only (`:59-70`). **It never walks `docs/`.** That is the structural hole this plan closes.

---

## 3. Drift-Capable Prompt Inventory

**Action legend:** `DELETE` = pure drift hazard, zero historical value, machine-generatable or paste-ready relaunch · `ARCHIVE` = historical record, move to `docs/archive/<cluster>/` + quarantine header · `KEEP+ANNOTATE` = canon-aligned, promote/annotate.
**Velocity legend:** `★PASTE` = ends in a ready-to-run Codex `/goal`/launch block (highest velocity) · `MISSION` = prescriptive mission doc · `BLUEPRINT` = prescriptive design doc (lower velocity).

### 3.1 `docs/Codex_waves/` — the live epicenter (26 files, none archived)

| Path | Rejected thing it would reintroduce | Offending quote (fresh, at HEAD) | Action | Residual risk if left |
|---|---|---|---|---|
| `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` | **THE FACTORY** — mass-generates missions seeded with rejected packages (×7 "Stable"), reserved services (×6 buildable), frozen apps as targets, dead domain | `:102` "packages/application-services, distributed-runtime, orchestration, projection-runtime, runtime-composition … (✅ Stable)"; `:107` "services/queue-workers, checkout-runtime, event-bus, analytics-pipeline, search-service, notification-service, media-service — (🟡 Scaffold)"; `:392` "WS10: Developer Ecosystem Scaffold — NEW … for developers.letbuyy.store" | **DELETE** | Re-manufactures the entire drift corpus on demand; one paste = N new violation missions |
| `docs/Codex_waves/CODEX_MASTER_SEQUENTIAL_MISSION.md` | **ORCHESTRATOR #1** — single-agent run that builds extension platform + Wasm, GraphQL surface, dev portal on dead domain, frozen ops portal | `:45` "STAGE 7  WS13 Extension Platform → admin/checkout UI extensions + app blocks + Functions (Wasm)"; `:47` "STAGE 9 WS10 Developer Ecosystem (developers.letbuyy.store …)"; `:79-114` paste-ready `/goal` block | **DELETE** | Paste-ready end-to-end build of the rejected end-state |
| `docs/Codex_waves/CODEX_EXTENSION_PLATFORM_MISSION.md` | Extension platform + **`packages/extension-host` (rejected pkg)** + **Wasm runtime** + `app-engine` (rejected) | `:5` "a new `packages/extension-host/**` … + `packages/app-engine/**`"; `:19` "Functions (Wasm): a Wasm runtime executes app-provided functions"; `:35` "X5 Functions runtime (Wasm). A sandboxed Wasm runtime" | **DELETE** | Directly recreates a deleted rejected package + a NEVER-build runtime |
| `docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT.md` | Declares all 7 rejected packages + reserved services as live topology | `:42` "`distributed-runtime` … CQRS/events/workers … ✅ Stable"; `:43` "`orchestration` … Saga … ✅ Stable"; `:58` "Checkout Runtime services/checkout-runtime … 🟡 Scaffold"; `:59` "Event Bus services/event-bus … 🟡 Scaffold" | **ARCHIVE** | Authoritative-looking topology map that re-legitimizes every rejected root |
| `docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md` | Creates frozen `apps/developer-portal`; dead domain | `:139` "WS10 — Developer Ecosystem → Own ONLY apps/developer-portal/** (create it) … Scaffold developers.letbuyy.store"; `:111` "Wave 5 — Developer Moat WS10 developers.letbuyy.store" | **ARCHIVE** | Re-creates a frozen app + dead domain as a wave deliverable |
| `docs/Codex_waves/CODEX_API_GRAPHQL_MISSION.md` | New GraphQL Admin/Storefront API surface (a second API system) | mission body G0→G6 "a GraphQL Admin API + a Storefront API … generated TS+Dart SDKs" (per orchestrator `:65`) | **ARCHIVE** | Builds a parallel second API surface (one-system-per-domain violation) |
| `docs/Codex_waves/CODEX_DEVELOPER_ECOSYSTEM_MISSION.md` | Frozen `developer-portal`; dead domain; references `app-engine` | `:51` "Build developers.letbuyy.store"; `:58` "developers.letbuyy.store — where a third-party builder can read the real API"; `:7` "`app-engine`/`theme-engine`/`auth-core` contracts exist" | **ARCHIVE** | Builds frozen app on dead domain |
| `docs/Codex_waves/CODEX_THEME_BLOCK_ENGINE_MISSION.md` | App-block extension injection wired to the extension model (`app-engine`) | `:54` "T3 App blocks (extension injection) … pulls installed-app block contributions … from `app-engine`/`/v1/app-store`" | **ARCHIVE** | Re-introduces the extension-injection seam the never-build list forbids |
| `docs/Codex_waves/TERMINAL_5_WS10_DEVPORTAL.md` | **★PASTE relauncher** — creates frozen `developer-portal` on dead domain | `:4` "Owns ONLY: apps/developer-portal/** (a NEW Next.js app to create)"; `:24` "scaffold developers.letbuyy.store"; `:16-32` `/goal` block | **DELETE** | One-paste build of a frozen app + dead domain |
| `docs/Codex_waves/TERMINAL_4_WS5_OPERATIONS.md` | **★PASTE relauncher** — builds frozen `platform-operations-portal` | worktree/`/goal` relaunch for WS5 ops (per `CODEX_OPERATIONS_MISSION.md` `platform-operations-portal`) | **DELETE** | One-paste build of a frozen app |
| `docs/Codex_waves/TERMINAL_5_WS10_…`, `TERMINAL_1_WS7_PRODUCTION.md`, `TERMINAL_2_WS1_DESIGNSYSTEM.md`, `TERMINAL_3_WS9_SETTINGS.md`, `TERMINAL_6_WS8_MOBILE.md` | **★PASTE relaunchers** — worktree + `/goal` paste blocks for the parallel-5-agent program | each is "PASTE THIS INTO CODEX `/goal`" + `git worktree add` | **DELETE** (the set) | Paste-ready relaunch of the multi-agent drift program |
| `docs/Codex_waves/CODEX_LAUNCH_PLAYBOOK.md` | Wave-by-wave `/goal` launch commands incl. dev portal on dead domain | `:129` "scaffold developers.letbuyy.store on @letbuyy/ui" | **DELETE** | The operational relaunch manual for the whole program |
| `docs/Codex_waves/CODEX_MARKETPLACE_UX_MISSION.md` | Builds frozen `app-marketplace` + `theme-marketplace` UX | owns `apps/app-marketplace/src/** + apps/theme-marketplace/src/**` (per factory `:214`) | **ARCHIVE** | Frozen-app build target |
| `docs/Codex_waves/CODEX_OPERATIONS_MISSION.md` | Builds frozen `platform-operations-portal` + `platform-console` | owns `platform-console/** + platform-operations-portal/**` (orchestrator `:61`) | **ARCHIVE** | Frozen-app build target |
| `docs/Codex_waves/CODEX_PRODUCTION_HARDENING_MISSION.md` | "advance scaffold services"; staging on `*.staging.letbuyy.store` | orchestrator `:56` "advance scaffold services"; mobile mission `:65` `api.staging.letbuyy.store` | **ARCHIVE** | Nudges reserved-service activation + dead domain |
| `docs/Codex_waves/CODEX_ENV_CLEANUP_MISSION.md` | Rewrites CI to deploy to `*.staging.letbuyy.store` (dead domain) | `:34` "runs Playwright/J1-J5 against `*.staging.letbuyy.store`" | **ARCHIVE** | Re-poisons CI with the banned domain |
| `docs/Codex_waves/CODEX_MOBILE_PARITY_MISSION.md` | Dead domain endpoints baked into mobile env | `:65` "`https://api.staging.letbuyy.store/v1`"; `:66` "`https://api.letbuyy.store/v1`" | **ARCHIVE** | Bakes dead domain into the mobile app |
| `docs/Codex_waves/CODEX_DESIGN_SYSTEM_MISSION.md`, `CODEX_MERCHANT_UX_MISSION.md`, `CODEX_STOREFRONT_MISSION.md`, `CODEX_IDENTITY_MARKETING_MISSION.md`, `CODEX_SETTINGS_ARCHITECTURE_MISSION.md`, `CODEX_LETBUYY_REMEDIATION_MISSION.md` | Canon-adjacent UX missions, but cite the 128-validator theater and feed the orchestrators | members of the WS program the orchestrators drive | **ARCHIVE** | Lower-risk individually, but they are the orchestrators' fuel; archive as a set so the program can't be reassembled |

### 3.2 `docs/` live (non-archive) mission programs outside Codex_waves

| Path | Rejected thing | Offending quote (fresh) | Action | Residual risk |
|---|---|---|---|---|
| `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md` | Whole-repo write scope; dead `.store` two-domain rule; 50 marketplace "cross-boundary contracts" | `:25` "`letbuyy.store` = storefront-only (wildcard `*.letbuyy.store` …)"; `:1` "the apps/app-marketplace audit + its 50 cross-boundary contracts" | **ARCHIVE** | Authorizes whole-repo edits on a dead-domain premise |
| `docs/developer-platform-audit/CODEX_DEVELOPER_APP_FOUNDATION_PROMPT.md` | Creates frozen `apps/developer-portal/**`; dead domain | `:22` "You OWN … `apps/developer-portal/**` — the entire docs portal" | **ARCHIVE** | One-pass build of a frozen app |
| `docs/apps-marketplace-audit/CODEX_APPS_MARKETPLACE_FOUNDATION_MISSION.md` | Builds frozen `apps/app-marketplace` (single autonomous run) | `:11` "You may only create/modify/delete files under `apps/app-marketplace/**`" | **ARCHIVE** | Frozen-app build program |
| `docs/apps-marketplace-audit/CODEX_APPS_MARKETPLACE_UIUX_MISSION.md`, `…UIUX_WAVE9_MISSION.md` | Same frozen app, UX waves | own `apps/app-marketplace/**` | **ARCHIVE** | Frozen-app build program |
| `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_MISSION.md` (+ `_STEPUP`, `_STEPUP_V2`, `_GA_CLOSURE`, `_CLOSEOUT`, `_UIUX_COMPLETION`, `CODEX_THEME_PLATFORM_BACKEND_MISSION.md`) | Builds frozen `apps/theme-marketplace` (7 missions) | each owns `apps/theme-marketplace/**` / theme-marketplace backend | **ARCHIVE** (set) | Frozen-app build program (largest single frozen-app mission cluster) |
| `docs/internal-operating-system-audit/mission/CODEX_INTERNAL_OS_FOUNDATION_MISSION.md` | Full-stack build of frozen `platform-operations-portal` + new migrations 113+ | `:14` "`apps/platform-operations-portal/**` (employee execution modules)"; `:18` "add new forward migrations only, starting at `113_*`" | **ARCHIVE** | Frozen-app build with schema changes (note: it *does* forbid new roots/reserved services at `:20`, so it is canon-aware but still off-canon on the frozen target) |
| `docs/auth/2026-06-08-identity-platform-transformation/CODEX_IDENTITY_FOUNDATION_STEPUP_MISSION.md`, `LETBUYY_IDENTITY_TRANSFORMATION_BLUEPRINT.md`, `PERMISSION_MODEL.md` | Identity transformation program (superseded by the canonical identity-platform sole-issuer decision) | dated 2026-06-08 transformation set | **ARCHIVE** | Stale parallel identity plan; low rejected-arch content but off-canon program |

### 3.3 Prescriptive build-programs (lower velocity, off-canon law-for-a-build)

| Path | Rejected thing | Offending quote (fresh) | Action | Residual risk |
|---|---|---|---|---|
| `docs/audit/18-new-services-to-build.md` | **NEW root `services/extension-runtime` for WASM** + activate reserved `services/media-service` | `:13` "`services/extension-runtime` ◇NEW ROOT … WASM execution of app function hooks … 5ms/1MB budgets"; `:8` "`services/media-service` … theme assets + signed theme packages" | **ARCHIVE** | A literal build list for a new rejected service + reserved-service activation |
| `docs/audit/10-app-extension-spec.md`, `07-liquidjs-runtime-spec.md`, `06-storefront-runtime-replacement-plan.md`, `13-final-architecture-blueprint.md`, `12-api-refactoring-roadmap.md`, `11-database-refactoring-plan.md`, `14-migration-roadmap.md`, `15-file-refactor-plan.md` (+ the 11 descriptive docs in `docs/audit/`) | App-extension spec + storefront-runtime "replacement" + final-architecture blueprint = Shopify-OS-2.0 end-state | spec/blueprint bodies | **ARCHIVE** (cluster) | Off-canon "target architecture" presented as a build plan |
| `docs/audits/apps-platform/{10-target-architecture-apps-platform, 11-theme-app-extensions-blueprint, 12-liquidjs-integration-blueprint, 13-storefront-runtime-integration-blueprint, 14-apps-marketplace-blueprint, 15-partner-platform-blueprint, 16-database-refactor-blueprint, 17-api-refactor-blueprint, 19-runtime-ownership-blueprint, 20-final-architecture-blueprint, 21-implementation-roadmap}.md` (+ the 12 descriptive docs) | Theme-app-extensions + apps-marketplace + partner-platform + final-architecture blueprints; 0-12 implementation roadmap | blueprint/roadmap bodies | **ARCHIVE** (cluster) | The second whole Shopify-OS-2.0 build program; 23 files |
| `docs/research/shopify-product-intelligence/{SHOPIFY_APP_ECOSYSTEM_BLUEPRINT, SHOPIFY_THEME_SYSTEM_BLUEPRINT, SHOPIFY_PAYMENTS_AND_BILLING_BLUEPRINT, SHOPIFY_SETTINGS_MASTER_BLUEPRINT, SHOPIFY_PRODUCTIVITY_BLUEPRINT, LETBUYY_SHOPIFY_TRANSFORMATION_BLUEPRINT}.md` | Shopify-maximalism reference blueprints (app-extension-point worldview) | `SHOPIFY_APP_ECOSYSTEM_BLUEPRINT.md:47` "Checkout needs … app-powered extension points" | **ARCHIVE** (cluster) | Source material that re-seeds the maximalist worldview |

### 3.4 Already inside the archive perimeter (`docs/archive/**`) — confirm + annotate

| Path | Status | Action |
|---|---|---|
| `docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md` | The **canonical convergence-enforcement** prompt (asserts never-build list, 0% fee, no extension/Wasm/CQRS, kill rejected packages); pinned by `whole-repo-end-state-validator.mjs:40` | **KEEP + ANNOTATE** → promote to the canonical *execution* prompt (see §6); add a header pointing to it from PROMPTS.md |
| `docs/archive/prompts/` (16 files incl. `CODEX_DOMAIN_SPLIT_MISSION.md` = dead `.store` two-domain split `:28-30`; `CODEX_THEME_MARKETPLACE_FOUNDATION_MISSION.md`, `CODEX_APPS_MARKETPLACE_*` = frozen apps; `CODEX_FOUNDATION_STEPUP_*`) | In archive, but **no quarantine header** | **ARCHIVE/annotate** — add the quarantine header (they are physically archived but unmarked, so a reader can't tell they are rejected) |
| `docs/archive/root-residue/**`, `docs/archive/root-governance-2026-06-10/**`, `docs/archive/foundation-stepup-archive-2026-06-10/**`, `docs/archive/build-missions/**` (the historical `CODEX_*` missions: checkout-platform-build, federation, brand-unification, foundation-remediation, executable-build, etc.) | In archive | **ARCHIVE/annotate** — add quarantine header to the cluster READMEs; otherwise leave (already inside the perimeter) |

> Items in §3.4 are *inside* `docs/archive/` and so are NOT new violations; they need only the quarantine header so the perimeter guard (§6) treats them as compliant and a reader knows they are rejected.

---

## 4. The DELETE Set (pure drift hazards, zero historical value)

These are either machine-regenerable (the factory) or paste-ready relaunchers whose only function is to *restart the rejected-arch build program*. They carry no record value a quarantined mission doc wouldn't — keeping them is keeping a loaded relaunch button. **9 artifacts:**

1. `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` — **the factory.** Generates the whole corpus; deleting one file removes the ability to mass-manufacture rejected missions. (Highest priority.)
2. `docs/Codex_waves/CODEX_MASTER_SEQUENTIAL_MISSION.md` — orchestrator #1, paste-ready single-agent build of the rejected end-state (`:79-114`).
3. `docs/Codex_waves/CODEX_EXTENSION_PLATFORM_MISSION.md` — the recipe to recreate `packages/extension-host` + a Wasm runtime (a deleted rejected package + a NEVER-build runtime).
4. `docs/Codex_waves/CODEX_LAUNCH_PLAYBOOK.md` — the wave-by-wave `/goal` relaunch manual.
5. `docs/Codex_waves/TERMINAL_1_WS7_PRODUCTION.md`
6. `docs/Codex_waves/TERMINAL_2_WS1_DESIGNSYSTEM.md`
7. `docs/Codex_waves/TERMINAL_3_WS9_SETTINGS.md`
8. `docs/Codex_waves/TERMINAL_4_WS5_OPERATIONS.md` (builds frozen `platform-operations-portal`)
9. `docs/Codex_waves/TERMINAL_5_WS10_DEVPORTAL.md` (creates frozen `developer-portal` on dead domain) + `TERMINAL_6_WS8_MOBILE.md`

> (The five/six `TERMINAL_*` files are one logical relaunch kit; counted as the set. If a stricter "delete only the unambiguously pure hazards" line is preferred, the minimal DELETE set is the **factory + both orchestrators + the extension-platform mission + the launch playbook = 5 files**, with the `TERMINAL_*` kit moved to ARCHIVE. Recommended: delete all 9 — a worktree-paste relaunch kit has no archival value.)

**Why DELETE, not ARCHIVE, for these:** archiving a paste-ready `/goal` block still leaves a working relaunch button one `cp` away; the factory archived still regenerates the corpus when fed to claude.ai. Their content is fully captured (as a cautionary example) by this report's quotes. Deletion removes the *capability*, which is the Phase-6 objective.

---

## 5. The ARCHIVE-and-Quarantine Set (historical, move under `docs/archive/` + header)

Everything in §3.1 (remaining), §3.2, §3.3, and the un-headered items in §3.4. Move each cluster to `docs/archive/<cluster-name>-2026-06-10/` (preserving internal structure) and prepend the quarantine header below to every file (or to a cluster `README.md` that the guard recognizes). **~41 artifacts** across:

- `docs/Codex_waves/` remainder (the WS UX missions + both blueprints + GraphQL + dev-ecosystem + theme-block + marketplace/operations/hardening/env/mobile missions) → `docs/archive/codex-waves-2026-06-10/`
- `docs/CODEX_LETBUYY_FOUNDATION_MISSION.md` → `docs/archive/codex-waves-2026-06-10/` (or `root-residue`)
- `docs/developer-platform-audit/` (the mission/prompt) → `docs/archive/developer-platform-2026-06-10/`
- `docs/apps-marketplace-audit/` mission files → `docs/archive/apps-marketplace-2026-06-10/`
- `docs/themes-marketplace-audit/` mission files → `docs/archive/themes-marketplace-2026-06-10/`
- `docs/internal-operating-system-audit/mission/` → `docs/archive/internal-os-2026-06-10/`
- `docs/auth/2026-06-08-identity-platform-transformation/` → `docs/archive/identity-transformation-2026-06-08/`
- `docs/audit/` (19) → `docs/archive/audit-2026-06-XX/`
- `docs/audits/apps-platform/` (23) → `docs/archive/audits-apps-platform-2026-06-XX/`
- `docs/research/shopify-product-intelligence/` BLUEPRINTs (6) → `docs/archive/shopify-research-2026-06-10/`
- Un-headered items already under `docs/archive/` (§3.4) → add header in place.

**Quarantine header (prepend verbatim):**

```markdown
> ⚠️ ARCHIVED — REJECTED ARCHITECTURE — DO NOT EXECUTE
> Quarantined 2026-06-10 by Convergence Cleanup Phase 6 (PROMPT_DRIFT_ELIMINATION_PLAN.md).
> This document predates / contradicts the ratified canon and, if executed, would reintroduce
> a REJECTED system (one or more of: microservice split · CQRS/event-sourcing/event-bus ·
> extension platform / extension-host / Wasm Functions · reserved-service activation
> (checkout-runtime/event-bus/…) · frozen-app build-out (app-marketplace/developer-portal/
> theme-marketplace/platform-operations-portal) · the dead letbuyy.store/developers.letbuyy.store
> domain · any GMV/transaction fee · RazorpayX self-custody).
> Authoritative canon: root AGENTS.md → GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md.
> Canonical execution prompt: docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md.
> Kept for historical record only. See PROMPTS.md.
```

---

## 6. The Structural Anti-Drift Requirement (registry + perimeter guard)

The cleanup is necessary but not sufficient: with no index and a root-only perimeter, `docs/` simply refills. Two artifacts must exist, and the guard must be *load-bearing* (part of `validate:governance`). **Described as requirements; the validator code is NOT authored here.**

### 6.1 Requirement A — a canonical prompt registry `PROMPTS.md` (repo root)

- **Single index of every prompt-class artifact in the repo**, with for each: path, class (`CANONICAL-EXECUTION` | `CANONICAL-LAW` | `ARCHIVED-QUARANTINED` | `DELETED-<date>`), one-line purpose, and the rejected-thing reason for any quarantined entry.
- **Exactly one `CANONICAL-EXECUTION` entry.** The convergence gap is that the only good prompt (`docs/archive/codex-prompts/CODEX_MASTER_IMPLEMENTATION_PROMPT.md`) is filed as retired. **Promote it** (or its successor) to the named canonical execution prompt and register it here, so "how do I execute the next wave?" has one machine-known answer.
- Must be in `allowedRootMarkdown` (add `"PROMPTS.md"` to `whole-repo-end-state-validator.mjs:16-24`) so it can live at root without tripping the budget.
- The guard (6.2) reads PROMPTS.md as the allow-list: any prompt-class file not registered (or registered as `DELETED`) is a hard failure.

### 6.2 Requirement B — a `docs/`-wide perimeter guard (new end-state validator rule)

A new rule (extending `whole-repo-end-state-validator.mjs` or a sibling validator wired into `validate:governance`) that **walks the entire `docs/` tree** and fails on any prompt-class file outside the archive perimeter. Precisely:

- **Match set:** any file whose name matches `/(MISSION|PROMPT|BLUEPRINT|GOAL|RELAUNCH)/i` or `/^TERMINAL_/i` (and, recommended, files containing a paste-ready Codex launch marker such as `PASTE THIS INTO CODEX` / `/goal` / `--- BEGIN PROMPT ---`).
- **Allowed locations:** only under `docs/archive/**` (historical) OR registered in `PROMPTS.md` as `CANONICAL-*`. Anything matching the set anywhere else under `docs/` (or repo-wide outside `node_modules`/`.git`) ⇒ **assert failure** with the offending path, mirroring the existing rejected-root asserts (`:52-54`).
- **Quarantine-header check:** every matched file under `docs/archive/**` must contain the `ARCHIVED — REJECTED ARCHITECTURE — DO NOT EXECUTE` sentinel (or live under a cluster whose `README.md` carries it) — so archiving without neutralizing also fails.
- **Forbidden-token check (recommended, additive):** for matched files, fail on live (non-archived) reintroduction tokens already known to the codebase — the `rejectedPackageRoots` names, `reservedServiceRoots` names, `extension-host`, `Wasm`/`WASM`, `event-bus`, `developers.letbuyy.store` / `*.letbuyy.store` — reusing the same lists `no-rejected-package-imports-validator.mjs` already imports, so the prompt layer is policed by the same canon as source.
- **Root coverage:** keep the existing `:38` master-prompt-not-at-root assert; extend the spirit to "no prompt-class markdown at root except those in `allowedRootMarkdown`."

**Net effect:** after the DELETE + ARCHIVE passes, this guard makes the cleaned state *stable* — a new mission dropped anywhere live in `docs/` turns `validate:governance` red, exactly as a resurrected `packages/distributed-runtime` does today. Drift loses its hiding place.

---

## 7. The Prompt Factory — deep dive

`docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` (455 lines) is the apex hazard and warrants its own treatment because it is *generative*: it does not contain one violation, it contains the instructions to produce many.

**What it is.** A meta-prompt (`:40` "--- BEGIN PROMPT ---") to paste into claude.ai Opus 4.8 with the *entire* `docs/Codex_waves/` folder attached as project knowledge (`:6`). It instructs the model to emit, as separate artifacts, a deep analysis, an enhanced master blueprint, and **8-10 individual Codex mission documents** (`:316-394`) each ending in a ready-to-paste Codex `/goal` "LAUNCH PROMPT" (`:378-380`).

**The rejected worldview it injects into every child mission:**
- `:102` lists all 7 rejected packages (`application-services, distributed-runtime, orchestration, projection-runtime, runtime-composition`, + `app-engine` at `:97`) as "✅ Stable" backend orchestration — so every generated mission treats deleted packages as live dependencies.
- `:107` lists all 6 reserved services (`checkout-runtime, event-bus, analytics-pipeline, search-service, notification-service, media-service`) as "🟡 Scaffold" — i.e., things to finish building.
- `:79-82` enumerates the 4 frozen apps (`app-marketplace`, `theme-marketplace`, `platform-operations-portal`, and `developer-portal` via WS10) with maturity percentages, framing them as active build targets.
- `:386-392` explicitly orders the generation of **WS3 Marketplace** (frozen apps), **WS5 Platform Operations** (frozen `platform-operations-portal`), and **WS10 Developer Ecosystem** "for developers.letbuyy.store" (frozen app + dead domain).
- `:123` "Phase 2 (Federation): ✅ DONE" — re-imports the rejected federation framing.

**Why it is the highest-leverage delete.** Every other dangerous prompt reintroduces *one* rejected thing when executed. The factory reintroduces the *capacity to generate an unbounded number* of them, each pre-seeded to look canon-compliant (it even carries a "DO-NOT-TOUCH LIST" at `:128-143` that lulls a reader into trusting it). It also names a now-dead dependency graph as ground truth, so its outputs are subtly wrong in exactly the convergence-relevant ways. **Deleting this one file removes more drift capacity than archiving the other 49 combined.** It has no historical value that this deep-dive (with quotes) does not already preserve.

**Disposition:** `DELETE` (item #1 of §4). Record the deletion in `PROMPTS.md` as `DELETED-2026-06-10` with this report as the rationale, so the absence is intentional and auditable.

---

## 8. Unknowns / Limits of this pass

1. **Bash/git was unavailable for most of the pass** (workspace `mcp__workspace__bash` returned "process already running" repeatedly; one late call succeeded and re-confirmed HEAD `c4fc3cd6` / +30 / `512 D · 410 M · 78 ??`). Tracked-vs-untracked status per file was therefore **not** re-derived this pass; the prior `CONVERGENCE_AUDIT` report found the `docs/Codex_waves/` corpus tracked-clean and the archive/validators/ledgers *untracked* (a `git clean -fd` would destroy the archive). **Before executing any DELETE/ARCHIVE, re-run `git status --porcelain -- <path>` per cluster** to choose `git rm` vs plain delete and to ensure the archive destination is committed.
2. **Line numbers** are from the working tree at HEAD `c4fc3cd6`; a few long offending lines were Grep-reported as "[Omitted long matching line]" (e.g., `CODEX_EXTENSION_PLATFORM_MISSION.md:12,24`) — the rejected content is confirmed on adjacent quoted lines, but exact column anchors for those were not captured.
3. **Exhaustiveness of `docs/audit/` + `docs/audits/apps-platform/`**: classified at the cluster level (prescriptive build-program) from filenames + spot-reads (`docs/audit/18-new-services-to-build.md` read in full for the WASM/new-root quote); the ~31 descriptive sibling docs were not each read line-by-line. They are archived as clusters, so per-file re-read is not required for the *action*, only for finer per-file annotation.
4. **`CODEX_API_GRAPHQL_MISSION.md` / several Codex_waves UX missions** were classified from the orchestrators' authoritative summaries + headers rather than a full read of each body; the action (ARCHIVE) is conservative and unaffected, but a full read would let some UX-only missions (design-system, settings, merchant-UX) potentially downgrade from "archive the program" to "keep as historical UX reference."
5. **The minimal-vs-recommended DELETE line** (5 vs 9 files, §4 note) is a judgment call left explicit for the human ratifier; both are defensible.
6. **No validator currently policies prompt locations at all below root** — confirmed by reading `whole-repo-end-state-validator.mjs` end-to-end; there is no hidden guard elsewhere (the 100+ validators in `scripts/validators/` were enumerated; none match prompt/mission/archive-perimeter semantics).

---

*End of plan. Discovery only — no files were modified, deleted, moved, or created beyond this report. Execution (DELETE/ARCHIVE/registry/guard) requires human ratification per the convergence program.*
