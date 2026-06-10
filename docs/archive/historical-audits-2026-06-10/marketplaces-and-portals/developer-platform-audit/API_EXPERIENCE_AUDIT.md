# API Experience Audit (Phase 9)

> Evaluates the developer-facing API experience: discoverability, documentation, authentication, consistency, error handling, examples, and SDK support. Grounded in the gateway surface as documented in `developer-surface.ts`/`reference.ts` and the routes they cite.

## Summary

The **API itself is strong and broad** (~30 `/v1` route groups, real OAuth, scoped app API, GraphQL, idempotent payments). The **experience of consuming it** is weak: no explorer, no OpenAPI, no SDKs beyond one wrapper, inconsistent envelopes the docs themselves warn about, and reference content that is accurate but unstyled and split across contradictory pages.

| Dimension | Rating (0–10) | One-liner |
|---|---:|---|
| Discoverability | 3 | Curated tables only; no search, no OpenAPI, two contradictory API pages |
| Documentation | 5 | Accurate + source-backed, but reference-only and half unstyled |
| Authentication | 8 | Excellent: OAuth auth-code + PKCE, scoped tokens, rotation |
| Consistency | 4 | Multiple response envelopes + mixed key casing (docs admit it) |
| Error handling | 6 | Structured codes exist; no consolidated catalog/handling guide |
| Examples | 5 | Real request/response snippets; no runnable/multi-language |
| SDK support | 2 | One server wrapper; no browser SDK, no codegen |
| **Overall** | **4.7** | Capable API, undercooked API *experience* |

---

## 1. Discoverability — 3/10
- **Curated, not generated:** route groups + endpoints are hand-listed (`gatewayRouteGroups`, `appStoreEndpoints`, etc.). Accurate today, but will **drift** from the real routes with no generation step.
- **No OpenAPI / introspection artifact** checked in (confirmed). No Postman collection, no codegen.
- **No search** on the portal.
- **Two contradictory reference pages** (`/api` vs `/api-reference`) — one lists GraphQL, the other omits it (see Content Gap A-2).
- **GraphQL under-exposed:** Admin + Storefront GraphQL are mounted with query-cost limiting, but there's no schema doc, no example operations beyond a one-liner, and no GraphiQL.

## 2. Documentation quality — 5/10
- **Pro:** every endpoint row carries method/route/auth/status/behavior/**source** — unusually rigorous; the response-contract and payment-safety matrices are genuinely useful.
- **Con:** it's 100% reference (no conceptual guides), and the richest tables render **unstyled** (System B). One cited source file (`CODEX_WS10_LEDGER.md`) **doesn't exist**.

## 3. Authentication — 8/10 (the platform's strongest area)
- Auth-code + **PKCE S256**, 15-min hashed codes, replay protection (`redeemed_at`), refresh-token rotation (hash-only), merchant-session `token-exchange`, 15-min embed sessions, scoped server API `/v1/app/*` that **rejects** merchant-dashboard use and mismatched `store_id`.
- Clear scope model (`read_products/orders/customers/themes/storefront`, `write_themes`, `app_collaboration`) checked against `api_scopes`.
- **Gap:** no UI to obtain/rotate/inspect credentials; no "test token" path; bridge is GET-only.

## 4. Consistency — 4/10 (the docs candidly flag this)
The portal's own `gatewayResponseContracts` admit **multiple, divergent envelopes** the developer must defensively handle:
- `{ success:true, data, …meta }` (standard)
- `{ success:true, data, meta:{page,…} }` (paginated)
- `{ success:false, error:{code,message,status} }` (helper error)
- `{ error:{code,message} }` **without** `success` (compatibility) — docs warn: "branch on the error object and status instead of relying only on success=false."
- `{ error:{code,message,details?} }` (typed AppError)
- `{ error:{code:"INTERNAL_ERROR",…,request_id} }` (unexpected)

And **mixed key casing by surface**: protected merchant routes use `idempotency_key`; storefront routes use `idempotencyKey` (docs: "Match the exact route casing. The portal should not normalize casing for developers until an SDK layer exists"). For an external developer this is real cognitive load and a bug magnet — exactly what an SDK normally hides.

## 5. Error handling — 6/10
- Structured codes exist and are sanitized server-side: `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `DB_ERROR`, `RATE_LIMIT_UNAVAILABLE`, `QUERY_COST_RATE_LIMITED`, `AMOUNT_MISMATCH`, `INVALID_GRANT`, `CONFLICT`, `INTERNAL_ERROR` (+ `request_id` for support).
- **Gap:** these are **scattered** across pages with no single error-code catalog and no "how to handle 429/INVALID_GRANT/AMOUNT_MISMATCH" guidance. Rate-limit headers (`X-RateLimit-*`) are documented but without a backoff recipe.

## 6. Examples — 5/10
- Real, source-derived request/response snippets for OAuth, bridge, theme upload, webhooks.
- **Gap:** static `<pre>` only — no copy button, no language tabs, no end-to-end runnable example (e.g., a complete Node webhook receiver), no cURL-for-every-endpoint.

## 7. SDK support — 2/10
- Only `createLetbuyyAppSdk` (`@letbuyy/api-client`) — a minimal **server-side** wrapper exposing `products()`, `orders()`, `updateInstallationMetadata()` over the scoped app API.
- **No browser App Bridge SDK** (capabilities `api.fetch/toast/resize` are listed but unimplemented as a package), **no multi-language libraries**, **no typed client from a schema** (blocked by missing OpenAPI/GraphQL codegen).

---

## Notable API strengths (keep & advertise)
- **Payment safety by design:** server owns totals; client `amount` is a hint that triggers `AMOUNT_MISMATCH`; idempotency keys on all retryable mutations; provider verification (Razorpay/Stripe/Cashfree/PayPal) with HMAC checks. This is *better* than many platforms and is barely surfaced as a selling point.
- **Compliance built in:** mandatory `customers/data_request`, `customers/redact`, `shop/redact` topics always attached — GDPR-style parity with Shopify.
- **Query-cost rate limiting** with transparent `X-RateLimit-*` headers and a published cost model.

## Top API-experience fixes
1. **Generate an OpenAPI doc** from the gateway and drive the reference + a Postman collection + typed clients from it (kills discoverability + consistency + SDK gaps at once).
2. **Ship GraphiQL** (Admin + Storefront) wired to a dev store/token.
3. **Publish a real SDK** (browser App Bridge + at least one server lib) that **normalizes the envelope and key casing** so developers stop hand-handling six response shapes.
4. **One error-code catalog** with handling recipes (429 backoff, INVALID_GRANT re-auth, AMOUNT_MISMATCH refresh).
5. **Consolidate to one reference page**, restyle it, add copy buttons + language tabs.
