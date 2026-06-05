# Theme App Extensions Platform Blueprint (Phase 10 · Deliverables 8, 9, 10)

Covers: Theme App Extensions (TAE), App Blocks, App Embeds, Section/Block/Theme-Settings extensions — registry, lifecycle, validation, deployment, runtime contracts. Builds on the existing Liquid bundle contract (`THEME_LIQUID_BUNDLE_SCHEMA_VERSION='2026-06-liquid-sections'`).

---

## 1. TAE Bundle Format (developer-facing)

```
extension/                          (uploaded per app version)
├── shopify-parity note: mirrors blocks/snippets/assets/locales layout
├── blocks/
│   ├── star-rating.liquid          ← APP BLOCK  ({% schema %} target: "section")
│   └── announcement.liquid         ← APP EMBED  ({% schema %} target: "head" | "body")
├── snippets/
│   └── price-format.liquid         ← private snippets, renderable only from this extension's blocks
├── assets/
│   ├── widget.js                   ← served from CDN, loaded only when block placed
│   └── widget.css
└── locales/
    └── en.default.json
```

Block schema (inside `{% schema %}` … `{% endschema %}`, stripped before render exactly like current `stripLiquidSchemaBlocks()`):
```json
{
  "name": "Star rating",
  "target": "section",                  // "section" = app block; "head"|"body" = app embed
  "settings": [ {"type":"select","id":"size", ...} ],   // reuse theme-engine field types (text, richtext, color, image, select, toggle, range, number, url, radio)
  "javascript": "widget.js",            // optional; conditional asset
  "stylesheet": "widget.css",
  "default": { "settings": {"size":"md"} }
}
```

Naming/limits (enforced by validator): handle regex same as sections (`^[a-z0-9]+(?:[-_][a-z0-9]+)*$`), ≤25-char display names (theme-editor fit), ≤200KB per liquid file (existing cap), ≤10 blocks + ≤5 embeds per extension, assets ≤1MB ea / 5MB total, locales valid JSON.

## 2. Extension Registry Architecture

New tables (full DDL in doc 16):
- `theme_app_extensions` — one row per app version's TAE (`app_version_id` FK, manifest jsonb, validation_report jsonb, status `draft|validated|published|revoked`).
- `theme_app_extension_files` — path, kind (`block|embed|snippet|asset|locale`), sha256, r2_key (immutable `apps/{app_id}/{version}/{path}`).
- `app_block_placements` — merchant placements: `(store_id, installation_id, extension_handle, block_handle, template_key, section_id, position, settings jsonb, status)`.
- `app_embed_states` — `(store_id, installation_id, embed_handle, enabled bool, settings jsonb)`.

Existing `app_extensions` (baseline:8333) + migration 076 registry rows remain the per-install enable/disable layer; TAE tables are the **content** layer. Relationship: registry row references `theme_app_extensions.id` instead of free-form config.

## 3. Validation Rules (ingestion pipeline)

Executed on `POST /v1/app-store/developers/apps/:id/versions` (zip upload → R2 staging → validate → promote):
1. Structure: only allowed dirs/paths; path regexes; size caps.
2. Liquid safety — reuse `theme-bundle.ts` validators: forbid `<script` inline (JS only via `javascript` asset ref), `{% include %}`, `{% layout %}`; **allow** namespaced `{% render 'app:<app>/<snippet>' %}` only to own snippets (new tag whitelist — see doc 12 §3).
3. Schema: `{% schema %}` parses; settings use approved field types; embed targets only `head|body`; block target `section`.
4. Asset integrity: sha256 recorded; no remote `src=` in liquid except platform CDN + declared app origins (CSP list).
5. Render smoke test: each block rendered server-side with default settings against a fixture context inside the sandboxed engine (parse/render/memory limits already exist) — failures block validation.
6. Compliance: app version must register `MANDATORY_COMPLIANCE_WEBHOOK_TOPICS` handlers (fixes H12) before `published`.
Validation report persisted (developer-visible in portal), pass required for review submission.

## 4. Extension Lifecycle

```
upload → validated → (version review: doc 14) → published
                                   │
 merchant installs app ────────────┤  (extension auto-available; embeds default OFF, blocks unplaced)
 merchant places block in editor ──▶ app_block_placements (draft) ─┐
 merchant toggles embed ───────────▶ app_embed_states ─────────────┤
 theme publish ────────────────────────────────────────────────────┴▶ release manifest snapshot:
        { placements:[{block, extension@version, section, position, settings}], embeds:[…], assets:[cdn urls] }
 app version update → installations pinned; merchant prompted to update; platform kill switch = registry 'revoked'
 uninstall → placements/embed states soft-deleted; theme re-publish removes from manifest; purge job T+48h
```

## 5. App Blocks — Runtime Contract
- Themes opt in per section: section `{% schema %}` gains `"blocks": [{"type": "@app"}]` (Shopify-compatible). `appBlockSlot` sections remain as legacy fallback during migration; new model lets merchants position app blocks inside any accepting section, ordered with native blocks via `block_order`.
- Render: app block compiles like a theme block; scope receives `block.settings` (merchant values), `app` drop `{handle, version, proxy_url, asset_url}`, plus standard section context. No access to other apps' scopes; engine per-extension render budget (time/memory) with per-block try/catch → block-level error comment, never page failure.
- Assets: `{{ 'widget.js' | app_asset_url }}` filter resolves to immutable CDN path; injected `<script defer>` collected per page **only for placed blocks** (Shopify conditional-loading behavior).
- Data binding: optional `"data": ["product","collection","cart"]` in schema → data-binding-engine fulfills alongside product fetches (doc 05 §5.6).

## 6. App Embeds — Runtime Contract
- Targets `head`/`body`; default OFF; merchant toggles in editor (Shopify UX: on/off, not positioned).
- Injection point: existing engine globals — `content_for_header`/`content_for_footer` become computed: platform concatenates enabled embeds' rendered output (sanitized; scripts only via asset refs with CSP nonce).
- Works for both renderers: JSON-contract pages get the same injected head/body fragments via composition-engine wrapper, making embeds theme-version-agnostic (Shopify parity).
- Use cases unlocked: analytics pixels, chat widgets, popups, cookie banners — currently impossible (score 0 in doc 03).

## 7. Section/Theme-Settings Extensions
- **Section extensions** (app-provided full sections): deferred to post-MVP; same bundle format with `target:"template"`; requires editor section-picker integration.
- **Theme settings extensions**: apps may contribute a settings group rendered in theme editor (`settings_schema` fragment, namespaced `apps.<handle>.*`), persisted in `app_embed_states.settings` / placement settings — never into the theme's own `settings_data` (ownership boundary).

## 8. Deployment Flow (developer)
1. `letbuyy app extension create/dev/deploy` CLI (roadmap P10; until then portal upload).
2. Deploy = new draft `app_versions` row + bundle upload; validation report returned synchronously (<30s target).
3. Publish after review; CDN paths immutable; rollback = repoint installations' pin to prior version (no asset deletion).

## 9. Theme Editor Integration (control-plane)
- Editor queries `GET /v1/app-store/installations?store=…&surface=theme` → available blocks/embeds for picker.
- Placement CRUD: `POST/PATCH/DELETE /v1/app-store/placements` (new module) writing `app_block_placements`; draft → preview token flow already exists (`theme_preview_sessions`) — preview render includes draft placements (closes doc 04 B8).
- Editor renders block settings form from extension schema (same form engine as section settings).

## 10. Runtime Ownership
theme-engine: tag/filter whitelist, render budgets, schema parse. app-engine: bundle/manifest validators, placement types. media-service: R2 CDN, signed uploads, immutability. gateway: versions/placements/embed APIs, review gates. storefront-runtime: manifest-driven composition only (no per-request normalization — doc 10 §6.1). control-plane: editor UX. **No component reaches across these lines; violations = governance failure.**
