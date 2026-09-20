# 05 — Classification, Gaps, Target Architecture, Migration

> Read-only research. Every count below was re-derived with `grep -rn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --include='*.tsx' apps`. The `.next/` exclusion matters: build output re-exports the whole `@letbuyy/ui` barrel and roughly doubles naive counts.
>
> Frozen apps (`app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal`) are labelled **[FROZEN]** inline and excluded from every active-product judgement.

---

## 21. Canonical vs Non-Canonical Components

### 21.1 The classification, with the evidence that decides it

Four verdicts are used. The dividing line between **VALID SPECIALIZATION** and **ACCIDENTAL DUPLICATION** is not "does a second implementation exist" — it is: *does the second implementation have a stated reason to differ, does it use the same token family for the same semantic, and is it enforced?*

| Component | Verdict | Decisive evidence |
|---|---|---|
| `Badge` — `packages/typescript/ui/src/feedback.tsx:69` | **CANONICAL** | 175 usages across 8 apps. Token-pure: `bg-[var(--lb-component-badge-accent-bg)]` / `--lb-component-banner-{info,success,warning,danger}-*` (`feedback.tsx:31-62`). Always emits a tone icon (`feedback.tsx:83`). Contrast passes AA in both themes (4.57–10.49 light, 6.54–8.92 dark). |
| `Banner` — `feedback.tsx:128` | **CANONICAL** | 133 element usages (134 `<Banner` hits minus one `<BannerCarousel` at `apps/storefront-runtime/src/components/sections/hero.tsx:71`). Sets `role={variant === 'critical' ? 'alert' : 'status'}` (`feedback.tsx:139`). Body text is neutral `--lb-color-text` at 14.52–16.15:1. |
| `EmptyState` — `feedback.tsx:516` | **CANONICAL** | 98 usages, 14 illustration kinds, full token integration (`--lb-component-empty-state-*`). |
| `Skeleton` — `feedback.tsx:291` | **CANONICAL** | 131 usages. |
| `SaveBar` — `feedback.tsx:554` | **CANONICAL (defective)** | 21 usages, sole implementation, no fork. But `feedback.tsx:569` hides the saved state with `opacity-0 pointer-events-none` — neither removes an element from the tab order — while the buttons are `disabled={state === 'saving'}` (`:585`, `:594`), i.e. *enabled* when saved. `feedback.tsx:577` renders the literal string `'Unsaved changes'` inside an `aria-live="polite"` region (`:572`) with no `'saved'` branch. |
| `ToastProvider` / `useToast` — `feedback.tsx:200` / `:278` | **CANONICAL, ADOPTED IN 1 ACTIVE APP** | 77 `useToast()` call sites: 73 merchant-control-plane, 4 theme-marketplace **[FROZEN]**. `ToastProvider` mounted only at `apps/merchant-control-plane/src/components/AdminShell.tsx:155` and `:187`, plus `apps/theme-marketplace/src/app/layout.tsx:139` **[FROZEN]**. Zero in storefront-runtime, identity-platform, platform-console, marketing-site. |
| `ConfirmDialog` — `overlays.tsx:508` | **CANONICAL (structurally incomplete)** | 31 usages. Inherits Modal's focus trap, Escape/outside dismissal, scroll lock. But `ConfirmDialogProps` (`overlays.tsx:496-506`) has exactly 9 props — no `loading`, no `confirmDisabled`; `onConfirm: () => void` is never awaited; `overlays.tsx:530` hardcodes `<Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>` with no `disabled`. |
| `Modal` / `Drawer` — `overlays.tsx:428` / `:138` | **CANONICAL** | 16 / 2 usages. `useFocusTrap` captures `document.activeElement`, applies `inert` + `aria-hidden` to body-level siblings, wraps Tab, restores focus (`overlay-hooks.ts:80-145`). Best-engineered part of the system. |
| `Spinner` — `primitives.tsx:634` | **CANONICAL** | 10 usages, all merchant-control-plane. Correct a11y: `role="status"` + `aria-label` + `sr-only` label + `aria-hidden` glyph (`primitives.tsx:636-638`). |
| `ProgressBar` — `primitives.tsx:443` | **CANONICAL** | 5 usages (3 identity-platform, 2 platform-operations-portal **[FROZEN]**). Correct `role="progressbar"` + `aria-valuemin/max/now`. |
| `InlineError` — `input.tsx:166` | **CANONICAL BUT UNADOPTED** | **Zero app consumers** — verified per-app across all 10 roots. Non-app references: `foundation-primitives.stories.tsx:18,117` and `tests/components/foundation.test.tsx:26,542`. It is the *only* field-error primitive with `role="alert"` (`input.tsx:170`). |
| `FilterChips` — `primitives.tsx:399` | **CANONICAL BUT UNADOPTED** | **Zero app consumers.** Non-app references: `primitives.stories.tsx:12,86,145,149` and `component-catalog.stories.tsx:23,353`. Zero test references. Lives in **`primitives.tsx`, not `productivity.tsx`** — the brief's module path is wrong. |
| `statusToBadgeVariant` — `feedback.tsx:94` | **DEAD CANONICAL** | Repo-wide grep returns exactly 3 lines: `index.ts:61` (barrel), `feedback.tsx:94` (definition), `feedback.tsx:118` (internal use by `StatusBadge`). Its own JSDoc (`feedback.tsx:89-93`) claims it is "the single source for status→tone logic (replacing the per-app StatusBadge/StatusPill forks)". That replacement never happened. |
| `StatusBadge` — `feedback.tsx:117` | **DEAD CANONICAL** | 18 `<StatusBadge` hits, but only **one** is this component: `apps/merchant-control-plane/src/app/[store]/settings/notifications/page.tsx:650-654` — and it passes `label={log.status}` **and** `variant={statusVariant(log.status)}` from a local mapper at `:147`, overriding the derivation. 14 resolve to a local fork via `import { ... StatusBadge } from '@/components/ConsoleDataTable'`; 3 to `developer-portal/src/components/_local-ui/developer-docs.tsx:68` **[FROZEN]**. Net: `statusToBadgeVariant` **never executes in the product.** |
| `warnDeprecated` — `deprecations.ts:11` | **DEAD CODE** | Sole reference repo-wide is its own definition. Not exported from `index.ts`. Absent from `snapshots/public-api.json`. It names no superseded API — the file the brief expected to enumerate deprecations enumerates none. |
| `Tooltip` — `overlays.tsx:552` | **DEAD CANONICAL** | 0 app usages. Also not portaled, so it can be clipped by `Card`'s `overflow-hidden` (`layout.tsx:680`). |
| `MarketplaceUnavailable` — `marketplace.tsx:20` | **DEAD FOR ACTIVE PRODUCT [FROZEN]** | Reachable only via the `@letbuyy/ui/marketplace` subpath; both consumers are frozen apps. Ships zero classes — every consumer re-invents the visual treatment. Carries `role="alert"` **and** `aria-live="polite"` on one node (`marketplace.tsx:37`), a contradictory pair. |

### 21.2 VALID SPECIALIZATION

**`InternalStatusPill` / `InternalEmptyDataState` / `InternalSkipBackendPanel` — `internal-workspace.tsx:146` / `:205` / `:178`.**

Verdict: **VALID SPECIALIZATION with a defective colour recipe.** This overturns the survey's "accidental duplication" reading, on three pieces of evidence the survey did not weigh:

1. **It is the only feedback fork in the repo with a hard, non-ratchet validator behind it.** `scripts/validators/validate-design-system.mjs:74-78` hardcodes the two consumer shim files, and `:163-167` fails the build if either grows a real implementation. Baseline metric `localWorkspaceImplementations: 0`.
2. **Operator density is a real constraint.** 62 pills ship (34 platform-console + 28 platform-operations-portal **[FROZEN]**). `apps/platform-console/src/app/(dashboard)/operations/page.tsx` stacks five empty-data panels on one page; five 260px `EmptyState` illustrations there would be absurd.
3. **Both consumers are pure delegation shims** — `apps/platform-console/src/components/_local-ui/console-workspace.tsx:80-82` and `apps/platform-operations-portal/src/components/_local-ui/ops-workspace.tsx:86-88` are one-line pass-throughs.

The specialization is legitimate. **The colour recipe is not.** `internal-workspace.tsx:165-168` uses the *raw 500-ramp* as foreground where `feedback.tsx:44-61` correctly uses the 700/800 `statusText` ramp:

```
internal-workspace.tsx:165  success: 'border-[var(--lb-color-success)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]'
feedback.tsx:44-46          success: bg-[var(--lb-component-banner-success-bg)] text-[color:var(--lb-component-banner-success-text)]
```

Same background (`#DCFCE7` light), different foreground (`#22C55E` vs `#15803D`). Measured contrast:

| Tone | Pill (light) | Badge (light) | Pill (dark) | Badge (dark) |
|---|---|---|---|---|
| success | **2.07 FAIL** | 4.57 PASS | 6.54 PASS | 6.54 PASS |
| warning | **1.93 FAIL** | 6.37 PASS | 6.79 PASS | 6.79 PASS |
| critical | **3.08 FAIL** | 5.30 PASS | **3.94 FAIL** | 7.82 PASS |
| info | **3.21 FAIL** | 5.84 PASS | **3.77 FAIL** | 8.32 PASS |

**Severity framing corrected from the survey.** Both consumers ship dark by default (`apps/platform-console/src/app/layout.tsx:43,46` and `apps/platform-operations-portal/src/app/layout.tsx:43,46` — `defaultTheme="dark"`). In the *default* rendering only critical (3.94) and info (3.77) fail AA. The sub-3:1 values apply to the user-selectable light theme, which is reachable (`defaultTheme`, not `forcedTheme`). Do not publish "62 pills at 1.93:1".

Also: `internal-workspace.tsx:172` writes `text-[var(--lb-font-size-caption)]` — a hint-less arbitrary utility. Compiled against the repo's `tailwindcss@4.3.0` this emits `color: var(--lb-font-size-caption)`, and `tailwind-merge@3.4.1` (via `cx`, `utils.ts:3`) classifies it in the text-**color** group and drops it in favour of the later tone class. Two consequences, both now **CONFIRMED** (the survey marked this UNPROVEN): the tone colour *is* applied, so the contrast failures above are real; and the pill ships with no font-size class at all and inherits.

### 21.3 ACCIDENTAL DUPLICATION

| Fork | Location | Why it is accidental, not specialized |
|---|---|---|
| `StatusBadge` (name collision) | `apps/platform-console/src/components/ConsoleDataTable.tsx:89-110` — **ACTIVE app** | Shadows the canonical export with an incompatible API (`{value, tone}` vs `{status, label, variant}`). Zero tokens: `green: 'bg-emerald-500/10 text-emerald-300'`, `amber:`, `red:`, `zinc:` (`:100-103`), on `'inline-flex items-center rounded px-2 py-1 text-xs font-medium'` (`:107`) — raw palette, raw radius, no border, **no icon**, dark-only. Its red list is `['suspended','cancelled','inactive','false']` (`:95`), so `failed`/`error`/`expired`/`declined` fall to neutral `zinc`: a **failed row renders grey**. Renders `{value}` raw (`:108`), so operators see `past_due`, `frozen`. Direct UI-R1 ("one token source") and UI-R7 breach. |
| `ProviderModeBadge` | `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx:13` | UI-R6 (`AGENTS.md:293`) calls this "a systemic `ProviderModeBadge` (web + Flutter)". `grep -rn ProviderModeBadge packages/` = 0 — it is **not in the design system**. Two independent implementations exist (this one and `apps/mobile/merchant-app/lib/widgets/shared/provider_mode_badge.dart`), both typed `'sandbox' \| 'live'` with **no `mock` member** despite the rule naming mock/sandbox/live, and both render nothing on an unknown value (`ProviderModeBadge.tsx:14 if (!mode) return null`) — the ANTI-R9 failure shape. Uses raw `text-[11px]` and `py-[2px]` (`:19`). |
| `StatusBadge` | `apps/developer-portal/src/components/_local-ui/developer-docs.tsx:61-71` **[FROZEN]** | Wraps the canonical `Badge` but re-derives tone locally and uppercases the label. |
| `StatusPill` | `apps/developer-portal/src/components/PortalChrome.tsx:52` **[FROZEN]** | Bare `<span className="developer-status skip\|live">` driven by `value.includes("SKIP")` string sniffing. 5 usages. |
| `.marketplace-banner` / `.marketplace-toast` / `.marketplace-badge` | `apps/app-marketplace/src/app/globals.css:2163-2310, 2482` **[FROZEN]** | A complete parallel Banner+Toast+Badge system in CSS. Iconless, `flex-direction: column`, 12px text, and it *inverts* the primitive's hierarchy (`strong` full-strength, `span` subdued — `:2293-2300`). `.marketplace-banner--info` is used 9 times in TSX and **has no CSS rule**, so all nine render untinted. |
| `.auth-error` | `apps/identity-platform/src/app/globals.css:497-512` | 9 uses, in the same app that uses `<Banner variant="critical">` on 6 other pages. Naked `rgba(239,68,68,.08)`, `border-radius: 10px`, `font-size: 13px`, plus `animation: errorShakeIn 0.4s ease-out`. identity-platform has **zero** `prefers-reduced-motion` rules, so the login error shakes for users who asked it not to (WCAG 2.3.3). |
| `.admin-draft-banner` / `.admin-trial-toast` | `apps/merchant-control-plane/src/app/globals.css:2110-2260` | A second Banner and a second Toast inside the *only* app that mounts `ToastProvider`. `.admin-draft-banner` uses naked `rgba(245,158,11,0.1)` where `--lb-component-banner-warning-bg` exists, and has no `.dark` variant. |
| `.all-stores-card-status` | `apps/merchant-control-plane/src/app/globals.css:1937-1954` | See §21.5 — this fork is not merely inconsistent, it is broken. |
| Hand-rolled checkout feedback | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:637, 731-815, 1004, 1080` | The single highest-value shopper surface renders every error, warning and success with raw palette. 92 raw semantic-palette class occurrences in storefront `.tsx`; `aria-invalid` = 0 and `aria-describedby` = 0 across the whole app. |

### 21.4 Two token families for one semantic, inside the design system

`@letbuyy/ui` ships **two** status colour families and both are exported:

- `--lb-component-banner-{info,success,warning,danger}-{bg,text,border}` → `Badge`, `Banner`, `Toast` (`feedback.tsx:31-62`)
- `--lb-color-{success,warning,critical,info}[-soft]` → `InternalStatusPill` (`internal-workspace.tsx:165-168`), `InternalSkipBackendPanel` (`:188`), `Box`/`Text` tone (`layout.tsx:85-93`, `:338-348`), `MetricCard` delta (`productivity.tsx:62-64`), `ProviderModeBadge` (`ProviderModeBadge.tsx:3-6`)

**Proof they render side by side in one flex row, on a money surface.** `apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx:363-367`:

```tsx
<div className="flex flex-wrap items-center justify-end gap-[var(--lb-space-2)]">
    <ProviderModeBadge mode={providerMode} />
    <Badge label={status.label} variant={status.variant} />
</div>
```

The sibling `Badge` variant is computed at `:321-325` (`verified → 'success'`, `key_id_masked → 'warning'`). So a verified live store shows **two green pills adjacent in different greens** (`#22C55E` vs `#15803D` on the same `#DCFCE7`); a saved sandbox store shows **two ambers** (`#F59E0B` vs `#92400E` on the same `#FEF3C7`). This is the only same-element proof of the token-family split in the codebase and it should lead the section.

Note also the naming seam: the variant is called `critical` but its tokens are called `danger` (`feedback.tsx:56-58` → `tokens.ts:456-458`). `apps/theme-marketplace/src/app/checkout/page.tsx:407` **[FROZEN]** guesses wrong and uses `--lb-component-banner-critical-{bg,text,border}` — verified used=1, defined=0 — so a failed theme purchase renders as unstyled text in a bare default-colour box.

### 21.5 A confirmed rendering bug in the store picker

`apps/merchant-control-plane/src/app/stores/AllStoresClient.tsx:165`:

```tsx
<span className={`all-stores-card-status ${store.status === 'active' ? 'active' : 'inactive'}`}>
    {store.status}
</span>
```

`store.status` is `sites.status`. The DB CHECK at `database/supabase/migrations/000_baseline.sql:12026` is `ARRAY['draft','published','unpublished','frozen','suspended']` — **`'active'` is not a member.** Therefore:

- `.all-stores-card-status.active` (`globals.css:1946-1949`, emerald) is **unreachable dead CSS**
- Every store card takes `.inactive` — `background: rgba(239,68,68,0.12); color: var(--error)` (`globals.css:1951-1954`) — so a healthy `published` store renders a **red pill labelled "published"**
- `const activeStores = stores.filter((s) => s.status === 'active')` (`AllStoresClient.tsx:70`) is always empty, so the "Active" tab always shows `'No active stores yet'` (`:73`)

`published` maps to `success`/green on four other merchant surfaces (`pages/page.tsx:68`, `online-store/pages/page.tsx:101`, `posts/page.tsx:91`, `dashboard/page.tsx:305`). This is a same-semantic, opposite-colour contradiction and it is the clearest live status bug found.

### 21.6 Live status-mapping conflicts that survived adversarial verification

Six of the survey's conflicts died on reachability (the value is DB-forbidden, or the other side is dead code, or the two sides are different entities). These four are proven live, with both sides reachable by one user:

| # | Conflict | Site A | Site B | Same-user proof |
|---|---|---|---|---|
| 1 | `draft` = grey vs amber | `pages/page.tsx:67-70` — falls through to `'default'` | `online-store/pages/page.tsx:100-103` — `if (status === 'draft') return 'warning'` | Both fetch `/api/stores/{store}/pages?limit=100` (`pages:97`, `online-store/pages:211`); both declare `PageStatus = 'draft'\|'published'\|'archived'`; **both are entries in the same `storeNavigation`** (`merchantNavigation.ts:149` "Content", `:167` "Store pages") |
| 2 | subscription status = green vs amber, red vs blue, grey vs blue | `platform-console/(dashboard)/subscriptions/page.tsx:57` → `ConsoleDataTable.tsx:89` fork (trialing→green, cancelled→red, expired→zinc) | `platform-console/(dashboard)/revenue/page.tsx:137` → `InternalStatusPill` (trialing→warning, cancelled→**info blue**, expired→**info blue**) | Both call `fetchConsoleApi('/internal/console/subscriptions')` (`revenue:46`, `subscriptions:91`); adjacent nav entries at `(dashboard)/layout.tsx:32,34` |
| 3 | `pending_cod` unmapped; `processing` indistinguishable from `confirmed` | `storefront-runtime/.../account/orders/orders-client.tsx:23-31` — no `pending_cod` key → grey `rgb(107 114 128)` + raw label `"Pending_cod"` (`:108`) + timeline stuck at step 0 (`:40-45`); `confirmed` and `processing` are **both** `rgb(59 130 246)` | `storefront-runtime/.../orders/orders-client.tsx:18-27` — `pending_cod` amber, label `'COD pending'`; `processing` `rgb(14 165 233)` | Both live shopper routes: `/account/orders` linked from `account-bottom-sheet.tsx:539`, `/orders` from `checkout-client.tsx:585`. `pending_cod` is written by a DB trigger (`074_cod_pending_status.sql:37,53`) and `app/api/customer/orders/route.ts:15-16` forwards it verbatim |
| 4 | `pending` grey vs amber; `rejected` grey vs red | `comments/page.tsx:66-70` — approved→success, spam→warning, else `'default'` | `reviews/page.tsx:70-74` — approved→success, pending→warning, else `'critical'` | Two adjacent merchant moderation queues (`merchantNavigation.ts:155`, `:142`), same pending/approved/rejected vocabulary |
| 5 | `expired` amber vs red | `products/gift-cards/page.tsx:98-102` → `'warning'` | `coupons/page.tsx:94-97` → `'critical'` | Both merchant stored-value/discount instruments; both render a Badge whose visible text is literally "Expired" |

**The naive-substring bug in `statusToBadgeVariant` is real but latent.** Executing `feedback.tsx:94-102` verbatim: `inactive`→success, `unpaid`→success, `unverified`→success, `unpublished`→success, `disconnected`→success, `unhealthy`→success, `not connected`→success, and `delivery_failed`→success (because `'delivery'` contains `'live'`). The cause is the success keyword list at `:97` being tested before the critical list at `:98`. Because the function has zero consumers, **this is a latent trap in the shared API, not a rendered defect** — but any app that migrates onto the canonical helper inherits it, and `"NOT CONNECTED"` is load-bearing vocabulary in this codebase.

---

## 22. Usage Matrix

Counts are element occurrences in `apps/**/*.tsx`, build directories excluded. `<Banner` shows 134 raw; 133 are real (`hero.tsx:71` is `<BannerCarousel`).

### 22.1 Canonical primitives

| Component | Canonical? | Variants | Colours (token family) | Locations (per app) | Usage | Problems |
|---|---|---|---|---|---|---|
| `Badge` `feedback.tsx:69` | **Yes** | 5 tones; no size/shape/icon/dismiss props | `--lb-component-badge-accent-*` (default) + `--lb-component-banner-{info,success,warning,danger}-*` | merchant 131 · platform-ops 10 **[FROZEN]** · platform-console 9 · app-mkt 9 **[FROZEN]** · dev-portal 8 **[FROZEN]** · identity 7 · storefront 1 | **175** | Bare `<span>`, no role/aria-label. `label: string` only. Icon not overridable, always rendered. `default` and `info` share the same `Info` glyph (`:36` vs `:42`) — distinguishable by hue alone. Icon lacks `shrink-0` (unlike Banner `:142`), so it squishes before the label wraps. `min-h` 28px @ compact — below any touch target, and `table.tsx:196` attaches `onClick` to it. |
| `Banner` `feedback.tsx:128` | **Yes** | 4 tones (`Exclude<StatusVariant,'default'>`) | `--lb-component-banner-*` | merchant 119 · identity 6 · platform-ops 5 **[FROZEN]** · platform-console 3 · storefront 0 · marketing 0 · app-mkt 0 **[FROZEN]** | **133** | **No dismiss prop at all** — 133/133 are undismissable; several are unconditional and therefore permanent (`settings/domains/page.tsx:177`, `settings/payments/page.tsx:455`, `settings/billing/page.tsx:281`). Action never stacks: `<div className="shrink-0">` (`:155`) with no `sm:` breakpoint, unlike EmptyState (`:537`), SaveBar (`:568`) and Modal footer (`overlays.tsx:487`). No max-width, so body copy runs the full 1440px `--lb-size-page-max`. Hardcoded `<h3>`. Unconditional `role="status"` makes permanent educational banners into permanent polite live regions. |
| `EmptyState` `feedback.tsx:516` | **Yes** | 14 `EmptyStateKind` — all domain nouns | `--lb-component-empty-state-*` | merchant 71 · app-mkt 8 **[FROZEN]** · theme-mkt 7 **[FROZEN]** · platform-console 5 · platform-ops 5 **[FROZEN]** · storefront 2 | **98** | **No `error`/`no-results`/`permission-denied` kind and no `retry` prop** — the type system cannot express *why* something is empty. 8 of 98 sites distinguish error from first-run; 43 offer no action at all. 51 pass `icon` without `kind`, putting a domain glyph on the generic motif (`:474-482`). 5 of 14 kinds are never selected. `body` is `string`, not ReactNode. No responsive rules at all. |
| `Skeleton` `feedback.tsx:291` | **Yes** | 3 (`text`/`card`/`table`) | `--lb-color-surface-subdued` | merchant 101 · theme-mkt 17 **[FROZEN]** · storefront 9 · dev-portal 4 **[FROZEN]** | **131** | `aria-hidden="true"` on all three variants (`:294`, `:306`, `:313`) with no `aria-busy` anywhere in the package. Only 13 `aria-busy` occurrences exist in merchant-control-plane against 101 skeletons; storefront 2, platform-console 0. **No animation** — no pulse, no shimmer; static grey blocks. `lines` silently ignored for `variant="card"`, which the package's own `table.tsx:241` then does. |
| `SaveBar` `feedback.tsx:554` | **Yes** | 3 states | `--lb-color-surface-raised` | merchant 21 | **21** | Saved state leaves two **enabled, tab-focusable, invisible** buttons and an `aria-live` region still reading "Unsaved changes". `sm:w-[min(920px,calc(100vw-24px))]` on a *sticky* (flow-positioned) element overflows its column at every width 640–1172px; fixed only for `.settings-content > main` (`globals.css:2859`), leaving 19 non-settings pages. No `env(safe-area-inset-*)` anywhere in merchant-control-plane. Discard fires with no confirmation. |
| `ToastProvider` / `useToast` `feedback.tsx:200`/`:278` | **Yes** | 4 tones × 6 placements | `--lb-color-surface-raised` + banner tones | merchant 73 · theme-mkt 4 **[FROZEN]** | **77** | Live region is created *with* its first message (`:218`, `:223`) — the classic pattern AT does not announce. Rendered in-tree, not portaled, so `setOutsideTreeInert` (`overlay-hooks.ts:58-66`) marks it `aria-hidden`+`inert` while any dialog is open. `role="alert"` nested inside `aria-live="polite"`. `aria-relevant="additions removals"` re-announces on expiry. No max-visible, no dedupe, no animation, no pause-on-hover; timer handle discarded (`:212`). **No `action` field** on `ToastMessage`, so none of the 154 critical toasts can offer Retry. |
| `ConfirmDialog` `overlays.tsx:508` | **Yes** | 2 (`destructive` bool) | inherits Button | merchant 30 · app-mkt 1 **[FROZEN]** | **31** | **No `loading`, no `disabled`, no error slot; `onConfirm` never awaited.** Every call site fakes progress in `confirmLabel` on a fully clickable button. Mobile `flex-col-reverse` (`overlays.tsx:486`) puts the full-width *destructive* button on top. Default body copy is operator-voiced: "This action can affect merchant data." |
| `Modal` `overlays.tsx:428` | **Yes** | none (fixed 640px) | `--lb-color-surface` | merchant 14 · app-mkt 2 **[FROZEN]** | **16** | Content region lacks `min-h-0 flex-1` that Drawer has (`:192` vs `:485`), so short dialogs bunch at the top of the mobile full-height sheet. Close button 32px. |
| `Drawer` `overlays.tsx:138` | **Yes** | 4 sides × 4 sizes | `--lb-color-surface` | merchant 2 | **2** | Scrim is a named `<button aria-label="Close drawer">` (`:158-164`) where Modal's is `<div aria-hidden>` (`:448`) — two answers to one question. `100vh` on bottom/full variants (`:116-133`), latent on iOS. |
| `Spinner` `primitives.tsx:634` | **Yes** | 3 sizes | `--lb-color-text-subdued` | merchant 10 | **10** | Double-labels the live region (`aria-label` + identical `sr-only`). `animate-spin` is not covered by the reduced-motion block. No tests. |
| `ProgressBar` `primitives.tsx:443` | **Yes** | none | `--lb-color-primary` | identity 3 · platform-ops 2 **[FROZEN]** | **5** | No indeterminate mode. Nameless progressbar when `label` omitted. Never used for a file transfer — there is no upload progress anywhere (`XMLHttpRequest`/`onUploadProgress` = 0 repo-wide). No tests. |
| `MetricCard` `productivity.tsx:27` | **Yes** | 3 delta tones | `--lb-color-{success,critical}` — **the other family** | merchant 11 · platform-ops 8 **[FROZEN]** · platform-console 4 | **23** | Delta is **colour-only** — no icon, no sign enforcement, no sr-only. `ai/page.tsx:255-256` passes `delta={\`${percentUsed}% used\`}` with the tone flipping on the same text. Light contrast 2.28 (positive) / 3.76 (negative), and merchant-control-plane is `forcedTheme="light"` (`layout.tsx:43,46`), so those *are* the shipped values. |
| `InlineError` `input.tsx:166` | **Yes** | none | `--lb-color-critical` | — | **0 app** | Zero app consumers; 2 story + 2 test refs. Accepts no `id`, so it cannot be an `aria-describedby` target — structurally unusable as a drop-in for the built-in field error. Its colour fails AA in light: `#EF4444` on `#FFFFFF` = **3.76:1** (on page bg `#F6F7F9` = 3.51). |
| `FilterChips` `primitives.tsx:399` | **Yes** | none | `--lb-component-badge-accent-*` | — | **0 app** | Zero app consumers; 3 story instantiations; **zero test refs**. Remove button is `h/w-[var(--lb-density-table-icon-size)]` = **14×14px** — below WCAG 2.2 AA SC 2.5.8's 24×24 (latent, since nothing uses it). `aria-label="Active filters"` sits on a role-less `<div>`. |
| `Tooltip` `overlays.tsx:552` | **Yes** | 2 sides | `--lb-color-text` inverse | — | **0 app** | Not portaled — clippable by `Card`'s `overflow-hidden` (`layout.tsx:680`). Content permanently in the a11y tree; visibility is opacity-only. |
| `statusToBadgeVariant` `feedback.tsx:94` | **Yes** | n/a | n/a | — | **0** | Naive `String.includes` with the success list first: `inactive`/`unpaid`/`unverified`/`unpublished`/`disconnected`/`unhealthy`/`not connected`/`delivery_failed` → **success**. Latent. |
| `StatusBadge` `feedback.tsx:117` | **Yes** | 5 | delegates to Badge | merchant 1 (and it overrides both `label` and `variant`) | **1 of 18** | The other 17 `<StatusBadge` hits are forks. |
| `warnDeprecated` `deprecations.ts:11` | **Yes** | n/a | n/a | — | **0** | Not in `index.ts`, not in the public-API snapshot, zero callers. Names no deprecated API. |

### 22.2 Non-canonical forks

| Component | Canonical? | Variants | Colours | Locations | Usage | Problems |
|---|---|---|---|---|---|---|
| `StatusPill` → `InternalStatusPill` `internal-workspace.tsx:146` | **Valid specialization, defective recipe** | 4 tones | `--lb-color-{tone}[-soft]` (raw 500 ramp as text) | platform-console 34 · platform-ops 28 **[FROZEN]** · dev-portal 5 **[FROZEN]** (different local component) | **67** | Fails AA on critical (3.94) and info (3.77) in the shipped dark theme; all four fail in light. No icon. Anonymous inline props type, so consumers cannot type a wrapper. `defaultTone` differs between the two shims (console `'info'` vs ops `'warning'`), so one unrecognised word is blue in one app and amber in the other. |
| `StatusBadge` `ConsoleDataTable.tsx:89` | **Accidental duplication** — ACTIVE app | 4 colour-named tones | raw `emerald/amber/red/zinc` | platform-console 14 | **14** | Name-collides with the canonical export. Zero tokens, raw radius, dark-only, no icon, no role. `failed`/`error`/`expired` → neutral grey. Renders raw enums. |
| `ConsoleApiErrorPanel` `ConsoleDataTable.tsx:144-151` | **Accidental duplication** — ACTIVE app | none | `--lb-color-warning[-soft]` | platform-console 35 | **35** | Backend failures titled "…API unavailable" render **warning**-toned with **no `role="alert"` and no `aria-live`**. platform-console has `role="alert"` = 0, `aria-live` = 0 across the entire app. (The 1.93:1 heading contrast the survey cited applies to the light theme only; the app defaults to dark, where it is 6.79:1 and passes.) |
| `ProviderModeBadge` `ProviderModeBadge.tsx:13` | **Accidental duplication** | 2 modes | `--lb-color-{warning,success}[-soft]` | merchant 4 (`settings/payments:365`, `settings/shipping:459`, `orders:784`, `billing/BillingPaymentMethods:166`) | **4** | Not in `@letbuyy/ui` despite UI-R6 calling it "systemic". No `mock` member. Returns `null` on unknown mode. Raw `text-[11px]`, `py-[2px]`. Renders in a different green/amber from the `Badge` immediately beside it. |
| `.auth-error` | **Accidental duplication** | none | naked `rgba(239,68,68,…)` | identity-platform 9 (`login:245,332`; `signup:523,596,706,708`; `lookup:508,602`; `onboarding:407`) | **9** | Same app uses `<Banner variant="critical">` on 6 other pages for the same 429/failure class. Shake animation with zero `prefers-reduced-motion` coverage in the app. Ironically *more* accessible than the DS path it bypasses (`role="alert" aria-live="assertive"`). |
| `.admin-draft-banner` / `.admin-trial-toast` | **Accidental duplication** | none | naked `rgba(245,158,11,…)`, raw `border-radius: 14px`, `z-index: 48` | merchant 2 + 1 | **3** | A second Banner and a second Toast in the app that mounts `ToastProvider`. No `.dark` override on the draft banner. TrialBanner's dismissal is `useState(false)` — not persisted, and it remounts on navigation. Its CTA is `href="#"` with `preventDefault` (`TrialBanner.tsx:69-75`). |
| `.all-stores-card-status` | **Accidental duplication + broken** | 2 | naked `rgba(…)`, `var(--error)` | merchant 1 | **1** | `'active'` is not in the `sites.status` CHECK — see §21.5. Every store is red. |
| `.marketplace-banner/-toast/-badge` | **Accidental duplication [FROZEN]** | 5 badge + 4 banner | token-based but structurally divergent | app-marketplace ~68 selectors, 25+ banner sites | **~92** | `--info` variant has no CSS rule. Iconless, column layout, inverted text hierarchy. |
| `.ctc-err` / `.ctc-success` / `.drf-error` | **Accidental duplication (EXILED)** | none | `var(--lb-color-critical)` | marketing-site 161 feedback selectors | **~161** | `apps/marketing-site` is exiled from the ratchet (`design-system-baseline.json` → `scope.exiledApps`), so its parallel system is unmeasured. `ContactForm.tsx` is nonetheless the **best** form implementation in the repo (focus-first-error at `:304-323`; 8 of the repo's 8 `aria-invalid` sites outside merchant). |
| Checkout inline errors | **Accidental duplication** | none | raw `text-red-500`, `bg-red-50` | storefront checkout 8 field errors + 3 banners | **11** | `#FB2C36` on white = 3.82:1 (fails AA). Zero `role`/`aria-live`/`aria-invalid`/`aria-describedby`/`htmlFor` in the whole 1160-line file. All 7 errors set in one `setState` (`:313-325`) with no focus move. |

### 22.3 App adoption profile

| App | Frozen? | Badge | Banner | EmptyState | Skeleton | Toast | ConfirmDialog | Raw palette (.tsx) | `role=alert` | `aria-invalid` | `aria-busy` | Error boundary |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| merchant-control-plane | no | 131 | 119 | 71 | 101 | 73 | 30 | **0** | 28 | 22 | 13 | error + global-error + not-found |
| storefront-runtime | no | 1 | **0** | 2 | 9 | **0** | **0** | **92** | 1 | **0** | 2 | error + global-error + not-found ×2 |
| identity-platform | no | 7 | 6 | **0** | 0 | **0** | **0** | 0 | 9 | 1 | 0 | **NONE** |
| platform-console | no | 9 | 3 | 5 | 0 | **0** | **0** | **134** | **0** | **0** | **0** | **NONE** |
| marketing-site | no (exiled) | 0 | **0** | **0** | 0 | **0** | **0** | 55 | 3 | 8 | 1 | **NONE** |
| app-marketplace | **FROZEN** | 9 | 0 | 8 | 0 | 0 | 1 | 0 | 18 | 0 | 1 | **NONE** |
| developer-portal | **FROZEN** | 8 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | error + not-found |
| theme-marketplace | **FROZEN** | 0 | 0 | 7 | 17 | 4 | 0 | 11 | 0 | 0 | 0 | **NONE** |
| platform-operations-portal | **FROZEN** | 10 | 5 | 5 | 0 | 0 | 0 | 38 | 0 | 0 | 0 | **NONE** |

Two readings jump out. **merchant-control-plane is the only app that actually consumes the design system**, and it is also the only app with zero raw palette classes in TSX. **platform-console is the worst active surface**: 134 raw palette occurrences and literally zero `role="alert"`, `aria-live`, `aria-invalid`, `aria-describedby` or `aria-busy` — on the platform's incident-response console.

---

