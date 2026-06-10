# LiquidJS Runtime Integration Specification (Phase 11)

How apps integrate with the LiquidJS runtime: templates, sections, blocks, snippets, assets, theme/store/merchant settings; registration, injection, data flow. Extends the shipped engine (`packages/theme-engine/src/theme-renderer.ts`) — no engine replacement.

---

## 1. Current Engine Facts (baseline to extend)
- liquidjs@^10.27.0; `createLiquidEngine()` per bundle: `cache:false`, strictFilters, dynamic partials disabled, limits parse 300K / render 250ms-class / memory 2M; globals `content_for_header`, `content_for_footer` (theme-renderer.ts:230-250).
- Scope built by `buildLiquidScope()` (:332-362): `shop{id,name,subdomain}`, `request{path,locale,preview,request_id}`, `settings` (theme settings_data), `routes{root_url,cart_url,search_url}`, `content_for_layout`, `section{id,type,settings,blocks,block_order,schema}`, `block{id,type,settings,schema}`.
- Source validator forbids `<script`, `{% include %}`, `{% layout %}`, `{% render %}` (theme-bundle.ts) — `{% render %}` ban must be **selectively lifted** for app snippets (below).
- App blocks today: pre-rendered HTML strings passed via `liquidAppBlocks` map → resolved by id/extension/slot (composition-engine.tsx:124-149).

## 2. How Apps Register Into Liquid (target)

| App contribution | Registration mechanism | Render mechanism |
|---|---|---|
| App block (`blocks/*.liquid`, target section) | TAE ingestion → `theme_app_extension_files` → placement rows → release manifest | Compiled as a block template; rendered inside owning section's block loop with `block.settings` |
| App embed (`blocks/*.liquid`, target head/body) | Same ingestion → `app_embed_states` | Rendered standalone at publish/request into `content_for_header/footer` buffers |
| App snippet (`snippets/*.liquid`) | Ingestion; private namespace | `{% render 'app:<appHandle>/<snippet>' %}` from that app's own blocks only |
| App asset | R2 immutable path | `app_asset_url` filter |
| App data | manifest `data:[…]` declaration | injected as `app.data.<kind>` drop |

## 3. Engine Extensions (theme-engine changes)

1. **Namespaced render tag.** Register custom tag `render` with resolver policy:
   - theme sources: still forbidden (unchanged validator) until theme-snippets ship;
   - app block sources: allowed iff target starts `app:<ownAppHandle>/` and file exists in the same extension version. Implemented via liquidjs `FS` abstraction keyed to the bundle+extension file map — dynamic partials stay disabled; resolution is from an in-memory map, never disk/network.
2. **`app` drop** (per app-block/embed render): `{ handle, version, asset_url(base), proxy_url, settings (embed/global app settings), data{...} }`. Apps cannot read `shop` beyond the public subset already exposed; no secrets in scope (extension-host purity rule).
3. **Filters added (whitelist):** `app_asset_url`, `money`, `money_with_currency` (store currency from settings), `t` (locale lookup into extension locales), `image_url` (platform CDN transformer). strictFilters retained; anything else errors at validation time (render smoke test catches).
4. **Per-render budgets:** wrap each app block/embed `parseAndRender` in its own budget (time 25ms CPU-class, output ≤64KB, memory slice) — failure yields `<!-- app-block <handle> failed -->` + structured log + `app_block.render_failed` event; page never 500s on app code.
5. **Compiled-template cache:** parse cache keyed `(release_id, extension_version, path)`; populated at publish (precompile job), LRU per isolate at runtime (refactor C1 in doc 09).

## 4. Data Flow Into Liquid (app perspective)

```
merchant settings (placement.settings / embed.settings)  ──▶ block.settings / app.settings
theme settings (settings_data.current)                   ──▶ settings.*            (read-only to apps)
store data (shop drop)                                    ──▶ shop.*               (public subset)
app-declared data deps (product/collection/cart)          ──▶ app.data.*           (fetched by data-binding-engine, parallelized)
app backend dynamic content                                ──▶ NOT via Liquid: use app proxy fragment or client JS asset
                                                              (keeps render hermetic; no network in engine — extension-host rule)
```
Rule: **the Liquid engine performs zero network I/O.** Dynamic per-shopper app content is client-side (asset JS hitting app proxy) or edge-included via proxy fragments (doc 13 §4) — mirrors Shopify (Liquid renders merchant-configured state; live data via storefront API/app proxy).

## 5. Injection & Composition Order (request lifecycle)

```
resolve release manifest (placements, embeds, assets, precompiled refs)
 ├─ head buffer  = Σ enabled embeds(target:head)  + asset <link>/<script defer nonce>
 ├─ body-end buffer = Σ enabled embeds(target:body)
 ├─ per section: native blocks ∪ app blocks (placement order) → block loop render
 ├─ layout render with content_for_header/footer = platform fragments + embed buffers (sanitized)
 └─ sanitizeRenderedHtml stays as final defense (allow nonce'd script tags emitted by platform asset injector only — sanitizer gains nonce-allowlist)
```
JSON-contract themes: identical buffers applied by composition-engine wrapper; app blocks render via a generic `apps.app-block` React host that hydrates the same compiled HTML — single source of truth.

## 6. Settings Integration
- Store settings: existing `settings` scope unchanged.
- Merchant app-block settings: validated against extension schema at placement write (closes doc 04 §4 schema gap), stored in placement row, snapshotted at publish.
- Theme settings extensions (apps adding settings groups): namespaced `apps.<handle>` group surfaced in editor; values land in `app_embed_states.settings` — exposed to that app's renders only, never to other apps or theme sources.

## 7. Security Invariants (engine-level)
1. App liquid validated at ingest (doc 11 §3) AND rendered under runtime budgets — defense in depth.
2. No `include/layout`; `render` restricted to own-extension namespace; no dynamic partial resolution.
3. Output sanitation final-pass with nonce-allowlisted scripts only; embeds cannot emit inline `<script>` (must use asset refs) — eliminates stored-XSS-via-extension class.
4. Scope isolation: per-block fresh scope; no shared mutable globals between extensions; `shop` drop is a frozen projection.
5. SSTI surface: user/merchant strings interpolate as data (scope values), never concatenated into template source; placement settings are data-only — validator rejects liquid syntax inside setting values of type ≠ `liquid` (no such type offered v1).

## 8. Migration From Current Slot System
1. Ship TAE pipeline alongside slots; `AppBlockInstance` render path untouched.
2. Provide codemod: existing inline instances → generated trivial app block (`content` fields → schema settings); iframe instances → block wrapping sandboxed frame (cross-origin per C6 fix).
3. Editor shows legacy instances read-only with “migrate” action; slot sections (`appBlockSlot`) deprecated after 2 releases; `injectAppBlocksIntoSections()` deleted when zero legacy placements remain (tracked metric).
