# Sections 8–12: Validation, Async States, Empty/Error, Confirmation, Table Status

> Method note. Every count in these sections was re-derived with `grep -r … --include="*.tsx" --exclude-dir=.next`. The `.next/` exclusion is load-bearing: `apps/*/.next/dev/server/app/page.js` re-exports the entire `@letbuyy/ui` barrel, which inflates naive usage counts roughly 2×. Claims that could not be established from source are marked **UNPROVEN**. Findings in `app-marketplace`, `developer-portal`, `theme-marketplace` and `platform-operations-portal` are labelled **[FROZEN]** and are excluded from the active-product picture.

---

## 8. Inline Error / Validation Audit

### 8.1 The design system ships two competing field-error renderers, and the accessible one is unreachable

Both live in the same file, 77 lines apart.

| | `Input`/`Textarea` built-in error | `InlineError` |
|---|---|---|
| Source | `packages/typescript/ui/src/input.tsx:89` (Input), `:156` (Textarea) | `packages/typescript/ui/src/input.tsx:166-177` |
| Markup | `<p id={errorId} className="m-0 text-[length:var(--lb-font-size-caption)] … text-[color:var(--lb-color-critical)]">` | `<p role="alert">` + `<AlertCircle aria-hidden="true">` + `<span>` |
| `role="alert"` | **No** | **Yes** |
| Icon | **No** | Yes |
| Has an `id` | Yes — generated at `input.tsx:35` | **No** — `InlineErrorProps` (`input.tsx:162-164`) accepts only `children` |
| Wired into `aria-describedby` | Yes — `input.tsx:36-37`, applied at `:44` and `:68` | **No** — cannot be, without an id |
| App usages | ~17 | **0** |

Neither primitive is complete on its own: the built-in error is *linked but silent*; `InlineError` is *announced but unlinkable*. `deprecations.ts` names neither as superseded — the file is an 18-line `warnDeprecated()` helper with zero callers, so this is unmanaged duplication, not a documented migration.

**`InlineError` has zero app consumers — CONFIRMED, with a precise scope.** Verified per-app across all ten app roots (`app-marketplace 0, developer-portal 0, identity-platform 0, marketing-site 0, merchant-control-plane 0, mobile 0, platform-console 0, platform-operations-portal 0, storefront-runtime 0, theme-marketplace 0`). Zero aliased imports (`InlineError as `, `as InlineError`) and no `export * from '@letbuyy/ui'` barrels in any app, so this is not an artefact of renaming or indirection. It is also zero in `services/`, `tools/`, `config/`, `database/`, `scripts/`, `packages/dart/` and `apps/mobile/`.

It is **not** dead code, and must not be grouped with `warnDeprecated` as a deletion candidate: it is instantiated at `packages/typescript/ui/src/foundation-primitives.stories.tsx:117` and has an asserting test at `packages/typescript/ui/tests/components/foundation.test.tsx:542` / `:555` (`expect(screen.getByRole('alert').textContent).toContain('Inventory cannot be negative.')` plus an axe pass). It is also in the frozen public-API snapshot at `packages/typescript/ui/snapshots/public-api.json:165-166`. Correct phrasing: **zero app consumers**, not "unused".

The root cause of zero adoption is structural, not incidental. Apps that want a field error pass `error=` to `Input`, which silently gives them the *weaker* a11y variant (`input.tsx:89`). The accessible primitive is unreachable through the path everyone actually uses.

**Stale documentation, worth flagging separately.** `docs/design-intelligence/component-intelligence/COMPONENT_CATALOG.md:278` and `docs/design-intelligence/evidence/draft-parts-6-7.md:130` both state that `Input`'s `error` prop "triggers red ring and InlineError below". That is false against `input.tsx:89`. `draft-parts-6-7.md:705` describes it correctly — the design-intelligence corpus contradicts itself.

### 8.2 The `error=` prop is barely adopted, so the primitive's correct wiring almost never activates

`packages/typescript/ui/src/input.tsx:33-37` derives the ids and merges them:

```
const errorId = error ? `${inputId}-error` : undefined;
const helperId = helperText && !error ? `${inputId}-helper` : undefined;
const describedBy = [ariaDescribedBy, errorId, helperId].filter(Boolean).join(' ') || undefined;
```

…and applies `aria-describedby={describedBy} aria-invalid={error ? true : ariaInvalid}` on **both** the `unstyled` branch (`:42-44`) and the styled branch (`:66-68`). `Textarea` mirrors this at `:118-121`, `:127-128`, `:143-145`. This is correct — and gated entirely on the caller passing `error=`.

Across all apps there are 552 `<Input` usages and ~17 sites that pass `error=`:

| App | `error=` sites |
|---|---|
| merchant-control-plane | 13 — `[store]/experience/page.tsx:355,:361`; `testimonials/page.tsx:359,:383`; `projects/page.tsx:349`; `education/page.tsx:356,:363`; `certifications/page.tsx:360,:366`; `skills/page.tsx:345`; `components/theme-locale/TranslationValueEditor.tsx:177`; `components/theme-editor/TemplateSwitcherPanel.tsx:255`; `components/theme-editor/controls/ResourcePickerControl.tsx:150` |
| identity-platform | 2 — `reset-password/page.tsx:234`, `set-password/page.tsx:241` |
| storefront-runtime | 0 |
| marketing-site | 0 |
| platform-console | 0 |
| app-marketplace **[FROZEN]** | 0 |
| developer-portal **[FROZEN]** | 0 |
| theme-marketplace **[FROZEN]** | 0 |
| platform-operations-portal **[FROZEN]** | 0 |

Contributing cause: 821 `unstyled` sites exist across apps, including 499 of the 552 `<Input` usages. A component used ~90% of the time as a bare `<input>` shim never reaches for its error slot.

### 8.3 Programmatic association is effectively absent

Measured across all apps (`--exclude-dir=.next`): **31 `aria-invalid` occurrences and 28 `aria-describedby` occurrences** against ~663 form-control usages.

| App | `aria-invalid` | `aria-describedby` | Notes |
|---|---|---|---|
| merchant-control-plane | 17 | 17 | Concentrated in the theme-editor subtree |
| marketing-site | 8 | 10 | **All ten `aria-describedby` are in one file** — `components/contact/ContactForm.tsx:570, :593, :630, :668, :766, :791, :839, :1152` |
| identity-platform | 1 | 1 | `signup/page.tsx:515-516` only |
| storefront-runtime | 0 | 0 | Includes the checkout |
| platform-console | 0 | 0 | 96 form controls, zero wiring — **not** a frozen app |
| app-marketplace **[FROZEN]** | 0 | 0 | 53 controls |
| theme-marketplace **[FROZEN]** | 0 | 0 | 105 controls |
| platform-operations-portal **[FROZEN]** | 0 | 0 | 52 controls |
| developer-portal **[FROZEN]** | 0 | 0 | 2 controls |

### 8.4 Nine incompatible validation-timing modes

| Mode | Representative site | Behaviour |
|---|---|---|
| Server-only, zero client validation | `apps/merchant-control-plane/src/app/[store]/settings/general/page.tsx:306-320` | `handleSave` goes straight to `PATCH`; failures become a critical toast only |
| Server-only on an India-compliance field | `apps/merchant-control-plane/src/app/[store]/settings/business/page.tsx:285-287`, field at `:488-495` | GSTIN has `maxLength={15}` + an uppercase transform as its **entire** client-side contract — no regex, no checksum. `deriveGstStateCode` (`:278`) derives place-of-supply from whatever 15 chars were typed |
| Submit-only, 1 of ~25 fields checked | `apps/merchant-control-plane/src/app/[store]/products/new/page.tsx:571-582` | Only `title` is validated; price/quantity coerced blindly at `:601-611` (`parseFloat(price) \|\| 0`) |
| Submit-only, 7 fields at once | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:313-325` | `validateForm()` sets all seven errors in one `setState` |
| On-blur with touched semantics (**the only one**) | `apps/identity-platform/src/app/signup/page.tsx:197`, `onBlur` at `:506` | `emailTouched && trimmedEmail.length > 0 && !emailFormatValid` |
| Eager on-change from keystroke 1 | `apps/identity-platform/src/app/reset-password/page.tsx:234`; `set-password/page.tsx:241` | `error={confirmPassword && !passwordsMatch ? t.mismatch : undefined}` |
| Always-on while dirty | `apps/merchant-control-plane/src/app/[store]/experience/page.tsx:355`, `:361` | `error={!formData.company.trim() && hasUnsavedChanges ? 'Company is required' : undefined}` — editing any field lights up "required" on every other empty required field |
| Render-time derived | `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx:344` | `const error = required && !value ? \`${label} is required\` : null` — a fresh empty field mounts already in error, and `FieldError`'s `role="alert"` (`:318`) re-fires on every keystroke that empties it |
| URL query-param round trip | `apps/platform-console/src/app/(auth)/login/page.tsx:30-32`, rendered `:50-54` | Server component maps `?error=` through a local switch into a `<div className="… border-red-500/30 …">` with **no** `role` |

Underneath all nine: 75 bare `required` attributes across apps and **zero** `noValidate` on any `<form>`, so native browser validation bubbles fire too — in the browser's locale, on a trilingual (en/hi/ta) identity login page.

### 8.5 Error clearing is inverted between neighbouring pages

| Site | Behaviour |
|---|---|
| `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx:154` | `setFormError(null)` on **any** field edit — wipes a still-valid server error (e.g. duplicate code, set at `:238`) when the user touches an unrelated field |
| `apps/merchant-control-plane/src/app/[store]/settings/shipping/page.tsx:472` | `onChange` is a bare `setFormName(...)` and never clears `formError`, so the critical banner at `:426-430` stays up after the user has already fixed the field, until the next Save reaches `setFormError(null)` at `:248` |

Two adjacent merchant settings surfaces, opposite bugs.

### 8.6 Confirmed structural defects

**a) Four error ids minted, one referenced.** `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx:318` defines `function FieldError({ id, error })` rendering `<p id={id} className="te-field-error" role="alert">`. It is called with `id={`${id}-error`}` at four sites — `:361` (TextInput), `:395` (TextareaInput), `:709` (UrlInput), `:752` (NumberInput) — but `grep -n aria-describedby` on that file returns **line 750 and nothing else**. Three of the four control types mint an error id no element ever references, while all four set `aria-invalid` (`:359`, `:393`, `:707`, `:749`). A screen reader announces "invalid entry" with no accessible explanation for three of four field types.

**b) `aria-invalid` with no message anywhere.** `apps/merchant-control-plane/src/app/[store]/products/inventory/page.tsx:233` sets `aria-invalid={!hasValidQuantity}` (predicate at `:109`) on an `<Input>` with no `error`, no `aria-describedby`, no visible text; the Save control is then `disabled={savingId === row.id || !hasValidQuantity || !hasUnsavedQuantity}` (`:275`). The state is exposed, the action is blocked, nothing says why. WCAG 3.3.1 and 3.3.3.

**c) The same message rendered and announced twice.** `apps/merchant-control-plane/src/components/theme-locale/TranslationValueEditor.tsx:177` passes `error={validationError ?? undefined}` to `<Textarea id="translation-value-input">` **and** hand-renders `<p id="translation-validation-error" role="alert">{validationError}</p>` at `:184-192`, while also passing `aria-describedby="translation-validation-error"` at `:179`. Per `input.tsx:119-121` the DS appends its own `errorId`, producing `aria-describedby="translation-validation-error translation-value-input-error"`; per `input.tsx:156` it renders the text a second time.

**d) Validation failure styled as neutral helper text.** `apps/merchant-control-plane/src/components/domains/ConnectDomainWizard.tsx:108` routes a live-validated failure through the wrong prop: `helperText={domain && !domainValid ? 'Enter a valid domain like example.com or shop.example.com' : 'Use your root domain or a subdomain.'}`. Per `input.tsx:90` this renders in `--lb-color-text-subdued`, `aria-invalid` is never set, and the border stays neutral — behind a Continue button that is `disabled={!domainValid}` (`:112`).

**e) The two best-wired merchant errors are invisible.** `apps/merchant-control-plane/src/components/theme-library/ThemeLibraryWorkspace.tsx:499-511` and `:562-574` are exemplary (`aria-describedby` + `aria-invalid` + `role="alert"` + clear-on-change at `:493`/`:556`) but style the message `text-[color:var(--lb-color-text-critical)]` with **no fallback**. `--lb-color-text-critical` has zero declarations repo-wide — it is not in `packages/typescript/ui/src/tokens.ts` (which declares `--lb-color-critical` once, at `:1104`) nor in any app CSS. Same undefined token at `components/theme-locale/theme-locale.module.css:133,167,204`, `ThemeUpdatePanel.tsx:627`, and `[store]/settings/notifications/page.tsx:638` — 7 sites total, 0 declarations. Perfect semantics, inherited body colour.

### 8.7 The storefront checkout — the highest-value shopper flow — has zero validation accessibility

`apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`, 1160 lines. Verified counts in that file: `aria-invalid` **0**, `aria-describedby` **0**, `htmlFor` **0**, `aria-live` **0**, `role="alert"` **1** (line 637, the page-level banner).

- Seven field errors, all identical: `{errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}` at `:731, :746, :762, :777, :790, :801, :815`, plus a coupon error at `:1120`.
- Seven labels are unassociated plain `<label className="text-xs …">` elements (`:720, :734, :751, :766, :782, :793, :804`); the `<Input unstyled>` sits in a **sibling** `<div className="relative">` — neither `htmlFor`-linked nor nested. The fields' only accessible name is the placeholder.
- `validateForm` (`:313-325`) sets all seven at once with no focus move and no `scrollIntoView`; the single announced element says only "Complete the highlighted delivery fields before continuing." (`:334`) — which a screen-reader user cannot act on, because nothing is "highlighted" to them.

Contrast the token layer: `text-red-500` in this Tailwind v4 project resolves to `#FB2C36` = **3.82:1** on white, below AA for normal text. (Note: `#EF4444` is the LetBuyy `--lb-color-critical` token value, *not* Tailwind's — do not conflate them.)

### 8.8 Focus management exists in exactly one form

`grep -rn "focusFirstError|firstInvalid|\.focus()" apps/` returns 40 hits; the only validation-driven one is `apps/marketing-site/src/components/contact/ContactForm.tsx:304-323` `focusFirstError`, which resolves `FIELD_ORDER` (`:172-182`) against `FIELD_CONTROL_IDS` (`:160-170`) and calls `element.focus({preventScroll:true})` + `scrollIntoView`, invoked at `:328` and `:343`. Every other `.focus()` in apps is a search box, a modal trap (`AdminShell.tsx:113-136`), an OTP digit hop (`identity-platform/src/app/signup/page.tsx:315,329,346`), or a roving tabindex.

Checkout, products/new, coupons, shipping, all six portfolio pages, `DemoRequestForm`, platform-console login and every storefront customer form leave focus on the submit button after a failed submit. WCAG 3.3.1 practical failure.

Note that `ContactForm` lives in `apps/marketing-site` — the one app the design-system ratchet explicitly exiles (`scripts/validators/design-system-baseline.json` `scope.exiledApps: ["apps/marketing-site"]`). Governance did not produce the one correct form.

Its one blemish: `ContactForm.tsx:319` hard-codes `scrollIntoView({ block: 'center', behavior: 'smooth' })` with no `prefers-reduced-motion` guard.

### 8.9 Server → field mapping does not exist

The gateway already returns per-field errors: `services/api-gateway/src/middleware/validation.ts:60-76` emits `{ error: { code: 'VALIDATION_ERROR', details: [{ field, message, code }] } }`.

Across **all** apps, `error.details` is read in exactly one place — `apps/identity-platform/src/app/api/auth/create-store/route.ts:110` — where it is `console.error`-logged and forwarded as an opaque blob. Not one form maps `details[].field` back onto a control. The 25 byte-identical `getErrorMessage(payload, fallback)` clones extract `message` and discard `details` by construction.

There is also no form library anywhere: 0 `react-hook-form`, 0 `formik`; `zod` appears only in `services/api-gateway/**` and two platform-console API routes, never in a client component.

### 8.10 Corrected finding — the "six CRUD pages silently swallow Save" claim

**REFUTED as originally framed.** The guard is real: `apps/merchant-control-plane/src/app/[store]/experience/page.tsx:193` reads `if (saving || !formData.company.trim() || !formData.role.trim()) return`, with no toast, no banner and no focus move. Replicated at `testimonials/page.tsx:199`, `projects/page.tsx:190`, `education/page.tsx:193`, `certifications/page.tsx:199`, `skills/page.tsx:187`.

But the blocking reason **is** already on screen. Every field named in each guard carries an inline error covering exactly that condition: `experience/page.tsx:355` `error={!formData.company.trim() && hasUnsavedChanges ? 'Company is required' : undefined}` and `:361` `'Role is required'`, where `hasUnsavedChanges` (`:165`) is the same condition that makes the guard bite. Same for the other five. Also note every guard begins `if (saving || …)`, so they *are* re-entrancy protected.

**Corrected, narrower findings:**
1. The `SaveBar` Save button is not disabled when the form is invalid — `packages/typescript/ui/src/feedback.tsx:592` is `disabled={state === 'saving'}` only, so the button looks fully live and does nothing on click.
2. There is no focus move to the first invalid field (§8.8).

### 8.11 Severity

| # | Finding | Severity |
|---|---|---|
| 1 | Storefront checkout: 7 required fields, 0 `aria-invalid`/`aria-describedby`/`htmlFor`, no focus move — the revenue path (§8.7) | **P0** |
| 2 | GSTIN — feeds immutable GST invoices and derives place-of-supply — has `maxLength` as its entire client contract (§8.4) | **P0** |
| 3 | The one accessible error primitive has 0 app consumers because the path everyone uses renders the silent variant (§8.1) | **P1** |
| 4 | `--lb-color-text-critical` used 7×, declared 0× — the best-wired merchant errors render in body colour (§8.6e) | **P1** |
| 5 | `aria-invalid` with no message (inventory), 3 of 4 dangling error ids (SchemaFormRenderer) (§8.6a-b) | **P1** |
| 6 | Zero server→field error mapping despite the gateway supplying `details[].field` (§8.9) | **P1** |
| 7 | Nine incompatible timing modes; error clearing inverted between adjacent pages (§8.4, §8.5) | **P2** |
| 8 | Duplicate render + duplicate announcement (TranslationValueEditor) (§8.6c) | **P2** |
| 9 | Validation-as-helper-text behind a disabled button (ConnectDomainWizard) (§8.6d) | **P2** |
| 10 | Save button enabled while form is invalid on 6 CRUD pages (§8.10) | **P3** |

None of this is visible to CI. All ten metrics in `scripts/validators/design-system-baseline.json` (`appCssRawHex`, `appCssNakedRgbHsl`, `tailwindPaletteClasses`, `appLocalLbTokenRedefs`, `rawPxFontSize`, `rawPxSpacing`, `tsxInlineStyles`, `tsxRawHex`, `tsxArbitraryRadius`, `tsxArbitraryShadow`) are colour/spacing/radius counters. The gate can be fully green while every form in the product is inaccessible — a direct conflict with root `AGENTS.md:291` **UI-R4** ("MUST meet WCAG AA; no migration may regress accessibility (the floor). Operator/admin UI prioritizes … reliable forms") and `AGENTS.md:290` **UI-R3**.

---

## 9. Loading / Pending / Progress Audit

### 9.1 Primitive inventory

| Primitive | Source | a11y | Animation | App usages |
|---|---|---|---|---|
| `Skeleton` | `packages/typescript/ui/src/feedback.tsx:291-325` | `aria-hidden="true"` on **all three** variants (`:294`, `:306`, `:313`). No `role`, no `aria-busy`, no sr-only text | **None.** Bars are static `bg-[var(--lb-color-surface-subdued)]` (`:296`, `:305`, `:318`) — no `animate-pulse`, no shimmer, no keyframes in `tokens.ts` | 131 across 69 files |
| `Spinner` | `packages/typescript/ui/src/primitives.tsx:634-641` | **Best in the package** — `role="status"` + `aria-label={label}` + `<span className="sr-only">{label}</span>`, glyph `aria-hidden` | `animate-spin` (`:637`) | 10 |
| `ProgressBar` | `packages/typescript/ui/src/primitives.tsx:443-469` | `role="progressbar"`, `aria-valuemin/max/now`, `aria-label={label}` (`:456-460`) — but `aria-label={undefined}` when no `label` is passed | `transition-[width] duration-[var(--lb-motion-slow)]` (`:463`) | 5 |
| `Button loading` | `packages/typescript/ui/src/button.tsx:22, :63, :77-79` | **No `aria-busy`**, spinner is `aria-hidden`, no sr-only companion | `animate-spin` (`:78`) | 69 `loading={` sites |
| `SaveBar` | `packages/typescript/ui/src/feedback.tsx:546-601` | `aria-live="polite"` on the root (`:572`) — the only correctly-announced pending state in the product | `animate-spin` on `Loader2` (`:576`) | 20 mount points + 1 type ref |

Correction to the task brief: `Spinner`, `ProgressBar` and `FilterChips` live in `primitives.tsx` (lines 634, 443, 399), **not** `productivity.tsx`. `productivity.tsx` contains `Avatar`, `CommandPalette`, `FilterBar`, `MetricCard`, `Pagination`.

### 9.2 Skeleton loading is silent to assistive tech on ~93% of surfaces

`Skeleton` hard-codes `aria-hidden="true"` on every variant. That is correct **only** if the container declares `aria-busy`. Measured: **131 `<Skeleton` usages across 69 files; 17 `aria-busy` occurrences repo-wide; and only 5 of those 69 files contain `aria-busy` at all.**

The five:

| File | Line |
|---|---|
| `apps/storefront-runtime/src/components/storefront/storefront-states.tsx` | `:50`, `:76` |
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/update/UpdatePageClient.tsx` | `:131` |
| `apps/merchant-control-plane/src/components/theme-editor/ThemeUpdatePanel.tsx` | `:530`, `:695`, `:740` |
| `apps/merchant-control-plane/src/components/theme-editor/AICustomizationPanel.tsx` | `:655` |
| `apps/merchant-control-plane/src/components/theme-library/ThemeLibraryWorkspace.tsx` | `:393` |

The correct pattern exists but was never promoted into `@letbuyy/ui`: `apps/app-marketplace/src/components/MarketplaceSkeleton.tsx:19` `<div className="marketplace-skeleton-page" aria-busy="true" aria-live="polite">` — **[FROZEN]**.

Net: a screen-reader user gets total silence during load, then a silently-swapped table. `Table` itself never sets `aria-busy` — `grep -rn "aria-busy" packages/typescript/ui/src` returns **0**.

### 9.3 Reduced motion is honoured by the token layer and ignored by every spinner

`packages/typescript/ui/src/tokens.ts:1606-1617` emits a `@media (prefers-reduced-motion: reduce)` block that zeroes `--lb-motion-fast/hover/menu/carousel/normal/slow` and kills `[data-lb-empty-float]`. That covers `ProgressBar`'s width transition and `EmptyStateIllustration`'s hover lift.

It does **not** cover `animate-spin`, which is Tailwind's own `animation: spin 1s linear infinite` reading `--animate-spin`, not `--lb-motion-*`. All three spinner sites use the bare utility with no `motion-safe:` wrapper:

- `packages/typescript/ui/src/button.tsx:78` — every loading Button, the highest-traffic component in the system
- `packages/typescript/ui/src/feedback.tsx:576` — SaveBar `saving`
- `packages/typescript/ui/src/primitives.tsx:637` — `Spinner`

No app overrides it either: `grep -rn "animate-spin|animate-pulse" apps/*/src/app/globals.css` returns nothing. Repo-wide there are only 6 `motion-reduce:`/`motion-safe:` occurrences (`app-shell.tsx:118,133,140,226`, `feedback.tsx:498`, `DashboardClient.tsx:290`) and none touch animation. Under `prefers-reduced-motion: reduce` every spinner in the product keeps spinning at full speed. **UI-R4** (`AGENTS.md:291`).

### 9.4 Button `loading` is visually correct and silent to AT

`button.tsx:63` derives one flag and enforces it across all three render modes:

```
const interactiveDisabled = disabled || loading;
```

applied as `disabled={interactiveDisabled}` on the real `<button>` (`:134`), and as `aria-disabled` + `tabIndex={-1}` + click suppression on the `asChild` (`:96-105`) and `as="a"` (`:113-122`) paths. **This is load-bearing across this whole report:** any `<Button loading={x}>` is genuinely double-click-proof even when its handler has no re-entrancy guard. It is why several call sites that pass `loading` but forget it in `disabled` — e.g. `apps/merchant-control-plane/src/app/[store]/settings/security/page.tsx:255` — are still safe.

Two gaps in the same JSX:
1. No `aria-busy` — `grep -rn "aria-busy" packages/typescript/ui/src` = 0. All 17 occurrences in the repo are hand-rolled app-side.
2. The spinner is `aria-hidden="true"` (`:78`) with no sr-only companion, unlike `Spinner` (`primitives.tsx:638`). With a static label — the overwhelming majority — a screen-reader user hears the identical accessible name before and during the request. The only signal left is the disabled state.

Seven sites hand-roll the *better* pattern instead of using `loading`, all of the shape `<Button disabled={submitting}>{submitting ? <Spinner size="sm" /> : null}…</Button>`: `products/transfers/page.tsx:232, :403, :524`; `products/purchase-orders/page.tsx:221, :446`; `products/suppliers/page.tsx:134`; `products/locations/page.tsx:130`.

### 9.5 Seven pending-label conventions, splitting file-by-file inside one directory

| Convention | Sites |
|---|---|
| ASCII `...` | ~40. `'Deleting...'` ×14 (`experience:491, comments:402, contact:423, testimonials:473, leads:425, gallery:349, projects:483, education:487, coupons:590, certifications:497, skills:461, pages:517, categories:477, reviews:491`); `'Saving...'` (`appearance:251, online-store/preferences:211, online-store/themes:448`); `'Importing...'`, `'Exporting...'`, `'Publishing...'`, `'Archiving...'`, `'Cancelling...'`, `'Uploading...'`, `'Processing...'` |
| Unicode `…` | ~20. `'Saving…'` (`customers/[email]:458, customers/segments:738, products/smart-collections:321, TranslationValueEditor:202, CustomCssWorkspace:696`); `'Deleting…'` (`settings/general:809`); `'Removing…'` (`settings/users:518, DomainDetailView:332`); `'Creating…'` (`products/purchase-orders:222, products/transfers:233`); `'Adding…'` (`products/suppliers:135, products/locations:131`) |
| Bare `'...'` replaces the label entirely | 7, **all identity-platform** — `login/page.tsx:252, :339`; `signup/page.tsx:530, :604, :715`; `lookup/page.tsx:515, :609`. The button's accessible name literally becomes "…" during the request, with no spinner (these pass `disabled={loading}` but **not** `loading={loading}`), no `aria-busy`, no `aria-live` |
| Pending word, no ellipsis | The canonical primitive itself: `feedback.tsx:596` `{state === 'saving' ? 'Saving' : saveLabel}` and `:577` `'Saving changes'` — note SaveBar **ignores** the caller's `saveLabel` while saving. Copied at `AppsSettingsClient:265` `'Uninstalling'`, `products/new:849, :864` `'Uploading'` |
| Spinner only, label unchanged | 33 of ~40 `loading={}` sites — `settings/security:220, :255, :271`; `StepUpDialog:302`; `reset-password:254`; `forgot-password:157` |
| Icon swap, no animation | `ImagePickerControl:176`, `SchemaFormRenderer:524`, `VideoControl:137`, `MediaLibrary:510, :568` use `<MaterialIcon name={isUploading ? 'hourglass_top' : …}>`, which renders a **static** Loader2 (`icons.tsx:497-517` sets no animation class). `AppBlockSlotPanel:347` uses `hourglass_empty`, which is not in `materialIconMap` at all and falls through to `?? Circle` (`icons.tsx:504`) — a static circle inside `role="status" aria-label="Loading installed apps"` |
| `'Please wait'` — aria-label only, never visible | `ThemeUpdatePanel:696, :741` |

**The sharpest instance — three sibling files, one directory, one action:** `apps/merchant-control-plane/src/components/theme-editor/controls/ImagePickerControl.tsx:177` `'Uploading...'`; `.../VideoControl.tsx:138` `'Uploading…'`; `.../MediaLibrary.tsx:514` `'Uploading…'`. Aggregate: `'Deleting...'` 14, `'Saving…'` 6, `'Saving...'` 4, `'Uploading…'` 2, `'Uploading...'` 2.

None of these label changes is announced — there is no `aria-live` on any Variant 1–4 button. The one exception is SaveBar (`feedback.tsx:572`).

### 9.6 SaveBar leaves two invisible, enabled, tab-focusable buttons in the DOM

`packages/typescript/ui/src/feedback.tsx:569` hides the bar with `isSaved ? 'opacity-0 pointer-events-none' : 'opacity-100'`. Neither utility removes an element from the tab order, and both buttons are `disabled={state === 'saving'}` (`:585`, `:594`) — i.e. **enabled** in the `saved` state.

Compounding it: `:572` declares `aria-live="polite"` on the wrapper and `:577` renders `{state === 'saving' ? 'Saving changes' : 'Unsaved changes'}` — the ternary has **no `saved` branch**, so a successful save produces no confirmation and leaves the stale, contradictory string "Unsaved changes" inside a live region.

Callers mount it unconditionally rather than conditionally rendering it — verified at `apps/merchant-control-plane/src/app/[store]/products/inventory/page.tsx:373` and `apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx:596` — so this affects all 20 mount points, including money surfaces. WCAG 2.4.11 + 4.1.3.

Full mount inventory (all in merchant-control-plane): `experience:478`, `posts:557`, `products/gift-cards:596`, `products/inventory:373`, `products/new:1291`, `products/collections:470`, `testimonials:460`, `appearance:455`, `projects:470`, `education:474`, `coupons:578`, `certifications:484`, `skills:448`, `export:471`, `pages:505`, `categories:465`, `online-store/preferences:325`, `online-store/pages:812`, `online-store/themes/[themeId]/editor:1531`, `components/settings/SettingsPane.tsx:65`.

### 9.7 One confirmed never-resolving loader — on the merchant subscription checkout

`apps/merchant-control-plane/src/app/[store]/access_account/checkout/checkout/CheckoutClient.tsx:257-359`. `setIsProcessing(true)` at `:258`. Resets exist for the throw path (`:357`), verify-failure (`:338`, `:344`) and `razorpay.on('payment.failed')` (`:351`). But `grep -n "ondismiss|modal:"` on that file returns **zero hits** — the options object built at `:297-346` has no `modal.ondismiss`, and `razorpay.open()` (`:354`) returns immediately.

Closing the Razorpay modal without paying therefore leaves `isProcessing` true forever, behind `<Button … loading={isProcessing} fullWidth>` at `:676`. The merchant cannot retry without a full page reload.

**Proof it is a defect, not a platform limitation — the same repo does it correctly:** `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:533-536` `modal: { ondismiss: function () { setIsProcessing(false); } }`, with the type declared at `:51-52`.

Outside this one site the codebase is genuinely disciplined: `finally { setX(false) }` is near-universal, and a scan of every `set*(Loading|Saving|Submitting|…)(true)` adjacent to a network call in a `'use client'` file surfaced no other never-resolving state. An adjacent structural risk remains **UNPROVEN in practice**: `packages/typescript/api-client/src/index.ts:5541-5545` sets no default timeout (only a caller-supplied `signal`), so a hung gateway never settles and the `finally` never runs — the discipline protects against thrown errors, not against a socket that never closes. No app uses `AbortSignal.timeout`.

### 9.8 The payout release — a money path — has zero in-flight feedback

`apps/merchant-control-plane/src/app/[store]/payouts/page.tsx:90-122`. `handleReleaseStepUpSuccess` calls `setStepUpOpen(false)` at `:92` **first**, then fires `POST …/payouts/{id}/settle` at `:95-106`. The Release button at `:204-214` carries only `size="sm"` and `onClick` — **no `disabled`, no `loading`** — and `releasingId` (`:60`) is never used to disable the row. A money-moving request runs against a completely static UI, with the row still showing its `pending` Badge until `loadPayouts()` returns.

The client-side idempotency key is regenerated per attempt (`:101` `` `payout-settle-${releasingId}-${crypto.randomUUID()}` ``). This is a hygiene issue only, **not** a duplicate-settlement risk: `services/api-gateway/src/routes/payouts.ts:571` short-circuits idempotently on `status === 'released'` and `:572-574` rejects anything not `pending`/`processing` with 409 `PAYOUT_NOT_SETTLEABLE`. Re-entry also requires a fresh TOTP through `StepUpDialog`.

### 9.9 Bulk actions have no loading primitive at all

`packages/typescript/ui/src/table.tsx:25-29` — `TableBulkAction<T>` is `{ label; onAction; destructive? }`. No `loading`, no `disabled`, no async. `table.tsx:207-214` renders a plain, always-enabled `<Button onClick={() => action.onAction(selectedRows)}>`.

`apps/merchant-control-plane/src/app/[store]/orders/page.tsx:324-378` `bulkUpdateOrderStatus` has no re-entrancy guard and runs a **sequential** `for` loop of PATCHes (`:344-357`) with per-row `crypto.randomUUID()` keys (`:350`). The bar is clickable for the entire duration, there is no counter and no `ProgressBar`.

The two consumers fake progress in the label instead: `products/page.tsx:231` `label: bulkActionKey === 'active' ? 'Publishing...' : 'Publish selected'`; orders (`:446-458`) has no pending label at all.

Confirmed reporting bug at `:363-369`: the toast fires `variant: 'warning'` whenever `failures > 0`, so a **total** failure is announced as an amber partial reading "0 of N eligible orders were updated". Per-item error messages and codes are destroyed at `:353` (`if (!response.ok) failures += 1`) and `:354-356` (`catch { failures += 1 }`).

### 9.10 There is no real progress reporting anywhere in the product

Zero `XMLHttpRequest`, zero `onUploadProgress`, zero `upload.onprogress` in any app. All uploads use `fetch`, which cannot report progress. `ProgressBar` — the primitive that would express determinate progress, and which has **no indeterminate mode** — is used 5 times, none for a file transfer: password strength ×2 (`reset-password:219`, `set-password:226`), a resend cooldown (`check-email:178`), and two frozen-app score meters (`MerchantHealthIndexTable:50`, `OnboardingQueueIndexTable:37` — **[FROZEN]**).

### 9.11 Severity

| # | Finding | Severity |
|---|---|---|
| 1 | Merchant subscription checkout spins forever on Razorpay modal dismiss (§9.7) | **P1** |
| 2 | Payout release: money-moving request, zero in-flight feedback, button stays live (§9.8) | **P1** |
| 3 | ~93% of skeleton loads silent to AT; `Skeleton` is `aria-hidden` with no `aria-busy` anywhere in the package (§9.2) | **P1** |
| 4 | `animate-spin` ignores `prefers-reduced-motion` in all three spinner sites, including every loading Button (§9.3) | **P1** |
| 5 | SaveBar leaves two invisible, enabled, focusable buttons and announces "Unsaved changes" after a save (§9.6) | **P1** |
| 6 | Bulk actions: no loading state, sequential N requests against an enabled bar, total failure reported as amber partial (§9.9) | **P2** |
| 7 | `Button loading` has no `aria-busy` and no sr-only text; 33 of ~40 sites keep a static label (§9.4) | **P2** |
| 8 | Seven pending-label conventions, three inside one directory (§9.5) | **P3** |
| 9 | No upload progress anywhere; `ProgressBar` has no indeterminate mode (§9.10) | **P3** |
| 10 | Static `hourglass_top`/`hourglass_empty` glyphs used as busy indicators in the theme editor (§9.5) | **P3** |

---

## 10. Empty / Error State Audit

### 10.1 Root cause: the type system cannot express "this empty is an error"

`packages/typescript/ui/src/feedback.tsx:338-352`:

```
export type EmptyStateKind =
    | 'generic' | 'products' | 'collections' | 'inventory' | 'orders'
    | 'customers' | 'discounts' | 'marketing' | 'content' | 'domains'
    | 'themes' | 'analytics' | 'apps' | 'payments';
```

Fourteen members, **all domain nouns**. There is no `error`, no `no-results`, no `permission-denied`, no `disconnected`. The canonical primitive models *what* is missing and never *why*. There is also no `retry?: () => void` prop — recovery must be threaded through the untyped `primaryAction` slot.

Consequence, measured over 98 `<EmptyState>` call sites:

| Semantic case | Sites that express it |
|---|---|
| Never-created / first-run | 98 / 98 |
| Filtered-to-zero | 25 / 98 |
| Failed-to-load | **8 / 98**, all in merchant-control-plane |
| Permission-denied | **0** — no representation anywhere in the UI layer |
| Deleted / unavailable resource | 0 — collapsed into the same 404 as permission-denied |
| Disconnected integration | Partial and jargon-laden only (`InternalSkipBackendPanel`, `BackendNeededPane`) |

The eight error-aware sites: `customers/page.tsx:314-343`, `orders/page.tsx:461-472`, `orders/[orderId]/page.tsx:657-670`, `payouts/page.tsx:125-129`, `marketing/page.tsx:560-565`, `settings/security/page.tsx:174-178`, `products/inventory/page.tsx:326`, `customers/[email]/page.tsx:640`.

The best of them is short enough to be the template — `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:461-479`:

```
icon={<MaterialIcon name={error ? 'error' : 'receipt_long'} />}
title={error ? 'Unable to load orders' : 'No orders yet'}
body={error || (filter !== 'all' ? … : 'Orders will appear here …')}
primaryAction={error ? <Button onClick={loadOrders}>…Retry</Button> : undefined}
secondaryAction={!error && (filter !== 'all' || …) ? <Button …>Clear filters</Button> : undefined}
```

### 10.2 Eight distinct empty-state treatments ship simultaneously

| # | Treatment | Source | `role` | Action slot |
|---|---|---|---|---|
| 1 | `EmptyState` | `packages/typescript/ui/src/feedback.tsx:516` | **none** | primary + secondary |
| 2 | Table mobile empty | `packages/typescript/ui/src/table.tsx:243-246` — `p-[var(--lb-space-3)]` | none | none |
| 3 | Table desktop empty | `packages/typescript/ui/src/table.tsx:348-353` — `p-[var(--lb-space-4)]` | none | none |
| 4 | `InternalEmptyDataState` | `packages/typescript/ui/src/internal-workspace.tsx:205-211` — dashed border, one `message: string` prop | none | **none** |
| 5 | `InternalSkipBackendPanel` | `packages/typescript/ui/src/internal-workspace.tsx:178-201` — "Not available" / "Data source is not connected." | none | none |
| 6 | Chart "No chart data" | `packages/typescript/ui/src/primitives.tsx:69-80` | **`role="status"`** — the only empty state in the package that announces itself | none |
| 7 | CommandPalette "No commands found" | `packages/typescript/ui/src/productivity.tsx:362-364` — a bare `<p>` inside `role="listbox"` | none | none |
| 8 | `MarketplaceUnavailable` | `packages/typescript/ui/src/marketplace.tsx:20-45` — zero classes, fully unstyled; both consumers are **[FROZEN]** | `role="alert"` **and** `aria-live="polite"` on the same element (contradictory) | retry |

Note items 2 and 3 use different padding for the identical state, and `emptyState ?? emptyMessage` (default `'No data found'`, `table.tsx:117`) means a Table's empty state and a page's `EmptyState` look nothing alike unless the caller passes one in.

### 10.3 The flagship failure: a gateway outage renders as an empty shop, and is ISR-cached

Chain, fully re-traced:

1. `apps/storefront-runtime/src/lib/product-service.ts:41-51` —
   ```
   } catch (error) {
       console.error('[ProductService] Worker store fetch failed:', error);
       return [];
   }
   ```
   Identical swallows at `:35-37`, `:60-62`, and `return null` at `:78-80`.
2. `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:49` `buildSectionDataPlan(...)` → `apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts:91-93`.
3. `apps/storefront-runtime/src/components/sections/product-grid.tsx:195-200` —
   ```
   {products.length === 0 && (
       <StorefrontEmptyState icon={<ShoppingBag …/>} title="No products found"
           body="Products added to this store will appear here." />
   )}
   ```
4. `export const revalidate = 60` at **both** `page.tsx:10` and `layout.tsx:20`, so the empty-because-broken page is cached and re-served.

**Proof it is a defect, not a policy — the same directory does it correctly.** `apps/storefront-runtime/src/lib/content-service.ts:103-105` and `:113-115`:

```
} catch (error) {
    if (isNotFoundError(error)) return [];
    throw error;
}
```

(`isNotFoundError` at `:76-78` = `error.status === 404`.) Blog and pages rethrow 5xx into the error boundary. **Products — the revenue path — swallow it.**

Sibling services swallow identically: `apps/storefront-runtime/src/lib/review-service.ts:28-31` returns `emptyReviewData()`, `apps/storefront-runtime/src/lib/store-service.ts:112-116` returns `null`.

### 10.4 Four distinct defects in one 130-line shopper file

`apps/storefront-runtime/src/app/store/[subdomain]/account/addresses/addresses-client.tsx`:

| Line | Defect |
|---|---|
| `:49-59` | `catch { // silent } finally { setLoading(false) }` — a load failure resolves with `addresses` still `[]`, so `:152-157` renders `<StorefrontEmptyState title="No saved addresses" body="Add an address for faster checkout." />`. **An outage is rendered as "you have no addresses."** |
| `:87-107` | `handleSave` is `try { … if (res.ok) { … } } finally { … }` — **no `else` and no `catch`**. A 4xx/5xx leaves the form open showing nothing; a network throw becomes an unhandled rejection |
| `:110-121` | `handleDelete` never checks `res.ok`, then unconditionally `setAddresses(prev => prev.filter(a => a.id !== id))` at `:118`. On an HTTP 500 the row disappears despite the failure. On a genuine network throw the row survives but the rejection is unhandled and still produces no message — both branches are broken, for different reasons |
| `:124-131` | `setDefault` has **no try/catch at all** and no feedback |

`grep -rn "ConfirmDialog" apps/storefront-runtime/src` returns **0**, so the delete has no confirmation either.

### 10.5 Permission-denied has no UI representation; it is collapsed into 404

`apps/merchant-control-plane/src/lib/auth/session.ts`:

| Line | Behaviour |
|---|---|
| `:107` | `if (status === 401 \|\| status === 403) return null` (getSessionUser) |
| `:151` | `if (status === 401 \|\| status === 403 \|\| status === 404) return null` (getStoreForUser) |
| `:182` | `if (status === 401 \|\| status === 403) return []` (getUserStores) |

`apps/merchant-control-plane/src/app/[store]/layout.tsx:24-28` then calls `notFound()`, rendering `apps/merchant-control-plane/src/app/not-found.tsx:29-33` — "404 / Page not found / The page you are looking for does not exist or may have been moved."

A merchant who genuinely lost access, one whose store was suspended, and one who mistyped their own subdomain all get the identical, actively-wrong sentence, with no "Sign in again" or "Switch store" affordance. Anti-enumeration justifies a 404 for a *foreign* store; nothing here distinguishes "your session lost access" from "this URL is wrong."

To be fair to that file, it is the best-reasoned error handling in the repo — `:146-152` documents the intent explicitly ("5xx/network/unexpected → rethrow so an error boundary renders instead of faking a 404 for a transient backend failure") and it is the only retry/backoff implementation in the stack (`:11`, `:58-81`). Four files away, `apps/merchant-control-plane/src/app/[store]/settings/apps/page.tsx:23` ignores it entirely: `.catch(() => [])` feeds `AppsSettingsClient.tsx:184-188` `<EmptyState … title="No apps installed" …>`.

### 10.6 Two more confirmed "failure rendered as fact" sites

**Signup funnel lies in both directions.** `apps/marketing-site/src/app/[locale]/create/page.tsx:45` `setSubdomainAvailable(res.status === 404) // 404 = available` and `:46-47` `} catch { setSubdomainAvailable(true) // Assume available on error }`. A network failure **affirms** availability (the user proceeds and is rejected later in signup); any non-404 error status (500/502/429) reports every desired subdomain as **taken** during an outage.

**Merchant onboarding checklist fabricates "not done".** `apps/merchant-control-plane/src/components/AISidebar.tsx:127` `} catch { /* fallback = 0 */ }` and `:136` `} catch { /* fallback = false */ }`, feeding `buildDynamicTodos(storeData, store, productCount, hasPayment)` at `:138`. On failure, a merchant who *has* products and *has* configured payments is told to go do both again. That is a data-lie, not a missing message.

For contrast, a *documented* false-negative that is defensible: `apps/merchant-control-plane/src/app/[store]/dashboard/page.tsx:162-168` explains in-file that an unreachable payment-config endpoint is treated as not-configured "so the checklist under-claims rather than over-claims". The right call for a checklist — and the exact opposite of the storefront behaviour, which false-negatives a shopper-facing catalogue with no disclosure.

### 10.7 The incident console reports ALL CLEAR during a total outage

`apps/platform-console/src/app/(dashboard)/operations/page.tsx:286-296` collects `errors[]` but still returns `overview: overviewResult.data?.data || {}`, `commands: … || []`, `postmortems: … || []`.

Render order:

| Line | Content |
|---|---|
| `:330-332` | `<ConsoleApiErrorPanel title="Operations API unavailable" …>` |
| `:336` | `Open incidents 0` |
| `:338` | `DLQ messages 0`, `tone='success'` |
| `:339` | `Firing alerts 0`, `tone='success'` |
| `:459` | `<EmptyDataState message="No incidents returned." />` |

`ConsoleApiErrorPanel` is `apps/platform-console/src/components/ConsoleDataTable.tsx:144-151` — a plain `<section>` with an `<h2>`, **no `role="alert"`, no `role="status"`, no `aria-live`**, and warning-toned rather than critical (`border-[var(--lb-color-warning)] bg-[var(--lb-color-warning-soft)]`). A backend failure appears with zero announcement above three green zeros.

`grep -rn 'role="alert"\|aria-live=' apps/platform-console/src` returns **0** app-authored occurrences across the entire app.

Related honesty problem: eleven operator empty states use the word "returned", which is technically true and operationally useless — the operator cannot tell whether the platform is healthy or the API gave nothing. `operations/page.tsx:459, :566, :617, :672, :701`; `trust-safety/page.tsx:49`; `merchants/[id]/page.tsx:186, :205`; `compliance/page.tsx:326`.

### 10.8 Error boundaries — five App-Router apps ship none

Verified with `find apps/<app>/src -name error.tsx -o -name global-error.tsx -o -name not-found.tsx`:

| App | error.tsx | global-error.tsx | not-found.tsx |
|---|---|---|---|
| merchant-control-plane | ✅ | ✅ | ✅ |
| storefront-runtime | ✅ | ✅ | ✅ (+ `store/[subdomain]/not-found.tsx`) |
| **identity-platform** | ❌ | ❌ | ❌ |
| **marketing-site** | ❌ | ❌ | ❌ |
| **platform-console** | ❌ | ❌ | ❌ |
| developer-portal **[FROZEN]** | ✅ | ❌ | ✅ |
| app-marketplace **[FROZEN]** | ❌ | ❌ | ❌ |
| theme-marketplace **[FROZEN]** | ❌ | ❌ | ❌ |
| platform-operations-portal **[FROZEN]** | ❌ | ❌ | ❌ |

Two of the three uncovered apps are load-bearing: **identity-platform** is the ES256/HS256 auth surface for every merchant login, and **platform-console** is the operator control plane built entirely of async server components (e.g. `(dashboard)/operations/page.tsx:299 export default async function OperationsDashboardPage()`), so a throw in a loader has no boundary to land in. Both fall through to the unbranded Next.js default.

`apps/storefront-runtime/src/app/store/[subdomain]/not-found.tsx` documents its own gap in-file: Next's `not-found.tsx` does not receive route params, so it re-exports the root 404 (`export { default } from '@/app/not-found';`). On a white-label platform this means a shopper hitting a dead URL on a merchant's own custom domain sees a page whose eyebrow is hardcoded `LetBuyy` (`not-found.tsx:27`) and whose CTA is a generic "Continue shopping" — the merchant's brand and their authored `bundle.templates.not_found` are never rendered.

**Contrast risk, PLAUSIBLE but not runtime-verified.** Both storefront boundaries use `color: 'var(--foreground, rgb(15 23 42))'`. `--foreground` is defined exactly once, at `apps/storefront-runtime/src/app/globals.css:41` `--foreground: rgb(15 23 42);`, with no dark variant and no `.dark`/`prefers-color-scheme` block in that file, while the per-merchant theme injection at `store/[subdomain]/layout.tsx:178-212` overrides `--background` (`:182`) and sets `--is-dark` (`:187`) but never touches `--foreground`. On a merchant with a dark store theme that is dark-slate text on a dark background. The token facts are CONFIRMED; the rendered outcome is **UNPROVEN**. (merchant-control-plane is unaffected — `globals.css:142-143` and `:201-202` define both light and dark.)

### 10.9 Retry exists as a real pattern in exactly one app

Rendered retry controls (`>Retry<` / `>Try again<`):

| App | Count |
|---|---|
| merchant-control-plane | 38 |
| storefront-runtime | **0** |
| identity-platform | **0** |
| platform-console | **0** |
| marketing-site | **0** |
| theme-marketplace **[FROZEN]** | 1 |
| developer-portal **[FROZEN]** | 1 |
| app-marketplace **[FROZEN]** | 0 |
| platform-operations-portal **[FROZEN]** | 0 |

Even in merchant-control-plane the placement is wrong at 33 of 38 sites: retry lives on a page-top `<Banner variant="critical" … action={<Button>Retry</Button>}>` while a first-run `EmptyState` sits below it. Only 5 put retry **inside** the empty state — `settings/security/page.tsx:178`, `orders/[orderId]/page.tsx:663-666`, `orders/page.tsx:466`, `payouts/page.tsx:129`, `customers/page.tsx:333`.

Structural blockers elsewhere:
- `StorefrontEmptyState` (`apps/storefront-runtime/src/components/storefront/storefront-states.tsx:14-46`) accepts only `actionHref`/`actionLabel` and builds a `<Link>` (`:22-29`) — it is **incapable** of expressing a retry callback. All 12 call sites therefore have no recovery path, including the swallowed-error case at `product-grid.tsx:196-200`.
- platform-console/platform-operations-portal are async server components with no boundary and no `reset`, so `ConsoleApiErrorPanel` has no action element at all. The operator's only recovery during an incident is a manual browser refresh.

### 10.10 The coexisting contradiction — a red failure banner above a cheerful first-run CTA

36 merchant pages render both simultaneously on a load failure. `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx`:

| Line | Renders |
|---|---|
| `:134-141` | catch → `setLoadError(message)` + critical toast |
| `:347-353` | `<Banner variant="critical" title="Coupons could not load" action={<Button …>Retry</Button>}>` |
| `:497-511` | `<EmptyState title="No coupons yet" body="Create discount codes to offer promotions to your customers." primaryAction={…Create coupon}>` |

A merchant with 50 existing coupons sees a red failure banner directly above onboarding copy urging them to create their first. Identical shape at `products/collections/page.tsx:378-383 + :434-452`, `categories/page.tsx:288 + :398`, `pages/page.tsx:314 + :432`, `testimonials/page.tsx:318 + :394`, `projects/page.tsx:308 + :377`, `gallery/page.tsx:209 + :279`.

### 10.11 Engineering artefacts rendered to merchants

`apps/merchant-control-plane/src/components/settings/BackendNeededPane.tsx` is reachable from the settings nav (`settings-navigation.ts:169`, label "Custom data") via `apps/merchant-control-plane/src/app/[store]/settings/custom-data/page.tsx`. It renders:

| Line | Merchant-visible text |
|---|---|
| `BackendNeededPane.tsx:34` | Banner titled `'[SKIP - NEEDS BACKEND]'` |
| `BackendNeededPane.tsx:67` | "WS9 is limited to frontend settings architecture, so missing contracts are documented instead of fabricated." |
| `BackendNeededPane.tsx:77` | Three info Banners **all titled** "Required contract detail" |
| `custom-data/page.tsx:15` | EmptyState body = the literal string `"[SKIP - NEEDS BACKEND: metafields and metaobjects API]"` |
| `custom-data/page.tsx:17-19` | "Required read endpoint: \`GET /api/stores/:store/custom-data\` …", "… with tenant-scoped \`site_id\` ownership checks." (backticks render literally) |

`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_UI_UX_GOVERNANCE.md:171` already cites `[SKIP - NEEDS BACKEND]` screens as a UIUX-007 defect and rules "no placeholder/`SKIP` screen user-reachable" — for mobile. The same defect exists on web and is untracked.

Two more: `analytics/page.tsx:243-244` — "The current analytics endpoint returns summary totals and order status counts. Monthly revenue buckets can be shown here when that field is populated."; `orders/[orderId]/page.tsx:456-458` — "Line items for this order are not available from the gateway response."

### 10.12 Empty-state adoption by app

| App | `<EmptyState` | `<Banner` | `<Skeleton` | `useToast()` |
|---|---|---|---|---|
| merchant-control-plane | 71 | 76 | 101 | 73 |
| platform-console | 5 | 3 | 0 | 0 |
| storefront-runtime | 2 | **0** | 9 | **0** |
| identity-platform | 0 | 6 | 0 | **0** |
| marketing-site | 0 | **0** | 0 | **0** |
| app-marketplace **[FROZEN]** | 8 | 0 | 0 | 0 |
| theme-marketplace **[FROZEN]** | 7 | 0 | 17 | 4 |
| platform-operations-portal **[FROZEN]** | 5 | 5 | 0 | 0 |
| developer-portal **[FROZEN]** | 0 | 0 | 4 | 0 |
| **Total** | **98** | **90** | **131** | **77** |

### 10.13 Severity

| # | Finding | Severity |
|---|---|---|
| 1 | Storefront catalogue renders "No products found" during a gateway outage and ISR-caches it — revenue path, shopper-facing, merchant unaware (§10.3) | **P0** |
| 2 | `addresses-client.tsx`: outage shown as empty state, failed save silent, failed DELETE still removes the row, `setDefault` unhandled (§10.4) | **P0** |
| 3 | Signup-funnel subdomain check affirms availability on network error and reports every subdomain taken during an outage (§10.6) | **P1** |
| 4 | 90 of 98 EmptyStates cannot express "failed to load"; `EmptyStateKind` has no error/no-results/permission kind (§10.1) | **P1** |
| 5 | Permission-denied, suspended store and mistyped URL all render the same 404 with no recovery affordance (§10.5) | **P1** |
| 6 | identity-platform, marketing-site and platform-console ship zero error boundaries (§10.8) | **P1** |
| 7 | Incident console reports success-toned zeros above a non-announcing warning panel during a total outage (§10.7) | **P1** |
| 8 | AISidebar checklist fabricates "not done" on a fetch failure (§10.6) | **P2** |
| 9 | Zero retry affordance in storefront, identity, console and marketing; `StorefrontEmptyState` structurally cannot express one (§10.9) | **P2** |
| 10 | 36 pages show a red failure banner above a first-run CTA (§10.10) | **P2** |
| 11 | `[SKIP - NEEDS BACKEND]` and raw route specs rendered on a live merchant settings route (§10.11) | **P2** |
| 12 | Eight distinct empty-state treatments; only `Chart`'s announces itself (§10.2) | **P3** |

**UI-R3** (`AGENTS.md:290`) binds every screen to "skeleton loading, empty, error-with-retry". Measured: 90/98 canonical empty states cannot render an error and 43/98 offer no action of any kind. No metric in `design-system-baseline.json` measures state completeness — which is exactly why this drift is invisible to a green 107-validator gate.

---

## 11. Modal / Confirmation Feedback Audit

### 11.1 `ConfirmDialog` structurally cannot express loading or failure

`packages/typescript/ui/src/overlays.tsx:496-506` — the complete prop surface:

```
export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    children?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}
```

Nine props. **No `loading`, no `confirmDisabled`, no `busy`, no `error` slot.** `onConfirm: () => void` is not async and is never awaited. The confirm button (`:530`) is hardcoded:

```
<Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>
    {confirmLabel}
</Button>
```

No `disabled`, no `loading`. All 31 call sites inherit this.

What it does get right, and should not be lost in any remediation: focus trap via `useFocusTrap` (`:439`, machinery at `overlay-hooks.ts:80-145` — captures `document.activeElement`, sets `inert` + `aria-hidden` on body-level siblings, wraps Tab, restores focus at `:142`); Escape + outside-pointer dismissal via `useDismiss` (`:440`); reference-counted scroll lock (`:441`); and full `role="dialog"` / `aria-modal` / `aria-labelledby` / `aria-describedby` wiring (`:459-462`). Covered by a test at `packages/typescript/ui/tests/components/foundation.test.tsx:337-346`.

### 11.2 The headline: every call site guards `onClose` and leaves `onConfirm` open

This is the single most diagnostic observation in the section. The authors were demonstrably aware of the in-flight state — they used it to defend the *dismiss* path — and had no API with which to defend the *confirm* path.

| Site | `onClose` guard | `onConfirm` guard | Verdict |
|---|---|---|---|
| `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx:595` | `if (!deleting) setCouponToDelete(null)` | `handleDelete` opens `if (!couponToDelete \|\| deleting) return` (`:251`) | **Safe** |
| `apps/merchant-control-plane/src/components/domains/DomainDetailView.tsx:336` | `if (!working) setConfirmDelete(false)` | `remove` (`:111-112`) goes straight to `setWorking(true)` — **no guard** | **Double-submittable** |
| `apps/merchant-control-plane/src/app/[store]/settings/apps/AppsSettingsClient.tsx:267-269` | `if (!isPending) setPendingApp(null)` | `uninstall` (`:111-112`) guards only `if (!pendingApp) return` — **never checks `isPending`** | **Double-submittable** |
| `apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:825` | `onClose={() => setPageToArchive(null)}` — **unguarded** | `archivePage` (`:295-296`) guards only `if (!pageToArchive) return` — **never checks `saving`** | **Double-submittable** |
| `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:673` | `onClose={() => setCancellingId(null)}` — **unguarded** | `handleCancel` → `updateOrderStatus` (`:254-259`) opens with a bare `setUpdatingId(orderId)` and never checks it | **Double-submittable — guards neither** |

The `DomainDetailView` case is the sharpest, because the correct pattern sits **14 lines above the broken one** in the same file:

```
:95-97   const makePrimary = useCallback(async () => {
             if (working) return
             setWorking(true)
:111-112 const remove = useCallback(async () => {
             setWorking(true)          // ← no guard
```

`makePrimary`'s trigger is `<Button loading={working}>` at `:178`. `remove`'s confirm button only swaps its label — `confirmLabel={working ? 'Removing…' : 'Remove domain'}` (`:332`) — and `setConfirmDelete(false)` appears **only in the catch** (`:121`), so the dialog stays open across the entire await.

`archivePage` has the same shape: `setPageToArchive(null)` is at `:310`, **after** `await parsePayload(...)` at `:304`, so the dialog (bound to `open={Boolean(pageToArchive)}`) stays open for the whole DELETE round-trip with a static `confirmLabel="Archive page"` (`:822`).

`orders/page.tsx` is the only site with a **static** `confirmLabel` (`:671 confirmLabel="Cancel order"`) — it does not even do the cosmetic label swap its siblings do. Its idempotency key is regenerated per call (`:267` `` `admin-order-${orderId}-${status}-${crypto.randomUUID()}` ``), so two clicks produce two different keys and server-side idempotency cannot dedupe them.

**Proven contrast inside the same file:** the row-level action buttons at `orders/page.tsx:747-767` are `<Button size="sm" loading={updating} …>` and are genuinely protected by `button.tsx:63/:134`. Only the destructive confirm path is unguarded.

**Two claims REFUTED in verification, corrected here:**
- `ConflictDialog.tsx:64` (force-overwrite) is **not** double-submittable. `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx:1567-1581` closes the dialog synchronously first (`setHasConflict(false)` is the first statement, bound to `open={hasConflict}` at `:1561`), so the second click has no dialog to hit. This is the safest pattern in the codebase.
- The payout release (§9.8) is a **missing-feedback** finding, not a double-submit one: re-entry requires a fresh TOTP and the gateway short-circuits idempotently.

**[FROZEN]** `apps/app-marketplace/src/components/InstalledAppsGrid.tsx:420` has the same unguarded shape.

### 11.3 The highest-stakes destructive action has no confirmation at all

`apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx` — `grep -c "ConfirmDialog"` returns **0**.

The trigger at `:355-366` is one click straight to the mutation:

```
<Button type="button" variant="destructive"
    loading={statusBusyId === row.id}
    disabled={statusBusyId === row.id}
    onClick={() => void changeStatus(row, 'disabled')}>
    <Lock … /> Disable
</Button>
```

`changeStatus` (`:251-258`) immediately `PATCH`es `{ status: 'disabled', reason: 'Disabled by merchant' }`. This irreversibly kills customer stored value with no confirm step. It is well-guarded against *double* submission (`loading` + `disabled`), which makes the missing confirmation the entire finding.

### 11.4 Destructive-flow matrix

| Action | Site | Confirm | Destructive style | Loading in dialog | Dismiss guard | In-dialog error | Reversibility stated |
|---|---|---|---|---|---|---|---|
| Disable gift card | `products/gift-cards/page.tsx:355-366` | **✗ none** | ✅ | ✅ (button) | n/a | ✗ | ✗ |
| Cancel order | `orders/page.tsx:667-679` | ✅ | ✅ | **✗ static label** | **✗** | ✗ (toast + banner behind the dialog) | ✗ |
| Release payout (money) | `payouts/page.tsx:204-214` | Step-up TOTP | — | **✗ none anywhere** | n/a | ✗ | ✗ |
| Bulk order transition | `orders/page.tsx:446-459` | **✗ none** | ✗ | **✗** (primitive has no field) | n/a | ✗ | ✗ |
| Archive page | `online-store/pages/page.tsx:817-828` | ✅ | ✅ | ✗ label-only | **✗** | ✗ | ✗ |
| Remove domain | `DomainDetailView.tsx:328-337` | ✅ | ✅ | ✗ label-only | ✅ | ✗ | ✅ "You can reconnect it later." |
| Uninstall app | `AppsSettingsClient.tsx:261-270` | ✅ | ✅ | ✗ label-only | ✅ | ✗ | ✗ (and `cancelLabel` left at the generic default) |
| Delete coupon | `coupons/page.tsx:586-597` | ✅ | ✅ | ✗ label-only | ✅ | ✗ | ✗ |
| Remove staff | `settings/users/page.tsx:514-523` | ✅ | ✅ | ✗ label-only | ✅ | ✗ | ✗ |
| Delete review | `reviews/page.tsx:485-495` | ✅ | ✅ (dialog) / **✗ trigger is `variant="outline"`** (`:337`) | ✗ label-only | ✅ | ✗ | ✅ "permanently removes" |
| Delete store | `settings/general/page.tsx:805-812` | ✅ | ✅ | ✗ label-only | ✅ | ✗ | ✅ "This action cannot be undone." |
| Force-overwrite draft | `ConflictDialog.tsx:58-64` | ✅ | ✗ (non-destructive) | n/a — closes synchronously | n/a | ✗ | ✗ |
| Remove theme section | `editor/page.tsx:1539-1556` | ✅ | ✅ | n/a (local draft) | n/a | n/a | ✗ **no undo** |
| Uninstall marketplace app **[FROZEN]** | `InstalledAppsGrid.tsx:413-438` | ✅ | ✅ | ✗ label-only | ✗ | ✅ **page-level `role="alert"`** (`:312-313` → `:348-353`) | ✅ |

The frozen app-marketplace row is worth preserving: it is the **only** sampled site that surfaces a failure *outside* the dialog as an announced page-level alert, and it also collects a reason via the `children` slot (`:428-437`). That is the pattern the active apps lack.

Row-level delete triggers use three different visual treatments for the same action: `variant="ghost" size="icon" className="text-[var(--lb-color-critical)]"` (`coupons/page.tsx:558-563`, `categories/page.tsx:445-450`), `variant="outline"` (`reviews/page.tsx:337-344`, `posts/page.tsx:329`), and full `variant="destructive"` (`online-store/pages/page.tsx:489`). `Button` has no low-emphasis destructive variant (`button.tsx:36` is a single filled `--lb-color-critical` treatment), which is why they fork.

### 11.5 The toast fallback is unreachable while a dialog is open

Because `ConfirmDialog` has no error slot, every failure escapes to a toast. That toast is not announced and not dismissable for the duration of the dialog.

Chain:
1. `packages/typescript/ui/src/feedback.tsx` contains **zero** `createPortal` calls — the toast container renders in-tree inside `<ToastContext.Provider>` (`:220-274`).
2. `packages/typescript/ui/src/overlays.tsx:43` `document.body.appendChild(el)` portals the dialog to `<body>`.
3. `packages/typescript/ui/src/overlay-hooks.ts:58-66` walks up from the overlay and, at the body level, calls `hideTree(sibling)` on every other body child; `:45-46` sets `aria-hidden="true"` and `inert`.
4. `apps/merchant-control-plane/src/components/AdminShell.tsx:187` mounts `<ToastProvider>` **inside** the app root — i.e. inside that now-inert sibling.

`--lb-z-toast` = 70 > `--lb-z-modal` = 60 (`tokens.ts:552-560`), so the toast paints *on top of* the dialog while being (a) inside an `aria-hidden` region and (b) unreachable by keyboard. 37 files in merchant-control-plane combine `useToast` with a dialog, including the gift-card money surface (`<Drawer>` at `:538`, `notify(...)` at `:263, :271, :300`).

**Confidence: HIGH but NOT RUNTIME-VERIFIED.** Derived from reading `overlay-hooks.ts:31-78`, `design-system-root.tsx:36-47`, `AdminShell.tsx:187` and `tokens.ts:552-560` together with the passing inert assertion at `tests/components/foundation.test.tsx:337-346`. Not reproduced in a browser.

Additionally, the toast auto-dismisses after `duration = 5000` (`feedback.tsx:200`, timer at `:210-214`) with no pause on hover or focus — `grep -n "setTimeout|clearTimeout|onMouseEnter" feedback.tsx` returns exactly one line, `:212`. ~80 catch blocks fire a `variant: 'critical'` toast without setting any persistent error state, so on a page load failure the only notice disappears after 5 seconds. WCAG 2.2.1.

### 11.6 On mobile the destructive button sits on top

`packages/typescript/ui/src/overlays.tsx:486` — Modal's footer is `flex flex-col-reverse justify-end … [&>button]:w-full sm:flex-row sm:[&>button]:w-auto`. `ConfirmDialog` emits Cancel then Confirm in DOM order (`:526-533`), so `flex-col-reverse` renders the full-width **destructive confirm as the top button** with Cancel below it at <640px.

Given the mandated ~360px India-first mobile target, the red irreversible action is the first thumb target on every one of the 31 confirm dialogs.

### 11.7 "Cancel order?" with buttons [Cancel] and [Cancel order]

`apps/merchant-control-plane/src/app/[store]/orders/page.tsx:667-679` passes no `cancelLabel`, so `overlays.tsx:503` supplies the default `'Cancel'`. The merchant sees a dialog headed **"Cancel order?"** with buttons **[Cancel]** and **[Cancel order]**, where "Cancel" means "do not cancel". Nothing in the copy states whether the customer is refunded, whether payment is reversed, or whether the action is reversible.

Cancel-label copy is split roughly 15/16 across the 31 dialogs: named opt-out ("Keep coupon", "Keep domain", "Keep staff", "Keep app", "Keep plan", …) at `categories:478, coupons:591, leads:426, users:519, plan:313, DomainDetailView:333, skills:462, projects:485, testimonials:474, certifications:498, education:488, experience:492, contact:424`; bare default "Cancel" at `comments:398, gallery:345, pages:513, posts:565, reviews:485, orders:667, settings/apps:261, settings/general:805, settings/shipping:607, settings/taxes:664, online-store/pages:819, editor:1539, :1549, themes:567, ThemeUpdatePanel:753, ThemeLibraryWorkspace:578`.

### 11.8 The default dialog body talks about the merchant, to the merchant, in the third person

`packages/typescript/ui/src/overlays.tsx:536-539` — when no `children` is supplied:

> "This action can affect merchant data. Review it before continuing."

That is operator voice, hardcoded in the shared package, shown to merchants.

### 11.9 Zero unsaved-changes protection, repo-wide

`grep -rni "beforeunload" apps packages services --include="*.ts" --include="*.tsx"` returns **0 matches**. There is no `onRouteChangeStart`, no `useBeforePopState`, no router blocker, and no `usePrompt`-style hook anywhere.

The dirty state **is** computed — `hasUnsavedChanges` at `settings/general/page.tsx:187`, `settings/business/page.tsx:208`, `settings/payments/page.tsx:127`, `settings/policies/page.tsx:93`, `experience/page.tsx:165`; `isDirty` at `online-store/themes/[themeId]/editor/page.tsx:1532` — and is fed **only** into `SaveBar`'s `state` prop.

Highest-stakes case: the theme editor holds an entire unsaved draft (sections, blocks, settings) in client state with `isDirty` live at `:1532`, while the shell's left nav and `PageHeader` breadcrumbs are ordinary `<Link>`s. Clicking any of them, hitting Back, or closing the tab discards the draft with no prompt. Same for `settings/general` (store profile), `settings/business` (GSTIN/legal), `settings/payments`, `products/new` and `appearance`.

Secondary gap in the primitive: `SaveBar`'s Discard button (`feedback.tsx:580-588`) fires `onDiscard` immediately with **no** ConfirmDialog — losing unsaved work is one click, and `discardChanges` at `editor/page.tsx:1535` is wired straight through.

### 11.10 Severity

| # | Finding | Severity |
|---|---|---|
| 1 | Disabling a gift card — irreversible destruction of customer stored value — has no confirmation at all (§11.3) | **P0** |
| 2 | Four destructive confirms are double-submittable: order cancel, page archive, domain remove, app uninstall (§11.2) | **P0** |
| 3 | Zero unsaved-changes guards repo-wide; the theme editor loses an entire draft on any nav click (§11.9) | **P1** |
| 4 | `ConfirmDialog` cannot express loading or failure — the root cause of #2 and of every cosmetic `confirmLabel` swap (§11.1) | **P1** |
| 5 | Error toasts raised from inside an open dialog are `aria-hidden` + `inert` (§11.5) — HIGH confidence, not runtime-verified | **P1** |
| 6 | `flex-col-reverse` puts the destructive button on top on mobile for all 31 dialogs (§11.6) | **P2** |
| 7 | "Cancel order?" / [Cancel] / [Cancel order]; no refund or reversibility statement on the money path (§11.7) | **P2** |
| 8 | 16 of 31 dialogs state neither permanence nor reversibility; three visual treatments for row-level delete (§11.4) | **P2** |
| 9 | `SaveBar` Discard destroys unsaved work in one click with no confirmation (§11.9) | **P2** |
| 10 | Package-level default body copy is operator voice shown to merchants (§11.8) | **P3** |

---

## 12. Table / List Status Audit

### 12.1 What `Table` provides for feedback, and what it does not

`packages/typescript/ui/src/table.tsx`, `TableDataProps<T>` at `:48-69`.

| Capability | Status | Evidence |
|---|---|---|
| Loading | ✅ | Desktop `<Skeleton variant="table" lines={4}/>` in one `colSpan` `<td>` (`:342-347`); mobile `<Skeleton variant="card" lines={5}/>` (`:239-242`) |
| Empty | ✅ | `emptyState ?? emptyMessage`, default `'No data found'` (`:117`, rendered `:243-246` / `:348-353`) |
| **Error / retry** | **✗ absent** | `TableDataProps` has `loading`, `emptyState`, `emptyMessage` — **no `error`, no `onRetry`**. Contradicts `AGENTS.md:290` UI-R3 |
| `aria-busy` during load | **✗ absent** | `grep -rn "aria-busy" packages/typescript/ui/src` = **0**, and `Skeleton` is `aria-hidden` — loading is completely silent |
| `aria-sort` on sortable headers | **✗ absent** | `grep -rn "aria-sort" packages/typescript/ui/src` = **0** |
| Sort affordance when inactive | **✗ absent** | `SortIcon` (`:84-89`) is `if (!active) return null` — a sortable column shows nothing until after the first click |
| Pagination | **✗ absent** | `Pagination` lives in `productivity.tsx:139`, used 5× and never by `Table`; platform-console re-implements a third copy at `ConsoleDataTable.tsx:66-84` |
| Bulk-action pending state | **✗ absent** | `TableBulkAction` (`:25-29`) has no `loading`/`disabled`; `:207-214` renders a plain enabled Button |
| Row-level warning/error tint | **✗ absent** | `grep -rn "rowClassName\|getRowClassName\|rowVariant\|rowTone"` across apps+packages = **0**. `<tr>` is hardcoded `className="hover:bg-[var(--lb-component-table-row-hover-bg)]"` (`:359`) with no per-row hook |
| Row selection a11y | ✅ | `aria-selected` on `<tr>` (`:359`), `data-selected` on the mobile `<article>` (`:260`), sr-only-labelled select-all Checkbox (`:249-253`) — but the `{n} selected` count (`:204`) is not in a live region |

### 12.2 Three improvised error treatments for one problem

Because `Table` has no error prop, each consumer invents one:

| Pattern | Site | Retry? |
|---|---|---|
| Banner **with** retry, above the table | `apps/merchant-control-plane/src/app/[store]/reviews/page.tsx:394-401` — `<Banner variant="critical" title="Reviews could not load" action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}>` | ✅ |
| Error folded **into** the EmptyState | `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:461-472` — `title={error ? 'Unable to load orders' : 'No orders yet'}` + Retry `primaryAction` | ✅ — the best shape |
| Banner with **no** retry | `apps/merchant-control-plane/src/app/[store]/products/page.tsx:386-390` — `<Banner title="Products unavailable" variant="critical">{error}</Banner>` | ✗ |

### 12.3 Table filter chips are not keyboard-accessible, and the accessible implementation sits unused

`packages/typescript/ui/src/table.tsx:196`:

```
<Badge key={chip.label} label={chip.label} variant="info" onClick={chip.onRemove} />
```

`Badge` renders a bare `<span>` (`feedback.tsx:73-86`). The `onClick` therefore lands on a non-interactive element with **no `role="button"`, no `tabIndex`, no key handler, no focus ring**, and — because `Badge` always renders the tone icon (`feedback.tsx:83`, `Info` for `variant="info"`) — **no visible "×"** telling the user it is removable. The chip is 28px tall (`--lb-density-pill-height`). Keyboard and screen-reader users cannot remove a table filter.

The package already contains the correct implementation. `packages/typescript/ui/src/primitives.tsx:399-434` `FilterChips` renders a real `<button type="button" … aria-label={\`Remove ${chip.label}…\`}><X/></button>` at `:412-419`.

**`FilterChips` has zero app consumers — CONFIRMED**, verified per-app across all ten roots and also zero in `services/`, `tools/`, `config/`, `database/`, `scripts/`, `packages/dart/` and `apps/mobile/`. Zero aliased imports, no re-export barrels. Its only references anywhere are three story instantiations — `packages/typescript/ui/src/primitives.stories.tsx:86`, `:149` (declaration at `:145`, import at `:12`) and `packages/typescript/ui/src/component-catalog.stories.tsx:353` (import at `:23`; note `:348` is a *description string*, not a usage). **It has zero test references** — unlike `InlineError`, it is storied but untested.

`TableFilterChip` (the type exported at `packages/typescript/ui/src/index.ts:11`) likewise has zero app usages.

One caveat on the impact: only 4 merchant sites pass `onRemove` — `customers/page.tsx:397`, `products/page.tsx:399`, `orders/page.tsx:655`, `products/inventory/page.tsx:358`. The 4 platform-console sites pass label-only chips, so those are merely decorative.

Correction to the task brief: `FilterChips` is in `primitives.tsx`, not `productivity.tsx`. `productivity.tsx:225` `FilterBar` takes an opaque `chips?: React.ReactNode` slot (rendered `:254`) and never imports it — three chip surfaces, zero shared implementation.

### 12.4 Status column position is not standardised

| Surface | Status column position | Evidence |
|---|---|---|
| Orders | Payment at 4, Status at 5 (of 8) | `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:531`, `:537` (keys: order, customer, item_count, payment_status, status, total, created_at, actions) |
| Customers | **Last** (7 of 7) | `apps/merchant-control-plane/src/app/[store]/customers/page.tsx:302` |
| Reviews | 5 of 6 | `apps/merchant-control-plane/src/app/[store]/reviews/page.tsx:295` |
| Inventory | 6 of 8 | `apps/merchant-control-plane/src/app/[store]/products/inventory/page.tsx:251` |
| Gift cards | mid-table | `apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx:331` |

There is no shared `statusColumn()` helper and no convention. A merchant scanning three tables finds status in three different places.

### 12.5 Mobile buries status in a definition grid

`Table`'s card mode promotes only `columns[0]` to the hero (`table.tsx:280`) and pushes every remaining column into a two-column `<dl className="m-0 grid grid-cols-2 …">` in declaration order (`:283-296`). For orders that puts the Status badge as the 4th `<dd>` in a definition grid on a ~360px screen, detached from the order number — while on desktop it sits in a scannable column. No column can opt into hero or mobile-priority placement.

The grid is `grid-cols-2` unconditionally below `md` with no 1-col fallback at 320px, giving a 156px track at 360px and 136px at 320px. `Badge` has no `whitespace-nowrap`, no `truncate` and no `max-w` (`feedback.tsx:75`), so long labels **wrap into two-line stadium pills** rather than truncating. Real example: `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:167-169` builds `` `${method.toUpperCase()} / ${titleize(status)}` `` → "RAZORPAY / Partially Refunded", ~218px of content in a 156px track. `orders/page.tsx:530-545` declares no `cardLabel`/`cardRender`, so it goes straight into the card grid.

Separately, `column.truncate` is silently desktop-only: applied at `table.tsx:375` and `:383-384`, ignored by `renderCardCell` (`:167-168`). Only `products/page.tsx:266,315` and `reviews/page.tsx:235,264` hand-duplicate a `cardRender` to compensate.

### 12.6 Functional parity gap: product status is editable on desktop, read-only on mobile

`apps/merchant-control-plane/src/app/[store]/products/page.tsx`:

| Renderer | Behaviour |
|---|---|
| `render` (`:289-314`) | Badge with an invisible `<select className="absolute inset-0 h-full w-full … opacity-0">` stretched over it, `aria-label={\`Change status for ${product.name}\`}`, `disabled={updatingStatusId === product.id}` |
| `cardRender` (`:315-318`) | `return <Badge label={…} variant={productStatusBadge[status]} />` — **the select is dropped entirely** |

This is a parity finding only, not a double-submit one: the select **is** disabled during the mutation (`:301`). The hit area on desktop is nonetheless the 28px pill.

### 12.7 Row-level status highlighting does not exist

Proven negative: `grep -rn "rowClassName|getRowClassName|rowVariant|rowTone|rowStatus" apps/ packages/` returns **0 hits**. The only `<tr className=…>` in all of apps/ are `align-top` (`platform-console/compliance/page.tsx:249`, `merchant leads/page.tsx:266`) and a header-row background (`settings/notifications/page.tsx:618`).

Concretely: `products/inventory/page.tsx:254-256` renders an "Out of stock" critical Badge but leaves the row untinted; `payouts/page.tsx:190-194` renders `payout.failure_reason` as red caption text inside an otherwise-normal row. A merchant scanning 50 rows for problems has only a 28px pill to find them by.

### 12.8 `hideHeaderWhenEmpty` destroys the control that got you into the empty state

`table.tsx:131` defaults `hideHeaderWhenEmpty` to `true`, and `:164-166` computes `showToolbar`, `showSortBar` and `showHeader` all as `!(hideHeaderWhenEmpty && !loading && rows.length === 0)` — so it hides the **toolbar** (saved views + filter chips) too, not just the `<thead>`.

`products/page.tsx:395` opts in. Its empty state (`:404-432`) offers "Clear search" only when `searchQuery.trim()`, and `emptyTitle` (`:343`) is `searchQuery.trim() ? 'No matching products' : 'Add your first product'`. So selecting the "Archived" saved view (`productViews`, `:24-29`) with zero archived products shows **"Add your first product"** — factually false for a merchant with a full catalogue — with the view tabs gone and no way to leave the filter.

`orders/page.tsx:472-479` avoids this by adding a "Clear filters" `secondaryAction`.

### 12.9 platform-console ships a name-colliding, colour-only status badge fork

`apps/platform-console/src/components/ConsoleDataTable.tsx:89-111`:

```
export function StatusBadge({ value, tone }: { value: string; tone?: 'green' | 'amber' | 'red' | 'zinc' }) {
    const resolvedTone = tone || (
        ['active','published','verified','trialing'].includes(value.toLowerCase()) ? 'green'
        : ['draft','pending','past_due'].includes(value.toLowerCase()) ? 'amber'
        : ['suspended','cancelled','inactive','false'].includes(value.toLowerCase()) ? 'red'
        : 'zinc');
    const className = {
        green: 'bg-emerald-500/10 text-emerald-300',
        amber: 'bg-amber-500/10 text-amber-300',
        red:   'bg-red-500/10 text-red-300',
        zinc:  'bg-zinc-700/60 text-zinc-300',
    }[resolvedTone];
    return <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${className}`}>{value}</span>;
}
```

Four defects in 22 lines:

1. **Name collision.** It shadows the canonical `StatusBadge` from `@letbuyy/ui` (`feedback.tsx:117`), which takes `{ status, label, variant }` — a completely different API. All 14 platform-console `<StatusBadge` sites import from `@/components/ConsoleDataTable`: `stores/page.tsx:64`, `merchants/page.tsx:53`, `subscriptions/page.tsx:57`, `users/page.tsx:55`, `settings/page.tsx:84`, `founding/page.tsx:77, :99`, `employees/page.tsx:280, :411, :502, :591`, `developers/page.tsx:453, :507, :536`.
2. **Colour-only.** No icon, unlike the canonical `Badge` which always emits one (`feedback.tsx:83`). Colour is the sole channel — WCAG 1.4.1 risk.
3. **Raw Tailwind palette, no tokens, `rounded` not `rounded-full`** — a UI-R1/UI-R7 violation counted only as generic `tailwindPaletteClasses` drift, never as component duplication.
4. **Semantic hole:** the red list omits `failed`, `error`, `declined`, `expired`. Those fall through to `'zinc'` — **a failed row renders neutral grey**. It also renders `{value}` raw, so operators see `past_due`, `frozen`, `pending_cod`.

Note platform-console is an **active** runtime, not frozen. It simultaneously uses the tokenised `InternalStatusPill` (via `_local-ui/console-workspace.tsx:80-82`), so two visually different status pills coexist inside one product.

### 12.10 Live status-rendering conflicts inside one product

Only conflicts where both sides render and the value is reachable. Dead components (`StoreDirectoryIndexTable`, `SubscriptionManagementIndexTable`, `TrustSafetyIndexTable`, `TicketIndexTable` — all verified zero import sites) are excluded.

| Conflict | Site A | Site B | Reachable by one user? |
|---|---|---|---|
| Subscription status | `apps/platform-console/src/app/(dashboard)/subscriptions/page.tsx:57` → ConsoleDataTable fork: `trialing`→green, `cancelled`→red, `expired`→zinc grey | `apps/platform-console/src/app/(dashboard)/revenue/page.tsx:137` → `InternalStatusPill`: `trialing`→amber, `cancelled`→**blue** (unmatched → `defaultTone 'info'`), `expired`→blue | **Yes** — same endpoint (`/internal/console/subscriptions`, `subscriptions:91` and `revenue:46`), adjacent nav entries (`(dashboard)/layout.tsx:32`, `:34`) |
| `PageStatus` draft/archived | `apps/merchant-control-plane/src/app/[store]/pages/page.tsx:67-70` — draft→`'default'` grey, archived→`'critical'` red | `apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:100-103` — draft→`'warning'` amber | **Yes** — same endpoint (`…/pages?limit=100` at `pages:97` and `online-store/pages:211`), both in `storeNavigation` (`merchantNavigation.ts:149`, `:167`) |
| Moderation verdicts | `apps/merchant-control-plane/src/app/[store]/comments/page.tsx:66-69` — pending→grey, rejected→grey | `apps/merchant-control-plane/src/app/[store]/reviews/page.tsx:70-73` — pending→**amber**, rejected→**red** | Same app, different screens (`merchantNavigation.ts:155`, `:142`) |
| "Expired" instrument | `apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx:98-102` — `'warning'` amber | `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx:94-97` — `'critical'` red | Same app, different screens; both render the literal label "Expired" |
| Payout `processing` | `apps/merchant-control-plane/src/app/[store]/payouts/page.tsx:46` — `'info'` blue | `apps/platform-console/src/app/(dashboard)/developers/page.tsx:116` — `'warning'` amber | No single observer — vocabulary drift, not a user-visible contradiction |

**Corrected — two claims REFUTED in verification:**
- Order status `fulfilled` / `returned` do **not** render differently between the orders list and detail. `fulfilled` is not a member of `orders.status` (the CHECK at `database/supabase/migrations/147_executable_order_state_risk.sql:34-46` is pending/pending_cod/confirmed/processing/shipped/delivered/cancelled/refunded/returned/rto), and `returned` is unwritable (`packages/checkout-core/src/index.ts:231-235` `UpdateOrderStatusSchema` permits only confirmed/processing/shipped/delivered/cancelled/refunded; `VALID_TRANSITIONS` at `:1426-1435` has no `returned` target). Walking all 8 reachable statuses through `orders/page.tsx:155-160` and `orders/[orderId]/page.tsx:193-199` gives **identical** tones for every one.
- Payment status does **not** diverge in practice. `orders_payment_status_check` (`database/supabase/migrations/000_baseline.sql:10168`) is `['pending','paid','failed','refunded']` and no later migration widens it. For all four reachable values both mappers agree. The divergence exists only for `requires_action`/`authorized`/`partially_refunded`/`voided`, which the column rejects on write.

Underlying all of this: **`statusToBadgeVariant` (`packages/typescript/ui/src/feedback.tsx:94-102`) — documented at `:89-93` as "the single source for status→tone logic" — has zero app consumers.** Repo-wide it is referenced only at `index.ts:61`, `feedback.tsx:94` and `feedback.tsx:118`. The one canonical `<StatusBadge>` call site in all of apps/ (`apps/merchant-control-plane/src/app/[store]/settings/notifications/page.tsx:650-654`) passes `variant={statusVariant(log.status)}` from a local mapper at `:142-147`, overriding the derivation. **The function never executes in the product.**

It also contains a real substring bug — I executed the exact function body and got `inactive`→success, `unpaid`→success, `unverified`→success, `disconnected`→success, `unhealthy`→success, `unpublished`→success, `'not connected'`→success, `delivery_failed`→success — because the success keyword list (`:97`, containing `active`, `paid`, `verified`, `connected`, `healthy`, `published`, `live`) is tested with `s.includes(k)` **before** the critical list at `:98`. This must be reported as a **latent trap in an unused shared API**, not as a live rendering defect: no app calls it. Any app that migrates onto it inherits the bug.

### 12.11 One live status bug worth escalating on its own

`apps/merchant-control-plane/src/app/stores/AllStoresClient.tsx:165`:

```
<span className={`all-stores-card-status ${store.status === 'active' ? 'active' : 'inactive'}`}>{store.status}</span>
```

styled at `apps/merchant-control-plane/src/app/globals.css:1951-1954` — `.all-stores-card-status.inactive { background: rgba(239, 68, 68, 0.12); color: var(--error); }`.

`store.status` is `sites.status`, sourced via `apps/merchant-control-plane/src/lib/auth/session.ts:156-176` → gateway `stores.list`. The DB CHECK at `database/supabase/migrations/000_baseline.sql:12026` is `ARRAY['draft','published','unpublished','frozen','suspended']` — **`'active'` is not a member.** Consequences:

1. `.active` (emerald, `globals.css:1946-1949`) is unreachable.
2. `const activeStores = stores.filter((s) => s.status === 'active')` (`AllStoresClient.tsx:70`) is always empty.
3. A healthy `published` store renders a **red** pill with the raw lowercase label "published" — while `published` maps to `success`/green on four other merchant surfaces (`pages/page.tsx:68`, `online-store/pages/page.tsx:101`, `posts/page.tsx:91`, `dashboard/page.tsx:305`).

That is a same-semantic, opposite-colour conflict on the merchant's store-picker, and it is a live bug rather than drift.

### 12.12 Severity

| # | Finding | Severity |
|---|---|---|
| 1 | Merchant store picker renders every store — including healthy `published` ones — in critical red, because the equality test can never be true (§12.11) | **P1** |
| 2 | `Table` has no error state; three improvised treatments, one with no retry at all (§12.2) | **P1** |
| 3 | Table filter chips are `onClick` on a bare `<span>` — no role, no tabIndex, no keyboard path, no visible "×" — while the accessible `FilterChips` sits unused (§12.3) | **P1** |
| 4 | platform-console's `StatusBadge` fork: name collision, colour-only, raw palette, and `failed`/`error` render as neutral grey (§12.9) | **P1** |
| 5 | Subscription status renders green/red/grey vs amber/blue/blue on two adjacent console pages off one endpoint (§12.10) | **P1** |
| 6 | `PageStatus` draft/archived inverted between two live merchant nav routes (§12.10) | **P2** |
| 7 | No `aria-sort`, no `aria-busy`, no sort affordance until first click (§12.1) | **P2** |
| 8 | Row-level status highlighting does not exist — out-of-stock and failed-payout rows are visually normal (§12.7) | **P2** |
| 9 | `hideHeaderWhenEmpty` hides the saved-view tabs, stranding merchants in an invisible filter under a false "Add your first product" (§12.8) | **P2** |
| 10 | Mobile buries status in a 2-col `<dl>`; long badges wrap into two-line pills; `column.truncate` is desktop-only (§12.5) | **P2** |
| 11 | Product status editable on desktop, read-only on mobile (§12.6) | **P3** |
| 12 | Status column position varies across five surfaces with no shared helper (§12.4) | **P3** |

The `statusToBadgeVariant` substring bug (§12.10) is **not** ranked above, because it is latent: zero call sites. It should be fixed before any migration onto the shared helper, not because of current behaviour.
