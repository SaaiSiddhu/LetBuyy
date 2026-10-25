# Implementation sequence

Deliver this work as bounded changes to the existing programme and canonical systems. This is the existing delivery sequence, not a second release ledger. The owner has authorized implementation while preserving the current interface. [Implementation results](09_IMPLEMENTATION_RESULTS.md) records the completed representative journey and partial work-package acceptance; the remaining packages are still open. Each slice must leave a complete, reviewable journey. Source ownership remains in the existing apps/packages/services; do not create a new runtime or persist a second version of an existing domain.

## Dependency order

**Navigation feedback and work protection start first.** The owner directly observed delayed switching with insufficient feedback. They should not wait behind a broad visual rewrite. Latency investigation and truthful progress are related but separate changes: a loading strip cannot excuse a slow query, and a faster query cannot replace accessible feedback for failures and cold routes.

1. Record the current local baseline and fixture; add navigation/dirty-form regression scenarios.
2. Complete a representative protected journey: sign-in/continuation → store → Products → edit → save/recover → return. In that slice fix navigation acknowledgement, product draft protection and capability dead ends; complete the existing MFA branch before claiming identity acceptance.
3. Complete existing component behavior through the canonical owners, retaining the current purple palette and using the current rendered journey as the visual baseline.
4. Finish collection matching, rich product content, readiness and metrics contracts.
5. Complete Settings/domain continuity and theme workspace/editor refinements.
6. Standardize remaining surface families, assistance/artwork, responsive accessibility and production-like performance; record each journey's actual acceptance.

Parallel read-only investigation is possible; execution stays with the owner's single-agent workflow. Do not split into multiple competing implementation branches/systems.

## Work packages

### WP-01 — Baseline and bounded delivery setup

**Covers:** UX-40, UX-42. **Owners:** identity/merchant maintainers and current local development tooling.

Pin branch/HEAD and dirty changes, current authority decisions, canonical runtime ownership and the synthetic fixture. Retain the restored PostgreSQL database. Use the verified local controller to restart only affected canonical services; never use broad startup/reset commands that include frozen apps or reseed shared data. Run cleanup-bearing governance in an owned disposable checkout, not against live `.next` development outputs.

Add acceptance cases to the existing test locations rather than create a competing suite. Separate browser, component, API, SQL and provider evidence. Keep private sessions, emails and signed preview URLs out of fixtures and artifacts. Establish owner/staff/denied test accounts without changing real credentials or permissions.

**Exit:** the same build can be opened and the baseline journey reproduced; fixture/teardown ownership is documented; current failures are retained as failures. Production builds and provider tests use an owned environment, not the active user's development ports.

### WP-02 — Immediate navigation feedback and loading ownership

**Covers:** UX-03, UX-12, UX-13, UX-16, UX-40. **Primary targets:** `MerchantNavigationLink.tsx`, `AdminShell.tsx`, existing shared navigation/overlay contracts, `[store]/loading.tsx`, `CommandPalette.tsx`, affected route loading boundaries.

Keep `prefetch={false}` for ordinary private sidebar destinations until workload evidence justifies a targeted exception. Inspect the installed Next 16.1.6 export/API before using `useLinkStatus`; current documentation describes a newer release. Prefer its existing pending signal when compatible. Keep any app-level coordinator thin, bounded and tied to actual navigation. Do not globally monkey-patch `fetch`, simulate percentages, patch all browser history calls or insert artificial blank waits.

Show an immediate fixed-size pending cue on the clicked destination. Use the existing token language for a restrained pending strip when needed. The implemented cue follows the installed router pending signal; no fixed blank interval or artificial percentage is introduced. Keep shell/store identity stable. Use destination-shaped fallbacks and `aria-busy` for the relevant content region. Route commit clears route feedback; tables/charts/iframe preview continue their own status. Aborted and superseded transitions clear the correct pending state; modifier-click/new tab/download/external links keep native behavior.

Profile the real delay: the continuation starts current session/store reads together and canonicalizes the current-store request-cache key across layout/page compatibility callers. The optional directory streams independently. Inspect remaining data dependencies before further optimization; these changes do not establish a measured global speedup. Never skip membership validation, globally cache authenticated state or use stale cross-store data to improve a timing number. Extend existing scoped abort/timeout behavior to readers such as Products where stale-result rejection alone leaves work running.

Move command search onto shared overlay/combobox semantics. Preserve debounce and abort. Return per-group states so one failure can show partial results without claiming no matches.

**Exit:** immediate acknowledgement is perceptible; warm, cold, delayed, failed, cancelled and rapid sequential navigation are coherent; keyboard focus reaches the destination; no screen is left blank or indefinitely busy. Measure actual production-like timings separately from tool observation.

### WP-03 — Protect work across navigation and interruption

**Covers:** UX-02, UX-09, UX-18, UX-21. **Targets:** existing product editor, SaveBar, navigation adapter and current pending-intent storage/recovery code.

Add a shared dirty-form navigation contract that covers sidebar links, breadcrumb, Back, store switch and meaningful unload. Reuse a suitable existing guard; only add a shared primitive if no canonical one covers the task. Keep an unsaved editing draft separate from a command whose outcome is unknown. Scope safe drafts by actor/store/record/version and clear them after acknowledged save or explicit discard. Exclude secrets and unnecessary personal data from browser persistence.

Use a Stay/Discard dialog for client transitions and the browser's permitted unload confirmation where appropriate. A guard must not claim to stop all mobile/browser termination; recovery covers that limit. Preserve the original idempotency key and payload for pending saves. Reauthenticate/re-authorize before replay; never create a new command because the previous response was lost.

**Exit:** the reproduced product-loss scenario is corrected, cancel restores focus, confirmed discard works, save clears dirty state, scope changes cannot leak drafts, and session/timeout recovery remains durable.

### WP-04 — Complete canonical identity continuations

**Covers:** UX-01, UX-04–UX-10. **Targets:** lookup/login/check-email/recovery/onboarding pages, existing login API and issuer factor contracts; merchant unauthenticated redirect.

First document the existing API success/challenge/error union and approved factor/recovery endpoint. Resolve any contract gap inside the sole issuer; no second session/token implementation. Converge duplicated lookup/login state handling into a shared controller while preserving required entry routes. Do not delete an entry until its actual users/redirects and regression gate are accounted for.

Carry a validated return destination through email/password, MFA, recovery and store selection. Enforce allowed origins/paths, realm/audience and live membership on the server. MFA enrollment and login must form one usable lifecycle. Preserve CSRF/rate limits/challenge and anti-enumeration behavior. Correct HTTP outcome handling and resend proof. Disabled magic-link capabilities remain disabled outside their test cases.

Standardize field names, `aria-invalid`/descriptions, password visibility labels, OTP paste/autofill, errors and focus. Validate language preferences. Preserve D-AUTH-LIGHT and current fonts/brand.

**Exit:** normal sign-in and enrolled-MFA sign-in, wrong/expired/replayed factors, return-to-detail, zero/one/multi-store routing, staff invite mismatch and recovery expiry pass applicable auth/tenant security tests. No new passkey/OIDC capability is introduced.

### WP-05 — Existing visual roles and component polish

**Covers:** UX-35–UX-39, UX-43–UX-46. **Targets:** `packages/typescript/ui/src/tokens.ts`, shared button/input/layout/table/feedback/overlay primitives, existing token export/Dart bridge, merchant CSS consumers and identity boundaries.

Preserve the current rendered palette, chrome, typography, surfaces and spacing. The earlier [role proposal](03_PREMIUM_PURPLE_SYSTEM.md) is a reference only. Correct demonstrated contrast, focus and touch-target defects through existing semantic/component roles. Retain semantic statuses and working layout; do not apply a generated redesign or wholesale visual cleanup.

Assign existing density/type/spacing variants by task. Improve named icon buttons and useful hit areas. Keep one dialog contract with size variants, persistent footer when needed, focus ownership and nested popover rules; no clone per page. Update surface-aware docs and generated token consumers, including Flutter compatibility, without making mobile appearance an unrequested redesign.

Complete the canonical composition contracts from [the follow-up](08_CANONICAL_PATTERN_COMPARISON.md): explicit header/action recipes and loading metadata; semantic grouped-section titles; a single main landmark across shell/Page; and saved SaveBar controls removed from keyboard/AX exposure. Extend the existing SaveBar owner with suitable scoped placement/state recipes, preserving its consumers' command recovery. These semantic corrections belong ahead of cosmetic parity. Use existing Stack/Grid/Section/Input compositions for a repeatable form rhythm, with no second form engine.

**Exit:** representative identity, list, form, Settings and editor screens pass composed visual/keyboard/reflow checks; DS/style ratchets do not worsen. Token export and consumer build checks pass. Accessibility is assessed on rendered states, not only pair calculations.

### WP-06 — Whole-collection record workspaces

**Covers:** UX-17, UX-18, UX-24, UX-42. **Targets:** Products list/BFF and existing shared types/client/domain pagination; then applicable Orders/Customers and other in-scope operational indexes.

Define authorized search/sort/filter/page semantics using the existing contract. Prefer existing page/cursor mechanisms; do not add a new search service. Use a stable tie-breaker and explicit count meaning. Keep URL state for status, query, sorting and page where shareable; preserve return context when opening independent details. Reset invalid pages when filters change and handle deletion/status changes that remove a row from the current result.

Selection must state its population. Keep explicit IDs and page selection; server all-matching snapshots are conditional work only if beta operations require them. Explain partial success and recheck authority at command time. Retain existing versioned/idempotent product status recovery.

**Exit:** a >100-record fixture finds a match beyond the first page; global sort and Back behavior are correct; direct details work without visiting a list; denied/timeout/empty/no-match states differ; current selection never silently expands.

### WP-07 — Product editing and safe rich descriptions

**Covers:** UX-19–UX-21. **Targets:** current product editor/shared UI, canonical product/shared schemas, existing monolith persistence and commerce rendering.

Inspect the canonical description representation and any suitable existing rich-content adapter before selecting a library. One reusable adapter may be added if missing; do not create an app-local Product DTO or duplicate content store. Define a bounded supported HTML subset, server-side normalization/sanitization, plain-text compatibility, paste behavior, source-mode validation and output rendering. Never promise “all HTML”: unsafe scripts, handlers, URLs and arbitrary embeds must not execute. Reuse the existing security library only when its policy fits product content; theme HTML and Liquid have different execution boundaries.

Use ordinary toolbar actions for headings, emphasis, lists and links. Make media/HTML source mode explicit and reversible where supported. Keep product save validation, concurrency and unknown-outcome recovery. Put status/channel/inventory consequences beside their controls. Record the owner decision on default Draft/explicit stock rather than silently invent policy.

**Exit:** content round trips through editor/API/storefront safely; plain text remains readable; keyboard toolbar and mobile editing work; malicious/malformed content is rejected or safely normalized; partial media failure does not erase the rest of the form.

### WP-08 — Truthful setup and operational metrics

**Covers:** UX-22–UX-25, UX-41. **Targets:** dashboard setup status/BFF/checklists, existing analytics-read endpoints, MetricCard and capability copy.

Define each setup fact and readiness blocker using existing authority. A catalog row existing is not automatically sellable. COD readiness is not online-provider verification; a default subdomain can legitimately satisfy address setup without claiming custom DNS. Reconcile the dashboard and helper checklists or label optional tasks distinctly. Use null/unavailable checks instead of default success.

For each metric record population, period/date basis, statuses, INR/unit representation, aggregation/freshness and drill-through. Resolve why draft-only catalog counts differ across dashboard and Analytics; change labels or predicates according to the contract. Show undefined average-order values as unavailable. Avoid fake monthly charts when buckets are absent, and replace backend jargon with understandable availability text.

**Exit:** empty, draft-only, active-catalog, no-order, refunded/cancelled and unavailable fixtures are explainable; filters/drill-through match the summary; setup no longer overclaims sellability or provider readiness.

### WP-09 — Settings, capability navigation and domain continuity

**Covers:** UX-11, UX-14, UX-15, UX-25–UX-28. **Targets:** SettingsShell/navigation/panes, plan/trial entry, merchant navigation, domain overview/wizard/detail and existing domains client.

Apply one capability decision to index cards, sidebar, commands and routes. Preserve direct-route fail-closed checks. Replace generic app dead ends with a safe hidden/disabled/explanatory state; never enable the app platform for visual completeness. Keep internal backend requirements in docs.

Make domain tasks addressable in existing Next routing/search state. Read domain identity/role from owned server data; do not trust a URL role. Preserve non-secret wizard progress and exact DNS instructions. Expose independent DNS ownership, routing, SSL, primary/redirect, last checked and storefront visibility. Buying a domain remains a separate provider/financial action and is not automated in UI research.

Review settings by role: general/business, plan/billing, users/security, payments/shipping/taxes/checkout, notifications/policies/localization and existing loyalty. This is presentation and complete-journey work over current contracts, not automatic scope expansion for every Shopify Settings entry.

**Exit:** direct owned-domain detail/reload/Back work; invalid/unowned inputs are safe; provider-state fixtures show truthful steps and recovery; staff cannot gain owner actions through the UI or direct API; local tests cause no external registration, charge or security-factor change.

### WP-10 — Theme library lifecycle clarity

**Covers:** UX-29, UX-34. **Targets:** existing ThemeWorkspace, ThemeLibraryWorkspace/Card, themes APIs and canonical release fields.

Separate installed/assigned theme, draft, theme release and public storefront state. Use one label resolver across hero/library/editor. Keep existing rename/duplicate/import/archive/delete/history/rollback operations; complete their state/permission/recovery matrix. Explain effects before destructive actions and protect dependencies. Do not reinterpret a draft acknowledgement as a live publication.

Improve preview artwork and catalog consistency while retaining truthful static/interactive labels. Keep the ten first-party curated designs distinct; the route called marketplace does not authorize a third-party ecosystem.

**Exit:** private store + published theme release is understandable, menus reflect lifecycle/permissions, cancel has no mutation, every success has an acknowledged record, and failed/unknown operations recover their original intent.

### WP-11 — Theme editor layout, catalogs and readiness

**Covers:** UX-30–UX-33. **Targets:** editor page/workspace CSS, SchemaFormRenderer, existing control/media/preview/draft clients.

Implement an intentional wide layout: outline rail, flexible preview and properties rail when a meaningful preview width remains. Reuse approximately 280–320 px rail roles rather than force exact Shopify dimensions. Keep the useful stacked layout below that threshold and preserve working mobile tabs/section-to-properties behavior. Each pane owns its scroll region and reachable controls.

Build section discovery around the existing schema catalog and add command. Search/category/preview must not fabricate a live preview or enable third-party blocks. Verify conditional/range/color/font/media/rich-content/CSS/Liquid/translation controls against actual supported schemas. Preserve all existing sandbox, parse/render/resource and upload gates.

Separate saving/saved/unknown/conflict from preview loading/syncing/ready/error and publication pending/acknowledged/recovered. Preserve saved-version publication, original intents and newer local drafts. Confirm iframe messaging is origin/scope/version checked. Loading artwork must not masquerade as an interactive rendered theme.

**Exit:** 390/768/1440/1920 pane/task acceptance, keyboard outline actions, undo/redo/reload, slow preview, stale tab, conflict and publication recovery pass. Theme security/render parity/performance gates remain mandatory before buyer exposure; no renderer replacement.

### WP-12 — Assistance, artwork and remaining route families

**Covers:** UX-38, UX-41, UX-42. **Targets:** existing setup helper, AI customization/defaults, shared illustration registry and route-family owners.

Keep checklist, deterministic suggestions and generated proposals distinguishable. Scope suggestions to current store/record; show Accept/Discard and factual review; acceptance edits a draft, with ordinary save/publication still explicit. If a backend is unavailable, preserve input and provide manual editing. No general Sidekick clone, external agent tools or new AI service.

Audit existing vector and illustration assets; create only necessary original missing first-use artwork. Finish applicable Inventory/Purchasing, Customers, Orders, Marketing, Content, Analytics and Settings acceptance from [the route inventory](07_ROUTE_COVERAGE.md). Include role and lifecycle branches; do not create unrelated operational features merely because Shopify has them.

**Exit:** every in-scope beta journey has evidence of its working and relevant alternate states. Unsupported/frozen capabilities are labeled/deferred rather than falsely marked implemented.

## Quality gates and rollback

For every slice: relevant unit/contract/component tests, affected app/package typecheck/build, shared-style/DS ratchets, and actual browser acceptance. Auth, tenancy, theme and financial paths require the Constitution's heavier security/integration gates when touched. This audit's green test commands do not waive those implementation gates.

Test on meaningful fixtures: >100 products; draft-only/zero-stock; staff and denied membership; slow/unavailable reads; ambiguous mutation outcome; stale record/theme version; expired session; long translated labels; mobile keyboard; text enlargement; reduced motion. Use production-like warm/cold timing runs before making speed claims. Keep provider-sandbox acceptance separate from local dummy/sink behavior.

Rollback UI/token/layout slices through normal Git revert and existing scoped feature controls. Do not add a permanent parallel editor/auth/token path as rollback. Draft/content representation changes must preserve readable old data; any necessary schema change follows the actual current migration sequence and paired DOWN/expand–verify–contract rules. Theme publication uses existing release rollback; never bypass it with raw table edits. No deployment, push, migration or external provider action is part of this plan's delivery.

## Definition of completion

Completion means the prioritized journeys work coherently with real authority, durable outcomes, clear recovery, the approved purple roles, and demonstrated keyboard/mobile/performance behavior. It does not mean matching every Shopify feature or counting all page files as passed. Record actual acceptance in the current programme with this gap register as supporting evidence; close a finding only with its concrete pass condition and revision.

## Canonical palette tranche — 23 October 2026

The premium purple palette role mapping is now authorized for Merchant and Settings. Existing layouts, architecture and domain behavior remain preserved.

The shared Card/Section, MetricCard, PageHeader/Button, fields and SaveBar owners now carry the implemented contracts. Settings-local duplicate card/header wrappers have migrated; domain grids and commands remain. See [adoption and dispositions](10_CANONICAL_ADOPTION.md) and [current results](09_IMPLEMENTATION_RESULTS.md). This advances existing work packages and does not close deferred identity, catalog, AI, provider or theme-publication work.
