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

Fall back to a full repo scan only when LCIS returns nothing or the data layer is stale (`pnpm graph:update && graph:db && graph:infra`). Change-control hotspots above always warrant a `graph:intel blast` before merge.
