# Prioritized gap register

All entries are proposed work. No UX fix is claimed implemented by this audit. Priorities describe user consequence and dependency, not measured incident frequency or implementation effort. P1 covers core task correctness, access, work preservation, truthful readiness and the repeated navigation delay reported by the owner. P2 covers refinement and broader acceptance; it can move earlier when a core journey depends on it. No unsupported P0 security incident is asserted.

**Evidence classification matters:** live defects were reproduced, source defects follow inspected code, refinements are design proposals, and verification entries identify acceptance still needed. A gated capability defect is not a claim of an active production incident. Each acceptance below is a future pass condition, not a completed test.

The machine-readable equivalent is [gap-register.json](gap-register.json). Source links identify current ownership; listed symbols narrow the edit. Exact file hashes and source HEAD are retained in [the inventory](evidence/route-source-inventory.json).

## Index

| ID | Priority | Area | Classification | Finding |
| --- | --- | --- | --- | --- |
| [UX-01](#ux-01) | P1 | Identity | source defect | MFA challenge has no matching sign-in continuation |
| [UX-02](#ux-02) | P1 | Forms | live defect | Sidebar navigation loses an unsaved product |
| [UX-03](#ux-03) | P1 | Navigation | live and user-observed gap | Page switches wait without sufficient acknowledgement |
| [UX-04](#ux-04) | P1 | Identity | source defect | Deep-link destination is lost across authentication |
| [UX-05](#ux-05) | P1 | Identity | source defect, gated capability | Magic-link request reports a successful next step on HTTP rejection |
| [UX-06](#ux-06) | P1 | Identity | source defect | Check-email resend lacks an honest failure path |
| [UX-07](#ux-07) | P1 | Identity | source accessibility defect | Lookup icon-only controls lack explicit names |
| [UX-08](#ux-08) | P2 | Identity | source robustness risk | Language storage is trusted without enum/storage handling |
| [UX-09](#ux-09) | P1 | Identity | verification | Recovery, invitations and session interruption need composed acceptance |
| [UX-10](#ux-10) | P2 | Onboarding | refinement and verification | Preserve resumable onboarding and clarify enabled formats |
| [UX-11](#ux-11) | P2 | Onboarding | verification | Plan claims and trial handoff need entitlement alignment |
| [UX-12](#ux-12) | P1 | Navigation | source defect | Search failure is indistinguishable from no entity matches |
| [UX-13](#ux-13) | P1 | Navigation | source semantics gap and verification | Custom command overlay needs a complete keyboard contract |
| [UX-14](#ux-14) | P1 | Navigation | live defect | Disabled Apps route remains advertised as available |
| [UX-15](#ux-15) | P2 | Navigation | refinement | Generic not-found recovery loses store context |
| [UX-16](#ux-16) | P2 | Navigation | verification | Collapsed rail, mobile drawer and flyout parity |
| [UX-17](#ux-17) | P1 | Tables | source defect | Whole-catalog search and sort only operate on the loaded 100 |
| [UX-18](#ux-18) | P1 | Tables | verification | Selection and bulk recovery need multi-page acceptance |
| [UX-19](#ux-19) | P1 | Forms | refinement with security dependency | Product descriptions lack rich editing and safe HTML view |
| [UX-20](#ux-20) | P1 | Forms | policy review, live defaults | New products start Active with quantity 10 |
| [UX-21](#ux-21) | P1 | Forms | verification | Uploads and dirty recovery across all record editors |
| [UX-22](#ux-22) | P1 | Data meaning | live and source semantic defect | Setup says a draft zero-stock product is sellable |
| [UX-23](#ux-23) | P2 | Data meaning | live inconsistency and verification | Setup helper and dashboard show different progress models |
| [UX-24](#ux-24) | P1 | Data meaning | live mismatch requiring contract verification | Analytics catalog/average-order meaning differs from dashboard |
| [UX-25](#ux-25) | P2 | Settings | source and live content defect | Merchant pages expose implementation programme terms |
| [UX-26](#ux-26) | P1 | Settings | source continuity gap | Domain detail/wizard state is not addressable |
| [UX-27](#ux-27) | P1 | Settings | verification | DNS, TLS and domain actions need provider-state acceptance |
| [UX-28](#ux-28) | P1 | Settings | verification | Team, billing, payments, tax and security need role-specific acceptance |
| [UX-29](#ux-29) | P1 | Themes | live semantic inconsistency | Theme release labels blur visibility and draft state |
| [UX-30](#ux-30) | P2 | Themes | measured refinement | Wide editor keeps controls stacked at 1920 px |
| [UX-31](#ux-31) | P1 | Themes | refinement and verification | Draft saved and preview synchronized need distinct status |
| [UX-32](#ux-32) | P2 | Themes | refinement | Section catalog needs stronger discoverability |
| [UX-33](#ux-33) | P1 | Themes | verification | Schema forms, release history and publication recovery need full matrix |
| [UX-34](#ux-34) | P2 | Themes | refinement and verification | Theme previews and library actions need consistent presentation |
| [UX-35](#ux-35) | P2 | Visual system | refinement | Existing plum roles need coordinated chrome and restrained elevation |
| [UX-36](#ux-36) | P1 | Visual system | measured risk and verification | Control boundaries, focus and small targets need composed testing |
| [UX-37](#ux-37) | P2 | Visual system | refinement | Spacing and type need pattern-level assignments |
| [UX-38](#ux-38) | P2 | Visual system | refinement and verification | Empty, no-match, unavailable and denied states need consistent grammar |
| [UX-39](#ux-39) | P2 | Visual system | verification | Fixed trial/save/assistant layers can compete on mobile |
| [UX-40](#ux-40) | P1 | Performance | verification with observed symptom | Route latency must be profiled separately from loading decoration |
| [UX-41](#ux-41) | P2 | AI and capability | refinement and verification | Checklist, deterministic defaults and generated proposals need honest labels |
| [UX-42](#ux-42) | P1 | Coverage | verification | Complete acceptance across remaining route families and authority boundaries |
| [UX-43](#ux-43) | P2 | Canonical patterns | source refinement | Header recipes and action metadata need a complete shared contract |
| [UX-44](#ux-44) | P1 | Canonical patterns | live and source accessibility defect | Clean SaveBar retains invisible enabled keyboard controls |
| [UX-45](#ux-45) | P1 | Canonical patterns | source semantic defect | Grouped section titles lose semantic heading structure |
| [UX-46](#ux-46) | P1 | Canonical patterns | live and source semantic defect | Page creates a nested main landmark inside AppFrame |

## UX-01

**MFA challenge has no matching sign-in continuation** · P1 · source defect

API returns mfaRequired; lookup/login source has no MFA input branch. Conditional barrier for an enrolled account; not a demonstrated bypass.

Target: [apps/platform/identity/src/app/api/auth/login/route.ts](../../../apps/platform/identity/src/app/api/auth/login/route.ts) — `mfaRequired; lookup/page.tsx and login/page.tsx`.

**Change:** Continue the existing issuer challenge with the approved factor/recovery contract. Share a sign-in state controller across entry presentations.

**Acceptance:** Given an enrolled synthetic user, password success opens the existing factor step; invalid/expired/replayed codes fail safely; successful verification alone creates the authenticated continuation. Preserve return context and run auth security gates.

## UX-02

**Sidebar navigation loses an unsaved product** · P1 · live defect

Filled title/description/price, clicked Products, returned Add product: title empty and no confirmation. evidence/product-unsaved-navigation-result.json Fresh Shopify comparison protected a temporary dirty product from sidebar departure, focusing Save; UI input was discarded without creation.

Target: [apps/merchant/web/src/app/[store]/products/new/page.tsx](../../../apps/merchant/web/src/app/[store]/products/new/page.tsx) — `product editor and shared navigation boundary`.

**Change:** Add a shared dirty-navigation contract, scoped recovery draft and explicit discard. Keep the existing pending-save intent distinct from an unsaved form draft.

**Acceptance:** Edit a product, attempt sidebar/Back/store switch/reload: retain work or show a working Stay/Discard choice. Cancel restores focus. After confirmed save the guard clears; another account/store cannot recover the draft.

**Implementation follow-up:** partially implemented; representative Products and Settings journey verified locally. Shared departure decisions, native Back in the current browser, safe explicit discard, acknowledged save-and-leave and scoped ordinary product recovery. Full store-switch/unload/session/device matrix and create-command uncertainty remain open. See [results and evidence](09_IMPLEMENTATION_RESULTS.md).

## UX-03

**Page switches wait without sufficient acknowledgement** · P1 · live and user-observed gap

User explicitly reported delayed response/page switching on 22 October. Local transitions retained old content before destination or generic skeleton appeared. No exact paint duration claimed.

Target: [apps/merchant/web/src/components/MerchantNavigationLink.tsx](../../../apps/merchant/web/src/components/MerchantNavigationLink.tsx) — `prefetch=false; AdminShell; [store]/loading.tsx`.

**Change:** Provide immediate fixed-geometry clicked-link feedback, a thin indeterminate route strip, stable shell and route-shaped fallback. Profile actual data latency separately. This belongs in the first delivery slice.

**Acceptance:** Keyboard and pointer navigation visibly acknowledge within proposed 100 ms; fast completion does not flicker. Slow/failed/cancelled and rapid A→B→C transitions settle correctly; no old-store content is shown as current. Useful data and preview readiness stay separate.

**Implementation follow-up:** partially implemented; pending feedback verified locally. Installed Next16.1.6 link/transition signals drive scoped pending cues without changing private prefetch policy.100 ms, rapid supersession, failures and reduced-motion browser timing acceptance remain open. See [results and evidence](09_IMPLEMENTATION_RESULTS.md).

**22 October continuation:** Continuation: concurrent mandatory shell reads, handle-only request-cache key, truthful router pending cues and safe expired-session return. Normal browser acknowledged pending and protected Products → Settings saves. Exact 100 ms / full rapid supersession, failed/cancelled and multi-browser timing acceptance remain open. [Evidence](09_IMPLEMENTATION_RESULTS.md#continuation-gate-repair-and-measured-navigation).

## UX-04

**Deep-link destination is lost across authentication** · P1 · source defect

Store layout sends anonymous users to plain lookup; inspected recovery/magic-link links omit context.

Target: [apps/merchant/web/src/app/[store]/layout.tsx](../../../apps/merchant/web/src/app/[store]/layout.tsx) — `unauthenticated redirect; identity lookup/recovery links`.

**Change:** Propagate a server-validated return destination through existing login/signup/recovery/select flows, respecting membership and realm.

**Acceptance:** Open a protected product detail while signed out; sign in and return to that authorized detail. Reject external/protocol-relative/encoded hostile destinations; choose a safe store fallback when membership changed.

**22 October continuation:** Continuation: configured-origin return helper and trusted proxy path/query forwarding correct missing/invalid/revoked-cookie redirects. Real revoked valid-format CLI session failed before and passes now; normal browser sign-in returned to Products and General Settings. All MFA/recovery/invite and zero/one/multiple-store branches remain open. [Evidence](09_IMPLEMENTATION_RESULTS.md#continuation-gate-repair-and-measured-navigation).

## UX-05

**Magic-link request reports a successful next step on HTTP rejection** · P1 · source defect, gated capability

handleSendMagicLink awaits fetch without checking res.ok; capability defaults disabled.

Target: [apps/platform/identity/src/app/lookup/page.tsx](../../../apps/platform/identity/src/app/lookup/page.tsx) — `handleSendMagicLink`.

**Change:** Check the actual command outcome; preserve anti-enumeration policy while exposing safe delivery/request errors. Keep return context and pending intent. Do not enable the feature as part of the fix.

**Acceptance:** With the approved flag enabled only in tests: rate limit, rejected challenge and network failure do not render an unqualified sent state; retry is bounded; safe inputs and destination survive.

## UX-06

**Check-email resend lacks an honest failure path** · P1 · source defect

Resend ignores status, silently catches failures, resets countdown and supplies literal resend-bypass.

Target: [apps/platform/identity/src/app/check-email/page.tsx](../../../apps/platform/identity/src/app/check-email/page.tsx) — `resend handler`.

**Change:** Use the existing challenge/CSRF contract, inspect response status and show permitted retry/error timing. Retain enumeration-safe language.

**Acceptance:** A rejected/rate-limited resend cannot imply delivery or falsely restart successful-send timing. Expired bot evidence obtains a real fresh challenge; no production bypass string is accepted.

## UX-07

**Lookup icon-only controls lack explicit names** · P1 · source accessibility defect

Email edit and password visibility controls contain hidden icons without their own aria-label.

Target: [apps/platform/identity/src/app/lookup/page.tsx](../../../apps/platform/identity/src/app/lookup/page.tsx) — `password step controls`.

**Change:** Reuse named shared icon buttons; show/hide password has an accurate state and does not clear the field.

**Acceptance:** Assistive technology exposes meaningful edit-email and show/hide-password names; keyboard activation works; password managers and paste remain usable; focus returns after editing email.

## UX-08

**Language storage is trusted without enum/storage handling** · P2 · source robustness risk

Several routes cast localStorage language to Lang.

Target: [apps/platform/identity/src/app/login/page.tsx](../../../apps/platform/identity/src/app/login/page.tsx) — `language preference initialization`.

**Change:** Centralize supported-language validation and failure-safe preference reading using the existing localization system.

**Acceptance:** Unknown values and blocked storage yield a supported default; long translations, validation and return links remain coherent; no runtime crash or mixed state.

## UX-09

**Recovery, invitations and session interruption need composed acceptance** · P1 · verification

Routes and existing APIs exist; password reset, staff invitation and expired-session recovery were not exercised in the browser.

Target: [apps/platform/identity/src/app/forgot-password/page.tsx](../../../apps/platform/identity/src/app/forgot-password/page.tsx) — `reset-password; set-password; merchant accept-invite`.

**Change:** Finish acceptance using synthetic accounts and existing issuer/membership boundaries; preserve safe forms after reauthentication.

**Acceptance:** Expired/used reset and invite links show safe recovery. Invite grants only the intended store role; another signed-in account must resolve the mismatch. Session expiry cannot discard a pending product/theme command or silently replay a new one.

## UX-10

**Preserve resumable onboarding and clarify enabled formats** · P2 · refinement and verification

Live step 2 name/subdomain/channel restored on reload; only Online Store enabled. Plan handoff works without purchase.

Target: [apps/platform/identity/src/app/onboarding/page.tsx](../../../apps/platform/identity/src/app/onboarding/page.tsx) — `draft scope; availability; review and create`.

**Change:** Retain the current wizard and server-backed draft; standardize progress/capability language and review summary. Verify race and account scope rather than replace the wizard.

**Acceptance:** Rapid subdomain edits ignore stale availability; unavailable/reserved names block create; duplicate create recovers one site; another account does not see the draft; Back preserves entered fields.

## UX-11

**Plan claims and trial handoff need entitlement alignment** · P2 · verification

Live plan page has large comparison/promotional blocks and future tiers; no purchase made.

Target: [apps/merchant/web/src/app/[store]/settings/plan/page.tsx](../../../apps/merchant/web/src/app/[store]/settings/plan/page.tsx) — `plan and legacy handoff entries`.

**Change:** Converge presentation on the existing subscription contract; label current capability, future availability, renewal, GST and trial end clearly without inventing rates.

**Acceptance:** All plan entry routes show the same entitlement/provider-backed amounts and period; failed/unknown activation is distinct from paid; no test triggers a real charge.

## UX-12

**Search failure is indistinguishable from no entity matches** · P1 · source defect

fetchJsonRows returns empty arrays on HTTP errors/transport failures; debounce and abort already exist.

Target: [apps/merchant/web/src/components/CommandPalette.tsx](../../../apps/merchant/web/src/components/CommandPalette.tsx) — `searchStoreEntities; fetchJsonRows`.

**Change:** Preserve debounce/abort and return typed result states per entity group; show partial results and a retry option.

**Acceptance:** No-match, denied, timeout and partial failure have different safe UI. Switching store while search is pending cannot leak prior results; retry keeps the query and does not spam requests.

## UX-13

**Custom command overlay needs a complete keyboard contract** · P1 · source semantics gap and verification

Overlay is custom div markup; mount focus and Escape exist. End-to-end dialog containment/combobox semantics not established.

Target: [apps/merchant/web/src/components/CommandPalette.tsx](../../../apps/merchant/web/src/components/CommandPalette.tsx) — `overlay, result navigation and category controls`.

**Change:** Compose existing shared overlay/combobox behavior; provide dialog name, focus containment/restore, active result and meaningful chip/filter actions.

**Acceptance:** Open with shortcut and button; Tab stays in modal, arrows/Enter choose the announced result, Escape returns focus. Background is inert; no dead filter control is exposed.

## UX-14

**Disabled Apps route remains advertised as available** · P1 · live defect

Settings Apps and sales channels led to generic 404; sidebar also contains Add. evidence/local-apps-capability-entry-ax.txt

Target: [apps/merchant/web/src/components/settings/settings-navigation.ts](../../../apps/merchant/web/src/components/settings/settings-navigation.ts) — `apps capability; merchantNavigation; app-platform-flag`.

**Change:** Use the existing feature/capability decision for both entry and route. Hide unavailable actions or explain them without linking to a known dead destination; keep feature off.

**Acceptance:** With default flag absent, no available CTA ends at a dead Apps route. Direct entry remains fail closed; recover to the originating store. No marketplace or extension execution is activated.

## UX-15

**Generic not-found recovery loses store context** · P2 · refinement

Live app 404 Back to dashboard returned global stores screen.

Target: [apps/merchant/web/src/app/[store]/apps/page.tsx](../../../apps/merchant/web/src/app/[store]/apps/page.tsx) — `store-scoped error/not-found presentation`.

**Change:** Provide a safe store-aware recovery action when scope is known, while retaining non-disclosure for unauthorized stores.

**Acceptance:** Known owned-store unavailable route returns to that store or Settings; unauthorized store identifiers reveal no details; global picker remains a secondary option.

## UX-16

**Collapsed rail, mobile drawer and flyout parity** · P2 · verification

Mobile drawer focused its navigation container and closed after Products resolved; desktop is 220 px. Collapsed rail behavior not verified.

Target: [apps/merchant/web/src/components/AdminShell.tsx](../../../apps/merchant/web/src/components/AdminShell.tsx) — `AppNavigation and mobile drawer`.

**Change:** Preserve working drawer ownership/scroll locking. Add collapsed mode only if useful and supported by accessible label/flyout behavior.

**Acceptance:** 390 px pointer/keyboard navigation opens, contains focus, closes on destination/Escape and restores scroll. At 200% text no essential item becomes unreachable. Collapsed children remain named and operable.

## UX-17

**Whole-catalog search and sort only operate on the loaded 100** · P1 · source defect

Product page fetches limit=100 then filters loaded products; BFF pagination already exists.

Target: [apps/merchant/web/src/app/[store]/products/page.tsx](../../../apps/merchant/web/src/app/[store]/products/page.tsx) — `loadProducts; filteredProducts; products BFF`.

**Change:** Push matching/sort/page into existing typed API contracts; persist query state in the URL and show accurate count semantics.

**Acceptance:** Seed more than 100 products; a match outside page one is found, stable sort spans the authorized result, changing filters resets page, Back restores it; unrelated-store products never appear.

## UX-18

**Selection and bulk recovery need multi-page acceptance** · P1 · verification

One-row selection and explicit count passed; command idempotency/version handling already exists.

Target: [apps/merchant/web/src/app/[store]/products/page.tsx](../../../apps/merchant/web/src/app/[store]/products/page.tsx) — `StatusJob and row selection`.

**Change:** Keep explicit-ID/current-page scope and existing stable commands; add all-matching only with an approved population contract.

**Acceptance:** Select, filter, page and change scope without silently expanding selection. Partial failure lists exact affected records; retry recovers original intents; revoked access cannot reuse cached permission.

## UX-19

**Product descriptions lack rich editing and safe HTML view** · P1 · refinement with security dependency

Live new-product form is a plain Textarea; persistence works.

Target: [apps/merchant/web/src/app/[store]/products/new/page.tsx](../../../apps/merchant/web/src/app/[store]/products/new/page.tsx) — `Description field and canonical product content contract`.

**Change:** Extend an existing suitable rich-content primitive, or one shared UI adapter if absent, with a bounded format, toolbar, paste cleanup, links, source mode and server sanitization. No arbitrary HTML execution.

**Acceptance:** Bold/lists/links and permitted HTML round trip safely; malformed and script/event/javascript URL payloads cannot execute in editor, preview or storefront. Existing plain-text content remains readable and save recovery still works.

## UX-20

**New products start Active with quantity 10** · P1 · policy review, live defaults

Live empty form/source show Active and inventory 10; synthetic product was explicitly changed to Draft/0.

Target: [apps/merchant/web/src/app/[store]/products/new/page.tsx](../../../apps/merchant/web/src/app/[store]/products/new/page.tsx) — `initial product state and publishing section`.

**Change:** Choose a deliberate safe default using existing product/publication rules; propose Draft and explicit stock entry. Keep inventory policy and channel publication separately visible.

**Acceptance:** Empty new form cannot imply invented available stock or accidental publication. Preview/review shows actual status/channel/stock; digital or untracked products follow their explicit contract. Record the owner policy decision before changing business defaults.

## UX-21

**Uploads and dirty recovery across all record editors** · P1 · verification

Theme media controls and product/media flows exist; no upload failure was injected.

Target: [apps/merchant/web/src/app/[store]/products/new/page.tsx](../../../apps/merchant/web/src/app/[store]/products/new/page.tsx) — `media controls and theme editor controls`.

**Change:** Reuse signed upload/media contracts and shared recovery; define queued/uploaded/processing/rejected status, alt text and replacement semantics.

**Acceptance:** Oversized/unsupported media has a useful message; interrupted upload is recoverable; cancelled/replaced media does not overwrite a newer choice; no cross-store asset access; page leave protects meaningful edits.

**Implementation follow-up:** partially implemented for product work protection. Per-tab actor/store/record-scoped unsaved product recovery is distinct from pending edit commands. Other record editors, interrupted uploads and complete asset-security acceptance remain open. See [results and evidence](09_IMPLEMENTATION_RESULTS.md).

## UX-22

**Setup says a draft zero-stock product is sellable** · P1 · live and source semantic defect

Draft/0 fixture completes Add product described as first sellable item; source primaryComplete uses productsTotal>0.

Target: [apps/merchant/web/src/app/[store]/dashboard/dashboard-setup-status.ts](../../../apps/merchant/web/src/app/[store]/dashboard/dashboard-setup-status.ts) — `buildStoreSetupStatus; DashboardClient checklist`.

**Change:** Separate catalog-created progress from actual launch eligibility using existing server-authoritative rules, or correct the wording to the weaker check. Do not invent a second launch engine.

**Acceptance:** Draft/0 fixture is described truthfully; publishing checks the canonical readiness result. COD configured, online PSP verified, domain reachable and theme customized remain distinct facts.

## UX-23

**Setup helper and dashboard show different progress models** · P2 · live inconsistency and verification

Same fixture: dashboard 4/5, setup assistant 4/6. Their tasks and denominators are not explained.

Target: [apps/merchant/web/src/app/[store]/dashboard/DashboardClient.tsx](../../../apps/merchant/web/src/app/[store]/dashboard/DashboardClient.tsx) — `checklist and setup assistant source`.

**Change:** Share or explicitly distinguish launch blockers versus optional setup tasks; show unavailable checks without counting them complete.

**Acceptance:** Each denominator has a clear meaning; a completed task changes both appropriate surfaces consistently; unavailable backend checks never become success by default.

## UX-24

**Analytics catalog/average-order meaning differs from dashboard** · P1 · live mismatch requiring contract verification

Same fixture: dashboard Products 1 and average —; Analytics Products 0/No products yet and average ₹0. It may use a narrower population; no data-loss claim.

Target: [apps/merchant/web/src/app/[store]/analytics/page.tsx](../../../apps/merchant/web/src/app/[store]/analytics/page.tsx) — `AnalyticsData; analytics BFF`.

**Change:** Define population, event/date basis, status inclusion, currency, freshness and undefined averages; expose meaning and consistent labels. Use existing analytics-read contracts.

**Acceptance:** A draft-only catalog and zero-order fixture show explainable counts and an unavailable average rather than a false calculated value; metric drill-through matches its exact period/population and authorization.

## UX-25

**Merchant pages expose implementation programme terms** · P2 · source and live content defect

BackendNeededPane says WS9/Backend requirement; Analytics refers to current endpoint/service fields.

Target: [apps/merchant/web/src/components/settings/BackendNeededPane.tsx](../../../apps/merchant/web/src/components/settings/BackendNeededPane.tsx) — `availability copy; analytics unavailable text`.

**Change:** Keep capability honesty but replace engineering terms with plain task impact, current actions and appropriate recovery. Keep internal requirements in docs.

**Acceptance:** No merchant-facing WS9, SKIP NEEDS BACKEND or endpoint-field instructions; unavailable data is not zero and no fake working action appears.

## UX-26

**Domain detail/wizard state is not addressable** · P1 · source continuity gap

Domain overview/connect/detail switch through local useState under the same route; invalid-domain validation/cancel passed.

Target: [apps/merchant/web/src/app/[store]/settings/domains/page.tsx](../../../apps/merchant/web/src/app/[store]/settings/domains/page.tsx) — `View union and ConnectDomainWizard`.

**Change:** Represent domain/view/step in existing route/search state with safe ownership resolution; resume only non-secret input and server-confirmed progress.

**Acceptance:** Open a known owned-domain detail directly; reload/Back preserves the selected task; copied link works for another authorized session only. Invalid/unowned domain never leaks status; wizard cancel has a clear return.

## UX-27

**DNS, TLS and domain actions need provider-state acceptance** · P1 · verification

Existing detail, health, DNS and SSL components inspected; no real domain connection or purchase performed.

Target: [apps/merchant/web/src/components/domains/DomainDetailView.tsx](../../../apps/merchant/web/src/components/domains/DomainDetailView.tsx) — `DNS verification, role and certificate lifecycle`.

**Change:** Preserve existing state contracts and independently show DNS ownership, routing, SSL, primary/redirect and last check. No synthetic green health.

**Acceptance:** Use provider-safe fixtures for pending propagation, failed verification, provisioning, active, degraded and retry; copy records accurately; changing primary is idempotent; removal confirms effect and preserves fallback.

## UX-28

**Team, billing, payments, tax and security need role-specific acceptance** · P1 · verification

Settings routes exist; dangerous provider/security mutations not exercised.

Target: [apps/merchant/web/src/components/settings/settings-navigation.ts](../../../apps/merchant/web/src/components/settings/settings-navigation.ts) — `settings capability and authority contracts`.

**Change:** Complete UI truth/permissions using existing APIs. Keep identity factors, finance roles, subscription and storefront readiness separate.

**Acceptance:** Owner/staff/denied roles see only permitted actions; GST/INR and provider mode are accurate; failed/unknown subscription is not active; TOTP enrollment and subsequent sign-in work together; no real charges or credential changes in unattended tests.

## UX-29

**Theme release labels blur visibility and draft state** · P1 · live semantic inconsistency

After save/reload, current hero says LetBuyy Core Unpublished and library badge Published; store remains Private. No Publish button was invoked in the audit.

Target: [apps/merchant/web/src/components/theme-library/ThemeLibraryCard.tsx](../../../apps/merchant/web/src/components/theme-library/ThemeLibraryCard.tsx) — `statusLabel; ThemeWorkspace current theme state`.

**Change:** Expose separate assigned theme, installed instance, saved draft, current release and storefront visibility. Read server lifecycle fields consistently.

**Acceptance:** A private site with a theme release never gives contradictory unqualified labels; Save draft does not imply storefront launch. Reload and return to library display the same release/draft state.

## UX-30

**Wide editor keeps controls stacked at 1920 px** · P2 · measured refinement

Rendered 1440 and 1920 evidence shows one 300 px outline/properties column; unconditional min-width:761 rule overrides wide layout.

Target: [apps/merchant/web/src/components/theme-editor/editor-workspace.module.css](../../../apps/merchant/web/src/components/theme-editor/editor-workspace.module.css) — `theme-os-workspace; sidebar and properties`.

**Change:** Restore an intentional wide three-pane composition when preview retains sufficient width; preserve stacked layout at constrained widths.

**Acceptance:** At 1920 outline and properties have independent usable rails with no clipped controls; at 1440 choose layout from usable preview minimum; 390 tabs and section→properties handoff stay working.

## UX-31

**Draft saved and preview synchronized need distinct status** · P1 · refinement and verification

Saved acknowledgement appeared with preview Syncing; working iframe later reflected saved heading. Not a demonstrated failed save.

Target: [apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx](../../../apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx) — `saveDraft; preview token and iframe readiness`.

**Change:** Retain canonical draft acknowledgements; report save and preview states independently, with scoped version/message checks and preview retry.

**Acceptance:** Delayed preview cannot claim synchronized; successful save remains durable during preview failure; stale iframe messages cannot mark a new store/template ready; retry never creates a new save/publication intent.

## UX-32

**Section catalog needs stronger discoverability** · P2 · refinement

Current editor has schema-driven outline/select-and-add; Shopify demonstrated richer categorized previews.

Target: [apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx](../../../apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx) — `section catalog and add operation`.

**Change:** Use a searchable category list and truthful static/live preview in an appropriate dialog/panel over the existing section schema/add command.

**Acceptance:** Find a permitted section by name/category, inspect it, add once and focus its settings; cancel leaves draft untouched; unsupported schema explains the limit; no third-party block seam is activated.

## UX-33

**Schema forms, release history and publication recovery need full matrix** · P1 · verification

Undo/redo/save/reload passed for Hero heading; library actions and many schema controls exist in source.

Target: [apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx](../../../apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx) — `SchemaFormRenderer; release and conflict handling`.

**Change:** Verify current supported schemas and lifecycle operations; preserve actor/version/idempotency security and existing rollback rather than build another release system.

**Acceptance:** Exercise color/font/media/range/rich text/conditional settings, add/move/hide/remove, templates/translations, stale-tab conflict and timeout recovery; publish/rollback affect only acknowledged saved revisions and preserve later drafts.

## UX-34

**Theme previews and library actions need consistent presentation** · P2 · refinement and verification

Rename 640×268/radius12 and illustrative preview with real-preview link inspected; no rename/save or import executed.

Target: [apps/merchant/web/src/components/theme-library/ThemeLibraryWorkspace.tsx](../../../apps/merchant/web/src/components/theme-library/ThemeLibraryWorkspace.tsx) — `rename/import/duplicate/archive/history`.

**Change:** Keep existing action contracts; polish art consistency, dialogs, progress and outcome wording. Treat source previews as illustrative until rendered.

**Acceptance:** Rename validates and returns focus; import rejects invalid/path-traversal/oversized packages; duplicate has a stable result; destructive actions explain live dependencies; no success before durable acknowledgement.

## UX-35

**Existing plum roles need coordinated chrome and restrained elevation** · P2 · refinement

Measured header #0A0912, rail/CTA #2C2642; broad header search glow visible; one canonical brandInk ramp exists.

Target: [packages/typescript/ui/src/tokens.ts](../../../packages/typescript/ui/src/tokens.ts) — `adminSurfaceIdentity and merchant globals`.

**Change:** Use the proposed role mapping; reduce ambient gradients/glows in workspaces and align header/rail. No new app-local palette file.

**Acceptance:** Identity, merchant, console and generated consumers retain approved scopes; composed states use the same role palette; no stock-violet accent conflicts or unreadable dark controls; Storybook and real page captures reviewed.

## UX-36

**Control boundaries, focus and small targets need composed testing** · P1 · measured risk and verification

Current divider #E5E7EB/white is 1.24:1; setup header button measured 18 px wide. This alone does not establish a full criterion failure because cues/spacing vary.

Target: [packages/typescript/ui/src/tokens.ts](../../../packages/typescript/ui/src/tokens.ts) — `input/button/sidebar focus and density roles`.

**Change:** Use adequate essential-boundary roles, inverse focus handling and reliable hit areas; do not darken every decorative divider.

**Acceptance:** Measure actual adjacent colors, keyboard focus and target spacing at all representative surfaces. Normal text meets applicable 4.5:1; essential non-text cues 3:1. Focus is visible on plum and through overlays; no zero-name controls.

## UX-37

**Spacing and type need pattern-level assignments** · P2 · refinement

Canonical 14/20 body, 13/18 table and 24/32 title already fit the product; local pages vary in stacked cards/toolbars.

Target: [packages/typescript/ui/src/layout.tsx](../../../packages/typescript/ui/src/layout.tsx) — `Page/PageHeader/Section and density tokens`.

**Change:** Apply documented task variants and spacing rhythm; remove redundant headings/nesting; preserve readable operational text. Standardize form recipes with existing BlockStack/InlineStack/Grid/Section and field primitives; document main/aside and Settings compositions rather than add a new form engine.

**Acceptance:** Representative table, form, Settings and editor align on tokens at 390/768/1440/1920; long labels and 200% text wrap without lost actions; no blanket shrink to Shopify compact dimensions.

## UX-38

**Empty, no-match, unavailable and denied states need consistent grammar** · P2 · refinement and verification

Products empty/no-match/clear worked; analytics/backend wording exposes internal terms; shared primitives exist.

Target: [packages/typescript/ui/src/feedback.tsx](../../../packages/typescript/ui/src/feedback.tsx) — `EmptyState/Banner/Toast and illustration registry`.

**Change:** Map states to useful actions; coordinate existing first-use art and Lucide roles before generating gaps.

**Acceptance:** First-use offers a valid create path; no-match preserves filters with clear/reset; unavailable offers retry and retained scope; denied offers safe recovery, never a misleading create CTA; artwork has correct semantics.

## UX-39

**Fixed trial/save/assistant layers can compete on mobile** · P2 · verification

Trial collapse/dismiss exists; user Shopify screenshot illustrated overlapping trial UI. LetBuyy mobile keyboard occlusion not fully exercised.

Target: [apps/merchant/web/src/components/TrialBanner.tsx](../../../apps/merchant/web/src/components/TrialBanner.tsx) — `trial toast; save bars; overlays`.

**Change:** Define layer/placement rules, reserve footer space and retain truthful server trial dates. Avoid simultaneous obstructing promotions and critical work. Treat dirty form, bulk selection, editor toolbar, selected-object tools and trial promotion as distinct scoped patterns; the contextual SaveBar alone owns form dirty state.

**Acceptance:** At 390 and 200% text with keyboard open, focused fields/actions remain visible; collapse/dismiss works; critical errors outrank promotions; trial values match backend dates, including expiry and timezone boundaries.

## UX-40

**Route latency must be profiled separately from loading decoration** · P1 · verification with observed symptom

User noticed delay; local old-content transitions observed. Development compilation and automation delays prevent a production speed claim.

Target: [apps/merchant/web/src/app/[store]/layout.tsx](../../../apps/merchant/web/src/app/[store]/layout.tsx) — `cached auth/store reads; optional store list; products read lifecycle`.

**Change:** Instrument existing request boundaries and route usefulness. Inspect optional switcher wait, current cache deduplication, client fetch timing and superseded reads before changing caching.

**Acceptance:** Record warm/cold, local production build, representative 100+ catalog, p50/p95 and failures for click→ack/route/data. Preserve auth revalidation and private cost limits; no global cache of merchant data or broad prefetch workaround.

**Implementation follow-up:** partially implemented; optional layout wait removed and controlled test passed. Mandatory session/current-store authorization retained; the optional switcher streams independently. Production p50/p95 and representative100+ catalog benchmarks remain open. See [results and evidence](09_IMPLEMENTATION_RESULTS.md).

**22 October continuation:** Continuation: authenticated production-mode before/final HTTP response baselines recorded (ten warm samples/route) separately from cold development compilation and browser readiness. No consistent overall speedup claimed. Full production workload, 100+ catalog and click-to-paint performance acceptance remain open. [Evidence](09_IMPLEMENTATION_RESULTS.md#continuation-gate-repair-and-measured-navigation).

## UX-41

**Checklist, deterministic defaults and generated proposals need honest labels** · P2 · refinement and verification

Live setup assistant is a checklist; AI customization/defaults exist. No Sidekick-equivalent agent was tested.

Target: [apps/merchant/web/src/app/[store]/ai/page.tsx](../../../apps/merchant/web/src/app/[store]/ai/page.tsx) — `AICustomizationPanel and smart defaults`.

**Change:** Scope existing helpers to supported tasks; show preview/accept/discard and factual review. Accept edits draft; Save/Publish remain separate.

**Acceptance:** Unavailable AI retains user input and offers manual editing; generated claims require review; cancel has no mutation; stale output cannot target another store; no claim of general agent capability without a real contract.

## UX-42

**Complete acceptance across remaining route families and authority boundaries** · P1 · verification

13 identity and 80 merchant page files inventoried; selected core browser paths exercised. Not all records/providers/roles tested.

Target: [apps/merchant/web/src/app](../../../apps/merchant/web/src/app) — `route inventory and existing regression suite`.

**Change:** Use the route-family matrix to finish direct-detail, permissions, error, recovery, a11y and data-contract acceptance; each untested branch remains marked.

**Acceptance:** Every in-scope beta journey has a real positive control and relevant negative path tied to revision/evidence; frozen/reference routes are not made active merely to increase coverage; skips never count as passes.

## UX-43

**Header recipes and action metadata need a complete shared contract** · P2 · source refinement

PageHeader exists with adornment and visibility flags; all task contexts share one default geometry. Its default action descriptor has disabled but not loading, while DomainDetailView supplies a custom renderer to wire loading. Passed descriptions/breadcrumbs are hidden unless explicit flags opt in.

Target: [packages/typescript/ui/src/layout.tsx](../../../packages/typescript/ui/src/layout.tsx) — `PageHeaderProps; PageHeaderAction; renderDefaultAction; SettingsPane; DomainDetailView`.

**Change:** Complete explicit index/record/settings/workbench recipes and common action metadata using existing Button and PageHeader. Keep renderAction for real exceptions and readable LetBuyy task titles; do not create parallel headers.

**Acceptance:** Same task identity/actions work across main and Settings at narrow/wide sizes; busy/disabled/unavailable differ, long title and status remain readable, back/description visibility is intentional, and no per-page button clone is needed for ordinary loading.

**Implementation follow-up:** implemented shared loading contract; broader recipe acceptance pending. PageHeader forwards loading/loadingLabel/disabled semantics through Button; the product consumer uses it. Long/localized headers and every route recipe remain open. See [results and evidence](09_IMPLEMENTATION_RESULTS.md).

## UX-44

**Clean SaveBar retains invisible enabled keyboard controls** · P1 · live and source accessibility defect

On the saved synthetic product without editing, the SaveBar ancestor had opacity 0/pointer-events none, but buttons remained enabled/tabIndex 0 without hidden/inert. Tab from Tags focused invisible Discard. evidence/canonical-saved-savebar-focus.json

Target: [packages/typescript/ui/src/feedback.tsx](../../../packages/typescript/ui/src/feedback.tsx) — `SaveBar saved state`.

**Change:** Remove saved-state controls from focus/accessibility/announcements by an appropriate unmount/hidden/inert contract. Preserve needed layout reservation without invisible interactive children. Keep draft/unknown-command protection separate.

**Acceptance:** A clean form has no invisible Save/Discard stop or Unsaved changes announcement. Dirty/busy controls remain reachable; save acknowledgement removes them and restores sensible focus. Main form and Settings callers pass the same keyboard regression.

**Implementation follow-up:** implemented; shared regression and representative browser acceptance passed. Clean SaveBar unmounts; dirty/saving actions remain available; acknowledged clean transition returns focused-bar users to the task heading. Products and Settings share the owner. See [results and evidence](09_IMPLEMENTATION_RESULTS.md).

## UX-45

**Grouped section titles lose semantic heading structure** · P1 · source semantic defect

Section variant grouped renders its title as span; settings-specific card labels also use divs. Standard Section renders h2. Visual grouping therefore has inconsistent heading navigation.

Target: [packages/typescript/ui/src/layout.tsx](../../../packages/typescript/ui/src/layout.tsx) — `Section grouped branch; settings-home-section-label consumers`.

**Change:** Preserve semantic section headings and association through visual variants, using the existing Section owner and documented settings recipes. Define heading levels/labels deliberately; do not introduce another card/form system.

**Acceptance:** Keyboard/assistive heading navigation finds meaningful groups on equivalent main and Settings forms; grouped styling remains compact; nested headings/unnamed sections are avoided; long localized headings wrap.

**Implementation follow-up:** implemented shared/grouped and static Settings heading semantics; representative browser verification passed. Grouped Section uses h2;37 static Settings/domain labels use h2 with the same CSS. Skeleton placeholders and button labels remain non-headings. Full assistive-device/localization sweep remains open. See [results and evidence](09_IMPLEMENTATION_RESULTS.md).

## UX-46

**Page creates a nested main landmark inside AppFrame** · P1 · live and source semantic defect

Fresh local Products DOM contains AppFrame main#admin-page-scroll and a nested main from Page; source reproduces that composition. evidence/canonical-current-products-semantics.json

Target: [packages/typescript/ui/src/layout.tsx](../../../packages/typescript/ui/src/layout.tsx) — `Page; app-shell AppFrame; AdminShell`.

**Change:** Give the shell one main landmark; compose Page as a non-landmark container inside it while preserving a standalone main option where needed. Audit shared consumers before changing the default.

**Acceptance:** Merchant indexes/forms/Settings contain one appropriate main landmark and skip target; standalone identity/other consumers retain their needed landmark. Scroll ports, sticky positioning, focus and width remain unchanged.

**Implementation follow-up:** implemented; representative landmark and consumer compatibility checks passed. Page defaults to a non-landmark div within the shell, with explicit standalone as=main support. Products/General have one main. Identity/console typechecks passed; broader manual consumer acceptance remains open. See [results and evidence](09_IMPLEMENTATION_RESULTS.md).

## Intentional differences that are not implementation gaps

- Keep light-only identity under D-AUTH-LIGHT; do not add a theme switch because a hosted predecessor displayed one.
- Keep the app platform, third-party theme blocks, passkeys and general enterprise/third-party sign-in seams deferred unless the controlling decision changes. Fix misleading entries without enabling their backend.
- Keep India/INR/GST/COD workflows, operator-first navigation and existing approved financial/provider rules. Shopify financial products and pricing do not become LetBuyy requirements.
- Keep Liquid/theme-engine, canonical drafts/releases, the sole identity issuer and shared UI authority. No additional runtime or parallel persistence system is justified by visual parity.
- Native mobile token compatibility is part of shared-system regression; redesigning the Flutter app is outside this requested identity/merchant-web plan.

## Premium canonical tranche — 23 October 2026

UX-35/36/37/43 now have implemented admin roles, essential input/focus contrast, shared card/section/widget/form presentation, explicit header compositions and SaveBar forwarding. UX-44/45 remain covered; the theme library also removes an inner main for UX-46. Three-size representative composition and real save/leave/readback evidence are recorded in [canonical adoption](10_CANONICAL_ADOPTION.md). These are bounded delivery statements: UX-14/15, creation uncertainty and the wider state/provider/device matrix remain open.
