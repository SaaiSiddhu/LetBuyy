# API Refactoring Blueprint (Phase 16 · Deliverable 22: New APIs)

Scope: gateway `/v1` surface (28 routers), app-store module, auth middleware, rate limiting, versioning. Dead/duplicate endpoints, security/authorization flaws, tenant isolation, and the new API set.

---

## 1. Findings on Current Surface
- **Monolith route:** `routes/app-store.ts` 2,721 lines / 8 concerns → split per doc 09 A2.
- **Auth classes:** internal SSO + Supabase JWT only; app tokens checked ad-hoc inside `bridge/fetch` (1286-1288) — authorization flaw C5.
- **Duplicates:** none endpoint-level found; conceptual duplicate = marketplace Next.js API routes proxying gateway (`apps/app-marketplace/src/app/api/*`) — keep as BFF but forbid logic there (thin-proxy lint rule); PayPal webhook misplacement H7.
- **Dead endpoints:** none verified dead in app-store; `apps/app-marketplace/src/proxy.ts` unreferenced (delete, doc 08).
- **Rate limits:** global 300/min/user (Upstash→KV→memory); no per-store, per-app, or per-token buckets; auth routes exempted from CSRF with higher limits — H8.
- **Versioning:** `/v1` + `X-LetBuyy-API-Version` header middleware exists (apiVersion.ts) without deprecation calendar.
- **Tenant isolation:** store-context resolution solid for merchants; app-token requests have **no** isolation layer yet (no installation→store binding check at middleware level).

## 2. Authorization Architecture (target)

```
Request → identify (strategy chain):
  1) X-LetBuyy-Internal-*  → first-party app           (full RBAC roles)
  2) Supabase JWT          → human user                (RBAC roles, store membership)
  3) Bearer letbuyy_app_*  → app token (oauth_tokens)  → ctx = {app_id, installation_id, store_id, scopes[], kind}
→ authorize:
  scope map (shared-types, generated docs):
    read_products  → GET /v1/products*, GET /v1/storefront/products*
    write_products → POST/PATCH/DELETE /v1/products*
    read_orders / write_orders → /v1/orders*
    read_customers / write_customers → /v1/customers*   (PII: online-token only for customer-specific reads)
    read_themes → GET /v1/themes*; write_theme_extensions → placements/embeds APIs
    write_webhooks → webhook subscription CRUD (topics ⊆ scope-allowed topic sets)
    read_store → GET /v1/stores/:id (public subset)
→ tenant guard: ctx.store_id must equal route store param / row tenant; cross-store = 403 + security event
→ rate bucket: key = installation_id (app traffic) | user (human); tiers: app 120/min + 4 rps burst, partner-api 60/min, storefront-app 600/min; 429 with Retry-After
```

## 3. New APIs (Deliverable 22)

| Group | Endpoints | Notes |
|---|---|---|
| OAuth hardening | `POST /v1/app-store/oauth/revoke`, `POST /oauth/rotate`, `GET /oauth/tokens` (merchant-visible token list) | on oauth_tokens |
| Versions | `POST /v1/app-store/developers/apps/:id/versions` (bundle upload), `POST /versions/:id/submit`, `GET /versions/:id/validation` | doc 11 §3 |
| Review ops | `GET /v1/app-store/review-queue`, `POST /review-queue/:id/{assign,approve,request-changes,reject}` | ops-role gated |
| Placements/Embeds | `GET/POST/PATCH/DELETE /v1/app-store/placements`, `PATCH /v1/app-store/embeds/:handle` | editor backend |
| App proxy | `ALL /proxy/apps/:handle/*` | signed forward, doc 13 §2 |
| Billing | `POST /v1/app-store/subscriptions`, `POST /subscriptions/:id/cancel`, `POST /usage-records` (idempotent), `GET /billing/statements` | doc 14 §4 |
| Partner API | `/v1/partner/{orgs,members,apps,versions,dev-stores,analytics,webhook-deliveries(+redrive)}` | api_keys auth; CLI-first |
| Webhook mgmt for apps | `GET/POST/DELETE /v1/app-store/webhooks` (scoped topics), `GET /webhook-deliveries?installation=` | consolidated registry |
| Compliance | `POST /v1/app-store/compliance/challenge` (platform→app verification), purge-status endpoint | H12, M18 |
| Token-exchange formalization | existing `/oauth/token-exchange` gains JWT session-token contract (aud=client_id, exp≤60s, jti replay-cache) | doc 10 §3 |

## 4. Cross-Cutting Policies
- **Versioning & deprecation:** quarterly API versions (`2026-07` style) via existing header; 12-month support window; deprecation headers (`Sunset`, `Deprecation`) + portal changelog; `/v1` path stays, header selects behavior revisions.
- **Idempotency:** `Idempotency-Key` honored on install/uninstall/charges/subscriptions/usage-records (idempotency_keys table) — H9.
- **Errors:** standardize `{error:{code,message,details,request_id}}` (M-level finding); error codes catalogued in shared-types.
- **Audit:** all app-token mutations emit audit_logs + outbox events; security events (cross-tenant 403, signature failures) → `security_enforcement_events` (table exists, baseline:6565 — gets a producer).
- **GraphQL:** `/graphql/admin` gains app-token auth with same scope map (field-level guards on PII); cost budgeting already present (20 pts/s) — extend per-app.
- **Docs generation:** scope map + topic catalog + error codes generated from shared-types into developer portal (single source, prevents drift).

## 5. Decommissions
- Marketplace BFF routes reduced to pass-through (no business logic).
- `bridge/fetch` ad-hoc token check replaced by strategy-3 middleware; endpoint retained for embedded-app CORS convenience.
- Tombstone plan for storefront PayPal webhook (A7) with 410 + log for one release.
