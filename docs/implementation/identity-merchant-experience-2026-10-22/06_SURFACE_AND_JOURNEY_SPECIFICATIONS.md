# Surface and journey specifications

These specifications define proposed interaction outcomes over existing LetBuyy authority. They are not claims that every state has passed. Use the applicable parts for each real task; a small form should not inherit every feature of a full operational workspace.

## Choose a container by task

| Task | Container | Why and required behavior |
| --- | --- | --- |
| Sign in, signup, recovery, verification | Dedicated identity page | Stable account/return context, password-manager support, clear retry and security boundaries |
| Choose an existing store | Dedicated selection page; quick switch popover in shell | Distinguish account identity from membership; full list remains reachable |
| Create a store | Existing full-page wizard | Multiple resumable steps and final review; durable progress rather than a large modal |
| Merchant dashboard | Addressable workspace page | Setup and current operational summaries, with direct supporting links |
| Global command/entity search | Shared modal/combobox | Temporary cross-module lookup; focus containment, clear scope, cancel and restore focus |
| Navigation group children | Inline expansion; named flyout if rail collapsed | Remain discoverable and keyboard operable; no hover-only critical path |
| Store/account switcher | Popover/menu | Small context/action choice; not a second dashboard |
| Notifications | Existing contextual panel/popover | Read state and related destination; permission-scoped data, loading/error/empty distinctions |
| Product/order/customer detail | Durable detail route | Direct links, related information, history and consequential actions need stable context |
| Add/edit product | Full page with contextual save actions | Long form, media, pricing/inventory and draft protection; not a giant modal |
| Small collection/category creation | Focused modal only if short; page for complex rules | Use actual field/dependency complexity; preserve origin and stable record result |
| Inventory adjustment | Focused dialog for one authorized operation | Explicit quantity basis/reason and affected item; server-owned version/intent |
| Purchase order, transfer or receipt | Durable operation detail page | Multiple lines, status/history, downstream effects and independent retrieval |
| Table search/sort/status view | Inline toolbar + URL state | Users need an enduring matching collection, not a disconnected overlay |
| Advanced filters | Popover/drawer according to complexity | Draft filters with Apply/Cancel; active chips and count outside; match server predicates |
| Row action menu | Anchored menu | Only available actions; close before opening a follow-up dialog; restore focus |
| Bulk operation review | Context bar then focused review dialog/page when consequential | State explicit population and effect; partial/unknown results remain retrievable |
| Settings home and category | Separate durable settings workspace | Local navigation/search, store identity, meaningful return to merchant workspace |
| Domain connection | Addressable wizard inside Settings | DNS changes span sessions; Back/reload/resume should preserve confirmed progress |
| Domain detail | Addressable Settings detail | Ownership, DNS, SSL, routing and history need a supportable direct link |
| Domain provider chooser/help | Local selector/popover or focused step | Small branch within wizard; no duplicate full-page header |
| Confirm primary-domain change/remove | Confirmation dialog | Explain routing/redirect/fallback effect and current target; server rechecks authority |
| Billing/subscription/provider checkout | Existing durable handoff page | Amount, currency/period, provider mode and activation recovery; never pretend a modal payment is completed |
| Invite staff | Focused dialog if existing contract is short | Exact recipient/store/role, pending invitation outcome, no implied access before acceptance |
| Manage permissions/security | Dedicated settings page | Consequences and recovery require full context; credential/factor changes need appropriate human control |
| Theme library | Durable Online Store page | Current assignment, visibility, installed versions, discovery and actions in one coherent workspace |
| Theme rename | Focused modal | Single field, validation, Cancel/Save; no route necessary for a temporary edit |
| Theme discovery preview | Modal with truthful artwork and interactive-preview link | Inspect without leaving library; actual demo can be a separate tab/origin |
| Theme import | Focused modal or task page if progress/recovery grows | File validation and bounded transfer; show durable processing state when applicable |
| Theme customization | Dedicated editor workspace | Isolated outline/properties/preview, version and publication authority |
| Theme settings group | Existing editor side panel | Preserve preview and current task; do not replace every field group with a popup |
| Color/font picker | Anchored popover | Fine local choice, keyboard input and Escape; nested overlay focus rules |
| Asset selection | Existing reusable media dialog/panel | Current-store assets, search/upload/processing/alt text; insertion distinct from upload completion |
| Section/block selection | Searchable catalog dialog/panel | Names/categories and truthful preview, explicit Add, focus resulting settings |
| Theme history/conflict | Contextual panel with addressable release evidence where available | Retain current draft, distinguish review/restore/overwrite/publish consequences |
| Theme code/CSS/translation | Existing advanced editor workspace/tab | Validation, scope and security constraints; no arbitrary script execution |
| AI suggestion | Contextual panel/preview | Visible input and output, scope, Accept/Discard, manual path; acceptance does not publish |
| Delete/archive/discard | Appropriate shared confirmation | Exact target/effect, safe Cancel and pending state; avoid unrelated confirmations for routine edits |

Do not standardize every modal to one width or radius because Shopify varies them by task. Proposed LetBuyy size roles are roughly 440–480 px for a short confirmation, 560–640 px for a focused form, and 800–960 px for a supported catalog/preview. These are responsive maxima, not fixed viewport requirements. Use existing shared size variants where suitable, 16 px narrow-screen gutters, bounded scrolling and visible actions. A dialog's maximum height should account for mobile keyboard and safe areas.

## Navigation and loading contract

The owner explicitly reported delayed response/page switching and insufficient UX on the local merchant build. Treat the experience as a first-priority issue even before a production timing benchmark exists.

| Stage | Visible behavior | Authority and completion |
| --- | --- | --- |
| Click/keyboard activation | Immediate selected-destination pending cue in reserved geometry; preserve native modifier/new-tab behavior | Acknowledges intent; does not claim a new page or completed request |
| Pending route | Proposed 2 px indeterminate strip; stable shell/store context; avoid flicker on immediate completion | Actual router/link pending signal, not a fabricated percentage or arbitrary timer |
| Destination fallback | Heading/toolbar/table or form-shaped skeleton in correct layout | Suspense/loading boundary; previous content must not appear to belong to the new store/record |
| Route committed | Pending link/strip settles; destination title and focus/announcement updated | Route work completed, not necessarily useful data |
| Data loading | Scoped busy state, stable geometry; distinguish initial load from refresh | Relevant read request and current scope/version |
| Data ready | Records/count/filter meaning visible; valid actions become available | Successful authorized response; empty and no-match are successful distinct outcomes |
| Read failure | Understandable error +Retry; keep query/safe input and permissible prior-scope context | No fake empty table or default zero; bounded timeout |
| Preview initializing/syncing | Preview-only progress and last valid view where safe | Scoped iframe/store/template/version acknowledgement |
| Cancel/supersede | Clear only the abandoned transition's signal; most recent intent wins | Abort/scoped result checks; no permanent progress strip |

Do not introduce a full white screen to imitate Shopify's occasionally sparse workspace. Old-content retention can be legitimate for a same-scope transition, but it needs clear pending ownership and must not allow actions on a record under a misleading destination. Cross-store/record safety outranks visual continuity.

Current [Next documentation](https://nextjs.org/docs/app/api-reference/functions/use-link-status) describes link-local pending feedback, requires the hook below a Link and warns about layout shift. LetBuyy currently pins Next 16.1.6, so verify the installed API and existing adapter before implementing; a framework upgrade is not part of this UX plan.

## Identity and onboarding journey

The sign-in state model should cover email entry → existing password or approved alternate method → existing MFA challenge when required → authenticated identity → authorized store selection/return. Rejected credentials, challenge expiry, rate limits, unavailable service and invalid return target are distinct transitions. No generic success screen should hide a rejected request.

Keep the email/account context visible with an accessible Change email action. Password visibility changes field presentation without erasing input. Errors identify the relevant field when safe, preserve values, and focus a useful summary or field. Support password managers and paste; do not disable them for visual effect. OTP cells need a logical accessible input model, paste/autofill/backspace behavior and one clear submit path. Countdown and resend reflect server policy and outcome.

Account creation, staff invitation, adding another store and signing in to an existing store remain different tasks. A valid identity does not grant merchant access by itself. Return destinations must survive safe transitions without becoming an open redirect. Recovery and invitation links need expired/used/wrong-account states and a reliable way to resume.

The current onboarding wizard already persists its draft. Refine it: select supported format → store name/subdomain/channel → review → idempotent create → plan/trial handoff. Availability checks ignore stale responses. Show the final safe store URL and editable summary; errors return to the exact affected field. Preserve defaults and entered values across Back/reload. Store creation success does not imply a paid subscription or public storefront.

## Tables, search and metrics

A record list has a scope, matching query, sort order, page/cursor, count semantics and allowed actions. These belong to the existing service contract. Client filtering a first page cannot claim collection search. Keep shareable filters/page in the URL, use stable sort tie-breakers and restore state after detail/Back. Decide page sizes by task and existing API; 25/50/100 are possible bounded variants, not a requirement to replace a better current contract.

Differentiate no records yet, no matching records, unavailable read, denied access and stale result. Clear search resets only relevant filters and returns focus. Keep a useful empty-state action tied to an enabled capability. Include wrapping names, missing images, unknown stock, INR values, long IDs and mixed statuses in realistic fixtures.

Use semantic table headers and accessible sort state. Right-align numeric columns and retain tabular numerals. Mobile may use a labeled record summary for the core fields, as the local Products page already does, while preserving row action/selection semantics. Horizontal scrolling is acceptable for genuinely tabular relationships if controls are reachable and the whole page does not overflow unnecessarily.

Selection states must say “visible page,” explicit selected IDs or a supported all-matching population. Filter changes cannot silently add records. Consequential bulk review shows counts, effect and exclusions. Commands recheck permission, use original idempotency/version contracts and expose partial/unknown outcomes with per-record recovery.

Metric cards require a definition: population, period/timezone/date basis, currency/unit, status inclusion, comparison denominator, freshness and supporting destination. Undefined average is not ₹0. A chart with no buckets has an honest unavailable state; do not synthesize a trend or use a neutral period label as a growth delta. Drill-through opens matching authorized records with the same predicates.

## Forms and add workflows

The common contract is edit → validate → submitting → acknowledged result, with explicit rejected, conflict and unknown states where applicable. Keep safe input. Known validation focuses the relevant field; general service failure offers retry; conflict shows what changed and preserves the local draft. A lost response requires reading/recovering the original command before generating another intent.

Group the product form around identity/content, media, pricing/tax, inventory/fulfillment, organization and publication. Use the canonical product contract; not every product needs every field. Keep status, stock policy and sales-channel publication distinct. The current default Active/10 requires a recorded policy decision; the proposal is Draft plus deliberate stock entry. Review should state what Save changes and whether it affects a public channel.

The description editor should support the approved formatting subset and optional safe HTML source view. It must round trip through server normalization and commerce output safely. Pasting document HTML should strip unsupported formatting without silently deleting meaningful text. Link controls validate protocols; media insertion uses owned assets and appropriate text alternatives. Code/source mode is an authoring representation, not permission to execute scripts. Existing theme HTML/Liquid controls do not automatically establish the right product-content policy.

Create categories, collections, coupons, inventory operations, purchase orders and content using the existing per-domain command and appropriate container from the matrix. Small forms may use dialogs; long multi-line/lifecycle work needs a detail page. “Added” must correspond to durable acknowledgement, not merely closing a modal. If a backend is missing, show a truthful available alternative rather than a fake success.

## Settings and domains

Keep Settings' local navigation, keyword search, store identity and close action. Search changes discoverability, not permission. An unavailable capability must agree across index, nav, commands and direct route. Remove engineering programme labels from the merchant UI while retaining their requirements in source/documentation.

Domain overview should make the current primary/default address clear, with role, DNS/connection, SSL and last-check states where supported. Connection progress is add domain → provider → exact DNS records → verify → activate, using the existing wizard. Domain inputs reject invalid values early, but server checks remain authoritative. Copy actions report exactly what was copied; DNS instructions are structured records, not opaque prose.

Detail/wizard addressability should survive reload and Back. Store role and provider are read from the owned record, not trusted URL parameters. Verification can be pending without being failed; SSL can be provisioning after ownership succeeds. Health scores must come from documented current signals, not cosmetic completion. Primary/redirect actions explain resulting routing and preserve safe fallback. Registration/pricing/renewal/transfer are only shown when existing provider contracts support them; no domain purchase was performed in this audit.

## Themes page and editor

Theme library separates storefront visibility from assigned theme, installed instance, saved draft and published release. A private storefront may have a theme release, but the labels must explain that distinction. The current hero/library mismatch requires one resolver and clear vocabulary. Existing actions should share pending, errors, validation and original-intent recovery. Published dependencies constrain destructive actions.

Discovery keeps curated first-party themes distinct and searchable. Static art says illustrative preview; real preview uses the actual renderer and indicates device/state. Rename is a focused dialog; import is a validated transfer; extensive code/customization is an editor workspace. Never open the app-platform seam to imitate Shopify theme integrations.

Proposed editor layout behavior:

| Width/task | Composition |
| --- | --- |
| Wide desktop with sufficient preview space | Approximately 280–320 px outline rail, flexible preview, 280–320 px properties rail; independent scroll regions |
| Ordinary desktop/constrained preview | Intentional stacked outline/properties rail; preview retains a useful minimum width; toggle panels without losing selection |
| Tablet | Compact panel controls, deliberate preview/settings switching, no tiny scaled desktop form |
| Mobile | Preserve existing Sections/Preview/Settings tabs and successful selected-section→properties handoff; visible return and clear selected item |

Choose breakpoints from actual pane minima and text/reflow tests, not device names alone. The current unconditional min-width rule that forces stacking at 1920 should be corrected within the existing CSS contract.

The outline needs named sections/blocks, visible hierarchy, selected state, add/move/hide/remove operations and keyboard alternatives to drag. A searchable catalog shows permitted schema types and truthful preview. Selection changes the properties heading and focus/scroll appropriately. Settings labels, units, defaults, conditional visibility, reset and validation come from existing schemas; unsupported types do not render fake editable values.

Draft saving, preview synchronization and publication are separate. Save records a version; preview acknowledges the intended store/template/version; Publish uses acknowledged saved state through existing release authority. Unknown, stale-tab conflict, recovered publication and newer local draft must retain precise wording. History/rollback restore through the canonical contract, with source and effect clear. Do not publish unsaved or fabricated preview state.

Test actual current controls: text, rich text, textarea, checkbox, select, range, color/scheme, font, image/video/media, URL, HTML/Liquid, CSS, conditional fields, templates and translations as supported. Shopify's Horizon groups are a useful organization reference, not a hardcoded LetBuyy schema. Preserve all Liquid sandbox, stored-XSS, parse/render/resource limits and upload validation gates.

## Assistance, artwork and motion

Keep the setup helper a named checklist unless it has a real conversational contract. Label deterministic defaults as suggestions. Generated content is a reviewable proposal with Accept/Discard; accepting changes a draft, saving and publishing remain explicit. Require factual review for material/performance/environmental claims and do not invent provenance. A failed generation preserves input and offers manual editing.

Functional icons remain Lucide, with names on icon-only controls and decoration hidden from assistive technology. First-use illustrations use a consistent original family; use compact text/action feedback for no-match/error/denied states. Preserve theme-specific catalog palettes rather than recoloring the storefront universe plum.

Motion follows existing 150/180/200 ms roles, with reduced-motion behavior and no artificial delay. Stable skeleton geometry, reserved pending indicators and image dimensions prevent avoidable shifts. Overlay elevation identifies depth; ambient glows should not obscure boundaries. Trial banners, save bars, assistant panels and toasts obey a shared placement/layer contract, including mobile keyboard and focus visibility.

## Proposed performance acceptance

These are initial product targets for a later production-like baseline, not measured results from this development session. Review against actual device/network/provider conditions before making them release gates.

| Boundary | Proposed initial target | Method |
| --- | --- | --- |
| Activation → visible acknowledgement | ≤100 ms | Browser event/render instrumentation, keyboard and pointer |
| Warm internal navigation → usable destination shell | p95 ≤800 ms | Existing production build, authenticated owned store, repeated representative routes |
| Warm list navigation → useful records or honest empty/error | p95 ≤1.5 s | Representative >100-record fixture; include fetch/readiness, not just heading |
| Saved theme revision → acknowledged local preview | p95 ≤2.5 s on agreed local production-like setup | Version-correlated iframe acknowledgement; failures reported separately |
| Long wait | Useful pending state throughout; bounded read timeout/retry | Delayed and failed fixtures; no indefinite spinner or fake completion |

Collect at least 30 representative repetitions per meaningful warm scenario, report p50/p95 and failure/timeout count, and separate cold compilation, cold server, cached route, data and preview. Use anonymized instrumentation in existing observability; never emit tokens, contact details or merchant content. Optimizations must preserve live permission checks, private read-cost limits and tenant scope. A progress strip is not evidence of a faster app.
