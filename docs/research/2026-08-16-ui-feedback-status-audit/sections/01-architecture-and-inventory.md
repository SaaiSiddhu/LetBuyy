# UI Feedback & Status System Audit — Part 1: Architecture and Inventory

## 2. Repository Scope Investigated

### 2.1 What was read

Read-only audit of every surface in the monorepo that communicates state, status or feedback to a
human. No file under `apps/`, `packages/`, `services/`, `config/`, `database/` or `scripts/` was
created, modified, renamed or deleted.

| Root | Contents | Feedback-relevant? |
|---|---|---|
| `packages/typescript/ui/src/` | 37 source files. Read in full: `feedback.tsx` (601), `input.tsx`, `overlays.tsx`, `primitives.tsx`, `productivity.tsx`, `internal-workspace.tsx` (211), `table.tsx` (397), `layout.tsx`, `button.tsx`, `controls.tsx`, `marketplace.tsx`, `deprecations.ts` (19), `icons.tsx`, `overlay-hooks.ts`, `tokens.ts`, `index.ts`, `theme-provider.tsx`, `design-system-root.tsx`, `token-style-boundary.tsx` | **Yes — the canonical layer** |
| `packages/typescript/api-client/` | `src/index.ts` (5,852 lines) — `LetbuyyApiError` at :3686-3706, `request<T>()` at :5537-5569 | Yes — error contract origin |
| `packages/typescript/api-types/` | Re-export barrel only; defines no status vocabulary | No |
| `apps/` (10 roots) | See §2.2 | Yes |
| `services/` (11 roots) | `find services -name '*.tsx'` returns **0** — no UI. `services/api-gateway/src/lib/supabase.ts:112-145` and `src/middleware/security.ts:90-129` read for the error envelope + sanitiser | Error envelope only |
| `database/supabase/migrations/` | 237 `CHECK … = ANY (ARRAY[…])` status constraints in `000_baseline.sql` alone; `147_executable_order_state_risk.sql`, `142_executable_payment_sessions.sql`, `146_…`, `151_…`, `159_…` read for authoritative enum values. `grep -rn "AS ENUM" --include=*.sql` returns **0** — there are no Postgres native enums | Yes — status source of truth |
| `packages/dart/ui_kit/lib/src/widgets/` + `apps/mobile/merchant-app/lib/widgets/shared/` | Flutter parity: `badge_widget.dart`, `empty_state.dart`, `error_view.dart`, `confirm_dialog.dart`, `loading_indicator.dart`, `shimmer_loading.dart`, `provider_mode_badge.dart`. **No banner/callout widget exists** (`grep -i banner packages/dart/ui_kit/lib` = 0) | Yes — divergent generation |
| `scripts/validators/` | `validate-design-system.mjs` + `design-system-baseline.json` read in full for what the gate does and does not measure | Governance |
| Root `AGENTS.md` | UI-R1..UI-R7 at :288-294 quoted verbatim where cited | Governance |

### 2.2 Application scope and status

| App | Status | Feedback posture (one line) |
|---|---|---|
| `apps/merchant-control-plane` | **ACTIVE** | The reference consumer. Only app with a mounted `ToastProvider` on the main product surface. Still ships a local Banner, local Toast, local status pill and local `ProviderModeBadge`. |
| `apps/storefront-runtime` | **ACTIVE — customer-facing** | Consumes only `EmptyState` + `Skeleton`. Zero `Badge`, zero `Banner`, zero toast, zero `ConfirmDialog`. 70 raw semantic-palette classes in `.tsx`, 28 in `checkout-client.tsx` alone. |
| `apps/identity-platform` | **ACTIVE — auth** | Split: `Banner` on 4 password-recovery pages, an app-local `.auth-error` CSS class on login/signup/lookup. Zero toast. |
| `apps/platform-console` | **ACTIVE — internal ops** | Consumes `Badge`/`Banner`/`EmptyState`/`Internal*`, **and** ships a name-colliding local `StatusBadge` (14 sites) + `ConsoleApiErrorPanel` (35 sites). |
| `apps/marketing-site` | **ACTIVE but EXILED from the ratchet** | Zero feedback primitives. 161 bespoke `.ctc-*` / `.ws-badge-*` feedback CSS selectors. `scripts/validators/design-system-baseline.json` `"exiledApps": ["apps/marketing-site"]`; `validate-design-system.mjs:50` `EXILED_APP_ROOTS = new Set(['apps/marketing-site'])`. |
| `apps/mobile/merchant-app` | **ACTIVE (Flutter)** | Generated Dart token bridge; `SnackBar` where web uses a persistent Banner. |
| `apps/app-marketplace` | **FROZEN** | Complete parallel `.marketplace-banner` / `.marketplace-toast` / `.marketplace-badge` CSS system (68 selectors, 25 render sites). |
| `apps/developer-portal` | **FROZEN** | Local `StatusBadge` shadow + `.developer-status` / `.method-pill--*` CSS. |
| `apps/theme-marketplace` | **FROZEN** | Ironically the cleanest consumer in the repo: `ToastProvider` app-wide, zero feedback CSS, zero `--lb-*` redefinitions. |
| `apps/platform-operations-portal` | **FROZEN / pending consolidation** | Consumes `Badge`/`Banner`/`EmptyState`/`Internal*`; 37-line `globals.css` with no feedback CSS. |

Frozen-app findings are labelled **[FROZEN]** inline throughout and are excluded from every
active-product count.

### 2.3 Measurement methodology and a correction to the brief

The usage counts supplied in the audit brief were inflated roughly 2× because they included
`.next/` build output — `apps/*/.next/dev/server/app/page.js` re-exports the entire `@letbuyy/ui`
barrel, so `InlineError`, `FilterChips` and every other export appear there as compiled
re-exports, not call sites. **Every count in this report excludes `node_modules`, `.next`, `dist`
and `build`, and counts JSX elements (`<Component`) over `apps/*/src` only.**

| Symbol | Brief | Verified (`apps/*/src`, build output excluded) |
|---|---|---|
| `<Badge` | 175 | 151 |
| `<Banner` | 134 | 85 (the 134 included `<BannerCarousel`) |
| `<EmptyState` | 98 | 91 |
| `<Skeleton` | 131 | 131 |
| `<SaveBar` | 21 | 21 |
| `useToast()` | 146 | 73 call sites / 155 matching lines |
| `<ConfirmDialog` | 31 | 31 |
| `<Spinner` | 10 | 10 |
| `<ProgressBar` | 5 | 5 |
| `<StatusBadge` | 18 | 18 — but only **1** is the canonical component |
| `<InlineError` | 0 | **0 app consumers** (2 test + 2 story references inside the package) |
| `<FilterChips` | 0 | **0 app consumers** (6 story references inside the package) |

Two further corrections to the brief's own primitive map:

- `Spinner`, `ProgressBar` and `FilterChips` live in
  `packages/typescript/ui/src/primitives.tsx` (:634, :443, :399) — **not** `productivity.tsx`.
  `productivity.tsx` contains only `Avatar`, `CommandPalette`, `FilterBar`, `MetricCard`,
  `Pagination`.
- `packages/typescript/ui/src/deprecations.ts` **names no superseded APIs**. It is 19 lines
  containing a single `warnDeprecated()` helper (`:11`) with **zero callers repo-wide**, not
  exported from `index.ts`, and absent from `snapshots/public-api.json`.

### 2.4 What could not be proven

- **Liquid-authored feedback markup — UNPROVEN.** `find apps -name "*.liquid"` returns 0. Theme
  bundles live in the database, so any feedback markup authored in Liquid was unauditable from
  source.
- **Runtime rendering — UNPROVEN.** No app was built or rendered and no screen reader was run.
  Every claim is derived from source reading; runtime-dependent inferences are marked
  **PLAUSIBLE** at the point of use.
- **`COMPONENT_DUPLICATION_REPORT.md`** — cited by `feedback.tsx:92` as the authority for the
  status-mapping consolidation. It does not exist in the repo. The citation is dangling.

---

## 3. Current UI Feedback Architecture

### 3.1 The pipeline that exists

The token layer is a single, well-ordered pipeline, and it is genuinely unified: nine web apps
mount `LetbuyyThemeProvider`, which renders `DesignSystemRoot`
(`packages/typescript/ui/src/design-system-root.tsx:19-50`), which injects one
`<style data-letbuyy-token-source="true">` via `token-style-boundary.tsx:24-27`.

```
┌─ STAGE 1 — PRIMITIVES ────────────────────────────────────────────────────────────┐
│ tokens.ts:47-174  letbuyyPrimitiveTokens                                          │
│   green[100]=#DCFCE7 green[500]=#22C55E green[700]=#15803D green[950]=#052E16     │
│   amber[100]=#FEF3C7 amber[500]=#F59E0B amber[800]=#92400E amber[950]=#422006     │
│   red[100]=#FEE2E2   red[300]=#FCA5A5   red[500]=#EF4444   red[700]=#B91C1C       │
│   blue[100]=#E0F2FE  blue[300]=#7DD3FC  blue[500]=#3B82F6  blue[700]=#1D4ED8      │
└───────────────────────────────┬───────────────────────────────────────────────────┘
                                v
┌─ STAGE 2/3 — SEMANTIC (per theme) ────────────────────────────────────────────────┐
│ tokens.ts:283-300 (light) / :347-364 (dark)                                       │
│   status.*      = the RAW 500 ramp   (identical light and dark)                    │
│   statusText.*  = the 700/800 ramp   (light) / 300-500 ramp (dark)  <- accessible  │
│   statusSoft.*  = the 100 ramp       (light) / 950 ramp (dark)                     │
│ NOTE the naming seam: authored as `danger`, aliased downstream as `critical`.     │
└───────────────┬───────────────────────────────────┬───────────────────────────────┘
                v                                   v
   ┌─ COMPONENT TOKENS ─────────────┐   ┌─ FLAT SEMANTIC ALIASES ────────────────┐
   │ tokens.ts:446-459 / :535-548   │   │ tokens.ts:1104-1112                    │
   │ --lb-component-banner-         │   │ --lb-color-success       = #22C55E     │
   │   {info,success,warning,       │   │ --lb-color-success-soft  = #DCFCE7     │
   │    danger}-{bg,text,border}    │   │ --lb-color-warning       = #F59E0B     │
   │ --lb-component-badge-accent-*  │   │ --lb-color-critical      = #EF4444     │
   │ (bg=soft, text=statusText,     │   │ --lb-color-info          = #3B82F6     │
   │  border=raw status)            │   │ (text = the RAW ramp)                  │
   └───────────────┬────────────────┘   └───────────────┬────────────────────────┘
                   │                                    │
                   │  ACCESSIBLE PAIR (4.57-6.37:1)     │  RAW PAIR (1.93-3.21:1 light)
                   v                                    v
┌─ STAGE 4 — PRIMITIVES (packages/typescript/ui/src) ───────────────────────────────┐
│                                                                                   │
│  statusStyles  feedback.tsx:31-62  ── ONE map, THREE components ──────────────┐   │
│      │                                                                        │   │
│      ├─> Badge          feedback.tsx:69    151 app uses                       │   │
│      ├─> Banner         feedback.tsx:128    85 app uses                       │   │
│      └─> Toast item     feedback.tsx:239    73 useToast() call sites          │   │
│                                                                               │   │
│  InternalStatusPill  internal-workspace.tsx:146  ── SECOND, RAW-RAMP map ─────┤   │
│      └─> 62 app uses (34 platform-console + 28 platform-operations-portal)    │   │
│                                                                               │   │
│  statusToBadgeVariant  feedback.tsx:94  "the single source for status->tone"  │   │
│      └─> ZERO app consumers.  Never executes in the product.                  │   │
└───────────────────────────────┬───────────────────────────────────────────────┴───┘
                                v
┌─ STAGE 5 — DOMAIN / APP WRAPPERS ─────────────────────────────────────────────────┐
│                                                                                   │
│  CANONICAL DELEGATION (correct)                                                   │
│    console-workspace.tsx:80   StatusPill      -> InternalStatusPill  [gate-locked]│
│    ops-workspace.tsx:86       StatusPill      -> InternalStatusPill  [FROZEN]     │
│    domains/parts.tsx:18-23    DomainStatusBadge/SslBadge -> Badge                 │
│    orders/page.tsx:163-170    OrderStatusBadge/PaymentStatusBadge -> Badge        │
│    storefront-states.tsx:14   StorefrontEmptyState -> EmptyState (token-bridged)  │
│                                                                                   │
│  FORKS (bypass the canonical layer entirely)                                      │
│    ConsoleDataTable.tsx:89    StatusBadge  -> raw bg-emerald-500/10  (14 sites)   │
│    ConsoleDataTable.tsx:144   ConsoleApiErrorPanel -> plain <section> (35 sites)  │
│    ProviderModeBadge.tsx:13   -> raw --lb-color-{warning,success} family          │
│    TrialBanner.tsx:29         -> .admin-trial-toast CSS (fixed bottom-right card) │
│    AdminShell.tsx:261,:280    -> .admin-draft-banner CSS (naked rgba)             │
│    developer-docs.tsx:68      StatusBadge  -> Badge + local mapper      [FROZEN]  │
│    app-marketplace globals.css:2278  .marketplace-banner/.marketplace-toast       │
│                                                     (25 render sites) [FROZEN]    │
│    identity globals.css:497   .auth-error  (9 render sites)                       │
└───────────────────────────────┬───────────────────────────────────────────────────┘
                                v
┌─ STAGE 6 — FEATURE USAGE ─────────────────────────────────────────────────────────┐
│  39 local status->tone functions across 6 apps                                    │
│  (statusVariant / statusTone / toneForStatus / severityTone / *StatusVariant)     │
│  e.g. orders/page.tsx:155, pages/page.tsx:67, online-store/pages/page.tsx:100,    │
│       payouts/page.tsx:43, gift-cards/page.tsx:98, coupons/page.tsx:94, ...       │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 The three structural facts that define the architecture

**Fact 1 — the shared status mapper is dead code.** `statusToBadgeVariant`
(`feedback.tsx:94-102`) documents itself at `:89-93` as *"the single source for status→tone logic
(replacing the per-app StatusBadge/StatusPill forks)"*. A repo-wide search over
`apps/`, `packages/` and `services/` returns exactly three lines: the definition (`feedback.tsx:94`),
the barrel export (`index.ts:61`), and its own internal use inside `StatusBadge` (`feedback.tsx:118`).
The single canonical `<StatusBadge>` call site in all of `apps/` —
`apps/merchant-control-plane/src/app/[store]/settings/notifications/page.tsx:650-654` — passes
`variant={statusVariant(log.status)}` from a local mapper at `:147`, overriding the derivation.
**The function never executes in the product.** Every claim of the form "app X disagrees with the
canonical mapper" is therefore a latent trap, not a rendered conflict, and is reported as such
throughout this document.

**Fact 2 — `@letbuyy/ui` ships two status-pill token families.** They use the *same* background and
*different* foregrounds for the same tone:

| | Badge / Banner / Toast | `InternalStatusPill` |
|---|---|---|
| Source | `feedback.tsx:44-61` | `internal-workspace.tsx:164-169` |
| success | `--lb-component-banner-success-text` `#15803D` on `#DCFCE7` | `--lb-color-success` `#22C55E` on `#DCFCE7` |
| warning | `#92400E` on `#FEF3C7` | `#F59E0B` on `#FEF3C7` |
| critical | `#B91C1C` on `#FEE2E2` | `#EF4444` on `#FEE2E2` |
| info | `#1D4ED8` on `#E0F2FE` | `#3B82F6` on `#E0F2FE` |
| Light contrast | 4.57 / 6.37 / 5.30 / 5.84 — **all pass AA** | 2.07 / 1.93 / 3.08 / 3.21 — **all fail AA** |
| Dark contrast | 6.54 / 6.79 / 7.82 / 8.32 — **all pass** | 6.54 / 6.79 / **3.94** / **3.77** |

Both consumers of `InternalStatusPill` default to **dark**
(`apps/platform-console/src/app/layout.tsx:43,:46` and
`apps/platform-operations-portal/src/app/layout.tsx:43,:46` both pass `defaultTheme="dark"`), so
in the shipped default rendering only `critical` and `info` fail. The sub-3:1 light values are
reachable because these are `defaultTheme`, not `forcedTheme`.

**Fact 3 — the surface system does not touch status colour.** `adminSurfaceIdentity`
(`tokens.ts:1140-1249`) was scanned in full: **zero** matches for
`success|warning|critical|danger|info|banner`, in either theme. Neither `platform-console` nor
`platform-operations-portal` `globals.css` declares any `--lb-color-{success,warning,critical,info}`
or `--lb-component-banner-*`. Every status colour in this report is therefore **surface-invariant**
— any cross-app difference a user perceives comes from app CSS or raw palette classes, not from the
design system. What the surface layer *does* change is the neutral `default` badge:
`--lb-component-badge-accent-*` is desaturated ink `#362C58` in `merchant-control-plane` and product
violet `#6D28D9` everywhere else (`tokens.ts:1178-1180` vs `:442-444`).

### 3.3 What the governance gate measures — and what it cannot see

`scripts/validators/validate-design-system.mjs` walks `apps/` **only** and exempts
`packages/typescript/ui` as the token layer. Its ten ratchet metrics
(`appCssRawHex`, `appCssNakedRgbHsl`, `tailwindPaletteClasses`, `appLocalLbTokenRedefs`,
`rawPxFontSize`, `rawPxSpacing`, `tsxInlineStyles`, `tsxRawHex`, `tsxArbitraryRadius`,
`tsxArbitraryShadow`) are all lexical colour/px/radius/shadow counters. **Not one asks whether a
feedback surface uses the canonical component.**

Consequences, all verified:

- A hand-rolled `<div className="marketplace-toast">` costs **zero** ratchet points, because
  `app-marketplace/src/app/globals.css:2278-2310` is spelled entirely in `--lb-*` tokens.
- The 39 forked `statusVariant()` functions are 100% token-clean and score zero drift.
- `apps/marketing-site` — which carries the single largest parallel feedback system in the repo —
  is exempt by name.
- The two contradictory status-pill token families in §3.2 live inside the exempt package.
- The gate is currently **green and improving**: 9 of 10 metrics are below baseline
  (`appLocalLbTokenRedefs` 339 → 275, `tsxRawHex` 5 → 0). **Nothing in this report will surface
  through CI.**

The one exception, and the only hard (non-ratchet) validator for a feedback fork, is the
`Internal*` workspace system: `validate-design-system.mjs:76-79` hardcodes
`console-workspace.tsx` and `ops-workspace.tsx` and `:163-167` fails the build if either grows a
real shell implementation (baseline `localWorkspaceImplementations: 0`). That gate covers only the
workspace *shell* — it does not cover `ConsoleDataTable.tsx`, which is where platform-console's
actual data feedback lives.

Binding rules from root `AGENTS.md` that bear on everything below:

> **UI-R1** (`AGENTS.md:288`) — One token source … MUST NOT introduce a second/third token source.
> **UI-R3** (`:290`) — Every screen MUST support light AND dark mode (reachable, not just wired),
> skeleton loading, empty, error-with-retry, focus, hover, active, and disabled states.
> **UI-R4** (`:291`) — MUST meet WCAG AA; no migration may regress accessibility.
> **UI-R6** (`:293`) — A systemic `ProviderModeBadge` (web + Flutter) MUST render
> `mock/sandbox/live` truthfully on every money/fulfillment surface.
> **UI-R7** (`:294`) — The drift ratchet MUST BLOCK new drift … MUST NOT add naked rgb()/hsl(),
> raw px, or arbitrary radius where a `--lb-*` token exists.

---

## 4. Complete Component Inventory

Every feedback/status-relevant component discovered. "Canonical?" means: exported from
`@letbuyy/ui` and intended as the shared implementation. Usage counts are JSX elements over
`apps/*/src`, build output excluded.

### 4.1 Canonical primitives — `packages/typescript/ui`

| Name | File:line | Package/App | Purpose | Canonical? | Usage |
|---|---|---|---|---|---|
| `StatusVariant` (type) | `ui/src/feedback.tsx:29` | `@letbuyy/ui` | The 5-member tone union every feedback primitive keys off | ✅ | n/a |
| `statusStyles` (private) | `ui/src/feedback.tsx:31-62` | `@letbuyy/ui` | The tone→(surface,text,border,icon) table. **The actual visual contract.** Not exported | ✅ (private) | 3 internal |
| `Badge` | `ui/src/feedback.tsx:69` | `@letbuyy/ui` | Canonical status pill. Always renders a tone icon (`:83`) | ✅ | **151** |
| `statusToBadgeVariant` | `ui/src/feedback.tsx:94` | `@letbuyy/ui` | Status string → tone. Self-documented as the single source | ✅ | **0 app** |
| `StatusBadge` | `ui/src/feedback.tsx:117` | `@letbuyy/ui` | 1-line `Badge` wrapper adding auto tone derivation | ✅ | **1** (of 18 `<StatusBadge` hits) |
| `Banner` | `ui/src/feedback.tsx:128` | `@letbuyy/ui` | In-page inline message block. **No dismiss prop** | ✅ | **85** |
| `ToastProvider` | `ui/src/feedback.tsx:200` | `@letbuyy/ui` | Transient notification host | ✅ | **3 mounts** |
| `useToast` | `ui/src/feedback.tsx:278` | `@letbuyy/ui` | `{ notify, dismiss }`. `dismiss` destructured **0 times** in apps | ✅ | **73 call sites** |
| `Skeleton` | `ui/src/feedback.tsx:291` | `@letbuyy/ui` | Loading placeholder. `aria-hidden` on all 3 variants; **no animation** | ✅ | **131** |
| `EmptyState` | `ui/src/feedback.tsx:516` | `@letbuyy/ui` | Zero-data surface, 14 domain `kind`s | ✅ | **91** |
| `EmptyStateIllustration` | `ui/src/feedback.tsx:492` | `@letbuyy/ui` | Illustration half of `EmptyState` | ✅ | 0 external |
| `SaveBar` | `ui/src/feedback.tsx:554` | `@letbuyy/ui` | Sticky unsaved-changes bar with Save/Discard | ✅ | **21** |
| `InlineError` | `ui/src/input.tsx:166` | `@letbuyy/ui` | Inline field error. **The only error primitive with `role="alert"`** | ✅ | **0 app** |
| `Spinner` | `ui/src/primitives.tsx:634` | `@letbuyy/ui` | Indeterminate loader. `role="status"` + sr-only label | ✅ | **10** |
| `ProgressBar` | `ui/src/primitives.tsx:443` | `@letbuyy/ui` | Determinate progress. No indeterminate mode | ✅ | **5** |
| `FilterChips` | `ui/src/primitives.tsx:399` | `@letbuyy/ui` | Removable filter chips with real `<button aria-label>` remove | ✅ | **0 app** |
| `ConfirmDialog` | `ui/src/overlays.tsx:508` | `@letbuyy/ui` | Destructive confirmation. **No `loading`, no `error` slot** | ✅ | **31** |
| `Modal` | `ui/src/overlays.tsx:428` | `@letbuyy/ui` | Base dialog; focus trap + inert-outside + scroll lock | ✅ | 16 |
| `Drawer` | `ui/src/overlays.tsx:138` | `@letbuyy/ui` | Side/bottom sheet | ✅ | 2 |
| `Tooltip` | `ui/src/overlays.tsx:552` | `@letbuyy/ui` | Hover/focus hint. Not portaled — clippable | ✅ | **0 app** |
| `Popover` | `ui/src/overlays.tsx` | `@letbuyy/ui` | Anchored overlay | ✅ | **0 app** |
| `DropdownMenu` | `ui/src/overlays.tsx` | `@letbuyy/ui` | Menu | ✅ | **0 app** |
| `Table` (loading/empty) | `ui/src/table.tsx:91` | `@letbuyy/ui` | Owns its own loading + empty feedback. **No `error`/`onRetry` prop** | ✅ | 28 data-mode |
| `TableFilterChip` (type) | `ui/src/index.ts:11` | `@letbuyy/ui` | Table-bound chip type | ✅ | **0 app** |
| `MetricCard` | `ui/src/productivity.tsx:27` | `@letbuyy/ui` | KPI tile; `deltaTone` is a 6th tone vocabulary | ✅ | 23 |
| `Chart` (no-data) | `ui/src/primitives.tsx:69` | `@letbuyy/ui` | "No chart data". **Only empty state with `role="status"`** | ✅ | internal |
| `CommandPalette` (empty) | `ui/src/productivity.tsx:362` | `@letbuyy/ui` | "No commands found" | ✅ | internal |
| `Button` (`loading`) | `ui/src/button.tsx:46` | `@letbuyy/ui` | Pending-action feedback. `interactiveDisabled = disabled \|\| loading` (`:63`) | ✅ | 69 `loading=` |
| `Box.tone` / `Text.tone` | `ui/src/layout.tsx:85` / `:319` | `@letbuyy/ui` | Two more tone vocabularies (7 and 9 members) | ✅ | — |
| `InternalStatusPill` | `ui/src/internal-workspace.tsx:146` | `@letbuyy/ui` | Operator status pill. Different token family, no icon | ⚠️ second canonical | **62** |
| `InternalEmptyDataState` | `ui/src/internal-workspace.tsx:205` | `@letbuyy/ui` | Third empty-state impl. `message: string` is the entire API | ⚠️ second canonical | **56** |
| `InternalSkipBackendPanel` | `ui/src/internal-workspace.tsx:178` | `@letbuyy/ui` | "Not available / Data source is not connected." honesty panel | ⚠️ second canonical | ~8 |
| `InternalMetric` / `InternalTone` | `ui/src/internal-workspace.tsx:43` / `:4` | `@letbuyy/ui` | Operator KPI + a 5th tone union | ⚠️ | 36 |
| `MarketplaceUnavailable` | `ui/src/marketplace.tsx:20` | `@letbuyy/ui/marketplace` | Error-with-retry. **Ships zero classes.** Both consumers FROZEN | ⚠️ subpath-only | 2 [FROZEN] |
| `warnDeprecated` | `ui/src/deprecations.ts:11` | `@letbuyy/ui` | Deprecation warner. Not in `index.ts`, not in the snapshot | ❌ dead | **0 repo-wide** |

### 4.2 App-local components (forks and wrappers)

| Name | File:line | App | Purpose | Canonical? | Usage |
|---|---|---|---|---|---|
| `StatusBadge` (fork) | `platform-console/src/components/ConsoleDataTable.tsx:89` | platform-console | Status pill. **Name-collides with the canonical export.** Raw `bg-emerald-500/10 text-emerald-300` etc., no icon | ❌ reimplements | **14** |
| `ConsoleApiErrorPanel` | `platform-console/src/components/ConsoleDataTable.tsx:144` | platform-console | Backend-failure panel. Plain `<section>`, **no `role="alert"`, no `aria-live`** | ❌ reimplements Banner | **35** |
| `StatusPill` | `platform-console/src/components/_local-ui/console-workspace.tsx:80` | platform-console | Delegates to `InternalStatusPill`. Correct — but drops `contract` at `:92` | ✅ wraps | 34 |
| `SkipBackendPanel` | `platform-console/.../console-workspace.tsx:84-93` | platform-console | Declares `contract: string` required and **never forwards it** | ⚠️ wraps (buggy) | ~5 |
| `StatusPill` / `EmptyDataState` | `platform-operations-portal/src/components/_local-ui/ops-workspace.tsx:86` / `:103` | ops-portal **[FROZEN]** | Correct delegation, forwards `contract` at `:99` | ✅ wraps | 28 / 21 |
| `ProviderModeBadge` | `merchant-control-plane/src/components/ProviderModeBadge.tsx:13` | merchant | UI-R6 honesty badge. **Not in `@letbuyy/ui`.** Raw `text-[11px]`, `py-[2px]`. No `mock` member. Returns `null` on unknown mode (`:14`) | ❌ reimplements | 4 |
| `TrialBanner` | `merchant-control-plane/src/components/TrialBanner.tsx:11` | merchant | Plan upsell. `.admin-trial-toast` CSS, `border-radius:14px`, `z-index:48` (both untokenised). CTA is `href="#"` + `preventDefault` (`:69-75`) | ❌ reimplements | 1 (dashboard only) |
| `.admin-draft-banner` | `merchant-control-plane/src/components/AdminShell.tsx:261` & `:280` | merchant | App-wide draft warning. CSS at `globals.css:2110-2120`, naked `rgba(245,158,11,0.1)`, **no `.dark` override** | ❌ reimplements Banner | 2 (duplicated markup) |
| `OrderStatusBadge` / `PaymentStatusBadge` | `merchant-control-plane/src/app/[store]/orders/page.tsx:163` / `:167` | merchant | Wrap canonical `Badge`; tone from local `statusVariant` at `:155` | ✅ wraps | 2 |
| `DomainStatusBadge` / `SslBadge` | `merchant-control-plane/src/components/domains/parts.tsx:18` / `:22` | merchant | Wrap canonical `Badge`; tone from `lib/domains/domain-model.ts:37` | ✅ wraps | 4 |
| `StorefrontEmptyState` / `StorefrontLoadingState` | `storefront-runtime/src/components/storefront/storefront-states.tsx:14` / `:47` | storefront | **The model pattern**: token-bridges `EmptyState` onto the merchant theme namespace | ✅ wraps | 12 |
| `.auth-error` | `identity-platform/src/app/globals.css:497-517` | identity | Auth error callout. `rgba(239,68,68,.08)`, `errorShakeIn` animation, **no `prefers-reduced-motion` guard in that file** | ❌ reimplements Banner | **9** |
| `.select-meta-status--*` | `identity-platform/src/app/globals.css:2217-2259` | identity | Store-picker status. Local mapper at `select/page.tsx:116-122` | ❌ reimplements Badge | 1 |
| `.all-stores-card-status` | `merchant-control-plane/src/app/globals.css:1937-1954` | merchant | Store-picker status pill | ❌ reimplements Badge | 1 — **see §5.4** |
| `StatusBadge` (fork) | `developer-portal/src/components/_local-ui/developer-docs.tsx:68` | developer-portal **[FROZEN]** | Wraps canonical `Badge` but re-derives tone at `:61`. Label is `status.toUpperCase()` | ⚠️ wraps + forks mapper | 3 |
| `StatusPill` | `developer-portal/src/components/PortalChrome.tsx:52` | developer-portal **[FROZEN]** | `.developer-status` span driven by `value.includes("SKIP")` string sniffing | ❌ reimplements | 3 |
| `.marketplace-banner` / `.marketplace-toast` / `.marketplace-badge` | `app-marketplace/src/app/globals.css:2278-2310`, `:2163-2193`, `:2482` | app-marketplace **[FROZEN]** | Complete parallel Banner+Toast+Badge system. Token-based but iconless, `flex-direction: column`, inverted text hierarchy | ❌ reimplements | 25 banner/toast + 37 badge |
| `QualityBadge` / `PricingTag` | `app-marketplace/src/components/QualityBadge.tsx:10` / `PricingTag.tsx:45` | app-marketplace **[FROZEN]** | Trust/label chips | ❌ reimplements Badge | 2 |
| `.ctc-err` / `.ctc-success` / `.ctc-alert` | `marketing-site/src/app/globals.css:12244`, `:12449`, `:12408` | marketing-site **[EXILED]** | Form feedback. `.ctc-err` uses `--lb-color-critical` but has **no icon and no `role`** | ❌ reimplements InlineError | 9 |
| `LegalStatusBanner` / `ArticleCompletionBanner` / `TrustPills` | `marketing-site/src/components/legal/LegalStatusBanner.tsx:12`, `resources/ArticleCompletionBanner.tsx:8`, `TrustIndicators.tsx:23` | marketing-site **[EXILED]** | Bespoke banners/pills; `TrustPills` uses inline `style={{background: p.color}}` from hardcoded `rgb()` at `:9-14` | ❌ reimplements | 3 |
| `announcement-bar` | `storefront-runtime/src/components/layout/announcement-bar.tsx:90` | storefront | **The only true global announcement surface in the product.** Merchant-supplied colours applied inline at `:79-85` with **no contrast validation** | ❌ (no canonical equivalent) | 1 |
| `provider_mode_badge.dart` | `apps/mobile/merchant-app/lib/widgets/shared/provider_mode_badge.dart:24` | mobile (Flutter) | Second `ProviderModeBadge`. `enum ProviderMode { sandbox, live }` — also drops `mock` | ❌ parallel | — |

### 4.3 Dead / unreachable components (verified zero import sites)

| Name | File:line | Note |
|---|---|---|
| `StoreDirectoryIndexTable` | `platform-console/src/app/(dashboard)/stores/StoreDirectoryIndexTable.tsx:55` | Canonical `Badge`+`EmptyState`+`Table`. **Zero imports.** The live route uses the fork. |
| `SubscriptionManagementIndexTable` | `platform-console/.../subscriptions/SubscriptionManagementIndexTable.tsx:83` | Same. Zero imports. |
| `TrustSafetyIndexTable` | `platform-console/.../trust-safety/TrustSafetyIndexTable.tsx:79` | Same. Zero imports. |
| `TicketIndexTable` | `platform-operations-portal/.../support/TicketIndexTable.tsx:90` | **[FROZEN]** Same. Zero imports. |
| `AppBlockSlotPanel` | `merchant-control-plane/src/components/theme-editor/AppBlockSlotPanel.tsx` | Zero imports; no `dynamic(`/`lazy(` reference. Its grey NOT-CONNECTED div at `:372` never renders. |
| `AICustomizationPanel` | `merchant-control-plane/src/components/theme-editor/AICustomizationPanel.tsx` | Zero imports. Its `<Banner variant="warning" title="Not yet connected">` at `:663` never renders. |
| `.admin-skeleton` | `merchant-control-plane/src/app/globals.css:6001-6006` | Superseded generation of `<Skeleton>`. Zero consumers repo-wide. |
| `warnDeprecated` | `ui/src/deprecations.ts:11` | Zero callers, not exported, not in the public-API snapshot. |

**Note:** `OnboardingQueueIndexTable` and `CommunicationTemplateIndexTable` in
platform-operations-portal **are** imported (`operations/onboarding/page.tsx:27,:220` and
`operations/communications/page.tsx:18,:249`) and must not be listed as dead.

---

## 5. Pills / Badges / Chips / Tags Audit

### 5.1 Eleven implementations of one concept

| # | Implementation | File:line | Icon? | Token family | Status |
|---|---|---|---|---|---|
| 1 | `Badge` / `StatusBadge` | `ui/src/feedback.tsx:69`, `:117` | ✅ always (`:83`) | `--lb-component-banner-*` + `--lb-component-badge-accent-*` | Canonical |
| 2 | `InternalStatusPill` | `ui/src/internal-workspace.tsx:146` | ❌ | `--lb-color-*` / `-soft` | Second canonical, inside the same package |
| 3 | `FilterChips` chip | `ui/src/primitives.tsx:408` | ❌ | `--lb-component-badge-accent-*` | Canonical, **0 app consumers** |
| 4 | `Table` filter chip | `ui/src/table.tsx:196` | ✅ (wrong one — `Info`) | inherits `Badge` | Canonical component, **misused** |
| 5 | `StatusBadge` (fork) | `platform-console/.../ConsoleDataTable.tsx:89` | ❌ | raw `emerald/amber/red/zinc` | Fork, 14 sites |
| 6 | `ProviderModeBadge` | `merchant-control-plane/src/components/ProviderModeBadge.tsx:13` | ❌ | `--lb-color-*` / `-soft` | Fork, 4 sites |
| 7 | `.all-stores-card-status` | `merchant-control-plane/src/app/globals.css:1937` | ❌ | naked `rgba()` | Fork, 1 site — **broken, §5.4** |
| 8 | `.marketplace-badge--*` | `app-marketplace/src/app/globals.css:2163-2193` | ❌ | `--lb-*` | **[FROZEN]** fork, 37 sites |
| 9 | `.select-meta-status--*` | `identity-platform/src/app/globals.css:2217` | ❌ | `--lb-*` | Fork, 1 site |
| 10 | `.developer-status` / `.method-pill--*` | `developer-portal/src/app/globals.css:649`, `:1797` | ❌ | app-local green identity | **[FROZEN]** fork |
| 11 | `provider_mode_badge.dart` | `apps/mobile/merchant-app/lib/widgets/shared/provider_mode_badge.dart:24` | ❌ | generated Dart bridge | Parallel platform |

### 5.2 The geometry disagrees, not just the colour

| | `Badge` (`feedback.tsx:75`) | `InternalStatusPill` (`internal-workspace.tsx:172`) | `ConsoleDataTable.StatusBadge` (`:107`) |
|---|---|---|---|
| Shape | `rounded-[var(--lb-radius-full)]` | `rounded-[var(--lb-radius-full)]` | `rounded` (**not** full) |
| Height | `min-h-[var(--lb-density-pill-height)]` = 28px compact | none — content height (~26px) | `py-1` |
| Shrink | shrinkable | `shrink-0` — forces horizontal overflow | default |
| Padding | `px-2 py-1` (tokens) | `px-2 py-1` (tokens) | `px-2 py-1` (raw scale) |
| Font | `--lb-font-size-badge` (12px) | `--lb-font-size-caption` (12px) | `text-xs` (raw) |
| Label | as passed | `value.replace(/_/g, ' ')` (`:173`) — lowercase | `{value}` **raw enum** (`:108`) |

Three consequences: in a narrow mobile table card `Badge` wraps into a two-line stadium while
`InternalStatusPill` overflows horizontally; the console fork prints raw lowercase enum values
(`past_due`, `frozen`, `pending_cod`) directly to operators; and only `Badge` carries an icon, so
console/ops status is **colour-only** — a WCAG 1.4.1 exposure across 14 + 62 pills.

### 5.3 Proven rendered conflicts

Only conflicts where **both sides render** and **the status value is reachable** are listed. Six
conflicts asserted in the survey were refuted on reachability grounds and are recorded in §5.5.

**Conflict A — `draft` is grey on one merchant Pages screen and amber on the other.**

```
apps/merchant-control-plane/src/app/[store]/pages/page.tsx:67-71
    function statusVariant(status: string) {
        if (status === 'published') return 'success' as const
        if (status === 'archived')  return 'critical' as const
        return 'default' as const            // <- draft = NEUTRAL GREY
    }

apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:100-104
    function statusVariant(status: PageStatus) {
        if (status === 'published') return 'success' as const
        if (status === 'draft')     return 'warning' as const   // <- draft = AMBER
        return 'default' as const
    }
```

Proof they are the same entity: both fetch `/api/stores/${store}/pages?limit=100`
(`pages/page.tsx:97`, `online-store/pages/page.tsx:211`); both declare
`'draft' | 'published' | 'archived'` (`pages:29`, `online-store:10`); the shared route
`apps/merchant-control-plane/src/app/api/stores/[store]/pages/route.ts:6` normalises exactly those
three. Proof one merchant sees both: `merchantNavigation.ts:149` (`path: 'pages'`, "Content") and
`:167` (`path: 'online-store/pages'`, "Store pages") are both in `storeNavigation`.
**Severity: medium.** Draft is the single most common merchant state in the product.

**Conflict B — subscription status renders two different ways inside platform-console, off the same
endpoint, from adjacent nav entries.** This is the sharpest live conflict found.

```
apps/platform-console/src/app/(dashboard)/subscriptions/page.tsx:57
    cell: (row) => <StatusBadge value={row.status || 'active'} />
        -> ConsoleDataTable.tsx:91-96  trialing=green  cancelled=red  past_due=amber  expired=zinc

apps/platform-console/src/app/(dashboard)/revenue/page.tsx:137
    <StatusPill value={row.status || 'active'} />
        -> internal-workspace.tsx:157-163  trialing=warning(amber)  past_due=warning
                                           cancelled=UNMATCHED -> defaultTone 'info' (BLUE)
                                           expired=UNMATCHED -> 'info' (BLUE)
```

Same data: `revenue/page.tsx:46` and `subscriptions/page.tsx:91` both call
`fetchConsoleApi<ConsolePaginatedResponse<ConsoleSubscription>>('/internal/console/subscriptions', …)`.
Same nav group: `(dashboard)/layout.tsx:32` "Revenue" and `:34` "Subscriptions".
Net: `trialing` = green vs amber; `cancelled` = **red vs blue**; `expired` = grey vs blue.
**Severity: high** — a cancelled subscription reads as informational blue on the revenue view.

**Conflict C — two different greens and two different ambers as immediate siblings on a money
surface.**

```
apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx:363-368
    <div className="flex flex-wrap items-center justify-end gap-[var(--lb-space-2)]">
        <ProviderModeBadge mode={providerMode} />          // --lb-color-success  #22C55E
        <Badge label={status.label} variant={status.variant} />  // banner-success-text #15803D
    </div>
```

The sibling `Badge` variant comes from `:321-325`
(`razorpay?.verified ? 'success' : razorpay?.secret_configured ? 'warning' : 'default'`), so a
verified live store shows **two green pills side by side in different greens on the same
background** (`#DCFCE7`), and a saved sandbox store shows two ambers (`#F59E0B` vs `#92400E` on
`#FEF3C7`). This is the only same-element proof of the two-token-family split.
**Severity: medium-high** — it is on the payment credentials surface.

**Conflict D — `expired` is amber for gift cards and red for coupons.**

```
apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx:98-102
    if (status === 'expired' || status === 'held') return 'warning'   // AMBER

apps/merchant-control-plane/src/app/[store]/coupons/page.tsx:94-97
    if (isExpired(coupon)) return 'critical'                          // RED
```

Both render a `Badge` whose visible text is literally "Expired"
(`gift-cards:94-96` `statusLabel`, `coupons:88-91` `statusLabel`), both are merchant-facing
stored-value/discount instruments, both mean the instrument no longer works. **Severity: low-medium.**

**Conflict E — moderation verdicts disagree between two adjacent merchant queues.**

```
apps/merchant-control-plane/src/app/[store]/comments/page.tsx:66-70
    approved -> 'success';  spam -> 'warning';  else (pending, rejected) -> 'default'  // GREY

apps/merchant-control-plane/src/app/[store]/reviews/page.tsx:70-74
    approved -> 'success';  pending -> 'warning';  else (rejected) -> 'critical'       // RED
```

`pending` = grey vs amber; `rejected` = grey vs red. Both are live UGC moderation queues in
`storeNavigation` (`merchantNavigation.ts:155` comments, `:142` reviews). **Severity: medium** — a
moderator cannot learn one colour language.

**Conflict F — the shopper's own order list drops `pending_cod` entirely.**

```
apps/storefront-runtime/.../account/orders/orders-client.tsx:23-31   statusColors
    confirmed: 'rgb(59 130 246)',  processing: 'rgb(59 130 246)',   // IDENTICAL blue
    refunded:  'rgb(107 114 128)'
    // NO pending_cod key -> :104-105 falls back to grey, :108 prints "Pending_cod"
    // timelineIndex (:40-45) returns -1 -> progress tracker stuck at step 0

apps/storefront-runtime/.../orders/orders-client.tsx:18-27              statusConfig
    processing:  { color: 'rgb(14 165 233)' },
    pending_cod: { color: 'rgb(245 158 11)', label: 'COD pending' },
    refunded:    { color: 'rgb(100 116 139)' }
```

`pending_cod` is a real, DB-trigger-written value
(`database/supabase/migrations/074_cod_pending_status.sql:37,:53`) and
`apps/storefront-runtime/src/app/api/customer/orders/route.ts:15-16` returns `payload.orders`
verbatim with no normalisation. Both routes are live shopper surfaces
(`account-bottom-sheet.tsx:539` links `/account/orders`; `checkout-client.tsx:585` links `/orders`).
**Severity: high** — a COD shopper on the account view sees a grey pill reading `Pending_cod` and a
progress bar at step 0.

### 5.4 A live rendering bug on the merchant store picker

```
apps/merchant-control-plane/src/app/stores/AllStoresClient.tsx:165-167
    <span className={`all-stores-card-status ${store.status === 'active' ? 'active' : 'inactive'}`}>
        {store.status}
    </span>

apps/merchant-control-plane/src/app/globals.css:1946-1954
    .all-stores-card-status.active   { background: rgba(16, 185, 129, 0.12); color: rgb(16 185 129); }
    .all-stores-card-status.inactive { background: rgba(239, 68, 68, 0.12);  color: var(--error); }
```

`store.status` is `sites.status`, whose DB CHECK is
`ARRAY['draft','published','unpublished','frozen','suspended']`
(`database/supabase/migrations/000_baseline.sql:12026`). **`'active'` is not a member.** The test can
never be true, so:

- `.active` (emerald) is unreachable dead CSS;
- `const activeStores = stores.filter((s) => s.status === 'active')` (`AllStoresClient.tsx:70`) is
  always empty;
- **every store renders as a red "inactive" pill**, including a healthy `published` one, with the
  raw lowercase label — while `published` maps to green `success` on four other merchant surfaces
  (`pages/page.tsx:68`, `online-store/pages/page.tsx:101`, `posts/page.tsx:91`,
  `dashboard/page.tsx:305`).

**Severity: high.** This is a same-semantic, opposite-colour contradiction and a live bug on the
first screen a multi-store merchant sees.

### 5.5 The latent trap in the canonical mapper

`statusToBadgeVariant` (`feedback.tsx:94-102`) matches by unanchored `String.includes`, testing the
**success** keyword list *first* (`:97`) and the critical list second (`:98`). The function body was
executed verbatim; these negated statuses all resolve to **`success` / green**:

`inactive` (contains `active`) · `unpaid` (contains `paid`) · `unverified` (contains `verified`) ·
`incomplete` (contains `complete`) · `unpublished` (contains `published`) · `unresolved` ·
`unhealthy` · `disconnected` and `not connected` (contain `connected`) · `not live` ·
**`delivery_failed`** (because `delivery` contains `live`).

`inactive` is a real `EmployeeStatusSchema` member
(`packages/shared-types/src/index.ts:1908`), and `NOT CONNECTED` is load-bearing honesty vocabulary
in this codebase. **However: this function has zero app consumers, so it does not currently ship a
wrong colour anywhere.** It is a latent trap in the shared API that any app migrating onto the
canonical helper inherits — exactly the ANTI-R9 "stub-reads-as-success" failure mode, sitting in
the component whose own JSDoc claims to be the single source of truth.

**Conflicts refuted during verification and deliberately omitted from §5.3:**
order `fulfilled`/`returned` list-vs-detail (neither value is writable — `checkout-core` allows
only confirmed/processing/shipped/delivered/cancelled/refunded); payment-status fallback inversion
(only 4 values pass `orders_payment_status_check`, and both mappers agree on all four);
`archived` on the two Pages screens (`online-store/pages/page.tsx:186` filters archived out
entirely); `active` reservations-vs-locations (different state machines);
`cancelled` orders-vs-campaigns (different entities); `trialing` "five renderings" (three of the
five are dead code or the never-executed canonical mapper); `frozen` "three mappings" (two are dead
code); storefront out-of-stock vs merchant inventory (both agree that red = out of stock — this is
raw-palette drift, not a semantic conflict).

### 5.6 Chips and tags

There are **three** chip surfaces in the package and **zero** shared implementation:

| Surface | File:line | Remove affordance | Keyboard accessible? |
|---|---|---|---|
| `FilterChips` | `primitives.tsx:399-434` | real `<button aria-label={`Remove ${chip.label}`}><X/></button>` at `:412-419` | ✅ | 
| `Table` filter chip | `table.tsx:196` | `<Badge … onClick={chip.onRemove} />` | ❌ |
| `FilterBar` | `productivity.tsx:225` | opaque `chips?: React.ReactNode` slot | n/a |

`table.tsx:196` renders
`<Badge key={chip.label} label={chip.label} variant="info" onClick={chip.onRemove} />`. `Badge` is a
bare `<span>` (`feedback.tsx:73-86`), so the click handler lands on a non-interactive element with
**no `role`, no `tabIndex`, no key handler, no focus ring, and no visible "×"** — the rendered icon
is the `info` tone's `Info` glyph (`feedback.tsx:42`), which reads as decoration, not "remove".
Keyboard and screen-reader users cannot remove a table filter. Affected merchant surfaces:
`customers/page.tsx:397`, `products/page.tsx:399`, `orders/page.tsx:655`,
`products/inventory/page.tsx:358`.

The accessible implementation already exists and is unused: `FilterChips` has **0 app consumers**
(verified per-app across all 10 roots, frozen apps included; also zero in `services/`, `tools/`,
`config/`, `database/`, `scripts/`, `packages/dart/` and `apps/mobile/`). Its only references
anywhere are 6 story lines inside the package: `primitives.stories.tsx:12,:86,:145,:149` and
`component-catalog.stories.tsx:23,:353`. **It has zero test references.**
**Severity: high** (an accessibility regression against UI-R4, with the fix already written and
shipped).

`FilterChips`' own remove button is `h-[var(--lb-density-table-icon-size)]` = **14×14px**
(`primitives.tsx:412`), below WCAG 2.2 AA SC 2.5.8's 24×24 minimum — latent only because the
component is unused.

---

## 6. Alert / Banner Audit

### 6.1 API and the structural gaps

`Banner` — `packages/typescript/ui/src/feedback.tsx:121-158`.

```ts
export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    children: React.ReactNode;
    variant?: Exclude<StatusVariant, 'default'>;
    action?: React.ReactNode;
}
```

Four props. Verified by reading the full component:

| Gap | Evidence |
|---|---|
| **No dismiss of any kind** | No `dismissible`/`onDismiss` prop, no close control in the JSX (`:128-158`). The toast in the *same file* does have one (`:260-268`, `aria-label="Dismiss notification"`). |
| **Icon not overridable** | Hard-wired per variant in `statusStyles` (`:36,42,48,54,60`), all `aria-hidden="true"`. |
| **Action never stacks** | `{action && <div className="shrink-0">{action}</div>}` (`:155`) — no `flex-wrap`, no `flex-col`, no `sm:` breakpoint. |
| **No measure cap** | Root has no `max-w-*` (`:133-138`), so body copy runs the full `--lb-size-page-max` (1440px). `EmptyState` correctly caps at 440px (`:526`). |
| **Heading level fixed** | Title is a hardcoded `<h3>` (`:146-150`). |
| **Role is unconditional** | `role={variant === 'critical' ? 'alert' : 'status'}` (`:139`) fires on every mount, including permanently-rendered informational banners. |

**Responsive proof.** Three sibling primitives in the same package *do* stack on mobile; `Banner`
alone does not:

```
feedback.tsx:537  EmptyState actions: 'flex flex-wrap justify-center gap-[var(--lb-space-2)]'
feedback.tsx:568  SaveBar:            'flex-col items-stretch … sm:flex-row sm:items-center'
overlays.tsx:487  Modal footer:       'flex flex-col-reverse … [&>button]:w-full sm:flex-row'
feedback.tsx:155  Banner action:      'shrink-0'                       <- no breakpoint
```

At 360px inside `.settings-content > main` (mobile padding 16px, `globals.css:2954-2957`), the
worst production case — `settings/users/page.tsx:307-311`,
`<Banner variant="warning" title="You've reached your staff limit" action={<Button>Upgrade plan</Button>}>`
— leaves roughly 143px of message column for a 30-character title plus a two-sentence body. The
button compounds it: `Button` has a fixed `h-[var(--lb-density-button-height)]` (36px) and no
`whitespace-nowrap` (`button.tsx:41,67`), so a squeezed label wraps out of its own rounded box. The
other 40 action-Banners survive only because their label is the 5-character "Retry".

### 6.2 What Banner is actually used for

85 uses. Variant distribution: **critical 92, warning 17, info 15, success 4, computed 5**
(the 92/85 mismatch reflects multi-line JSX; the ratio is the finding). Of 112 unique title
strings, only 30 are non-error; 58 match load-failure wording.

**`Banner` is not an announcement device in this product — it is an error printer.**

| Purpose | Count | Representative sites |
|---|---|---|
| Page-level load failure (`critical` + Retry) | ~58 | `settings/domains/page.tsx:172`, `settings/payments/page.tsx:344`, `settings/taxes/page.tsx:444`, `coupons/page.tsx:347`, `posts/page.tsx:401` — 40 near-identical copies |
| Section-level load failure | ~7 | `products/operations-dashboard/page.tsx:178,:258,:334,:403` |
| Inline form/save error | ~36 | `products/new/page.tsx:771`, `settings/shipping/page.tsx:427`, `orders/page.tsx:640`. **8 of these are titled literally `"Error"`** |
| Setup / onboarding (unconditional) | 5 | `settings/domains/page.tsx:177`, `settings/payments/page.tsx:455`, `settings/billing/page.tsx:281` |
| Verification / KYC (state-machine driven) | 1 | `settings/business/page.tsx:432` — the only banner whose variant derives from server state |
| Destructive warning | 4 | `marketing/page.tsx:775`, `settings/apps/AppsSettingsClient.tsx:257` |
| Success confirmation | 7 | `products/new/page.tsx:777`, `accept-invite/page.tsx:68`, `products/gift-cards/page.tsx:433` |
| Provider-mode / honesty | ~6 | `marketing/page.tsx:753` "Sandbox mode is active" |
| **Global/system announcement** | **0** | — |
| **Maintenance notice** | **0** | — |
| **Promotional** | **0** | — |

There is **no mechanism anywhere to tell merchants about a platform incident or maintenance
window**: `AdminShell.tsx` renders only the draft banner (`:261`, `:280`) and `<TrialBanner>`
(`:291-294`), and a search of `merchant-control-plane` for maintenance/incident/system-status
surfaces returns only two unrelated CSS comments (`globals.css:708`, `:2451`).

### 6.3 Dismissal and persistence

**133 of 133 Banner uses cannot be dismissed at all.** Dismissal is not merely unpersisted — the
affordance does not exist. Consequences, all verified as unconditional renders:

| Permanent, unkillable banner | Site |
|---|---|
| "Use your own domain" | `settings/domains/page.tsx:177` — shown even to a merchant who already connected one |
| "Before going live" | `settings/payments/page.tsx:455` |
| "Keep your billing address India-ready" | `settings/billing/page.tsx:281` |
| "Data-loss note" | `settings/apps/AppsSettingsClient.tsx:257` |
| N× "Required contract detail" | `components/settings/BackendNeededPane.tsx:77` (unbounded `.map()`) |

Exactly one Banner in the product fakes dismissal, via the `action` slot:
`products/gift-cards/page.tsx:433-436` passes
`action={<Button variant="ghost" onClick={() => setIssuedCard(null)}>Dismiss</Button>}`. That is
arguably correct — the body says the full code is shown only once.

`grep -rn "dismissed|setDismissed|onDismiss" apps/**/*.tsx` returns **four lines, all in
`TrialBanner.tsx`** (`:13,:15,:16,:51`). `TrialBanner` dismissal is `useState(false)` — no
localStorage, no cookie, no API — and the component unmounts on navigation because
`AdminShell.tsx:290` gates it on `pathname?.endsWith('/dashboard')`, so dismissing it and returning
re-shows it **in the same session**. The storefront `AnnouncementBar`
(`announcement-bar.tsx:90-108`) has no dismiss control at all; its only off-switch is the merchant
editing the theme setting or its `startsAt`/`endsAt` window (`:51-59`) — the only time-bounded
banner mechanism in the product, and `Banner` has no equivalent.

### 6.4 Stacking and ordering

There is **no ordering system**. `PageProps` (`layout.tsx:398-400`) is `{ children }` — no banner
region, no priority, no cap. Banners are ordinary JSX children in source order inside `Page`
(`layout.tsx:402-413`), separated by `--lb-density-page-gap`.

The only structural slot holds exactly **one** banner, and it is pinned above everything:
`components/settings/SettingsPane.tsx:56-60` renders `{guidance && <Banner …>}` between
`<PageHeader>` and `{children}`. Ordering is therefore whatever the author typed, and it is
inconsistent:

| Page | Rendered order |
|---|---|
| `settings/payments/page.tsx` | **info** guidance (`:332`, from the shell) → critical (`:344`) → critical (`:354`) → **warning** (`:455`, unconditional, *below* a Card) |
| `settings/domains/page.tsx` | critical (`:172`) → info (`:177`) |
| `settings/taxes/page.tsx` | info guidance (`:414`) → critical (`:444`) → critical (`:454`) → metrics grid → whole Card → **warning "Unsaved tax setting"** (`:503`) |

So the least urgent message is structurally pinned to the top, and on taxes a blocking
"save before editing rates" warning renders *below* the card it refers to.

No cap exists. `products/operations-dashboard/page.tsx` can show five criticals at once — a
page-level summary at `:160` plus four section-level at `:178,:258,:334,:403` — with no visual
distinction between summary and part, because `Banner` has no size or emphasis variant.
`BackendNeededPane.tsx:75-80` maps an unbounded array of banners **all sharing the title
"Required contract detail"**; its consumer `settings/custom-data/page.tsx:16-20` passes three.

### 6.5 Accessibility

| Finding | Evidence |
|---|---|
| Role is implicit and undocumented | `feedback.tsx:139`; no `aria-live`, no `aria-atomic`. `role` is written *before* `{...props}` (`:140`), so a consumer can silently override it. |
| Only 7 of 85 call sites state role/aria-live — and all seven are redundant | `ThemeUpdatePanel.tsx:473,:478,:660`; `AICustomizationPanel.tsx:478,:663` (**dead code**); `UpdatePageClient.tsx:147,:175`. That the theme-editor team restated the contract seven times while 78 other sites state nothing is evidence the contract is not trusted. |
| Dynamically-mounted `role="status"` may not announce | All 41 non-critical banners mount conditionally, so the live region and its content enter the DOM in the same commit. Reliable for `role="alert"`; materially less so for `role="status"`. **PLAUSIBLE — not runtime-verified.** At risk: `products/new/page.tsx:777` "Saved" and `accept-invite/page.tsx:68` "Account activated". |
| Permanent polite live regions | The five unconditional informational banners in §6.3 are permanent `role="status"` regions describing static instructional copy — a semantic misuse, with up to four competing on one settings page. |
| Worst gaps are in the forks | `apps/platform-console/src/app/(auth)/login/page.tsx:51` (sign-in error) and `(auth)/mfa/page.tsx:40` have **zero** `role`/`aria-live` — announced to nobody. `apps/identity-platform/src/app/login/page.tsx:245` does it correctly (`role="alert" aria-live="assertive"`). Same product, two sign-in surfaces, opposite treatment. |
| Reduced-motion violation in a fork | `identity-platform/src/app/globals.css:511` applies `animation: errorShakeIn 0.4s ease-out` (keyframe `:519-529`, translateX −6px→+4px) to the login/signup error box, and that file contains **zero** `prefers-reduced-motion` rules (merchant-control-plane has 7). WCAG 2.3.3 / UI-R4. |
| Unvalidated merchant contrast | `announcement-bar.tsx:79-85` applies merchant-supplied `backgroundColor`/`textColor` inline with no contrast check anywhere in the file. A merchant can configure white-on-white. |

### 6.6 The forks

| Fork | File:line | Why it is a fork |
|---|---|---|
| `.admin-draft-banner` | `merchant-control-plane/src/components/AdminShell.tsx:261` **and** `:280` (same markup, two branches) + `globals.css:2110-2120` | Naked `rgba(245,158,11,0.1)` / `rgba(245,158,11,0.2)` where `--lb-component-banner-warning-*` exists (**UI-R7**); **no `.dark` override anywhere**, so in dark mode it keeps a light amber wash while real warning Banners switch to `#422006` (**UI-R3**); `border-bottom` + full-bleed instead of `rounded` + `border`. |
| `.auth-error` | `identity-platform/src/app/globals.css:497-517`, 9 render sites | Second error system in an app that also uses `<Banner variant="critical">`. The **same 429 rate-limit message** renders both ways: `signup/page.tsx:272` → `.auth-error` (`:523`), `forgot-password/page.tsx:96-97` → `<Banner>` (`:152`). |
| `ConsoleApiErrorPanel` | `platform-console/.../ConsoleDataTable.tsx:144-151`, 35 sites | Plain `<section>`, **no `role="alert"`**, warning-toned for messages titled "…API unavailable". The same app uses real `<Banner variant="critical">` at `audit-logs/page.tsx:80,:86` — same failure class, two tones, two a11y behaviours. |
| storefront checkout callouts | `checkout-client.tsx:637` (`border-red-200 bg-red-50 text-red-700`, has `role="alert"`), `:1004` (amber, **no role**), `:1080` (green, **no role**) | Icon+title+body+border+tint Banner reimplemented by hand in raw Tailwind palette, on the highest-value shopper flow. |
| `.marketplace-banner` / `--info` | `app-marketplace/src/app/globals.css:2278-2310` **[FROZEN]** | Iconless, `flex-direction: column`, 12px text, inverted text hierarchy (`.marketplace-banner span { color: --lb-color-text-subdued }` at `:2297-2300` vs Banner's full-strength body at `feedback.tsx:151`). **Concrete bug:** `.marketplace-banner--info` is used 9 times in TSX but has **no CSS rule** — only `--warning` (`:2302`), `--critical` (`:2307`) and `--success` (`:3165`) exist, so all nine render untinted. |
| theme-marketplace checkout error | `theme-marketplace/src/app/checkout/page.tsx:407` **[FROZEN]** | Uses `--lb-component-banner-critical-{bg,text,border}`. **Those variables do not exist** — the canonical family is `-danger-*` (`feedback.tsx:57-59`, `tokens.ts:456-458`). With no fallback, a failed theme purchase renders as unstyled text in a bare default-colour box. |

**Refuted and omitted:** the claim that merchant Banners have visibly fainter borders in dark mode.
The 12-token override at `merchant-control-plane/src/app/globals.css:346-357` (30%-alpha borders vs
canonical opaque) is real but sits under the dark selector opened at `:297-298`, and
`layout.tsx:41,:43,:46` pin light on all three axes (`data-theme="light"`,
`<ThemeScript forcedTheme="light" />`, `<LetbuyyThemeProvider forcedTheme="light">`). It is
**unreachable dead CSS** — and a UI-R3 dark-mode gap in its own right, since ~55 lines of dark-mode
tokens cannot execute.

---

## 7. Toast / Notification Audit

### 7.1 Implementation

Single implementation, no forks in `@letbuyy/ui`: `feedback.tsx:160-284`, exported at
`index.ts:62`/`:77`. `deprecations.ts` names no toast API as superseded.

```ts
export interface ToastMessage {           // feedback.tsx:163-170
    id: string; title: string; description?: string;
    variant?: ToastVariant;               // 'info' | 'success' | 'warning' | 'critical'
    duration?: number | null; placement?: ToastPlacement;
}
interface ToastContextValue {             // :172-175  — NOT exported
    notify: (toast: Omit<ToastMessage, 'id'>) => string;
    dismiss: (id: string) => void;
}
```

| Aspect | Behaviour | Evidence |
|---|---|---|
| Queue | Pure append. **No max-visible, no cap, no dedupe, no overflow** | `:207-215` `setToasts((current) => [...current, { …toast, id }])`; container `:227` has no `max-h`, no `overflow` |
| Duration | 5000ms default; never overridden anywhere in production code | `:200`, `:210-213`. The only `duration:` in a `notify()` call repo-wide is `tests/components/foundation.test.tsx:431` |
| Timer | `window.setTimeout` handle **discarded** — not cleared on manual dismiss or unmount | `:212`. `grep "setTimeout\|clearTimeout\|onMouseEnter"` on the file returns exactly one line |
| Pause on hover/focus | **None** | no `onMouseEnter`/`onFocus` anywhere in the file |
| Animation | **None** — no `transition`, no `animate`, no `motion-safe:` on the toast div | `:239-246`. (`EmptyStateIllustration` at `:498` *does* animate, so this is not a package-wide policy) |
| Action / retry / undo | **Not supported at any level.** No `action`, `onAction`, `actionLabel`, `retry`, `onUndo`, `icon` or `render` field; no `toast.promise()`, no `loading` variant, no `update(id, patch)` | `ToastMessage` `:163-170`; `ToastContextValue` `:172-175` |
| Portaling | **Not portaled.** Rendered inline in the React tree after `{children}` | `:220-223`. Contrast `Modal`/`Drawer`/`Popover`/`Dropdown`, which use `OverlayPortal` → `document.body` (`overlays.tsx:42-44`) |
| ID | `crypto.randomUUID?.() ?? \`toast-${Date.now()}\`` — fallback collides in the same millisecond | `:208` |
| Placement offset | `--lb-toast-offset-block-start` with a 48px fallback; **only one app sets it** | `:189`; `merchant-control-plane/src/app/globals.css:92` |

### 7.2 Where it is mounted — and where it is not

| App | `ToastProvider` | `useToast()` sites |
|---|---|---|
| merchant-control-plane | ✅ `components/AdminShell.tsx:155` **and** `:187` (two branches of one component, mounted at `[store]/layout.tsx:48`) | 73 |
| theme-marketplace **[FROZEN]** | ✅ `src/app/layout.tsx:139` | 2 |
| storefront-runtime | ❌ | **0** |
| identity-platform | ❌ | **0** |
| platform-console | ❌ | **0** |
| marketing-site | ❌ | **0** |
| platform-operations-portal **[FROZEN]** | ❌ | 0 |
| app-marketplace **[FROZEN]** | ❌ | 0 — forks `.marketplace-toast` instead |
| developer-portal **[FROZEN]** | ❌ | 0 |

**Coverage is one app deep.** The entire shopper checkout, the whole login/2FA/step-up surface, and
the operator console have **no transient-feedback channel at all**. Verified safe: no app calls
`useToast` without a provider, so there is no
`'useToast must be used within ToastProvider'` crash risk — merchant-control-plane routes outside
`/[store]` (`src/app/page.tsx`, `stores/`, `accept-invite/`, `error.tsx`) use Banner-only feedback.

`app-marketplace` **[FROZEN]** re-invents the concept as static CSS:
`globals.css:2279-2296` + `:2482` `.marketplace-toast--success` — an in-flow `<div>` with no fixed
positioning, no z-index, no auto-dismiss, no dismiss button, raw px
(`gap: 8px; padding: 12px; font-size: 12px`), and only ever `--success`. Rendered at
`ReviewComposer.tsx:83`, `AppInstallConsentPanel.tsx:198`, `InstalledAppsGrid.tsx:323`, `:344`,
`ReportActionButton.tsx:61`. It is a static notice misnamed "toast".

`merchant-control-plane` additionally ships a **second toast**: `TrialBanner.tsx:29` renders
`.admin-trial-toast` (`globals.css:2128-2260`) — `position: fixed; bottom: 20px; right: 20px;
width: 360px; border-radius: 14px; z-index: 48` — a persistent collapsible plan-upsell card,
in the only app that has a real toast system. `border-radius: 14px` and `z-index: 48` are raw values
in an untokenised gap (`--lb-z-sticky` 40, `--lb-z-overlay` 50, `tokens.ts:552-559`), and its
"Select a plan" CTA is a dead link (`TrialBanner.tsx:69-75`, `href="#"` + `preventDefault`).

### 7.3 Invocation census and classification

**329 `notify()` calls** repo-wide (AST-balanced-paren extraction, not line grep): 321
merchant-control-plane, 8 theme-marketplace **[FROZEN]**, 3 stories/tests. 300 have a literal title.

| Classification | Count | Notes |
|---|---|---|
| error / destructive-failure (`critical`) | **155** | 92 of these are **toast-only** — no adjacent persistent surface |
| success | 124 | |
| warning / validation | 32 | |
| info / neutral | 13 | |
| dynamic variant expression | 4 | e.g. `settings/payments/page.tsx:265` `nextRazorpay?.verified ? 'success' : 'warning'` |
| **`variant` omitted** | **4** | Silently become `info` — see §7.5 |
| **retryable** | **0** | `ToastMessage` has no action slot |
| **undoable** | **0** | Including `gift-cards/page.tsx:263` (card disabled), `settings/users/page.tsx:254` (staff removed), `settings/shipping/page.tsx:303` (zone deleted) |
| **loading** | 0 supported, 1 faked | `theme-marketplace/src/components/theme-action-feedback.tsx:82` **[FROZEN]** fires "Installing theme" and can never be replaced or dismissed, so on a fast install it sits beside "Theme installed" (`:39`) for the rest of its 5s |

All 73 `useToast()` call sites destructure **only `{ notify }`** — `dismiss` is destructured **zero
times**, so the context's dismiss API is dead outside the built-in × button.

**The structural cause of the retry gap:** `Banner` *does* accept `action`
(`feedback.tsx:125,:155`; live example `settings/shipping/page.tsx:420` renders a Retry button).
`ToastMessage` does not. UI-R3 (`AGENTS.md:290`) requires "error-with-retry" on every screen — the
toast primitive **cannot express it**, which is the mechanical cause of the duplicate-feedback
pattern in §7.6.

### 7.4 Accessibility — two structural defects

**Defect 1 — the live region is created at the same instant as its first message.**

```ts
feedback.tsx:218  const activePlacements = Array.from(new Set(toasts.map(t => t.placement ?? placement)));
feedback.tsx:223  {activePlacements.map((activePlacement) => (
feedback.tsx:224      <div … aria-live="polite" aria-relevant="additions removals">
```

When `toasts` is empty, `activePlacements` is `[]` and **no container exists in the DOM**. Screen
readers must observe an `aria-live` region *before* content is inserted into it; a region injected
together with its content is routinely not announced. All 73 call sites depend on this one region.
**PLAUSIBLE — the DOM structure is confirmed; the AT behaviour was not runtime-verified.**

**Defect 2 — toasts are `aria-hidden` and `inert` while any dialog is open.** Four-link chain, each
link read:

1. `feedback.tsx` contains **zero** `createPortal` calls — the toast container renders in-tree
   (`:220-274`).
2. `overlays.tsx:43` `document.body.appendChild(el)` portals dialogs to `<body>`.
3. `overlay-hooks.ts:58-66` `setOutsideTreeInert` walks to body and calls `hideTree(sibling)` on
   every other body child; `:45-46` sets `aria-hidden="true"` and `inert`.
4. `apps/merchant-control-plane/src/components/AdminShell.tsx:187` mounts `<ToastProvider>` **inside**
   the app root — which is that sibling.

`--lb-z-toast` (70) > `--lb-z-modal` (60) (`tokens.ts:552-560`), so a failure toast raised from
inside an open `ConfirmDialog` is **drawn on top of the dialog but is neither announced nor
dismissable**. 37 merchant-control-plane files combine `useToast` with a dialog, including the
money surface `products/gift-cards/page.tsx` (`<Drawer>` at `:538`; `notify(…)` at `:263,:271,:300`).
**PLAUSIBLE — reasoned from code plus the passing inert assertion at
`tests/components/foundation.test.tsx:337-346`; not reproduced in a browser.**

Further a11y findings:

| Finding | Evidence |
|---|---|
| Nested conflicting live regions | Container is `aria-live="polite"` (`:230`); each toast is `role={variant === 'critical' ? 'alert' : 'status'}` (`:245`). `role="alert"` implies assertive — an assertive region nested inside a polite one. Behaviour is implementation-defined. **UNPROVEN.** |
| Removals re-announce | `aria-relevant="additions removals"` (`:231`) + the 5s auto-dismiss (`:210-214`) means every toast generates a second, meaningless announcement on expiry. |
| Timing not adjustable | 5000ms, no pause on hover or focus, no way to extend. The dismiss button (`:260-268`) is correctly named and has a focus ring (`:263`) — but the container renders **after** `{children}` (`:222-223`), so a keyboard user must tab past the entire page to reach a control that has already auto-dismissed. **WCAG 2.2.1.** |
| Touch target | Dismiss button is `h-[var(--lb-size-control-sm)]` = **32×32px** at compact density (`tokens.ts:567,837,1012`). Clears SC 2.5.8 (24×24); below the 44pt/48dp platform floor on a mobile-first product. |
| Test coverage | One test, `tests/components/foundation.test.tsx:427-458`, asserting duration + placement classes only. **No a11y assertion anywhere.** |

### 7.5 Four failures rendered as blue "info"

```ts
apps/merchant-control-plane/src/app/[store]/products/inventory-history/page.tsx:211-213
    const msg = err instanceof Error ? err.message : 'Unknown error'
    setError(msg)
    notify({ title: 'Error', description: msg })          // <- no variant
```

Byte-identical at `products/receipts/page.tsx:129-131` and `products/reservations/page.tsx:164-166`.
`feedback.tsx:236` applies `toast.variant ?? 'info'`, so all three render with the blue `Info` icon,
the `--lb-component-banner-info-*` surface, and `role="status"` instead of `role="alert"`
(`:245`). **A hard failure is announced to screen readers as neutral information.** The fourth bare
`title: 'Error'` site (`settings/notifications/page.tsx:385`) does pass `variant: 'critical'`.

The title is the least informative possible: `"Error"` with body `"Unknown error"`.

### 7.6 Copy inconsistency

**Raw error text is the default body.** Of 155 `critical` toasts, only 7 have an authored literal
description; **143 pass a runtime variable** and 4 have none. In 93% of merchant error toasts the
"what happened / what to do next" text is not authored — it is whatever string the API returned.
The idiom is `description: err instanceof Error ? err.message : '<fallback>'`, and because the
`try` wraps `await fetch(…)`, an offline/DNS/CORS failure rejects with a browser `TypeError`
(`instanceof Error` is **true**), so the merchant is shown `"Failed to fetch"` / `"Load failed"`
and the curated fallback is dead code on the exact failure it was written for.

Worst site — raw error becomes the **title**:

```ts
apps/merchant-control-plane/src/components/theme-locale/TranslationValueEditor.tsx:133-134
    const message = err instanceof Error ? err.message : 'Failed to save translation'
    toast.notify({ title: message, variant: 'critical' })
```

with the thrown Error built at `:115-117` as
`` body?.message || `Failed to save translation (${res.status})` ``. The bold toast heading becomes
"Failed to save translation (500)". Its own success sibling at `:121` is a proper
`'Translation saved'`.

**Proven copy conflicts** (same event class, different rendering):

| Event | Site A | Site B | Site C |
|---|---|---|---|
| Clipboard write rejected | `customers/page.tsx:248` `'Copy failed'` **`variant:'critical'`** | `products/gift-cards/page.tsx:247` `'Copy failed'` **`variant:'warning'`** | `components/domains/parts.tsx:63` `'Copy failed'` **`variant:'warning'`** |
| Clipboard success (title shape) | `parts.tsx:61` `'Copied'` (bare verb, **no trailing period** in body) | `gift-cards/page.tsx:245` `'Code copied'` (period) | `customers/page.tsx:241` `'Email addresses copied'` (period) |
| Locale mutation (one file) | `settings/general/page.tsx:368` `'Language added'` **`success`** | `:388` `'Language published'` **`info`** | `:403` `'Language removed'` **`info`** |
| Theme publish failure | `online-store/themes/[themeId]/editor/page.tsx:1119` `'Theme publish failed'` | `components/theme-library/ThemeLibraryWorkspace.tsx:179` `'Publish failed'` | — |
| "Cannot receive X" | `products/purchase-orders/page.tsx:558` `` `Cannot receive a ${po.status} order` `` — **raw DB enum**, while `poStatusLabel()` exists at `:57-66` in the same file | `products/transfers/page.tsx:653` `` `…${transferStatusLabel(transfer.status).toLowerCase()} transfer` `` — humanised | — |
| Payment settings noun | `settings/payments/page.tsx:170` `'Could not update payment setting'` (singular) | `:276` `'Could not save payment settings'` (plural) | same object |

**Grammar families for one semantic**, counted across all 300 literal titles:
`'Could not <verb> <noun>'` **74** · `'<Noun> could not load'` **38** · `'<Noun/Verb> failed'`
**32** · `'Failed to load <noun>'` **9** (all in the products sub-tree) ·
`'<Noun> could not be <verbed>'` (shipping `:239`, taxes `:286`) · `'<Noun> not <verbed>'`
(`customers/[email]/page.tsx:428,:435` "Note not saved").

**Punctuation:** 299 of 300 titles carry no terminal period; the outlier is
`products/smart-collections/page.tsx:249`
`title: 'Save the collection first to preview matching products.'` — a full sentence used as a
title. 58 of 60 literal descriptions end in a period; the two exceptions are
`marketing/page.tsx:397` and `parts.tsx:61`.

### 7.7 Duplicate feedback — 93 sites fire a toast *and* a persistent surface with the same string

Measured by scanning the 6 lines preceding each `notify()` for
`set*Error|Notice|Message|Banner|Feedback`. Verified end-to-end:

```ts
apps/merchant-control-plane/src/app/[store]/settings/shipping/page.tsx:175-181
    setLoadError(message)
    notify({ title: 'Shipping settings could not load', description: message, variant: 'critical' })
// renders at :416-424 as:
    <Banner variant="critical" title="Shipping settings could not load"
            action={<Button …>Retry</Button>}>{loadError}</Banner>
```

**Byte-identical title, byte-identical body, two surfaces, simultaneously.** Same shape at
`orders/page.tsx:293-300` (`setActionError('Unable to update order')` → `<Banner title="Order action
failed">` at `:639` **plus** `notify({ title:'Order update failed', description:'Unable to update
order' })`), `payouts/page.tsx:117`, `online-store/pages/page.tsx:228,:282,:312,:362,:397`,
`products/new/page.tsx:442,:676`, `coupons/page.tsx:134`, `settings/domains/page.tsx:86`.

Worse, the two surfaces sometimes disagree on tone: `settings/shipping/page.tsx:226-233` sets
`formError` (rendered as a **critical** Banner titled "Shipping zone needs attention" at `:426-430`)
alongside a **warning** toast titled "Shipping zone needs a name". And
`products/new/page.tsx:573-580` produces **three headings for one empty input** — Banner "Product
needs attention" (`:771`), toast "Product title is required" (`:576`), and the field itself unmarked.

**There is no third (inline) layer**, because `InlineError` has **0 app consumers**
(`input.tsx:166`; only `foundation-primitives.stories.tsx:117` and
`tests/components/foundation.test.tsx:542`). Every validation failure is escalated to a page Banner
plus a global toast. Root cause is structural, not incidental: `input.tsx:89` (Input) and `:156`
(Textarea) each hand-roll their own error paragraph —
`<p id={errorId} className="… text-[color:var(--lb-color-critical)]">{error}</p>` — with **no
`role="alert"` and no icon**, while `InlineError` (`:166-177`) has both. Apps that pass `error=`
therefore receive the silent variant by construction, and the one accessible error primitive is
unreachable in practice.

### 7.8 Two confirmed toast-path defects

**A toast fired immediately before a hard navigation is never seen.**

```ts
apps/merchant-control-plane/src/app/[store]/settings/general/page.tsx:342-343
    notify({ title: 'Store deletion started', description: 'Redirecting to your workspace…' })
    window.location.href = …
```

The document is torn down before the toast can paint. The merchant never sees the only confirmation
that their store was deleted. **CONFIRMED by reading.**

**Third-party-controlled toast content with no cap.**
`apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx:197-203` accepts
`letbuyy:bridge.toast` postMessages and forwards `payload.title` and `payload.message` straight to
`notify()` with no length cap, no sanitisation and no rate limit. Origin **is** checked
(`:176-177`), so this is scoped to the installed app's own origin — but combined with the provider
having no max-visible and no dedupe (`feedback.tsx:209`), an installed app can push unbounded
stacked toasts over the merchant admin.

### 7.9 Mobile and stacking geometry

Container width math is safe: `w-[min(380px,calc(100vw-var(--lb-space-6)))]` (`:227`) resolves to
336px at 360px viewport; `top-right` adds `right-[var(--lb-space-5)]` = 20px, leaving the left edge
at 4px — asymmetric, but it fits.

**The header hook works in the one app that sets it.** `merchant-control-plane/src/app/globals.css:92`
sets `--lb-toast-offset-block-start: calc(var(--admin-header-height) + var(--lb-space-3))`, and
critically the ≤768px override is also on `:root` (`globals.css:5685-5694`,
`--admin-header-height` = 72px), so the derived value re-substitutes to 84px against a 72px header.
Had that override been scoped to `.admin-shell`, custom-property substitution would have frozen the
desktop 64px and the toast would have landed inside the mobile header. **No collision.**

**[FROZEN] theme-marketplace does collide.** `ToastProvider` at `src/app/layout.tsx:139` never sets
the hook, so the 48px fallback applies (`feedback.tsx:189`), while `.header` is
`position: fixed; height: 62px; z-index: 100` (`src/app/header.css:108-113`, rendered at
`components/layout/navbar.tsx:777`). `--lb-z-toast` = 70 < 100, so the top 14px of every toast is
painted under a `backdrop-filter: blur(16px)` bar.

**Stacked toasts block input.** With no cap, no `max-h`, no `overflow` and no `pointer-events-none`
on the container (`:227`), and a 68px card height + 12px gap: from the merchant's 84px offset, 5
toasts reach 472px and 7 reach 632px of a 640px screen, with the full 336px column intercepting taps
for the 5s duration. Structural — no `duration: null` and no per-item `notify` loop exists today.

---

*End of Part 1. Sections 8+ (empty states, loading, validation, tables/modals, accessibility,
responsive, copy, governance and remediation) are covered in the remaining report sections.*
