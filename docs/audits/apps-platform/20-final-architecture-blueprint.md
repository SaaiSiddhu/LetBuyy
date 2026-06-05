# Final Shopify-Style Architecture Blueprint (Phase 17 · Deliverable 25)

The complete target state: every subsystem integrated and synchronized in the manner of Shopify Online Store 2.0 + Shopify App Ecosystem, expressed on LetBuyy's canonical topology. This is the convergence of blueprints 10–17; conflicts resolve in favor of this document.

---

## 1. Full-System Diagram

```
┌────────────────────────────  DEVELOPER PLANE  ────────────────────────────┐
│ apps/developer-portal ──── /v1/partner/* ──┐                              │
│ @letbuyy/cli (P10+) ───────────────────────┤                              │
└────────────────────────────────────────────┼──────────────────────────────┘
                                             ▼
┌────────────────────────────  CONTROL PLANE (services/api-gateway)  ───────┐
│ app-store/{catalog reviews installations oauth embed charges developers   │
│            partners versions review placements proxy}  + scope middleware │
│ tables: marketplace_apps app_versions oauth_clients oauth_grants          │
│         oauth_tokens api_keys partner_orgs(+members) theme_app_extensions │
│         (+files) app_block_placements app_embed_states app_pricing_plans  │
│         app_subscriptions app_usage_records app_installations …           │
└──────┬──────────────────┬───────────────────────┬─────────────────────────┘
       │ review UI        │ consent/editor/billing│ outbox events
       ▼                  ▼                       ▼
 apps/platform-console  apps/merchant-control-plane   services/webhook-service ──HMAC──▶ app backends
 apps/platform-operations-portal (payout/KYC)         services/queue-workers (consumers)
       ▲                  │ theme publish                       ▲
       │                  ▼                                     │ app token (scoped)
┌──────┴───────  PUBLISH PIPELINE  ─────────┐          app backends ──────▶ /v1/* admin+storefront APIs
│ placements+embeds+TAE validate → precompile│                 │
│ → release manifest (+CSP, assets, pins)    │                 │ /apps/:handle/* signed proxy
└──────────────────┬─────────────────────────┘                 │
                   ▼                                           │
┌────────────────────────────  DELIVERY PLANE  ─────────────────┴───────────┐
│ apps/storefront-runtime: manifest-driven compose                          │
│   theme-engine LiquidRenderer (cached parse trees, budgets, app drop)     │
│   app blocks in any @app-accepting section · app embeds head/body         │
│   extension-host frames (cross-origin) · app-fragment loader island       │
│ services/media-service: R2 immutable CDN  apps/{app}/{ver}/*              │
│ edge: KV snapshots · revocation set · ISR tags · CSP nonces               │
└────────────────────────────────────────────────────────────────────────────┘
 Marketplaces: apps/app-marketplace + apps/theme-marketplace (honest-error thin clients)
 Identity: apps/identity-platform (humans) — app identity lives in control plane
```

## 2. Synchronization Contracts (the "exactly like Shopify" guarantees)

| Sync requirement | Mechanism |
|---|---|
| App install visible instantly in admin + marketplace | install txn → outbox `app.installed` → admin cache bust; installations API is source of truth |
| Block placed in editor appears on storefront only at publish | placement draft → release manifest snapshot → ISR tag invalidation (atomic with `theme_releases.is_current` flip) |
| Embed toggle is theme-agnostic | embed states stored per store (not per theme); manifest builder injects regardless of renderer (Liquid or JSON-contract) |
| App version update never mutates live stores silently | version pinning; merchant update action or platform forced-roll job |
| Uninstall removes shopper-visible content w/o merchant action | auto-republish job builds manifest minus app; tokens+webhooks revoked in same txn; purge T+48h |
| Theme switch preserves app content | placement migration prompt (slot-compatible auto-map; embeds carry over) — doc 04 B7 closed |
| Billing state gates app function | `app_subscriptions.past_due→frozen` flips installation `suspended(billing)`; scope middleware rejects; storefront suppresses extensions |
| Kill switch ≤60s globally | registry revoke → KV revocation set TTL 60s consulted by storefront + middleware |
| Webhook ↔ data consistency | transactional outbox (exists) — no dual-write anywhere |
| Docs ↔ runtime consistency | scope/topic/error catalogs generated from shared-types into portal |

## 3. Subsystem Final States (one line each, blueprint refs)
- Apps Marketplace: versioned listings, review pipeline, verified-install reviews, analytics (doc 14).
- Partner Platform: orgs/teams/credentials/dev-stores/webhook debugger/payouts on live gateway endpoints (doc 15).
- Theme Runtime: OS2.0 bundle + `@app` blocks in sections + settings extensions (docs 11/12).
- LiquidJS Runtime: namespaced render, app drop, filter whitelist, per-block budgets, publish-time precompile (doc 12).
- Storefront Runtime: manifest-driven, proxy + fragments, CSP, failure containment (doc 13).
- Theme Marketplace: unchanged catalog + slot-compat metadata + same review machinery as apps.
- Merchant App: consent, charge approval, app management, editor app-block UX (doc 06 gaps closed).
- Developer SDK: `@letbuyy/app-bridge`, Partner API, CLI (doc 15 §4).
- OAuth: token tables, exchange-first embedded auth, rotation/revocation (docs 10 §3, 17 §2).
- Permissions: canonical scope catalog enforced at middleware, dual-axis tenant guard (doc 17).
- Billing: subscriptions/usage/payouts/dunning + merchant approval UX (docs 14 §4, 16 §2).
- Webhooks: single registry, hashed secrets, caps, scope-bound topics, debugger (docs 16–17).
- Extensions/App Blocks/App Embeds: TAE bundles, validation, registry, lifecycle, CDN (doc 11).
- Database: hardened RLS, dual-axis rows, new tables, fresh-replay CI proof (doc 16).
- Ownership: doc 19 table is normative; governance validators enforce.

## 4. Invariants (architecture acceptance criteria)
1. No shopper request performs installation-config normalization, network-in-Liquid, or service-role DB access.
2. Every credential is a revocable row; every grant has an artifact; every mutation has an audit row.
3. Every extension byte shipped to a storefront is version-pinned, sha-verified, and kill-switchable ≤60s.
4. Every app-platform table: tenant NOT NULL + FK + owner-scoped RLS; `USING(true)` count on these tables = 0.
5. One registry per concern (webhooks, reviews, extensions); zero duplicate sources of truth.
6. `pnpm typecheck`, `pnpm run validate:governance`, RLS fuzz suite, and fresh-migration-replay all green in CI — permanently.
