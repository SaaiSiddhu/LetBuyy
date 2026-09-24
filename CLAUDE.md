# LetBuyy AI Operating Context

`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` is supreme law for this repository. Claude, Codex, humans, and other automation must follow the Constitution first, then root `AGENTS.md` (the promoted `LETBUYY_AGENTS_V2` operating rulebook), then the relevant local `AGENTS.md`, then the canonical governance rewrite documents.

## Operating skill — `/letbuyy` (tracked, adopted 2026-09-04)

`.claude/skills/letbuyy/SKILL.md` is the single operating skill for every role in this repository — CTO review and gating, phase planning, Worker implementation, the security / UI-UX / feedback lanes, merge, promotion and the self-paced run loop. Every AI coding tool and every human session follows it. It is subordinate to the Constitution → `AGENTS.md` chain above and never overrides it; where they disagree the skill is wrong and must be fixed. **Single agent, always** (no subagents, worktree agents or workflow orchestration — `PROMPTS.md` records why). Branch model (OWNER_DECISION D-BRANCH, 2026-09-04): `letbuyy/<phase>` → `--no-ff` merge into `develop` inside the `develop` worktree → fast-forward-only promotion to `staging` → `main`, with the owner's word in the same message before any push to `staging` or `main`; `stepup/main` is a preserved alias and is never advanced. The only branch-disposition authority is `docs/active/BRANCH_DISPOSITIONS.md` (the row is the claim and the branch's first commit), enforced by `scripts/validators/branch-dispositions-validator.mjs` in the gate lane. `production-deploy.yml` and `deploy-staging.yml` are `workflow_dispatch`-only until a DEPLOY-1 phase retargets them with verified cloud targets (OWNER_DECISION D-DEPLOY). Run-state for the loop lives in `~/.letbuyy/run/`, never in the tree; generated prompts and contracts never enter the tree. Commit identity is an open owner decision (D-ID) recorded in the skill's `references/decisions.md`.

## LetBuyy Durable Architecture Memory

> Summarizes the Constitution for fast recall. It does **not** amend or override it. On any conflict: Constitution → root `AGENTS.md` → local `AGENTS.md` → `LETBUYY_CANONICAL_SYSTEMS.md` → this section.

**Product.** India-first multi-tenant commerce OS: storefronts, products, collections, inventory, cart, checkout, orders, prepaid + COD, refunds, shipping, GST invoices, customers, themes, notifications, analytics, merchant operations. The database tenant root is `sites`; **`site_id` is the canonical tenant boundary**. "Store" is a product and URL term only — never create a competing `stores` table. LetBuyy is merchant infrastructure, **not a money custodian**: never hold merchant funds; never introduce a GMV or transaction fee. The fee is **0%, permanent**.

**Canonical topology — exactly 8 active runtimes.**

| Runtime | Owns |
|---|---|
| `services/api-gateway` | Hono/Cloudflare Worker modular monolith — synchronous commerce: products, inventory, cart, checkout, orders, payments, discounts, GST, shipping, settlement, customers, billing, analytics reads |
| `services/queue-workers` | Asynchronous execution — transactional-outbox relay, notifications, reconciliation, settlements, abandoned carts, rollups, sweepers |
| `services/mobile-bff` | Composite/fan-in BFF for the Flutter merchant application |
| `apps/identity-platform` | **Sole canonical asymmetric token issuer** for the customer, merchant and operator realms; realm privileges strictly separated |
| `services/webhook-service` | Provider callback ingress + signed, deduplicated outbound webhooks |
| `apps/customer_web` (formerly `apps/storefront-runtime`) | Buyer storefront, Liquid-first renderer, hosted `checkout.letbuyy.com` origin |
| `apps/merchant_web` (formerly `apps/merchant-control-plane`) | Merchant web operating system |
| `apps/marketing-site` | Public marketing and pricing surface |

Supporting, **non-extractable** surfaces: `apps/merchant_app` (formerly `apps/mobile/merchant-app`), `apps/admin_web` (formerly `apps/platform-console`) — they authorize no further backend extraction. Reserved services and mobile roots stay **empty** until a named trigger and human approval. Frozen/deprecated marketplace, portal and duplicate roots are **never** production topology. Apps must not import apps; services must not import apps; packages must not import apps or services — cross-runtime behavior moves through contracts, APIs, queues or public package exports.

**Design law.** Modular monolith with explicit internal domain boundaries. Never create a microservice merely to make a domain look scalable — a domain is extracted only after measured pressure proves independent scaling or isolation is necessary **and** the ARB approves. The synchronous path performs only work required for a correct result; email, WhatsApp, webhooks, analytics and rollups run asynchronously. Runtime instances are **stateless**: process memory, Cloudflare isolate globals, KV, caches, D1 and Durable Objects must never become an accidental second authority for orders, money, inventory or tenant data. **Postgres is the canonical transactional commerce authority**; caches and projections are disposable and rebuildable.

**Commerce, money and tenancy invariants.**

- Recompute all prices, discounts, taxes, shipping, totals and entitlements **server-side**. Never trust client totals, tenant IDs, payment status, provider names or inventory decisions.
- Every externally retryable mutation requires **idempotency**.
- Money uses **one canonical double-entry ledger**; every transaction must balance. Payment and refund state changes must verify provider evidence, reject replay and remain reconcilable. **A client-supplied payment identifier is never sufficient proof of payment.**
- Business mutation **and** outbox-event creation must be **atomic in one database transaction**. Queue and webhook consumers must be idempotent, retry-safe and DLQ-aware.
- Tenant isolation must be enforced by **RLS + FORCE RLS + a transaction-local tenant GUC/role**. Application guards (for example `verifySiteOwnership`) are an **additional layer, never the sole isolation boundary**. Missing tenant context must produce **zero rows and no mutation**.

**Production-readiness law.** Architecture diagrams, green builds and file-presence validators do not prove production readiness. A production claim requires **measured evidence** for: payment integrity and reconciliation; cross-tenant isolation; authentication forgery, replay and escalation resistance; checkout correctness; queue lag and retry behavior; alert delivery to a real human; backup, PITR and a successful restore drill; RTO and RPO; load, spike, soak and failure testing; defined SLOs and error budgets; safe rollback. Transient readiness status and blocker counts belong in **dated evidence documents**, never as permanent claims in this memory.

**Ten-million-concurrent-user north-star.** An **evolvability requirement, not a statement of present capacity**. The active implementation and certification envelope remains **100 → 1,000 → 10,000 India merchants, approximately 30,000 orders/month**. "10M concurrent" means simultaneously *active* users, and any capacity plan must first define: geographic distribution; browsing versus authenticated traffic; origin requests per user; checkout and payment percentage; read/write ratio; duration and traffic shape; availability and latency SLOs; acceptable degraded behavior. **Never translate "10M concurrent" directly into infrastructure without those workload definitions.**

Long-range design principles: cache public storefront reads at the edge; keep origin compute stateless and horizontally scalable; protect checkout, payment and inventory writes from browsing traffic; use backpressure, admission control and graceful degradation; shed analytics, recommendations and other non-critical work before rejecting money-critical operations; keep queues partitionable and consumers independently scalable; keep contracts versioned and domain boundaries extractable; keep observability **off** the transactional commerce database; preserve tenant and money correctness under retries, concurrency and partial failure. **No data loss, cross-tenant leakage, duplicate charging or ledger imbalance is acceptable during overload.**

Measured scaling stages — do not skip ahead:

1. Make the governed 10,000-merchant envelope correct and **load-certified**.
2. Remove configuration bottlenecks; maximize caching, batching, pooling and asynchronous execution.
3. Scale stateless compute and queue consumers horizontally.
4. Introduce read scaling **only** after measured primary-read pressure and ARB approval.
5. Introduce partitioning/sharding **only** after measured write, storage or maintenance limits and an approved migration plan.
6. Introduce regional data or multi-region operation **only** after measured latency, availability, compliance or disaster-recovery demand.
7. Add a new runtime **only** when a named domain requires independent scaling or failure isolation, amending the Constitution where necessary.

Infrastructure may evolve; the canonical commerce rules, ledger, tenant model and public contracts must not.

**Decision rule for every session.** (1) Identify the governing rule. (2) Identify the canonical owner. (3) Query current evidence. (4) Determine whether current *measured* demand requires the change. (5) Prefer completing, wiring or deleting over creating a parallel system. (6) State assumptions and unknowns. (7) **Never claim capacity without a reproducible load test.** (8) Escalate architecture expansion to the ARB.

**Never decide alone.** Activating a reserved service or adding a runtime; read replicas, partitioning, sharding or multi-region; a second canonical system for any domain; changing money custody, transaction fees, the identity issuer model, the tenant-isolation model or the canonical renderer; anything on the Never-Build List (Constitution §10) or beyond the scale envelope (§6).

## Canonical Runtime Map

**Updated 2026-09-02 (Phase M, Stage 3):** the six-app rename below has been **executed on disk** — `apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/mobile/merchant-app`, and `apps/platform-console` no longer exist under those names; they are `apps/customer_web`, `apps/merchant_web`, `apps/merchant_app`, and `apps/admin_web` respectively. `governance-common.mjs`'s `canonicalAppRoots` array and the config/manifest files enumerated in `00b_topology_amendment_draft.md`'s §61 sweep **still reference the old names** — that repair is Stage 6 (Workspace and Configuration Repair) work, not yet done as of this edit. Until Stage 6 lands, the real governance gate (not `--plan`) will not resolve these paths correctly.

Roots are **not** one undifferentiated list. Four classes, with different rules:

**ACTIVE (the 8 canonical runtimes — the entire deployable topology):**

- `services/api-gateway`
- `services/queue-workers`
- `services/mobile-bff`
- `apps/identity-platform`
- `services/webhook-service`
- `apps/customer_web` (formerly `apps/storefront-runtime`)
- `apps/merchant_web` (formerly `apps/merchant-control-plane`)
- `apps/marketing-site`

**SUPPORTING (ride the canonical topology; non-extractable; authorize no further backend service):**

- `apps/merchant_app` (formerly `apps/mobile/merchant-app`)
- `apps/admin_web` (formerly `apps/platform-console`)

**The other four of the six product-facing app roots** (established this stage, cross-repository, from System A — see `10_merge_execution_journal.md` Stage 3 for survivor evidence): `apps/customer_app` (Play Store `com.letbuyy.letbuyy`), and `apps/admin_app`, which was **retired to a RESERVED root on 2026-09-05** (Constitution Amendment 2, phase FB-1): it was entirely Firestore-backed and had never shipped a signed release, so the owner's decision to delete Firebase removed the platform it ran on. Its 249 implementation files are deleted; the name and its two governance files remain, and `com.letbuyy.admin` is recorded as a retired applicationId. `apps/merchant_app` and `apps/merchant_web` are listed above since they map 1:1 from prior ACTIVE/SUPPORTING runtimes; `customer_app` and `admin_app` are new-to-C additions with no prior ACTIVE/SUPPORTING classification, so their tier (ACTIVE-equivalent, since they are two of the six core product names) is recorded here rather than invented a new class for them.

**RESERVED (manifest-only placeholders — MUST stay empty; no source, tests, or deployment config):**

- `services/checkout-runtime`
- `services/event-bus`
- `services/notification-service`
- `services/analytics-pipeline`
- `services/media-service`
- `services/search-service`
- `apps/mobile/shopper-app`
- `apps/mobile/operator-app`
- `apps/admin_app` — **reclassified ACTIVE → RESERVED on 2026-09-05** (Constitution Amendment 2, phase FB-1). Unlike the two above, this root once held real source; its Flutter/Firestore implementation was deleted when the owner retired Firebase. `apps/admin_web` owns the platform-operator surface (D-4), and `services/api-gateway`'s `/operations/marketplace-listings` owns the operator APIs. Reactivation needs the CAP-ADM-2 port complete, measured demand for a mobile operator surface, and ARB approval — and must be gateway-wired, never Firebase.

**FROZEN (not production deploy targets; do not treat as active topology):**

- `apps/app-marketplace`
- `apps/developer-portal`
- `apps/theme-marketplace`
- `apps/platform-operations-portal` (pending consolidation into `apps/admin_web` (formerly `apps/platform-console`))

Capability owners for reserved concerns are the implemented active runtimes until a **named trigger plus human approval** authorizes activation. Adding a runtime, or filling a reserved root, requires ARB approval and any necessary constitutional amendment **before** source is created.

## Deprecated Runtime Policy

Do not recreate or reference deprecated app aliases as active topology:

- `apps/admin`
- `apps/auth`
- `apps/checkout`
- `apps/internal`
- `apps/merchant`
- `apps/storefront`
- `apps/analytics`
- `apps/mobile/operator-team-app`
- `apps/customer_web/consumer-storefront` (formerly `apps/storefront-runtime/consumer-storefront`)

**Carve-out (Constitution amendment, 2026-09-02):** `apps/admin_app`, `apps/admin_web`, `apps/merchant_app`, and `apps/merchant_web` are approved six-app-model names, not instances of the deprecated `apps/admin`/`apps/merchant` aliases above — the prohibition names only the exact historical paths `apps/admin` and `apps/merchant`, never any of the four `_app`/`_web`-suffixed names. `scripts/validators/governance-common.mjs:203`'s `startsWithPrefix()` already treats this boundary correctly (`"apps/admin_app".startsWith("apps/admin/")` is `false`); this sentence closes a prose ambiguity, not a code defect.

Historical references may remain only under `docs/archive/`.

## Six-App Target Topology (Constitution amendment, 2026-09-02 — the six apps are executed; phase_2/auxiliary/TOOLING are authorized, not yet executed)

> **The Canonical Runtime Map above now reflects the current, live topology** — Stage 3 of the repository-consolidation merge executed the six-app rename/establishment on 2026-09-02 (six commits, `9ba4c438`…`b27a8b84`; survivor evidence and rejected-candidate disposition in `docs/migration/repository_consolidation/10_merge_execution_journal.md`, Stage 3). The `apps/phase_2/*`, `apps/auxiliary/`, and TOOLING items below remain authorized-but-not-yet-executed (Stage 4/backend-classification work). Per `docs/migration/repository_consolidation/00b_topology_amendment_draft.md` (Gaps 1–4), applied under the owner's standing six-app product/channel decision. **The owner's Signature Block in `00b` is not yet completed** — this amendment proceeds under the original brief's explicit instruction to apply it anyway and flag the missing signature, not to block on it. **`governance-common.mjs`'s arrays and the 18-file config sweep still reference the old runtime names — Stage 6 work, not done yet.**

- **Six product-facing app roots — EXECUTED:** `apps/customer_app` (from System A `apps/marketplace`, cross-repo copy), `apps/customer_web` (from System C `apps/storefront-runtime`, `git mv`), `apps/merchant_app` (from System C `apps/mobile/merchant-app`, `git mv`), `apps/merchant_web` (from System C `apps/merchant-control-plane`, `git mv`), `apps/admin_app` (from System A `apps/admin`, cross-repo copy — **now RESERVED**, source deleted 2026-09-05), `apps/admin_web` (from System C `apps/platform-console`, `git mv`).
- **`apps/phase_2/*`** — holds product capabilities not yet part of the six-app core (currently `rider_app`, `store_ops_app`, donor-only from System B). Not ACTIVE, not RESERVED (holds real source — RESERVED's "must stay empty" rule does not apply here), not FROZEN. Authorizes no new backend service; any backend work routes through the D-0-selected canonical backend.
- **The auxiliary tier** (Gap 2, Option B) — `apps/auxiliary/` is the chosen name for the directory grouping non-six-app-model runtimes (`marketing-site`, `identity-platform`-class). This is a **directory grouping, not a new authority tier**: membership does not change a runtime's ACTIVE/RESERVED/FROZEN status. The existing constitutional **SUPPORTING** tier (`apps/mobile/merchant-app`, `apps/platform-console`) is unchanged and keeps its name — Option A (renaming the existing tier) and Option C (keep both names, disambiguate forever) were considered and not chosen; see `00b` for the full menu.
- **TOOLING classification** (Gap 3, Option B) — `services/lcis-api`, `tools/graph-server`, `tools/central-intelligence`, and all 19 `packages/lcis-*` packages are the Central Intelligence System's own dev-time tooling: non-deployed, non-commerce, named in none of the four topology classes above. Recorded as the `toolingRoots` export in `scripts/validators/governance-common.mjs`. Option A (relocating `services/lcis-api` under `tools/`) was considered and not chosen — zero files moved, classification-only.
- **Neither `apps/phase_2/*` nor `apps/auxiliary/` is subject to the RESERVED-must-stay-empty rule.** Conflating "not one of the six core names" with "must be empty" is a category error this amendment exists to prevent.

## Founder decisions of 2026-09-24 — grouped layout, one identity, one buyer (Constitution Amendment 3)

Recorded in `.claude/skills/letbuyy/references/decisions.md` §2g (D-ONE-PRODUCT, D-APP-LAYOUT, D-ONE-IDENTITY, D-ONE-BUYER) and the Constitution §16, Amendment 3 (recorded unsigned, applied under the founder's instruction). They supersede the flat six-app **paths** above; the six-app product model stands.

- **Layout (D-APP-LAYOUT).** `apps/marketplace/mobile` (was `customer_app`) · `apps/merchant/web` (`merchant_web`) · `apps/merchant/mobile` (`merchant_app`) · `apps/commerce/web` (`customer_web`) · `apps/platform/identity` (`identity-platform`) · `apps/internal/console` (`admin_web`) · `apps/marketing/web` (`marketing-site`) · `apps/deferred/delivery/mobile` (`phase_2/rider_app`) · `apps/frozen/{app-store,theme-store,developer-portal,operations-portal}` · `apps/reserved/{operator-mobile,legacy-shopper-mobile,legacy-operator-mobile}` · donors at `reference/apps/{marketplace-seller,store-operations}`. Containers are never application roots; `apps/merchant` and `apps/internal` are permitted only as containers of their approved descendants. Package names, mobile identities, deep links, signing, Worker, project and secret names are preserved. Executed by the APPID phases; until APPID-P1 merges, the map above still describes the tree.
- **One identity (D-ONE-IDENTITY).** Every client authenticates through `identity-platform`, the sole issuer; services verify. First-party authorization code + PKCE for LetBuyy's own clients; the general OIDC provider stays deferred (ART-07). Operators sign in through `identity-platform`; a shared console bearer is never a human identity. The per-store customer login and Firebase Auth are transitional, each with a named retirement gate.
- **One buyer (D-ONE-BUYER).** `buyer_accounts` is the one buyer principal across Marketplace, Quick and every storefront; `store_customers` rows are merchant-scoped relationships, not logins. Marketplace order views span merchants; a storefront shows only the buyer's orders at the server-resolved store. No account merge on unverified identifiers.

## Required Validation

Run `node scripts/validate-governance.mjs` after topology, import, package, environment, generated artifact, or governance-memory changes.

---

# LetBuyy Quick Context (AI infrastructure)

> Additive operating context. The Constitution → `AGENTS.md` → local `AGENTS.md` chain above remains supreme; this section never overrides it. Deep maps live in `docs/architecture/`, `docs/ui-standards/`, and `docs/ai-infrastructure/`.

## Domain model
A multi-tenant India-first commerce platform. Core entities: **site** (the tenant/store, `site_id` everywhere), **store_customers** + **customer_credentials**, **products / collections / inventory**, **orders + order_items** (`*_minor bigint` money), **payment_transactions / refunds / payouts** (canonical ledger), **gift_card_accounts + gift_card_ledger_entries + gift_card_redemptions**, **shipping_rates**, GST invoices, **themes** (Liquid/React render).

## Subdomains & runtimes
`{store}.letbuyy.com` + custom domains → `customer_web` (formerly `storefront-runtime`; `src/proxy.ts` host routing). Merchant UI → `merchant_web` (formerly `merchant-control-plane`). Auth → `identity-platform`. Ops → `admin_web` (formerly `platform-console`). All proxy into the canonical `services/api-gateway` (`/v1`, Hono). Async via `queue-workers`; webhooks via `webhook-service`.

## Money, payments, COD, GST (hard rules)
- **Canonical ledger only:** money mutations are `SECURITY DEFINER` Postgres RPCs (`create_checkout_order`, `confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card`, `set_gift_card_status`, `restore_gift_card_on_refund`) called via `db.rpc`. **Never** `.from(money_table).insert/update` in TS (`canonical-ledger-only-validator`).
- **Server-authoritative amounts** — totals/tax/shipping computed in the RPC from DB, never the client. Razorpay signature verified server-side (HMAC-SHA256, `timingSafeEqualHex`). COD + Razorpay supported. GST computed server-side; invoices immutable.
- **Idempotency + locks** — every money RPC requires `idempotency_key`, uses `ON CONFLICT` + `FOR UPDATE`. Balances ≥ 0 (CHECK). Gift-card balance is a **ledger projection** (no mutable decrement).

## Auth, OAuth, webhooks, RLS, multi-tenancy
- **Sole issuer is the target state (ART-05 / R-14):** `identity-platform` must be the sole **asymmetric** token issuer for all three realms (merchant/staff, buyer/customer, platform-operator); every other runtime is **verify-only** (`LETBUYY_IDENTITY_PUBLIC_JWKS`). Realm privileges stay strictly separated — buyer auth never grants merchant/admin rights. A shared symmetric signing secret across trust domains is forbidden (`SEC-R7`). **Known deviation, not canonical design:** the customer realm is still minted **HS256** (`CUSTOMER_SESSION_SECRET`, `issueCustomerSession`), so the verification key is the forgery key. That is a state to be **collapsed onto the sole issuer**, never a pattern to extend or replicate. Step-up on refunds/payouts must be real cryptography (HMAC/stored challenge). Turnstile + rate-limit gate registration/login.
- **Tenancy backstop is the database, not the application.** Required: RLS `ENABLE` + `FORCE` + a **transaction-local tenant GUC/role** on every tenant table, with the GUC set only from a validated claim; unset or wrong context ⇒ **zero rows and no mutation** (`R-1`…`R-4`, `SEC-R9`). No policy may be `USING (true)` to PUBLIC/anon/authenticated. `verifySiteOwnership` and the app-layer query guard are **defence-in-depth layers, never a substitute** for the database backstop, and a blanket `service_role`/`BYPASSRLS` connection for tenant data is forbidden. Webhooks + queue jobs are HMAC-signed (`signQueueTenantEnvelope`).

## Marketplace / themes / developer portal
- `app-marketplace`, `theme-marketplace`, `developer-portal` are **frozen** (not deploy targets). `theme-engine` = Liquid + JSON renderer; sanitizer is locked (`FORBID` lists, `outputEscape:'escape'`); Liquid default OFF (canary). ART-17 forbids new React-per-section after freeze.

## Merchant UX & India-first standards
- Compose from `@letbuyy/ui`; **`--lb-*` design tokens only** (the design-system ratchet forbids new `rounded-[...]`/raw px). Mobile-first (~360px). Always handle loading/empty/error states. INR via `formatInrCurrency`, `en-IN` dates, GSTIN capture. See `docs/ui-standards/`.

## Operational rules
- Keep the 107-validator gate green; run real `pnpm --filter <app> build` (the gate does NOT cover app `next build`). Respect the two-lane merge rule. Never delete business logic, change payment/OAuth/RLS code, or modify production secrets without ARB. New app API routes are gateway proxies (route-ownership lockstep) — never write the DB locally.

## AI infrastructure (this repo)
- **Graphify** code graph: `uv tool install graphifyy` → `graphify update .` (output gitignored). Queries in `docs/ai-infrastructure/graphify-queries.md`.
- **Security:** `.github/workflows/security-review.yml` (PR) + `full-security-audit.yml` (weekly), Anthropic's `claude-code-security-review` (needs `ANTHROPIC_API_KEY`).
- **Slash commands:** `.claude/commands/*-audit.md` (per-domain audits) + `full-security-review.md` + `build-component.md`.

## Central Intelligence System (LCIS) — the architecture knowledge layer
- **Code graph + DB graph.** `pnpm graph:ui` → http://localhost:3333 (Atlas, **◆ Data Layer**, domain dashboards). The Graphify code graph does NOT index SQL — `pnpm graph:db` extracts the data layer (414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes → `graphify-out/db-intel.json`, gitignored).
- **V10 navigation (deep links).** Every LCIS view is URL-addressable and refresh-safe: `/domain/<key>` and `/domain/<key>/<perspective>` (e.g. `/domain/payments/impact`), `/page/<key>` for pages. Back/forward work; the command palette (`⌘K`) navigates by natural language ("what breaks if payments fail", "open orders impact"); graph edges are typed (15 relations), graphs have Level 1–6, and the bottom-right HUD shows the perf budget. See `docs/v10/`.
- **V11 business + operational intelligence.** Business modes (left nav → Business Intelligence): **Founder** (`/api/founder` = executive readiness), **Operations** (`/api/observability`), **Support** (`/api/investigate` — "where is my order", "why payment failed"), **Investor** (`/api/investor`), **New Developer** (`/api/developer` — 30-min onboarding), **Business Flows** (`/api/business-flow` — the 10 journeys + flow graph). Journey workspaces are deep-linkable: `/journey/<key>` (checkout/payment/refund/…). Plain-language blast radius: `/api/business-impact?domain=`. Live metrics CONNECTED/NOT CONNECTED only; the Subscription journey is honestly NOT IMPLEMENTED (no subscriptions domain). See `docs/v11/`.
- **OMEGA production-OS surfaces.** `/launch` — Launch Command Center with per-area **READY / AT RISK / BLOCKED** status (`/api/launch-status`, generated from production-readiness-v2 + V1 blockers; no manual status). `/ai-ops` — AI Operations Center (`/api/ai-ops`): ranked "what should I fix next / what blocks launch / what blocks 100 merchants·10k·100k users / highest risks" with evidence. **Merchant OS** + **Customer OS** modes (`/api/merchant-ops` + `/api/customer-ops`). Runbooks now include an **escalation** chain (`/api/runbook?domain=`). The 7 stop-condition questions (how does X work · what breaks if X fails · who owns X · what to fix next · what blocks launch · what is affected · how to recover) all answer without a repo scan. See `docs/omega-production/`.
- **INFINITY real-time autonomous operations.** **Live Operations Center** (left nav → Business Intelligence → Live Operations) — the real-time answer board for *what is happening now · what failed · what will fail next · who is affected · how much revenue · how to recover · what to fix next*. New engine `detection-prediction-intel.mjs`: **8 autonomous detectors** (`/api/detection` — checkout/payment/refund/worker/queue/db/webhook/deploy, each binding a live signal NOT CONNECTED to a structural risk), **6 predictors + what-will-fail-next** (`/api/predict` — ranked structural predisposition, confirming live signal NOT CONNECTED), **11-metric ingestion map** (`/api/live-metrics`), **incident timeline** (`/api/incident-timeline?domain=`). AI-Ops gained a "What will break next?" answer. Honest contract: structural risk/topology CONNECTED (now); every live signal/metric/trend NOT CONNECTED + exact source — no mocks/simulations/estimates. See `docs/infinity/`.
- **Query before you change.** `pnpm graph:intel blast "<symbol>"` (impact/blast radius), `… deps|consumers|critical|payment|tenant|flow`. HTTP for Claude: `/api/db`, `/api/blast?q=`, `/api/atlas`, `/api/domain?key=`, `/api/community?id=`, `/api/search`, `/api/path`. `graphify-mcp` is also installed (operator-registered; not auto-added to `.claude/`).
- **Change-control hotspots** (highest blast radius — run `graph:intel blast` on any PR touching them): `getSupabaseAdmin` (115 files), `@letbuyy/shared-types`, `@letbuyy/api-client`, `create_checkout_order`.
- **Audit agents:** `.claude/commands/agent-*.md` (12: security/architecture/payment/tenant/identity/checkout/marketplace/theme/developer/release/infrastructure/compliance) + `graph-*` commands — each queries the graph, then inspects code, then reports.
- **Reports:** `docs/central-intelligence/` (audit, quality, DB intelligence, flows, cross-app, domain, ownership, infrastructure, autonomous discovery, production intelligence, certification). Heuristic findings are candidates; the 107 deterministic validators stay authoritative. Refresh: `pnpm graph:db && pnpm graph:infra && pnpm graph:reports`.

## LCIS query strategy — query the intelligence layer BEFORE scanning the repo
For these questions, get the answer from LCIS first (one command) instead of grepping the whole tree:

| Question | LCIS query (CLI or `curl localhost:3333/api/...`) |
|----------|---------------------------------------------------|
| Where is X implemented? | `pnpm graph:intel deps "X"` / `consumers "X"` · `/api/search?q=X` |
| What breaks if I change X? | `pnpm graph:intel blast "X"` · `/api/blast?q=X` |
| Who owns X? | `pnpm graph:intel owner "X"` · `/api/owner?q=X` (CODEOWNERS) |
| What tables/policies/triggers affect table T? | `pnpm graph:intel table T` · `/api/table?name=T` |
| What does RPC R touch / who calls it? | `pnpm graph:intel rpc R` · `/api/rpc?name=R` |
| What policies are on table T? | `pnpm graph:intel policy T` · `/api/policy?table=T` |
| Money / refund / payout / tenant flow? | `pnpm graph:intel payment\|refund\|payout\|tenant` |
| Route → rpc → table chain? | `pnpm graph:intel flow "<route>"` |
| Most critical / highest-blast systems? | `pnpm graph:intel critical` |
| What infrastructure (workers/queues/secrets/deploy)? | `pnpm graph:intel infra` · `/api/infra` |
| Live provider federation (Supabase/Cloudflare/Vercel/GitHub/Razorpay/Resend/Turnstile)? | `/api/federation` (or `?provider=`) · unified live graph `/api/live-graph` (LCIS X — CONNECTED/NOT CONNECTED) |
| Live health/risk/availability for a domain? | `/api/live-health` (all 22) · `/api/live-health?domain=D` |
| "Why is X failing?" / root cause of an incident? | `/api/investigate?q=` · `/api/root-cause?domain=` |
| What changed / time-travel (now/last migration/release)? | `/api/time-travel` |
| Founder/exec readiness · merchant ops · customer ops? | `/api/executive-center` · `/api/merchant-ops` · `/api/customer-ops` |
| Pre-deploy change impact · release risk/rollback? | `/api/change-impact-live?domain=` · `/api/release-intel` |
| Observability (logs/events/deploys/incidents/queues/workers) · NL ops question? | `/api/observability` · `/api/ops-copilot?q=` |

### LCIS v3 — domain intelligence (ALWAYS query LCIS FIRST; only scan the repo if LCIS cannot answer)
Before scanning the repository for any of the questions below, run the LCIS query. The domain layer is built by `pnpm graph:domain` (output `graphify-out/domain-intel.json`, gitignored). 22 business domains; cross-domain edges = an RPC in A touches a table in B.

| Question | LCIS query (CLI or `/api/...`) |
|----------|--------------------------------|
| What domains exist / what's in domain D? | `pnpm graph:domain list` · `/api/domains` · `/api/domain?key=D` |
| What domains depend on D / what breaks if D changes? | `pnpm graph:cross D` · `/api/cross-domain?key=D` |
| What domains consume / are consumed by D? | `/api/domain?key=D` → `dependsOn` / `consumedBy` |
| What breaks if payments change (tables/rpcs/queues)? | `pnpm graph:payment` · `/api/payment` |
| Security/attack surface (identity/JWT/webhook/RLS/tenant)? | `pnpm graph:security` · `/api/security` |
| What deploys X (Actions/workers/Vercel/migrations/subdomains)? | `pnpm graph:deployment` · `/api/deployment` |
| Incident: root cause / blast / affected domains+merchants? | `pnpm graph:incident <domain>` · `/api/incident?domain=D` |
| Merchant lifecycle (store→products→orders→payments→…)? | `pnpm graph:merchant` · `/api/merchant` |
| Customer journey (landing→checkout→payment→refund→tracking)? | `/api/customer-journey` |
| What feature/service/domain uses secret S? | `/api/secrets` |
| What's new / unclassified (autonomous discovery)? | `pnpm graph:discover` |

**The LCIS-first protocol** for "what breaks if I change X / who owns X / what routes·rpcs·tables·workers·secrets·deployments use X": (1) query the domain graph (`/api/domain`, `/api/cross-domain`), (2) blast radius (`/api/blast` for symbols, `/api/cross-domain` for domains), (3) ownership (`/api/owner`), (4) deployment graph (`/api/deployment`), (5) payment graph (`/api/payment`). Refresh everything with `pnpm graph:v3` (db + infra + domain + reports).

### LCIS v4 — runtime + memory + execution (the repository scan is the LAST resort)
Before scanning the repository, query in this order: **1. LCIS** (code/domain graph) → **2. Runtime** → **3. Impact** → **4. Ownership** → **5. Memory** → **6. Deployment**. Built by `pnpm graph:v4` (also runs db/infra/domain). Live runtime/deploy *values* are telemetry/API-bound (Cloudflare Analytics Engine / deploy APIs) — LCIS maps the topology + emission points, it does not fabricate metrics.

| Question | LCIS query (CLI or `/api/...`) |
|----------|--------------------------------|
| **Why?** (rule / architecture / migration) | `pnpm graph:memory rule "X"` · `migration <n>` · `/api/memory?mode=rule&q=X` |
| **What breaks if I modify X?** | `pnpm graph:impact X` · `/api/change-impact?key=X` (routes·rpcs·tables·workers·queues·deployments·merchants·domains·owners) |
| **What is live?** (declared state) | `pnpm graph:depstate` · `/api/deployment-state` (HEAD + latest migration + targets) |
| **What is failing / slow / backed up?** | `pnpm graph:runtime` · `/api/runtime` → emission points + `wrangler tail`/Analytics Engine (values not in-repo) |
| **Who is affected?** (incident) | `pnpm graph:incident-response X` · `/api/incident-response?domain=X` (root cause → rollback → owner) |
| **What should be fixed next?** | `pnpm graph:execution` · `/api/execution` (open blockers, gaps, launch verdict) |
| **Which merchants use a feature?** | `/api/merchant-operating` (multi-tenant: all stores share the schema) |

### LCIS v5 — live operating intelligence (LCIS-V5-FIRST policy)
Before scanning the repository, query LCIS v5 first — **Runtime → Merchant → Revenue → Security → Incident → Decision**. Built by `pnpm graph:v5`. Live values (latency/errors, revenue/refund amounts, top merchants, funnel dropoff, live deploy versions) are **query-bound**: LCIS maps the topology + the exact source-of-truth (Analytics Engine, ledger reconciliation RPCs, site-scoped rows) and never fabricates them.

| Question | LCIS query (CLI or `/api/...`) |
|----------|--------------------------------|
| **What is running / failing?** | `/api/runtime-intelligence` (Worker→Queue→Cron→RPC→Table→Merchant→Customer→Deployment→Domain + metric sources) |
| **How much revenue / money risk?** | `/api/revenue-intelligence` (ledger model + reconciliation RPCs; amounts query-bound) · high-risk money paths |
| **Which merchants / who's affected?** | `/api/merchant-intelligence` (single-tenant SPOF) · `/api/incident-intelligence?domain=X` |
| **Security posture / attack surface?** | `/api/security-intelligence` (11 controls, trust boundaries, cross-tenant candidates) |
| **Is it production-ready?** | `/api/production-readiness` (structural %, per-system evidence) — NO-GO + high structural = foundation intact, launch-scope blockers open |
| **What should be fixed next / what blocks scale?** | `/api/decision-engine` (ranked fix order; blocks launch / 100 merchants / 10k / 100k users) |
| **What's dead/unused?** | `pnpm graph:discover-v5` (candidates; validators authoritative) |

### LCIS OMEGA — the unified brain (OMEGA-FIRST policy; the repository scan is the FINAL fallback)
LCIS is one queryable brain across 13 layers. Execution order before any repo scan: **Unified Brain → Fix Engine → Telemetry → Revenue → Merchant → Customer → Runtime → Domain → DB → Code**. Built by `pnpm graph:omega`. Live values (telemetry, revenue, merchant scores, cost-usage, deploy versions) are **query-bound** — LCIS supplies the model + the exact source; it never fabricates them.

| Question | LCIS query (CLI or `/api/...`) |
|----------|--------------------------------|
| The whole picture / how layers connect? | `/api/unified-intelligence` (13 layers, cross-layer spine) |
| What should be fixed (with plans)? | `/api/fix-engine` (fix/verify/test/rollback plans — none applied) |
| Merchant health / risk / growth / adoption / churn? | `/api/merchant-{health,risk,growth,adoption,churn}` (scores query-bound) |
| Customer funnel / conversion / retention / loyalty? | `/api/customer-intelligence-v2` (8 graphs; rates query-bound) |
| Revenue funnel / gift-card liability / payout dependency? | `/api/revenue-v2` (amounts query-bound) |
| How much does it cost / cost hotspots? | `/api/cost-intelligence` (pricing model; usage + totals query-bound) |
| Live telemetry / how to read a metric? | `/api/telemetry` (12 adapters; values query-bound) |
| Why / who decided / what was rejected / what failed? | `/api/memory-v2` |
| What blocks 1k / 10k merchants / 100k users? | `/api/decision-v2` · `/api/production-readiness-v2` (structural) |
| Architecture / security / RLS / ownership drift? | `/api/discovery-v2` (gate is the authoritative drift gate) |

### LCIS v6 — the dual-mode operating system (Explain default · Technical · Atlas deepest)
LCIS is now LetBuyy's operating system, readable by humans AND AIs. Three layers: **Explain mode** (default — plain-language Purpose/Importance/Criticality/Owner/Dependencies/Consumers/Failure-impact + flows per domain), **Technical mode** (the engineering tabs/engines), **Atlas** (the deepest 52k-node galaxy). A new engineer onboards via "Understand LetBuyy in 30 minutes"; an AI ingests a domain via the AI-context pack — neither scans the repo.

| Need | Surface |
|------|---------|
| Explain a domain (what/why/owner/failure) | `/api/explain?node=<key>` · Explain mode |
| Onboard in 30 minutes | `/api/explain` → `gettingStarted` · `docs/central-intelligence/ONBOARDING.md` |
| Paste-ready AI context per domain | `/api/explain?node=<key>` → `aiContext` · `docs/central-intelligence/AI_CONTEXT_PACK.md` |
| Natural-language question → right engine | `/api/copilot?q=...` (routes to change-impact/owner/memory/security/flow; repo scan last) |
| Executive readiness | `/api/explain` → `readiness` · `/api/production-readiness-v2` |
| Table relationships (foreign keys) | `/api/relationships?table=X` (705 FKs; tenant root `sites`) · Explain → Database |
| What's live vs repository-only? | `/api/environment` (Local/Staging/Production; "Live Data Source Not Connected" until an adapter is wired — never mocked) |
| Knowledge sub-graph (business/security/ownership/…) | `/api/graph?kind=<business\|journey\|security\|ownership\|infrastructure\|revenue\|ai>` |
| Operations status (incident/deploy/runtime/queue/worker) | `/api/operations` · Explain → Operations Center |
| Executive view (health + readiness + findings + actions) | `/api/mission-control` · Explain → Mission Control |
| Production health (GREEN/YELLOW/RED + evidence) | `/api/production-health` (structural; live = NOT CONNECTED where telemetry needed) |
| Is a live source connected? (NOT CONNECTED + exact source) | `/api/connections` · Explain → Live & Connections |
| Autonomous audit (missing auth/rate-limit/RLS, dead X) | `/api/audit` (candidates; gate is authoritative — 0 hard violations) |
| Atlas V2 composed answer (breaks/owns/tables/rpcs/merchants/…) | `/api/atlas-v2?node=X` |
| AI context pack (project/launch/architecture/domain) | `/api/ai-context?pack=X` |
| **Ask a question in English** ("How does Orders work?") | `/api/search-v2?q=...` (semantic; returns the domain answer + flow; repo scan not required) |
| Theme / App-marketplace / Developer platform (all FROZEN) | `/api/theme-intelligence` · `/api/apps-intelligence` · `/api/developer-intelligence` |
| Self-contained AI pack (< 20k tokens) for any model | `/api/ai-pack?target=claude\|gemini\|codex\|cursor` |
| **Live provider status** (Supabase/Cloudflare/Vercel/GitHub/Resend/Razorpay/Turnstile) | `/api/live-adapters` (status + exact env vars) · `/api/live` (real read-only probe — NOT CONNECTED until creds set) |
| Environment registry (local/staging/production credential presence) | `/api/environment-registry` · Explain → Live Integrations |
| Autonomous diagnosis (root cause / affected / confidence) | `/api/diagnose?target=X&error=Y` |
| Autonomous runbook (detection/diagnosis/recovery/rollback/verification) | `/api/runbook?domain=X` |

**Live-data law:** every live value is real-source or **NOT CONNECTED + the exact env var** — never fabricated. No provider credential is in the repo (deploy-time); adapters are read-only and probe only when credentials are present.

### LCIS Genesis — Control Centers (composition over the existing stack; never scan the repo for these)
| Need | Surface |
|------|---------|
| **Full lineage** for any entity (table↔rpc, route→rpc, worker/queue/migration/policy/trigger/index→table, FK) | `/api/lineage?entity=X` |
| **One-click full trace** (entity → route → rpc → tables → policies → triggers → queues → emails → analytics → merchant dashboard) | `/api/trace?entity=checkout` |
| **Launch GO/NO-GO** (10 readiness dims + blockers + risks + missing secrets/incidents/migrations/tests) | `/api/launch-command-center` · Explain → Launch Command Center |
| Environment control (graph/health/dependency/ownership/secrets + activation steps) | `/api/environment-control` |
| Infrastructure / Commerce / Incident control centers | `/api/infrastructure-control` · `/api/commerce-control` · `/api/incident-control?target=X` |
| AI packs (Claude/Gemini/Codex/Cursor/OpenAI, < 20k) | `/api/ai-context-pack?target=X` |
| Docs-grade explain (tags, reading time, difficulty, problem solved, code/db refs, deep-dive) | `/api/explain?node=X` → `docs` |
| **Domain workspace** (one search → 6 perspectives: explain/technical/graphs/trace/related/ai) | `/api/workspace?domain=X` · Explain mode → select a domain |
| Related knowledge (domains/services/tables/FK/routes/runbooks/incidents/docs/AI packs) | `/api/related?domain=X` |
| **Impact / risk / what-breaks-if** (impact·risk·recovery scores + affected APIs/tables/workers/domains/merchants/revenue/RLS/FK) | `/api/impact-score?domain=X` |
| 16-perspective workspace (Overview/Explain/Technical/Database/API/Infra/Security/Ops/Incidents/Deps/Impact/Graphs/Trace/Related/AI/Atlas) | `/api/workspace?domain=X` · Explain mode → select a domain |
| Database control (schema/relationship/policy/function explorers) | `/api/database-control` · Explain → Database |
| Deep investigation | Atlas (Technical mode → ★ Atlas) — the deepest layer |

Fall back to a full repo scan only when LCIS returns nothing or the data layer is stale (`pnpm graph:update && graph:omega`). Change-control hotspots above always warrant a `graph:intel blast` before merge.

### LCIS V2 — Autonomous Commerce Intelligence Platform (`tools/central-intelligence`, port :3334)
V1 above (`tools/graph-server`, :3333) is the **structural** brain and is unchanged. **LCIS V2** layers live, self-learning, reasoning intelligence over it. The approved primitives (Qdrant, Crawl4AI, GraphRAG, Playwright, SigNoz) are **hidden implementation details** — always refer to the LCIS subsystem, never the underlying tech. Start it: `cd tools/central-intelligence && bash setup.sh && npm start`. Design + ops live in `docs/lcis-v2/` (21 docs); architecture map in `docs/lcis-v2/LCIS_ARCHITECTURE_V2.md`.

**LCIS-V2-FIRST** (extends LCIS-FIRST): for semantic recall, reasoning, repo-context compression, and cross-event correlation, query :3334 first; it reads V1 (:3333) internally and synthesizes. Repo scan stays the last resort.

| Question | LCIS V2 query (`curl localhost:3334/intelligence/...`) |
|----------|--------------------------------------------------------|
| Understand the repo without loading it (compressed context map) | `/context/assemble?q=&budget=` · `/context/map` (300 ranked files) · `/context/compression` (≈1,275× reduction) |
| Semantic memory / "have we seen this before" | `/memory/search?q=&collection=` (8 collections: architecture·runbooks·incidents·security·deployments·knowledge·merchants·themes) |
| Relationship reasoning over commerce entities | `/graph/query?q=&method=global\|local` · `/graph/impact?entity=` |
| Why did X happen / what caused it / what to investigate | `/reason?q=` · `/reason/why?incident=` · `/reason/affected?component=` · `/reason/risk-dependency` |
| Correlate incident↔deploy↔drift↔deps → root cause + risk | `/correlate/root-cause?domain=` · `/correlate/impact?component=` · `/correlate/risk?target=` |
| Architecture now / drift / risks / what depends on X | `/architecture` · `/architecture/drift` · `/architecture/risks` · `/architecture/depends?component=` |
| Autonomous ops: posture, anomalies, ranked fixes, daily report | `/operations/assess` · `/operations/recommendations` · `/operations/daily` |
| Validate a real storefront/theme/checkout (browser eyes) | `/browser/validate?url=` · `/browser/theme?url=&themeId=` · `/browser/checkout?url=` (never executes payment) |
| How does LetBuyy/LCIS itself work (self-model) | `/self/model` · `/self/explain?topic=service-interaction\|deployment-propagation\|failure-propagation\|incident-emergence` |
| One natural-language question, multi-source synthesis | `/intelligence/ask?q=` (flagship) · operator dashboard: `node operator-platform/serve-dashboard.mjs` → :3335 |

**Honesty contract (inherited):** structural intelligence is CONNECTED; every live value (telemetry, GMV, merchant magnitudes) is **NOT CONNECTED + exact source** until credentials are wired (`OPENAI_API_KEY`, `QDRANT_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT`). A `DEGRADED`/`DOWN` posture from `/operations/assess` when Qdrant/OTel are not running is **honest**, not a bug.

### LCIS V3 — Executive Intelligence (same server :3334, `tools/central-intelligence/`)
V3 turns intelligence into **decisions and safe action**: it can Predict · Recommend · Plan · Investigate · Orchestrate · Execute (safe, read-only) · Verify · Learn. 13 new engines layered over V2 (executive-intelligence, goal-engine, prediction-engine, recommendation-engine, investigation-engine, orchestration-engine, execution-engine, verification-engine, daily-intelligence, operating-loop). Docs in `docs/lcis-v2/LCIS_EXECUTIVE_INTELLIGENCE.md` + 10 siblings.

| Question | LCIS V3 query (`curl localhost:3334/intelligence/...`) |
|----------|--------------------------------------------------------|
| What should happen next / highest-priority risk / what leadership should know | `/executive/next` · `/executive/briefing` · `/executive/synthesize?topic=` |
| What are our goals / which are at risk | `/goals` · `/goals/at-risk` · `/missions` |
| Predict degradation / incidents / capacity / what fails next | `/predict?target=` · `/predict/all` · `/predict/incidents` |
| Recommend (engineering/operational/security/architecture/merchant) — evidence+risks+impact | `/recommend` · `/recommend?domain=` |
| Autonomously investigate (4 timelines + root cause, no human) | `/investigate/domain?domain=` · POST `/investigate` |
| Run a coordinated workflow (health/risk/architecture review) | `/orchestrate/health` · `/orchestrate/risk` · `/orchestrate/architecture` |
| Execute a SAFE read-only op (validations/health/diag/scans) — mutating verbs auto-REJECTED | POST `/execute {action}` · `/execute/actions` · `/execute/audit` |
| Verify a conclusion (evidence/confidence/sources → VERIFIED/PARTIAL/UNVERIFIED/REFUTED) | POST `/verify {conclusion}` · `/verify/report` |
| Executive / engineering / security / merchant brief | `/brief/daily` · `/brief/executive` · POST `/brief/generate` |
| The autonomous operating loop (Observe→…→Learn) | `/loop/state` · POST `/loop/run-once` · `/loop/history` |
| One executive overview of everything | `/command-center` |

**Safety + honesty (enforced in code, not just docs):** the Execution Engine is **read-only only** — `SafetyGuard` default-denies and rejects any mutating verb (deploy/write/insert/update/delete/pay/refund/push/merge); no production mutations, no payment execution, no merchant actions; every run is hash-chain audited (`graphify-out/execution-audit/`). The Verification Engine **refuses to rubber-stamp** — an uncorroborated claim returns REFUTED. The operating loop's Learn stage writes outcomes back into the Memory Engine for continuous improvement.
