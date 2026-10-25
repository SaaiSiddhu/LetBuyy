# Existing marketplace machinery and integration boundary

23 October 2026, source audit. This map is evidence and intentionally does not reclassify runtime authority.

The table records the initial audit unless stated otherwise. Implemented repairs and current acceptance are recorded in STATUS/VALIDATION/GAP_MATRIX. Current installer source includes expected3fields, exact receipt, migration387 and paired rollback; fresh DB acceptance is blocked by the canonical registry's schema-version/package-version conflation. Public demo now uses the trusted readonly ten-context dispatcher and existing renderer; mutable transport remains unavailable. Frozen token/override/install compatibility repairs are source-tested.

| Surface | Existing implementation | Reuse / current limitation |
|---|---|---|
| Active merchant catalog | `ThemeWorkspace`, `/api/themes`, typed themes.listCatalog | Keep canonical catalog. BFF currently hides pagination and component state is local. |
| Active merchant library | `ThemeLibraryWorkspace`/`ThemeLibraryCard`; owned library/create/duplicate/rename/archive/delete/update/recovery proxies | Complete handoff, never add another library. Catalog installed boolean cannot select a precise instance. |
| Canonical acquisition | `ThemeExecutionAdapter.installTheme` → `install_owned_theme_v1` (migration373) | Site actor check, entitlement/limit, atomic instance/outbox, current live release preserved. BFF must expose receipt; expected-version precondition missing. |
| Public demo | commerce `theme-preview/[slug]` → PreviewContent → shared compose/data-binding/Liquid renderer | Real package path exists. Only three types; generic resource mapping; Threadline-specific fixtures are already distinct from Urban Kicks. |
| Frozen home/discovery/category | `apps/frozen/theme-store/src/app/{page,themes/page,themes/category/[category]/page,collections/[slug]/page}` | Extensive existing hierarchy/filter patterns; keep source. No cross-app source imports or runtime reopening. |
| Frozen detail | `themes/[slug]/page`, theme-detail-experience, theme-card | Feature/quality/changelog/share/review presentation. Missing scores explicitly say no recorded score. Metadata is not acceptance; do not surface unverified scores elsewhere. |
| Frozen anonymous demo | `preview/[token]/page` + anonymous-preview-shell; utils.themeSandboxPreviewHref | Advertised helper actually passes theme slug as token. No bearer authorization established in this public flow; fallback points to absent `/api/preview/sandbox`. Visible token text still must be removed. Arbitrary demo_url/preview_url are currently accepted frame targets. |
| Frozen install | `/install` server action + ThemeService.installTheme | Explicit store selector/confirmation exist. Action sends non-empty config_overrides (`preset`, `marketplace_install`) which current canonical adapter rejects. Keep scoped local-review repair, do not call this current end-to-end functionality. |
| Frozen favorites/compare | theme-preference-actions + compare/favorites pages | Device-local, bounded localStorage slug preferences, not server personalization. Label actual scope if reused. |
| Frozen saved search | themes page action → ThemeService → existing gateway saved-search contract | Presence does not establish alerts; do not imply notification delivery. |
| Frozen paid/purchase/download | checkout/success, dashboard purchases/downloads, canonical typed purchase/verify/receipt/download APIs | Audit-only for this first-party free-theme work. No new pricing, payments, developer policy, licensing or deployment. |
| Frozen author/developer/support/reviews | authors/[handle], developer/listings/new, support/contact, review/report actions | Preserve existing machinery, keep third-party ecosystem deferred. No form submissions or external sends tested. |
| Frozen error states | MarketplaceUnavailable, MarketplaceResult, info/policy-draft surfaces | Useful honesty patterns. Some service reads catch errors as empty lists (stores/installations/purchases), so empty and unavailable are not always distinguished. |
| Existing tests | thin-client/install-lifecycle/honesty/static contract suites and frozen SSR ui-render | Baselines24+9 pass separately. They do not prove actual server/browser flow. Existing SSR test positively asserts token text; that assertion must change with exposure repair. |

## Required contract handoffs

Discovery query: validated search/category/feature/sort/page/limit forwarded to existing catalog API; return total/page/limit/has_more intact. Never filter only a truncated page while displaying a total-catalog count.

Detail/demo identity: catalog slug + exact package/version/artifact; version mismatch produces refresh/recovery, never silent substitution. Preserve preset identity independently of presentation names.

Install: explicit route store resolved server-side, canonical expected package/version precondition, authoritative installation + theme_instance_id receipt, readback and correct editor route. Busy UI is not idempotency. The existing install RPC's site serialization/natural package replay remains the authority.

Demo state: shared Liquid islands currently use `lb_cart`, `lb_cart_token`, `lb_cart_server` globally. Catalog demo must not mount/use that state until a version/session namespace and transport boundary isolate it. Reuse canonical validation/pricing/cart behavior; no new client pricing authority, no real buyer account/provider side effect. An adapter with injectable catalog and persistence can support bounded synthetic sessions without another renderer/section registry.

Public content: renderer route types already include page/policy/blog/article/cart/search/list_collections/contact/customer routes; shared binding currently focuses on products. Extend typed content input in the canonical path under allocated ownership; do not hand-code separate demo pages.
