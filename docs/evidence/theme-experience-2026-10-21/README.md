# Themes and editor implementation — 21 October 2026

## Working position and scope

User request: study the accessible Shopify Themes/editor experience and implement the equivalent complete merchant lifecycle. The request calls the product LeadBy; the repository's established LetBuyy branding is retained. Work is isolated in `LetBuyy-themes-shopify`, branch `letbuyy/themes-shopify-complete`, based on `9c4ae60548e1e9260aad0bd4011becbf4ebdca4b` of the existing storefront-access work. The original `develop` checkout is preserved. No hosted database, Shopify theme, deployment, push or production storefront was changed.

This is an implementation and acceptance record, not a replacement programme or architectural authority. The existing gateway, identity, theme-engine, renderer, draft/release system, UI package and password admission boundary remain the owners of their domains. The separate frozen marketplace remains de-deployed; its catalog/preview compatibility is maintained without activating a runtime.

## Reference observations

The authenticated store offered a newer Online Store interface with a large current Horizon preview, visibility control, Preview store and overflow actions. Discover themes contained Horizon, Tinker, Dwell, Savor and Atelier, individual Add buttons, Visit Theme Store, Import themes and Canvas creation. The bottom of the page offered Explore more themes. Import offered **Upload zip file** and **Connect from GitHub**. Current-theme overflow offered Duplicate in Canvas, Preview, Rename, Duplicate, Edit code, Edit default theme content and Download theme file, with version 4.3.0. Rename was inspected and canceled.

Visibility exposed Public/Private, a password control, Update and Edit password page. No credentials were changed. The trial store required selecting a plan to launch, so Shopify publication was not exercised. There was no separate installed library in this store's initial state. Installation, deletion, real drag reorder, undo/redo after a saved edit and Shopify save/publish success/error states were not mutated merely to infer behavior.

The editor exposed a 56 px toolbar, Exit, Sections, Theme settings, app embeds, theme identity/status, a searchable template picker, inspector, mobile toggle, undo/redo, View actions and Save. The template picker included home, product/collection variants, pages/blogs, cart, search, password, 404 and checkout/customer accounts. Its tree grouped Header, Template and Footer with sections and nested blocks. The Hero settings exposed media upload/select, mobile media controls, direction/alignment, gap, width/height, overlays, padding and CSS. Add section offered searchable sections/apps and categorized layouts; the media picker was inspected and canceled. Theme settings included colors, typography, page, animation and component groups. The inspector displayed a blue selection frame and element actions.

The explicit storefront mode observed was mobile, approximately 376 px wide. A tablet toggle was not observed. LeadBy's tablet preview is a deliberate extension. Application responsiveness and storefront device emulation are treated as separate requirements. A screenshot initially labeled app-tablet was measured at 1440 px and renamed `shopify-editor-wide-panel.png`; it is excluded as tablet evidence.

Measured reference rules:

| Element | Observed measurement | Implemented translation |
| --- | --- | --- |
| Admin navigation | 220 px at 1280×720 and 1059×1034 | Retain existing 220 px merchant shell |
| Themes content | Embedded main inset 4 px; about 16 px internal vertical padding at 1059 px | Token spacing, fluid max 80 rem content, two-column discovery |
| Editor toolbar/control | 56 px / 32 px; roughly 8 px control radius | Compact toolbar and shared button tokens |
| Editor panel | Approximately 300 px, scrollable, selection controls below tree | 300 px lane; 260 px at narrower desktop; split tree/properties |
| Body / group text | Inter 13 px, 20 px line height; 450 body / 600 group weight | Repository typography tokens and consistent hierarchy |
| Discover heading | 18 px, 600, 24 px line height | Shared section title token |
| Device preview | Actual narrow iframe, not an image scaled into a phone outline | Real 1440 / 820 / 390 px iframe viewports, scaled only to fit the workspace |

Screenshots and computed DOM bounds support these observations. Shopify's backend internals are not observable. Transactional storage and authorization choices below are verified LetBuyy implementation details, not claims about Shopify internals. Official documentation was used only to cross-check workflows: [adding themes](https://help.shopify.com/en/manual/online-store/themes/adding-themes), [theme editor](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor), [preview inspector](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/preview-inspector), and [password page](https://help.shopify.com/en/manual/online-store/themes/password-page).

## Gaps repaired

- Add previously activated a theme and wrote a live release. It now performs a distinct atomic library installation.
- Persisted library rows were hidden by a response-wrapper mismatch. Library Publish lacked the actor/store/version/retry contract.
- Ten designs were selectable presets inside one theme rather than discoverable catalog identities.
- Catalog listing transferred complete theme source bundles and did not consistently exclude private uploads.
- Password preferences were locked UI; Themes showed a fabricated password/plan message.
- Mobile editor CSS hid navigation without a reachable replacement panel.
- Promoted Core packages hit an existing legacy starter-block compatibility guard keyed only to the original Core slug.
- Private duplicates/blank themes were inactive and omitted their schema/template definitions; deletion wrote an invalid database status. Switching live themes also failed because the previous active instance was never retired.
- The Liquid canvas had no selection adapter; sections now connect to the existing inspector protocol with pointer/keyboard selection, bounded origins and visible outlines. Public previews retain shopping interactions.
- Autosave discarded undo history; saved edits now retain undo and redo.
- Publishing consumed the draft, leaving a signed preview unavailable. Preview refresh now explicitly seeds a canonical draft when required; ordinary unchanged Save still avoids unnecessary writes.

## Catalog and persistence

The `themes` database table is the runtime catalog. `first-party-theme-catalog.ts` is generator input derived from the existing experience registry, not a second frontend catalog. Migration 372 adds `catalog_visible`, promotes the ten existing designs, and hides old Core/Urban Kicks only from discovery. It preserves their theme IDs, settings, drafts and releases. Defaults retain each preset's exact settings overlay and the shared Core schemas/templates. The ten new catalog identities explicitly select the existing Liquid renderer so their captured bundle, typography and color tokens render consistently in catalog, saved draft and live publication. The global rendering default and existing merchant configurations are unchanged. Generated thumbnails are clearly labeled illustrative design previews; the interactive preview uses the actual renderer and explicit sample products.

| Existing preset | Merchant name | Catalog slug | Stable UUID suffix* |
| --- | --- | --- | --- |
| forge | Forge | letbuyy-forge | 000000000001 |
| sense | Sense | letbuyy-sense | 000000000002 |
| aura | Aura | letbuyy-aura | 000000000003 |
| craft | Craft | letbuyy-craft | 000000000004 |
| refresh | Refresh | letbuyy-refresh | 000000000005 |
| ride | Ride | letbuyy-ride | 000000000006 |
| dawn | Dawn | letbuyy-dawn | 000000000007 |
| bloom | Bloom | letbuyy-bloom | 000000000008 |
| nova | Nova | letbuyy-nova | 000000000009 |
| summit | Summit | letbuyy-summit | 000000000010 |

*Each UUID begins `7b669c70-0000-4000-8000-` followed by the suffix. Identity is independent of display order and naming.

| Product concern | Canonical storage/flow |
| --- | --- |
| Theme source, schemas, defaults | `themes`, `theme_packages`, `theme_package_versions` |
| Merchant library | `theme_instances`; legacy `store_themes` association retained |
| Settings, templates, sections, blocks | Existing portable config + captured Liquid bundle in canonical instance/legacy draft records |
| Draft concurrency | Existing owned read/mutate RPCs with actor, bound site, base revision and immutable retry key |
| Assets | Existing media-library/upload flow; no second asset store |
| Preview | Authenticated draft preview-session token, revision-bound and server resolved; public catalog preview contains sample data only |
| Publish | Existing canonical publisher creates release, updates site/current-release pointer and publishes the selected snapshot |
| Visitor access | `sites.access_mode`, Argon2 password hash, access message; existing gateway/proxy admission and revision-bound visitor cookie |

Migration 373 locks the owned site and creates the instance, initialized draft, association and installation outbox event together. It checks purchase/runtime/plan allowance and never changes the current release or site configuration. Concurrent repeated Add returns the retained instance and preserves edits. Deleted instances can be reinstalled deliberately. Existing plan limits remain enforced. Migration 374 atomically changes owned access state with an audit receipt; mode/password/message validation is server owned. Migration 375 reopens retained private instances and recovers their owned snapshot/schema definitions without rewriting merchant settings. New duplicates capture the latest saved source design and schemas together; blank themes start with an editable Core header/footer and empty home-page body. Migration 376 retires the previous active instance inside the existing publisher transaction before activating the selected one, preserving the one-active database constraint and synchronizing the legacy association.

Both merchant Discover and the merchant marketplace render the same component and call the same catalog and installation endpoints. The frozen marketplace already uses those endpoints; its site-category filter and first-party sample-preview destination are aligned. Private catalog detail/schema access is denied to other merchants. Public listings are metadata only. Private theme names/assets are excluded from discovery.

## UI and lifecycle

The Themes page now has a current storefront preview, accurate current/unpublished state, real edit/duplicate entry points, a persisted theme library, and ten discoverable designs with search/category filters. Preview dialogs provide actual interactive previews. Add shows pending/success/failure and updates Customize/library actions. Existing import, blank, duplicate, rename, archive, removal and release management remain available.

The editor retains real schemas, asset controls, section/block hierarchy, add/hide/reorder/remove, template selection, theme settings, styles, versions and undo/redo. Liquid sections now support canvas-to-panel selection and panel-to-canvas highlighting through the existing bounded-origin bridge; public pages never enable the inspector. A collapsible lane and reachable Sections/Preview/Settings panels replace the hidden mobile navigation. Save state and Active/Draft identity are separate. Autosave and manual Save share the canonical queue. Navigation guards pending changes; revision conflicts and response-loss recovery remain fail closed. Publication refreshes parent status and obtains a new private preview draft when publication consumed the previous one.

Visibility is a reusable persisted form on Themes and Preferences. Public access, password protection, private preview-only access, offline access, unpublished theme and signed merchant preview are distinct. Saved passwords are never returned. Blank replacement keeps the existing password; changing/removing it invalidates old admissions through the existing revision boundary. Actual shopper holding/password pages use a focused access screen without fictitious countdowns or notification controls.

## Verification and evidence

Owned tests use disposable PostgreSQL/PostgREST and the actual gateway, canonical identity and production Next applications. Synthetic fixture ownership is explicit. No developer or hosted store data is used.

- Gateway theme/password unit suites passed 99/99; merchant draft/library checks passed 41/41.
- Three active package typechecks passed; the frozen marketplace typecheck also passed.
- Theme engine full functional run: 1890 passed, one timing benchmark failed under simultaneous local builds. The unchanged benchmark rerun in isolation passed 5/5. Added exact-default/conservative migration regression checks passed 27/27.
- Draft client tests passed 17/17, including response loss, stable publication recovery, revision conflicts, and requesting an identical private preview draft after publication.
- Existing password admission/access boundary suites passed 26/26, including real password verification, host/cookie/token revision, revocation, offline and failure controls.
- Final catalog/install acceptance passed: all ten distinct defaults, Add without publication, concurrent retry preservation, foreign merchant denial, private copy/blank saving, historical copy repair, private copy publication, one-active theme switching, privacy/current metadata, soft removal/reinstall, publication, password creation/rotation/retention/removal, backend-only RPC grants, injected last-write rollback and dependency failure/recovery.
- Production CUA run `664f7899b044` passed its persisted state assertions: installed theme, published=true, saved heading in live config, public access restored. Browser observations included live hero text, real device widths, mobile navigation, pending-change guard and visitor restriction. A prior bounded development window expired; it is retained as failed harness history, not a product pass.
- Production run `330a92bbe038` verified saved undo/redo, section add/reorder/hide/remove, save/publish, private copy publication, independent Sense settings, offline/public access and separate application/iframe responsiveness. Run `a80cdea83606` verified all ten catalog designs and direct library publication with final renderer defaults.
- Liquid inspector DOM behavior passed 3/3 and existing bridge contracts passed 39/39. Production run `c12eee7d4e01` verified actual pointer/Enter selection in the authenticated preview, sidebar-to-canvas selection and canvas hover feedback. The automation tool refused all input inside the scaled cross-origin iframe, so its pointer/keyboard checks were performed with that same signed preview opened directly; a combined automated iframe-click-to-sidebar assertion remains unverified. The same run logged out, authenticated again, and reopened Forge with the exact saved heading and Active/Saved state. The final production inspector pass and governance snapshot are recorded in `acceptance.json`.

Evidence directory: `artifacts/theme-experience-2026-10-21/`. Useful pairs: `shopify-themes-desktop.png` / final Themes screenshot; `shopify-editor-hero.png` / `leadby-editor-desktop.png`; `shopify-editor-mobile.png` / `leadby-editor-mobile.png`. `leadby-published-storefront.png` proves the saved hero copy on the public renderer. Failure artifacts are retained with their original verdicts; later passing receipts supersede defects that were repaired.

## Delivery limits and next action

This record proves local implementation and owned runtime acceptance, not deployment. Apply migrations 372–376 through the normal release workflow before deploying the matching gateway/merchant/storefront code. Their rollback pairs preserve merchant data. Do not enable the frozen marketplace as a deployment target. Real native iOS/Android browser behavior, a hosted deployment, hosted media storage/upload and Shopify trial-blocked publication are outside this local evidence. The existing media picker/upload integration is preserved; a hosted upload was not fabricated without a storage binding. Catalog previews intentionally use sample inventory; merchant previews use actual scoped inventory and may show honest empty states.

Next action after local acceptance: review and release this branch through the existing deployment process; then perform a hosted smoke test using an authorized merchant. No further product policy or new infrastructure is required for the implemented local lifecycle.
