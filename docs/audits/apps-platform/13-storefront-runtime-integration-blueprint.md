# Storefront Runtime Integration Blueprint (Phase 12)

Apps ↔ Storefront Runtime / Theme Renderer / LiquidJS / CDN / Caching: rendering, request, data, and extension lifecycles in the target architecture.

---

## 1. Rendering Lifecycle (target)

```
PUBLISH TIME (merchant clicks Publish in theme editor)
 1. Resolve placements + embed states + extension versions for store
 2. Validate against registry status (revoked filtered) and extension schemas
 3. Precompile: parse all liquid (theme sections + app blocks/embeds) → parse-tree cache artifacts (KV)
 4. Materialize release manifest:
    { renderer, schema_version, templates, sections, placements[], embeds[], assets[{cdn_url, sha256, loading}],
      csp: {script_nonce_required, app_origins[]} }
 5. Write theme_releases row (is_current flip) + cache-tag invalidation (existing ISR tags)

REQUEST TIME (storefront-runtime)
 1. subdomain → store snapshot (KV-cached by current_theme_release_id)   ← removes per-request store-service normalization
 2. route → template from manifest
 3. data plan: Promise.all(theme section data ∪ app-declared data)        ← doc 09 C2
 4. render: cached parse trees → section loop (native + app blocks) → layout → buffers (head/body embeds)
 5. sanitize (nonce-aware) → stream response; cache: full-page tags (store, release, route) + fragment policy below
```

## 2. Request Lifecycle Contracts
- **App proxy:** `GET/POST {store-domain}/apps/:appHandle/*` → gateway `app-proxy` module → verify app published+installed → forward to app origin with signed params (`store_id`, `timestamp`, `path`, HMAC w/ client secret; reject skew >90s at app side) → response streamed; `Cache-Control` honored ≤5m; `Liquid: false` always (no remote liquid eval v1). Enables personalized fragments + form posts without CORS/cookies pain (closes doc 05 §2 gap).
- **Storefront API for apps:** public `/v1/storefront` REST+GraphQL gains optional app-token auth tier with higher rate buckets + private fields gated by scopes (e.g., customer-scoped queries only via online token).
- **Headers/CSP:** storefront responses emit CSP: `script-src 'self' cdn.letbuyy.store 'nonce-{n}' {app_origins from manifest}`; frame-src limited to installed apps' declared origins. Fixes C6 hardening at the response layer too.

## 3. Data Lifecycle
- Manifest pins everything shopper-visible; installation config changes (e.g., merchant edits block settings) take effect via editor save → draft → publish (or "quick publish" auto-release for settings-only diffs — same release machinery, keeps audit).
- App-declared data deps resolved by data-binding-engine with per-request budget: ≤4 app data fetches/page, 150ms total, fail-soft per block.
- Shopper-personalized data: never SSR'd through Liquid; via app-proxy fragments (`<div data-app-fragment src>` hydrated client-side by platform mini-loader) or app asset JS.
- Cart/checkout mutations from app JS: only through public storefront cart API with same-origin platform endpoints (existing hydration-island pattern: add-to-cart island reused).

## 4. Extension Lifecycle at the Edge
- Kill switch: registry `revoked` → next manifest rebuild excludes extension; **also** edge check: storefront resolver consults a KV `revoked_extensions` set (60s TTL) so platform can suppress a malicious extension without waiting for merchant republish (fixes H11 with immediacy).
- Version update flow: developer publishes vN+1 → installations pinned at vN; merchant "Update" in admin re-pins + auto-republish; forced security roll: platform bulk re-pin + manifest rebuild job (rate-limited, status in ops portal).
- Uninstall: placements soft-deleted → auto-republish manifest without app content → purge job.

## 5. CDN & Caching Layers

| Layer | Content | Key | Invalidation |
|---|---|---|---|
| R2+CDN (media-service) | app/theme assets, immutable | `apps/{app}/{version}/{path}` | never (immutable); new version = new path |
| KV parse-tree cache | compiled liquid | `(release_id, ext_version, path)` | release supersede |
| KV store snapshot | store+release header | `store:{id}` | publish, store update |
| ISR/page cache (existing tags) | full HTML | store/release/route/template tags | publish; app-proxy fragments excluded (`no-store` regions) |
| Edge revocation set | kill switches | global | 60s TTL |

Rule: an app changing its iframe/proxy content must never bust page cache — only fragment/asset layers (fixes doc 05 §3 cache gap).

## 6. Failure Containment Matrix

| Failure | Containment |
|---|---|
| App block render error | block-level comment + log + event; page renders |
| App embed asset 404 | script tag dropped at manifest build (sha verified); runtime onerror beacon |
| App proxy timeout (>3s) | fragment placeholder; circuit breaker per app (KV counter) → auto-suppress 5m |
| Extension revoked mid-traffic | edge set suppresses ≤60s |
| Release manifest corrupt | resolver falls back to previous `theme_releases` row (rollback pointer exists) |

## 7. Storefront-Runtime Code Changes (delta to today)
1. `template-resolver.ts`: read placements/embeds/assets from release manifest (not store-service injection); consult revocation set.
2. `composition-engine.tsx`: head/body buffer application for both renderers; generic app-block host; remove hand-rolled iframe policy in favor of extension-host frame component.
3. `store-service.ts`: delete `injectAppBlocksIntoSections` after migration (doc 12 §8); snapshot fetch via KV.
4. New `app-fragment-loader` island (joins existing islands list in theme-bundle.ts:30-51).
5. Demo-store gate (doc 09 B3) and PayPal route relocation (A7) ride along.
