# 04 — Quality Findings

All evidence is from source reading and `grep`. No app was built or rendered; runtime-dependent claims are labelled **UNPROVEN** or **PLAUSIBLE**. Frozen apps (`app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal`) are labelled **[FROZEN]** and excluded from the active-product picture.

**Contrast method.** Ratios computed with the WCAG 2.x relative-luminance formula from the resolved token values in `packages/typescript/ui/src/tokens.ts`. Tailwind utility colours resolved from `tailwindcss@4.3.0` (this repo is on v4 — the default palette is OKLCH and does **not** equal the v3 hex table; any figure computed from v3 hexes is wrong by 0.05–0.10). `color-mix(in srgb, C p%, transparent)` composited over the applicable surface as `rgba(C, p)`.

**Threshold basis.** `tokens.ts:753-760` / `:776-783` give body 14px/20px, caption 12px/16px, badge 12px/16px, small 13px/18px. Nothing flagged below reaches WCAG large-text (18.66px bold / 24px), so **4.5:1 is the correct bar for every text finding**; non-text UI is judged at 3:1.

---

## 16. Accessibility Findings

### 16.1 Ranked findings

| # | Sev | Finding | Anchor |
|---|-----|---------|--------|
| A1 | P0 | Toast live region is created at the same instant as its first message | `packages/typescript/ui/src/feedback.tsx:218,223-232` |
| A2 | P0 | Every toast is `aria-hidden` + `inert` while any Modal/Drawer/ConfirmDialog is open | `feedback.tsx:220-274` + `overlays.tsx:42-44` + `overlay-hooks.ts:45-66` |
| A3 | P0 | Star ratings expose no accessible value; interactive stars have empty accessible names | `apps/storefront-runtime/src/components/product/product-reviews.tsx:36-60` |
| A4 | P1 | `InternalStatusPill` uses the raw 500-ramp as foreground — 4 tones fail AA | `packages/typescript/ui/src/internal-workspace.tsx:164-169` |
| A5 | P1 | The canonical form-error colour fails contrast in light mode | `packages/typescript/ui/src/input.tsx:89, :156, :169` |
| A6 | P1 | `SaveBar` "saved" state leaves two enabled, focusable, invisible buttons in the tab order | `feedback.tsx:569, :585, :594` |
| A7 | P1 | Skeleton loading is silent on ~93% of surfaces that use it | `feedback.tsx:294, :306, :313` |
| A8 | P1 | `aria-invalid` / `aria-describedby` are effectively absent on form fields | `input.tsx:33-37` vs ~17 of 552 `<Input` sites |
| A9 | P1 | `animate-spin` ignores `prefers-reduced-motion` in all three spinner sites | `button.tsx:78`, `feedback.tsx:576`, `primitives.tsx:637` |
| A10 | P1 | 44 app sites render status meaning as raw 500-ramp text on plain surfaces | `platform-console/.../money-reconciliation/page.tsx:159, :189` |
| A11 | P2 | Toasts auto-dismiss at 5s with no pause-on-hover/focus | `feedback.tsx:200, :210-214` |
| A12 | P2 | Nested/conflicting live regions inside the toast stack | `feedback.tsx:230` vs `:245` |
| A13 | P2 | `Banner` has no dismiss affordance and re-announces static banners on load | `feedback.tsx:121-126, :139` |
| A14 | P2 | `MetricCard` delta tone is colour-only | `productivity.tsx:58-69` |
| A15 | P2 | `ConsoleApiErrorPanel` announces nothing (35 sites) | `platform-console/src/components/ConsoleDataTable.tsx:144-151` |
| A16 | P2 | Badge `default` and `info` render the identical glyph | `feedback.tsx:36` vs `:42` |
| A17 | P2 | Dismiss/close controls never reach 44px in any density | `feedback.tsx:263`, `overlays.tsx:477, :187` |
| A18 | P2 | `FilterChips` remove button is 14×14 — below WCAG 2.2 AA 2.5.8 | `primitives.tsx:412-419` (latent: 0 app consumers) |
| A19 | P2 | Activation-card completion marker is `aria-hidden` with no text equivalent | `DashboardClient.tsx:330-337, :343` |
| A20 | P3 | Modal and Drawer disagree on scrim exposure | `overlays.tsx:448-452` vs `:158-164` |
| A21 | P3 | Badge/Banner borders sit at 1.93–3.21:1 (decorative only — not a failure) | `feedback.tsx:35,41,47,53,59` |
| A22 | P3 | `MaterialIcon` hard-codes `aria-hidden` before the prop spread | `icons.tsx:497-511` (latent) |

### 16.2 P0 — the notification channel does not reach assistive tech

**A1 — the live region does not pre-exist its content.** `packages/typescript/ui/src/feedback.tsx:218` computes `const activePlacements = Array.from(new Set(toasts.map((toast) => toast.placement ?? placement)));` — an empty array when `toasts` is empty — and `:223-232` renders the `aria-live="polite"` container only inside `activePlacements.map(...)`. **No container exists at rest**, so the region and its first message enter the DOM in one mutation. Screen readers must observe an `aria-live` region *before* content is inserted; a region injected with its content is routinely not announced. All 146 `useToast` call sites depend on this one region.

**A2 — toasts are `inert` for the entire time a dialog is open.** Four verified links:

1. `grep -c createPortal packages/typescript/ui/src/feedback.tsx` → **0**; the toast container renders in-tree (`feedback.tsx:220-274`).
2. `packages/typescript/ui/src/overlays.tsx:43` — `document.body.appendChild(el)` portals dialogs to `<body>`.
3. `packages/typescript/ui/src/overlay-hooks.ts:58-66` walks to `<body>` and calls `hideTree(sibling)` on every other body child; `:45-46` does `inertElement.setAttribute('aria-hidden', 'true'); inertElement.inert = true;`.
4. `apps/merchant-control-plane/src/components/AdminShell.tsx:187` mounts `<ToastProvider>` **inside** the app root — i.e. inside that sibling.

Because `--lb-z-toast` (70) > `--lb-z-modal` (60) (`tokens.ts:552-560`), a failure toast raised from an open dialog is **drawn on top of the dialog but is neither announced nor dismissable**. 37 files in merchant-control-plane combine `useToast` with a dialog, including the money surface `apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx` (`<Drawer>` at `:538`; `notify(...)` at `:263, :271, :300`). *Reasoned from code plus the passing inert assertion at `tests/components/foundation.test.tsx:337-346`; not reproduced in a browser — **PLAUSIBLE***.

**A3 — star ratings.** `apps/storefront-runtime/src/components/product/product-reviews.tsx:43-56` renders five `<Button unstyled type="button" disabled={!interactive} onClick={...}>` whose only child is `<Star size={size} className={star <= rating ? 'text-amber-400' : 'text-gray-200'} fill={...} />`. `lucide-react@0.562.0` auto-applies `aria-hidden="true"` to childless icons (`lucide-react.js:64` — `...!children && !hasA11yProp(rest) && { "aria-hidden": "true" }`), so **each button computes an empty accessible name** (WCAG 4.1.2) and the rating value is carried entirely by hue. Read-only use at `:232`. The identical defect exists in the **active merchant app** at `apps/merchant-control-plane/src/app/[store]/testimonials/page.tsx:100-116` (`active ? 'text-[var(--lb-color-warning)]' : 'text-[var(--lb-color-border)]'`, explicit `aria-hidden="true"`, rendered at `:412` inside a text-free div with `testimonial.rating` in scope and never surfaced).

### 16.3 Contrast matrix

Every Badge/Banner text-on-soft pair **passes**. The failures are in the components that did not follow that convention.

| Component / site | Theme | Foreground → Background | Ratio | Verdict |
|---|---|---|---|---|
| Badge/Banner info (`feedback.tsx:38-43`) | light | `#1D4ED8` → `#E0F2FE` | **5.84** | PASS |
| Badge/Banner success (`:44-49`) | light | `#15803D` → `#DCFCE7` | **4.57** | PASS |
| Badge/Banner warning (`:50-55`) | light | `#92400E` → `#FEF3C7` | **6.37** | PASS |
| Badge/Banner critical (`:56-61`) | light | `#B91C1C` → `#FEE2E2` | **5.30** | PASS |
| Badge default, admin surface (`tokens.ts:1178-1179`) | light | `#362C58` → `#EAE9EC` (color-mix) | **10.49** | PASS |
| Badge/Banner info | dark | `#7DD3FC` → `#082F49` | **8.32** | PASS |
| Badge/Banner success | dark | `#22C55E` → `#052E16` | **6.54** | PASS |
| Badge/Banner warning | dark | `#F59E0B` → `#422006` | **6.79** | PASS |
| Badge/Banner critical | dark | `#FCA5A5` → `#451A1A` | **7.82** | PASS |
| Badge default, admin surface (`tokens.ts:1230-1231`) | dark | `#C9BFED` → `rgb(38,32,64)` | **8.91** | PASS |
| Banner body text, all 4 tones (`feedback.tsx:151`) | light | `#111827` → statusSoft | **14.52–16.15** | PASS |
| Banner body text, all 4 tones | dark | `#FFFFFF` → statusSoft-950 | **13.88–14.91** | PASS |
| Toast title (`feedback.tsx:251`) | light | `#111827` → `#FFFFFF` | **17.74** | PASS |
| Toast description (`feedback.tsx:255`) | light | `#6B7280` → `#FFFFFF` | **4.83** | PASS |
| **InternalStatusPill critical** (`internal-workspace.tsx:167`) | **dark (default)** | `#EF4444` → `#451A1A` | **3.94** | **FAIL** |
| **InternalStatusPill info** (`:168`) | **dark (default)** | `#3B82F6` → `#082F49` | **3.77** | **FAIL** |
| InternalStatusPill success (`:165`) | dark (default) | `#22C55E` → `#052E16` | 6.54 | PASS |
| InternalStatusPill warning (`:166`) | dark (default) | `#F59E0B` → `#422006` | 6.79 | PASS |
| **InternalStatusPill success** | light (selectable) | `#22C55E` → `#DCFCE7` | **2.07** | **FAIL** (below 3:1 floor) |
| **InternalStatusPill warning** | light (selectable) | `#F59E0B` → `#FEF3C7` | **1.93** | **FAIL** (below 3:1 floor) |
| **InternalStatusPill critical** | light (selectable) | `#EF4444` → `#FEE2E2` | **3.08** | **FAIL** |
| **InternalStatusPill info** | light (selectable) | `#3B82F6` → `#E0F2FE` | **3.21** | **FAIL** |
| **Input/Textarea/InlineError error text** (`input.tsx:89,156,169`) | light | `#EF4444` → `#FFFFFF` | **3.76** | **FAIL** |
| Same, on page bg `#F6F7F9` | light | `#EF4444` → `#F6F7F9` | **3.51** | **FAIL** |
| Input error text | dark | `#EF4444` → `#15131f` / `#0a0912` | 4.87 / 5.26 | PASS |
| **MetricCard delta positive** (`productivity.tsx:62`) | light | `#22C55E` → `#FFFFFF` | **2.28** | **FAIL** |
| **MetricCard delta negative** (`:63`) | light | `#EF4444` → `#FFFFFF` | **3.76** | **FAIL** |
| MetricCard delta pos/neg | dark | on `#15131f` | 8.05 / 4.87 | PASS |
| **App-level `text-[var(--lb-color-success)]`** on white | light | `#22C55E` → `#FFFFFF` | **2.28** | **FAIL** |
| **App-level `text-[var(--lb-color-warning)]`** on white | light | `#F59E0B` → `#FFFFFF` | **2.15** | **FAIL** |
| **App-level `text-[var(--lb-color-critical)]`** on white | light | `#EF4444` → `#FFFFFF` | **3.76** | **FAIL** |
| **App-level `text-[var(--lb-color-info)]`** on white | light | `#3B82F6` → `#FFFFFF` | **3.68** | **FAIL** |
| **Button destructive label** (`button.tsx:36`) | light | `#FFFFFF` → `#EF4444` | **3.76** | **FAIL** |
| Button destructive label | dark | `#111827` → `#EF4444` | 4.71 | PASS |
| **Star active** (Tailwind v4 `amber-400`) | n/a | `#FFB900` → `#FFFFFF` | **1.72** | **FAIL** (3:1 floor) |
| **Star inactive** (v4 `gray-200`) | n/a | `#E5E7EB` → `#FFFFFF` | **1.24** | **FAIL** (3:1 floor) |
| **Star active vs inactive** (state distinction) | n/a | `#FFB900` → `#E5E7EB` | **1.39** | **FAIL** |
| **Storefront `text-red-500`** (v4) | light | `#FB2C36` → `#FFFFFF` | **3.82** | **FAIL** |
| **Storefront `text-green-600`** (v4) | light | `#00A63E` → `#FFFFFF` | **3.22** | **FAIL** |
| Badge/Banner borders (`feedback.tsx:35,41,47,53,59`) | light | status-500 → statusSoft | 1.93–3.21 | Not a failure — icon+label carry meaning |

**Root cause of the two big families.** `packages/typescript/ui/src/feedback.tsx:31-62` correctly uses the **statusText 700/800 ramp** (`tokens.ts:289-294`). `packages/typescript/ui/src/internal-workspace.tsx:164-169` uses the **raw 500 ramp** as foreground on the same soft background:

```
success: 'border-[var(--lb-color-success)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]'
```

The correct value already exists in the token file (`green[700] #15803D`, `red[700] #B91C1C`) and is simply not reached by that path. 62 pills are affected — 34 in `platform-console`, 28 in `platform-operations-portal` **[FROZEN]**.

**Scope caveat, stated deliberately.** Both consumers ship **dark by default** — `apps/platform-console/src/app/layout.tsx:43` `<ThemeScript defaultTheme="dark" />` and `:46` `<LetbuyyThemeProvider surface="operations" defaultTheme="dark">`, identical at `apps/platform-operations-portal/src/app/layout.tsx:43,46`. In the default rendering only critical (3.94) and info (3.77) fail. The sub-3:1 figures apply to the user-selectable light theme (`defaultTheme`, not `forcedTheme`, so light **is** reachable). Do not publish "62 pills at 1.93:1".

**Surface identities do not rescue any of this.** `adminSurfaceIdentity` (`tokens.ts:1140-1249`) was scanned in full for `/success|warning|critical|danger|info|banner/` — **zero matches** in either theme. Neither platform-console nor platform-operations-portal `globals.css` declares any `--lb-color-{success,warning,critical,info}[-soft]` or `--lb-component-banner-*`. **Every status contrast figure above is surface-invariant and theme-only.**

**Tailwind arbitrary-value trap — now CONFIRMED, previously UNPROVEN.** Compiled against the repo's own `tailwindcss@4.3.0`: `text-[var(--lb-font-size-caption)]` emits `color: var(--lb-font-size-caption)`, not a font-size. Separately, `tailwind-merge@3.4.1` (via `cx`, `packages/typescript/ui/src/utils.ts`) classifies it in the text-**color** group and drops it in favour of the later `text-[var(--lb-color-success)]` from `toneClass`. Two consequences: (a) the tone colour **is** applied, so every InternalStatusPill contrast number above is valid; (b) InternalStatusPill ships with **no font-size class at all** and inherits. `internal-workspace.tsx` is the only file in the package that writes hint-less `text-[var(...)]` — 41 occurrences, zero `text-[length:` / `text-[color:` — against `feedback.tsx` 12/15/0, `controls.tsx` 33/43/0, `primitives.tsx` 20/28/0, `layout.tsx` 13/31/0.

### 16.4 Silent states and missing wiring

| Gap | Primitive | App consequence |
|---|---|---|
| No `aria-busy` anywhere in the package | `grep -rn "aria-busy" packages/typescript/ui/src` → **0** | All 17 `aria-busy` occurrences in the repo are hand-rolled app-side |
| Skeleton is `aria-hidden` on all three variants | `feedback.tsx:294, :306, :313` | 69 files use `<Skeleton`; only **5** contain `aria-busy` anywhere. 131 usages vs 17 total `aria-busy`. Loading is silent, then content swaps silently |
| Button `loading` has no `aria-busy` and no sr-only text | `button.tsx:77-79` (spinner is `aria-hidden`) | 33 of ~40 `loading=` sites keep a static label, so the accessible name is identical before and during the request |
| `Table` has no `aria-sort` | `grep -rn "aria-sort" packages/typescript/ui/src` → **0** | `SortIcon` (`table.tsx:84-89`) returns `null` when inactive: no visible affordance, no announced sort state until after the first click |
| `Table` loading/empty are silent | `table.tsx:342-353` | No `aria-busy`, no `role="status"` on the empty cell |

The one correct skeleton pattern in the repo lives in a **[FROZEN]** app: `apps/app-marketplace/src/components/MarketplaceSkeleton.tsx:19` — `<div className="marketplace-skeleton-page" aria-busy="true" aria-live="polite">`. It was never promoted into `@letbuyy/ui`.

**A6 — SaveBar's invisible focus trap.** `feedback.tsx:569` toggles only `isSaved ? 'opacity-0 pointer-events-none' : 'opacity-100'`. Neither utility removes an element from the tab order, and both buttons are `disabled={state === 'saving'}` (`:585`, `:594`) — i.e. **enabled** when saved. Callers mount it unconditionally (`apps/merchant-control-plane/src/app/[store]/products/inventory/page.tsx:373-378`, `.../products/gift-cards/page.tsx:596-601`). Compounding it, `feedback.tsx:577` is `{state === 'saving' ? 'Saving changes' : 'Unsaved changes'}` — there is **no `saved` branch**, so a successful save produces no confirmation and leaves the literal string "Unsaved changes" inside the `aria-live="polite"` region declared at `:572`. 21 SaveBar surfaces. WCAG 2.4.11 + 4.1.3.

**A8 — the primitive is correct, adoption is not.** `input.tsx:33-37` derives `errorId`/`helperId`/`describedBy` and applies `aria-describedby` + `aria-invalid` on both the `unstyled` (`:42-44`) and styled (`:66-68`) branches; `Textarea` mirrors it (`:118-121, :127-128, :143-145`). But it is gated on the caller passing `error=`, and only ~17 of 552 `<Input` sites do. Counter-example proving the gap: `apps/merchant-control-plane/src/app/[store]/settings/shipping/page.tsx:575` renders the form error as a detached `<p className="... text-[var(--lb-color-critical)]">{addRateForm.error}</p>` with no id, no back-reference, no `aria-invalid`, no role.

Repo-wide totals: **31** `aria-invalid` and **28** `aria-describedby` occurrences across all apps, against 663 form-control usages.

| App | form controls | `aria-invalid` | `aria-describedby` | `error=` prop |
|---|---|---|---|---|
| merchant-control-plane | 299 | 17 | 17 | 13 |
| marketing-site | 46 | 8 (all in ContactForm) | 10 (all in ContactForm) | 3 |
| identity-platform | 16 | 1 | 1 | 2 |
| storefront-runtime | 46 | **0** | **0** | **0** |
| platform-console | 96 | **0** | **0** | **0** |
| app-marketplace **[FROZEN]** | 53 | 0 | 0 | 0 |
| theme-marketplace **[FROZEN]** | 105 | 0 | 0 | 0 |
| platform-operations-portal **[FROZEN]** | 52 | 0 | 0 | 0 |
| developer-portal **[FROZEN]** | 2 | 0 | 0 | 0 |

**Focus management.** Exactly one form in the monorepo focuses the first invalid field: `apps/marketing-site/src/components/contact/ContactForm.tsx:304-323` `focusFirstError`, resolving `FIELD_ORDER` (`:172-182`) against `FIELD_CONTROL_IDS` (`:160-170`), called at `:328` and `:343`. Every other `.focus()` in `apps/` is a search box, a modal trap, an OTP hop or a roving tabindex. That file lives in the one app the design-system ratchet **exiles** (`scripts/validators/design-system-baseline.json` → `exiledApps: ["apps/marketing-site"]`) — governance did not produce the good form.

**Storefront checkout — the highest-value shopper flow, zero wiring.** `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`: `htmlFor` = 0, `aria-invalid` = 0, `aria-describedby` = 0, `aria-live` = 0 across 1160 lines. All seven delivery labels (`:720, :734, :751, :766, :782, :793, :804`) are plain `<label className="...">` siblings of the `<Input unstyled>` (`:721-730`) — neither `htmlFor`-linked nor nested, so the fields' only accessible name is the placeholder. Errors are `<p className="text-red-500 text-xs mt-1">` at `:731, :746, :762, :777, :790, :801, :815`. `validateForm` (`:313-325`) sets all seven in one `setState` with no focus move. The single announced element is `role="alert"` at `:637` saying "Complete the highlighted delivery fields before continuing" — unactionable for a screen-reader user, because nothing is "highlighted" to them.

**A9 — reduced motion.** `tokens.ts:1606-1617` correctly zeroes `--lb-motion-fast|hover|menu|carousel|normal|slow` and kills `[data-lb-empty-float]` under `prefers-reduced-motion: reduce`, so `ProgressBar`'s `transition-[width]` (`primitives.tsx:463`) and the EmptyState float keyframes are covered. It does **not** touch `.animate-spin`, which is Tailwind's own `animation: spin 1s linear infinite` and reads `--animate-spin`, not `--lb-motion-*`. All three spinner sites use the bare utility: `button.tsx:78`, `feedback.tsx:576`, `primitives.tsx:637`. No app overrides it — `grep -rn "animate-spin|animate-pulse" apps/*/src/app/globals.css` returns nothing. Repo-wide there are 6 `motion-reduce:`/`motion-safe:` hits and all are `transition-none`/hover. Separately, `apps/identity-platform/src/app/globals.css` has **zero** `prefers-reduced-motion` rules (vs merchant-control-plane 7), so `errorShakeIn` (`:511`, keyframe `:519-529`, translateX −6px→+4px) shakes the login error box for users who asked for reduced motion — WCAG 2.3.3.

**A15 — the ops console announces nothing.** `apps/platform-console/src/components/ConsoleDataTable.tsx:144-151` is a plain `<section>` with an `<h2>` — no `role="alert"`, no `role="status"`, no `aria-live` — used at **35** sites. `grep -rn 'role="alert"\|aria-live=' apps/platform-console/src` returns **0 app-authored occurrences across the entire app**. Same zero for platform-operations-portal, developer-portal and theme-marketplace **[FROZEN]**. (merchant-control-plane 53, app-marketplace 19, identity-platform 9, storefront-runtime 8, marketing-site 7.) *Corrected from an earlier draft: the panel's 1.93:1 heading figure is **light-theme only**; in the app's default dark theme the same pair is 6.79:1 and passes. The missing live region is the durable finding.*

**A17/A18 — target sizes.** merchant-control-plane mounts `<LetbuyyThemeProvider surface="admin" forcedTheme="light">` with no `density` prop (`apps/merchant-control-plane/src/app/layout.tsx:46`), inheriting `density = 'compact'` (`theme-provider.tsx:111`) — the smallest scale. No app CSS overrides the density tokens.

| Control | Class | Resolved (compact / comfortable / spacious) | Verdict |
|---|---|---|---|
| Toast dismiss (`feedback.tsx:263`) | `h-[var(--lb-size-control-sm)]` | 32 / 36 / 40 px | Passes 2.5.8 (24px); fails 44pt platform floor |
| Modal close (`overlays.tsx:477`) | same | 32 / 36 / 40 px | same |
| Drawer close (`overlays.tsx:187`) | `size="icon"` → `button.tsx:43` | 32 / 36 / 40 px | same |
| SaveBar Save + Discard (`feedback.tsx:583, :592`) | `h-[var(--lb-size-control-sm)]` | 32 px | same — and these are the primary commit/abandon controls on 21 surfaces |
| Table filter chip (`table.tsx:196`) | `Badge` `min-h-[var(--lb-density-pill-height)]` | 28 px | 28px **and** a non-focusable `<span>` |
| Product status select (`products/page.tsx:299-311`) | invisible `<select>` over a Badge | 28 px | mutates product status from a 28px target |
| **FilterChips remove** (`primitives.tsx:412`) | `h-[var(--lb-density-table-icon-size)]` | **14 / 14 / 16 px** | **FAILS WCAG 2.2 AA SC 2.5.8** — latent (0 app consumers) |

Contrast that with `apps/storefront-runtime`, which hand-rolls `min-h-11` (44px) **37 times** (e.g. `checkout-client.tsx:727, :742, :758, :787, :798, :812, :822`) precisely because the shopper flow is mobile-first. `apps/merchant-control-plane` uses `min-h-11` exactly **once**. The merchant admin takes whatever `@letbuyy/ui` gives it, and `@letbuyy/ui` gives it 28–32px.

**A19.** `apps/merchant-control-plane/src/app/[store]/dashboard/DashboardClient.tsx:330-337` marks completion with an `aria-hidden` check chip plus the CSS class `activation-card--done` (`:322`) — both invisible to AT. The only other differentiator is `:343` `{item.complete ? (item.detail ?? item.description) : item.description}`, which is identical when `item.detail` is undefined. The sibling checklist in the same file at `:540-548` **does** emit a textual `Done` pill, proving drift rather than policy.

### 16.5 What is correct (do not regress)

- **Dialog focus management is genuinely strong.** `overlay-hooks.ts:80-145` captures `previouslyFocused` (`:94`), applies `setOutsideTreeInert` (`:95`), focuses the first focusable (`:102`), wraps Tab at both boundaries (`:104-128`) and restores focus on cleanup (`:142`). Escape + outside-pointerdown via `useDismiss` (`:220-246`); reference-counted scroll lock (`:167-202`). Covered by `tests/components/foundation.test.tsx:337-346`.
- `Spinner` (`primitives.tsx:634-641`) is the best a11y in the package: `role="status"` + `aria-label` + `sr-only` label + `aria-hidden` glyph.
- `Chart`'s no-data state (`primitives.tsx:69-77`) is the **only** empty state in the package with `role="status"`; the populated chart is `role="img"` + `aria-labelledby` + an `sr-only <dl>` of every datum (`:150-161`).
- `InlineError` (`input.tsx:166-176`) is the only error primitive with `role="alert"` — and it has **zero app consumers** (see §19.2).
- `SaveBar`'s `aria-live="polite"` wrapper (`feedback.tsx:572`) is the only correctly announced pending state in the product.
- `apps/identity-platform` auth errors are the strongest app-level pattern: `login/page.tsx:245, :332` and `signup/page.tsx:523, :596` use `role="alert" aria-live="assertive"` on newly inserted nodes.
- `packages/typescript/ui/tests/components/foundation.test.tsx:176-209, :248-249` asserts `aria-invalid === 'true'`, unique per-instance ids, and that the described-by target's `textContent` equals the error string. **The primitives behave correctly; apps route around them via `unstyled` (821 sites).**

---

## 17. Responsive / Mobile Findings

Mobile-first target per `CLAUDE.md` is ~360px, India-first.

| # | Sev | Finding | Anchor |
|---|-----|---------|--------|
| R1 | S1 | `SaveBar` overflows its column on 19 non-settings pages from 640px to 1172px | `feedback.tsx:568` |
| R2 | S1 | Storefront checkout bypasses the feedback system entirely and is silent to AT | `checkout-client.tsx:313-325, :731-815` |
| R3 | S1 | Table mobile card's unconditional `grid-cols-2` clips order actions | `table.tsx:284` + `orders/page.tsx:744` |
| R4 | S1 | No safe-area insets on the SaveBar — home indicator covers Save/Discard | `env(safe-area-inset` = 0 in merchant-control-plane |
| R5 | S2 | Banner never stacks or wraps its action | `feedback.tsx:155` |
| R6 | S2 | Toast stack is unbounded and blocks input | `feedback.tsx:207-215, :227` |
| R7 | S2 | ConfirmDialog puts the destructive button **above** Cancel on mobile | `overlays.tsx:486` + `:526-533` |
| R8 | S2 | Product status is editable on desktop, read-only on mobile | `products/page.tsx:299-311` vs `:314-317` |
| R9 | S2 | Status badges are buried in the mobile card's `<dl>` | `table.tsx:280, :283-296` |
| R10 | S3 | SaveBar's below-640px "full bleed" is fake | `feedback.tsx:568` + `layout.tsx:406` |
| R11 | S3 | Badge status icon has no `shrink-0` where its siblings do | `feedback.tsx:83` vs `:142` / `input.tsx:173` |
| R12 | S3 | `column.truncate` is silently desktop-only | `table.tsx:375, :383-384` vs `:167-168` |
| R13 | S3 | Modal's content region lacks the growth classes Drawer's has | `overlays.tsx:485` vs `:192` |
| R14 | S3 | EmptyState has no responsive breakpoints and its measure cap is inert at 360px | `feedback.tsx:492-544` |
| R15 | S3 / latent | Drawer bottom/full variants use `100vh`, not `100dvh` | `overlays.tsx:116-133` |
| R16 | S3 / **[FROZEN]** | theme-marketplace toasts render behind its fixed header | `layout.tsx:139` + `header.css:108-113` |

### R1 — SaveBar is the only `100vw` in the package on a flow-positioned element

`packages/typescript/ui/src/feedback.tsx:568`:

```
sm:w-[min(var(--lb-size-save-bar-width),calc(100vw-var(--lb-space-6)))]
```

Every other `100vw` in `@letbuyy/ui` (`overlays.tsx:113,114,119,120,125,126,253,456`; `feedback.tsx:227`) sits on a **fixed or portaled** overlay, where viewport-relative is correct. A `sticky` element is laid out inside its containing block, so `100vw` is structurally wrong there.

The fix exists and is documented — `apps/merchant-control-plane/src/app/globals.css:2850-2859` diagnoses the exact failure in a 10-line comment ("*the card's `overflow:hidden` clipped the Save button off, and because `overflow-x` computes to `auto` whenever `overflow-y` is, the overflow also forced a horizontal scrollbar*") and re-points the token with `--lb-size-save-bar-width: 100%;`. But it is scoped to `.settings-content > main` only. Its own comment says "*Seven settings pages render one*" — there are **21** `<SaveBar` sites repo-wide.

Math (compact: `--lb-density-card-padding` 16px, `--lb-space-6` 24px, `saveBarWidth` 920px at `tokens.ts:847`), against `<Page>` (`layout.tsx:402-414`) inside `AppFrame`'s `<main className="min-w-0 flex-1 overflow-auto ...">` (`app-shell.tsx:415`) with a 220px rail (`app-shell.tsx:325`, static at `lg`):

| Viewport | Page content box | SaveBar width | Overflow |
|---|---|---|---|
| 640 ≤ W < 944 (rail is an overlay) | W − 32 | min(920, W−24) = W−24 | **8px at every tablet width** |
| 1024 ≤ W < 1172 (rail static) | W − 252 | 920 | **148px at 1024px** |

`mx-auto` cannot rescue an over-wide child (auto margins resolve to 0), so the bar overflows **right** — putting the Save button, the rightmost control, off-column. `.admin-page-scroll` also carries `scrollbar-gutter: stable` (`globals.css:623`), narrowing the column further. Affected (all direct children of `<Page>`): `products/new:1291`, `coupons:578`, `categories:465`, `posts:557`, `products/gift-cards:596`, `products/collections:470`, `products/inventory:373`, `appearance:455`, `experience:478`, `projects:470`, `education:474`, `certifications:484`, `skills:448`, `testimonials:460`, `pages:505`, `online-store/pages:812`, `online-store/preferences:325`, `online-store/themes/[themeId]/editor:1531`, `export:471`.

### R4 — no safe-area insets where it matters

`env(safe-area-inset-*)` appears **7 times in the entire repo** and **zero times in merchant-control-plane**, the only app that renders a SaveBar:

| File:line | App |
|---|---|
| `apps/app-marketplace/src/app/globals.css:819` | **[FROZEN]** |
| `apps/marketing-site/src/app/globals.css:5142` | active (exiled from ratchet) |
| `apps/marketing-site/src/app/globals.css:13189` | active (exiled) |
| `apps/developer-portal/src/app/globals.css:987` | **[FROZEN]** |
| `apps/identity-platform/src/app/globals.css:74` | active |
| `apps/identity-platform/src/app/globals.css:75` | active |
| `apps/theme-marketplace/src/app/header.css:1301` | **[FROZEN]** |

The shell is `h-[100dvh]` (`app-shell.tsx:400`), so at `bottom-0` with `p-[var(--lb-space-3)]` (12px) the 32px buttons occupy the band 12–44px above the dvh floor; an iPhone home indicator (~34px) covers roughly two thirds of Save and Discard.

### R3 — the mobile card grid clips destructive actions

`packages/typescript/ui/src/table.tsx:262` gives the card `px-[var(--lb-space-4)]` (16px each side); `:284` renders every column after the first into `<dl className="m-0 grid grid-cols-2 gap-x-[var(--lb-space-4)] ...">` — **unconditional `grid-cols-2`, no 1-col fallback at 320px**. Column width: 360 → (360−32−16)/2 = **156px**; 320 → **136px**.

`apps/merchant-control-plane/src/app/[store]/orders/page.tsx:744` declares `<div className="flex min-w-[calc(var(--lb-size-control-lg)*4)] flex-col items-end ...">`. `--lb-size-control-lg` → `--lb-density-button-height-large` (`tokens.ts:839`) = 40px compact → **min-width 160px**. Tailwind's `grid-cols-2` is `repeat(2, minmax(0,1fr))`, so the track stays 156/136px while the child refuses to shrink: **4px overflow at 360px, 24px at 320px**, then hard-clipped by the Table root's `overflow-hidden` (`table.tsx:171`). With `items-end justify-end`, the clipped element is the rightmost button — **Cancel or Refund**. The inline refund/fulfil forms (`orders/page.tsx:777-800`) render inside that same 160px column.

Badge itself has **no truncation** (`feedback.tsx:75`: no `whitespace-nowrap`, no `truncate`, no `max-w`), so long labels **wrap into two-line stadium pills** with `rounded-full` corners cutting into the text. Real label that exceeds the column: `orders/page.tsx:167-169` builds `` `${method.toUpperCase()} / ${titleize(status)}` `` → "RAZORPAY / Partially Refunded" ≈ 218px against a 156px track, and `orders/page.tsx:530-545` declares no `cardLabel`/`cardRender`.

### R5 — Banner is the only feedback primitive that never stacks

`feedback.tsx:155` — `{action && <div className="shrink-0">{action}</div>}`. No `flex-wrap`, no `flex-col`, no `sm:` breakpoint. Its three siblings all do stack:

| Primitive | Class | Behaviour |
|---|---|---|
| EmptyState actions | `feedback.tsx:537` `flex flex-wrap justify-center` | wraps |
| SaveBar actions | `feedback.tsx:568` `flex-col items-stretch ... sm:flex-row` | stacks |
| Modal footer | `overlays.tsx:487` `flex flex-col-reverse ... [&>button]:w-full sm:flex-row` | stacks |
| **Banner action** | `feedback.tsx:155` `shrink-0` | **never stacks** |

Worst production case: `apps/merchant-control-plane/src/app/[store]/settings/users/page.tsx:307-311` — `<Banner variant="warning" title="You've reached your staff limit" action={<Button>Upgrade plan</Button>}>`. At 360px inside `.settings-content > main` (16px mobile padding, `globals.css:2954-2957`): 328px box → 296px inner → minus icon 16 + gap 12 + gap 12 + a ~113px button leaves **~143px** for a 30-character title plus a two-sentence body. The button then breaks too: `Button` has no `whitespace-nowrap` and a fixed `h-[var(--lb-density-button-height)]` = 36px (`button.tsx:41, :67`), so the compressed label wraps to two lines and overflows its own rounded box. The other 40 action-Banners survive only because their label is the 5-character "Retry".

### R6 — the toast stack is unbounded and intercepts taps

`feedback.tsx:207-215` — `notify` appends with no cap, no dedupe, no queue drain. `feedback.tsx:227` — the container has **no max-height, no overflow, no `pointer-events-none`**. Card height: `p-[var(--lb-density-card-padding)]` 16×2 + a 32px dismiss button ≥ 64px title-only; with a description the text column is 20+16=36px → 68px; gap 12px.

merchant-control-plane's offset is **correct** and is the only app that sets the documented hook — `globals.css:92` `--lb-toast-offset-block-start: calc(var(--admin-header-height) + var(--lb-space-3))`, and critically the ≤768px header override is on `:root` (`globals.css:5685-5694`, 72px), so the derived value re-substitutes to 84px against a 72px header. (Had that override been scoped to `.admin-shell`, custom-property substitution would have frozen the desktop 64px and the toast would have landed inside the mobile header.) From 84px on a 360×640 device: 3 toasts reach 312px, **5 reach 472px, 7 reach 632px** — the full 336px-wide column blocks taps for the 5000ms default (`feedback.tsx:200`), gaps included. Structural rather than currently triggered: no `duration: null` and no per-item `notify` loop exists today.

### R7 — the destructive button is the first mobile thumb target

`overlays.tsx:486` gives the Modal footer `flex flex-col-reverse ... [&>button]:w-full sm:flex-row sm:[&>button]:w-auto`. ConfirmDialog's DOM order is Cancel then Confirm (`overlays.tsx:526-533`), so `flex-col-reverse` renders the **full-width destructive confirm on top** with Cancel below it on <640px. All 31 ConfirmDialog sites inherit this.

### R8 — a functional parity gap, not just a sizing one

`apps/merchant-control-plane/src/app/[store]/products/page.tsx:299-311` renders an invisible `<select className="absolute inset-0 h-full w-full ... opacity-0">` over the status Badge, so status is editable on desktop from a 28px target. `cardRender` at `:314-317` returns a bare `<Badge>` with **no select** — status is read-only in the mobile card list. (The select **is** `disabled={updatingStatusId === product.id}` at `:301`, so this is a parity finding only, not a double-submit site.)

### R14 — EmptyState is density-driven, never viewport-driven

`feedback.tsx:492-544` contains not a single `sm:`/`md:`/`lg:`. Sizing comes from density, which is an app preference defaulting to `compact` (`theme-provider.tsx:111`). At compact the illustration is a hard 160×108px (`tokens.ts:581-584`) and `--lb-size-empty-state-measure` is `440px` (`tokens.ts:846`) — **wider than a 360px viewport, so the measure cap is a no-op on mobile**. Contrast `InternalWorkspace`, which does adapt: `sm:px-[var(--lb-space-5)] lg:px-[var(--lb-space-6)]` (`internal-workspace.tsx:15`).

### What is correct

Modal's mobile behaviour is the best in the system — full-bleed sheet below `sm` (`overlays.tsx:456` `h-full max-h-none w-full ... rounded-none border-0`), 640px centred card above, stacked full-width footer buttons. Toast width math is safe: `min(380px, 100vw − 24px)` = 336px at 360px, fitting with an asymmetric 4px/20px gutter for `top-right` and symmetric 12px for centre placements.

---

## 18. Message / Copy Consistency

### 18.1 Governance: nothing measures copy

`scripts/validators/design-system-baseline.json` ratchets ten metrics — `appCssRawHex`, `appCssNakedRgbHsl`, `tailwindPaletteClasses`, `appLocalLbTokenRedefs`, `rawPxFontSize`, `rawPxSpacing`, `tsxInlineStyles`, `tsxRawHex`, `tsxArbitraryRadius`, `tsxArbitraryShadow` — every one of them visual. `ls scripts/validators/ | grep -iE "copy|content|wording|microcopy"` returns nothing. Root `AGENTS.md` UI-R1..UI-R7 constrain tokens, shell, states, WCAG, icons, the honesty badge and the drift ratchet — **none constrains wording**. The only microcopy law in the chain is `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_UI_UX_GOVERNANCE.md:361` ("*Docs-grade, honest microcopy — error states say what happened and what to do*") plus `:461` UX-R5 ("*Every fetch/mutation failure MUST render error-with-retry*"). Both are widely unmet and neither has a validator.

### 18.2 Error descriptions are not authored

Of **154** `variant: 'critical'` toasts, only **7** carry an authored literal description; **143** pass a runtime variable and **4** have no description at all. So in **93%** of merchant error toasts the "what happened / what to do next" text is whatever the API returned.

Mechanism: `apps/merchant-control-plane/src/lib/api/client.ts:115-128` (`merchantApiErrorResponse`) forwards `error.body` unchanged, and **53 local error-extractor functions** across `apps/` read `payload.error.message` straight into the toast. **25 of them are byte-identical copy-paste** (whitespace-normalised md5 `3c245be7`) — `apps/merchant-control-plane/src/app/[store]/{customers:41, experience:60, comments:47, contact:37, posts:75, testimonials:67, appearance:73, leads:58, gallery:40, projects:56, education:60, coupons:64, ai:91, marketing:90, certifications:57, skills:47, orders:81, export:68, pages:52, categories:53, reviews:55}/page.tsx` plus `products/gift-cards:59`, `products/inventory:12`, `products/collections:43`, `online-store/preferences:61`. Every clone extracts `message` and **discards `error.code` and the HTTP status** — the structural reason status-specific handling is statistically absent (§20.4).

Gateway strings that reach merchants verbatim on that path include *"An idempotency key is required for this mutation."*, *"A store context is required for this mutation."*, *"App token store does not match the requested store_id"* and *"An internal error occurred"*. `merchantApiErrorResponse`'s own default is the HTTP-ism `'Internal server error'` (`client.ts:115`).

**Corrected from an earlier draft:** the binding-less `catch` on the refund (`orders/page.tsx:416-419`) and payout (`payouts/page.tsx:117-120`) paths does **not** discard a gateway-supplied actionable message — those branches are only reachable when there is no server payload (the HTTP-error branches already extract it at `orders/page.tsx:405-409` and `payouts/page.tsx:107-112`, and the body parse is `await response.json().catch(() => null)` so it cannot throw). The real, smaller defect is that an **offline** failure reads "Unable to process refund" instead of naming the connection problem.

### 18.3 Bare / uninformative error copy

| Pattern | Sites |
|---|---|
| `title: 'Error'` (toast) | `products/inventory-history/page.tsx:213`, `products/receipts/page.tsx:131`, `products/reservations/page.tsx:166`, `settings/notifications/page.tsx:385` |
| …of which **omit `variant` entirely** | the first three — `feedback.tsx:236` defaults `toast.variant ?? 'info'` and `:245` sets `role={variant === 'critical' ? 'alert' : 'status'}`, so a hard failure renders with the blue Info icon and `role="status"` |
| `<Banner title="Error">` | `products/purchase-orders/page.tsx:229, :454`; `products/suppliers/page.tsx:142`; `products/transfers/page.tsx:240, :411, :532`; `products/locations/page.tsx:138`; `products/smart-collections/page.tsx:335` |
| `<Banner variant="critical" title="Failed to load">` with no object | `products/smart-collections/page.tsx:499` |
| "Something went wrong" with **no next step** | `identity-platform/signup/page.tsx:278, :451`; `identity-platform/onboarding/page.tsx:323`; `merchant-control-plane/.../access_account/checkout/checkout/CheckoutClient.tsx:356` (the merchant subscription checkout) |
| "Something went wrong. Please try again." (with next step) | 19 further sites, e.g. `storefront-runtime/.../orders/orders-client.tsx:84, :116`; `identity-platform/login/page.tsx:147, :188` |
| Raw error as the toast **title** | `components/theme-locale/TranslationValueEditor.tsx:134` — `toast.notify({ title: message, variant: 'critical' })` where `message` (`:133`) is `err.message`, built at `:115-117` as `` body?.message || `Failed to save translation (${res.status})` ``. The heading reads "Failed to save translation (500)". Its own success sibling at `:121` is a proper "Translation saved". |

Contrast within one directory: `apps/merchant-control-plane/src/app/[store]/categories/page.tsx:290-292` renders `<Banner title="Categories could not load" action={<Button variant="secondary" onClick={...}>Retry</Button>}>` while `products/purchase-orders/page.tsx:581` renders `<Banner variant="critical" title="Failed to load purchase orders">{loadError}</Banner>` — same failure class, no retry, no next step.

### 18.4 Grammar and shape conflicts

| Concept | Form A | Form B | Conflict |
|---|---|---|---|
| Load failure | `'<Noun> could not load'` — 38 sites, e.g. `categories/page.tsx:111` | `'Could not load <noun>'` — `products/collections/page.tsx:239`, `settings/general/page.tsx:254`, `settings/business/page.tsx:257`, `products/gift-cards/page.tsx:300`, `components/domains/DomainDetailView.tsx:80` | inverted grammar, same event |
| Load failure (3rd) | — | `'Failed to load <noun>'` — 9 Banner sites, **all** under `products/` (`receipts:239`, `purchase-orders:581`, `suppliers:263`, `reservations:274`, `transfers:689`, `inventory-history:399`, `locations:265`, `operations-dashboard:160`, `smart-collections:499`) | one sub-tree written in a different voice |
| Save failure | `'Could not <verb> <noun>'` — 74 sites | `'<Noun> failed'` — 32 sites; `'<Noun> could not be <verbed>'` — `settings/shipping:239`, `settings/taxes:286`; `'<Noun> not <verbed>'` — `customers/[email]/page.tsx:428, :435` | four competing forms |
| Theme publish failure | `online-store/themes/[themeId]/editor/page.tsx:1119` "Theme publish failed" | `components/theme-library/ThemeLibraryWorkspace.tsx:179` "Publish failed" | same operation, two titles |
| Validation | `'<Noun> is required'` — `products/new:577`, `products/collections:159`, `online-store/pages:249, :329`, `products/gift-cards:187` | `'<Noun> needs a <field>'` — `settings/taxes:265, :276`, `settings/shipping:229`, `export:310` | two idioms |
| Clipboard success | `parts.tsx:61` "Copied" | `products/gift-cards:245` "Code copied" · `customers/page.tsx:241` "Email addresses copied" | three title shapes |
| Clipboard failure tone | `customers/page.tsx:248` `variant:'critical'` | `products/gift-cards:247` and `parts.tsx:63` `variant:'warning'` | same event, red vs amber |
| Locale mutations, one file | `settings/general/page.tsx:368` "Language added" `success` | `:388` published/hidden `info`, `:403` removed `info` | four siblings, two tones, arbitrary |
| Marked-as | `products/transfers/page.tsx:381` "Transfer marked as shipped" | `contact/page.tsx:136` "Submission marked read" | "marked as X" vs "marked X" |
| Singular/plural, one file | `settings/payments/page.tsx:170` "…payment setting" | `:276` "…payment settings" | same object |
| Bare-verb titles | `customers/[email]/page.tsx:595` "Refreshed" · `DomainDetailView.tsx:92` "Re-checked" | `settings/business/page.tsx:372` "Status refreshed" | same "poll a status" action |

**Punctuation.** 1 of 300 toast titles ends in terminal punctuation — `products/smart-collections/page.tsx:249` uses a full sentence with a period **as a title**, and `:305` emits "Collection updated." / "Collection created." with periods, against the sibling `products/collections/page.tsx:185` "Collection created" (no period). 58 of 60 literal descriptions end in a period; the two exceptions are `marketing/page.tsx:397` and `components/domains/parts.tsx:61`.

**Ellipsis — three conventions for one busy state.** ASCII `'Deleting...'` at 14 ConfirmDialog sites (`categories:477`, `certifications:497`, `comments:402`, `contact:423`, `coupons:590`, `education:487`, `experience:491`, `gallery:349`, `leads:425`, `pages:517`, `projects:483`, `reviews:491`, `skills:461`, `testimonials:473`); Unicode `'Deleting…'` at `settings/general:809`; **no ellipsis** `'Deleting'` at `settings/shipping:611` and `settings/taxes:668`. Same three-way split on "Saving" and "Uploading" — and three sibling files in **one directory** disagree: `theme-editor/controls/ImagePickerControl.tsx:177` `'Uploading...'`, `controls/VideoControl.tsx:138` `'Uploading…'`, `controls/MediaLibrary.tsx:514` `'Uploading…'`.

### 18.5 Duplicate feedback: the same string in two surfaces at once

**93 catch blocks** fire a toast **and** set a persistent error surface with the identical string. Byte-identical example — `apps/merchant-control-plane/src/app/[store]/settings/shipping/page.tsx:175-181` calls `setLoadError(message)` **and** `notify({title:'Shipping settings could not load', description: message})`, and `:416-424` renders `<Banner variant="critical" title="Shipping settings could not load">{loadError}</Banner>`: **same title, same body, two surfaces, simultaneously**.

Worse, the two surfaces can disagree on tone and heading:

- `settings/shipping/page.tsx:226-233` — `setFormError('Enter a shipping zone name.')` renders as `<Banner variant="critical" title="Shipping zone needs attention">` (`:426-430`) while the toast for the same event is `variant:'warning'`.
- `products/new/page.tsx:573-580` — one empty input produces **three different headings**: the Banner "Product needs attention" (`:771`), the toast "Product title is required" (`:576`), and the field itself unmarked.
- `products/new/page.tsx:661-663` — `setSuccess('Product saved')` renders as `<Banner variant="success" title="Saved">Product saved</Banner>` (`:777`) **while** `notify({title:'Product saved', ...})` fires. Two headings for one event.

There is no third (inline) layer, because `InlineError` has zero app usages — so every validation failure is escalated from the field to a page Banner **and** a global toast.

### 18.6 India-first and localisation

| Issue | Evidence |
|---|---|
| **9 en-US date sites, all in the merchant plane** | `packages/typescript/ui/src/formatting.ts` exports both `formatIndiaDate` (en-IN, `:97`) and `formatUsShortDate`/`formatUsLongDate` (en-US, `:108`/`:120`). 78 en-IN usages vs 15 en-US across `apps/`; all 9 merchant-facing en-US sites are `settings/billing/page.tsx:200` (invoice Date column), `:254`, `:322` (trial-end), `online-store/pages/page.tsx:470, :528` (Updated), `settings/users/page.tsx:390` (Added), `components/domains/DomainDetailView.tsx:195, :287, :319` |
| Two sibling settings pages disagree directly | `settings/security/page.tsx:190` "Enrolled {en-IN}" vs `settings/users/page.tsx:390` "Added {en-US}" |
| Identity security emails: en-US, no timezone | `apps/identity-platform/src/lib/email/resend.ts:306, :355` — `toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })` |
| Two timestamps with **no locale at all** | `online-store/themes/[themeId]/editor/page.tsx:685, :1635` |
| GSTIN described two ways, one wrong | `access_account/checkout/checkout/CheckoutClient.tsx:547` `placeholder="15-digit GSTIN (optional)"` vs `settings/business/page.tsx:494` `helperText="15-character GST identification number."` — GSTIN is alphanumeric; the app's own example is `22ABCDE1234F1Z5` (`settings/billing/profile/page.tsx:112`) |
| Localised copy leaves English jargon inline | `identity-platform/set-password/page.tsx:45` (hi) and `:64` (ta) both embed untranslated "merchant workspace" |
| Native browser validation in the wrong locale | 75 bare `required` attributes across `apps/`, **zero** `noValidate` on any form — so `identity-platform/login/page.tsx:241` fires a browser-chrome bubble in the *browser's* locale on a page that is explicitly trilingual (`translations`, `:16-74`) |

INR handling is otherwise sound — `formatInrCurrency`, `en-IN` number formatting, and `` `Pay ₹{totalAmount.toLocaleString('en-IN')}` `` (`checkout-client.tsx:1032`). The one currency outlier is `apps/storefront-runtime/src/components/sections/marquee.tsx:7` "Free Shipping on all orders over INR 999" (Title Case + "INR" instead of ₹). Separately: of 329 `notify()` calls **exactly one** interpolates money (`products/gift-cards/page.tsx:226`) — refund and payout confirmations never state an amount.

### 18.7 Internal jargon shipped to users

**Worst case — a nav-reachable settings route.** `apps/merchant-control-plane/src/components/settings/settings-navigation.ts:169` lists `href: 'custom-data'`, label "Custom data". That route (`apps/merchant-control-plane/src/app/[store]/settings/custom-data/page.tsx:11-21`) renders `BackendNeededPane`, which shows a merchant:

- a warning Banner headed `'[SKIP - NEEDS BACKEND]'` (`BackendNeededPane.tsx:34`)
- Section body "*WS9 is limited to frontend settings architecture, so missing contracts are documented instead of fabricated.*" (`:67`)
- an `EmptyState` whose body is the literal `"[SKIP - NEEDS BACKEND: metafields and metaobjects API]"` (`custom-data/page.tsx:15`)
- **three** info Banners all titled "Required contract detail" (`:77`) containing `` "Required read endpoint: `GET /api/stores/:store/custom-data` …" `` and "*…with tenant-scoped `site_id` ownership checks.*" (`custom-data/page.tsx:17-19`) — backticks render literally

`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_UI_UX_GOVERNANCE.md:171` already cites `[SKIP - NEEDS BACKEND]` screens as a UIUX-007 defect and rules "*no placeholder/`SKIP` screen user-reachable*" — on mobile. The same defect exists on web and is untracked.

| Other jargon leaks | Evidence |
|---|---|
| Shopper checkout trust badge | `checkout-client.tsx:1039` — `{paymentMethod === 'cod' ? 'COD order is confirmed server-side' : 'Secured by Razorpay'}`. "server-side" is the COD shopper's only trust signal |
| "endpoint", "buckets", "field is populated" | `analytics/page.tsx:243-244` |
| "gateway response" on an order page | `orders/[orderId]/page.tsx:459` |
| Attack-vector identifiers in a toast | `appearance/page.tsx:178` interpolates `v.vector` — documented at `CustomCssWorkspace.tsx:75-76` as "*Short machine-readable identifier for the blocked attack vector*", values like `-moz-binding`, `url(data:*javascript*)`, `</style> breakout` (`:153-286`) |
| Byte accounting as merchant copy | `CustomCssWorkspace.tsx:325`, `:336` ("null byte") |
| Third-person leak (talks *about* the merchant *to* the merchant) | `ai/page.tsx:338`; `dashboard/DashboardClient.tsx:670`; and the primitive's own default at `packages/typescript/ui/src/overlays.tsx:536-539` — "This action can affect merchant data. Review it before continuing." |
| Raw DB enum in a toast title | `products/purchase-orders/page.tsx:558` `` `Cannot receive a ${po.status} order` `` — **a `poStatusLabel()` exists at `:57-66` in the same file and is bypassed**. The sibling `products/transfers/page.tsx:653` humanises: `` `Cannot receive a ${transferStatusLabel(transfer.status).toLowerCase()} transfer` `` |
| Email names infrastructure | `identity-platform/src/lib/email/resend.ts:254` title "Database Error"; `:264` builds the subject `Store creation failed - Database Error` |

11+ sites `titleize` raw DB values with a `default: return status` passthrough, so any new enum renders raw: `settings/plan:112`, `settings/billing:165`, `orders:95-100`, `orders/[orderId]:182`, `payouts:50`, `dashboard:316`, `customers:66`, `customers/[email]:191`, `products/purchase-orders:57-66`, `products/transfers:75-84`, `marketing:153-158`.

### 18.8 Destructive-action copy

31 `<ConfirmDialog>` sites (30 merchant-control-plane, 1 app-marketplace **[FROZEN]**); 30 pass `destructive`.

| Reversibility stated | Sites |
|---|---|
| Explicit "cannot be undone" | `certifications:496`, `education:486`, `experience:490`, `leads:424`, `projects:482`, `skills:460`, `testimonials:472`, `contact:422`, `settings/general:808` |
| States the reverse / the window | `DomainDetailView:331` ("You can reconnect it later."), `settings/plan:311`, `online-store/themes/page:570` |
| "Permanently" only, no undo statement | `comments:401`, `gallery:348`, `pages:516` |
| **Neither** | `categories:476`, `coupons:589`, `reviews:488`, `settings/apps/AppsSettingsClient:264`, `settings/shipping:610`, `settings/taxes:667`, `settings/users:517`, `online-store/pages:822`, `posts:568`, `themes/[themeId]/editor:1542, :1552`, `theme-editor/ThemeUpdatePanel:756`, `theme-library/ThemeLibraryWorkspace:578`, `app-marketplace InstalledAppsGrid:416` **[FROZEN]** |

**The highest-stakes dialog is the thinnest.** `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:667-678`: `title="Cancel order?"`, `confirmLabel="Cancel order"`, `destructive` — and **no `cancelLabel`**, so `overlays.tsx:514` supplies the default. The merchant sees a dialog headed "Cancel order?" with buttons **[Cancel]** and **[Cancel order]**, where "Cancel" means *do not cancel*. Nothing states whether the customer is refunded, whether payment is reversed, or whether this is reversible.

Neither the refund nor the payout confirm/success copy names an amount (`orders/page.tsx:411`, `payouts/page.tsx:114`).

Cancel-button copy splits ~15/16: named opt-out ("Keep category", "Keep coupon", … at `categories:478`, `coupons:591`, `leads:426`, `users:519`, `plan:313`, `DomainDetailView:333`, `skills:462`, `projects:485`, `testimonials:474`, `certifications:498`, `education:488`, `experience:492`, `contact:424`) versus bare "Cancel" (`comments:398`, `gallery:345`, `pages:513`, `posts:565`, `reviews:485`, `orders:667`, `settings/apps:261`, `settings/general:805`, `settings/shipping:607`, `settings/taxes:664`, `online-store/pages:819`, editor `:1539, :1549`, `themes/page:567`, `ThemeUpdatePanel:753`, `ThemeLibraryWorkspace:578`).

Two dialogs describe live customer impact well and should be the template: `theme-editor/ThemeUpdatePanel.tsx:756` ("*…make it live immediately. Customers will see the rolled-back version.*") and `online-store/themes/page.tsx:570` ("*Customers will no longer be able to view this storefront until it is published again.*").

### 18.9 Terminology drift

| Concept | Names in use |
|---|---|
| The tenant object | **shop** (`marketing-site/src/components/Header.tsx:157, :207, :219`) · **workspace** (`identity-platform/onboarding/page.tsx:51-52`, `select/page.tsx:15`, `api/email/store-creation-success/route.ts:27`) · **store** (`settings/domains/page.tsx:147`) · **site** (`comments/page.tsx:285`, `posts/page.tsx:368`, `pages/page.tsx:435`) · **storefront** (`settings/domains/page.tsx:117`, `leads/page.tsx:235`) |
| The storefront audience | **Customers** (`online-store/themes/page.tsx:570`) vs **Shoppers** (`components/domains/DomainDetailView.tsx:331`) — identical referent, identical action. Both appear in one sentence at `products/gift-cards/page.tsx:514` |
| Destructive verb for "Pages" | `/[store]/pages` → "Delete page?" (`pages/page.tsx:515-517`) vs `/[store]/online-store/pages` → "Archive page?" (`online-store/pages/page.tsx:821-823`) — **and both success descriptions say "removed"** |
| Archive/delete/remove in one dialog | `posts/page.tsx:567-569` — `title="Archive post?"` driven by state variable `postToDelete`, body "*This archives … and removes it…*", `confirmLabel="Archiving..."` |
| Spelling | **fulfilment** (`settings/checkout:356`, `settings/shipping:474`, `settings/users:293`, `settings/notifications:96`, `products/locations:254, :279`) vs **fulfillment** (`orders/page.tsx:670`) |
| Spelling, one page | `settings/plan/page.tsx:206` toast "Plan cancelled" (British) while `:117` branches on `status === 'canceled'` (American) — see §20.5 |
| Voice | **"We"** (`settings/business:120, :475`; `ConnectDomainWizard:75, :185`) vs **"LetBuyy"** (`analytics/page.tsx:180`) |
| Resume/portfolio vocabulary inside the commerce admin | `experience/page.tsx:225` "…is ready for your resume."; `skills/page.tsx:248` "…removed from your resume."; `projects/page.tsx:252` "…removed from your portfolio." vs `products/new/page.tsx:671` "…added to your catalog." |
| Shopper password rule, one app, **three values** | `orders/orders-client.tsx:93` "at least 4 characters" · `account-bottom-sheet.tsx:119` "at least 6" · `:144` "at least 8" (with the code comment at `:142` "*Backend enforces 8-128 chars (customer-registration.ts); match it client-side*") · `account/settings/settings-client.tsx:72` "at least 6". **Two of the four contradict the documented backend rule.** |

### 18.10 Confirmed copy defect

`apps/merchant-control-plane/src/app/[store]/settings/general/page.tsx:342` fires `notify({title:'Store deletion started', description:'Redirecting to your workspace…'})` and the **next statement** at `:343` is `window.location.href = …`. The document is torn down before the toast can paint — the merchant never sees the only confirmation of a store deletion.

---

## 19. Duplicate / Ad-Hoc Implementations

**Counting method.** All counts are JSX-element counts over `apps/*/src` with `node_modules`, `.next`, `dist` and `build` excluded. The task brief's supplied numbers were inflated ~2× by `.next/` build output, where `apps/*/.next/dev/server/app/page.js` re-exports the entire `@letbuyy/ui` barrel and literally contains `InlineError: (/* reexport safe */ …)`.

| Primitive | Brief said | Verified (`apps/*/src`) |
|---|---|---|
| `<Badge` | 175 | **151** |
| `<Banner` | 134 | **85** (134 included `<BannerCarousel`) |
| `<EmptyState` | 98 | **91** |
| `<Skeleton` | 131 | **131** |
| `<SaveBar` | 21 | **21** |
| `useToast()` | 146 | **73 call sites / 155 matching lines** |
| `<ConfirmDialog` | 31 | **31** |
| `<StatusBadge` | 18 | **18** (only **1** is canonical) |
| `<Spinner` | 10 | **10** |
| `<ProgressBar` | 5 | **5** |
| `<InlineError` | 0 | **0 app consumers** |
| `<FilterChips` | 0 | **0 app consumers** |

Two further corrections to the brief: `Spinner`, `ProgressBar` and `FilterChips` live in `packages/typescript/ui/src/primitives.tsx` (`:634`, `:443`, `:399`), **not** `productivity.tsx`; and `deprecations.ts` names **no** superseded APIs (see §20.6).

### 19.1 Cluster: status → tone mappers (39 forks, 0 canonical consumers)

`packages/typescript/ui/src/feedback.tsx:89-93` documents `statusToBadgeVariant` as "*the single source for status→tone logic (replacing the per-app StatusBadge/StatusPill forks)*". Verified: `grep -rn "statusToBadgeVariant" apps --include="*.tsx" --include="*.ts"` (excluding `.next`) → **0**. Repo-wide there are exactly three references: `index.ts:61` (barrel), `feedback.tsx:94` (definition), `feedback.tsx:118` (inside `StatusBadge`). **The replacement never happened and the function never executes in the product.**

**39 local mappers** named `statusVariant` / `statusTone` / `toneForStatus` / `*StatusVariant`:

| App | Count | Sites |
|---|---|---|
| merchant-control-plane | 19 | `settings/plan:115`, `settings/users:119`, `settings/notifications:147`, `settings/billing:158`, `comments:66`, `contact:52`, `posts:90`, `products/gift-cards:98`, `products/reservations:62`, `leads:77`, `dashboard:302`, `coupons:94`, `marketing:138`, `orders:155`, `pages:67`, `payouts:43`, `online-store/pages:100`, `components/theme-library/ThemeLibraryCard:74`, `lib/domains/domain-model:37` |
| platform-console | 7 | `trust-safety/TrustSafetyIndexTable:96`, `stores/StoreDirectoryIndexTable:164`, `subscriptions/SubscriptionManagementIndexTable:106`, `compliance:84`, `incidents:41`, `marketplace-governance:29`, `components/ConsoleDataTable:90-98` |
| identity-platform | 1 | `select/page.tsx:116-122` |
| storefront-runtime | 2 | `account/orders/orders-client.tsx:23-31`, `orders/orders-client.tsx:18-27` (inline `rgb()` maps) |
| **@letbuyy/ui itself** | 2 | `feedback.tsx:94` (unused) + `internal-workspace.tsx:156-163` (`InternalStatusPill`) |
| **[FROZEN]** | 4 | `developer-portal/_local-ui/developer-docs:61-72`, `app-marketplace/(auth)/developers/dashboard:66-73`, `platform-operations-portal/support/TicketIndexTable:23`, `platform-operations-portal` others |

**Proven live conflicts** — both sides render, and the value can actually occur:

| Conflict | Site A | Site B | Same data? Same user? |
|---|---|---|---|
| **PageStatus `draft`** grey vs amber | `pages/page.tsx:67-70` — published→success, archived→critical, **else 'default'** | `online-store/pages/page.tsx:100-103` — published→success, **draft→'warning'**, else 'default' | **Yes.** Both fetch `/api/stores/${...}/pages?limit=100` (`pages:97`, `online-store/pages:211`); both declare `PageStatus = 'draft'\|'published'\|'archived'`; the shared route `api/stores/[store]/pages/route.ts:6` normalises exactly those three. **Both nav entries are in the same `storeNavigation`** — `merchantNavigation.ts:149` ("Content") and `:167` ("Store pages") |
| **Subscription status**: `trialing` green vs amber, `cancelled` red vs blue, `expired` grey vs blue | `platform-console/(dashboard)/subscriptions/page.tsx:57` → `<StatusBadge value={row.status \|\| 'active'} />` → `ConsoleDataTable.tsx:89-107` (trialing→green `:91`, cancelled→red `:95`, expired→unmatched→zinc) | `platform-console/(dashboard)/revenue/page.tsx:137` → `<StatusPill value={row.status \|\| 'active'} />` → `internal-workspace.tsx:156-163` (trialing→warning, cancelled→unmatched→**defaultTone 'info'**, expired→info) | **Yes.** Both call `fetchConsoleApi<...ConsoleSubscription>('/internal/console/subscriptions', …)` (`revenue:46`, `subscriptions:91`). **Adjacent nav entries** — `(dashboard)/layout.tsx:32` "Revenue", `:34` "Subscriptions" |
| **Moderation**: `pending` grey vs amber, `rejected` grey vs red | `comments/page.tsx:66-70` — approved→success, spam→warning, **else 'default'**; rendered `:206` | `reviews/page.tsx:70-74` — approved→success, pending→**'warning'**, else→**'critical'**; rendered `:300` | Same app, adjacent moderation queues (`merchantNavigation.ts:155`, `:142`), shared pending/approved/rejected vocabulary |
| **`expired`**: amber vs red | `products/gift-cards/page.tsx:98-102` — `expired \|\| held → 'warning'`, label "Expired" (`:94-96`) | `coupons/page.tsx:94-97` — `isExpired(coupon) → 'critical'`, label "Expired" (`:88-91`) | Same merchant, both stored-value/discount instruments, both render a Badge reading literally "Expired" |
| **Storefront `processing`** identical-to-confirmed vs distinct | `account/orders/orders-client.tsx:25-26` — confirmed **and** processing both `rgb(59 130 246)` | `orders/orders-client.tsx:21-22` — confirmed `rgb(59 130 246)`, processing `rgb(14 165 233)` | Same shopper. `/account/orders` linked from `account-bottom-sheet.tsx:539`; `/orders` linked from `checkout-client.tsx:585` and `checkout/success/page.tsx:29` |
| **`pending_cod` unmapped** | `account/orders/orders-client.tsx:23-31` — **no `pending_cod` key**; falls back to `rgb(107 114 128)` (`:104-105`), prints raw "Pending_cod" (`:108`), timeline stuck at step 0 (`:40-45`) | `orders/orders-client.tsx:20` — `pending_cod: { color: 'rgb(245 158 11)', label: 'COD pending' }` | Value is real: written by a DB trigger (`database/supabase/migrations/074_cod_pending_status.sql:37, :53`) and forwarded verbatim by `api/customer/orders/route.ts:15-16` |
| **Payout `processing`** blue vs amber (vocabulary drift, no single observer) | `payouts/page.tsx:43-48` → `'info'` | `platform-console/(dashboard)/developers/page.tsx:111-119` → `'warning'` | Different tables (`released` vs `paid`), different payees. **Report as drift, not a user-visible contradiction** |

**Two greens and two ambers as immediate siblings in one flex row** — the only same-element proof, on a money surface. `apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx:363-367`:

```
<div className="flex flex-wrap items-center justify-end gap-[var(--lb-space-2)]">
    <ProviderModeBadge mode={providerMode} />
    <Badge label={status.label} variant={status.variant} />
</div>
```

The Badge variant is computed at `:321-325` (`verified → 'success'`, `key_id_masked → 'warning'`). `ProviderModeBadge.tsx:3-6` uses the **raw** family (`text-[var(--lb-color-success)]` = `#22C55E`); `feedback.tsx:44-49` uses the **banner** family (`#15803D`). Both on the same `#DCFCE7`. So a verified live store shows two green pills side by side **in different greens**; a saved sandbox store shows two ambers (`#F59E0B` vs `#92400E`).

**Latent trap (do not report as a rendered conflict).** `statusToBadgeVariant` (`feedback.tsx:94-102`) matches by unanchored `s.includes(k)` with the success list checked **first** (`:97`), so negated states resolve to SUCCESS. Executed verbatim: `inactive`→success, `unpaid`→success, `unverified`→success, `incomplete`→success, `unresolved`→success, `unhealthy`→success, `unpublished`→success, `not connected`→success, `disconnected`→success, and `delivery_failed`→success (because "delivery" contains "live"). `not connected` is load-bearing vocabulary in this codebase. **It has zero consumers, so nothing renders wrong today — any app that migrates onto the canonical helper inherits this.**

### 19.2 Cluster: inline field errors (52 sites, 5 parallel implementations, 0 canonical)

`InlineError` (`packages/typescript/ui/src/input.tsx:162-177`) is exported at `index.ts:7-8`, present in the frozen snapshot at `snapshots/public-api.json:165-166`, and has **zero app consumers**. Verified per-app across all 10 app roots, all extensions, excluding `node_modules/.next/dist/build/.turbo`: every app returns 0, frozen apps included. No aliased imports (`InlineError as`, `as InlineError` → nothing) and no `export * from '@letbuyy/ui'` barrel could hide it.

Non-app references, enumerated exactly: `packages/typescript/ui/src/index.ts:7, :8`; `src/input.tsx:162, :166`; `src/foundation-primitives.stories.tsx:18, :117`; `tests/components/foundation.test.tsx:26, :542`; `snapshots/public-api.json:165, :166`. **Phrase it as "zero app consumers", never "unused"** — it has an executing test with a real assertion at `foundation.test.tsx:555` (`expect(screen.getByRole('alert').textContent).toContain('Inventory cannot be negative.')` + `expectAxeClean`).

**The reason it is unadopted is structural, and it is inside its own file.** `input.tsx` contains three implementations of the same message:

| Line | What it renders | `role="alert"`? | Icon? | `id` for `aria-describedby`? |
|---|---|---|---|---|
| `input.tsx:89` (inside `Input`) | `<p id={errorId} className="m-0 text-[length:var(--lb-font-size-caption)] … text-[color:var(--lb-color-critical)]">{error}</p>` | **No** | **No** | Yes |
| `input.tsx:156` (inside `Textarea`) | byte-identical | **No** | **No** | Yes |
| `input.tsx:166-176` (`InlineError`) | `<p role="alert">` + `AlertCircle` + `<span>` | **Yes** | **Yes** | **No** — accepts no `id` |

Neither is complete: the built-in error is *linked but silent*; `InlineError` is *announced but unlinkable* (it generates no id and accepts none, so it cannot be an `aria-describedby` target). Apps that pass `error=` get the weaker variant automatically. The pattern is repeated a further six times: `controls.tsx:264, :341, :575, :697, :914` and `primitives.tsx:294` — **eight hand-rolled copies inside the package, none with `role="alert"`**.

The five app-level implementations, 52 sites:

| Implementation | Count | Sites |
|---|---|---|
| Raw `text-red-500` `<p>` | 16 | `storefront-runtime/.../checkout/checkout-client.tsx:731, :746, :762, :777, :790, :801, :815, :1120`; `components/account/account-bottom-sheet.tsx:269, :320, :387, :455`; `orders/orders-client.tsx:418`; `account/settings/settings-client.tsx:182, :275`; `components/product/product-reviews.tsx:302` |
| `.fieldError` CSS module | 10 | `merchant-control-plane/src/components/theme-editor/controls/*.tsx` — `FontPickerControl:82`, `VideoControl:165`, `VideoUrlControl:73`, `ResourcePickerControl:130, :423`, `LiquidControl:82`, `ColorSchemeControl:67`, `HtmlControl:75`, `CheckboxControl:54`, `ColorBackgroundControl:118` |
| `.te-field-error` — **byte-identical global twin** | 3 | `SchemaFormRenderer.tsx:321, :534`, `ImagePickerControl.tsx:204` |
| `.auth-error` | 9 | `identity-platform/login:245, :332`; `signup:523, :596, :706, :708`; `lookup:508, :602`; `onboarding:407` |
| `.ctc-err` / `.drf-field-error` (exiled app) | 4 | `marketing-site/contact/ContactForm.tsx:1193`; `contact/TicketLookup.tsx:165`; `demo/DemoRequestForm.tsx:472`; `[locale]/create/page.tsx:175` |
| `.form-error` **[FROZEN]** | 8 | `app-marketplace/src/components/*` |

**The byte-identical twin, proven:** `apps/merchant-control-plane/src/components/theme-editor/controls/controls.module.css:120` and `apps/merchant-control-plane/src/app/globals.css:8862-8867` both declare `color: var(--error, rgb(239 68 68)); font-size: 11px; line-height: 1.4; margin: 0;` — same four declarations, two files, one app. Both fall back to a naked `rgb()` instead of `--lb-color-critical`.

### 19.3 Cluster: banners / alert boxes (54 hand-rolled sites)

`<Banner>` adoption is one app deep: **119 in merchant-control-plane, 1 in storefront-runtime, 3 in platform-console, 0 in marketing-site**. Exact conflicting class strings for the same semantic (a critical alert):

| Site | Class string |
|---|---|
| `storefront-runtime/.../checkout/checkout-client.tsx:637` | `"mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"` |
| `platform-console/src/app/(auth)/login/page.tsx:51` | `"rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"` |
| `marketing-site/src/app/[locale]/create/page.tsx:89` | `"rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 …"` |
| `theme-marketplace/src/app/install/page.tsx:108` **[FROZEN]** | `"mb-6 rounded-lg border border-error/25 bg-error/10 px-4 py-3 text-sm text-error"` |

Four apps, four radii, four red ramps, none using `--lb-component-banner-danger-*`. `platform-console/(auth)/login/page.tsx` alone hand-rolls **all four** Banner variants inline: `:51` critical, `:57` success (`border-emerald-500/30 bg-emerald-500/10 text-emerald-200`), `:65` info (`border-zinc-700 bg-zinc-800`), `:73` warning (`border-amber-500/30 bg-amber-500/10`) — with `role=` count **0** in that file, against `identity-platform/login/page.tsx:245` which sets `role="alert" aria-live="assertive"` for the same event.

App-local banner systems: `.marketplace-banner{,--warning,--critical}` + `.marketplace-toast` (`app-marketplace/globals.css:2278-2310`, 30 render sites) **[FROZEN]**; `.admin-draft-banner` (`merchant-control-plane/globals.css:2110`, naked `rgba(245,158,11,0.1)`, rendered twice in `AdminShell.tsx:261, :280`); `.auth-error` (`identity-platform/globals.css:497`).

### 19.4 Cluster: status pills / badges (72 hand-rolled sites)

**Sharpest instance — a name collision that shadows the canonical export.** `apps/platform-console/src/components/ConsoleDataTable.tsx:89` declares a local component literally named `StatusBadge` with a *different API* (`{ value, tone }` vs the canonical `{ status, label, variant }` at `feedback.tsx:117`) and a fully token-free palette:

```
green: 'bg-emerald-500/10 text-emerald-300'   // :100
amber: 'bg-amber-500/10 text-amber-300'       // :101
red:   'bg-red-500/10 text-red-300'           // :102
zinc:  'bg-zinc-700/60 text-zinc-300'         // :103
```

on `"inline-flex items-center rounded px-2 py-1 text-xs font-medium"` — note `rounded`, not `rounded-full`, and no border, unlike Badge. **All 14 platform-console `<StatusBadge` sites import it from `@/components/ConsoleDataTable`, not from `@letbuyy/ui`.** Its red list (`:95`) is `['suspended','cancelled','inactive','false']` — `failed`, `error`, `declined`, `expired` all fall through to neutral **grey**, so a FAILED row renders as if nothing is wrong. The same app renders the token-based `StatusPill` 34× — two visually different status pills inside one product.

Of the 18 `<StatusBadge` sites repo-wide, exactly **one** is the canonical component (`merchant-control-plane/.../settings/notifications/page.tsx:650`), and it passes `variant={statusVariant(log.status)}` from a local mapper at `:147` — so `statusToBadgeVariant` is bypassed even there. The other 17 resolve to two local forks (14 → ConsoleDataTable, 3 → `developer-portal/_local-ui/developer-docs.tsx:68` **[FROZEN]**).

**Eight badge/pill generations for one concept:**

| # | Implementation | Location | Token basis |
|---|---|---|---|
| 1 | `Badge` / `StatusBadge` | `feedback.tsx:69, :117` | `--lb-component-badge-*` / `--lb-component-banner-*` |
| 2 | `InternalStatusPill` | `internal-workspace.tsx:146` | `--lb-color-*` / `-soft` (**different family, same semantic**) |
| 3 | `StatusBadge` (collision) | `platform-console/ConsoleDataTable.tsx:89` | raw emerald/amber/red/zinc |
| 4 | `StatusBadge` (collision) **[FROZEN]** | `developer-portal/_local-ui/developer-docs.tsx:68` | wraps canonical Badge, own mapper |
| 5 | `ProviderModeBadge` (web) | `merchant-control-plane/src/components/ProviderModeBadge.tsx:13` | `--lb-color-*` + raw `text-[11px]`, `py-[2px]` |
| 6 | `ProviderModeBadge` (Flutter) | `apps/mobile/merchant-app/lib/widgets/shared/provider_mode_badge.dart:24` | generated Dart bridge |
| 7 | `.marketplace-badge--*` **[FROZEN]** | `app-marketplace/globals.css:2163-2193` | `--lb-*` CSS |
| 8 | `.select-meta-status--*` | `identity-platform/globals.css:2217-2259` | app-local |

Plus `.all-stores-card-status` (`merchant globals.css:1937`), `.method-pill--*` (`developer-portal globals.css:1797` **[FROZEN]**) and `.ws-badge-*` (`marketing globals.css:2221`) → eleven.

**Storefront duplicates:** `account/settings/settings-client.tsx:125` `"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50"` vs `account/orders/orders-client.tsx:101-106` which uses `style={{backgroundColor: `${statusColors[order.status]}15`, color: statusColors[order.status]}}` off a hard-coded rgb map at `:23-31`.

### 19.5 Cluster: metric tiles (41 copy-pasted sites)

41 structurally identical `<Card><Section><span className="flex h-[var(--lb-size-control-md)] w-[…] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-{primary,success,warning,critical}-soft)] …"><Icon/></span>` tiles, all in merchant-control-plane, all in 4-up grids. `posts/page.tsx:414` (primary) / `:427` (success) / `:440` (warning) / `:453` (critical) is the exact template, repeated verbatim in `comments:326-365`, `contact:239-265`, `leads:374-400`, `settings/payments:97, :377, :389`, `settings/shipping:116`, `settings/taxes:98`, `settings/policies:260`, `settings/notifications:468`, and the `pages`/`gallery`/`reviews`/`coupons`/`categories`/`dashboard`/`apps` files.

Canonical `MetricCard` (`productivity.tsx:27`) is used only **23** times. It has no `icon` prop — **extending it once is the fix, not 41 copies**. Note: these tiles are 100% token-clean, so the drift ratchet scores them **zero** (§20.1).

### 19.6 Cluster: toast systems

`useToast` is adopted in exactly two apps: **merchant-control-plane (140 lines / 67 files)** and **theme-marketplace (6) [FROZEN]**. Zero in `storefront-runtime`, `identity-platform`, `platform-console`, `platform-operations-portal`, `app-marketplace`, `developer-portal`, `marketing-site`.

`ToastProvider` is mounted in exactly three places: `apps/merchant-control-plane/src/components/AdminShell.tsx:155` and `:187` (two branches of one component, mounted only at `src/app/[store]/layout.tsx:48`, so the provider covers `/[store]/**` only) and `apps/theme-marketplace/src/app/layout.tsx:139` **[FROZEN]**.

No crash risk: `grep -rln useToast apps/merchant-control-plane/src | grep -v 'src/app/\[store\]' | grep -v src/components` returns nothing.

**[FROZEN]** `app-marketplace` re-invents the toast as a static CSS box: `.marketplace-toast--success` (`globals.css:2278-2287, :2482`) rendered at `ReviewComposer.tsx:83`, `AppInstallConsentPanel.tsx:198`, `InstalledAppsGrid.tsx:323, :344`, `ReportActionButton.tsx:61` — in-flow div, no fixed positioning, no auto-dismiss, no dismiss button, raw px, success-only.

### 19.7 Cluster: empty states (8 distinct treatments)

| # | Treatment | Location | `role`? | Actions? |
|---|---|---|---|---|
| 1 | `EmptyState` | `feedback.tsx:516` | none | primary + secondary |
| 2 | Table mobile empty | `table.tsx:244` (`p-[var(--lb-space-3)]`) | none | none |
| 3 | Table desktop empty | `table.tsx:350` (`p-[var(--lb-space-4)]`) | none | none |
| 4 | `InternalEmptyDataState` | `internal-workspace.tsx:205` — one `message: string` prop, dashed border | none | **none** |
| 5 | `InternalSkipBackendPanel` | `internal-workspace.tsx:178` | none | none |
| 6 | Chart "No chart data" | `primitives.tsx:69` | **`role="status"` — the only one** | n/a |
| 7 | CommandPalette "No commands found" | `productivity.tsx:362` | none | n/a |
| 8 | `MarketplaceUnavailable` | `marketplace.tsx:20` — ships **zero classes** | `role="alert"` **and** `aria-live="polite"` (contradictory) | retry |

Note #2 vs #3: two different paddings for the same state. And `EmptyState` is **not** used by `Table` by default (`emptyState ?? emptyMessage`, default `'No data found'` at `table.tsx:117`), so a table's empty state and a page's EmptyState look nothing alike unless the caller passes one in — 5 of 28 data-`<Table>` sites fall back to the bare string (`platform-console/compliance:236`, `platform-console/money-reconciliation:137`, `merchant posts:290, :347`, `merchant ai:329`).

### 19.8 Cluster: dead canonical-compliant twins

Four `*IndexTable.tsx` components **do** use canonical `<Badge>` + `<EmptyState>` + `<Table>` — and are imported by **nothing** (verified by name-grep across `apps/**/*.{ts,tsx}` excluding `.next`):

| File:line | App |
|---|---|
| `platform-console/src/app/(dashboard)/stores/StoreDirectoryIndexTable.tsx:55` | active |
| `platform-console/src/app/(dashboard)/subscriptions/SubscriptionManagementIndexTable.tsx:83` | active |
| `platform-console/src/app/(dashboard)/trust-safety/TrustSafetyIndexTable.tsx:79` | active |
| `platform-operations-portal/src/app/(dashboard)/support/TicketIndexTable.tsx:90` | **[FROZEN]** |

The live routes beside them still render the ad-hoc pill (`stores/page.tsx:64`, `subscriptions/page.tsx:57` use `ConsoleDataTable.StatusBadge`). **The canonical migration was written and never wired**, and these files inflate the apparent `<Badge>` adoption count. Also dead, with zero import sites: `merchant-control-plane/src/components/theme-editor/AppBlockSlotPanel.tsx` and `AICustomizationPanel.tsx` — any claim about their "NOT CONNECTED" rendering is moot because neither is ever mounted. (`OnboardingQueueIndexTable` and `CommunicationTemplateIndexTable` **are** live — `onboarding/page.tsx:27, :220` and `communications/page.tsx:18, :249` — do not list them as dead.)

### 19.9 Cluster: chips (3 implementations, 0 shared)

| Implementation | Location | Remove control |
|---|---|---|
| `FilterChips` — **0 app consumers** | `primitives.tsx:399-434` | real `<button type="button" aria-label={`Remove ${chip.label}…`}><X/></button>` (`:412-419`) |
| Table chips | `table.tsx:196` | `<Badge key={chip.label} label={chip.label} variant="info" onClick={chip.onRemove} />` — `Badge` renders a bare `<span>` (`feedback.tsx:73-86`), so **no role, no tabIndex, no keyboard path, no focus ring, and the glyph is the `Info` icon, not an ×** |
| `FilterBar` | `productivity.tsx:225`, rendered `:254` | opaque `chips?: React.ReactNode` slot; never imports `FilterChips` |

`TableFilterChip` (`index.ts:11`) is a type-only export with 0 consumers. **The accessible implementation sits unused while `Table` ships the inaccessible one** at 4 merchant sites (`customers/page.tsx:397`, `products/page.tsx:399`, `orders/page.tsx:655`, `products/inventory/page.tsx:358`).

### 19.10 Cluster: spinners (5 generations)

| Generation | Sites | a11y |
|---|---|---|
| `<Spinner>` (`primitives.tsx:634`) | 10, **all** merchant-control-plane | `role="status"` + `aria-label` + `sr-only` |
| `<Button loading>` (`button.tsx:77-79`) | ~40 | `aria-hidden` spinner, **no `aria-busy`, no sr-only** |
| Raw `<Loader2 className="animate-spin">` | 26 (`checkout-client:1024`, `product-reviews:311`, `settings-client:288`, `addresses-client:371`, + 8 in **[FROZEN]** app-marketplace) | none |
| Hand-rolled CSS ring | `merchant-control-plane/[store]/login/page.tsx:29`; `identity-platform globals.css:1585, :2107` | none |
| **Non-animating** `<MaterialIcon name="hourglass_top">` | `ImagePickerControl:176`, `SchemaFormRenderer:524`, `VideoControl:137`, `MediaLibrary:510, :568` | `MaterialIcon` (`icons.tsx:497-517`) applies no animation class — a **frozen** Loader2 glyph as the busy indicator |

Worse: `hourglass_empty` is **not in `materialIconMap`** (only `hourglass_top` at `icons.tsx:346`), and `LooseMaterialIconName = string & {}` (`icons.tsx:477-479`) lets any string typecheck, so `AppBlockSlotPanel.tsx:347` falls through to `?? Circle` (`icons.tsx:504`) — a plain static circle inside `role="status" aria-label="Loading installed apps"`. (That component is dead code, so this is latent.)

### 19.11 Cluster: token forks in app CSS

| App | `--lb-*` redefinitions | Feedback CSS selectors | Notes |
|---|---|---|---|
| developer-portal **[FROZEN]** | **102** | 17 | Rebuilds the system on a green identity; resurrects two *deleted* tokens (`--lb-color-border-subtle`, `--lb-color-border-default`) and consumes them 20+ times |
| app-marketplace **[FROZEN]** | 77 | 68 | Dark status ramp diverges: `globals.css:139` `--lb-color-critical: rgb(248 113 113)` vs canonical `#EF4444`. **Inert** — the fork sits on `.dark` at `<html>` while the injected block matches the nearer DesignSystemRoot div |
| merchant-control-plane | 71 | 139 | See below |
| marketing-site | 63 | **161** | **Exiled from the ratchet** — none measured |
| storefront-runtime | 9 | 24 | **The only bridge rather than a fork** — see §20.2 |
| platform-console | 6 | **0** | drift is in TSX, not CSS |
| platform-operations-portal **[FROZEN]** | 6 | **0** | byte-identical 6-line copy of the platform-console `:root` block |
| identity-platform | **0** | 21 | consumes tokens without forking them |
| theme-marketplace **[FROZEN]** | **0** | **0** | the cleanest consumer in the repo |

merchant-control-plane's fork is largely **inert or dead**, which is itself the finding:

- `globals.css:283-294` (light canvas) uses selector `html [data-letbuyy-theme="light"]` = specificity (0,1,1), which **loses** to the injected surface block at (0,2,0) for 10 of its 12 declarations. Only `--lb-color-text-muted` (`:293`) and `--lb-color-text-inverse` (`:294`) apply, because those two are not in the surface emit list. Result: a half-applied palette.
- `globals.css:307-359` — the entire 52-line dark block, **including all 12 banner tokens at `:346-357`**, is unreachable: `layout.tsx:41` `data-theme="light"`, `:43` `<ThemeScript forcedTheme="light" />`, `:46` `<LetbuyyThemeProvider surface="admin" forcedTheme="light">`. The four alpha borders there (`rgba(34,197,94,.3)` etc.) genuinely diverge from the canonical opaque status colours and **would** take effect if dark were ever enabled — report as dead CSS and a UI-R3 gap, **not** as a rendered colour difference.
- `globals.css:281, :304` mint `--lb-shadow-accent-sm`, an invented token in the `--lb-*` namespace with no definition in `tokens.ts` — a second token source, contra UI-R1.
- `globals.css:6001-6006` `.admin-skeleton` (+ `@keyframes shimmer` at `:469-477`) has **zero consumers** repo-wide — a superseded generation of `<Skeleton>`, which the same app now uses 101 times.

### 19.12 Rendering bugs caused by dangling tokens

| Token referenced | Emitted? | Consequence |
|---|---|---|
| `--lb-component-banner-critical-{bg,text,border}` | **No** — the family is `-danger-` (`tokens.ts:1317-1319`) | `theme-marketplace/src/app/checkout/page.tsx:407` **[FROZEN]** — a failed theme purchase renders as unstyled text in a bare default-colour box |
| `--lb-color-feedback-{critical,success}-text` | **No** | `merchant/products/inventory-history/page.tsx:281, :480-481, :521-522` — stock-increase and stock-decrease rows render in the **same** inherited colour |
| `--lb-color-text-critical` | **No** (0 declarations repo-wide) | 7 sites incl. `ThemeLibraryWorkspace.tsx:506, :569` — **the two best-wired field errors in merchant-control-plane** (`aria-describedby` + `aria-invalid` + `role="alert"` + clear-on-change) render in inherited body colour. Perfect semantics, invisible as errors |
| `--lb-color-danger` | **Deleted at emit** (`tokens.ts:14`, `:1121-1123`) | `merchant globals.css:11416-11418, :11453` — `color-mix(in srgb, var(--lb-color-danger) 30%, transparent)` is invalid, so the entire declaration drops. `.checkout-error` and `.checkout-coupon-error` render with **no red tint, no red border, inherited text** on the merchant plan checkout |
| `--lb-color-border-subtle` | **Deleted at emit** (`tokens.ts:13`) | `config/tailwind/letbuyy-tokens.css:55` wires `--color-line-subtle` to it, so every `border-line-subtle` / `divide-line-subtle` utility resolves to an invalid value |
| `--lb-font-size-{xs,sm,lg,base,2xl}` | **No** | **198** `text-[length:var(--lb-font-size-xs)]`-style classes across apps are inert |
| `--lb-color-{text-disabled,text-link,surface-selected,surface-hovered,text-caution,text-info}` | **No** | Disabled placeholders, links, selected templates and hovered rows have no distinguishing style |

---

## 20. Architectural Findings

These are root causes. Every symptom in §16–§19 traces to one of them.

### 20.1 The governance gate measures pixels, never structure — so none of this can surface in CI

`scripts/validators/validate-design-system.mjs` walks `apps/` only (`:39`, `:72-73`) and **exempts `packages/typescript/ui` as the token layer**. Its ten ratchet metrics are all lexical colour/px/radius/shadow counters:

`appCssRawHex` · `appCssNakedRgbHsl` · `tailwindPaletteClasses` · `appLocalLbTokenRedefs` · `rawPxFontSize` · `rawPxSpacing` · `tsxInlineStyles` · `tsxRawHex` · `tsxArbitraryRadius` · `tsxArbitraryShadow`

**Not one measures**: component adoption, `aria-invalid`, `aria-describedby`, label association, focus management, target size, layout, viewport units, copy, tone selection, variant omission, or error-message provenance.

The gate is currently **green and improving** — a read-only run reports HARD invariants OK with 9 of 10 metrics *below* baseline (`appCssRawHex` 156→146, `appCssNakedRgbHsl` 821→795, `tailwindPaletteClasses` 535→532, `appLocalLbTokenRedefs` 339→275, `rawPxFontSize` 612→593, `rawPxSpacing` 1581→1556, `tsxInlineStyles` 673→670, `tsxRawHex` 5→0, `tsxArbitraryRadius` 388→386). **Nothing in this report will ever appear in CI.**

Three compounding structural gaps:

1. **Scope inversion.** 13 of the 16 responsive findings and most of the accessibility findings originate *inside* `packages/typescript/ui` — the exempt package. A defect in `feedback.tsx` is invisible by construction.
2. **Exile.** `design-system-baseline.json` → `exiledApps: ["apps/marketing-site"]` (`validate-design-system.mjs:50-51`) removes the app carrying the largest parallel feedback system (161 selectors) *and* the only correct form implementation in the monorepo from measurement entirely.
3. **Baselining instead of blocking.** `tailwindPaletteClasses: 535` **baselines** the storefront checkout's `text-red-500` errors rather than blocking them — the exact posture `AGENTS.md:294` UI-R7 was written against: "*The drift ratchet MUST BLOCK new drift … not baseline it*".

The one counter-example proves the mechanism works when applied: `validate-design-system.mjs:76-79` **hardcodes** the two `_local-ui` workspace files and `:163-167` fails the build if either grows a real implementation (`localWorkspaceImplementations: 0`). That is the only feedback fork in the repo with a hard, non-ratchet validator behind it — and it is the only one that has not drifted. But it covers the workspace *shell* only; it does not cover `ConsoleDataTable.tsx`, so platform-console's real feedback surface (35 error panels, 14 status badges, every empty table) sits entirely outside governance.

**The missing gate** is a component-adoption validator: fail a PR that introduces a new local status→tone function, a new `.*-banner`/`.*-toast`/`.*-badge` CSS rule, or an app-level `role="alert"` div, when the corresponding `@letbuyy/ui` primitive exists.

### 20.2 The design system has no bridge into the merchant-themed storefront

`storefront-runtime` consumes exactly **two** feedback primitives — `EmptyState` and `Skeleton`, both via one adapter (`apps/storefront-runtime/src/components/storefront/storefront-states.tsx:3`). That adapter is the **model pattern in the whole repo**: `apps/storefront-runtime/src/app/globals.css:391-400` scope-overrides the canonical tokens onto the merchant theme namespace —

```
.storefront-empty-state {
  --lb-component-empty-state-bg: var(--surface);
  --lb-component-empty-state-border: var(--border);
  --lb-component-empty-state-title: var(--text);
  --lb-component-empty-state-body: var(--text-secondary);
}
```

**No equivalent bridge exists for anything else.** `grep -n -- "--lb-component-banner\|--lb-color-critical\|--lb-color-success\|--lb-color-warning\|--lb-component-badge\|--lb-color-surface-subdued" apps/storefront-runtime/src/app/globals.css` returns **nothing**. And the 24 CSS variables the merchant theme injects at `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:178-212` (`--primary`, `--secondary`, `--accent`, `--background`, `--text`, `--surface`, `--is-dark`, `--card-bg`, `--input-bg`, …) contain **no semantic feedback colour at all** — no `--success`, no `--error`, no `--warning`.

Consequence, stated plainly: **a merchant can theme their store but cannot theme a single error, success, or stock message.** That is why the shopper checkout hand-rolls 28 raw palette classes (70 across the app — the highest of any app; merchant-control-plane has 0). It is a missing architectural seam, not developer laziness.

Second-order defect from the same gap: `<Skeleton>` renders `bg-[var(--lb-color-surface-subdued)]` (`feedback.tsx:296, :305, :318`), which is never bridged, so the loading skeleton follows the **visitor's** LetBuyy light/dark preference (`<LetbuyyThemeProvider surface="storefront">`, `layout.tsx:46`) while everything around it follows the **merchant's** `--is-dark` (`store/[subdomain]/layout.tsx:187`). These two can disagree.

Related, structurally proven / visually **PLAUSIBLE**: `apps/storefront-runtime/src/app/not-found.tsx:13` uses `color: 'var(--foreground, rgb(15 23 42))'`; `--foreground` is defined exactly once at `globals.css:41` with **no dark variant and no `.dark`/`prefers-color-scheme` block anywhere in that file**, and the merchant theme injection overrides `--background` (`:182`) but never `--foreground`. On a merchant with a dark store theme that is dark-slate text on a dark background. Not rendered — token facts CONFIRMED, contrast outcome PLAUSIBLE.

### 20.3 The canonical primitives were designed but never migrated onto — and the migration debt is undocumented

Three exported primitives that would fix the largest clusters have **zero app consumers**:

| Primitive | Location | Would fix | Consumers |
|---|---|---|---|
| `statusToBadgeVariant` | `feedback.tsx:94` | 39 forked mappers (§19.1) | 0 |
| `InlineError` | `input.tsx:166` | 52 hand-rolled field errors (§19.2) | 0 |
| `FilterChips` | `primitives.tsx:399` | the inaccessible Table chip (§19.9) | 0 |

`statusToBadgeVariant`'s own JSDoc (`feedback.tsx:89-93`) claims it is "*the single source for status→tone logic (replacing the per-app StatusBadge/StatusPill forks — see COMPONENT_DUPLICATION_REPORT.md DUP-4)*". The cited report does not exist in this repo (**dangling citation, UNPROVEN**), and the replacement provably never happened.

`InlineError`'s zero adoption is **structural, not incidental** (§19.2): the same file hand-rolls the message eight times without `role="alert"`, and apps passing `error=` get the weaker variant automatically. `InlineError` also accepts no `id`, so it *cannot* be an `aria-describedby` target — a developer wiring a11y correctly (as `ThemeLibraryWorkspace.tsx:502-511` did) **must** hand-roll instead.

`deprecations.ts` — the file expected to name superseded APIs — names none. It is a 19-line `warnDeprecated()` helper with **zero callers repo-wide**, not exported from `index.ts`, and absent from `snapshots/public-api.json`: unreachable from any consumer. The three genuinely `@deprecated` items (`icons.tsx:474` `LooseMaterialIconName`, `layout.tsx:544` `showBreadcrumb`, `layout.tsx:550` `showSectionLabel`) never call it, so nothing warns at runtime, and all three have zero app consumers.

Removal is constrained by the repo's own rule at `packages/typescript/ui/src/governance.stories.tsx:29` — "*Do not remove deprecated exports until cross-app migrations have landed*" — and every removal must move `snapshots/public-api.json`. Note the snapshot is a **removal guard only**: `tests/validators/ui-public-api-snapshot-validator.mjs:44-51` asserts snapshot ⊆ current, so additions never fail, and `ScrollThumb`, `ScrollThumbProps` and `acquireScrollLock` are exported from `index.ts` but absent from the 372-entry snapshot. `src/index.ts` is authoritative.

Also fully dead and safe to delete on the evidence: `warnDeprecated` (1 reference, its own definition) and `DropdownMenu` (3 references: definition, barrel, snapshot — no test, no story, no consumer).

### 20.4 The client error contract is typed at both ends and empty in the middle

`LetbuyyApiError` (`packages/typescript/api-client/src/index.ts:3686-3706`) carries `status`, `code`, `requestId`, `body`, and the gateway sanitises every 4xx/5xx on egress (`services/api-gateway/src/middleware/security.ts:90-129` + `lib/public-errors.ts`) so the 182 route handlers that echo raw Postgres text do not actually leak. But:

| Gap | Evidence |
|---|---|
| **No retry, no timeout, no backoff** | `grep -n "retry\|timeout\|setTimeout\|backoff"` over `index.ts` (5852 lines) + `graphql.ts` → **0**. `LetbuyyRequestOptions` (`:241-251`) exposes only a caller-supplied `signal` — no default deadline, so a hung gateway hangs the caller forever |
| **Network failure is not a `LetbuyyApiError`** | `:5556` `await this.fetchImpl(url, init)` is not wrapped; a DNS/offline failure throws a bare `TypeError` with no `.status`, so `error instanceof LetbuyyApiError` branches silently fall through |
| **Rate-limit metadata is discarded** | Only `X-Request-ID` is read (`:5557`). The gateway sets `Retry-After` and `X-RateLimit-*` on every 429 (`middleware/rateLimit.ts:477-480, :1005, :1091, :1171`) — and `services/api-gateway/src/index.ts:663` `exposeHeaders` omits `Retry-After` entirely, so a cross-origin browser client **cannot** read the retry hint |
| **`requestId` is collected and never shown** | `grep -rn "\.requestId" apps/*/src --include="*.tsx"` → 1 hit, and it is an unrelated postMessage correlation id (`EmbeddedAppBridgeClient.tsx:116`). Zero UI surfaces render the support-correlation id |

**The translation layer that should bridge them does not exist**: 53 local extractors, 25 byte-identical (§18.2), all discarding `code` and status. That is the mechanical reason status-specific handling is statistically absent:

| Status | Handling |
|---|---|
| **offline** | `navigator.onLine` and `addEventListener('online'\|'offline')` appear **zero** times in `apps/` and in `packages/typescript/ui/src`. No offline banner, no online-recovery retry |
| **429** | Handled in exactly **one** app — `identity-platform/signup:272`, `lookup:250, :309, :377`, `forgot-password:96`. **Zero** occurrences of `429` in any `.tsx` of merchant-control-plane, storefront-runtime, marketing-site or platform-console |
| **401** in the merchant UI | **One** hit in the entire app (`online-store/themes/[themeId]/editor/translations/page.tsx:46`). No 401 interceptor; `apps/merchant-control-plane/src/middleware.ts` does not exist |
| **403** in the merchant UI | **Zero**. Collapsed into 404 by `lib/auth/session.ts:107, :151, :182` — a merchant who lost access, one whose store was suspended, and one who mistyped a subdomain all get the same 404 |
| **Per-field validation** | `services/api-gateway/src/middleware/validation.ts:60-76` emits `{ error: { code, details: [{ field, message, code }] } }`. Across **all** apps, `error.details` is read in exactly ONE place — `identity-platform/src/app/api/auth/create-store/route.ts:110` — where it is `console.error`-logged and forwarded as an opaque blob. **Not one form maps `details[].field` back onto a control** |

`@letbuyy/ui` ships no error utility at all: `grep -n "ErrorState\|OfflineBanner\|RetryButton\|NetworkError\|ErrorBoundary\|componentDidCatch\|getDerivedStateFromError" packages/typescript/ui/src/index.ts packages/typescript/ui/src/*.tsx` → **zero hits**. And only **2 of 10 apps** have a Next.js error boundary — `merchant-control-plane` and `storefront-runtime` (plus `developer-portal` **[FROZEN]**). `identity-platform` (the auth surface every merchant logs in through), `platform-console` (all async server components), `marketing-site`, `app-marketplace` **[FROZEN]**, `theme-marketplace` **[FROZEN]** and `platform-operations-portal` **[FROZEN]** have **none**.

### 20.5 Failures are rendered as success or as empty, not as errors

This is the highest-impact class in the audit and it is a *design* failure, not a message-wording failure: `EmptyStateKind` (`feedback.tsx:338-352`) enumerates 14 values and **every one is a domain noun** — `generic | products | collections | inventory | orders | customers | discounts | marketing | content | domains | themes | analytics | apps | payments`. There is no `error`, no `no-results`, no `permission-denied`, no `offline`. **The primitive models WHAT is missing and never WHY.** Consequently only 8 of 91 `<EmptyState>` sites distinguish "failed to load" from "never created", all 8 in merchant-control-plane. `EmptyState` also has no `retry` prop, and `ToastMessage` (`feedback.tsx:163-170`) has no `action` slot — so **none of the 154 error toasts can offer a retry**, which is the mechanical cause of the 93 duplicate-feedback sites in §18.5.

Ranked by user impact:

| # | Failure rendered as | Evidence |
|---|---|---|
| 1 | **An empty catalogue on a live storefront, ISR-cached** | `apps/storefront-runtime/src/lib/product-service.ts:35-37, :47-49, :60-62, :78-80` — `catch (error) { console.error(...); return [] }`. Chain: `store/[subdomain]/page.tsx:49` → `lib/theme-engine/data-binding-engine.ts:91-93` → `components/sections/product-grid.tsx:195-200` `<StorefrontEmptyState title="No products found" body="Products added to this store will appear here." />`. `export const revalidate = 60` at **both** `page.tsx:10` and `layout.tsx:20`, so the empty-because-broken page is cached and re-served. **Proof it is a defect, not policy:** `lib/content-service.ts:76-78` + `:103-105` / `:113-115` — `if (isNotFoundError(error)) return []; throw error;`. Blog and pages rethrow 5xx; **products — the revenue path — swallow it.** Same class at `review-service.ts:28-31` and `store-service.ts:112-116` |
| 2 | **"You have no addresses" during an outage**, plus three more defects in 130 lines | `account/addresses/addresses-client.tsx:49-59` `catch { } finally { setLoading(false) }` → renders the empty state (`:152-157`). `:87-107` `handleSave` has `if (res.ok) {…}` with **no else and no catch**. `:110-121` `handleDelete` never checks `res.ok` and optimistically removes the row at `:118`. `:124-131` `setDefault` has no error path at all. And `<ConfirmDialog` count in storefront = **0**, so the delete has no confirmation either |
| 3 | **"This subdomain is available" during an outage** — top of the signup funnel | `marketing-site/src/app/[locale]/create/page.tsx:45` `setSubdomainAvailable(res.status === 404)` and `:46-47` `catch { setSubdomainAvailable(true) // Assume available on error }`. Lies in **both** directions: a network failure affirms availability (user proceeds, rejected later); any non-404 error status reports every subdomain as TAKEN |
| 4 | **"Go set up products and payments"** to a merchant who already did | `components/AISidebar.tsx:127` `catch { /* fallback = 0 */ }` and `:136` `catch { /* fallback = false */ }`, feeding `buildDynamicTodos(storeData, store, productCount, hasPayment)` at `:138`. A data-lie, not a missing message |
| 5 | **"No apps installed"** on a failed fetch | `settings/apps/page.tsx:23` `.catch(() => [])` → `AppsSettingsClient.tsx:184-188`. The correct discipline is documented **4 files away**: `lib/auth/session.ts:146-152` — "*5xx/network/unexpected → rethrow so an error boundary renders instead of faking a 404 for a transient backend failure*" |
| 6 | **ALL CLEAR during a total outage** — the incident console | `platform-console/(dashboard)/operations/page.tsx:286-296` collects `errors[]` yet returns `overview: overviewResult.data?.data \|\| {}`. Render order `:330-332` `ConsoleApiErrorPanel title="Operations API unavailable"` (warning-toned, no `role`), then `:335-340` "Open incidents 0", "DLQ messages 0" **tone='success'**, "Firing alerts 0" **tone='success'** |
| 7 | **A cart that is not persisted** | `context/cart-context.tsx:147` `if (!response.ok \|\| !result.success \|\| !result.data) return;` and `:162-164` `catch { }`. Neither branch informs the shopper |
| 8 | **A silent logout on a transient blip** | `context/customer-auth-context.tsx:86-87` `catch { setCustomer(null); }` inside `refreshSession` (runs on mount, `:92-94`) |
| 9 | **A permanently disabled login button with no explanation** | `identity-platform/src/components/TurnstileWidget.tsx:85-87` `'error-callback': () => { onVerifyRef.current('') }` — token cleared, nothing rendered. `login/page.tsx:363` mounts it with no `onExpire`; `:337` `disabled={loading \|\| !password \|\| (turnstileEnabled && !turnstileToken)}`, so the only message that exists (`:158`) is unreachable |

Two operator-severity variants of the same class:

- **Tone is silently discarded on operator metrics.** `internal-workspace.tsx:44-49` computes `toneClass` but applies it **only** inside `{detail ? <p className={cx(…, toneClass)}>{detail}</p> : null}` (`:59-63`); the `value` paragraph (`:56-58`) is hardcoded `text-[var(--lb-color-text)]`. 27 of 36 tone-passing sites omit `detail`. Proof it is a bug: `operations/page.tsx:337` passes `detail` (tone **visible**) two lines above `:338`, which does not (tone **invisible**). Money impact: `money-reconciliation/page.tsx:129-130` — "Breaks" and "Break variance" both pass `tone='critical'` with no detail, so **a ledger reconciliation break renders identically to a clean zero**.
- **A store picker where every store is red.** `apps/merchant-control-plane/src/app/stores/AllStoresClient.tsx:165` — `` className={`all-stores-card-status ${store.status === 'active' ? 'active' : 'inactive'}`} ``, styled at `globals.css:1951-1954` (`rgba(239, 68, 68, 0.12)`, `color: var(--error)`). But `store.status` is `sites.status`, whose DB CHECK (`database/supabase/migrations/000_baseline.sql:12026`) is `ARRAY['draft','published','unpublished','frozen','suspended']` — **`'active'` is not a member**. So `.active` (`globals.css:1946-1949`, emerald) is unreachable, `const activeStores = stores.filter((s) => s.status === 'active')` (`:70`) is always empty, and a healthy **`published`** store shows a RED pill with the raw label "published" — while `published` maps to `success`/green on four other merchant surfaces (`pages:68`, `online-store/pages:101`, `posts:91`, `dashboard:305`).

**One confirmed off-by-one-letter bug.** `apps/merchant-control-plane/src/app/[store]/settings/plan/page.tsx:117` tests `status === 'canceled'` (one L). The canonical enum is `packages/shared-types/src/index.ts:675` `'cancelled'` and the gateway only ever emits `'cancelled'` (`services/api-gateway/src/routes/internal-billing.ts:46`). So every genuinely cancelled subscription **misses the critical branch and falls through to `warning`** at `:118`, while `formatStatus` (`:112`) still prints "Cancelled". The console fork paints the same value red (`ConsoleDataTable.tsx:95`).

**Corrected from earlier drafts** (do not re-report these as defects): the six merchant CRUD pages (`experience`, `skills`, `projects`, `education`, `certifications`, `testimonials`) do **not** silently swallow Save — every field named in the guard already renders an inline `error=` message covering exactly that condition (e.g. `experience/page.tsx:191` guard vs `:356` `error={!formData.company.trim() && hasUnsavedChanges ? 'Company is required' : undefined}`), and all six guards begin `if (saving \|\| …)`, so they are re-entrancy protected. The residual defects are narrower: the Save control is not disabled when invalid, and there is no focus move. Likewise `checkout-client.tsx:307` `autoCreateCustomer` is **correctly** silent (ancillary account creation alongside a completed order, with the intent stated in-comment), and the raw "24 empty catch blocks" count is not a defect list — four sampled at random are all comment-justified best-effort side loads.

### 20.6 The primitive layer cannot express the states the rules demand

`AGENTS.md:290` UI-R3 is binding: "*Every screen MUST support light AND dark mode (reachable, not just wired), skeleton loading, empty, **error-with-retry**, focus, hover, active, and disabled states.*" The design system cannot satisfy the italicised clause:

| Primitive | Missing capability | Consequence |
|---|---|---|
| `ToastMessage` (`feedback.tsx:163-170`) | no `action`/`retry`/`undo` slot | none of 154 error toasts can offer retry; 0 of the destructive successes (gift card disabled, staff removed, zone deleted, tax rate deleted) offer undo |
| `EmptyStateKind` (`feedback.tsx:338-352`) | no `error`/`offline` kind | load failures render as first-run empty states (§20.5) |
| `Banner` (`feedback.tsx:121-126`) | no `dismissible`/`onDismiss` | 133 undismissable banners; unconditional ones (`settings/domains:177`, `settings/payments:455`, `settings/billing:281`, `settings/apps:257`) are **permanent** |
| `ConfirmDialog` (`overlays.tsx:496-506`) | no `loading`, no `error` slot; `onConfirm: () => void` is never awaited | see below |
| `TableBulkAction` (`table.tsx:25-29`) | no `loading`/`disabled` | `orders/page.tsx:324-378` runs a sequential N-request loop against an always-enabled bar (`table.tsx:207-214`), discards every per-item message (`:353-356`), and reports a **total** failure as an amber "partial" (`:363-369`) |
| `Table` (`table.tsx:48-69`) | no `error`/`onRetry` | every app improvises: Banner+Retry (`reviews:394-401`), error-in-EmptyState (`orders:461-471`), or Banner with **no** retry (`products:387-391`) |
| `Button` (`button.tsx:22`) | variant union has no success/warning/info tone | `Button` and the `StatusVariant` family (`feedback.tsx:29`) share no tone vocabulary; `destructive` ↔ `critical` is the only overlap and even the names differ |

**`ConfirmDialog` is the single highest-leverage fix.** `overlays.tsx:496-506` exposes exactly 9 props — no `loading`, no `confirmDisabled` — and `:528-530` hardcodes `<Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>` with neither `disabled` nor `loading`. All 31 call sites inherit a permanently clickable confirm button, which is why the codebase compensates with cosmetic `confirmLabel` swaps.

**The asymmetry is the proof the authors knew.** Every one of the four confirmed double-submit sites guards `onClose` and leaves `onConfirm` open:

| Site | `onClose` guarded? | `onConfirm` guarded? |
|---|---|---|
| `components/domains/DomainDetailView.tsx` | **Yes** — `:336` `if (!working)` | **No** — `remove` (`:111-122`) goes straight to `setWorking(true)` (`:112`); the sibling `makePrimary` at `:96` opens with `if (working) return` and its trigger at `:178` is `<Button loading={working}>` |
| `settings/apps/AppsSettingsClient.tsx` | **Yes** — `:267-269` | **No** — `uninstall` (`:111-134`) never checks `isPending`; `startTransition` does not de-duplicate |
| `online-store/pages/page.tsx` | Yes (`:825`) | **No** — `archivePage` (`:295-322`) never checks `saving`; `setPageToArchive(null)` at `:310` is **after** the await |
| `orders/page.tsx` (**cancel order**) | **No** — `:673` | **No** — `updateOrderStatus` (`:254-305`) opens with a bare `setUpdatingId(orderId)` at `:259`. `confirmLabel="Cancel order"` is a **static** string, unlike every sibling |

They defended the dismiss path because they *could*; they had no API to defend the confirm path. Note `packages/typescript/ui/src/button.tsx:63` (`const interactiveDisabled = disabled \|\| loading;`, applied at `:134`) means any `<Button loading={x}>` **is** genuinely double-click-proof even without a handler guard — which is exactly why the orders **row** actions (`:747-767`) are safe while the orders **confirm dialog** is not.

*Corrected: `ConflictDialog.tsx:64` is **not** an instance — its consumer closes the dialog synchronously first (`editor/page.tsx:1567-1581`, `setHasConflict(false)` is the first statement, bound to `open={hasConflict}` at `:1561`). Payout release (`payouts/page.tsx:90-122`) is a **missing-feedback** finding, not a double-submit: the button carries no `disabled`/`loading` and the money request runs against a static UI, but the server short-circuits idempotently (`services/api-gateway/src/routes/payouts.ts:571-574`) and re-entry requires a fresh TOTP. And the EmptyState Retry buttons do not stack requests — they are unmounted during load (`orders/page.tsx:644-646`, `table.tsx:342-353`).*

**One confirmed never-resolving loader**, found by two independent scans: `apps/merchant-control-plane/src/app/[store]/access_account/checkout/checkout/CheckoutClient.tsx:257-359`. `setIsProcessing(true)` at `:258` has resets for the throw path (`:357`), verify-failure (`:337, :343`) and `payment.failed` (`:349-352`) — but the Razorpay options object (`:297-346`) has **no `modal.ondismiss`**, and `razorpay.open()` (`:354`) returns immediately. Closing the payment modal without paying leaves `<Button loading={isProcessing} fullWidth>` (`:676`) spinning forever. The same repo does it correctly: `apps/storefront-runtime/.../checkout/checkout-client.tsx:533-536` `modal: { ondismiss: function () { setIsProcessing(false); } }`, with the type declared at `:51-52`.

### 20.7 There is no unsaved-changes protection anywhere in the repository

`grep -rn --include='*.tsx' --include='*.ts' -i "beforeunload" apps/ packages/ services/` (node_modules excluded) returns **no matches**. There is no `onRouteChangeStart`, no `useBeforePopState`, no router blocker, no `usePrompt`-style hook.

What exists is a purely **cosmetic** indicator: `SaveBar` (`feedback.tsx:546-601`) renders "Unsaved changes" inside an `aria-live="polite"` container. The dirty state **is** computed — `hasUnsavedChanges` at `settings/general:187`, `settings/business:208`, `settings/payments:127`, `settings/policies:93`, `experience:165`; `isDirty` at `online-store/themes/[themeId]/editor:1532` — and is fed **only** into `SaveBar`'s `state` prop.

Highest-stakes case: the theme editor holds an entire unsaved draft (sections, blocks, settings) in client state; the shell's left nav and `PageHeader` breadcrumbs are ordinary `<Link>`s, so any nav click, browser Back, or tab close discards it silently. Same for `settings/general` (store profile), `settings/business` (GSTIN/legal), `settings/payments`, `products/new` and `appearance`. Compounding: `SaveBar`'s Discard button (`feedback.tsx:580-588`) fires `onDiscard` immediately with **no ConfirmDialog** — losing unsaved work is one click.

### 20.8 Six parallel feedback systems, and the most compliant app is frozen

| App | Canonical adoption | Parallel system | Status |
|---|---|---|---|
| merchant-control-plane | Badge 131, Banner 76, EmptyState 71, Skeleton 101, useToast 73, ConfirmDialog 30, SaveBar 21 | `.admin-draft-banner`, `.admin-trial-toast`, `.all-stores-card-status`, `ProviderModeBadge`, `.te-field-error` | **the working reference** |
| storefront-runtime | EmptyState + Skeleton only | 70 raw palette classes, inline `rgb()` status maps | **the problem** (§20.2) |
| identity-platform | Banner on 4 pages | `.auth-error` on the 6 highest-traffic pages | **half-migrated** |
| platform-console | Badge/Banner/EmptyState + `Internal*` | `ConsoleDataTable.StatusBadge` (14 sites), `ConsoleApiErrorPanel` (35 sites) | **half-governed** |
| marketing-site | **zero** feedback primitives | 161 `.ctc-*`/`.ws-*`/`.cmap-*` selectors | **exempt-and-forked** |
| app-marketplace **[FROZEN]** | EmptyState/ConfirmDialog/Modal | complete `.marketplace-banner`/`-toast`/`-badge` trio (68 selectors) | frozen |
| developer-portal **[FROZEN]** | Badge + Skeleton | local `StatusBadge`, `.method-pill`, 102 token redefs | frozen |
| platform-operations-portal **[FROZEN]** | Badge/Banner/EmptyState/Table + `Internal*` | none (37-line globals.css) | frozen, near-clean |
| theme-marketplace **[FROZEN]** | ToastProvider app-wide, EmptyState + Skeleton | **none** — 0 feedback selectors, 0 token redefs | **the cleanest consumer in the repo** |

**`InternalStatusPill` is the one justified fork** — a defensible density affordance for operator consoles, fully tokenised, consumed only through pure delegation shims (`platform-console/_local-ui/console-workspace.tsx`, `platform-operations-portal/_local-ui/ops-workspace.tsx`), and hard-gated (§20.1). It should nonetheless have been an `EmptyState`/`Badge` *density variant*, not a parallel component: today the two cannot share copy, tone, or a future `error` kind, and it uses the wrong colour ramp (§16.3).

Two defects inside that otherwise-good fork:

- **A dropped prop makes platform-console less honest than the ops portal.** `console-workspace.tsx:84-93` declares `contract: string` as **required** and never forwards it: `return <InternalSkipBackendPanel title={title}>{children}</InternalSkipBackendPanel>;`. `ops-workspace.tsx:90-100` does it correctly. Via `internal-workspace.tsx:195-197` (`` {contract ? `Data source: ${contract}` : 'Data source is not connected.'} ``), `platform-console/(dashboard)/subscriptions/page.tsx:142` passes `contract="/v1/internal/console/invoices and /v1/internal/console/subscriptions/:id"` and the operator sees the generic "Data source is not connected." — the exact endpoint is silently discarded.
- **Two status pills coexist in one app.** The governed `InternalStatusPill` (34 sites) alongside the ungoverned `ConsoleDataTable.StatusBadge` (14 sites), which is dark-only (`border-zinc-800 bg-zinc-900`, `:33`) in direct violation of UI-R3's "*light AND dark mode*".

### 20.9 The status vocabulary itself is ungoverned

There are **no Postgres native enums** — `grep -rn "AS ENUM" --include=*.sql` over the repo returns **0**. Every status is `text` + a CHECK constraint (237 CHECK-ARRAY constraints in `000_baseline.sql` alone), and **no validator in `scripts/validators/` compares a DB CHECK to a TS `z.enum`**. That absence is the structural reason ~20 DB↔TS divergences accumulated undetected while the 107-validator gate stayed green.

The three widest, each with a UI consequence:

| Divergence | DB | TS | UI consequence |
|---|---|---|---|
| `orders.payment_status` | 4 values (`000_baseline.sql:10168`) | `PaymentStatusSchema` has **8** (`shared-types:639-648`) | Four TS-legal values would violate the CHECK on write. *(Corrected: because only 4 are reachable, the list/detail mappers agree on every one — this is a contract gap, not a rendered conflict.)* |
| Fulfilment | modelled **three ways**: `orders.fulfillment_status` (**no CHECK at all**, `:10145`), `orders.fulfillment_state` (8-value CHECK, `147:53-54`), `order_items.fulfillment_status` (4-value, `:10043`) | `FulfillmentStatusSchema` is a fifth list of 5 | `OrderSchema` carries **two** fulfilment fields with different vocabularies. `orders/[orderId]/page.tsx:244` hardcodes `variant="info"`, so all 5 values render identical blue |
| `collections.status` | **the column does not exist** (only `is_active boolean`, `:8733-8747`) | `CollectionStatusSchema` applied at `shared-types:1315` with `.default('draft')` | **Every collection reports 'draft' regardless of actual state** |

Also: `GiftCardStatusSchema` declares `'redeemed'`, which appears **nowhere else in the repo**, and omits `'held'` — the fraud-hold state the canonical writer actually uses (`173_v1_gift_card_issuance_lifecycle.sql:266`). `EmployeeStatusSchema` omits `'disabled'`, the only DB deactivation state, so `settings/users/page.tsx:113-117` labels `inactive`/`removed`/`suspended` all as amber **"Invited"**.

### 20.10 UI-R6's "systemic" honesty badge is not systemic

`AGENTS.md:293` UI-R6: "*A systemic `ProviderModeBadge` (web + Flutter) MUST render `mock/sandbox/live` truthfully on every money/fulfillment surface.*"

`grep -rn ProviderModeBadge packages/` → **0**. Two independent implementations exist:

- `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx:1` — `type ProviderMode = 'sandbox' | 'live'`
- `apps/mobile/merchant-app/lib/widgets/shared/provider_mode_badge.dart:5` — `enum ProviderMode { sandbox, live }`

**Both drop the mandated `mock` member**, and both render nothing on an unrecognised mode (`ProviderModeBadge.tsx:14` `if (!mode) return null`; `provider_mode_badge.dart:37` `SizedBox.shrink()`) — the ANTI-R9 failure shape. Mitigating: the gateway only ever emits `'sandbox' | 'live'` (`services/api-gateway/src/execution/queue-execution.adapter.ts:124`, `routes/payouts.ts:53`, `routes/settlements.ts:33`, `lib/store-payment-config.ts:95`), so no live `mock` value is silently swallowed today — the rule and the runtime disagree, and the runtime is narrower.

**Unmitigated: the customer-facing storefront checkout has no provider-mode badge at all.** `grep -rn ProviderMode apps/storefront-runtime/src` returns only unrelated iframe `sandbox` attributes (`app-block-slot.tsx:37`, `composition-engine.tsx:118`). The web badge also uses raw `text-[11px]` and `py-[2px]` (`ProviderModeBadge.tsx:19`) — px in TSX that the ratchet cannot see (`validate-design-system.mjs:128` PX_FONT matches only CSS `font-size: Npx`; `:131` ARBITRARY_RADIUS matches only `rounded-[...]`).

There is a `provider-mode-badge-validator.mjs`, but it only asserts that certain files *mention* `provider_mode` — it does not verify the value set, the surface coverage, or that the badge renders on an unknown mode.

### 20.11 Cross-platform: the token bridge exists, the component contract does not

`AGENTS.md:288` UI-R1 requires one token source with "*the Dart `ui_kit` [consuming] a **generated bridge** from it*". That bridge exists and is honoured — `apps/mobile/merchant-app/lib/theme/app_theme_colors.dart:4` imports `package:letbuyy_ui_kit/letbuyy_ui_kit.dart` (`LetbuyyColorTokens.*`).

But there is **no banner/callout/notice widget in Dart at all**: `packages/dart/ui_kit/lib/src/widgets/` contains `badge_widget.dart`, `empty_state.dart`, `empty_state_widget.dart`, `error_view.dart`, `error_widget.dart`, `confirmation_dialog.dart`, `loading_indicator.dart`, `shimmer_loading.dart` — and a grep for `Banner|banner` over `packages/dart/ui_kit/lib` returns zero files. So the Flutter merchant app falls back to Material `SnackBar` for events the web renders as persistent banners:

| Same tenant, same operation | Web | Mobile |
|---|---|---|
| Domain settings load failure | `settings/domains/page.tsx:172` — `<Banner variant="critical" title="Domains could not load" action={<Button>Retry</Button>}>` | `apps/mobile/merchant-app/lib/screens/settings/domain_settings_screen.dart:71` — `_showSnackBar('Could not load domain settings: $error')` |

Persistent + retry on one platform; transient + no retry on the other. Same for `customers_screen.dart:147` and `settings/custom_data_screen.dart:477`. **The token bridge covers colour; nothing covers component contract or state semantics.**

Separately, the **DTCG interchange file is not actually guarded**: `scripts/generators/generate-design-tokens.mjs:69-85` checks 15 hardcoded *primitive* anchors and asserts only that each literal appears somewhere in `tokens.ts` (`:91`). `color.semantic.dark.*` is never checked and **has drifted** — `tokens.json:81` dark.bg `#111827` vs `tokens.ts` ink[950] `#0a0912`; `:82` surface `#111827` vs ink[850] `#0d0b16`; `:84` card `#1F2937` vs ink[800] `#15131f`; `:85` sidebar `#0F172A` vs ink[900] `#0d0b15`; `:89` border `#334155` vs `rgba(139,92,246,0.18)`. `tokens.json` also carries **no `statusSoft`, no `statusText`, and no `ink`/`brandInk` primitives** — so Figma and the Flutter bridge cannot see any of the values that determine banner and badge contrast.

---

*Read-only audit. No file under `apps/`, `packages/`, `services/`, `config/`, `database/` or `scripts/` was created, modified, renamed or deleted.*
