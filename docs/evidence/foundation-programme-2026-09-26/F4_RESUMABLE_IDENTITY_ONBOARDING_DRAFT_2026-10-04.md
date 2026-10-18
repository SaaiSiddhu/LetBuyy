# F4.2 Identity onboarding draft resume — 4 October 2026

## 5 October continuation — first-store dashboard and plan catalog

The same owned browser scenario now starts Merchant before store creation,
checks that the authenticated plan-selection route denies the not-yet-created
store, then completes onboarding and follows Identity's automatic redirect to
the real owner-scoped plan page. The test verifies the trial-aware heading,
Gateway-backed plan catalog and the Annual billing-period control's accessible
pressed state. A signed-out browser is redirected to Identity sign-in and receives
no plan catalog content. The test does not select a plan or open checkout. The
dashboard remains verified independently in another page of the same
authenticated browser context.

Final runner `e2e4acc16c73` passes 1/1 with no failures, skips, cancellations
or TODOs. Owned Postgres, REST proxy, containers, network and volumes were
cleaned. Identity, Merchant and Gateway typechecks, focused Identity/Merchant
ESLint and `git diff --check` pass. This is local synthetic-session evidence;
email delivery, screen-reader/WCAG conformance, checkout/payment, provider
acceptance and all remaining Phase 4 outcomes remain open.

## 5 October correction — owned Chromium onboarding acceptance

The browser scenario now passes against the real Identity and Merchant Next
applications, Gateway worker implementation, PostgREST and runner-owned Postgres.
The authenticated merchant uses Tab, Enter and Space to choose an online
storefront, enter the name and subdomain, traverse all five sales-channel controls,
and move to review. Chromium verifies the real subdomain response, saves the
account-bound draft, reloads into the saved review step, then uses keyboard
type-ahead for industry, tabs to Create and activates creation with Enter. The
subdomain now has a programmatic label, exposes invalid input state, and associates
availability feedback with a polite live status; the browser checks those
semantics. It rejects the reserved `dashboard` name, checks the announced invalid
state, then accepts the next available value. After creation it opens Merchant web
with the same signed-in owner session, verifies the five-step first-store checklist
and draft-publication state, and checks one page-level H1 followed by checklist
H2 headings. It verifies both the store row and completed onboarding attempt,
and exercises step-heading focus at initial entry, step change, review and
successful completion. This targeted DOM/keyboard evidence is not a screen-reader
test or WCAG conformance claim. See the
[sanitized run record](F4_ONBOARDING_BROWSER_RUN_2026-10-05.json).

This run uncovered and fixed an initialization race: the wizard was accepting input
while its account-bound draft GET was unresolved; an empty response could then reset
the user's current step and erase unsaved choices. The page now keeps an authenticated
user on its loading state until the draft loads, or records the owner and permits a
blank-form continuation if that read fails. The focus effect waits for the same
initialization state. The browser regression deliberately delays the draft GET,
asserts the wizard is not interactive before resolution, and verifies all changed
sales channels have reached Postgres before it reloads.

| Check | Result |
|---|---|
| Owned suite `storefront-web-onboarding-browser.postgres.test.ts` | **1/1 passed**; no failures, skips, cancellations or TODOs; final runner `e2e4acc16c73`; Postgres 16/PostgREST, local Identity/Merchant/Gateway and Chromium; database, REST container, network and volumes cleaned. |
| Identity `pnpm exec tsc --noEmit` with temporary link to installed workspace dependencies | Passed; the temporary link was removed. |
| Identity `pnpm exec eslint src/app/onboarding/page.tsx` | Passed. |
| Identity, Merchant and Gateway typechecks; focused Identity/Merchant ESLint; `git diff --check` | Passed; temporary app dependency links were removed. |
| Email delivery | **Not verified.** No provider key was configured; the synthetic creation flow logged provider-unconfigured failure, and no external email was sent. |

The targeted markup addresses the W3C guidance for [labels and instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions) and [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages). These references informed this local fix; they do not establish conformance.

Acceptance scope is the authenticated onboarding browser journey with a synthetic,
pre-minted merchant session. The full tested creation journey uses keyboard input
for site type, name, subdomain, all sales channels, review, industry selection and
creation. It does not exercise normal browser sign-in, email verification
delivery, production notifications, screen-reader behavior, hosted deployment or
the rest of Phase 4. F4.2's local resume/create journey is accepted for this tested
path; F4.7 and Phase 4 remain open. Next local F4.7 task: extend accessibility
acceptance to screen-reader support and the broader merchant web/mobile paths.
Email delivery remains a separate acceptance requiring a configured
nonproduction sender; this run used none.

Source checkout: `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`,
HEAD `0862687a5008d604d0df23357b2eb511293139fa`; local changes remain uncommitted.

## Outcome

The signed-in Identity onboarding wizard now saves its current step, site type,
store name, subdomain and industry in browser local storage under a key scoped
to the authenticated user ID. Returning to the wizard in the same browser and
account restores the form and step. A restored subdomain is checked again
against the current Gateway availability endpoint; old availability results
are never treated as current. Creating the store still uses the authenticated
Identity BFF and canonical Gateway `POST /stores` path, and clears the browser
draft only after that path succeeds.

Malformed, unsupported-version or invalidly shaped draft data is discarded.
Storage errors do not prevent onboarding. Switching accounts selects a
different draft key and delays saving until the new account's draft has loaded.
User-facing save/restore status is available in English, Hindi and Tamil.

## Verification

- `node --experimental-strip-types --experimental-loader /private/tmp/letbuyy-ts-resolve-loader.mjs --test src/__tests__/onboarding-draft.test.ts` — 2/2 passed. The temporary Node loader resolves the extensionless TypeScript helper import; `tsx` itself could not start because the sandbox denied its temporary IPC socket.
- `git diff --check` for the three changed Identity source/test files — passed.
- Identity `pnpm exec tsc --noEmit` — unavailable as a meaningful gate in this checkout: linked Next/React/workspace packages and Node type declarations are missing, producing broad existing resolution errors.
- Identity ESLint — unavailable because `eslint-config-next` cannot be resolved from the app package.
- No browser, cross-device, Gateway-owned-draft or server persistence acceptance was run. This implementation resumes only in the same browser profile. It does not yet deliver the full F4.2 business/contact validation, channel choice or onboarding checklist.

## State

This is a local implementation slice, not F4.2 acceptance and not Phase 4
closure. The Gateway six-step onboarding-attempt API remains separate from this
wizard; its completion writes are not yet made atomic or reconciled with the
Identity web contract. Next, complete the normal storefront onboarding
requirements through the existing canonical flow, then strengthen or replace
the mobile-attempt completion contract before connecting it to the web UI.
Phase 4 and the eleven-phase programme remain active.

## Same-day correction — server-backed draft continuation

The initial browser-local draft implementation above was superseded on 4
October. The Identity page now reads and saves the draft through its existing
session-protected `/api/auth/create-store` BFF surface, which forwards to new
Gateway `/onboarding/web-draft` endpoints. Gateway saves into the existing
`onboarding_attempts` row through migration 283's per-user locked SQL function;
the GET response is an explicit allowlisted projection, not a raw attempt row.
The existing `/stores` creation remains canonical. After creation, a second
transaction verifies both the signed-in user's store ownership and draft owner
before marking the attempt/profile complete. If that response is lost, the next
draft read checks the exact saved handle against that same user's owned store
and reconciles the completion.

Identity and Gateway TypeScript checks pass; focused Identity ESLint passes;
Gateway/Identity source-contract tests pass 8/8; the migration safety validator
and focused `git diff --check` pass. The owned real-worker/Postgres suite is
authored for same-account persistence, cross-account denial, concurrent saves,
invalid data, store-owner denial, completion replay and lost-response recovery.
The runner could not provision it because this environment has no responding
Docker daemon (0 tests executed). No browser run occurred. The earlier
browser-local behavior should not be described as the current implementation;
server persistence is source/typechecked but database/browser acceptance
remains unverified. Business/contact validation, channel choice and full
checklist integration remain open, so F4.2 and Phase 4 are still active.

The Identity package has no `node_modules` link in this checkout. Its typecheck
and focused ESLint were run using a temporary symlink to the existing Commerce
web dependency tree, then the symlink was removed; no package installation or
manifest change was made.

## Same-day continuation — verified merchant contact

The canonical Gateway `POST /stores` path and the older mobile
`POST /onboarding/:attemptId/complete` path now require `users_custom.email_verified`
to be exactly `true` before creating a storefront. `resolveCustomUser` carries
that persisted field; an unverified, missing, or unavailable user profile does
not satisfy the check. Both paths return `EMAIL_VERIFICATION_REQUIRED` with a
safe instruction to verify the account email. The Identity review step shows the
signed-in account email used for merchant correspondence. This reuses the
existing OTP/email verification flow and does not collect marketplace KYC or a
new phone number during basic storefront setup.

Verification on 4 October 2026:

- Focused Gateway source and resolver tests — 6/6 passed using Node's TypeScript
  loader. The package's `tsx` launcher could not create its temporary IPC socket
  in this sandbox (`EPERM`), so that failed launcher attempt is not counted as
  a test run.
- Gateway `pnpm --filter @letbuyy/api-gateway typecheck` — passed.
- Identity `pnpm --filter @letbuyy/identity-platform typecheck` and focused
  ESLint on `src/app/onboarding/page.tsx` — passed using a temporary link to
  the existing Commerce dependencies; the link was removed afterward.
- Focused `git diff --check` — passed.
- No browser or real Postgres journey was run. The pre-existing owned database
  suite remains unavailable until a Docker daemon responds. Its real Gateway
  suite now contains an unverified-denial/no-row assertion followed by a
  verified-email creation success assertion, but that new test has not run.

This closes the verified-email portion of minimum contact validation. The
onboarding wizard still needs an explicit reviewed channel model beyond the
currently available Online Store choice and end-to-end acceptance of the new
merchant's dashboard checklist and its underlying completion signals. F4.2 and
Phase 4 remain active.

## Same-day continuation — persisted sales-channel intent

The Identity web wizard now lets a merchant select the same five sales-intent
values used by the existing merchant-mobile wizard: `online`, `retail`,
`social`, `marketplace` and `events`. The draft autosave and resume response
carry these values on the existing account-owned `onboarding_attempts` row;
the Gateway validates the allowlist and the SQL writer stores them in
`survey_data.channels`. Old web drafts without this field resume with `online`
selected. The review step lists the chosen channels. The form explicitly says
these answers guide setup and do not activate integrations or grant marketplace
access, which remains subject to separate review and approval. The write uses
the existing aggregate and transaction lock; migration 284 replaces the
restricted service-role RPC signature and has a paired rollback that restores
the previous writer while leaving channel intent in the aggregate.

Verification on 4 October 2026:

- Identity/Gateway focused tests — 12/12 passed via Node's TypeScript loader.
- Gateway typecheck and Identity typecheck — passed.
- Focused Identity ESLint on the onboarding page — passed with the shared UI
  Checkbox component.
- `pnpm validate:migrations` — passed for the migration/rollback set.
- The owned Gateway/Postgres suite now checks channel intent round-trip,
  allowlist denial at the route and SQL boundaries, alongside the prior account
  isolation/concurrency/completion cases. Its syntax check passed, but no
  Postgres test ran because Docker is unavailable.
- No browser interaction was performed; normal visual and keyboard journey
  acceptance remains outstanding.

This supersedes the immediately preceding paragraph's open channel-model item:
the web wizard now captures and persists channel intent. It does not mark any
channel eligible or accepted. New-merchant dashboard checklist completion
signals and the broader F4.2 acceptance journey remain open.

## Same-day continuation — merchant setup-check availability

The first-store dashboard previously converted failed product, shipping and
payment reads into ordinary incomplete checklist items; shipping failures were
even treated as a successful empty response. The server now carries availability
separately from completion for product/page, shipping and payment signals. Valid
empty results still mean “checked, incomplete”; rejected or malformed reads
mean “couldn’t verify.” Both the activation board and compact setup guide show
that state, exclude unknown checks from the completion percentage, and offer a
retry that refreshes the authenticated server page. The task links remain
available for merchants who want to configure an item while a check is down.

The domain check now follows the store's canonical domain lifecycle: the default
`subdomain.letbuyy.com` is launch-ready, and a custom domain replaces it in the
dashboard only after the Gateway reports that domain `active`. A pending/error
custom-domain value no longer appears as the working storefront address or
causes the “use the default domain” checklist step to be shown as incomplete.
The authorized `GET /stores/handle/:handle` path now selects and returns
`custom_domain_status` for both owner and active staff resolutions; its access
predicate is unchanged.

Verification on 4 October 2026:

- Focused status mapping tests — 5/5 passed with Node 22's built-in TypeScript
  stripping; cases cover valid empty responses, failed reads, page status,
  COD/shared/verified-own-account payment readiness, and default/custom domain
  selection.
- Gateway focused owner/staff store-resolution test — 1/1 passed; it checks the
  selected projection and returned domain lifecycle status while preserving
  stranger and wrong-store denial.
- Prescribed Gateway unit lane — **1,415 passed, 0 failed, 0 skipped, 1 TODO**.
  A stale operator-gate error-code assertion was corrected from the old
  `PERMISSION_SCOPE_DENIED` to the current `FORBIDDEN`; refusal and zero-read
  assertions remain. The remaining TODO is the unrelated open `LB-BIL-002`
  multiple-store billing contract.
- Gateway TypeScript check — passed.
- Merchant web TypeScript check — passed.
- Focused ESLint on the dashboard, status helper/test and merchant session source
  — passed with zero errors; it reports two existing `_userId` unused-parameter
  warnings in `session.ts`.
- `git diff --check` — passed.
- No browser/keyboard journey was run: the available Mac session is locked and
  no browser tab is exposed to this task. Docker is unavailable, so no owned
  database lane was applicable or run for this UI-only status mapping.

This closes the specific false-incomplete/error-state and default-versus-custom
domain-selection gaps in the dashboard's setup signal mapping at source level.
It does not prove the new merchant's full browser journey or F4.7 accessibility
across merchant web/mobile; Phase 4.2 and the eleven-phase programme remain
active.

## Same-day correction — owned Gateway/Postgres onboarding acceptance

The first owned execution exposed two contract defects that source/type checks
had missed. The shared idempotency middleware treated the pre-store web draft
`PUT` as a site-scoped mutation even though the merchant has no site yet; the
existing `save_storefront_web_onboarding_draft` RPC instead serializes this
account-owned aggregate with a per-user transaction lock. The exact `PUT
/onboarding/web-draft` is now excluded from that site-bound middleware. Draft
completion remains protected and the Identity BFF sends a stable key derived
from the draft attempt ID, allowing a retry after store creation to replay the
same completion response.

The same real Postgres run then exposed a stale write in migration 283:
`user_profiles.onboarding_completed` does not exist. Migration 285 replaces
the completion function without that write; `onboarding_attempts.status` is
the canonical completion signal. The paired rollback restores the prior
function body.

Verification on 4 October 2026:

- Initial owned runner run `8feb013e12ce`: 1/4 passed, 3/4 failed at the
  missing pre-store idempotency contract. Rerun `259e504b52f9`: same result.
- After the client/middleware correction, owned run `eab4151c7d36`: 2/4
  passed. Its finalization failure identified the nonexistent profile column;
  no result from that run is counted as acceptance.
- Final owned Gateway/Postgres run `cd1458ea0f3c`: **4/4 passed, 0 failed,
  0 skipped, 0 TODO**. This exercised concurrent account-bound saves,
  cross-account isolation, invalid data and sales-channel rejection, owned
  store completion and replay, lost-response recovery, and verified-email
  enforcement through the real worker and disposable Postgres/PostgREST fixture.
- Focused Gateway/Identity source-contract tests: **13/13 passed**.
- `pnpm --filter @letbuyy/api-gateway typecheck` — passed.
- `pnpm validate:migrations` — passed, including the forward/rollback pair.
- Identity app `tsc --noEmit` is not a usable check in this checkout because
  its local `node_modules` link and Next/React/workspace type dependencies are
  absent. The new stable-key behavior is covered by the source-contract tests.
- No browser run occurred; this Mac session remains locked. The local owned
  worker/database result does not establish browser, provider, hosted or
  release acceptance.

This closes the specific source-to-database integration gap for the web draft
save/completion path, but it does not close F4.2 or Phase 4. The merchant's
full browser journey, F4.7 accessibility coverage and other Phase 4 acceptance
remain open; the eleven-phase programme is still active.

## Same-day continuation — full merchant browser journey added

Added `services/api-gateway/src/__tests__/owned-db/storefront-web-onboarding-browser.postgres.test.ts`
to exercise the actual Identity wizard in headless Chromium against a real
Gateway worker and the owned Postgres lane. The journey authenticates a
synthetic, verified merchant, selects an online store and sales-intent
channels, persists and reloads the draft, restores the form, selects an
industry, creates the store through the Identity BFF, and checks that one
draft is completed with the selected details. The app and Gateway bridge bind
only to loopback, the identity signing key and account are synthetic, and the
Identity API credentials are revoked with the disposable database.

Verification on 4 October 2026:

- Gateway TypeScript check — passed after adding the suite.
- `pnpm validate:migrations` — passed.
- `git diff --check` — passed for the touched programme/evidence and suite paths.
- Owned runner attempt `ddaa048f9fc9` did not start the suite: the executable
  database runner reported that no real Docker daemon answers `docker info`.
  The suite therefore has **no browser/runtime result yet**; its code and
  acceptance assertions have only been typechecked. The runner's isolated
  Postgres requirement was not bypassed with a shared or restored database.

This provides the missing automated acceptance path, not evidence that it
passes. Once the owned database lane is available, run this suite and fix any
observed integration failures before closing F4.2. Browser acceptance,
accessibility acceptance, subscriptions and the rest of Phase 4 remain open.

## Same-day F4.7 correction — onboarding step focus

The wizard now moves keyboard focus to the new step heading after a step change,
draft restoration, and successful store creation. The focused heading is removed
from the regular Tab sequence, while native buttons and form controls retain
their existing keyboard order. The headless Chromium suite checks initial focus,
step transitions, review and the success announcement.

Verification on 4 October 2026:

- Identity app TypeScript check — passed using a temporary symlink to the
  already-installed workspace dependencies; the symlink was removed afterward.
- Focused ESLint on `apps/platform/identity/src/app/onboarding/page.tsx` — passed.
- Gateway TypeScript check, including the browser suite and focus assertions — passed.
- Runtime keyboard assertions remain unverified because the owned database
  runner did not start without Docker. This is a targeted keyboard-navigation
  fix, not WCAG conformance or F4.7 acceptance.

## 5 October F4.7 continuation — announce the complete store URL

The visible platform-host suffix is now included in the subdomain input's
`aria-describedby` alongside its live availability result. This gives assistive
technology users the same complete store URL context that sighted users see
beside the field. The owned Chromium journey now checks that both description
IDs are associated with the input while retaining the existing invalid/valid
status assertions.

Identity TypeScript and focused ESLint pass. Gateway TypeScript, which includes
the owned browser test source, passes; `git diff --check` passes. The owned
Chromium/Postgres runner cannot start on this host because Docker's socket is
inaccessible, so the browser assertion has not run. No screen-reader, TalkBack,
WCAG-conformance or cross-app accessibility result is claimed. F4.7 and Phase 4
remain open.

## 5 October F4.7 mobile continuation — product image controls

The merchant product editor's image-picker tile now exposes an explicit
accessible button name and action. Product previews are labelled as images and
identify the primary image; remove-image controls expose a labelled button
action and meet a 44px minimum hit-target size. A widget journey adds an image
through the image-URL flow, verifies the preview's image semantics and the
accessible add/remove controls, then removes the image through the labelled
action.

Verification on 5 October 2026:

- Focused Flutter widget test `product image add and remove controls expose
  clear semantics` — **1/1 passed**.
- Flutter analysis of `product_form_screen.dart` and `mobile_services_test.dart`
  — passed with no issues.
- `git diff --check` for the implementation, test and evidence files — passed.
- Flutter required local loopback access for its test harness. The run used a
  disposable SDK/cache overlay and workspace package configuration; it did not
  alter the installed SDK or dependency lockfile.
- This is local widget semantics evidence, not a device TalkBack or independent
  screen-reader test. Full F4.7 and Phase 4 acceptance remain open.

## 5 October F4.7 mobile continuation — product specification removal

The product Details editor now gives each specification delete control a
tooltip naming the specific value it removes. The widget journey opens Details,
adds a `Material: Cotton` specification, checks the control's tooltip, button
role and tap action in the semantics tree, then removes it and verifies the
empty-state message.

Verification on 5 October 2026:

- Focused Flutter widget test `product specification removal exposes its value
  and action` — **1/1 passed**.
- Flutter analysis of `product_form_screen.dart` and `mobile_services_test.dart`
  — passed with no issues.
- `git diff --check` — passed.
- Flutter used the existing disposable SDK overlay and an isolated config under
  `/private/tmp`; no project dependency or lockfile was changed.
- The tooltip/button semantics are verified locally. Device TalkBack and an
  independent screen-reader check remain open; this does not close F4.7 or
  Phase 4.

## 5 October F4.7 mobile continuation — variant action context

Variant edit/delete tooltips now identify the affected variant by its visible
title, with a stable numbered fallback when the title is empty. The widget
journey adds a `Small` variant, verifies `Delete Small variant` exposes a
button and tap action, then deletes it and confirms the empty state.

Verification on 5 October 2026:

- Focused variant-matrix and accessible-action widget journeys — **2/2 passed**.
- Flutter analysis of `product_form_screen.dart` and `mobile_services_test.dart`
  — passed with no issues.
- `git diff --check` — passed.
- No device TalkBack or independent screen-reader test was performed. F4.7 and
  Phase 4 remain open.

## 5 October F4.7 mobile continuation — plan catalog controls

Merchant mobile plan cards now expose a single named button semantic containing
the plan, price/period, product allowance, fee, and up to three included
features. Popular/current state is announced, the active plan is marked
selected and disabled, and other plans use a keyboard-capable `InkWell` plus an
explicit semantic tap action. A missing stored plan is consistently treated as
the free trial in both the current-plan display and the selection guard.

Verification on 5 October 2026:

- Focused Flutter widget test `subscription plan cards expose labeled
  selectable semantics` — **1/1 passed**. It verifies the default trial's
  selected/disabled state and an enabled paid-plan action; its fake API records
  only the store-list request. No plan was selected and no payment flow ran.
- Flutter analysis of `pricing_screen.dart` and `mobile_services_test.dart` —
  passed with no issues.
- `git diff --check` — passed.
- Flutter used the existing disposable SDK overlay, an isolated `/private/tmp`
  config, and local loopback for the widget harness. No project dependency or
  lockfile was changed.
- Device TalkBack, keyboard operation on a device, and independent
  screen-reader review remain open. F4.7 and Phase 4 are not complete.

## 5 October F4.7 mobile continuation — keyboard plan journey and compact sheet

The normal Enter-key activation journey for a paid plan now opens its details
sheet. That journey exposed a 127px vertical overflow on the compact widget
viewport, which hid part of the content. The sheet now keeps the payment CTA in
a fixed footer and scrolls plan details in the remaining space, with an
expanded height and bottom safe-area handling.

Verification on 5 October 2026:

- Focused keyboard journey `keyboard activation opens the selected plan details
  only` — **1/1 passed**. The test uses a paginated fake `/stores` response,
  focuses Starter, sends Enter, verifies plan details and the visible payment
  CTA, asserts no layout exception, and confirms the only API call is the
  synthetic store-list read. It does not press the payment CTA or issue a
  subscription/payment request.
- The corrected focused plan-card semantics test — **1/1 passed** using the
  same realistic paginated store fixture.
- Flutter analysis of `pricing_screen.dart` and `mobile_services_test.dart` —
  passed with no issues; `git diff --check` passed.
- This is a local widget keyboard journey, not a physical-device keyboard or
  TalkBack/independent screen-reader review. F4.7 and Phase 4 remain open.

## 5 October F4.7 mobile continuation — product-list edit access

Merchant product cards now expose a named, enabled button action in normal
catalog mode, with an `Opens product editor` hint and keyboard activation.
Selection state is only announced while bulk selection is active; long-press
selection and the nested select/deselect control remain available.

Verification on 5 October 2026:

- Existing synthetic merchant product journey now verifies the product card's
  label, hint, button/enabled flags and tap action, focuses the card and sends
  Enter to open `Edit Product`, then completes the importer-disclosure edit
  request assertions — **1/1 passed**.
- Flutter analysis of `products_screen.dart` and `mobile_services_test.dart` —
  passed with no issues; `git diff --check` passed.
- The phone-device check was unavailable in this shell (`adb` is not installed).
  Device keyboard/TalkBack and independent screen-reader review remain open;
  this does not close F4.7 or Phase 4.

## 5 October F4.7 mobile continuation — product bulk-selection state

The product selection checkbox now exposes selected state and uses a
keyboard-capable `InkWell`; its semantic label changes between select and
deselect. The card announces selection only while bulk-selection mode is active,
so normal product browsing does not report every item as unselected.

Verification on 5 October 2026:

- Focused `product bulk selection announces the selected state` widget journey
  — **1/1 passed**. It enters bulk-selection mode, verifies the accessible
  select control, focuses the product checkbox, activates it with Enter, and
  verifies the checkbox/card selected states and updated count.
- Flutter analysis of `products_screen.dart` and `mobile_services_test.dart` —
  passed with no issues; `git diff --check` passed.
- The flow uses synthetic paginated store/product responses. Device keyboard,
  TalkBack and independent screen-reader checks remain open; F4.7 and Phase 4
  remain active.

## 7 October F4.7 mobile continuation — select-all keyboard action

The product bulk-action summary's “select all visible products” control now
uses a keyboard-capable `InkWell` inside its existing accessible semantic
boundary. The control remains one named button for assistive technology, keeps
its 48px minimum target and preserves its existing selection callback.

Verification on 7 October 2026:

- The focused `product bulk selection announces the selected state` widget
  journey passes **1/1**. It enters selection mode, selects one product with
  Enter, verifies the select-all label/hint/button/tap semantics, focuses that
  action and presses Enter; both products become selected.
- Targeted Flutter analysis of `products_screen.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
- The installed Flutter SDK could not write its cache and default telemetry
  config. Using the existing temporary SDK overlay and `/private/tmp` config,
  the first run was blocked before test execution by the sandbox's localhost
  socket restriction; the reviewed local-socket rerun passed. No app
  dependencies or lockfiles were changed.

This is synthetic local widget evidence, not physical keyboard, TalkBack or
independent screen-reader acceptance. ADB remains unavailable; F4.7 and Phase
4 remain active.

## 5 October F4.7 mobile continuation — product status filters

Product status filters retain their accessible label, selected/current state and
tap action while gaining keyboard focus/Enter activation through `InkWell`.
Their horizontal filter row is now tall enough to honor the existing 48px
minimum control target.

Verification on 5 October 2026:

- Focused `product status filters support keyboard selection` widget journey —
  **1/1 passed** with synthetic active/inactive products. It checks the filter's
  label, hint, button/action and selected states, asserts a control height of at
  least 48px, then focuses `Inactive`, activates it with Enter and confirms only
  the inactive product remains visible without layout exceptions.
- Flutter analysis of `products_screen.dart` and `mobile_services_test.dart` —
  passed with no issues; `git diff --check` passed.
- The phone/device keyboard and TalkBack remain unverified (`adb` is unavailable
  in this shell). F4.7 and Phase 4 remain open.

## 5 October F4.7 mobile continuation — order status filters

Merchant order status filters now retain their selected/current accessibility
state while accepting keyboard focus and Enter through an `InkWell`. The filter
row meets a 48px minimum height. The synthetic widget fixture stubs the native
app-badge channel so the actual `OrderService.fetchOrders` path can complete in
Flutter's test environment.

Verification on 5 October 2026:

- Focused `order status filters support keyboard selection` widget journey —
  **1/1 passed**. It loads pending and delivered orders through the fake API,
  checks the filter label, hint, button/tap and unselected state plus 48px
  height, then activates Pending with Enter and confirms Pending remains while
  Delivered is filtered out.
- Flutter analysis of `orders_screen.dart` and `mobile_services_test.dart` —
  passed with no issues; `git diff --check` passed.
- This is synthetic local widget evidence. Device keyboard, TalkBack and
  independent screen-reader checks remain open (`adb` is unavailable); F4.7
  and Phase 4 remain active.

## 5 October F4.7 mobile continuation — merchant order-card selection

Order cards now expose a keyboard-capable button with order number, status,
customer, total and item-count context. Its hint and selected state track bulk
selection mode. The per-order checkbox has a named, selected action and a 48px
minimum target. Child semantic nodes remain explicit so nested card actions can
retain their own accessibility representation.

Verification on 5 October 2026:

- Focused `order cards support keyboard selection with named semantics` widget
  journey — **1/1 passed**. It checks the order card's descriptive label,
  details hint, button/tap/enabled state and target size; starts selection mode;
  focuses the card and activates it with Enter; then checks the card and
  checkbox selected state, dynamic hints and bulk-selection count.
- The existing `order status filters support keyboard selection` journey passes
  **1/1** after the card change. Flutter analysis of `orders_screen.dart` and
  `mobile_services_test.dart` reports no issues.
- Both journeys use fake paginated store/order data and a local app-badge
  channel handler. `git diff --check` passes. Device keyboard, TalkBack and
  independent screen-reader checks remain open (`adb` is unavailable); F4.7
  and Phase 4 remain active.

## 5 October F4.7 mobile continuation — dashboard reporting period

The merchant dashboard's reporting-period picker now has a single named button
announcement, reports the current period, accepts Enter, and meets the 48px
minimum target. The picker sheet now supplies a transparent Material layer for
its `ListTile` ink feedback; the widget journey had exposed a Flutter warning
that the prior decorated sheet obscured those splashes.

Verification on 5 October 2026:

- Focused `dashboard period picker supports keyboard and reloads metrics`
  widget journey — **1/1 passed**. It verifies the semantic label/current
  period/button/action/target size, opens the period sheet with Enter, chooses
  `7 Days`, and confirms the real analytics-service request carries
  `store_id=store_1` and `period=7d`. It checks for layout/framework exceptions.
- Existing `StoreMainScreen loads each operator tab from gateway data` journey
  passes **1/1**. Flutter analysis of `home_screen.dart` and
  `mobile_services_test.dart` reports no issues.
- Tests use fake Gateway data and local native-channel handlers;
  `git diff --check` passes. Device keyboard, TalkBack and independent
  screen-reader checks remain open (`adb` is unavailable); F4.7 and Phase 4
  remain active.

## 5 October F4.7 mobile continuation — dashboard quick-action keyboard access

The merchant dashboard's five quick-action rows and reusable compact action
pills now use keyboard-capable `InkWell` controls while retaining their named
button semantics, press feedback, haptics and existing callbacks. The orders
row was exercised through its real named-route callback rather than testing
the control in isolation.

Verification on 5 October 2026:

- Focused `dashboard quick actions open routes with Enter` synthetic widget
  journey — **1/1 passed**. It checks the Manage Orders label, hint, enabled
  button/tap semantics and 48px minimum target, focuses the action, presses
  Enter and confirms the Orders destination opens with no framework exception.
- Focused `core custom tap controls expose actionable semantics` journey —
  **1/1 passed** with Enter activation for the compact Add product pill and
  pointer activation for Store profile.
- Targeted Flutter analysis of `quick_actions_grid.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
  These are synthetic local checks. Physical keyboard, TalkBack and independent
  screen-reader verification remain open (`adb` is unavailable); F4.7 and
  Phase 4 remain active.

## 5 October F4.7 mobile continuation — dashboard notification access

The merchant dashboard notification bell now exposes a named, focusable button
with a 48px minimum target and uses a keyboard-capable ink action. Its screen
reader, keyboard and pointer activation share the existing Notifications route
callback, retaining the header's press animation.

Verification on 5 October 2026:

- Focused `dashboard notification control opens its route with Enter` synthetic
  widget journey — **1/1 passed**. It verifies the label, hint, enabled/button,
  focusable and tap semantics, target size, then activates the real named route
  with Enter and checks for framework exceptions.
- Targeted Flutter analysis of `premium_header.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
  Physical keyboard, TalkBack and independent screen-reader checks remain open
  (`adb` is unavailable); F4.7 and Phase 4 remain active.

## 5 October F4.7 mobile continuation — dashboard store selection

The dashboard store pill now exposes the active store as a named button and
opens the existing store picker by keyboard or pointer. Picker rows expose
store names and current/switch hints, report the selected store, and support
Enter activation through the existing `StoreContext.selectStore` path. Child
visual labels are excluded from the explicit semantic labels to avoid repeated
announcements.

Verification on 5 October 2026:

- Focused `dashboard store picker switches stores with Enter` synthetic
  two-store journey — **1/1 passed**. It checks the active-store label/hint and
  48px target, opens the sheet with Enter, verifies current versus unselected
  row state and the store-row target, selects the second store with Enter, and
  confirms both the `StoreContext` ID and header selection callback update.
- The focused notification-route Enter regression passes **1/1** after the
  shared header change. Targeted Flutter analysis of `premium_header.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
- These are synthetic local widget checks. Device keyboard, TalkBack and
  independent screen-reader verification remain open (`adb` is unavailable);
F4.7 and Phase 4 remain active.

## 5 October F4.7 mobile continuation — store-category keyboard journey

The mobile store-creation wizard's two-column store-category choices now
expose each translated category as a selected-state button and support keyboard
activation through the existing category-selection and step-transition path.

Verification on 5 October 2026:

- Focused `wizard category is selected by keyboard and saved` synthetic
  end-to-end wizard journey progresses through business type, channel skip and
  product type, activates Fashion with Enter, confirms selected semantics,
  follows the existing delayed transition and verifies the fake Gateway client
  received `category: fashion` at `/onboarding/mobile-progress` (**1/1 passed**).
- Targeted Flutter analysis of `create_store_wizard.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
  This is local fake-client evidence only. Device keyboard, TalkBack and
  independent screen-reader acceptance remain open (`adb` is unavailable);
  wizard theme controls and broader F4.7/Phase 4 requirements remain.

## 5 October F4.7 mobile continuation — wizard option keyboard access

Reusable store-wizard option cards now expose their translated title/subtitle
as one button label, preserve selection as an explicit selected state, and
accept pointer, Enter and Space activation through the existing callback. The
screen-reader selected state is provided by platform semantics rather than a
fixed-language hint.

Verification on 5 October 2026:

- Focused `wizard option cards expose selected state and keyboard input`
  synthetic journey verifies the named button, selected-state capability and
  minimum height, then presses Enter and Space and checks the callback-driven
  selected state changes in both directions (**1/1 passed**).
- Targeted Flutter analysis of `wizard_container.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
  The test uses no network, provider, or store-mutation call. Physical keyboard,
  TalkBack and independent screen-reader acceptance remain open because `adb`
  is unavailable; other wizard controls and broader F4.7/Phase 4 acceptance
  remain outstanding.

## 5 October F4.7 mobile continuation — wizard shell controls

The shared store-wizard shell now presents localized named buttons for Back,
Skip and the theme-mode action. Back, Skip and theme all support keyboard
activation through their existing callbacks; their minimum interactive height
is 48px. The theme-mode control announces the action that will happen next in
English, Tamil and Hindi, with the language service's existing English fallback
for languages without a translated entry.

Verification on 5 October 2026:

- Focused `wizard shell actions are named and keyboard accessible` synthetic
  journey checks semantics and targets, activates Back with Enter, Skip with
  Space, and theme with Enter, then confirms the theme action label changes
  with the resulting mode (**1/1 passed**).
- Targeted Flutter analysis of `wizard_container.dart`, `language_service.dart`
  and `mobile_services_test.dart` reports no issues. The test uses local state
  and mock preferences only. Physical keyboard, TalkBack, independent
  screen-reader checks, and the remaining wizard controls are outstanding;
  F4.7 and Phase 4 remain active.

## 5 October F4.7 mobile continuation — dashboard hero store actions

The hero store card's copy-URL row and Visit/Go Live buttons now expose named,
keyboard-capable button actions with 48px minimum targets. Copy URL responds to
Enter and Space and places the existing public storefront URL on the clipboard.
Share and QR controls now have names and accessible targets; the settings icon
is explicitly disabled when the card has no settings callback. Existing
callbacks and publish loading behavior are preserved.

Verification on 5 October 2026:

- The focused `dashboard period picker supports keyboard and reloads metrics`
  synthetic dashboard journey checks copy-URL, Visit, Go Live, Share, QR and
  unavailable Settings semantics and targets, then focuses Copy store URL,
  presses Enter, and verifies the clipboard payload and confirmation message;
  it also continues the payout-route and reporting-period journey (**1/1
  passed**).
- Targeted Flutter analysis of `hero_store_card.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
  No provider or live storefront action is invoked. This is local widget
  evidence only; physical keyboard, TalkBack and independent screen-reader
  verification remain open (`adb` is unavailable). F4.7 and Phase 4 remain
  active.

## 5 October F4.7 mobile continuation — dashboard payout-summary navigation

The dashboard payout summary now has a concise accessible announcement of the
next amount and status, a named 48px-minimum button, and keyboard activation to
the existing Money route. The change only opens the summary destination; it
does not initiate or alter any payout operation or eligibility decision.

Verification on 5 October 2026:

- The focused `dashboard period picker supports keyboard and reloads metrics`
  synthetic dashboard journey now also checks payout label/status, hint,
  button/tap semantics and target size; it focuses the card, presses Enter,
  confirms the Money route, returns to Home and continues the 7-day picker and
  expected `store_id=store_1`, `period=7d` analytics reload (**1/1 passed**).
- Targeted Flutter analysis of `home_screen.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
  This remains local synthetic widget evidence. Device keyboard, TalkBack and
  independent screen-reader verification remain open (`adb` is unavailable);
  F4.7 and Phase 4 remain active.

## 5 October F4.7 mobile continuation — dashboard account menu

The dashboard profile avatar now exposes a named Account button with a 48px
minimum target and opens its existing account sheet by Enter or pointer. The
shared account/store sheet action is now a named, keyboard-capable button, so
the Add account path continues from the sheet to the existing login route.

Verification on 5 October 2026:

- Focused `dashboard profile control opens account sheet with Enter` synthetic
  widget journey — **1/1 passed**. It checks the profile button semantics and
  target, opens the sheet with Enter, verifies the Add account button and
  target, then activates it with Enter and confirms the `/login` destination.
- Focused `dashboard store picker switches stores with Enter` regression passes
  **1/1** after the shared sheet-action update. Targeted Flutter analysis of
  `premium_header.dart` and `mobile_services_test.dart` reports no issues;
  `git diff --check` passes.
- These are synthetic local widget checks. Device keyboard, TalkBack and
  independent screen-reader verification remain open (`adb` is unavailable);
  F4.7 and Phase 4 remain active.

## 5 October F4.7 mobile continuation — wizard theme selection

The active step-7 theme cards now expose each theme name as an enabled button
with selected state. InkWell keeps pointer interaction and adds keyboard focus
and Enter/Space activation while retaining the current selection callback and
haptic response.

Verification on 5 October 2026:

- Focused `wizard theme is selected by keyboard after availability check`
  synthetic journey reaches step 7 through the normal onboarding-progress save
  and a mocked public-subdomain 404 availability response. It verifies the
  default Minimal Modern selection, the enabled/button/tap semantics and
  minimum target height, then presses Enter on Vibrant Bold and verifies the
  selected state changes. It also verifies that Create Store exposes its
  localized button label, enabled/tap semantics and 52px target without
  activating it (**1/1 passed**). The availability assertion uses the current
  language-service copy instead of a stale hard-coded string. No store creation
  call is made.
- The broader `--plain-name wizard` filter passes **10/10** wizard journeys.
  Targeted Flutter analysis of `create_store_wizard.dart`, `wizard_container.dart`,
  `language_service.dart` and `mobile_services_test.dart` reports no issues;
  `git diff --check` passes.
  This is synthetic local widget evidence only. Physical keyboard, TalkBack
  and independent screen-reader acceptance remain open (`adb` is unavailable);
  the remaining wizard controls and broader F4.7/Phase 4 outcomes remain.

## 5 October F4.7 mobile continuation — wizard name and subdomain back actions

The store-name and subdomain steps' bottom Back controls now expose localized
enabled button semantics and keyboard focus/activation. Their existing
previous-step callback is shared by semantics, pointer and keyboard input, and
the interactive area has a 48px minimum in both dimensions.

Verification on 5 October 2026:

- Focused `wizard store-name and subdomain back actions support Enter` journey
  reaches the store-name step through the regular wizard choices, advances to
  subdomain, then uses Enter on each bottom Back control to return first to
  store name and then category. It verifies names, enabled/button/tap
  semantics and target height for both controls (**1/1 passed**).
- Targeted Flutter analysis of `create_store_wizard.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
  This is synthetic local widget evidence only. Physical keyboard, TalkBack
  and independent screen-reader acceptance remain open (`adb` is unavailable);
  the remaining wizard controls and broader F4.7/Phase 4 outcomes remain.

## 5 October F4.7 mobile continuation — subdomain availability announcements

The subdomain step now exposes checking, available and taken status as live
regions so assistive technology receives asynchronous availability changes.
Available/taken copy uses the existing English, Tamil and Hindi translations;
the taken state also has a localized instruction to choose another name.

Verification on 5 October 2026:

- Focused `wizard subdomain status is localized and announced` synthetic
  journey reaches the real step through the earlier onboarding flow, observes
  the delayed checking state, then a mocked 404 available result and a
  successful lookup representing an occupied name. It verifies live-region
  semantics for all three states and available/taken copy in Tamil and Hindi
  (**1/1 passed**). No store is created.
- Targeted Flutter analysis of `create_store_wizard.dart`,
  `language_service.dart` and `mobile_services_test.dart` reports no issues;
  `git diff --check` passes. This remains synthetic local widget evidence;
  physical keyboard, TalkBack and independent screen-reader acceptance remain
  open (`adb` is unavailable), as do the remaining wizard controls and broader
  F4.7/Phase 4 outcomes.

## 5 October F4.7 mobile continuation — store-name validation announcements

Store-name minimum-length guidance and valid-length confirmation now use
English, Tamil and Hindi copy and expose the changing validation result as a
live region. The existing trimmed four-character rule and Next gating remain
unchanged.

Verification on 5 October 2026:

- Focused `wizard store-name validation is localized and announced` synthetic
  journey reaches step 5, enters a three-character value and checks the
  localized live error, then switches to Tamil and enters four characters to
  check the localized live confirmation. It switches to Hindi and activates
  Next with Enter, reaching the subdomain step (**1/1 passed**). No store is
  created.
- The prior `wizard subdomain status is localized and announced` regression
  also passes (**1/1**). Targeted Flutter analysis of
  `create_store_wizard.dart`, `language_service.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
  Physical-device keyboard, TalkBack and independent screen-reader verification
  remain open (`adb` is unavailable); broader F4.7/Phase 4 requirements remain.

## 5 October F4.7 mobile continuation — wizard exit confirmation actions

The step-1 exit confirmation's Cancel and Logout controls now expose localized
enabled button semantics and support keyboard focus/activation. Both controls
retain their existing result values and visual treatment with a 48px minimum
target.

Verification on 5 October 2026:

- Focused `wizard exit confirmation actions support keyboard` synthetic
  journey opens the confirmation by Enter on the wizard's existing top action,
  checks the Cancel and Logout names, enabled/button/tap semantics and target
  heights, then activates Cancel with Enter. The dialog closes, the wizard
  remains on step 1, and no API calls occur (**1/1 passed**). The Logout action
  is not activated.
- Targeted Flutter analysis of `create_store_wizard.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
  This remains local synthetic widget evidence; device keyboard, TalkBack and
  independent screen-reader acceptance remain open (`adb` is unavailable).
  F4.7 and Phase 4 remain active.

## 5 October F4.7 mobile continuation — subdomain validation failures

The mobile URL checker now distinguishes too-short, invalid-character,
occupied and availability-service failure states, with localized live-region
messages. Short and invalid values do not make an availability request;
service failures keep Next disabled. Lookup generations prevent a slow result
for an older value from overwriting newer input, and disposed wizard state is
not updated after an outstanding lookup.

Verification on 5 October 2026:

- `flutter test --no-pub test/mobile_services_test.dart --plain-name
  subdomain` passes **4/4** focused journeys: back navigation, checking/
  available/taken statuses, too-short and invalid input plus service failure,
  and a delayed stale result after the user edits the value. Tests verify the
  invalid cases make no request and the service failure leaves Next disabled.
- Targeted Flutter analysis of `create_store_wizard.dart`,
  `language_service.dart` and `mobile_services_test.dart` reports no issues;
  `git diff --check` passes. These are synthetic local widget/API-fixture
  results; provider, device/TalkBack and hosted acceptance remain open. No
  store is created; F4.7 and Phase 4 remain active.

## 5 October F4.7 mobile continuation — wizard language selector

The wizard's language menu now exposes the current language as its tooltip and
has a 48px minimum target. Its native expandable-menu semantics retain focus
and tap actions. A focused widget journey opens the menu by pressing Enter on
the header control, then uses Tab through the menu options and Enter to select
Tamil; the active language and visible selector/tooltip update. The existing
Back/Skip/theme keyboard regression continues to pass.

Verification on 5 October 2026:

- `wizard language selector changes language by keyboard` — **1/1 passed**;
  semantics confirm a focusable expandable control, tap action, current-language
  tooltip and 48px target. The test opens the menu with Enter, Tabs into and
  through the choices, and selects Tamil with Enter using mock preferences.
- `wizard shell actions are named and keyboard accessible` — **1/1 passed**.
- Targeted Flutter analysis of `wizard_container.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
  This is synthetic widget evidence; arrow-key traversal, physical-keyboard,
  TalkBack and independent screen-reader acceptance remain open. F4.7 and
  Phase 4 remain active.

## 5 October F4.7 mobile continuation — store publish retry

The final mobile-wizard action creates the store draft and then publishes it.
Previously, when creation succeeded but the publish call failed, retrying the
button created another store. The wizard now retains the returned draft and
retries publication against that same ID; the action label changes to the
localized “Retry publishing store” state. A synthetic widget journey drives the
full wizard, injects a first-attempt publish failure, retries, and verifies one
create request, two publish attempts, published-store adoption in
`StoreContext`, and navigation with the created store's ID/name/subdomain.

Verification on 5 October 2026:

- `wizard retries a failed publish without creating another store` — **1/1
  passed**; full focused `wizard` filter — **11/11 passed**.
- Targeted Flutter analysis of `create_store_wizard.dart`,
  `language_service.dart` and `mobile_services_test.dart` reports no issues;
  `git diff --check` passes.
- The first publish failure and successful retry use only a synthetic API
  client; this is not Gateway/Postgres, device or hosted acceptance. If the
  create request itself commits remotely but its response is lost, the mobile
  client still cannot know the created ID and needs a server-supported
  idempotency/recovery contract. F4.7 and Phase 4 remain active.

## 5 October F4.8 mobile store-create lost-response recovery

The mobile wizard now persists the idempotency key, canonical request snapshot
and fingerprint until the draft is published and adopted. On a fresh wizard
instance it validates the saved fingerprint, restores the final step and form,
and checks current subdomain availability before allowing retry. The local
snapshot is namespaced by the authenticated merchant ID, so another account on
the same device does not restore it. Repeating an unchanged request reuses its
key; changing the request rotates it. `StoreService` forwards the key through
the shared API client as `X-Idempotency-Key`. Gateway `POST /stores` stores an
owner-scoped key and SHA-256 canonical request hash on `sites`, returns the
original store for an exact retry, rejects a changed payload with `409`, and
recovers a concurrent unique-key race by reading the committed row. A replay
re-emits the stable `store.created` outbox event, which is protected by its
existing event idempotency key. Migration 306 adds nullable metadata and a
unique owner/key index; requests from clients that omit a key retain their
previous behavior.

Verification on 5 October 2026:

- The full synthetic mobile wizard test now models the first `POST /stores`
  committing while its response is lost, destroys and recreates the wizard,
  then verifies the saved final step is restored and a same-key retry recovers
  the draft. It follows this with a failed publish and a publish-only retry,
  verifying two create attempts with the same key, two publish attempts, one
  adopted store, cleared retry data after success and the completion-route
  arguments. A second widget test seeds one merchant's pending request and
  confirms a different merchant resumes at step 1 without reading the saved
  subdomain. The focused journey passes
  **1/1**; the full wizard filter passes **12/12**. The complete
  `mobile_services_test.dart` file passes **186/186**, including shared
  service and screen regressions.
- The owned Gateway/Postgres suite passes **2/2** through the real worker,
  PostgREST and disposable Postgres. It proves exact replay, changed-payload
  conflict, cross-owner key isolation, four concurrent duplicate requests,
  recovery after a committed insert response is replaced with a synthetic
  `503`, and exactly one `store.created` outbox row. Runner
  `61fe0dffcf99` reports zero failures and verifies cleanup of its owned
  database/container/network/volume.
- Gateway typecheck, migration-safety validation, targeted Flutter analysis
  and `git diff --check` pass. The Flutter package manager's default advisory
  refresh could not resolve `pub.dev` in this network-restricted environment;
  the verified test and analysis commands used `--no-pub` with the existing
  resolved dependencies. The migration was exercised only on the disposable
  owned fixture; no shared or hosted database was changed.
- Mobile widget and Gateway integration evidence is local. The restart test
  uses a synthetic signed-in merchant identity; process-kill/device validation,
  hosted rollout and device accessibility acceptance remain open. This closes the
  lost-create-response gap for the mobile keyed caller only; F4.8 and Phase 4
  remain active.

## 5 October F4.7 mobile continuation — authenticated wizard logout

The positive Logout action now has an end-to-end local widget journey. It
creates a synthetic Identity session through `StoreAuthService`, opens the
wizard's confirmation with the keyboard, activates Logout with Enter, verifies
the session cookie is sent to Identity's logout endpoint, confirms local auth
state is cleared, and checks that the wizard is replaced by the login route.
The existing Cancel journey remains in the same regression suite.

Verification on 5 October 2026:

- Focused authenticated logout test passes (**1/1**); the complete
  `mobile_services_test.dart` suite passes (**187/187**).
- Targeted Flutter analysis of the test, wizard and auth service reports no
  issues; `git diff --check` passes.
- Identity HTTP uses a synthetic `MockClient`; no real credentials, external
  Identity service, device, or hosted behavior is involved. Physical keyboard,
  TalkBack and independent screen-reader acceptance remain open (`adb` is
  unavailable). F4.7 and Phase 4 remain active.

## 7 October F4.7 wizard language selector — arrow-key navigation

The focused widget journey exposed that Flutter's `PopupMenuButton` selector
did not move among language choices with ArrowUp/ArrowDown. The selector now
uses Flutter's `MenuAnchor` and `MenuItemButton`, which support arrow-key and
Tab traversal while retaining the compact header styling. The currently
selected language receives initial menu focus. The anchor retains an explicit
focusable, expandable button semantic, current-language tooltip and 48px
minimum height.

Verification on 7 October 2026:

- The selector journey opens with Enter, selects Tamil with ArrowDown + Enter,
  reopens and returns to English with ArrowUp + Enter, then selects Tamil with
  Tab + Enter. Semantics checks cover a focusable expandable button, tap
  action, current-language tooltip and minimum target height. The focused test
  passes; the complete focused wizard filter passes **13/13**.
- Targeted Flutter analysis of `wizard_container.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
- This is synthetic local widget evidence. Physical-device keyboard behavior,
  TalkBack, and independent screen-reader acceptance remain open; F4.7 and
  Phase 4 remain active.

## 7 October F4.2 browser/database revalidation

The existing Identity onboarding → Gateway/Postgres draft → Merchant first-store
dashboard and plan-catalog Chromium journey was rerun after the owned runner's
Docker preflight became available through the approved local daemon access.
The runner-owned Postgres 16/PostgREST suite passes **1/1**, with no failures,
skips, cancellations or TODOs (`93efe4eed24b`). It rechecks account-bound draft
save/resume, keyboard-only creation, reserved-name denial, the five-card draft
dashboard, authenticated plan-catalog access and signed-out denial. The plan
catalog is opened without selecting a plan or initiating checkout. The runner
exited 0 after its run-id-scoped cleanup check; no restored or hosted database
was used. This renews the local F4.2 journey only; normal sign-in, email
delivery, screen-reader/WCAG acceptance and broader Phase 4 requirements remain
open. See the [sanitized run record](F4_ONBOARDING_REVALIDATION_2026-10-07.json).

## 7 October F4.7 orders bulk-select keyboard action

The orders bulk-selection summary now uses a keyboard-focusable `InkWell`
inside its existing accessible tap region. The outer action keeps the selected
count and “Select all visible orders” hint; the inner control is excluded from
duplicate semantics and has a stable widget-test key.

Verification on 7 October 2026:

- The synthetic order-card journey selects one order, checks the summary
  button's accessible label, hint and tap action, focuses its `InkWell`, and
  presses Enter to select the second visible order. The focused widget test
  passes (**1/1**).
- Targeted Flutter analysis of `orders_screen.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
- The first sandboxed Flutter test attempt was blocked because its local test
  harness could not bind an ephemeral localhost socket. The same focused test
  then passed using the existing temporary Flutter SDK overlay and local
  configuration after reviewed permission for loopback. No network service or
  real merchant data was used. Physical keyboard, TalkBack and independent
  screen-reader acceptance remain open; F4.7 and Phase 4 remain active.

## 7 October F4.7 settings store URL copy keyboard action

The settings store-info card's accessible “Copy store URL” action now uses a
keyboard-focusable `InkWell` inside its existing named tap region. The action
retains its clipboard behavior and single screen-reader announcement, with a
stable key for the widget journey.

Verification on 7 October 2026:

- The synthetic widget test verifies the URL-copy button's accessible label,
  hint, tap action and 48px target, then focuses the URL and presses Enter. A
  mocked platform clipboard receives the exact URL and the existing success
  message appears. The focused test passes (**1/1**).
- Targeted Flutter analysis of `store_info_card.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
- The local Flutter test harness requires an ephemeral localhost socket; the
  sandboxed attempt could not bind it, while the reviewed local rerun passed.
  No external service or real merchant data was used. Physical keyboard,
  TalkBack and independent screen-reader acceptance remain open; F4.7 and Phase
  4 remain active.

## 7 October F4.7 settings tile keyboard activation

Settings tiles now use a focusable `InkWell` for pointer and keyboard input,
while their enclosing accessible tap region remains the single announced
button. The same activation callback preserves selection haptics for both
paths.

Verification on 7 October 2026:

- The existing core custom-controls journey now focuses “Store profile” and
  presses Enter, then also taps it. Both paths invoke the action exactly once;
  the dashboard quick-action Enter path and accessible semantics checks remain
  covered in the same test. The focused widget test passes (**1/1**).
- Targeted Flutter analysis of `settings_tile.dart` and
  `mobile_services_test.dart` reports no issues; `git diff --check` passes.
- Verification is synthetic local widget evidence. Physical keyboard, TalkBack
  and independent screen-reader acceptance remain open; F4.7 and Phase 4 remain
  active.
