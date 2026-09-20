## 25. Gaps / Missing Primitives

### 25.1 Primitives that do not exist and should

| Gap | Evidence it is needed | Consequence today |
|---|---|---|
| **Error state on `Table`** | `TableDataProps` (`table.tsx:48-69`) has `loading`, `emptyState`, `emptyMessage` — no `error`, no `onRetry`. `AGENTS.md:290` UI-R3 mandates "skeleton loading, empty, **error-with-retry**". | Every app improvises differently: Banner+Retry (`reviews/page.tsx:394-401`), error folded into EmptyState (`orders/page.tsx:461-471`), Banner with **no retry** (`products/page.tsx:387-391`). |
| **`error`/`no-results`/`permission-denied` kinds on `EmptyState`** | `EmptyStateKind` (`feedback.tsx:338-352`) is 14 domain nouns. There is no way to say "this is empty because the fetch failed". | 90 of 98 sites render identically whether the resource is absent or the fetch died. `storefront-runtime/.../addresses-client.tsx:54` + `:152` renders "No saved addresses" on a load failure. |
| **`retry` on `EmptyState`, `action` on `ToastMessage`** | `ToastMessage` (`feedback.tsx:163-170`) has no action field. `Banner` does (`:125`). | None of the 154 critical toasts can offer Retry, which is the mechanical cause of ~93 sites firing a toast **and** a Banner with the identical string (e.g. `settings/shipping/page.tsx:178` + `:420`). |
| **`loading` + `error` on `ConfirmDialog`** | `ConfirmDialogProps` (`overlays.tsx:496-506`), 9 props, `onConfirm: () => void`. | Four confirmed double-submit sites (§27 P0-3). Every other site fakes progress in the label. Failures escape to a toast that is `inert` while the dialog is open. |
| **`loading` / `disabled` on `TableBulkAction`** | `table.tsx:25-29` = `{label, onAction, destructive?}`. `table.tsx:207-214` renders a plain always-enabled Button. | `orders/page.tsx:324-378` runs a sequential loop of N PATCHes against an enabled bar, discards every per-item error, and reports a **total** failure as an amber "partial" (`:363-369`). |
| **Row-level tone on `Table`** | No `rowClassName`/`rowVariant`/`getRowClassName` anywhere in `apps/` or `packages/`. `<tr>` is hardcoded hover-only (`table.tsx:359`). | Out-of-stock (`products/inventory/page.tsx:254-256`) and failed payouts (`payouts/page.tsx:190-194`) are flagged only inside one cell. |
| **`aria-sort` and `aria-busy` on `Table`** | Zero occurrences of either in `packages/typescript/ui/src`. `SortIcon` returns `null` when inactive (`table.tsx:84-89`). | A sortable column has no visible affordance and no announced sort state until after the first click; loading and empty are both silent. |
| **A neutral `default` tone that is actually neutral** | `feedback.tsx:33-35` maps `default` to `--lb-component-badge-accent-*`, i.e. **brand accent**, not grey. | "Refunded", "past_due", "draft" render as brand-violet pills. There is no `--lb-color-neutral` and no `--lb-color-text-disabled` (verified used=2, defined=0). |
| **A `pending`/`in-progress` tone** | `StatusVariant` has 5 members; `statusToBadgeVariant:99` collapses `pending·review·processing·draft·paused·degraded·partial·awaiting·hold·retry` into one amber bucket. | A draft product, a degraded worker and an overdue invoice are the same colour. Amber simultaneously means transient (`domain-model.ts:40`), terminal (`gift-cards:100`), adversarial (`comments:68`) and healthy (`reservations:64`). |
| **A systemic `ProviderModeBadge` with a `mock` member** | UI-R6 (`AGENTS.md:293`) requires it "web + Flutter". `grep -rn ProviderModeBadge packages/` = 0. | Two app-local forks, neither supporting `mock`, both rendering nothing on an unknown value. The shopper checkout has no provider-mode signal at all. |
| **An error-with-retry surface for the storefront** | `StorefrontEmptyState` (`storefront-states.tsx:14-46`) accepts only `actionHref`/`actionLabel` and builds a `<Link>`. | Structurally incapable of retry. The storefront's only recovery is the whole-page `reset()` in `app/error.tsx:55`, which `product-service.ts:49`'s `return []` guarantees will never be reached. |
| **Offline / connection-lost communication** | `navigator.onLine` and `addEventListener('online'\|'offline')` appear **zero** times in `apps/` and in `packages/typescript/ui/src`. `Retry-After` and `X-RateLimit-*` are never read; the api-client captures only `X-Request-ID` (`api-client/src/index.ts:5557`). 429 is handled in identity-platform only. | Offline, rate-limited and server-error all collapse to one generic per-call-site string. |
| **A shared error-message translation layer** | 53 local extractor functions across `apps/`, **25 of them byte-identical** copies of the same `getErrorMessage(payload, fallback)`. Nothing shared exists to import — `packages/typescript/ui` exports no error utility and no React error boundary. | Every clone extracts `error.message` and **discards `error.code` and the HTTP status**, which is why status-specific handling is statistically absent (merchant-control-plane: one reference to 401 across all `.tsx`, zero to 403 or 429). |
| **Unsaved-changes navigation guard** | `grep -i beforeunload apps/ packages/ services/` returns **nothing**. No router blocker, no `usePrompt`. | 21 SaveBar mounts announce "Unsaved changes" and 6+ sites compute `hasUnsavedChanges`/`isDirty`, but it is wired only to the SaveBar's `state` prop. The theme editor (`editor/page.tsx:1531-1536`) loses an entire draft on any nav click, Back, or tab close. |

### 25.2 Tokens referenced but never emitted

Verified with `grep var(<token>) apps` vs `grep '<token>' packages/typescript/ui/src/tokens.ts`:

| Token | Used | Emitted | Effect |
|---|---|---|---|
| `--lb-color-text-critical` | 7 | 0 | The two **best-wired** field errors in merchant-control-plane (`ThemeLibraryWorkspace.tsx:506`, `:569` — correct `aria-describedby` + `aria-invalid` + `role="alert"`) render in inherited body colour. Also `theme-locale.module.css:133,167,204`, `ThemeUpdatePanel.tsx:627`, `settings/notifications/page.tsx:638`. |
| `--lb-radius-pill` | 9 | 0 | Canonical name is `--lb-radius-full`. |
| `--lb-color-feedback-critical-text` / `-success-text` | 3 / 2 | 0 / 0 | `products/inventory-history/page.tsx:281,480-481,521-522` — stock increases and decreases render the **same** colour; the only distinguishing signal is gone. |
| `--lb-color-text-success` | 2 | 0 | `ThemeUpdatePanel.tsx:391,641`. |
| `--lb-color-text-disabled` | 2 | 0 | Disabled placeholder indistinguishable from live text. |
| `--lb-color-text-link` | 2 | 0 | Links render at body colour with only an underline. |
| `--lb-color-surface-selected` | 1 | 0 | Selected template has no background. |
| `--lb-color-text-caution` | 1 | 0 | Caution and info are visually identical. |
| `--lb-component-banner-critical-bg` | 1 | 0 | **[FROZEN]** `theme-marketplace/checkout/page.tsx:407` — failed theme purchase renders unstyled. Canonical family is `-danger-`. |
| `--lb-color-danger` | 6 | deleted at emit | Listed in `deprecatedTokenAliasVariables` (`tokens.ts:14`) and `delete`d at `tokens.ts:1121-1123`. `merchant globals.css:11416-11418` uses it inside `color-mix(...)` with **no fallback**, so the whole declaration is invalid: the merchant plan-checkout error renders with no red border and no tint. |
| `--lb-color-border-subtle` | 63 | deleted at emit | Also wired into `config/tailwind/letbuyy-tokens.css:55` as `--color-line-subtle`, so every `border-line-subtle` utility resolves to an invalid value. |

### 25.3 Governance gap — why none of this is visible to CI

`scripts/validators/validate-design-system.mjs:39` walks `apps/` only; `:44-48` exempts `packages/typescript/ui` and `config/tailwind` as the token layer; `:50` exiles `apps/marketing-site` entirely. Its eleven baseline metrics (`design-system-baseline.json`) are `appCssRawHex`, `appCssNakedRgbHsl`, `tailwindPaletteClasses`, `appLocalLbTokenRedefs`, `rawPxFontSize`, `rawPxSpacing`, `tsxInlineStyles`, `tsxRawHex`, `tsxArbitraryRadius`, `tsxArbitraryShadow`, `localWorkspaceImplementations` — **every one is a lexical colour/px/radius/shadow counter.**

Three consequences:

1. **Structural duplication scores zero.** 39 forked status mappers, 41 copy-pasted metric tiles and the `.marketplace-banner` CSS system are all token-clean.
2. **The design system itself is invisible.** The `SaveBar` focus trap, the `ConfirmDialog` missing-`loading` API, the two competing token families and the `Table` chip-on-a-`<span>` all live inside the exempt package.
3. **State completeness and accessibility are unmeasured.** No metric touches `aria-invalid`, `aria-describedby`, label association, focus management, or whether a screen has an error state — so UI-R3 and UI-R4 can be fully breached with the 107-validator gate green. It currently is green, with 9 of 10 ratchet metrics *below* baseline.

Note also that `tailwindPaletteClasses: 535` **baselines** the checkout's `text-red-500`, which is in direct tension with UI-R7 (`AGENTS.md:294`): "The drift ratchet MUST BLOCK new drift … not baseline it."

---

## 26. Recommended Future Architecture

These are recommendations for discussion, not agreed work.

### 26.1 One tone vocabulary, one token family

There are currently **six** tone unions reachable from the public API — `StatusVariant` (`feedback.tsx:29`), `InternalTone` (`internal-workspace.tsx:4`), `BoxProps.tone` (`layout.tsx:79`), `TextProps.tone` (`layout.tsx:319`), `TextProps.variant` positive/negative (`layout.tsx:318`), `MetricCardProps.deltaTone` (`productivity.tsx:23`) — plus two app-local ones.

The target would be a single `StatusVariant` extended with the two states the product demonstrably needs and cannot express (`neutral` and `pending`), and **one** token family per tone. The obvious survivor is `--lb-component-banner-*`, because it is the family that passes AA in both themes; `--lb-color-{tone}` would be retained as the *raw hue* for borders and dots only, never as foreground text. That single change resolves the two-greens-in-one-flex-row defect (§21.4), the `InternalStatusPill` AA failures, and the `MetricCard` delta contrast — without touching a single call site.

Rename `danger` → `critical` in the component token names so the variant name and the token name agree, which would also make `theme-marketplace/checkout/page.tsx:407` **[FROZEN]** correct by accident rather than broken.

### 26.2 Status derivation as a per-domain contract, not a shared string matcher

`statusToBadgeVariant`'s substring approach is the wrong shape for this product: it cannot distinguish `active` from `inactive`, and it has to guess for every domain simultaneously. The 39 local forks exist because each domain genuinely has its own vocabulary.

The pattern that already works in this repo is `apps/merchant-control-plane/src/lib/domains/domain-model.ts:18-42` — the **only** domain with a total `Record<Status, Label>` + `Record<Status, Variant>` in a shared module, with product-voice labels ("Needs DNS setup", "Connected", "Action required") rather than mechanical string mangling. Its header comment states the rule the rest of the repo ignores: *"The UI MUST consume these helpers and never re-derive status/score independently."*

A generic helper factory taking an exhaustive `Record<TStatus, {label, variant}>` would give each domain one authoritative map, make missing enum members a **compile error**, and eliminate raw-enum leakage (`purchase-orders/page.tsx:558` `Cannot receive a ${po.status} order`) and the five competing humanisation styles.

The DB side needs to participate: there are **zero** `CREATE TYPE ... AS ENUM` statements in the repo (every status is `text` + CHECK), and no validator compares a CHECK to a Zod enum. That absence is the structural reason ~20 DB↔TS divergences accumulated undetected.

### 26.3 Complete the state matrix in the primitives, not in each app

- `EmptyState` gains `kind: 'error' | 'no-results' | 'permission-denied' | 'offline'` and `onRetry`. The reference implementation already exists at `customers/page.tsx:314-343` — a three-way error/filtered/first-run branch in about eight lines.
- `Table` gains `error` + `onRetry` and delegates to `EmptyState`, so the "silent 5xx renders as first-run" class disappears at the primitive.
- `ConfirmDialog` gains `loading` (awaits `onConfirm`, disables both buttons, blocks `onClose`) and an `error` slot with `role="alert"` **inside** the dialog — which also removes the dependency on a toast that is `inert` while the dialog is open.
- `ToastMessage` gains an `action` slot, which collapses the ~93 duplicate toast+Banner pairs into one surface.
- `Banner` gains `onDismiss`. 133 undismissable banners including permanent educational ones is not a defensible default.
- `TableBulkAction` gains `loading`/`disabled` and a progress contract.

### 26.4 Portal the toast layer and fix the live region

Two changes fix both P0 toast defects: render the placement container **unconditionally** (so the `aria-live` region pre-exists its first message), and portal it to `document.body` via the existing `OverlayPortal` (`overlays.tsx:21-61`) so `setOutsideTreeInert` (`overlay-hooks.ts:58-66`) cannot mark it `inert` while a dialog is open. Both are contained inside `feedback.tsx`.

### 26.5 One error-translation layer

A single `@letbuyy/ui` (or `@letbuyy/api-client`) helper that maps `LetbuyyApiError` → `{title, description, retryable, fieldErrors}` would replace 53 duplicated extractors, preserve `error.code`/status (which all 25 byte-identical clones currently discard), read `Retry-After`, surface `requestId` for support, and map `services/api-gateway/src/middleware/validation.ts:60-76`'s per-field `details[]` back onto controls — a capability the gateway already ships and **exactly one** app file reads (`identity-platform/src/app/api/auth/create-store/route.ts:110`, where it is logged and forwarded as an opaque blob).

### 26.6 Make the storefront themeable for feedback

`apps/storefront-runtime/src/app/globals.css:391-408` is the model: `.storefront-empty-state` re-points the canonical `--lb-component-empty-state-*` tokens at the merchant theme namespace. The gap is that **no equivalent bridge exists for any other feedback token** — `grep -- '--lb-component-banner\|--lb-color-critical\|--lb-color-success' apps/storefront-runtime/src/app/globals.css` returns nothing, and the 24 variables the merchant theme injects at `store/[subdomain]/layout.tsx:178-212` contain no `--success`, `--error` or `--warning`. Extending that bridge would let the storefront adopt `Banner`, `Badge` and `InlineError` without losing merchant theming, and would delete 92 raw palette occurrences.

### 26.7 Extend the ratchet to component adoption

The gate cannot see any finding in this report. Candidate new metrics, all mechanically checkable and all currently zero-cost:

| Metric | Fails on |
|---|---|
| `localStatusMappers` | a new `function *StatusVariant\|statusTone\|toneFor*` in `apps/` |
| `feedbackCssSelectors` | a new `.*-banner`/`.*-toast`/`.*-badge`/`.*-error` rule in an app stylesheet |
| `handRolledAlertRegions` | a new app-level `role="alert"` div where `Banner`/`InlineError` exists |
| `danglingLbTokens` | any `var(--lb-*)` not in the emitted set (would catch all 11 tokens in §25.2) |
| `formFieldsWithoutAriaInvalid` | a `<form>` with error state and no `aria-invalid` |
| `screensWithoutErrorState` | a data-fetching route with `loading`+`empty` but no error branch |

Two scope changes matter as much as the metrics: the ratchet should **not** exempt `packages/typescript/ui` for structural (non-token) checks, and `apps/marketing-site` should not be exiled — it holds the largest parallel feedback system *and* the single best form implementation in the repo, and neither is measured.

---

## 27. Migration Strategy

Classification: **P0** = accessibility failure, actively misleading state, or severe UX. **P1** = systemic inconsistency with real user cost. **P2** = drift with moderate cost. **P3** = hygiene.

Every item below describes *what would have to be true* for the change to be safe. Nothing here is agreed work.

### P0 — accessibility / misleading / severe

| # | Item | Evidence | Safe-migration notes |
|---|---|---|---|
| P0-1 | **Storefront catalogue renders "No products found" during a gateway outage, and ISR-caches it** | `product-service.ts:35-37,47-49,60-62,78-80` all `catch { console.error(...); return [] }` → `data-binding-engine.ts:91-93` → `product-grid.tsx:195-200`. `revalidate = 60` at `store/[subdomain]/page.tsx:10` **and** `layout.tsx:20`. Sibling `content-service.ts:103-105,113-115` does it correctly: `if (isNotFoundError(error)) return []; throw error;` | The correct behaviour already exists 30 lines away. Adopting `isNotFoundError` in `product-service` makes the failure reach `app/error.tsx`, which already renders correct copy + `reset()`. The risk is ISR: a throw during revalidation must not evict a good cached page — verify Next's stale-while-revalidate behaviour before changing the catch. Same class: `review-service.ts:28-31`, `store-service.ts:112-116`. |
| P0-2 | **Four defects in one 130-line shopper file** | `storefront-runtime/.../account/addresses/addresses-client.tsx`: `:49-59` silent catch → outage renders "No saved addresses"; `:87-107` `if (res.ok)` with **no else and no catch**; `:110-121` `handleDelete` never checks `res.ok` so `:118` removes the row even on a 500 (and a network throw is an unhandled rejection); `:124-131` `setDefault` has no error path at all. `<ConfirmDialog` in storefront = 0, so the delete is unconfirmed too. | Self-contained file. Needs an error state on the list (blocked on P0-8 unless hand-rolled) and `res.ok` checks on all three mutations. |
| P0-3 | **`ConfirmDialog` cannot be guarded; four live double-submit sites** | Primitive: `overlays.tsx:496-506` (no `loading`), `:530` (confirm button has no `disabled`). Sites: `orders/page.tsx:667-679` (static `confirmLabel`, `onClose` unguarded at `:673`, handler `:254-305` never checks `updatingId`, key regenerated per call at `:267`); `online-store/pages/page.tsx:295-322` (`setPageToArchive(null)` at `:310`, **after** the await at `:304`); `DomainDetailView.tsx:111-122` (no guard, `setConfirmDelete(false)` only in the catch at `:121`); `AppsSettingsClient.tsx:111-134` (never checks `isPending`; `startTransition` does not de-duplicate). | **The asymmetry is the story**: `DomainDetailView.tsx:336`, `AppsSettingsClient.tsx:267`, `coupons/page.tsx:595` all guard `onClose` and leave `onConfirm` open. The authors knew about the in-flight state and had no API to defend the confirm path. Fixing the primitive (`loading` + awaited `onConfirm`) fixes all four at once and is backwards-compatible. Verify against `foundation.test.tsx:337-346` (inert/focus-trap assertions) and the public-API snapshot. **Not affected**: `ConflictDialog.tsx` — its consumer closes synchronously first (`editor/page.tsx:1567-1581`). |
| P0-4 | **Toast live region created with its first message** | `feedback.tsx:218` `activePlacements` is `[]` when `toasts` is empty, so `:223-232` renders no container at rest. All 77 `useToast()` sites depend on this one region. | Render the container unconditionally. Contained in `feedback.tsx`; the only visible risk is a stray fixed-position empty div, mitigated by `pointer-events-none` when empty. |
| P0-5 | **Toasts are `aria-hidden` + `inert` whenever any dialog is open** | `feedback.tsx` has zero `createPortal` (in-tree render at `:220-274`) → `overlays.tsx:43` portals dialogs to `body` → `overlay-hooks.ts:58-66` + `:45-46` marks every other body child `inert` + `aria-hidden` → `AdminShell.tsx:187` mounts `ToastProvider` inside the app root. 37 merchant files combine `useToast` with a dialog, including `products/gift-cards/page.tsx` (`<Drawer>` at `:538`, `notify` at `:263,271,300`). | Portal the toast container via the existing `OverlayPortal`. Note `--lb-z-toast` (70) > `--lb-z-modal` (60) already, so stacking is correct; only the DOM position is wrong. |
| P0-6 | **Star ratings expose no accessible value; interactive stars have empty accessible names** | `storefront-runtime/src/components/product/product-reviews.tsx:43-56` — five `<Button unstyled>` each wrapping a childless `<Star>`; lucide-react auto-applies `aria-hidden="true"` to childless icons, so every button's accessible name is empty (WCAG 4.1.2). Duplicated in the **active merchant app** at `testimonials/page.tsx:100-116`, where `testimonial.rating` is in scope and simply never surfaced (rendered `:412` inside a text-free div). | Contrast makes it worse for sighted users: active `#FFB900` = 1.72:1 on white, inactive `#E5E7EB` = 1.24:1, and active-vs-inactive is **1.39:1**. A `role="radiogroup"` + `aria-label` (interactive) / `role="img"` + `aria-label="4 out of 5"` (read-only) is the minimal fix. |
| P0-7 | **`SaveBar` saved state = invisible focus trap + stale live region** | `feedback.tsx:569` `opacity-0 pointer-events-none` (neither removes from tab order), buttons `disabled={state === 'saving'}` (`:585`, `:594`) i.e. enabled when saved, `:577` has no `'saved'` branch inside the `aria-live` region at `:572`. Callers mount it unconditionally (`products/inventory/page.tsx:373-378`, `products/gift-cards/page.tsx:596-601`). 21 surfaces including money surfaces. | Contained in the primitive. WCAG 2.4.11 + 4.1.3. |
| P0-8 | **`Table` has no error state** (blocks P0-1, P0-2 and every list surface) | `table.tsx:48-69`. UI-R3 (`AGENTS.md:290`) mandates error-with-retry on every screen. | Additive props; no existing call site changes behaviour. Should land with the `EmptyState` `kind` extension so `Table` can delegate. |
| P0-9 | **Merchant subscribe checkout spins forever on modal dismiss** | `access_account/checkout/checkout/CheckoutClient.tsx:257-359` — `setIsProcessing(true)` at `:258`, resets exist for throw/verify-failure/`payment.failed`, but the Razorpay options at `:297-346` have **no `modal.ondismiss`**; `razorpay.open()` (`:354`) returns immediately, leaving `<Button loading={isProcessing}>` (`:676`) spinning until a full reload. | The storefront does it correctly at `checkout-client.tsx:533-536` with the type declared at `:51-52`. Copy that. |
| P0-10 | **Store picker renders every store red, including healthy published stores** | `AllStoresClient.tsx:165` tests `store.status === 'active'`; `sites_status_check` (`000_baseline.sql:12026`) is `draft\|published\|unpublished\|frozen\|suspended`. `.active` CSS (`globals.css:1946-1949`) is unreachable; the "Active" tab (`:70`) is always empty. | Requires a decision on what "active" means for a site before any code moves. Migrating this to `Badge` + a domain map (§26.2) fixes the colour and the tab filter together. |
| P0-11 | **platform-console has zero a11y attributes across 35 error panels** | `role="alert"` = 0, `aria-live` = 0, `aria-invalid` = 0, `aria-describedby` = 0, `aria-busy` = 0 across the whole app. `ConsoleApiErrorPanel` (`ConsoleDataTable.tsx:144-151`) is a plain `<section>`. `(auth)/login/page.tsx:51` and `(auth)/mfa/page.tsx:40` render sign-in errors with no role — while the equivalent in identity-platform (`login/page.tsx:245`) has `role="alert" aria-live="assertive"`. | Adopting `Banner` at those 35 sites gets `role` for free (`feedback.tsx:139`) and removes the warning-vs-critical tone mismatch on backend failures. |
| P0-12 | **Storefront checkout: 8 field errors with no programmatic association, all set in one `setState`, no focus move** | `checkout-client.tsx:731,746,762,777,790,801,815,1120` are `<p className="text-red-500 text-xs mt-1">`; `validateForm` (`:313-325`) sets all seven at once; `htmlFor` = 0, `aria-invalid` = 0, `aria-describedby` = 0, `aria-live` = 0 across 1160 lines. Seven labels (`:720,734,751,766,782,793,804`) are unassociated siblings, so the fields' only accessible name is the placeholder. | `ContactForm.tsx:304-323` (`focusFirstError`, resolving `FIELD_ORDER` against `FIELD_CONTROL_IDS`) is the reference implementation — and it lives in the one app the ratchet exiles. |
| P0-13 | **Payout release: zero in-flight feedback on a money path** | `payouts/page.tsx:90-122` closes the step-up dialog at `:92` **then** fires `POST .../settle` at `:95-106`; the Release button (`:204-214`) has no `disabled`/`loading`; `releasingId` (`:60`) is never used. | Not a duplicate-settlement risk — `services/api-gateway/src/routes/payouts.ts:571` short-circuits on `status === 'released'` and `:572-574` rejects non-settleable states, and re-entry needs a fresh TOTP. It is purely missing feedback on the platform's highest-stakes action. |

### P1 — systemic inconsistency with real user cost

| # | Item | Evidence | Notes |
|---|---|---|---|
| P1-1 | **`InternalStatusPill` uses the raw 500-ramp as foreground** | `internal-workspace.tsx:165-168` vs `feedback.tsx:44-61`. Dark (shipped default): critical 3.94, info 3.77 — both fail. Light: all four fail; success 2.07 and warning 1.93 fail even the 3:1 non-text floor. 62 pills. | One-line-per-tone change to the `statusText` ramp. Both consumers are delegation shims, so blast radius is contained. |
| P1-2 | **`--lb-color-critical` fails AA for form errors in light** | `input.tsx:89` (Input), `:156` (Textarea), `:169` (InlineError). `#EF4444` on `#FFFFFF` = 3.76:1; on page bg `#F6F7F9` = 3.51:1. Dark passes (4.87 / 5.26). | The correct value already ships: `statusText.danger` = red[700] `#B91C1C` (`tokens.ts:292`), used by Badge at 5.30:1. |
| P1-3 | **`InlineError` is unadopted because the built-in path is silent** | `input.tsx:89` renders `<p id={errorId}>` with **no role and no icon**; `InlineError` (`:166-177`) has `role="alert"` but no `id`, so it cannot be an `aria-describedby` target. Apps passing `error=` get the weaker variant by construction. Only ~17 of 552 `<Input` sites pass `error` at all. | Merging the two — give the built-in paragraph `role="alert"`, or give `InlineError` an `id` — closes the gap without touching call sites. `Select`/`Combobox`/`Checkbox`/`Radio`/`ChoiceList` hand-roll five more copies (`controls.tsx:264,341,575,697,914`). |
| P1-4 | **`aria-invalid`/`aria-describedby` effectively absent** | 22 + 17 in merchant, 8 + 10 in marketing (all in one file), 1 + 1 in identity, **0 + 0** in storefront, platform-console and all frozen apps — against 663 form controls. `settings/shipping/page.tsx:575` renders a detached red `<p>` with no id and no back-reference. | Gated on P1-3. The primitive already wires everything correctly (`input.tsx:33-37`) when `error=` is passed. |
| P1-5 | **`Skeleton` loading is silent in ~93% of surfaces** | `aria-hidden="true"` on all three variants with no `aria-busy` in the package; only 13 `aria-busy` occurrences in merchant against 101 skeletons, 2 in storefront, 0 in platform-console. The correct pattern exists only in a **[FROZEN]** app (`app-marketplace/src/components/MarketplaceSkeleton.tsx:19`). | Adding `aria-busy` to `Table`'s loading branch covers the bulk mechanically. |
| P1-6 | **`animate-spin` ignores `prefers-reduced-motion`** | `button.tsx:78`, `feedback.tsx:576`, `primitives.tsx:637`. `tokens.ts:1606-1617` zeroes every `--lb-motion-*` and kills `[data-lb-empty-float]` but never touches `.animate-spin`; no app stylesheet overrides it. | Three-line fix (`motion-safe:animate-spin` or a keyframe override). Button is the highest-traffic component in the system. |
| P1-7 | **39 forked status mappers; five proven live conflicts** | §21.6. Plus `internal-workspace.tsx:156-163` inside the package itself. | Migrate domain by domain onto exhaustive maps (§26.2), starting with Pages (conflict #1) and platform-console subscriptions (conflict #2), which are the two a single user can hit in one session. |
| P1-8 | **11 dangling `--lb-*` tokens, several load-bearing** | §25.2. `--lb-color-text-critical` (7 uses, 0 emitted) makes the best-wired errors invisible; `--lb-color-feedback-*` makes stock increases and decreases identical; `--lb-color-danger` inside `color-mix` with no fallback invalidates the whole declaration. | Purely mechanical, and a `danglingLbTokens` ratchet metric would prevent recurrence. |
| P1-9 | **`SaveBar` overflows its column at every width 640–1172px on 19 pages** | `feedback.tsx:568` `sm:w-[min(920px,calc(100vw-24px))]` on a *sticky* element. Below `lg` the `Page` box is `W-32` vs a bar of `W-24` — an 8px overflow at every tablet width; at 1024px with the 220px rail static it is 772px vs 920px. `AppFrame`'s `<main className="min-w-0 flex-1 overflow-auto">` (`app-shell.tsx:415`) is both-axes. `globals.css:2850-2858` diagnoses this exact failure and fixes it — for `.settings-content > main` only (`:2859`). | The fix already exists and is scoped too narrowly. |
| P1-10 | **No safe-area insets in the only app with a `SaveBar`** | `env(safe-area-inset-*)` occurs 7 times repo-wide, zero in merchant-control-plane. Shell is `h-[100dvh]` (`app-shell.tsx:400`); at `bottom-0` with 12px padding, the 32px buttons sit 12–44px above the floor, so an iPhone home indicator (~34px) covers about two thirds of Save and Discard. | |
| P1-11 | **44 app sites render status meaning as raw 500-ramp text on plain surfaces** | `#22C55E` on white = 2.28, `#F59E0B` = 2.15, `#EF4444` = 3.76, `#3B82F6` = 3.68. Money-path examples: `platform-console/money-reconciliation/page.tsx:159` (variance) and `:189` (ledger payable). | Resolved as a class by §26.1 (raw hue never used as foreground text). |
| P1-12 | **Bulk actions: no guard, no loading, per-item errors destroyed, wrong tone on total failure** | `table.tsx:25-29` + `:207-214`; `orders/page.tsx:324-378` sequential loop, `:353-356` discards message and code, `:363-369` reports `variant: 'warning'` even when `failures === all`. | |

### P2 — drift with moderate cost

| # | Item | Evidence |
|---|---|---|
| P2-1 | `ConsoleDataTable.StatusBadge` fork — 14 sites, raw palette, dark-only, no icon, `failed` → grey | `ConsoleDataTable.tsx:89-110` |
| P2-2 | `Banner` has no dismiss and no responsive action stacking; several are permanent | `feedback.tsx:121-126`, `:155`; `settings/domains:177`, `settings/payments:455`, `settings/billing:281` |
| P2-3 | Toast auto-dismisses in 5s with no pause on hover/focus; dismiss button is last in DOM order | `feedback.tsx:200`, `:210-214`, `:260-268`. WCAG 2.2.1 |
| P2-4 | ~93 sites fire a critical toast **and** a Banner with the identical string | `settings/shipping/page.tsx:178` + `:420`; `orders/page.tsx:293-300`; `products/new/page.tsx:573-580` (three different headings for one empty input) |
| P2-5 | Table filter chips are non-focusable `<span>`s with `onClick` and no visible "×" | `table.tsx:196` + `feedback.tsx:73-86`. The accessible implementation (`primitives.tsx:412-419`) sits unused |
| P2-6 | `MetricCard` delta is colour-only | `productivity.tsx:58-69`; `ai/page.tsx:255-256` |
| P2-7 | 41 copy-pasted metric tiles in merchant-control-plane vs 23 `MetricCard` uses | `posts/page.tsx:414,427,440,453` is the template, repeated verbatim in comments/pages/gallery/reviews/contact/leads |
| P2-8 | Badge `default` and `info` share the same `Info` glyph | `feedback.tsx:36` vs `:42` |
| P2-9 | Five humanisation styles for one enum (`Partially Refunded` / `Partially_refunded` / `partially refunded` / `PARTIALLY_REFUNDED` / raw), plus four different null fallbacks among five otherwise-identical `titleize()` copies | `orders:96-103`, `payouts:50-52`, `internal-workspace:173`, `ConsoleDataTable:108`, `developer-docs:69` |
| P2-10 | Three ellipsis conventions for one busy state (`...` / `…` / none) — three sibling theme-editor upload controls disagree | `ImagePickerControl.tsx:177` vs `VideoControl.tsx:138` vs `MediaLibrary.tsx:514` |
| P2-11 | Six dismiss/commit controls are 28–32px (pass SC 2.5.8's 24px, fail the 44pt platform floor); merchant runs `density='compact'`, the smallest scale | `feedback.tsx:263`, `overlays.tsx:471`, `overlays.tsx:187`, `feedback.tsx:583,592`, `table.tsx:196`, `products/page.tsx:292-306` |
| P2-12 | Product status editable on desktop, **read-only** on mobile | `products/page.tsx:299-311` (invisible `<select>`) vs `:314-317` (`cardRender` drops it) |
| P2-13 | Merchant admin cannot reach dark mode; ~55 lines of dark token overrides are unreachable | `layout.tsx:41,43,46` pin light on all three axes; `globals.css:305-360`. UI-R3 requires dark "reachable, not just wired" |
| P2-14 | Merchant `globals.css:283-294` light-canvas block loses on specificity — (0,1,1) vs the injected (0,2,0) — for 10 of 12 declarations, so the console runs a half-applied palette | `globals.css:277-278` selector vs `tokens.ts:1254-1357` |
| P2-15 | Engineering jargon shipped to merchants on a nav-reachable route | `settings/custom-data/page.tsx:15` + `BackendNeededPane.tsx:34,43,67,72,77` — `[SKIP - NEEDS BACKEND]`, "WS9 is limited to frontend settings architecture", raw route specs with `site_id`. `LETBUYY_UI_UX_GOVERNANCE.md:171` already rules "no placeholder/`SKIP` screen user-reachable" for the mobile equivalent |
| P2-16 | Turnstile failure is silent and deadlocks login | `TurnstileWidget.tsx:85-87` clears the token with no UI; `login/page.tsx:363` passes no `onExpire`; `:337` then disables submit permanently, so the one message that exists (`:158`) can never fire |
| P2-17 | Three active apps ship zero error boundaries | identity-platform, platform-console, marketing-site (verified by `find`) |

### P3 — hygiene

| # | Item | Evidence |
|---|---|---|
| P3-1 | `warnDeprecated` is dead code, not in `index.ts`, not in the snapshot | `deprecations.ts:11` |
| P3-2 | `DropdownMenu`, `Popover`, `Tooltip`, `EmptyStateIllustration`, `TableFilterChip` have zero app consumers | `governance.stories.tsx:29` explicitly forbids removing deprecated exports "until cross-app migrations have landed"; each removal moves `snapshots/public-api.json` |
| P3-3 | 8 dead components inflate apparent canonical adoption | `StoreDirectoryIndexTable`, `SubscriptionManagementIndexTable`, `TrustSafetyIndexTable`, `TicketIndexTable` **[FROZEN]**, `MerchantHealthIndexTable` **[FROZEN]**, `CrmContactIndexTable` **[FROZEN]**, `AppBlockSlotPanel`, `AICustomizationPanel` — all verified as self-reference only. (`OnboardingQueueIndexTable` and `CommunicationTemplateIndexTable` **are** live — do not list them as dead.) |
| P3-4 | `.admin-skeleton` (`globals.css:6001-6006`) + its `@keyframes shimmer` have zero consumers | Superseded by `<Skeleton>`, now used 101× in the same app |
| P3-5 | Modal content region lacks Drawer's `min-h-0 flex-1` | `overlays.tsx:485` vs `:192` — short ConfirmDialogs bunch at the top of the mobile sheet |
| P3-6 | Badge/Toast icons lack `shrink-0`; Banner's and InlineError's have it | `feedback.tsx:83`, `:247` vs `:142`, `input.tsx:173` |
| P3-7 | `column.truncate` is desktop-only — `renderCardCell` ignores it | `table.tsx:375,383-384` vs `:167-168` |
| P3-8 | `--lb-density-empty-state-scale` emitted, zero consumers; 145 of 403 emitted variables have zero consumers, including all 8 `--lb-semantic-status-{text,soft}-*` and 77 of 82 `--lb-primitive-*` | `tokens.ts:885`, `:1118-1120` |
| P3-9 | British/American spelling split inside one app: `fulfilment` ×5 vs `fulfillment`; `cancelled` toast vs `canceled` enum branch on one page | `settings/checkout:356`, `settings/shipping:474` vs `orders:670`; `settings/plan/page.tsx:206` vs `:117` |
| P3-10 | 9 en-US date sites, all in merchant-control-plane, in an India-first product; two sibling settings pages disagree | `settings/billing/page.tsx:200,254,322`; `settings/security/page.tsx:190` (en-IN) vs `settings/users/page.tsx:390` (en-US) |
| P3-11 | Tenant object called shop / workspace / store / site / storefront across one funnel | `marketing Header.tsx:157`, `identity onboarding:51`, `settings/domains:147`, `comments:285`, `settings/domains:117` |
| P3-12 | `--lb-color-primary` re-declared at `:root` in platform-console and platform-operations-portal — the exact declaration `tokens.ts:1133-1135` forbids by name | `platform-console/globals.css:12-17`, `platform-operations-portal/globals.css:11-16` **[FROZEN]** |

### Sequencing note

Three primitive-level changes unlock the largest share of the list and touch no call site: `ConfirmDialog.loading` (P0-3), the toast portal + unconditional live region (P0-4, P0-5), and `EmptyState`/`Table` error kinds (P0-8). Doing those first turns roughly a dozen app-level items into no-ops. The token-family consolidation (§26.1) similarly resolves P1-1, P1-2, P1-11 and P2-6 in one place.

---

## 28. Open Questions

Everything below could not be settled from the repository. It is listed as **UNPROVEN**, not asserted.

1. **Screen-reader behaviour of the toast live region.** The structural facts are confirmed (`feedback.tsx:218,223` create the region with its content; `:230` polite container with `:245` `role="alert"` children; `overlay-hooks.ts:58-66` marks it `inert`). Whether NVDA/JAWS/VoiceOver announce, double-announce or drop these is **UNPROVEN** — no axe run and no AT test exists in the repo, and `grep role="alert" packages/typescript/ui/tests/` returns nothing toast-related.

2. **Whether Cloudflare's Turnstile iframe paints its own error state.** `TurnstileWidget.tsx:85-87` provably renders nothing app-side, and `login/page.tsx:337` provably deadlocks the button. Whether the third-party widget shows the user *something* is outside this repo. **UNPROVEN.**

3. **Liquid-authored feedback markup.** `find apps -name "*.liquid"` returns zero files — theme bundles are stored in the database. Any status/error markup authored in Liquid was **not auditable** and is entirely outside every count in this report.

4. **`COMPONENT_DUPLICATION_REPORT.md`.** Cited by `feedback.tsx:92` as the justification for `statusToBadgeVariant`. It does not exist at that path; only archived copies under `docs/archive/` and `docs/design-intelligence/`. The citation is dangling. **UNPROVEN** whether the current document ever existed.

5. **Whether the 8 dead `*IndexTable` / theme-editor panel components are unlaunched work or abandoned work.** They are verifiably imported by nothing, and they use the *canonical* primitives while the live routes beside them use forks — so the migration was written and never wired. Whether the intent is to wire or delete is a product decision, not a code fact.

6. **The intended meaning of `'active'` for a site.** `AllStoresClient.tsx:70,165` assumes it exists; `sites_status_check` says it does not. Whether the intended predicate is `status === 'published'`, or a separate `is_active`, or something else, cannot be inferred. This blocks P0-10.

7. **`merchant globals.css:133-135` density redeclarations.** `--lb-density-sidebar-row-height` and `--lb-density-sidebar-icon-size` are declared at `:root` (0,1,0), tie with the injected block, and lose on document order because the injected `<style>` is later. Whether that is intended or a silent no-op is **UNPROVEN**.

8. **Whether the `preserve: true` path in `lib/public-errors.ts:63-72` can leak `stack`/`hint`/`details`.** For the 33 `CLIENT_ACTIONABLE_ERROR_CODES` the `if (!preserve)` guard at `:176` is skipped, so debug fields would pass through. No route was found that attaches `stack` to such a payload, so exploitability is **UNPROVEN** — but the guard is code-shaped to allow it.

9. **Whether Next serves the stale ISR page or re-renders on a product-service throw** (P0-1). Inferred from `export const revalidate = 60`; not observed at runtime. This materially affects how safe the P0-1 migration is.

10. **The 64-declaration gap between the measured 275 `appLocalLbTokenRedefs` and the 339 baseline.** Consistent with the ratchet having been burned down, but not traced commit-by-commit. **UNPROVEN.**

11. **Whether the six `className="text-left"` overrides on identity-platform Banners are load-bearing.** No container-scoped `text-align: center` was located that would require them (the centred rules at `identity globals.css:281,304,312,319,333,341` are element-scoped). Either dead defensiveness or guarding a rule not found. The *inconsistency* — 6 banners carry an alignment override the other 127 do not — is proven; the cause is not.

12. **Runtime rendering was never performed.** No app was built or opened in a browser. Every finding is derived from source reading, token evaluation, grep, and — for the contrast figures — the WCAG relative-luminance formula applied to resolved token values plus `tailwindcss@4.3.0` OKLCH→sRGB conversion for raw palette classes. Any claim that depends on layout, paint order or AT behaviour is flagged UNPROVEN above.

---

*Read-only research. No file under `apps/`, `packages/`, `services/`, `config/`, `database/` or `scripts/` was created, modified, renamed or deleted.*
