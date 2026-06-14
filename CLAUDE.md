# LetBuyy AI Operating Context

`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` is supreme law for this repository. Claude, Codex, humans, and other automation must follow the Constitution first, then root `AGENTS.md` (the promoted `LETBUYY_AGENTS_V2` operating rulebook), then the relevant local `AGENTS.md`, then the canonical governance rewrite documents.

## Canonical Runtime Map

- `apps/storefront-runtime`
- `apps/merchant-control-plane`
- `apps/identity-platform`
- `apps/marketing-site`
- `apps/platform-console`
- `apps/mobile/merchant-app`
- `services/api-gateway`
- `services/mobile-bff`
- `services/webhook-service`
- `services/queue-workers`
- `apps/mobile/shopper-app` (reserved, not implemented)
- `apps/mobile/operator-app` (reserved, not implemented)
- `services/checkout-runtime` (reserved, not implemented)
- `services/search-service` (reserved, not implemented)
- `services/media-service` (reserved, not implemented)
- `services/notification-service` (reserved, not implemented)
- `services/event-bus` (reserved, not implemented)
- `services/analytics-pipeline` (reserved, not implemented)

`apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`, and `apps/platform-operations-portal` are frozen or pending consolidation, not production deploy targets. Reserved service and mobile roots are manifest-only placeholders. Their current active capability owners are implemented web/service runtimes until a human-approved scope adds real source, tests, and deployment config.

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
- `apps/storefront-runtime/consumer-storefront`

Historical references may remain only under `docs/archive/`.

## Required Validation

Run `node scripts/validate-governance.mjs` after topology, import, package, environment, generated artifact, or governance-memory changes.

---

# LetBuyy Quick Context (AI infrastructure)

> Additive operating context. The Constitution → `AGENTS.md` → local `AGENTS.md` chain above remains supreme; this section never overrides it. Deep maps live in `docs/architecture/`, `docs/ui-standards/`, and `docs/ai-infrastructure/`.

## Domain model
A multi-tenant India-first commerce platform. Core entities: **site** (the tenant/store, `site_id` everywhere), **store_customers** + **customer_credentials**, **products / collections / inventory**, **orders + order_items** (`*_minor bigint` money), **payment_transactions / refunds / payouts** (canonical ledger), **gift_card_accounts + gift_card_ledger_entries + gift_card_redemptions**, **shipping_rates**, GST invoices, **themes** (Liquid/React render).

## Subdomains & runtimes
`{store}.letbuyy.com` + custom domains → `storefront-runtime` (`src/proxy.ts` host routing). Merchant UI → `merchant-control-plane`. Auth → `identity-platform`. Ops → `platform-console`. All proxy into the canonical `services/api-gateway` (`/v1`, Hono). Async via `queue-workers`; webhooks via `webhook-service`.

## Money, payments, COD, GST (hard rules)
- **Canonical ledger only:** money mutations are `SECURITY DEFINER` Postgres RPCs (`create_checkout_order`, `confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card`, `set_gift_card_status`, `restore_gift_card_on_refund`) called via `db.rpc`. **Never** `.from(money_table).insert/update` in TS (`canonical-ledger-only-validator`).
- **Server-authoritative amounts** — totals/tax/shipping computed in the RPC from DB, never the client. Razorpay signature verified server-side (HMAC-SHA256, `timingSafeEqualHex`). COD + Razorpay supported. GST computed server-side; invoices immutable.
- **Idempotency + locks** — every money RPC requires `idempotency_key`, uses `ON CONFLICT` + `FOR UPDATE`. Balances ≥ 0 (CHECK). Gift-card balance is a **ledger projection** (no mutable decrement).

## Auth, OAuth, webhooks, RLS, multi-tenancy
- **Two issuers, never crossed:** customer **HS256** (`CUSTOMER_SESSION_SECRET`, `issueCustomerSession`); merchant **ES256** (identity-platform, `LETBUYY_IDENTITY_PUBLIC_JWKS`). Step-up (HMAC) gates refunds/payouts. Turnstile + rate-limit gate registration/login.
- **RLS forced** on tenant tables; no public `USING (true)`; service-role gateway access only **behind** `verifySiteOwnership`. Webhooks + queue jobs are HMAC-signed (`signQueueTenantEnvelope`).

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
| Deep investigation | Atlas (Technical mode → ★ Atlas) — the deepest layer |

Fall back to a full repo scan only when LCIS returns nothing or the data layer is stale (`pnpm graph:update && graph:omega`). Change-control hotspots above always warrant a `graph:intel blast` before merge.
