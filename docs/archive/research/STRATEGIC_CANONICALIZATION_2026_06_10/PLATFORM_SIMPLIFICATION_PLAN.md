# LETBUYY — PLATFORM SIMPLIFICATION & DEPLOYMENT-REALITY PLAN

> **Part 9 of the Strategic Canonicalization program.** This document reconciles the **four realities** of the LetBuyy platform — what actually deploys, what governance asserts, what the architecture docs say, and what the strategic target (V1) requires — then produces the executable plan to collapse the estate onto the V1 topology: a modular-monolith-plus-satellites running over one RLS Postgres on Cloudflare + Vercel, governed by **one** constitution and **one** validator suite that enforces V1 (not the rejected end-state).

| | |
|---|---|
| **Date** | 2026-06-10 |
| **Author** | Principal Platform/Infrastructure Engineer — Architecture Review Board |
| **Repo** | `/Users/saai_sidd/Git/Letbuyy_Store` |
| **Branch / HEAD at audit** | `stepup/main` @ `c4fc3cd6`; `main` (prod trigger) tip `4bcae19a`, **30 commits behind**; working tree DIRTY |
| **Authoritative inputs** | `_ANCHOR_DECISIONS_SPINE.md` (A0, A6, A7, A9); `FORENSIC_MASTER_2026_06_10/REPO_TOPOLOGY_AUDIT.md` (TOPO-001…041); `…/ARCHITECTURE_COMPLIANCE_AUDIT.md` (ARCH-005/006 governance gap); `…/PERFORMANCE_AUDIT.md` (PERF-001/002/003 BFF stub); `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` §6 + §17; `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` §9.13 (frozen diagram) |
| **Scope** | Topology convergence, deploy-pipeline reality, governance retargeting, single-constitution resolution, domain migration, mobile-bff composites, infra drift. **Money/identity/tenancy/theme/UI internals are owned by the A1–A8 sibling deliverables** and referenced only where they touch topology. |
| **Constraint** | No production merchants, no legacy migration burden ⇒ converge directly on V1; preserve nothing for its own sake. No repo code modified by this document. |

---

## Methodology

1. **Established the four realities independently and from primary sources** (not from each other):
   - **(a) Deployed reality** — read `.github/workflows/production-deploy.yml` line-by-line (trigger, worker steps, the 9-app Vercel matrix, the pinned env URLs), every `services/*/wrangler.toml` (routes, Hyperdrive bindings, feature flags), and `services/mobile-bff/src/index.ts` (the actual handler surface).
   - **(b) Governance reality** — counted `scripts/validators/*.mjs` (**181 files**, verified by grep), read `config/runtime/production-topology.json`, and used `ARCHITECTURE_COMPLIANCE_AUDIT.md` §11–§12 (the AGENTS-vs-V1 enforcement gap) cross-checked against the validator filenames.
   - **(c) Documented reality** — V1 §6 production/reserved/dormant/deprecated lists and §17 + Freeze §9.13 frozen diagrams.
   - **(d) Strategic reality** — the `_ANCHOR_DECISIONS_SPINE.md` calls (A0/A6/A7/A9) which are themselves the ratified V1 destination.
2. **Drift = any disagreement between (a)/(b)/(c) and (d).** Each drift is classified by type: deployment, topology, branch, infrastructure, governance, constitution.
3. Every decision carries the full 13-field block (Current State · Strategic State · Reasoning · Migration · Validation · Deletion · Rollback · Risk · Complexity · Timeline · Owner · Dependencies · Success Criteria) and a classification: **CANONICAL / TRANSITIONAL / LEGACY / DEAD / FROZEN** (legend per `_ANCHOR_DECISIONS_SPINE.md`).
4. Sequencing obeys the cross-cutting law: **deploy-pipeline/branch-lag fix is Wave-0 META** (nothing ships without it); governance retargeting + constitution merge is Wave-1/2 (it currently certifies the wrong architecture); domain migration is Wave-1; mobile-bff composites are Wave-2/3.
5. UNVERIFIED items (live DNS/runtime state, CI run success, full RLS coverage) are marked, never asserted.

---

## Executive Verdict (the four-realities gap + the meta-blocker)

**The platform runs four mutually-contradictory definitions of itself, and the only machine-enforced one is the rejected architecture.** Reality (a) — what `production-deploy.yml` actually ships — is a **13-runtime estate**: 4 Cloudflare Workers (`api-gateway`, `webhook-service`, `queue-workers`, `mobile-bff`) **plus 9 Vercel apps** including `app-marketplace` and `developer-portal` (V1 R-11 rejects both) and two redundant internal consoles. Reality (b) — the **181-validator gate + `AGENTS.md`** — actively *requires* those nine apps to exist and *requires* CQRS/event-store/replay/projection/saga/multi-region certification artifacts that V1 rejected (R-4/R-5/R-13); `config/runtime/production-topology.json` goes further and **fabricates** the empty `event-bus` reserved service as a `environment: "production"` runtime deployed by a Kubernetes Helm chart no pipeline ever applies. Reality (c) — V1 §6 + the Freeze diagram — specifies the **8-runtime** target (4 apps + 4 workers) with six reserved services kept manifest-only; reality (d) ratifies exactly that. **The meta-blocker dwarfs all of it: `main` (the sole production-deploy trigger) is 30 commits behind the integration branch, so none of the eight completed foundation waves — including the uncommitted `/api/auth/switch` account-takeover fix — can reach production at all; the live estate is running pre-wave code.** Until the branch lag is cleared, every other simplification is theory: you cannot converge a pipeline that cannot deploy.

---

## The Four-Realities Reconciliation Table

Legend — **Deployed?**: YES (workflow ships it) · BUILDS (CI builds, no deploy) · NO. **Drift-type**: `none` · `deploy` (built-not-deployed or deployed-not-canonical) · `topology` (estate ≠ V1 §6) · `branch` (blocked by main lag) · `infra` (domain/Hyperdrive/topology-JSON) · `gov` (validators enforce wrong thing).

| Component | Deployed? (a) | Governance says (b) | V1 says (c) | Strategic (d) | Drift-type | Classification |
|---|---|---|---|---|---|---|
| `services/api-gateway` (monolith) | YES (prod+staging) | canonical runtime | **the** modular monolith | KEEP — core | branch (30-behind) | **CANONICAL** |
| `services/queue-workers` | YES | canonical runtime | async jobs + outbox relay | KEEP | branch | **CANONICAL** |
| `services/webhook-service` | YES | canonical runtime | outbound webhooks | KEEP | branch + infra (`.store` domain) | **CANONICAL** |
| `services/mobile-bff` | YES — **305-line stub** | canonical runtime | transport + **composite endpoints** | KEEP, **build composites** | deploy (deployed-not-real) + infra | **CANONICAL (incomplete)** |
| `apps/merchant-control-plane` | YES | canonical (9-app) | production app #1 | KEEP | branch + infra | **CANONICAL** |
| `apps/storefront-runtime` | YES | canonical (9-app) | production app #2 (+hosted checkout) | KEEP; unwire `runtime-composition` | deploy + topology (dormant pkg wired) | **CANONICAL** |
| `apps/identity-platform` | YES | canonical (9-app) | production app #3 | KEEP | branch (S0 fix uncommitted) | **CANONICAL** |
| `apps/mobile/merchant-app` | BUILDS (debug only) | canonical | production app #4 (Flutter) | KEEP; fix release signing; delete TD-5 | deploy (no release pipeline) | **CANONICAL (incomplete)** |
| `apps/marketing-site` | YES | canonical (9-app) | *(outside §6, benign)* | KEEP (cheap, necessary) | topology (benign) | **CANONICAL** |
| `apps/theme-marketplace` | YES | canonical (9-app) | dormant catalog (A5) | **FREEZE** (machinery kept, catalog dormant) | topology + deploy | **FROZEN** |
| `apps/app-marketplace` | YES — 19,557 LOC | canonical (9-app) | **R-11 REJECTED now** | **FREEZE** (de-deploy; keep empty seam) | deploy + topology | **FROZEN** |
| `apps/developer-portal` | YES (prod-only, no `vercel.json`) | canonical (9-app) | **R-11 REJECTED now** | **FREEZE** (de-deploy) | deploy + topology | **FROZEN** |
| `apps/platform-console` | YES | canonical (9-app) | thin ops sliver (one) | **PICK as canonical ops surface** | deploy + topology | **CANONICAL (consolidate)** |
| `apps/platform-operations-portal` | YES | canonical (9-app) | thin ops sliver (one) | **LEGACY** (fold into console) | deploy + topology | **LEGACY** |
| `services/checkout-runtime` | NO (manifest-only) | **"production" in topology.json** | reserved-empty | reserved-empty | infra (topology fabrication) | **FROZEN-empty** |
| `services/event-bus` | NO (manifest-only) | **"production" + Helm + distributed-runtime** | reserved-empty | reserved-empty | infra (fabrication) | **FROZEN-empty** |
| `services/notification-service` | NO | "production" in topology.json | reserved-empty | reserved-empty | infra | **FROZEN-empty** |
| `services/analytics-pipeline` | NO | "production" in topology.json | reserved-empty | reserved-empty | infra | **FROZEN-empty** |
| `services/media-service` | NO | "production" in topology.json | reserved-empty | reserved-empty | infra | **FROZEN-empty** |
| `services/search-service` | NO | "production" in topology.json | reserved-empty | reserved-empty | infra | **FROZEN-empty** |
| `apps/mobile/shopper-app`, `…/operator-app` | NO | canonical roots | reserved-empty | reserved-empty | none (compliant) | **FROZEN-empty** |
| `packages/{app-engine, application-services, extension-host, projection-runtime, orchestration, distributed-runtime}` | BUILDS (CI) | **validators require their shape** | dormant (R-4/R-5/R-11) | **DEAD → SAFE_DELETE** | gov + topology | **DEAD** |
| `packages/runtime-composition` | BUILDS — **wired into storefront** | dormant per AGENTS exec-rules | dormant "do not wire" | DELETE_AFTER_MIGRATION (unwire first) | topology (dormant-wired) | **DEAD (after unwire)** |
| `packages/search-core` | BUILDS — leaked into api-types | dormant | dormant | un-leak; keep dormant | topology | **FROZEN** |
| `packages/theme-engine` | BUILDS | active | dormant "editor needs only" | KEEP for contracts/schema (A5) | topology (borderline) | **CANONICAL (contracts)** |
| `legacy/` (Firebase backend) | NO (git-tracked at root) | not governed | archive-only | `git mv` → `docs/archive/` | topology (mis-located) | **DEAD** |
| `infrastructure/deployment/{kubernetes,helm}` | NO (no pipeline uses it) | cited by topology.json | not in target | `git mv` → `docs/archive/` | infra (fantasy) | **DEAD** |
| `config/runtime/production-topology.json` | n/a (metadata) | the fabricated "truth" | — | **REGENERATE from deploy matrix** | infra | **TRANSITIONAL → regenerate** |
| `AGENTS.md` | n/a (constitution) | **top-ranked, 9-app, stale (19 vs 91 migrations)** | superseded by V1 | **REGENERATE from V1 §6** | constitution | **TRANSITIONAL → regenerate** |
| 181 `scripts/validators/*.mjs` | runs in CI | enforce rejected end-state | — | **RETARGET to V1 / delete the ~70 fiction gates** | gov | **TRANSITIONAL → retarget** |
| `api.letbuyy.store` / `webhooks.letbuyy.store` vs `bff.letbuyy.com` | YES (live routes) | — | `letbuyy.com` canonical (§16 P0) | **migrate all to `letbuyy.com`** | infra (split-brain) | **TRANSITIONAL → migrate** |
| Hyperdrive (prod+staging bindings) | YES (bound; used on storefront read path only) | — | pooled DB (frozen diagram) | KEEP; widen usage as tenancy lands | infra (under-used) | **CANONICAL (under-utilized)** |
| `.github/workflows/deploy-staging.yml` + `staging-deploy.yml` | YES — **both fire on develop** | — | one staging pipeline | **collapse to one** | deploy (double-deploy race) | **LEGACY (one of two)** |

**Drift roll-up:** branch drift blocks **all 8 canonical runtimes**; deployment drift = **2 deployed-not-canonical apps to de-deploy (app-marketplace, developer-portal) + 1 to demote (theme-marketplace) + 1 ops portal to fold + 1 stub to complete (mobile-bff) + 1 dormant pkg wired in prod**; topology drift = **AGENTS 9-app ≠ V1 4-app**; infra drift = **domain split-brain + 6 fabricated "production" reserved services + a Helm fantasy + an under-used Hyperdrive**; governance drift = **181 validators enforcing the rejected end-state**.

---

## Wave-0 META — Deploy-Pipeline & Branch-Lag Fix (nothing ships without this)

This is the keystone. Every other decision in this document assumes a pipeline that can deploy the integration branch. Today it cannot.

### The blocker, precisely
- `production-deploy.yml:4-6` triggers **only** on `push: branches: [main]`. `main`'s tip is `4bcae19a`; the integration branch `stepup/main` is at `c4fc3cd6`, **30 commits ahead** (`git rev-list --count main..stepup/main` = 30). `develop` (staging trigger) is **18 behind** (TOPO-002).
- Consequence: all eight foundation waves (money fixes, tenant isolation, session security, theme governance) that `FOUNDATION_STEPUP_STATUS.md` marks "complete" are **undeployable**, and the **S0 `/api/auth/switch` account-takeover fix exists only as an uncommitted working-tree edit** (`git show HEAD:apps/identity-platform/src/app/api/auth/switch/route.ts` lacks the guard; working tree `route.ts:14-81` has it; the new test `…/__tests__/auth-switch-guard.test.ts` is untracked) — TOPO-001.
- Two staging pipelines (`deploy-staging.yml:3-5`, `staging-deploy.yml:3-6`) both fire on `push: develop` with divergent matrices → nondeterministic staging (TOPO-016).

### The fix (ordered, Wave-0)
1. **Commit the S0 fix + its test on `stepup/main`** immediately (TOPO-001). This must not sit uncommitted another day.
2. **Serialize the working tree** — the audit observed HEAD advancing mid-run and `.git/index.lock` contention (TOPO-039). Move concurrent automation to per-agent worktrees; require a clean-tree gate before any deploy.
3. **Execute `MERGE_RUNBOOK.md`**: fast-forward / merge `stepup/main` → `develop` (validate on staging) → `main`. After this, "complete" wave claims become *shipped* claims.
4. **Collapse the two staging workflows to one** (`staging-deploy.yml` retained with the full app matrix; `deploy-staging.yml` deleted or made `workflow_dispatch`-only) — removes the double-deploy race (TOPO-016).
5. **Add a branch-lag guard:** a CI check (or scheduled job) that fails/alerts when `main` is >N commits behind `develop`/`stepup/main`, so the meta-blocker can never silently re-accumulate.

> **Why Wave-0 and not Wave-1:** the governance retarget, the domain migration, the de-deploys — all of them are *changes that must reach production to matter*. A pipeline 30 commits behind turns each into a no-op. The branch-lag fix is the universal precondition; it is cheap (S) and it is the single highest-leverage action in the entire program.

---

## Governance Retargeting (theater → V1 conformance)

**Finding (ARCH-005/006, TOPO-024):** `scripts/validate-governance.mjs` runs **181 validator files**. No validator references `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` (grep in `scripts/`: zero). The suite (i) **requires the 9-app tier to exist** (`architecture-validator.mjs`, `governance-common.mjs:57-105`), (ii) **mandates rejected architecture** — replay/projection/saga/CQRS/CRDT/WAL/lease/fencing/split-brain/failover/multi-region certification (≈70 validators: `replay-*`, `projection-*`, `saga-recovery`, `crdt-convergence`, `distributed-*`, `failover-certification`, `partition-recovery`, `wal-*`, `lease-*`, `fencing-token`, `split-brain`, `convergence-*`, `durable-object-*`, `survivability-governance`), and (iii) the dead 6-package cluster's **only consumers are 4 validators** (`beta-readiness`, `distributed-runtime`, `projection-recovery`, `execution-layer`) — a *validator-liveness loop* that blocks deletion of the very code that should be deleted.

**The retarget (three buckets):**

| Bucket | Action | Validators (examples) |
|---|---|---|
| **DELETE — enforce the rejected end-state** | Remove from `validate-governance.mjs` and delete the file | the ~70 replay/projection/saga/CRDT/WAL/lease/fencing/split-brain/failover/multi-region/durable-object/convergence validators; the 4 that keep the dead cluster alive (`distributed-runtime-validator`, `projection-recovery-validator`, `execution-layer-validator`, and the dead-cluster checks in `beta-readiness`) |
| **RETARGET — point at V1 §6 reality** | Rewrite the canonical lists/asserts to V1's 4-app + 4-worker topology and the regenerated `production-topology.json` | `architecture-validator`, `governance-common`, `runtime-validator`, `runtime-topology-validator`, `runtime-manifest-validator`, `cloudflare-topology-validator`, `topology-drift-validator`, `mobile-topology-honesty-validator` |
| **KEEP — already enforce real invariants** | No change (these are the value the suite should be) | `foundation-antifabrication-gate`, `beta-readiness` (Turnstile chain), `tenant-isolation-validator`, `session-security-validator`, `compensation-governance-validator`, `single-writer-ownership-validator`, `route-line-count-validator`, `single-source-crypto/currency/date/slug`, `dev-auth-bypass-validator`, `migration-safety`, `wrangler-env`, `env-isolation`, `cookie-realm`, import/dependency hygiene |
| **ADD — close the real gaps V1 needs and nothing checks** | New validators | (1) **migration forward+rollback pairing ≥138** (closes TOPO-011/ARCH-014); (2) **deploy-manifest ↔ V1 topology contract** (deploy matrix must equal the V1 §6 production list); (3) **`letbuyy.store` ban in deploy config** (domain migration ratchet); (4) **commission-bps=0 / no payout fee deduction** (business-rule ratchet, A3); (5) **`production-topology.json` env must equal actual deploy targets** (anti-fabrication for topology metadata) |

**Sequencing:** the *retarget* and *add* buckets must land **before** the topology de-deploys (Wave-1/2), because today deleting `app-marketplace`/`developer-portal`/dead packages **fails CI** (the validators require them). Retarget first, then the deletions pass. Net: the suite shrinks from 181 fiction-heavy gates to a smaller set that enforces *deployed reality + V1 conformance* — the governance-economics fix (TOPO-024).

---

## Single-Constitution Resolution (regenerate AGENTS.md from V1)

**Finding (TOPO-003/021, ARCH-024):** `CLAUDE.md` ranks `AGENTS.md` first ("canonical engineering constitution… follow AGENTS.md first"). `AGENTS.md` is a **generated** snapshot (`scripts/generate-repository-intelligence.mjs`, 2026-06-08) that is **factually stale** — it claims "19 Supabase migrations" against the actual **91**, and encodes the 9-app/CQRS worldview. V1 declares itself FROZEN and supersedes the Freeze + Build Mission, but the deploy pipelines and validators implement the AGENTS canon. Result: **any agent entering the repo gets ≥4 conflicting answers to "what is the topology and who decides?"** and the only machine-enforced answer is the rejected one.

**The resolution:**
1. **Establish supremacy in the spec layer:** V1 (+ Freeze) is the single constitution. Demote `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` and the 21 `CODEX_*` mission/ledger/status docs to `docs/archive/`. The untracked authority claimants (`LETBUYY_FOUNDATION_AUTHORITY/LETBUYY_SINGLE_SOURCE_OF_TRUTH.md`, `FOUNDATION_AUTOPSY/`, etc., TOPO-020/§8) get committed-or-archived and each stamped *subordinate to V1*.
2. **Regenerate `AGENTS.md` from V1 §6:** update `scripts/generate-repository-intelligence.mjs` so its "Canonical Active Runtimes" emit the **4 apps + 4 workers + 6 reserved-empty** list (not 9 apps), strip the CQRS/projection/multi-region ownership prose from the per-runtime manifest template (TOPO-014/033), and fix the migration count. Re-run on **every topology-affecting merge** (CI step) so it can never re-stale (TOPO-021).
3. **Re-rank in `CLAUDE.md`:** make V1 the first-read constitution; `AGENTS.md` becomes the *generated map of V1*, not a competing authority. Add a V1-supremacy preamble referencing §18 sign-off.
4. **Enforce the no-new-architecture-doc rule (Principle 12)** with a root-doc budget validator (constitution + README + CLAUDE + current STATUS only); everything else lives under `docs/`.

This is **Wave-1/2** and is tightly coupled to the governance retarget — regenerating AGENTS without retargeting the validators leaves the machine still enforcing the old map; retargeting validators without regenerating AGENTS leaves the top-ranked doc lying. They ship together.

---

## Topology Convergence (per app/service → stay / freeze / delete)

Honoring the **A9** calls verbatim. Counts at the end.

### STAY — CANONICAL (8 runtimes + marketing + theme-engine contracts)
- **`services/api-gateway`** — the modular monolith; everything commerce. *(branch-blocked only.)*
- **`services/queue-workers`** — async jobs + outbox relay. (Move the outbox relay here from the api-gateway cron, ARCH-013 — a sibling-deliverable item; noted for topology completeness.)
- **`services/webhook-service`** — outbound webhooks. (Domain → `.com`, below.)
- **`services/mobile-bff`** — KEEP and **build composites** (next section).
- **`apps/merchant-control-plane`, `apps/storefront-runtime`, `apps/identity-platform`, `apps/mobile/merchant-app`** — the four V1 production apps. Storefront must **unwire `runtime-composition`** (A6) before that package can be deleted. Mobile must **delete the TD-5 parity catalog** (`lib/screens/parity/*` + `routes.dart:776`, A7) and gain a **release-signing pipeline** (debug-keystore today).
- **`apps/marketing-site`** — CANONICAL (A9: cheap, necessary).
- **`apps/platform-console`** — **the single canonical internal-ops surface** (A9: refund, maker-checker payout, dispute log, KYC queue). `platform-operations-portal` folds into it.
- **`packages/theme-engine`** — CANONICAL **for contracts/schema/validation** (A5); its renderer half resolves under the single-renderer decision (A5, sibling deliverable).

### FREEZE — rejected-for-envelope, keep empty seam (A9 R-11)
- **`apps/app-marketplace`** — **de-deploy** (remove from `production-deploy.yml:363-364` matrix). Keep the OAuth2/PKCE seam; no catalog/DX investment. Reconsider at ~5k merchants + developer demand.
- **`apps/developer-portal`** — **de-deploy** (remove from matrix `:365-366`; it also has no local `vercel.json` and is absent from staging — TOPO-033). FROZEN.
- **`apps/theme-marketplace`** — FROZEN: machinery is CANONICAL but the **catalog is dormant** (A5); de-deploy the storefront catalog until theme-marketplace demand exists, keep the package contracts.
- **`services/checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`, `search-service`** — **FROZEN-empty**, stay manifest-only. Capabilities live in the monolith + workers. *Remove them from `production-topology.json` (they are fabricated as "production" today).*
- **`apps/mobile/shopper-app`, `apps/mobile/operator-app`** — FROZEN-empty (already compliant).
- **`packages/search-core`** — FROZEN: un-leak from `api-types` (`src/index.ts:92` `export *`), keep dormant.

### DELETE — DEAD (no value; SAFE_DELETE or quarantine to docs/archive) (A9)
- **`packages/{projection-runtime, distributed-runtime, orchestration, extension-host, app-engine, application-services}`** — 13,345 LOC, **zero production importers**, validator-only liveness. SAFE_DELETE after the governance retarget removes the 4 validators that reference them. (`runtime-composition` is separate — DELETE_AFTER_MIGRATION once storefront is unwired, A6.)
- **`legacy/`** — `git mv legacy/ docs/archive/firebase-legacy/` (TOPO-019; precedent exists).
- **`infrastructure/deployment/{kubernetes,helm}`** — `git mv` → `docs/archive/` (TOPO-015; no pipeline uses it).
- **`apps/platform-operations-portal`** — **LEGACY → delete after consolidation** into `platform-console` (A9: two internal consoles is over-build).
- **`packages/dart/services`** — 8-LOC dead facade, not in merchant-app pubspec (TOPO-028); delete + remove workspace entry.

### LEGACY — superseded; freeze then delete after migration
- **`platform-operations-portal`** (above).
- **One of the two staging workflows** (Wave-0).
- The **21 `CODEX_*` docs + Freeze + superseded root reports** → `docs/archive/` (constitution resolution).

**Convergence counts:**
- **STAY (CANONICAL): 10** — `api-gateway`, `queue-workers`, `webhook-service`, `mobile-bff`, `merchant-control-plane`, `storefront-runtime`, `identity-platform`, `mobile/merchant-app`, `marketing-site`, `platform-console`. *(8-runtime V1 core + marketing + the one ops console.)*
- **FREEZE: 11** — `app-marketplace`, `developer-portal`, `theme-marketplace`, the **6** reserved services, `shopper-app`, `operator-app`. *(plus `search-core` package = 12 if counting the package.)*
- **DELETE/LEGACY: 9** — the **6** dead packages, `runtime-composition` (after unwire), `legacy/`, `infrastructure/{kubernetes,helm}`, `platform-operations-portal`, `dart/services`. *(net: 6 dead pkgs + runtime-composition + 2 archive moves + 1 LEGACY app + 1 dead Dart pkg.)*

> Net deploy estate after convergence: **8 production runtimes** (4 apps + 4 workers) + `marketing-site` + `platform-console` = **10 deployed units**, down from 13. `app-marketplace` + `developer-portal` + `theme-marketplace` leave the production matrix; one ops portal is folded; six reserved services and the dead-package cluster leave the build/governance surface.

---

## Domain Migration to `letbuyy.com`

**Finding (TOPO-006, ARCH-018):** production is **split-brain**. Workers `api-gateway` and `webhook-service` serve `api.letbuyy.store` (`api-gateway/wrangler.toml:215`) and `webhooks.letbuyy.store` (`webhook-service/wrangler.toml:75`), but `mobile-bff` already serves `bff.letbuyy.com` (`mobile-bff/wrangler.toml:93`). The Vercel deploy pins `NEXT_PUBLIC_APP_URL: https://letbuyy.store` and `…API_URL: https://api.letbuyy.store/v1` (`production-deploy.yml:394-403`). `infrastructure/dns/dns.tf` manages only the `letbuyy.store` zone. Memory + `_ANCHOR_DECISIONS_SPINE.md` A0: **`letbuyy.com` is canonical**; the migration stalled mid-flight (only mobile-bff moved).

**The migration (one coordinated PR, Wave-1):**
1. **Wrangler routes** → `api.letbuyy.com`, `webhooks.letbuyy.com` (+ staging equivalents); keep `bff.letbuyy.com`.
2. **Vercel env** in `production-deploy.yml` → all `*.letbuyy.com`; add `apps/developer-portal/vercel.json` is moot (that app is being de-deployed).
3. **DNS/IaC** → add `letbuyy.com` zone records (incl. the `checkout.letbuyy.com` record the hosted-checkout P0 needs — sibling A4 deliverable), keep `letbuyy.store` as **301 redirects** for SEO continuity (per `docs/seo` runbook).
4. **Cookies/CORS** → re-issue host-scoped on `.com`; verify identity-platform cookie realm (`cookie-realm-validator`) and CORS allow-lists.
5. **Add the `letbuyy.store`-ban validator** (governance ADD bucket) so the split-brain cannot recur.

**Risk:** cookie-domain / OAuth-redirect breakage during cutover (M). Mitigation: stage on `*.staging.letbuyy.com` first; dual-serve both apexes during a short overlap; 301s preserve SEO. **UNVERIFIED:** live DNS state of both apexes and which apex currently serves real traffic (needs DNS/HTTP probes — not performed from the offline tree).

---

## mobile-bff Composite Endpoints (stub → real fan-in BFF)

**Finding (TOPO-009, ARCH-019, PERF-001/002/003):** the deployed `mobile-bff` is a **305-line 1:1 pass-through** — `services/mobile-bff/src/index.ts:302` is `app.all('/v1/*', proxyToGateway)`; the only real endpoints are `/health` and `/v1/auth/mobile/turnstile/verify` (`:276-301`). V1 §1/§3 names it the composite/fan-in tier that "kills N+1." The consequence is **quantified**: the mobile dashboard makes ~7 serial round-trips (5 un-batched analytics calls, `analytics_service.dart:357-409`) = **1–2.5s blocking load on 4G** (PERF-001); the web dashboard fans out 6–8 leaf calls (PERF-002). The BFF exists, holds a production domain, and does none of the work it was carved out to do.

**The build (Wave-2/3):**
1. **`GET /v1/dashboard`** — one composite endpoint that fans in (server-side, against the gateway over the service binding `env.API_GATEWAY_SERVICE`) the 6–8 dashboard blocks + the 5 analytics rollups, returning one payload. Kills PERF-001 and PERF-002.
2. **`GET /v1/orders/:id/bundle`** — order + line items + fulfillment + customer in one round-trip (the next-worst N+1).
3. **Interim quick win** (ship in Wave-1, before the composite lands): `Future.wait` the 5 mobile analytics calls in `analytics_service.dart` so they parallelize (PERF-001 partial mitigation) — a Flutter-side change, no BFF dependency.
4. Keep the Turnstile verifier and the session-signing proxy; the composites sit alongside, not replacing, the allow-listed proxy.

**Why Wave-2/3, not earlier:** it depends on a deployable pipeline (Wave-0) and a settled domain/auth surface (Wave-1); it is a P1 product-performance item, not a correctness/security blocker. But it is the moment V1's "already-real satellite" premise stops being false.

---

## Infrastructure Drift (Hyperdrive, production-topology.json, Helm)

| Drift | Current State | Strategic State | Action / Wave |
|---|---|---|---|
| **`production-topology.json` fabrication** | All 6 reserved services declared `environment: "production"` with `deploymentManifests` → a Helm chart (`infrastructure/deployment/helm/letbuyy-production/Chart.yaml`) no workflow applies, `eventStore` via dead `distributed-runtime` (`production-topology.json:117-134`); `deployment-topology.json` gives them scaling/health specs. | **Regenerate both files from the actual deploy matrix.** Reserved roots = `reserved`, never `production`. Delete all Helm/K8s references. Add the anti-fabrication topology validator. | Wave-1/2 (with governance retarget) |
| **Helm/K8s fantasy** | `infrastructure/deployment/kubernetes/namespace.yaml` (16 CPU/64Gi/120 pods) + `helm/letbuyy-production/` for a platform that deploys **only** to Workers + Vercel; referenced by one validator (TOPO-015). | `git mv` → `docs/archive/`; remove from topology.json + validator. | Wave-2 |
| **Hyperdrive under-use** | Bound in **both** staging and production (`api-gateway/wrangler.toml:186-188, 303-305`) and used via `getPooledSql` — but **only on the storefront read path** (`routes/storefront.ts:639-665`). The frozen diagram shows the DB as "Hyperdrive pooled" for the whole monolith. | **KEEP** the bindings (correct infra). **Widen** pooled-SQL usage as the tenancy true-up lands (A2 needs per-tx `SET LOCAL` over a pooled connection that is RLS-subject, not blanket service_role) — Hyperdrive becomes the carrier for the claims→GUC bridge. | Wave-3+ (follows A2 tenancy) |
| **Plaintext SKIP sentinels in prod vars** | `[env.production.vars]` carries `SKIP_NEEDS_HUMAN_*` secret-shaped values (`api-gateway/wrangler.toml:253-262`: `TWILIO_ACCOUNT_SID`, `WHATSAPP_WEBHOOK_SECRET`, `AI_CREDIT_RAZORPAY_KEY_ID`) — honest + preflight-guarded but secret-shaped (TOPO-030). | Move secret-shaped keys to `wrangler secret`; vars hold non-secrets only. | Wave-2 (hygiene) |
| **Deferred-capability prod cron** | `hot-table-partition-maintenance.yml` runs monthly prod-DB DDL though V1 §5/§7 defers partitioning to P2 (TOPO-040). | Disable the schedule (keep `workflow_dispatch` plan-mode); revisit at the P2 trigger. | Wave-2 |
| **Binary repo bloat** | 176 tracked screenshots in `artifacts/` + 319 PNG visual baselines in `ui` (TOPO-034); founder marketing content untracked at root (TOPO-031). | Move operational proof to CI artifacts/LFS; founder content → content repo or `docs/marketing/`. | Wave-2 (hygiene) |

---

## Per-Decision Detail Blocks (all 13 fields)

### PLT-001 — Clear the branch lag / fix the deploy pipeline (META)
- **Current State:** `production-deploy.yml:4-6` triggers only on `main`; `main` is 30 commits behind `stepup/main`; the S0 auth-switch fix is uncommitted; two staging workflows race on `develop`.
- **Strategic State:** `main` fast-forwarded to the integration branch; S0 fix committed + cherry-picked; one staging pipeline; a branch-lag guard in CI.
- **Reasoning:** Nothing else in this program reaches production until the deploy branch is current. It is also a live S0 (account takeover) gated behind the same lag.
- **Migration Plan:** Commit S0 fix+test → execute `MERGE_RUNBOOK.md` (stepup→develop→main, staging-validated) → delete/dispatch-gate `deploy-staging.yml` → add branch-lag guard.
- **Validation Plan:** Staging smoke on `develop` deploy; production smoke post-`main` merge; confirm `git rev-list --count main..stepup/main` = 0.
- **Deletion Plan:** Delete the redundant staging workflow (`deploy-staging.yml`).
- **Rollback Plan:** Cloudflare `wrangler rollback` per worker + Vercel instant-rollback to the prior deployment; revert the merge commit if the smoke fails.
- **Risk Level:** HIGH (first deploy of 30 commits of changes into prod).
- **Complexity:** S (process), but high-stakes.
- **Timeline:** **Wave-0**.
- **Owner:** Release Eng / Platform.
- **Dependencies:** Working-tree serialization (PLT-013); `MERGE_RUNBOOK.md`.
- **Success Criteria:** `main` == integration branch; production serves post-wave code; S0 fix live; single deterministic staging deploy; branch-lag guard green.

### PLT-002 — Regenerate AGENTS.md from V1 + re-rank CLAUDE.md
- **Current State:** `AGENTS.md` is the top-ranked constitution, generated, stale (19 vs 91 migrations), encoding the 9-app/CQRS worldview; `CLAUDE.md` ranks it first; no validator reads V1.
- **Strategic State:** V1 is the single constitution; `AGENTS.md` is its generated map (4 apps + 4 workers + 6 reserved-empty), regenerated on every topology merge; `CLAUDE.md` reads V1 first.
- **Reasoning:** A machine-enforced stale snapshot steers every agent back to the rejected architecture (TOPO-003/021, ARCH-005/024).
- **Migration Plan:** Update `scripts/generate-repository-intelligence.mjs` canonical-runtime emitters + manifest template; regenerate; rewrite `CLAUDE.md` ranking + V1-supremacy preamble; archive Freeze + 21 CODEX docs + untracked authority sets.
- **Validation Plan:** Regenerated `AGENTS.md` lists exactly the V1 topology; migration count correct; root-doc-budget validator green.
- **Deletion Plan:** `docs/archive/` for Freeze, CODEX triples, superseded authority docs.
- **Rollback Plan:** Git revert the generator + AGENTS commit; the old AGENTS is recoverable from history.
- **Risk Level:** LOW (docs/generator).
- **Complexity:** M.
- **Timeline:** **Wave-1/2** (with PLT-003).
- **Owner:** ABR / Governance.
- **Dependencies:** PLT-003 (validators must move together).
- **Success Criteria:** One constitution; agents entering the repo get the V1 answer; AGENTS can't re-stale (CI regen).

### PLT-003 — Retarget the 181-validator suite to V1
- **Current State:** 181 validators; ~70 enforce rejected CQRS/replay/multi-region; the canonical-list validators require the 9-app tier; 4 validators keep the dead package cluster alive; none enforce V1 topology, rollback pairing, or business rules.
- **Strategic State:** A smaller suite that enforces deployed reality + V1 conformance: DELETE the fiction gates, RETARGET the topology gates to V1 §6, KEEP the safety lanes, ADD the 5 new gates (rollback pairing; deploy-manifest↔V1 contract; `letbuyy.store` ban; commission-bps=0; topology-json anti-fabrication).
- **Reasoning:** The machine currently certifies the wrong architecture and blocks the deletions V1 requires (ARCH-006, TOPO-024).
- **Migration Plan:** Edit `validate-governance.mjs` to drop the ~70 + 4 dead-cluster validators; rewrite `governance-common.mjs`/`architecture-validator`/`runtime-topology-validator` lists to V1; author the 5 new validators.
- **Validation Plan:** `node scripts/validate-governance.mjs` passes against the V1 estate; deletions in PLT-004/005 no longer fail CI; the 5 new gates catch seeded violations.
- **Deletion Plan:** Delete the ~70 fiction validator files + the 4 dead-cluster validators.
- **Rollback Plan:** Git revert; validators are pure scripts, no runtime state.
- **Risk Level:** MEDIUM (CI gate change; risk of dropping a real check).
- **Complexity:** L.
- **Timeline:** **Wave-1/2**, *before* the topology deletions.
- **Owner:** Governance / Platform.
- **Dependencies:** PLT-002 (constitution); must precede PLT-004/005.
- **Success Criteria:** CI enforces V1 not the end-state; dead-package deletion passes; real invariants still gated.

### PLT-004 — Freeze + de-deploy app-marketplace and developer-portal (R-11)
- **Current State:** Both deploy to production (`production-deploy.yml:363-366`); `app-marketplace` is 19,557 LOC; `developer-portal` has no local `vercel.json` and is absent from staging; V1 R-11 rejects the marketplace/ecosystem tier "now."
- **Strategic State:** FROZEN — removed from the production matrix; OAuth2/PKCE seam preserved; no catalog/DX investment; reconsider at ~5k merchants + developer demand.
- **Reasoning:** 24k+ LOC of rejected surface carries production attack/maintenance/cost for "an empty mall" (TOPO-004, ARCH R-11).
- **Migration Plan:** Remove both matrix entries; (optionally retain in staging behind dispatch); ensure the OAuth2/PKCE seam in identity-platform is untouched.
- **Validation Plan:** Deploy-manifest↔V1 contract validator (PLT-003) confirms they are absent from prod; identity OAuth2 seam tests green.
- **Deletion Plan:** Not deleted (FROZEN keeps the seam); source remains, unbuilt-for-prod. Quarantine option: move to `apps/_frozen/` if build-cost matters.
- **Rollback Plan:** Re-add the two matrix lines.
- **Risk Level:** LOW (removing deploy targets; no merchant depends on them).
- **Complexity:** S.
- **Timeline:** **Wave-2** (after governance retarget so CI allows it).
- **Owner:** Platform.
- **Dependencies:** PLT-003.
- **Success Criteria:** Prod estate no longer ships the marketplace tier; seam intact; CI green.

### PLT-005 — Delete the dead 6-package CQRS/saga/extension cluster
- **Current State:** `packages/{app-engine, application-services, extension-host, projection-runtime, orchestration, distributed-runtime}` = 13,345 LOC, zero production importers, kept alive only by 4 validators; in `pnpm-workspace.yaml` + CI build.
- **Strategic State:** DEAD → SAFE_DELETE (or `docs/archive/legacy-packages`); removed from workspace + tsconfig; the 4 validators removed (PLT-003).
- **Reasoning:** R-4/R-5/R-11 rejections; CI builds dead architecture forever; misleads every audit (TOPO-008, ARCH-026).
- **Migration Plan:** After PLT-003 drops the 4 validators, delete the 6 dirs; remove from `pnpm-workspace.yaml` + `tsconfig.workspace`; rebuild.
- **Validation Plan:** `pnpm turbo build` across remaining workspaces passes; no `@letbuyy/{app-engine,…}` import errors anywhere.
- **Deletion Plan:** This *is* the deletion. (`runtime-composition` is separate — PLT-006.)
- **Rollback Plan:** Git revert restores the packages + workspace entries.
- **Risk Level:** LOW (zero importers — verified by grep).
- **Complexity:** M.
- **Timeline:** **Wave-2** (after PLT-003).
- **Owner:** Platform.
- **Dependencies:** PLT-003 (validators must go first).
- **Success Criteria:** ~13.3k LOC gone; CI faster; no broken imports.

### PLT-006 — Unwire runtime-composition from the storefront, then delete
- **Current State:** Dormant-listed `runtime-composition` is **wired into production**: `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:7`, `services/api-gateway/src/execution/queue-execution.adapter.ts:16`, `services/queue-workers/src/platform-queue-consumer.ts:16` (TOPO-005).
- **Strategic State:** DELETE_AFTER_MIGRATION — move the storefront-query-projection logic into the storefront/monolith, then delete the package.
- **Reasoning:** The freeze's "do not wire as active topology" is fiction for this package; deleting the dead cluster is blocked while it's load-bearing (A6, TOPO-005).
- **Migration Plan:** Inline `composeStorefrontRuntimeProjection` into the storefront page (and the two adapter call sites) as plain query functions; remove the dependency; delete the package.
- **Validation Plan:** Storefront SSR/ISR render unchanged (E2E smoke on a seeded tenant); contract test on the storefront read path.
- **Deletion Plan:** Delete `packages/runtime-composition` + workspace entry after unwire.
- **Rollback Plan:** Git revert; re-add dependency.
- **Risk Level:** MEDIUM (touches the live storefront read path).
- **Complexity:** M.
- **Timeline:** **Wave-3** (after storefront work in A6).
- **Owner:** Storefront / Platform.
- **Dependencies:** A6 storefront decisions; PLT-005 ordering.
- **Success Criteria:** Storefront unchanged; package deleted; dormant list no longer fiction.

### PLT-007 — Consolidate the two internal-ops portals into platform-console
- **Current State:** `platform-console` and `platform-operations-portal` both deploy to prod (`:367-370`), both self-described "scaffold"; V1 wants ONE thin ops sliver (A9).
- **Strategic State:** `platform-console` = the single canonical ops surface (refund, maker-checker payout, dispute log, KYC queue); `platform-operations-portal` = LEGACY → deleted after its sliver features fold in.
- **Reasoning:** Two privileged admin surfaces (10k LOC) beyond ratified scope expand the staff-attack surface (TOPO-023, ARCH-029).
- **Migration Plan:** Port any operations-portal-only sliver features into console; remove operations-portal from the matrix; delete it; put console behind SSO/allowlist.
- **Validation Plan:** RBAC + SSO tests on console; the four sliver flows work; operations-portal absent from prod.
- **Deletion Plan:** Delete `apps/platform-operations-portal` after feature-fold.
- **Rollback Plan:** Git revert; re-add matrix entry.
- **Risk Level:** MEDIUM (staff workflows).
- **Complexity:** M.
- **Timeline:** **Wave-2/3**.
- **Owner:** Internal-OS / Platform.
- **Dependencies:** PLT-003; internal-OS ownership review.
- **Success Criteria:** One ops console in prod, SSO-gated; no lost sliver capability.

### PLT-008 — Migrate all domains to letbuyy.com
*(Full block summarized in the Domain Migration section.)*
- **Current State:** split-brain `api.letbuyy.store` + `webhooks.letbuyy.store` vs `bff.letbuyy.com`; Vercel env pinned `.store`; DNS manages only `.store`.
- **Strategic State:** all production on `letbuyy.com`; `.store` → 301s; `letbuyy.store` banned in deploy config by validator.
- **Reasoning:** §16 P0; cookies/CORS/SEO split across two apexes (TOPO-006, ARCH-018).
- **Migration Plan:** one PR — wrangler routes + workflow envs + DNS/IaC + cookie/CORS re-scope; stage on `*.staging.letbuyy.com` first; dual-serve overlap.
- **Validation Plan:** staging smoke on `.com`; cookie-realm + CORS tests; 301 checks; the `.store`-ban validator green.
- **Deletion Plan:** Retire `.store` routes after the overlap window (keep 301s).
- **Rollback Plan:** Revert routes/env; both apexes were dual-served during cutover.
- **Risk Level:** MEDIUM (cookie/OAuth-redirect breakage).
- **Complexity:** M.
- **Timeline:** **Wave-1**.
- **Owner:** Platform / Infra.
- **Dependencies:** PLT-001 (deployable pipeline); identity cookie-realm (A1).
- **Success Criteria:** one canonical apex; no auth/SEO regression; split-brain validator-prevented. **UNVERIFIED:** live apex traffic state.

### PLT-009 — Build mobile-bff composite endpoints
*(Full block in the mobile-bff section.)*
- **Current State:** 305-line pass-through (`index.ts:302`), health + Turnstile only; mobile dashboard = ~7 serial round-trips (PERF-001).
- **Strategic State:** real composite/fan-in BFF — `GET /v1/dashboard`, `GET /v1/orders/:id/bundle` — collapsing the N+1.
- **Reasoning:** V1 §1/§3 raison d'être; quantified 1–2.5s mobile dashboard cost (TOPO-009, ARCH-019, PERF-001/002/003).
- **Migration Plan:** Wave-1 interim `Future.wait` the 5 analytics calls; Wave-2/3 build the composites against the service binding.
- **Validation Plan:** Contract test (composite payload shape) + E2E (mobile dashboard one round-trip) + latency check vs the ~7-call baseline.
- **Deletion Plan:** n/a (additive); the allow-listed proxy stays.
- **Rollback Plan:** Feature-flag the composite route off → clients fall back to leaf calls.
- **Risk Level:** LOW (additive endpoints).
- **Complexity:** M (L for full fan-in coverage).
- **Timeline:** **Wave-2/3** (interim Wave-1).
- **Owner:** Mobile-BFF / Mobile.
- **Dependencies:** PLT-001; PLT-008 (settled domain/auth).
- **Success Criteria:** dashboard load one round-trip; PERF-001/002 closed; BFF premise true.

### PLT-010 — Regenerate production-topology.json + archive Helm/K8s
- **Current State:** topology.json declares 6 reserved services `environment: "production"` with a Helm chart no pipeline uses + dead-package event store; K8s/Helm fantasy infra (TOPO-013/015).
- **Strategic State:** topology.json regenerated from the actual deploy matrix; reserved roots = `reserved`; Helm/K8s archived; anti-fabrication topology validator added.
- **Reasoning:** The machine-readable "production truth" is fabricated; certifications built on it are unsound (TOPO-013).
- **Migration Plan:** Regenerate both topology JSONs from `production-deploy.yml`; strip Helm refs; `git mv infrastructure/deployment/{kubernetes,helm}` → `docs/archive/`.
- **Validation Plan:** topology.json env == deploy targets (new validator); no `helm`/`kubectl` refs outside archive.
- **Deletion Plan:** Archive (not delete) the IaC fantasy.
- **Rollback Plan:** Git revert.
- **Risk Level:** LOW (metadata + unused infra).
- **Complexity:** S.
- **Timeline:** **Wave-1/2** (with PLT-003).
- **Owner:** Governance / Infra.
- **Dependencies:** PLT-003.
- **Success Criteria:** topology metadata matches reality; no fabricated production nodes.

### PLT-011 — Demote theme-marketplace to FROZEN catalog
- **Current State:** deploys to prod (`:361-362`); A5 says the catalog is dormant until theme-marketplace demand.
- **Strategic State:** FROZEN — machinery/package CANONICAL, catalog de-deployed; theme-engine contracts kept.
- **Reasoning:** No 3rd-party theme demand in the 100→10k envelope (A5/A9).
- **Migration Plan:** Remove from prod matrix; keep `packages/theme-engine` contracts; reconsider at theme-marketplace trigger.
- **Validation Plan:** Deploy-manifest↔V1 validator; theme editor (the differentiator) unaffected.
- **Deletion Plan:** Not deleted (FROZEN).
- **Rollback Plan:** Re-add matrix entry.
- **Risk Level:** LOW.
- **Complexity:** S.
- **Timeline:** **Wave-2**.
- **Owner:** Themes / Platform.
- **Dependencies:** PLT-003; A5.
- **Success Criteria:** prod no longer ships the theme catalog; editor + contracts intact.

### PLT-012 — Archive legacy/, fix mobile release pipeline, delete TD-5, un-leak search-core, delete dart/services (hygiene bundle)
- **Current State:** `legacy/` Firebase backend git-tracked at root (TOPO-019); mobile builds debug-only, no signing/store pipeline (TOPO; `ci.yml:218,222`); TD-5 parity catalog routed (`routes.dart:776`); `search-core` `export *` leak (`api-types:92`); `dart/services` dead facade.
- **Strategic State:** `legacy/` → `docs/archive/`; mobile gains release signing + store upload; TD-5 deleted; search-core un-leaked; dart/services deleted.
- **Reasoning:** Archive policy + A7 (delete TD-5, fix signing) + dormant-leak hygiene.
- **Migration Plan:** `git mv legacy/`; add fastlane/release workflow with signing secrets; delete parity files + route case; replace `export *` with explicit exports; delete dart/services + workspace entry.
- **Validation Plan:** `flutter analyze`/`flutter test` green post-TD-5; release build signs; dead-source validators green; api-types consumers compile.
- **Deletion Plan:** TD-5 files, dart/services.
- **Rollback Plan:** Git revert per item.
- **Risk Level:** LOW.
- **Complexity:** S (M for the signing pipeline).
- **Timeline:** **Wave-2** (signing can be Wave-1 if mobile beta is gated on it).
- **Owner:** Mobile / Platform.
- **Dependencies:** PLT-003 (dead-source validators).
- **Success Criteria:** clean root; signed mobile releases; no TD-5; no dormant leaks.

### PLT-013 — Serialize the working tree (process)
- **Current State:** concurrent automation advanced HEAD mid-audit; `.git/index.lock` contention; the S0 fix sat uncommitted as a direct consequence (TOPO-039/001).
- **Strategic State:** per-agent worktrees / branch locks; clean-tree gate before deploy/certification.
- **Reasoning:** Unstable working tree is how the S0 fix became undeployable; it undermines every audit and deploy.
- **Migration Plan:** Adopt `git worktree` per agent; add a clean-tree precondition to the deploy and certification workflows.
- **Validation Plan:** No `.git/index.lock` contention; deploys refuse a dirty tree.
- **Deletion Plan:** n/a.
- **Rollback Plan:** n/a (process).
- **Risk Level:** LOW.
- **Complexity:** S.
- **Timeline:** **Wave-0** (precondition to PLT-001).
- **Owner:** Release Eng.
- **Dependencies:** none.
- **Success Criteria:** stable, serializable tree; fixes can't strand uncommitted.

---

## Test & Validation Plan (per change-class)

For each topology/deploy change, the following layers apply (omit a layer only where it is genuinely n/a, e.g. unit tests for a config-only move):

| Layer | What it proves | Applied to |
|---|---|---|
| **Unit** | Logic of any new code (e.g. BFF composite handler; new query functions when unwiring runtime-composition) | PLT-006, PLT-009 |
| **Integration** | New code works against the real gateway/DB (composite endpoint fans in correctly; storefront query path post-unwire) | PLT-006, PLT-009 |
| **Contract (deploy-manifest ↔ actual)** | The **new validator**: `production-deploy.yml` matrix == V1 §6 production list; `production-topology.json` env == actual deploy targets; `wrangler.toml` routes == `letbuyy.com` | PLT-003, PLT-004, PLT-008, PLT-010, PLT-011 |
| **E2E (deploy to staging, smoke)** | The pipeline actually deploys the integration branch to staging and the app boots + serves; domain cutover works on `*.staging.letbuyy.com`; mobile dashboard renders | PLT-001, PLT-008, PLT-009 |
| **Governance-validator (retargeted to V1)** | `node scripts/validate-governance.mjs` passes against the V1 estate; the deletions no longer fail CI; the 5 new gates catch seeded violations | PLT-002, PLT-003, PLT-004, PLT-005, PLT-010 |
| **Regression** | No prod runtime behavior changed where none was intended (storefront SSR, identity auth, webhook delivery) after de-deploys/unwires | PLT-004, PLT-006, PLT-007, PLT-011 |
| **Rollback validation** | `wrangler rollback` (workers) + Vercel instant-rollback (apps) restore the prior deployment; reverting a topology PR restores the matrix | PLT-001, PLT-008 (rehearse), all de-deploys |
| **Deletion validation** | After deleting the dead cluster / runtime-composition / dart-services, `pnpm turbo build` passes and no `@letbuyy/*` import is broken; after TD-5 deletion `flutter analyze` is clean | PLT-005, PLT-006, PLT-012 |

**Order-of-operations rule:** Governance-validator retarget (PLT-003) and its E2E/contract proofs must be **green before** the deletion-validation work for PLT-004/005/011 runs — otherwise the deletions fail the un-retargeted CI.

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| PR-1 | First `main` merge ships 30 commits of change → a prod regression slips through | Med | High | Stage on `develop` first; full smoke; rehearsed `wrangler`/Vercel rollback; merge during low traffic | Release Eng |
| PR-2 | S0 auth-takeover stays exploitable until the merge lands | High (today) | Critical | Commit + cherry-pick the fix to `main`/`develop` in Wave-0 ahead of the full merge; treat as a security hotfix | Identity / Release |
| PR-3 | Domain cutover breaks cookies / OAuth redirects → users logged out / login loops | Med | High | Stage `.com` first; dual-serve overlap; cookie-realm + CORS tests; 301s; canary | Platform / Identity |
| PR-4 | Governance retarget drops a validator that was catching a real defect | Low-Med | Med | Bucket explicitly (KEEP list is enumerated); diff CI results pre/post; keep the safety lanes untouched | Governance |
| PR-5 | Deleting the dead cluster breaks a hidden transitive import | Low | Med | Grep proved zero importers; `pnpm turbo build` gate; do it after PLT-003; revert is trivial | Platform |
| PR-6 | Unwiring runtime-composition changes storefront render subtly | Med | High | Inline as equivalent query fns; E2E + visual baseline diff; Wave-3 after A6 | Storefront |
| PR-7 | De-deploying app-marketplace/developer-portal removes a surface someone is mid-building on | Low | Med | FROZEN (source kept, seam intact); ARB sign-off; staging retained behind dispatch | Platform / ABR |
| PR-8 | Consolidating ops portals loses a staff workflow | Med | Med | Feature-parity audit before deleting operations-portal; SSO/allowlist on console | Internal-OS |
| PR-9 | Branch lag silently re-accumulates after the fix | Med | High | Branch-lag CI guard (PLT-001 step 5); worktree serialization (PLT-013) | Release Eng |
| PR-10 | Live infra state differs from repo config (DNS, secrets, which apex serves traffic) — **UNVERIFIED** | Unknown | Med-High | DNS/HTTP probes + Cloudflare/Vercel dashboard reconciliation before cutover; do not assume repo == live | Infra |

---

## Platform Simplification Findings / Actions

| ID | Component | Decision | Classification | Wave | Risk | Evidence (path:line) |
|---|---|---|---|---|---|---|
| PLT-001 | Deploy pipeline / `main` branch lag | Fast-forward `main`; commit S0 fix; collapse staging to one; add branch-lag guard | TRANSITIONAL→fix | 0 (META) | High | `.github/workflows/production-deploy.yml:4-6`; `git rev-list --count main..stepup/main`=30; `git show HEAD:apps/identity-platform/src/app/api/auth/switch/route.ts` vs working tree `route.ts:14-81`; `deploy-staging.yml:3-5` + `staging-deploy.yml:3-6` |
| PLT-002 | `AGENTS.md` + `CLAUDE.md` constitution | Regenerate AGENTS from V1 §6; re-rank CLAUDE to V1-first; archive Freeze + CODEX | TRANSITIONAL→regenerate | 1–2 | Low | `AGENTS.md` (9-app, "19 migrations"); `CLAUDE.md` ("AGENTS.md… first"); `scripts/generate-repository-intelligence.mjs`; `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md:130-144` |
| PLT-003 | 181 validators / `validate-governance.mjs` | Delete ~70 fiction gates + 4 dead-cluster gates; retarget topology gates to V1; add 5 new gates | TRANSITIONAL→retarget | 1–2 | Med | `scripts/validators/*.mjs` (181 files, grep); `governance-common.mjs:57-105`; `architecture-validator.mjs:73-76`; `runtime-topology-validator.mjs:58-59` |
| PLT-004 | `apps/app-marketplace`, `apps/developer-portal` | De-deploy (remove from prod matrix); keep OAuth2/PKCE seam | FROZEN | 2 | Low | `production-deploy.yml:363-366`; V1 §4 R-11; `apps/app-marketplace` 19,557 LOC |
| PLT-005 | `packages/{app-engine, application-services, extension-host, projection-runtime, orchestration, distributed-runtime}` | SAFE_DELETE (after PLT-003) | DEAD | 2 | Low | importer grep → only `scripts/validators/{beta-readiness,distributed-runtime,projection-recovery,execution-layer}-validator.mjs`; `pnpm-workspace.yaml` |
| PLT-006 | `packages/runtime-composition` | Unwire from storefront/adapters, then delete | DEAD (after unwire) | 3 | Med | `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:7`; `services/api-gateway/src/execution/queue-execution.adapter.ts:16`; `services/queue-workers/src/platform-queue-consumer.ts:16` |
| PLT-007 | `apps/platform-console` + `apps/platform-operations-portal` | Keep console (SSO-gated) as the one ops surface; fold + delete operations-portal | CANONICAL (console) / LEGACY (portal) | 2–3 | Med | `production-deploy.yml:367-370`; AGENTS descriptions ("scaffold"); V1 Appendix B #15 |
| PLT-008 | Production domains | Migrate `api`/`webhooks` to `letbuyy.com`; 301 `.store`; add `.store`-ban validator | TRANSITIONAL→migrate | 1 | Med | `api-gateway/wrangler.toml:215`; `webhook-service/wrangler.toml:75`; `mobile-bff/wrangler.toml:93`; `production-deploy.yml:394-403`; `infrastructure/dns/dns.tf` |
| PLT-009 | `services/mobile-bff` | Build composite endpoints (`/v1/dashboard`, order bundle); interim `Future.wait` analytics | CANONICAL (complete it) | 2–3 (interim 1) | Low | `services/mobile-bff/src/index.ts:302` (`app.all('/v1/*', proxyToGateway)`), `:276-301`; `apps/mobile/merchant-app/lib/services/analytics_service.dart:357-409` |
| PLT-010 | `config/runtime/production-topology.json` + `infrastructure/deployment/{kubernetes,helm}` | Regenerate topology from deploy matrix; archive Helm/K8s; anti-fabrication validator | TRANSITIONAL→regenerate / DEAD | 1–2 | Low | `production-topology.json:117-134`; `infrastructure/deployment/helm/letbuyy-production/Chart.yaml`; `deployment-topology.json` |
| PLT-011 | `apps/theme-marketplace` | De-deploy catalog (FROZEN); keep theme-engine contracts | FROZEN | 2 | Low | `production-deploy.yml:361-362`; A5; `packages/theme-engine` |
| PLT-012 | `legacy/`, mobile release pipeline, TD-5, `search-core` leak, `dart/services` | Archive legacy; add signing; delete TD-5 + dart/services; un-leak search-core | DEAD / fix | 1–2 | Low | `legacy/` (TOPO-019); `ci.yml:218,222`; `apps/mobile/merchant-app/lib/app/routes.dart:776`; `packages/typescript/api-types/src/index.ts:92`; `packages/dart/services` |
| PLT-013 | Working-tree process | Per-agent worktrees + clean-tree deploy gate | TRANSITIONAL→fix | 0 | Low | HEAD `fcae9f43`→`c4fc3cd6` mid-audit; `.git/index.lock` contention (TOPO-039) |
| PLT-014 | Reserved services (6) | Keep manifest-only; remove from topology.json "production" | FROZEN-empty | 1–2 | Low | `services/{checkout-runtime,event-bus,notification-service,analytics-pipeline,media-service,search-service}` (2 files each); `production-topology.json:117-134` |
| PLT-015 | Hyperdrive bindings | Keep; widen pooled-SQL usage as A2 tenancy lands | CANONICAL (under-utilized) | 3+ | Low | `api-gateway/wrangler.toml:186-188,303-305`; `routes/storefront.ts:639-665` |
| PLT-016 | `hot-table-partition-maintenance.yml` cron | Disable schedule (keep dispatch plan-mode) | TRANSITIONAL→defer | 2 | Low | `.github/workflows/hot-table-partition-maintenance.yml:4-6` (`cron "15 2 1 * *"`); V1 §5/§7 |
| PLT-017 | Plaintext SKIP secrets in prod vars | Move secret-shaped keys to `wrangler secret` | TRANSITIONAL→hygiene | 2 | Low | `api-gateway/wrangler.toml:253-262` |
| PLT-018 | Migrations 138/140/157 rollback gap + dup prefix 129 | Author 3 rollbacks; renumber dup; add pairing validator | TRANSITIONAL→fix | 1–2 | Low | `database/supabase/rollback/` (21 vs 24 ≥138); `129_internal_os_executive_analytics_rollups.sql` + `129_mobile_customer_segments.sql` |

---

*End of Part 9 — Platform Simplification & Deployment-Reality Plan. Evidence pinned at `stepup/main` @ `c4fc3cd6`, working tree dirty, 2026-06-10. Money/identity/tenancy/theme/UI internals are governed by the A1–A8 sibling deliverables; this document owns topology, deploy, governance-retarget, constitution, domain, and BFF-transport convergence only.*
