# Current state and Shopify comparison

The comparison uses current LetBuyy source and local browser evidence alongside the dated Shopify study. **LIVE** means exercised in the local browser; **SOURCE** means traced in inspected code; **MEASURED** means rendered geometry or computed style; **PROPOSED** means a design or acceptance target; **VERIFY** identifies a remaining check. A source file or a passing suite does not establish a complete user journey.

## What makes Shopify feel coherent

Shopify's strongest transferable principle is task continuity. The selected store stays understandable; navigation and pending work receive feedback; small contextual tasks stay near their origin; consequential work has a durable workspace; states and actions communicate their effect. Color and density reinforce those distinctions.

The observed Shopify systems are not identical. Login uses a 476 px maximum-width card, 40 px desktop padding and 44 px actions. The refreshed admin uses a black rail, approximately 13/20 px body text and compact 28 px actions on the inspected Domains screen. Embedded Themes/editor uses another neutral palette. At 1920 px its editor has two 300 px outer rails; at 1440 px its controls stack; at 390 px it uses a bottom sheet. These are measured examples in [chapters 01, 07, 09–12](../../research/shopify-product-intelligence/identity-onboarding-2026-10-22/README.md), not universal requirements for LetBuyy.

## Foundations and brand

| Area | LetBuyy current evidence | Shopify reference | Decision |
| --- | --- | --- | --- |
| Color authority | `@letbuyy/ui` `tokens.ts`, primitive/semantic/component/surface layers; admin `brandInk` override | Semantic action, status and surface roles; native and embedded neutrals differ | Preserve one source; refine role coverage and remove accidental stock-violet chrome |
| Primary action | Local `#2C2642`, white text | Nearly black actions; green is not universal CTA | Keep deep purple as the action anchor; avoid bright purple on every card |
| Chrome | 220 px purple sidebar; 64 px near-black header | 220 px expanded / 60 px collapsed refreshed sidebar | Preserve operator IA and useful geometry; coordinate header and rail in one plum family |
| Work surfaces | `#F6F7F9` canvas, white cards, `#111827` text | Native `#101010` text, `#4A4A4A` secondary, `#DDDDDD` borders | Preserve familiar LetBuyy neutrals; increase hierarchy through spacing and role contrast |
| Typography | Local Geist assets; 14/20 body, 13/18 tables, 24/32 page title | Dense native admin, more generous identity | Preserve fonts and readable task density; do not shrink all forms to Shopify's smallest control |
| Icons | Lucide exports; `MaterialIcon` is a compatibility map | Coordinated functional vector icons | Standardize sizes, labels and state; no icon-font migration is needed |
| Appearance | Current identity and merchant roots force light | Dark Shopify identity backdrop does not establish a theme switch | Preserve identity D-AUTH-LIGHT; decide merchant appearance reachability separately from this palette proposal |

Measured local chrome and tables are in [desktop metrics](evidence/local-merchant-desktop-metrics.json). The public hosted accounts screen differed from this checkout and is recorded as a lineage observation, not current-build visual proof.

## Identity and store entry

| Task | Current strength | Gap or remaining acceptance |
| --- | --- | --- |
| Existing email/password entry | Canonical issuer; API rate/CSRF/bot checks; API login/session/logout passed | Lookup/login controllers diverge. API `mfaRequired` has no matching inspected page branch. Icon-only lookup controls lack explicit accessible names |
| Signup | Three steps; explicit OTP labels, paste/backspace behavior; stronger field semantics | Verify expiry/resend/rate limit and return continuity in the normal browser; do not weaken anti-enumeration policy |
| Magic link/check email | Capability is feature gated | SOURCE: ignored response status, dropped return context and literal resend challenge need correction before enabled use; do not report a disabled feature as a current user incident |
| Password recovery | Existing forgot/reset/set-password routes | Preserve trusted destination, safe return and errors across all branches; actual reset would change credentials and was not performed |
| MFA | API challenge response and existing enrollment components | Complete sign-in against existing canonical factor/recovery contracts; no new factor store or passkey system |
| Store chooser | Zero/one/multiple-store logic exists; store switching works | Preserve membership/realm separation, account-scoped drafts and expired-invite behavior; directly test staff cases |
| Onboarding | LIVE: store/channel/name/subdomain/review/create/plan handoff; step 2 restored after reload | Improve capability wording and progress semantics. Additional formats are intentionally disabled; not a request to activate them |
| Plan handoff | Creation reaches real plan selection; trial dashboard accessible without purchase | Reconcile dense plan claims with current entitlement/provider evidence; no Shopify-price copying |

Two presentation implementations over the same issuer are duplication to converge, not evidence of two issuers. Complete the canonical client contract and share its controller/patterns rather than rewrite auth.

## Merchant shell and navigation

`AdminShell` already composes shared `AppNavigation`, owns desktop/mobile scroll ports, closes the mobile drawer on destination changes, traps drawer focus and manages scroll locking. Preserve those behaviors. `MerchantNavigationLink` intentionally disables automatic private-route prefetch; broad prefetching would reintroduce unnecessary reads.

The missing consistency is navigation acknowledgement. During local transitions, old content sometimes remained before the destination resolved; a shell loading state also appeared. No common top progress controller was found in the inspected link/shell path. Add immediate clicked-link feedback, a thin indeterminate strip for actual pending navigation, destination-shaped skeletons and explicit data readiness. Never hold back loaded content merely to reproduce a blank Shopify transition.

Global search already debounces by 250 ms and aborts superseded reads. Its source maps rejected/failed entity requests to empty arrays. It needs separate pending, no-match, partial-result, denied and unavailable outcomes. Its custom overlay also needs shared dialog/combobox semantics and keyboard containment verification. Page search and command search must state their different scope.

The operator-first groups—Home, Orders, Products, Inventory, Purchasing, Customers, Money, Marketing, Content, Analytics, Online Store and Settings—need not become a Shopify copy. Persistent app entries must, however, respect the same capability rules as the destination.

## Records, tables and forms

| Area | Preserve | Complete or refine |
| --- | --- | --- |
| Product list | Draft badge, explicit selection count, empty/no-match distinction and Clear search exercised | SOURCE: first 100 products are fetched and filtered locally. Use authorized collection matching, server pagination and URL state before promising whole-catalog results |
| Product creation | Existing save bar, stable intent, conflicts and uncertain-outcome recovery; save/reload and SQL read-back passed | LIVE: sidebar departure loses input without confirmation. Default Active/quantity 10 needs deliberate policy review. Description is plain text |
| Rich content | Existing theme HTML/Liquid controls and renderer security boundaries | Add a shared product-rich-content adapter only after inspecting existing domain contracts and sanitization. Formatting/HTML mode must not execute arbitrary scripts or imply unrestricted HTML support |
| Customers/orders | Existing independent routes and domain API boundaries | Verify direct details, permission-specific actions, stale edits, return-to-filtered-list and populated cases. Empty fixtures cannot validate fulfillment/refund/customer privacy journeys |
| Bulk work | Existing product selected-row actions and backend command recovery | Maintain current-page/explicit-ID scope; all-matching requires a server-defined snapshot, not expanded client selection |
| Stats | Dashboard distinguishes unavailable average order with an em dash; analytics has timeout/error/retry source behavior | Make metric meaning, dates, INR, inclusion/exclusion, freshness and drill-through consistent; no inferred growth arrows or fabricated zeros |

The dashboard currently marks “Add product” done for the synthetic Draft, zero-stock product while describing a sellable item. Source completion checks total product count, not sellability. This is a demonstrated semantic gap. Payments may legitimately be configured through COD; do not infer online PSP readiness from that badge. The setup assistant and dashboard also show different denominators and need their checklists reconciled or explained.

## Settings and domains

Settings already is a separate workspace with its own navigation/search and close-to-dashboard action. Local search for `dns` correctly narrowed to Domains. Domain overview, a five-step connection wizard, field validation, domain detail, DNS, SSL and health components already exist. Invalid input remained blocked and cancel returned without DNS writes.

Domain views currently live in local `useState` under one URL. Make selected domain and wizard progress addressable using existing routes/search state so reload, Back and support links preserve context. Keep domain ownership, DNS propagation, certificate provisioning, primary/redirect status and storefront publication distinct. A privacy gate on the local storefront is not a renderer failure.

`BackendNeededPane` truthfully avoids fabricating backend work but exposes `[SKIP - NEEDS BACKEND]`, `WS9` and contract language to merchants. Translate this to understandable capability availability and useful existing actions. Keep the internal requirement in engineering documentation.

LIVE: “Apps and sales channels” is advertised as available, but its disabled canonical route produces generic 404. Recovery goes to the global stores screen rather than the originating store. Correct navigation/capability presentation. Do not enable `FEATURE_APP_PLATFORM` to make the test pass.

## Themes and theme editor

| Surface | Current local capability | Recommended change |
| --- | --- | --- |
| Themes workspace | Current storefront/private gate, current theme, installed library, ten first-party designs, search/category filter | One precise lifecycle vocabulary: assigned, installed, saved draft, theme release and storefront visibility. Current “Unpublished” hero and “Published” library badge require reconciliation |
| Theme actions | Inspected menu: Customize, Preview in editor, Duplicate, Rename, View history | Preserve existing actions/release contracts. Verify each permitted state and failure; don't build duplicate systems |
| Rename | LIVE: 640 × 268 px, 12 px radius, labeled field, cancel | Compact task-appropriate dialog and clear validation; no need to copy Shopify's exact 620 × 189 geometry |
| Discovery preview | LIVE: modal explicitly says illustrative preview and links to actual interactive preview | Preserve honesty; improve consistent screenshot art and device framing without misrepresenting a static illustration as live rendering |
| Desktop editor | Outline, selected properties, preview, template selector, saved status, versions | At both 1440 and 1920 controls stay in one 300 px stacked column. Add a wide-screen three-pane mode when enough preview width remains |
| Mobile editor | LIVE: Sections/Preview/Settings tabs; selecting Hero opens properties | Preserve this successful handoff; improve focus/scroll/keyboard without blindly replacing it with Shopify's sheet |
| Draft editing | LIVE: undo restores original; redo restores edit; save persists after reload; dirty Save/Publish separation | Preserve draft authority and recovery; clarify “draft saved” versus “preview synchronized” and publication acknowledgement |
| Preview | Actual commerce iframe rendered after local startup recovery | Stable reserved geometry, independent pending/error/retry and scoped message validation; never infer preview readiness from route readiness |
| Schema controls | Existing HTML/Liquid/color/media/font/conditional controls and validation | Audit all supported schema types against current themes; do not hard-code Shopify Horizon's 19 settings groups |
| Section catalog | Existing select-and-add and outline operations | Improve searchable categorized preview selection and empty/unsupported states using the same schemas and add command |
| Advanced areas | Translation, CSS/code, history, conflicts and rollback paths exist in source | Verify before calling them complete; retain publication/security gates. No third-party app-block activation |

## AI, illustrations, motion and speed

Shopify's Sidekick, description preview and app ecosystem demonstrate contextual assistance and explicit acceptance. LetBuyy's setup helper is currently a checklist, while smart defaults and AI customization have existing scoped paths. Preserve truthful labels: deterministic recommendations are suggestions; generated content is a reviewable proposal; accepting it edits a draft and does not save or publish it automatically. Unsupported factual claims need merchant review. No general agent platform, marketplace or external tools are required for this plan.

Use one coordinated first-party illustration family for first-use states. Keep no results, unavailable, denied and empty separate; operational errors do not need celebratory artwork. Use motion to show hierarchy and state, not to animate every route. Reduced motion and focus visibility apply to progress, menus, previews and toasts.

Local development cold compilation and tool timing cannot establish production performance or a Shopify speed ranking. The plan defines separate navigation acknowledgement, route commit, useful data and editor-preview boundaries. Collect production-like measurements before changing budgets or enabling expensive prefetch.

## Preserved differences and deferred scope

India-first operators, INR/GST/COD workflows, LetBuyy typography, plum identity, site tenancy, the sole issuer, monolith contracts and portable Liquid themes remain. No second token source, React storefront replacement, app marketplace, third-party app blocks, passkeys, enterprise SSO, custody wallet, service fleet or agent platform is proposed. Research breadth does not override the Constitution's frozen seams.
