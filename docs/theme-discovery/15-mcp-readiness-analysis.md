# MCP Readiness Analysis

**Date:** 2026-06-18
**Status:** Research document — no code changes
**Sources:** `services/api-gateway/src/routes/themes.ts`, `stores.ts`, `products.ts`, `pages.ts`, `ai.ts`; `apps/merchant-control-plane/src/app/api/themes/route.ts`; `docs/theme-research/09-target-theme-architecture.md`

---

## 1. What MCP Theme Operations Would Enable

The Model Context Protocol (MCP) turns LetBuyy into a callable tool surface for AI models. Instead of a merchant manually configuring their store, an AI agent — running in Claude, a custom chatbot, or an automated onboarding pipeline — can:

- **Read store state**: query the current theme, schema, releases, and section configuration.
- **Configure the storefront**: apply an industry preset, update a section's copy, swap hero images, change color tokens, and publish in one programmatic chain.
- **Generate commerce content**: create products with AI-drafted descriptions, build policy pages, construct navigation from a product catalog, and seed a homepage layout tuned to a merchant vertical.
- **Automate store creation**: a fully agentic "create my store" flow — from subdomain registration through theme install and first product — without the merchant ever opening the merchant-control-plane UI.

The business value is principally in three moments: (a) onboarding acceleration, where a new merchant gets a configured, themed store in seconds via AI, (b) theme refresh, where an existing merchant invokes an agent to regenerate their homepage for a new season, and (c) multi-store management, where an operator or agency manages many stores programmatically.

---

## 2. MCP Existing Infrastructure

### Evidence Summary

No purpose-built LetBuyy MCP server exists in the repository. The following evidence was gathered:

| Search | Finding |
|--------|---------|
| `find . -name "*.mcp.*"` | 0 results (excluding node_modules) |
| `find . -name "*mcp*tool*"` | 0 results |
| `grep -rn "McpServer\|createMcpServer\|graphify-mcp" --include="*.ts"` | 0 results in source files |
| `.claude/settings.json` | Contains only `CLAUDE_CODE_SUBAGENT_MODEL` env var; no MCP server registrations |
| `CLAUDE.md` | Documents `graphify-mcp is also installed (operator-registered; not auto-added to .claude/)` — this is the Graphify code-graph MCP (operator's local machine, not the LetBuyy API) |
| Package.json files | No `@modelcontextprotocol/sdk` or `mcp-server-*` entries |

**Conclusion:** There is no MCP server targeting the LetBuyy REST API. The only MCP present is the third-party `graphify-mcp` registered on the operator's machine for code-graph queries; it does not expose LetBuyy as a callable tool to external agents.

### What Does Exist (relevant pre-conditions)

1. **A rich REST API** — The `services/api-gateway` (Hono, Cloudflare Workers) exposes well-structured, authenticated, store-scoped routes for every domain a useful MCP server would wrap.
2. **An AI generation layer** — `services/api-gateway/src/routes/ai.ts` implements `POST /ai/generate` (content generation), `POST /ai/homepage` (editable homepage draft), and `POST /ai/operator` (tool-call planner with `create_product`, `draft_discount`, `draft_homepage_section`). This is the closest existing surface to an MCP tool implementation — it already does tool-planning inside the gateway.
3. **ES256 merchant JWT auth** — A stable authentication contract (identity-platform-issued ES256 JWTs) that an MCP server could accept as a Bearer token on behalf of an authenticated merchant.
4. **`@modelcontextprotocol/sdk`** — Not present in package.json today, but the Workers runtime is fully capable of hosting an MCP server; zero architectural obstacles exist.

---

## 3. Complete MCP Tool Candidate Registry

### Store Management Tools

| Tool | Description | Required API | API Status | Ready? | Blocker |
|---|---|---|---|---|---|
| `create_store` | Create a new merchant store with subdomain, site_type, and initial theme | `POST /v1/stores` | EXISTS — full validation, subdomain uniqueness check, event emission | YES | None |
| `get_store_config` | Read a store's full configuration including template_config and theme_id | `GET /v1/stores/:id` | EXISTS — returns full `sites` record | YES | None |
| `update_store_settings` | Update name, description, logo_url, currency, locale, GSTIN, refund policy | `PATCH /v1/stores/:id` | EXISTS — 20+ accepted fields including all business profile fields | YES | None |
| `set_active_theme` | Change which theme a store is using (theme_id + template_config) | `PATCH /v1/stores/:id` with `theme_id` field | EXISTS — `theme_id` is in the UpdateStoreSchema allowed list | YES | None (but install first) |
| `publish_store` | Flip store from draft to published status | `POST /v1/stores/:id/publish` | EXISTS — dedicated publish endpoint with timestamp | YES | None |

### Theme Management Tools

| Tool | Description | Required API | API Status | Ready? | Blocker |
|---|---|---|---|---|---|
| `list_themes` | List available themes with filtering by industry, category, pricing | `GET /v1/themes` | EXISTS — full pagination, industry filter, category filter, search, store-scoped install state | YES | None |
| `get_theme_schema` | Get the editable section schemas for a theme (what settings are available) | `GET /v1/themes/:slug/schema` | EXISTS — returns `getEditableSchema` result from ThemeExecutionAdapter | YES | None |
| `get_editor_state` | Load the full current draft + release config for a store-theme pairing | `GET /v1/themes/:slug/editor?store_id=` | EXISTS — full editor state including draft_config, release_config, template_key | YES | None |
| `save_draft` | Save a modified theme configuration as a draft without publishing | `PUT /v1/themes/:slug/editor/draft` | EXISTS — full `SaveThemeDraftSchema` validation, idempotency-keyed | YES | None |
| `apply_preset` | Apply a named industry preset by writing preset settings to the draft | NOT EXISTS | MISSING — no `/preset` endpoint anywhere in themes.ts or the execution adapter | NO | `apply_preset` action in merchant-control-plane is noted as "not yet" in doc 09 |
| `update_theme_settings` | Update global theme settings (colors, typography, spacing) in the draft | `PUT /v1/themes/:slug/editor/draft` with `settings` payload | EXISTS — SaveThemeDraftSchema accepts `template_config` mutations | YES | None |
| `update_section_settings` | Update a specific section's settings within the active template | `PUT /v1/themes/:slug/editor/draft` with section-scoped payload | EXISTS — draft saves per-section via `template_config.sections` | PARTIAL | MCP tool needs to know the section's `id` from the editor state; requires a `get_editor_state` first |
| `publish_theme` | Publish the current draft to live storefront | `POST /v1/themes/:slug/publish` | EXISTS — full publish with cache purge and RPC | YES | None |
| `rollback_theme` | Revert to a named release snapshot | `POST /v1/themes/:slug/releases/:releaseId/rollback` | EXISTS — full rollback with cache purge | YES | None; UI button noted as missing in doc 09 but the API is complete |
| `list_releases` | List the immutable release history for a store-theme | `GET /v1/themes/:slug/releases?store_id=` | EXISTS — full release list | YES | None |
| `create_preview_session` | Create a signed preview token for the draft | `POST /v1/themes/:slug/preview-session` | EXISTS — SHA-256 hashed token, 900s TTL | YES | None |
| `install_theme` | Install a theme to a store (by slug or raw bundle upload) | `POST /v1/themes/:slug/install` | EXISTS — full install with `publishReleaseSnapshot` | YES | None |

### Catalog Management Tools

| Tool | Description | Required API | API Status | Ready? | Blocker |
|---|---|---|---|---|---|
| `create_product` | Create a new product with name, description, price, images, stock | `POST /v1/products` | EXISTS — full `CreateProductSchema` validation, event emission | YES | None |
| `list_products` | List all products for a store with status/category/search filters | `GET /v1/products?store_id=` | EXISTS — cursor + offset pagination, variant hydration | YES | None |
| `update_product` | Update product fields including description, price, images, stock | `PATCH /v1/products/:id` | EXISTS — full `UpdateProductSchema` | YES | None |
| `create_collection` | Create a new product collection with title and description | `POST /v1/products/collections` | EXISTS — with audit fields, store-scoped | YES | None |
| `list_collections` | List all collections for a store | `GET /v1/products/collections?store_id=` | EXISTS | YES | None |
| `add_product_to_collection` | Assign products to a collection | `PUT /v1/products/collections/:id/products` | EXISTS — replaces the full product assignment set | YES | None (use with current product_ids array) |
| `create_page` | Create a CMS page (about, FAQ, policy-style custom page) | `POST /v1/pages` | EXISTS — `CreatePageSchema`, storefront_pages table | YES | None |
| `create_policy` | Create a policy page (refund, shipping, privacy, terms) | `POST /v1/pages/policies` | EXISTS — `CreatePolicySchema`, storefront_policies table with upsert | YES | None |
| `update_navigation` | Replace the navigation menu items for a location (main, footer) | `PUT /v1/pages/navigation/:location` | EXISTS — `ReplaceNavigationSchema`, full item tree replacement | YES | None |

### AI Commerce Generation Tools

| Tool | Description | Required API | API Status | Ready? | Blocker |
|---|---|---|---|---|---|
| `generate_product_description` | Generate an SEO product description for a given product name | `POST /v1/ai/generate` with `feature=product_description` | EXISTS — credit-gated, sandbox/live mode | YES (credit-gated) | Requires AI credits; AI_PROVIDER env var |
| `generate_seo_meta` | Generate SEO title and meta description for a page or product | `POST /v1/ai/generate` with `feature=seo_meta` | EXISTS | YES (credit-gated) | Same as above |
| `generate_homepage_layout` | Given a vertical and store name, produce a section config for the homepage | `POST /v1/ai/homepage` | EXISTS — `AiHomepageGenerationSchema`, produces `template_config` with sections | YES (credit-gated) | AI credentials; output targets JSON-contract sections, not Liquid bundle sections |
| `apply_industry_preset` | Given an industry name, apply the full preset config to a store's theme draft | NOT EXISTS | MISSING — no preset endpoint in themes.ts, no preset data in Urban Kicks bundle | NO | Two parts missing: (1) preset definitions in Urban Kicks `settings_data.presets`; (2) `apply_preset` action in gateway |
| `generate_navigation` | Given a list of collections, produce a structured nav tree | NOT EXISTS as a dedicated route | MISSING — no `POST /v1/ai/navigation` endpoint | NO | Could be composed from `list_collections` + client logic, but no server-side generation exists |
| `generate_store_from_description` | Given a plain-language description ("Indian handmade jewellery store"), produce a complete store configuration | NOT EXISTS as an end-to-end route | MISSING — `POST /v1/ai/operator` does tool-planning but does not chain execution | NO — Medium | Requires a workflow-capable route or an MCP server that chains `create_store` + `install_theme` + `apply_preset` + `create_product*` |

---

## 4. Readiness Classification

### READY NOW — all required APIs exist and are callable

The following MCP tools can be built today by wrapping existing gateway routes with no backend changes required:

- `create_store` → `POST /v1/stores`
- `get_store_config` → `GET /v1/stores/:id`
- `update_store_settings` → `PATCH /v1/stores/:id`
- `set_active_theme` → `PATCH /v1/stores/:id` (theme_id field)
- `publish_store` → `POST /v1/stores/:id/publish`
- `list_themes` → `GET /v1/themes`
- `get_theme_schema` → `GET /v1/themes/:slug/schema`
- `get_editor_state` → `GET /v1/themes/:slug/editor?store_id=`
- `save_draft` → `PUT /v1/themes/:slug/editor/draft`
- `update_theme_settings` → `PUT /v1/themes/:slug/editor/draft`
- `publish_theme` → `POST /v1/themes/:slug/publish`
- `rollback_theme` → `POST /v1/themes/:slug/releases/:releaseId/rollback`
- `list_releases` → `GET /v1/themes/:slug/releases?store_id=`
- `create_preview_session` → `POST /v1/themes/:slug/preview-session`
- `install_theme` → `POST /v1/themes/:slug/install`
- `create_product` → `POST /v1/products`
- `list_products` → `GET /v1/products?store_id=`
- `update_product` → `PATCH /v1/products/:id`
- `create_collection` → `POST /v1/products/collections`
- `list_collections` → `GET /v1/products/collections?store_id=`
- `add_product_to_collection` → `PUT /v1/products/collections/:id/products`
- `create_page` → `POST /v1/pages`
- `create_policy` → `POST /v1/pages/policies`
- `update_navigation` → `PUT /v1/pages/navigation/:location`
- `generate_product_description` → `POST /v1/ai/generate`
- `generate_seo_meta` → `POST /v1/ai/generate`
- `generate_homepage_layout` → `POST /v1/ai/homepage`

**Total: 26 of 31 candidate tools are READY NOW.**

### PARTIALLY READY — API exists but incomplete, document specific gap

**`update_section_settings`** — The `PUT /v1/themes/:slug/editor/draft` endpoint accepts a full `template_config` payload. An MCP tool can update section settings by: (1) calling `get_editor_state` to read the current draft config, (2) mutating the target section by `section.id`, and (3) saving the updated config via `save_draft`. The gap is that the MCP client must manage this read-modify-write cycle explicitly; there is no atomic `PATCH /v1/themes/:slug/editor/draft/section/:sectionId` endpoint. This is a real usability gap because concurrent edits or large configs can create merge conflicts. Estimated effort to add a section-scoped PATCH: 2–4 hours.

### NOT READY — Easy (gap is less than 1 week to fill)

**`apply_preset`** — Two gaps, both small:
1. Urban Kicks `settings_data.presets` object is empty — the preset definitions for grocery, fashion, and electronics have not been written yet (confirmed in doc 09 Phase C work). Adding 3 industry presets to `theme-bundle.ts` is 1–2 days.
2. No `POST /v1/themes/:slug/preset` gateway endpoint exists. The implementation would: read the named preset from `bundle.config.settings_data.presets[industry]`, merge it into `settings_data.current`, and call `saveDraft()`. This is 2–3 hours of gateway work once the presets are defined.

Total estimated gap: 2–3 days.

### NOT READY — Medium (gap is 1–4 weeks)

**`generate_navigation`** — No server-side navigation generation route exists. To implement: add `POST /v1/ai/navigation` that accepts a `store_id` + `vertical` + optional collection list, queries the AI generation adapter, and returns a structured `ReplaceNavigationSchema`-compatible items array ready to pass to `PUT /v1/pages/navigation/main`. Estimated effort: 3–5 days (including AI prompt engineering for the navigation structure and testing).

### NOT READY — Hard (requires significant architecture)

**`generate_store_from_description`** — This is a multi-step agentic workflow. The current `POST /v1/ai/operator` route produces a list of `AiOperatorToolCall` objects (tool plan) but does not execute them. Executing the plan requires: calling `create_store`, then `install_theme`, then `apply_preset`, then `generate_homepage_layout` and saving the draft, then `create_product` N times, then `publish_theme`, and finally `publish_store`. Each step has dependencies on the previous step's output (the `store_id` and `theme_slug` are generated, not known in advance). This requires either:
  - An orchestration route `POST /v1/workflows/create-store` in the gateway that chains these calls server-side, or
  - An MCP server that manages the multi-step workflow in its own tool implementation (recommended — this is the natural strength of the MCP architecture).

The MCP approach is cleaner and requires no new gateway routes. The hard part is state management across tool calls, error handling, and idempotency for partial failures. Estimated effort: 3–4 weeks including testing.

---

## 5. Authentication Strategy for MCP

### What token type is needed

The LetBuyy API gateway uses **ES256 merchant JWTs** issued by the `identity-platform`. These tokens carry:
- `sub` — the `custom_user` record ID
- `storeId` — optional, scope-limiting field
- `iss` — the identity-platform issuer
- `aud` — `letbuyy-merchant`

The gateway validates these via `authMiddleware` using `LETBUYY_IDENTITY_PUBLIC_JWKS` (the ES256 public key set). This is the canonical token for all theme, store, product, and page operations.

Customer HS256 tokens (issued for storefront shoppers) are a separate issuer and have no authority over merchant resources. An MCP server must use ES256 merchant tokens only.

### How a merchant would authorize an MCP client

**Recommended approach: OAuth 2.0 Authorization Code Flow with PKCE**

1. The merchant opens their merchant-control-plane settings page and initiates "Connect AI agent".
2. The identity-platform issues a short-lived access token scoped to the merchant's `custom_user_id` and optionally their `site_id`.
3. The token is passed to the MCP client as a `Bearer` token in the `Authorization` header.
4. The MCP server forwards the token on every gateway call.

This approach:
- Requires no new auth infrastructure — the ES256 JWT system already exists.
- Is already browser-compatible (the identity-platform's create-store and login flows demonstrate the ES256 issuance path).
- Does not require the MCP client to store credentials long-term; tokens can expire in 1–4 hours and refresh via the existing token refresh mechanism.

**Alternative: API key minting**

A simpler alternative is a dedicated `POST /v1/api-keys` gateway route that mints a long-lived, store-scoped API key (stored encrypted in Supabase, masked on reads). The key is exchanged for a short-lived ES256 JWT on each MCP tool call via `POST /v1/api-keys/:keyId/token`. This is the pattern used by platforms like Shopify for third-party app tokens. It does not exist yet in LetBuyy.

**Step-up (HMAC) gate for destructive operations**

The existing step-up HMAC gate on refunds/payouts does not apply to theme operations, so no additional step-up auth is needed for the 26 ready-now tools. If future MCP tools trigger money mutations (e.g., a `purchase_theme` tool), the existing HMAC step-up pattern must be respected and the MCP client would need to supply the HMAC-signed one-time token.

---

## 6. Recommended First MCP Server Scope

The smallest viable MCP server that delivers real value immediately is a **Theme Configuration Agent** covering 7 tools. These tools form a complete "configure the storefront" workflow and require zero new backend work.

### Tools to include

| Tool | Calls | Value delivered |
|------|-------|----------------|
| `get_store_config` | `GET /v1/stores/:id` | Agent can read the current state before making changes |
| `get_theme_schema` | `GET /v1/themes/:slug/schema` | Agent knows what settings are available to change |
| `get_editor_state` | `GET /v1/themes/:slug/editor?store_id=` | Agent can read the current draft and published config |
| `save_draft` | `PUT /v1/themes/:slug/editor/draft` | Agent can write modified settings without publishing |
| `create_preview_session` | `POST /v1/themes/:slug/preview-session` | Agent can give the merchant a preview URL to review changes |
| `publish_theme` | `POST /v1/themes/:slug/publish` | Agent completes the publish after merchant approval |
| `generate_homepage_layout` | `POST /v1/ai/homepage` | Agent generates a section config for the homepage |

### What this delivers

An AI agent with these 7 tools can:
1. Ask the merchant "What is your store about? What industry are you in?"
2. Read the current theme schema to understand available settings.
3. Call `generate_homepage_layout` to produce a homepage draft matching the vertical.
4. Call `save_draft` to apply the generated layout.
5. Call `create_preview_session` and return a preview URL for the merchant to review.
6. On confirmation, call `publish_theme` to make it live.

This is a complete, testable, production-safe flow. No money mutations are involved. The cache purge runs automatically on publish. The entire flow can complete in under 30 seconds.

### What an MCP server implementation looks like

The server would be a small Cloudflare Worker or Node.js process using `@modelcontextprotocol/sdk` that:
- Accepts an `Authorization: Bearer <ES256_JWT>` header (proxied from the calling agent's auth context).
- Exposes the 7 tools as MCP `tool` definitions with Zod-validated input schemas.
- Forwards calls to `https://api.letbuyy.com/v1/` with the Bearer token.
- Returns structured results to the calling AI model.

Estimated implementation time: 2–3 days including testing.

---

## 7. Missing APIs That Block MCP Value

The top 5 missing APIs, in descending order of MCP value impact:

### 1. `POST /v1/themes/:slug/preset` — Apply an industry preset (NOT READY — Easy)

**Evidence it is missing:** `grep -rn "preset" services/api-gateway/src/routes/themes.ts` returns zero results for a `/preset` route. The `ThemeExecutionAdapter` has no `applyPreset()` method. Doc 09 explicitly states "No preset-application action in the merchant control plane yet."

**MCP value blocked:** The `apply_industry_preset` tool — the highest-leverage single action in an automated onboarding flow. Without it, an agent must manually set dozens of individual settings to achieve what a preset would do in one call.

### 2. `POST /v1/themes/:slug/editor/draft/section/:sectionId` — Atomic section settings PATCH (PARTIALLY READY — Easy)

**Evidence it is missing:** The only draft-write endpoint is `PUT /v1/themes/:slug/editor/draft` which requires the full `template_config`. No section-scoped partial update endpoint exists. This forces an MCP tool to implement a fragile read-modify-write cycle that can lose concurrent changes.

**MCP value blocked:** A reliable `update_section_settings` tool. Without atomic section writes, the tool is unsafe to call concurrently and requires the MCP client to manage the full config object state.

### 3. `POST /v1/ai/navigation` — AI-generate navigation from collections (NOT READY — Medium)

**Evidence it is missing:** `grep -rn "navigation" services/api-gateway/src/routes/ai.ts` returns zero results for a navigation-generation endpoint. The AI router handles `generate`, `homepage`, and `operator` only.

**MCP value blocked:** The `generate_navigation` tool. Without it, an agent that creates collections cannot automatically build a coherent navigation structure for the storefront. The agent would need to construct the navigation items manually from collection data.

### 4. `GET /v1/themes/:slug/editor/draft` — Read the current draft without full editor state (NOT READY — Easy)

**Evidence it is missing:** `GET /v1/themes/:slug/editor?store_id=` returns the full editor state (schema + draft + releases + current template) — it is designed for the browser editor and returns more data than an MCP tool needs. There is no lightweight `GET /v1/themes/:slug/editor/draft?store_id=` endpoint that returns only the current draft config.

**MCP value blocked:** Efficient read operations. Today an MCP tool reading the draft must receive and parse the full editor state (including all section schemas and release history) just to read the current `draft_config`. A dedicated draft-read endpoint would make the `get_editor_state` tool 3–5x faster and cheaper on token budget.

### 5. `POST /v1/ai/store-setup` — End-to-end store generation from description (NOT READY — Hard)

**Evidence it is missing:** `POST /v1/ai/operator` returns a tool plan (an array of `AiOperatorToolCall` objects) but explicitly does not execute it — the response payload contains `tool_calls` with `status: 'ready'` that the client must confirm and execute. No server-side workflow-execution route exists anywhere in the gateway.

**MCP value blocked:** The `generate_store_from_description` tool — the "holy grail" of the MCP surface. Without a workflow-capable backend route (or the MCP server itself handling the multi-step chain), this tool cannot be implemented safely. The MCP approach (chain tools in the MCP server itself) is the correct path; this is a blocker for the MCP server implementation rather than a gateway gap, but the absence of an idempotency mechanism for partial workflow failures (if the `install_theme` step succeeds but the `apply_preset` step fails, what is the rollback?) does need to be designed before this tool can be production-safe.

---

*File: `/Users/saai_sidd/Git/Letbuyy_Store/docs/theme-discovery/15-mcp-readiness-analysis.md`*
*Sources: `services/api-gateway/src/routes/themes.ts` (all 1493 lines), `stores.ts` (all 823 lines), `products.ts` (all 1229 lines), `pages.ts` (all 812 lines), `ai.ts` (routes at lines 150, 615, 767, 915), `apps/merchant-control-plane/src/app/api/themes/route.ts`, `docs/theme-research/09-target-theme-architecture.md`*
