# Target Apps Platform Architecture (Phase 9)

Design constraint: respect the canonical runtime map and reserved service roots (`docs/governance/runtime-boundaries.md`). No new top-level runtimes are invented; the platform is realized by completing existing roots.

---

## 1. End-to-End Flow (Shopify-shaped, LetBuyy-mapped)

```
DEVELOPER
   │ 1. registers org/team ──────────────▶ apps/developer-portal (UI) → gateway /v1/app-store/developers/*
   │ 2. creates app + credentials ───────▶ marketplace_apps + oauth_clients (client_id / hashed secret / redirect_uris / scopes)
   │ 3. builds extensions (CLI bundle) ──▶ POST /v1/app-store/developers/apps/:id/versions  (TAE bundle, embeds, functions)
   │ 4. submits version for review ──────▶ app_versions.status = submitted
PLATFORM STAFF
   │ 5. review queue ────────────────────▶ apps/platform-console (review UI) → approve/reject + checklist artifacts
MERCHANT
   │ 6. discovers ───────────────────────▶ apps/app-marketplace (catalog of published app_versions)
   │ 7. installs ────────────────────────▶ consent screen (control-plane) → POST install → app_installations (+pinned version)
   │ 8. OAuth ───────────────────────────▶ authorize→code→token  /  embedded: session→token-exchange   (oauth_tokens)
   │ 9. approves billing ────────────────▶ app_subscriptions / app_billing_charges (merchant approval UX in control-plane)
   │10. places app blocks / toggles embeds ▶ theme editor (control-plane) → app_block_placements → theme release snapshot
SHOPPER
   │11. storefront render ───────────────▶ storefront-runtime: release-pinned placements → Liquid app blocks/embeds → CDN assets
APP BACKEND
   │12. webhooks ────────────────────────▶ outbox → webhook-service (HMAC, retries) → app URL
   │13. admin API calls ─────────────────▶ gateway /v1/* with app token (scope-enforced)
   │14. app proxy ───────────────────────▶ store domain /apps/:handle/* → signed forward → app origin
```

## 2. Runtime Ownership Matrix (target)

| Capability | Owning runtime | Today | Change |
|---|---|---|---|
| App OAuth server (authorize/token/exchange/revoke) | `services/api-gateway` (module `app-store/oauth`) | gateway monolith file | keep owner; split module; add token tables |
| Consent UI | `apps/merchant-control-plane` | absent | new surface `/[store]/apps/authorize` |
| App catalog & listing pages | `apps/app-marketplace` | same | unchanged |
| Developer console | `apps/developer-portal` | shell | build on existing endpoints |
| Review/moderation | `apps/platform-console` | absent | new queue UI; status machine in gateway |
| Extension ingestion & validation | `services/api-gateway` (versions endpoint) + `packages/app-engine` validators | absent | new |
| Extension asset hosting | R2 `letbuyy-media-*` via `services/media-service` (activate reserved root) | stub root | charter: app/theme asset CDN, signed upload, immutable version paths |
| App webhooks delivery | `services/webhook-service` | same | consolidate registries (drop app_webhooks) |
| Domain events fanout | `services/event-bus` (activate reserved root) **or** keep gateway cron | stub | decision doc 19 §4 — recommended: keep outbox dispatch in gateway short-term; event-bus charter = consumer fanout + replay API (Phase 9+ of roadmap) |
| App-block placement storage | gateway (placements API) + theme release snapshot | implicit in install config | new table + publish-time snapshot |
| Storefront extension rendering | `apps/storefront-runtime` + `packages/theme-engine` | slots v0 | TAE renderer (doc 11/12) |
| Embedded admin host (iframe + App Bridge) | `apps/merchant-control-plane` + `packages/extension-host` + new `@letbuyy/app-bridge` (in `packages/typescript/`) | unwired | wire host; ship client SDK |
| Functions runtime | deferred; executor inside gateway worker w/ isolates (roadmap P10+) | types only | explicit non-goal until extensions ship |
| Checkout UI extensions | `services/checkout-runtime` (activate reserved root) + runtime-composition adapter | scaffold | charter after TAE |

## 3. Identity & Token Architecture (target)

```
oauth_clients      (app_id FK, client_id, client_secret_hash, redirect_uris[], scopes[], type: public|confidential)
oauth_grants       (installation_id, scopes_granted[], granted_by, consent_artifact, created_at)   ← consent record
oauth_tokens       (id, installation_id, kind: offline|online|embed, token_hash, scopes[], expires_at,
                    last_used_at, rotated_from, revoked_at, created_ip)
api_keys           (developer_id, app_id NULL, key_hash, scopes[], label, last_used_at, revoked_at) ← partner API
```
- Embedded apps: control-plane hosts iframe → `@letbuyy/app-bridge` obtains short-lived session JWT (claims: iss=letbuyy, aud=client_id, dest=store, exp≤60s) → app backend calls `/oauth/token-exchange` → online token. Mirrors Shopify's recommended token-exchange flow.
- Offline token issued at install for background work; rotation endpoint; revocation cascades on uninstall.
- Scope catalog (`packages/shared-types`): `read_products, write_products, read_orders, write_orders, read_customers, write_customers, read_themes, write_theme_extensions, read_store, write_script_embeds, read_checkout, write_webhooks, read_analytics` — each mapped to gateway route groups by middleware (doc 17 §2).

## 4. Lifecycle State Machines (canonical)

**App version:** `draft → submitted → in_review → changes_requested → approved → published → deprecated → delisted` (transitions logged; publish requires compliance-webhook check + extension validation pass).
**Installation:** `installing → active → update_available → suspended(billing|policy) → uninstalled → purged` (purge job T+48h emits `app.data_purge.completed`).
**Charge:** existing `pending_merchant_approval → approved → active → cancelled|failed` + `app_subscriptions`: `trialing → active → past_due → cancelled|frozen`.
**Extension registration (per install):** `enabled ⇄ disabled → revoked` (revoked = platform kill switch, honored by storefront resolver — fixes H11).

## 5. Integration Diagram (target, components & contracts)

```
 developer-portal ── REST ──▶ api-gateway/app-store/developers ──▶ marketplace_apps, app_versions, oauth_clients
 platform-console ── REST ──▶ api-gateway/app-store/review ─────▶ app_versions.status (+audit)
 app-marketplace ─── REST ──▶ api-gateway/app-store/catalog
 control-plane ───── REST ──▶ api-gateway/app-store/{install,oauth,charges,placements}
        │ iframe + app-bridge ◀──────────────── embedded app (app origin)
 storefront-runtime ─ reads ─▶ theme release manifest (placements, embeds, asset refs)
        │ {% render app blocks %} ──▶ theme-engine LiquidRenderer
        │ asset URLs ─────────────▶ media-service CDN (R2, immutable /apps/:app/:version/*)
        │ /apps/:handle/* ────────▶ api-gateway app-proxy ──signed──▶ app backend
 app backend ◀── HMAC webhooks ── webhook-service ◀── outbox ── api-gateway domain events
 app backend ── Bearer app token ─▶ api-gateway /v1/* (scope middleware)
```

## 6. Design Principles (binding for blueprints 11–17)
1. **Publish-time resolution, request-time speed:** anything a shopper request needs (placements, embeds, asset manifests, compiled templates) is materialized at theme/app publish into the release manifest; storefront never normalizes installation config per request.
2. **Version pinning:** installations pin `app_version_id`; extension behavior changes require version publish + (optionally) merchant update; platform can force-roll with kill switch.
3. **Single registry per concern:** one webhook registry, one review table, one extension registry — duplicates die (doc 08 Batch 3).
4. **Tokens are rows, not JSON:** every credential queryable/revocable/auditable (C3).
5. **Apps are tenants of tenants:** every app-originated row carries `(store_id, app_id, installation_id)`; RLS + scope middleware enforce both axes.
6. **Reserved roots get charters or die:** each stub service either receives a real scope in this architecture (media-service, event-bus, checkout-runtime, notification-service) or its root is retired via governance PR (doc 08 Batch 2).
