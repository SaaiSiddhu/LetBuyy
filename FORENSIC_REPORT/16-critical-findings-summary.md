# Critical Findings Summary

**Investigation date:** 2026-06-05
**Purpose:** A single reconciled, severity-ranked register of the most significant findings across all 14 domain reports. Severities were normalized across reports (individual agents used independent scales); where reports disagreed, the rating here reflects blast radius × evidence strength, and the originating report is cited. This document records facts and their observed impact only — it proposes no remediation.

**Method:** Findings were collected from reports `01`–`14`, de-duplicated, and cross-checked. The 14 Critical/High items most likely to appear in a headline were independently re-verified against source by a separate fact-checking pass; verdicts are logged in [`17-evidence-appendix.md`](17-evidence-appendix.md) and marked ✅ below.

---

## Severity tally

| Severity | Count | Definition used |
|---|---|---|
| **Critical** | 14 | Platform-level: breaks a core promise (host apps, extend themes, move money, run reliably) or misrepresents the system to any reader. |
| **High** | 17 | Domain-level: a major subsystem is broken, dual-owned, untested, or unsafe, but the platform still runs. |
| **Medium** | (see source reports) | Localized correctness/consistency defects. |
| **Low** | (see source reports) | Cosmetic, stale-doc, or environment-conditional issues. |

Full Medium/Low registers live in their source reports ([08](08-error-misconfiguration.md), [11](11-architecture-violations.md), [13](13-technical-debt.md), [14](14-risk-assessment.md)).

---

## CRITICAL findings

### C-1 — The entire backend is one Cloudflare Worker (single point of failure)
All commerce, authentication, themes, apps, payments, media, analytics, and the legacy portfolio/resume surface execute inside `services/api-gateway`. `src/index.ts` mounts 30+ routers; route handlers total ~20,340 lines, with `routes/storefront.ts` alone ≈4,900 lines (4,993 at final measurement ✅). The six sibling "services" that would distribute this load are code-free.
**Impact:** No process, fault, or scaling isolation between subsystems; one bad deploy or hot path degrades everything. **Source:** [03](03-application-investigation.md), [11](11-architecture-violations.md), [14](14-risk-assessment.md).

### C-2 — Six declared runtime services do not exist
`checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, and `analytics-pipeline` each contain exactly two files (`AGENTS.md` + `runtime.manifest.json`) — no `package.json`, no `src/` ✅. Their manifests assert domain ownership the code does not honor.
**Impact:** The published runtime topology overstates the architecture; any reader (or acquirer) of the runtime map is misled about isolation, ownership, and failure domains. **Source:** [03](03-application-investigation.md), verified [17](17-evidence-appendix.md).

### C-3 — The app platform cannot host a real third-party app
App-scoped OAuth tokens are accepted at exactly **one** call site — a GET-only proxy (`app-store.ts:1253`) ✅; the general `authMiddleware` never accepts app JWTs. There is no app write API, no refresh token, and no client secret / PKCE at `/oauth/token` (the authorization code is the sole credential).
**Impact:** A partner can complete OAuth and still do nothing but read five resource prefixes for one hour. The advertised developer platform is non-functional for its stated purpose. **Source:** [06](06-apps-ecosystem.md), verified [17](17-evidence-appendix.md).

### C-4 — Mandatory compliance webhooks are subscribed but never published
`customers/data_request`, `customers/redact`, and `shop/redact` are force-subscribed at every app install (`app-engine/src/index.ts:151-153`) but have **zero emit sites** anywhere in the repository ✅.
**Impact:** The platform advertises Shopify-parity GDPR/CCPA data-handling webhooks it structurally cannot deliver — a compliance representation the code contradicts. **Source:** [06](06-apps-ecosystem.md), verified [17](17-evidence-appendix.md).

### C-5 — App billing moves no money
Charge "approval" fabricates a fake provider reference (`rzp_route_test_…`, `app-store.ts:1541`) and merely flips a status; the payout ledger hard-codes `payout_provider_mode: 'test'` and leaves entries `pending` (`queue-workers …:664`) ✅. No PSP charge or payout-release call exists; `payout.released/failed` events have contracts but no emitters.
**Impact:** The entire app-monetization surface (revenue share, GST math, payouts) is a schema-and-UI shell that never settles funds. **Source:** [06](06-apps-ecosystem.md), [07](07-integration.md), verified [17](17-evidence-appendix.md).

### C-6 — The web theme editor's live preview is unwired; merchants publish blind
The iframe + postMessage preview component (`CenterPanel.tsx`) has **zero importers** in `merchant-control-plane` ✅; the active editor page renders a hardcoded mock (`PREVIEW_PRODUCTS`, editor `page.tsx:174`). The built preview-session bridge (gateway + storefront `/preview`) exists but only the Flutter app wires it.
**Impact:** On web, a merchant never sees real rendered output before a one-step publish to live (see C-8). **Source:** [04](04-theme-system.md), [05](05-storefront-runtime.md), verified [17](17-evidence-appendix.md).

### C-7 — Theme section vocabulary is compiled into the storefront
JSON-contract sections are rendered by React components statically imported in `storefront-runtime` (`renderer-registry.tsx`, ~20 renderers); unknown section types render `null`.
**Impact:** No new section type can exist without a platform code deploy — the opposite of Shopify's open section model. The Liquid path is the only escape hatch, and it is itself constrained (C-9). **Source:** [04](04-theme-system.md), [05](05-storefront-runtime.md), [12](12-shopify-compatibility.md).

### C-8 — Web theme publish is one-step to live, last-write-wins
The web editor `PUT` saves a draft then immediately `publish({make_store_live:true})` (`editor/route.ts`); the web save path omits `base_version`, so concurrent sessions overwrite each other despite server-side conflict support existing.
**Impact:** No preview/publish separation on web; concurrent edits silently clobber. **Source:** [04](04-theme-system.md).

### C-9 — No app embeds, and Liquid themes have no commerce object model
App embeds are **not found in the repository** — `content_for_header`/`content_for_footer` are hardwired to empty strings (`theme-renderer.ts:246-249`) and scripts are structurally blocked. The Liquid runtime exposes only `shop/request/settings/routes/section/block` scope with no product/cart/customer objects and no Shopify filters (under `strictFilters:true`, `money`/`image_url` etc. would throw).
**Impact:** Two of Shopify's core extensibility surfaces (App Embeds = 0/10; Theme Runtime commerce model ≈ absent) cannot be reached by any theme or app today. **Source:** [12](12-shopify-compatibility.md), [04](04-theme-system.md).

### C-10 — No server-side cart
The active cart persists only in `localStorage['lb_cart']` (`cart-context.tsx:28/43`) ✅. A `public.carts` table exists in the baseline migration but is unwired (no route reads or writes it).
**Impact:** No cart tokens, no cross-device cart, no abandoned-cart recovery, and apps cannot mutate a cart server-side. **Source:** [05](05-storefront-runtime.md), [12](12-shopify-compatibility.md), verified (PARTIAL — vestigial table) [17](17-evidence-appendix.md).

### C-11 — Testing and "certification" are document-shaped, not behavior-shaped
0 package unit tests; all 12 deployable workspaces' `test` scripts are `echo 'No tests yet' && exit 0` ✅. The passing 128-validator suite and ~149 governance tests assert manifest consistency and source string fragments; load/chaos suites default to plan mode and self-label `governance-contract-not-live-evidence`.
**Impact:** "Production certification passing" is not evidence that production behavior was tested. Regression safety net is effectively absent in deployable code. **Source:** [14](14-risk-assessment.md).

### C-12 — The declared source of truth describes a database that no longer exists
`AGENTS.md` (the repo's stated top authority) claims 65 migrations / 228 tables and cites migration `065`; reality is ~10 squashed migration files with sequence gaps, and the cited migration is relocated out of `migrations/`.
**Impact:** The canonical engineering document cannot be trusted for schema topology — it actively misdescribes the live database. **Source:** [11](11-architecture-violations.md), [13](13-technical-debt.md).

### C-13 — Three governance sources disagree on the runtime inventory
`CLAUDE.md` lists 13 runtimes; `docs/governance/runtime-boundaries.md` adds `developer-portal` and 7 reserved services; the disk holds 10 apps + 9 services (6 of them 2-file scaffolds). `developer-portal` ships but is omitted from the CLAUDE.md canonical map; `queue-workers` is implemented but its manifest labels it `reserved-service`.
**Impact:** There is no single readable document that correctly states what the platform is — the topology is unresolvable by reading the governance docs. **Source:** [01](01-repository-inventory.md), [03](03-application-investigation.md), [11](11-architecture-violations.md).

### C-14 — Observability is a contract with no producer
Prometheus rules, Grafana dashboards, and SLOs reference metrics (`http_requests_total`, `letbuyy_queue_dead_letter_total`, `letbuyy_replay_lag_seconds`) that **no runtime emits**; there is no OTel/prom-client dependency and `writeDataPoint` is never called.
**Impact:** Production failures are human/log-detected only; the alerting stack cannot fire because nothing feeds it. **Source:** [14](14-risk-assessment.md).

---

## HIGH findings (condensed register)

| ID | Finding | Evidence | Source |
|---|---|---|---|
| H-1 | **Dual write-ownership of core tables.** Both `api-gateway` and `webhook-service` insert/update `orders` and `products` (webhook-service via a `patchRows()` REST helper, setting `payment_status`/`status` inline ✅). Correctness rests only on RPC row-locking. | `webhook-service/src/index.ts:412/430/468/503/1010` | [07](07-integration.md), [11](11-architecture-violations.md) |
| H-2 | **Legacy product still live.** Portfolio/resume/ATS pages, gateway `/portfolio` + `/resume` routers, and 5+ schema tables ship in the commerce admin. | `[store]/{experience,education,…}/page.tsx`; `index.ts:215-216` | [09](09-dead-code.md), [13](13-technical-debt.md) |
| H-3 | **`apps/mobile/operator-app` is the unmodified Flutter counter demo** (single `main.dart`, "Flutter Demo", `_counter`) ✅, yet is governed as a real runtime. | `operator-app/lib/main.dart:15,57,107` | [03](03-application-investigation.md) |
| H-4 | **`theme-marketplace` checkout is a non-functional link.** "Pay" is `<Link href="/checkout/success…">` firing only a toast; no payment intent ✅. | `theme-marketplace/.../checkout/page.tsx:206-217` | [03](03-application-investigation.md) |
| H-5 | **Wasm app functions: `memory_limit_kb` stored but never enforced** ✅; synchronous CPU loops can stall the public checkout path (only a ms-scale timeout + 64 KB output cap apply). | `app-functions-runtime.ts:203 (instantiate(module,{}))` | [06](06-apps-ecosystem.md) |
| H-6 | **No client authentication at `/oauth/token`** — code + client_id + redirect_uri only; no client_secret, no PKCE. | `app-store.ts` OAuth flow | [06](06-apps-ecosystem.md) |
| H-7 | **Merchant password verification runs in the Next app**, with `password_hash` shipped over HTTP from the gateway each login; two bcrypt cost factors (12 vs 10) and no shared hashing impl. | identity-platform vs api-gateway | [01](01-repository-inventory.md), [11](11-architecture-violations.md) |
| H-8 | **`@letbuyy/utils` is a dead dependency edge** — declared by 8 apps, imported by 0 source files ✅; it also exports a service-role admin DB client into those apps' graphs. | 8 `package.json` vs 0 imports | [09](09-dead-code.md), [11](11-architecture-violations.md) |
| H-9 | **God file `storefront.ts`** — ≈4,900 lines / 60 handlers holding the entire shopper surface incl. inline customer auth. | `api-gateway/src/routes/storefront.ts` | [11](11-architecture-violations.md) |
| H-10 | **Cloudflare queues with consumers but no producers** (`NOTIFICATION_QUEUE`, `SEARCH_QUEUE`, `RUNTIME_QUEUE`); only ANALYTICS + EVENT are produced. | wrangler config vs send sites | [07](07-integration.md) |
| H-11 | **`payout.released`/`payout.failed` have contracts + templates but no emitter** → dead consumer code. | event registry vs emit sites | [07](07-integration.md) |
| H-12 | **Theme/payout events emitted with no registered domain-event contract** (`theme.purchase.*`, `theme.draft.*`) → skip validation, never reach webhook-service. | gateway emit sites | [07](07-integration.md) |
| H-13 | **No theme/app developer tooling** — no CLI, theme-check, scaffold, SDK key issuance, or manifest upload; ecosystem growth depends on manual JSON/DB edits. | absence across `packages/`,`scripts/` | [06](06-apps-ecosystem.md), [12](12-shopify-compatibility.md) |
| H-14 | **Demo store "Urban Kicks" hardcoded** into storefront runtime, short-circuiting the tenant/theme pipeline before any network call. | `lib/demo/urban-kicks-demo.ts`; `store-service.ts:54-57` | [04](04-theme-system.md), [05](05-storefront-runtime.md) |
| H-15 | **Two production deploy workflows both fire on push to `main`** with different concurrency groups → racing same-target deploys; `deploy-production.yml` has no migration job/staging gate and `echo "SKIP"`s on missing creds. | `.github/workflows/*` | [14](14-risk-assessment.md) |
| H-16 | **Static shared bearer token is the sole auth for the super-admin/ops API plane** — no per-operator identity, no rotation; audit actor self-asserted. | ops/admin auth path | [14](14-risk-assessment.md) |
| H-17 | **Storefront customer login lacks rate limiting / bot protection** that identity-platform has; internal storefront endpoints trust requests with no secret when `ENVIRONMENT !== 'production'`. | `routes/storefront.ts:1693` | [08](08-error-misconfiguration.md), [14](14-risk-assessment.md) |

---

## Cross-cutting positives (verified present)

These were independently confirmed and counter several stale alarms in the repo's own older audit ledgers:

- **No committed live secrets** — no `sk_live_`, `rzp_live_`, `service_role` JWTs, or PEM keys in tracked source ✅. ([14](14-risk-assessment.md), [17](17-evidence-appendix.md))
- **Timing-safe webhook signature verification for all four payment providers** (Razorpay/Stripe/PayPal/Cashfree). ([14](14-risk-assessment.md))
- **Clean application-layer boundaries** — no app→app imports, no direct Supabase access from any web app (0 `.from()`), no deprecated-alias references in code. ([01](01-repository-inventory.md), [11](11-architecture-violations.md))
- **The repo's own governance suite passes all 128 validators (exit 0).** Every Critical/High finding above is therefore something the validators do not measure, a cross-authority disagreement, or a prose-only rule — not a gate the platform is failing. ([17](17-evidence-appendix.md))

> The distinction in that last bullet is the central theme of this investigation: **the code that runs is mostly clean; the danger is in the distance between what the platform documents/validates about itself and what it actually does.**
