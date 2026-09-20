# LetBuyy — UI Feedback & Status Communication System Audit

**Date:** 2026-08-16 · **Scope:** repo-wide · **Type:** read-only research. No production code was modified.

**Method:** 16 parallel domain researchers → 4 adversarial verification panels → 5 section authors.
25 agents, ~1,900 tool calls. Every load-bearing claim was re-derived by a verifier whose instruction
was to *refute*, not confirm. Claims that failed verification were dropped or restated — several
attractive-sounding findings did not survive, and their removal is recorded in §28.

---

## 1. Executive Summary

### 1.1 The one-sentence answer

LetBuyy has a **genuinely good feedback vocabulary that the product does not actually use**: the
canonical status→tone engine has **zero consumers**, one active app (`merchant-control-plane`)
consumes the design system at scale while the customer-facing storefront hand-rolls almost
everything, and the CI gate that is supposed to catch this **structurally cannot see it**.

### 1.2 What exists, and its maturity

| Layer | Maturity | Evidence |
|---|---|---|
| Token pipeline | **Strong** | 12-stage, single injection point (`token-style-boundary.tsx:24-27`), 403 `--lb-*` vars, 9 apps mount it |
| Status colour ramp | **Strong** | 4 hues × soft/text/border × 2 themes; all Badge/Banner pairs **pass WCAG AA** (4.57–10.47:1 light, 6.54–8.92:1 dark) |
| Primitives (`Badge`/`Banner`/`Toast`/`EmptyState`) | **Good, incomplete** | Well-built, tokenised, icon+text (not colour-only) — but cannot express failure (§1.4) |
| Adoption | **Poor** | One app deep. `useToast` exists in `merchant-control-plane` (140) + frozen `theme-marketplace` (6); **zero** in storefront, identity, platform-console |
| Status→tone consistency | **Failing** | 3 competing engines, ~39 forked mappers, ~48 independent status maps |
| Validation / forms | **Absent as a system** | No form library repo-wide. `InlineError` has 0 app consumers; the DS `error` prop is used at 15 sites against 663 form controls |
| Copy governance | **None** | 11 ratchet metrics, all visual. Zero copy/microcopy validators |

### 1.3 The five findings that matter most

**① The design system's status vocabulary is dead code.**
`statusToBadgeVariant` (`packages/typescript/ui/src/feedback.tsx:94`) documents itself at `:89-93` as
*"the single source for status→tone logic (replacing the per-app StatusBadge/StatusPill forks)"*.
It has **zero app consumers**. The report it cites as justification, `COMPONENT_DUPLICATION_REPORT.md`,
exists only inside `.claude/worktrees/` — it was never landed in the repo. The consolidation was
designed, built, and documented; the migration never happened.

Worse, `@letbuyy/ui` ships **two contradictory answers** for the same tone: `feedback.tsx:44-61` uses
the accessible 700/800 text ramp, while `internal-workspace.tsx:146-175` (`InternalStatusPill`) uses
the **raw 500 ramp as foreground**. Both are canonical. They disagree on `cancelled` (critical vs
info) and `draft` (warning vs info), and render as two different greens in a single flex row at
`settings/payments/page.tsx:363-368`.

**② A live status bug in the merchant store picker — verified against the running database.**
`apps/merchant-control-plane/src/app/stores/AllStoresClient.tsx:165` tests
`store.status === 'active'`. The live constraint permits only
`draft | published | unpublished | frozen | suspended`:
```
CHECK ((status = ANY (ARRAY['draft','published','unpublished','frozen','suspended'])))
```
`'active'` is **unproducible**. Confirmed against live data (3 `published`, 2 `draft`): every store —
including healthy published ones — renders with the `inactive` class. The green branch and the
`activeStores` filter are permanently unreachable.

**③ A gateway outage renders as an empty shop, on the revenue path.**
`apps/storefront-runtime/src/lib/product-service.ts:47-49` catches **any** failure and returns `[]`,
which is indistinguishable downstream from "this store has no products". A live merchant storefront
serves **HTTP 200 with an empty catalogue**, ISR-cached for 60s. Three sibling services do the same.
This is a direct consequence of ④.

**④ The design system cannot express failure.**
`EmptyStateKind` (`feedback.tsx:338-352`) enumerates 14 values and every one is a *domain noun*
(products, orders, customers…). There is no `error`, no `no-results`, no `permission-denied`. The
primitive models **what** is missing and never **why**. `ToastMessage` has no action slot; `Table`
has no `error` prop. So outages are architecturally forced to render as first-run empty states.

**⑤ Destructive actions are double-submittable by construction.**
`ConfirmDialogProps` (`overlays.tsx:496-506`) has no `loading`, no `confirmDisabled`, no error slot,
and `onConfirm: () => void` cannot signal completion. Verified end-to-end on a state-mutating path:
`orders/page.tsx:673` → `handleCancel` (`:317-322`) is `async` and only closes the dialog *after* the
await, so the destructive button stays live for the entire round-trip. The diagnostic tell is an
asymmetry the authors were forced into — `DomainDetailView.tsx:96` guards `makePrimary` with
`if (working) return` and guards `onClose` at `:336`, but `onConfirm` has no defence available.
Separately, disabling a gift card (`products/gift-cards/page.tsx:355-366`) has **no confirmation at all**.

### 1.4 Major strengths — do not regress these

- **Contrast is genuinely good** where the convention was followed. All 8 Badge/Banner
  text-on-background pairs pass AA in both themes. Independently recomputed twice from the raw token
  values; light `success` is the thinnest at **4.57:1** and therefore fragile — any darkening of the
  surface or lightening of the text breaks it.
- **`Badge` always renders an icon** alongside its label (`feedback.tsx:83`), so the canonical badge is
  **not** colour-only signalling. The a11y failures are all in the components that bypassed it.
- **Status colour is surface-invariant.** `adminSurfaceIdentity` (`tokens.ts:1140-1248`) overrides
  *zero* status tokens. Every colour inconsistency in the product is therefore app-authored drift —
  **not** theming. That makes the whole problem class mechanically fixable.
- **`merchant-control-plane` and `identity-platform` carry zero raw palette classes.** The drift is
  concentrated in `platform-console` (78) and `storefront-runtime` (64).
- The gateway **sanitises every 4xx/5xx on egress** (`middleware/security.ts:90-129`), so the 182 route
  handlers echoing raw Postgres text do not actually leak to merchants.

### 1.5 Major risks

| Risk | Why it matters |
|---|---|
| Outage-as-empty-state on storefront | Silent revenue loss; no alarm, no retry, 200 OK |
| Double-submittable destructive actions | Duplicate cancels/refunds on money-adjacent paths |
| `InternalStatusPill` contrast | 1.93–3.21:1 across 62 pills; fails AA outright |
| 39 forked status mappers | Every new status silently falls through to a neutral default |
| Zero copy governance | 93% of merchant error toasts ship no authored description |
| CI blindness | `validate-design-system.mjs` walks `apps/` only, exempts `packages/typescript/ui`, and counts colours/pixels — never **adoption**. Findings ①③④⑤ are all invisible to it |

### 1.6 Headline recommendation

Do **not** start by writing new components. The gap is not missing primitives — it is *adoption* and
*expressiveness*. In order:

1. **P0 — correctness & safety.** Fix the `AllStoresClient` dead branch; give `EmptyState`/`Table` an
   error/offline kind and stop storefront services swallowing failures; add `loading`/`confirmDisabled`
   to `ConfirmDialog`; fix `InternalStatusPill`'s foreground ramp.
2. **P1 — one status engine.** Collapse the 3 engines + 39 forks into one *exact-match, per-domain*
   registry keyed off the real DB `CHECK` values. Note `statusToBadgeVariant`'s substring matching is
   itself unsafe — `"unpaid".includes("paid")`, `"inactive".includes("active")` and
   `"unverified".includes("verified")` all resolve **green**; it is a latent trap today only because
   nothing calls it, and must not be adopted as-is.
3. **P2 — adoption, enforced.** Add an adoption metric to the ratchet so bypassing the DS is *visible*
   to CI, then migrate storefront and platform-console.
4. **P3 — copy.** Introduce a microcopy standard and a validator.

Full detail, matrices and evidence follow in §2–§29.

---

## Reading order

| File | Sections |
|---|---|
| `00-executive-summary.md` | §1 |
| `01-architecture-and-inventory.md` | §2 scope · §3 architecture · §4 inventory · §5 pills/badges · §6 banners · §7 toasts |
| `02-validation-async-states.md` | §8 validation · §9 loading · §10 empty/error · §11 modals · §12 tables |
| `03-color-tokens-domains.md` | §13 semantic colour · §14 tokens · §15 domain statuses · §23 state matrix · §24 domain matrix |
| `04-quality-findings.md` | §16 a11y · §17 responsive · §18 copy · §19 duplicates · §20 architecture |
| `05-recommendations.md` | §21 canonical classification · §22 usage matrix · §25 gaps · §26 target architecture · §27 migration · §28 open questions |

### A note on numbers

The initial scouting counts in the research brief were inflated roughly 2× because they included
`.next/` build output. Every count in this report was re-derived with build artefacts excluded, and
the corrected figures are used throughout. Where a count is disputed between researchers, the
verifier's figure wins and the discrepancy is noted inline.
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
# Sections 13, 14, 15, 23, 24 — Colour, Tokens, Domain Status

> Read-only research. Every claim below carries `file:line`. Claims that could not be proved are marked **UNPROVEN**. Findings in `app-marketplace`, `developer-portal`, `theme-marketplace` and `platform-operations-portal` are marked **[FROZEN]** and are excluded from the active-product judgement.
>
> **Method note on contrast.** Ratios are computed with the WCAG 2.x relative-luminance formula from the resolved token values in `packages/typescript/ui/src/tokens.ts`. Tailwind utility colours (`text-red-500`, `text-amber-400`, …) are resolved from **`tailwindcss@4.3.0`** — this repo is on Tailwind v4, whose default palette is OKLCH and **does not** equal the v3 hex table. Any raw-palette contrast figure computed from v3 hexes is wrong by 0.05–0.10. `color-mix(in srgb, C p%, transparent)` is composited over the applicable surface.

---

## 13. Semantic Color System

### 13.1 The tone union and the one table that decides everything

There is exactly one canonical tone union:

```ts
// packages/typescript/ui/src/feedback.tsx:29
export type StatusVariant = 'default' | 'info' | 'success' | 'warning' | 'critical';
```

The visual contract is **not** in the components. It is a private lookup table, `statusStyles`, at `packages/typescript/ui/src/feedback.tsx:31-62`. `Badge` (`feedback.tsx:69`), `Banner` (`feedback.tsx:128`) and every Toast (`feedback.tsx:239-269`) read that one table. `statusStyles` is **not exported** — apps cannot reuse the canonical tone mapping outside those three components.

Two structural facts worth stating up front:

1. **The variant is called `critical`; its tokens are called `danger`.** `feedback.tsx:56-58` binds `critical` → `--lb-component-banner-danger-{bg,text,border}`. There is no `--lb-component-banner-critical-*` anywhere in `packages/typescript/ui`. This naming seam has already produced one live rendering bug (§13.5, theme-marketplace).
2. **`default` is not neutral.** It resolves to the brand accent (`--lb-component-badge-accent-*`, `feedback.tsx:33-35` → `tokens.ts:441-445`), so a status that falls through every mapper renders as a *brand-coloured* pill, not a grey one.

### 13.2 Full mapping table — state → fg / bg / border / icon → token → usage sites

Light-theme hex is shown first, dark second. All values traced through `tokens.ts` (`primitive.color` at `:47-174` → `letbuyyColorTokens` at `:210-237` → `letbuyySemanticTokens` at `:239-368` → `letbuyyComponentTokens` at `:370-550`).

| State | Layer | Class emitted | CSS variable | Light | Dark | Ratio (fg on bg) |
|---|---|---|---|---|---|---|
| **default** | bg | `bg-[var(--lb-component-badge-accent-bg)]` (`feedback.tsx:33`) | `--lb-component-badge-accent-bg` (`tokens.ts:442/531`) | `rgba(139,92,246,0.12)`; **admin** `color-mix(in srgb, #2C2642 10%, transparent)` (`tokens.ts:1178`) | same; **admin** `color-mix(#6C54C4 20%)` (`tokens.ts:1230`) | — |
| | fg | `text-[color:var(--lb-component-badge-accent-text)]` (`:34`) | `--lb-component-badge-accent-text` (`tokens.ts:443/532`) | `#6D28D9`; **admin** `#362C58` (`:1179`) | `#C4B5FD`; **admin** `#C9BFED` (`:1231`) | **10.49:1** admin light / **8.91:1** admin dark — PASS |
| | border | `border-[var(--lb-component-badge-accent-border)]` (`:35`) | `--lb-component-badge-accent-border` (`tokens.ts:444/533`) | `#8B5CF6`; **admin** `color-mix(#2C2642 30%)` (`:1180`) | same; **admin** `color-mix(#6C54C4 40%)` (`:1232`) | — |
| | icon | `<Info>` hardcoded, `aria-hidden` (`feedback.tsx:36`) | `--lb-size-icon-inline` | — | — | — |
| **info** | bg | `bg-[var(--lb-component-banner-info-bg)]` (`:39`) | `--lb-component-banner-info-bg` (`tokens.ts:447/536`) | `#E0F2FE` (blue[100], `:153`) | `#082F49` (blue[950], `:157`) | — |
| | fg | `text-[color:var(--lb-component-banner-info-text)]` (`:40`) | `--lb-component-banner-info-text` (`tokens.ts:448/537`) | `#1D4ED8` (blue[700]) | `#7DD3FC` (blue[300]) | **5.84:1** / **8.32:1** — PASS |
| | border | `border-[var(--lb-component-banner-info-border)]` (`:41`) | `--lb-component-banner-info-border` (`tokens.ts:449/538`) | `#3B82F6` | `#3B82F6` | 3.21:1 (decorative) |
| | icon | `<Info>` (`feedback.tsx:42`) — **byte-identical to `default`** | — | — | — | — |
| **success** | bg | `bg-[var(--lb-component-banner-success-bg)]` (`:45`) | `--lb-component-banner-success-bg` (`tokens.ts:450/539`) | `#DCFCE7` (green[100], `:126`) | `#052E16` (green[950], `:129`) | — |
| | fg | `text-[color:var(--lb-component-banner-success-text)]` (`:46`) | `--lb-component-banner-success-text` (`tokens.ts:451/540`) | `#15803D` (green[700]) | `#22C55E` (green[500]) | **4.57:1** / **6.54:1** — PASS |
| | border | `border-[var(--lb-component-banner-success-border)]` (`:47`) | `--lb-component-banner-success-border` (`tokens.ts:452/541`) | `#22C55E` | `#22C55E` | 2.07:1 (decorative) |
| | icon | `<CheckCircle2>` (`feedback.tsx:48`) | — | — | — | — |
| **warning** | bg | `bg-[var(--lb-component-banner-warning-bg)]` (`:51`) | `--lb-component-banner-warning-bg` (`tokens.ts:453/542`) | `#FEF3C7` (amber[100], `:132`) | `#422006` (amber[950], `:135`) | — |
| | fg | `text-[color:var(--lb-component-banner-warning-text)]` (`:52`) | `--lb-component-banner-warning-text` (`tokens.ts:454/543`) | `#92400E` (amber[800]) | `#F59E0B` (amber[500]) | **6.37:1** / **6.79:1** — PASS |
| | border | `border-[var(--lb-component-banner-warning-border)]` (`:53`) | `--lb-component-banner-warning-border` (`tokens.ts:455/544`) | `#F59E0B` | `#F59E0B` | 1.93:1 (decorative) |
| | icon | `<AlertTriangle>` (`feedback.tsx:54`) | — | — | — | — |
| **critical** | bg | `bg-[var(--lb-component-banner-danger-bg)]` (`:57`) | `--lb-component-banner-danger-bg` (`tokens.ts:456/545`) | `#FEE2E2` (red[100], `:138`) | `#451A1A` (red[950], `:143`) | — |
| | fg | `text-[color:var(--lb-component-banner-danger-text)]` (`:58`) | `--lb-component-banner-danger-text` (`tokens.ts:457/546`) | `#B91C1C` (red[700]) | `#FCA5A5` (red[300]) | **5.30:1** / **7.82:1** — PASS |
| | border | `border-[var(--lb-component-banner-danger-border)]` (`:59`) | `--lb-component-banner-danger-border` (`tokens.ts:458/547`) | `#EF4444` | `#EF4444` | 3.08:1 (decorative) |
| | icon | `<AlertCircle>` (`feedback.tsx:60`) | — | — | — | — |

**Banner body text does not follow the tone.** `feedback.tsx:151` applies `text-[color:var(--lb-color-text)]` — neutral — while the `<h3>` title at `:146-150` takes `style.text`. Body ratios: light `#111827` on the four soft backgrounds = **14.52–16.15:1**; dark `#FFFFFF` = **13.88–14.91:1**. All PASS.

**Usage sites** (verified counts, `.next`/`node_modules` excluded): `<Badge` 151, `<Banner` 85, `useToast()` 73 — all three read `statusStyles`.

### 13.3 Three parallel status-colour families back one semantic

| Family | Foreground | Background | Consumers |
|---|---|---|---|
| `--lb-component-banner-*` (accessible `statusText` 700/800 ramp) | `#15803D` / `#92400E` / `#B91C1C` / `#1D4ED8` | `statusSoft` 100 | `Badge`, `Banner`, Toast (`feedback.tsx:31-62`) |
| `--lb-color-{tone}` (**raw 500 ramp**) | `#22C55E` / `#F59E0B` / `#EF4444` / `#3B82F6` | `--lb-color-{tone}-soft` (same 100 ramp) | `InternalStatusPill` (`internal-workspace.tsx:164-169`), `InternalSkipBackendPanel` (`:188-190`), `Box`/`Text` tone (`layout.tsx:85-93`, `:338-348`), `MetricCard` delta (`productivity.tsx:62-64`), `ProviderModeBadge` (`ProviderModeBadge.tsx:3-6`) |
| Raw Tailwind palette | `text-emerald-300` / `text-amber-300` / `text-red-300` / `text-zinc-300` | `bg-*-500/10` | `ConsoleDataTable.StatusBadge` (`apps/platform-console/src/components/ConsoleDataTable.tsx:100-103`) — 14 sites |

**Proof they are visually different, on the same element, in one flex row on a money surface.** `apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx:363-367`:

```tsx
<div className="flex flex-wrap items-center justify-end gap-[var(--lb-space-2)]">
    <ProviderModeBadge mode={providerMode} />
    <Badge label={status.label} variant={status.variant} />
</div>
```

The sibling `Badge` variant is computed at `payments/page.tsx:321-325` — `razorpay?.verified ? {label:'Verified', variant:'success'} : razorpay?.secret_configured ? {label:'Saved', variant:'warning'} : {label:'Not connected', variant:'default'}`. `ProviderModeBadge` uses `--lb-color-success` (`#22C55E`) on `--lb-color-success-soft` (`#DCFCE7`); the canonical `Badge` uses `#15803D` on the **identical** `#DCFCE7`. So a verified live store shows **two green pills side by side in different greens**; a saved sandbox store shows two ambers. Same for warning: `#F59E0B` vs `#92400E` on the same `#FEF3C7`.

### 13.4 The raw-ramp family fails WCAG AA

`internal-workspace.tsx:164-169` uses the **raw status hue as foreground** on the soft background:

```tsx
success: 'border-[var(--lb-color-success)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]',
```

Resolution chain: `--lb-color-success` → `letbuyyColorTokens.success` (`tokens.ts:233`) → `green[500]` `#22C55E` (`tokens.ts:127`); `--lb-color-success-soft` → `statusSoft.success` → `green[100]` `#DCFCE7` (`tokens.ts:296`, `:126`).

| Tone | Light | Dark | Canonical `Badge` equivalent (light) |
|---|---|---|---|
| success | **2.07:1** — fails AA *and* the 3:1 non-text floor | 6.54:1 PASS | 4.57:1 PASS |
| warning | **1.93:1** — fails AA *and* 3:1 | 6.79:1 PASS | 6.37:1 PASS |
| critical | **3.08:1** FAIL | **3.94:1** FAIL | 5.30:1 PASS |
| info | **3.21:1** FAIL | **3.77:1** FAIL | 5.84:1 PASS |

**Severity, stated honestly.** 62 `<StatusPill>` sites exist (34 `platform-console` + 28 `platform-operations-portal` **[FROZEN]**). Both consumers ship **dark by default** — `apps/platform-console/src/app/layout.tsx:43` `<ThemeScript defaultTheme="dark" />` and `:46` `<LetbuyyThemeProvider surface="operations" defaultTheme="dark">`, identical at `apps/platform-operations-portal/src/app/layout.tsx:43,46`. So in the shipped default rendering **critical (3.94) and info (3.77) fail AA**; success and warning pass. The sub-3:1 light figures apply only to the user-selectable light theme (`defaultTheme`, not `forcedTheme`, so light **is** reachable). Do not quote "62 pills at 1.93:1".

Two further AA failures in the canonical layer:

- **The canonical form-error colour fails in light mode.** `input.tsx:89` (Input), `:156` (Textarea) and `:169` (`InlineError`) all render `text-[color:var(--lb-color-critical)]` at `--lb-font-size-caption` (12px/16px, `tokens.ts:759`, `:782` — normal text, so the bar is 4.5:1). `--lb-color-critical` → `red[500]` `#EF4444` (`tokens.ts:1104` → `:686` → `:286` → `:236` → `:140`). On `--lb-color-surface` `#FFFFFF` = **3.76:1 FAIL**; on page bg `#F6F7F9` = **3.51:1 FAIL**. Dark passes (4.87 on card, 5.26 on page). The design system already ships the correct value — `statusText.danger` = `red[700]` `#B91C1C` (`tokens.ts:292`), used by `Badge` at 5.30:1.
- **`MetricCard` delta is colour-only *and* fails contrast.** `productivity.tsx:62-64` differentiates tone purely by text colour — no icon, no sign, no sr-only. Light: positive `#22C55E` on card `#FFFFFF` = **2.28:1**, negative `#EF4444` = **3.76:1**. `merchant-control-plane` is `forcedTheme="light"` (`layout.tsx:43,46`), so those failing values *are* the shipped rendering. Live colour-only site: `apps/merchant-control-plane/src/app/[store]/ai/page.tsx:255-256` passes `delta={`${percentUsed}% used`}` with `deltaTone` flipping positive/negative on **identical text**.

44 app sites render status meaning as raw-ramp text on plain surfaces (`grep -rnE "text-\[var\(--lb-color-(success|critical|warning|info)\)\]" apps`), including money data: `apps/platform-console/src/app/(dashboard)/money-reconciliation/page.tsx:159` (variance, `#EF4444` on white = 3.76) and `:189` (ledger payable, `#22C55E` on white = 2.28).

### 13.5 Colour applied by string matching — and the matcher is broken and unused

```ts
// packages/typescript/ui/src/feedback.tsx:89-102
/**
 * Map an arbitrary status/state string to a canonical Badge variant. This is the
 * single source for status→tone logic (replacing the per-app StatusBadge/StatusPill
 * forks — see COMPONENT_DUPLICATION_REPORT.md DUP-4).
 */
export function statusToBadgeVariant(status: string): StatusVariant {
    const s = status.toLowerCase().trim();
    const has = (...keys: string[]) => keys.some((k) => s.includes(k));
    if (has('success', 'active', ... 'published', 'enabled', 'verified', 'connected')) return 'success';
    if (has('fail', 'error', ... 'cancel', 'expired', 'disabled', 'down')) return 'critical';
    ...
}
```

Two facts:

1. **It is unreachable.** `grep -rn "statusToBadgeVariant" apps packages services --include="*.ts" --include="*.tsx"` returns exactly three lines: `packages/typescript/ui/src/index.ts:61` (barrel), `feedback.tsx:94` (definition), `feedback.tsx:118` (inside `StatusBadge`). The **only** canonical `<StatusBadge>` call site in all of `apps/` — `apps/merchant-control-plane/src/app/[store]/settings/notifications/page.tsx:650-654` — passes `variant={statusVariant(log.status)}` from a local mapper at `:147-152`, overriding the derivation. **The function never executes in the product.** The doc comment's claimed migration never happened, and the cited `COMPONENT_DUPLICATION_REPORT.md` does not exist in this repo (**UNPROVEN** citation).
2. **It is wrong.** Because the success keyword list is tested *first* with unanchored `String.includes`, negated states resolve to green. Executed verbatim: `inactive`→success, `unpaid`→success, `unverified`→success, `incomplete`→success, `unpublished`→success, `disconnected`→success, `unhealthy`→success, `not connected`→success, and `delivery_failed`→success (because `delivery` contains `live`).

**Report this as a latent trap in an unused shared API, not as two screens disagreeing.** No production call site passes one of those strings today. Any app that migrates onto the "canonical" helper inherits the bug — and `NOT CONNECTED` is load-bearing vocabulary in this codebase's own live-data honesty contract.

**One genuine rendering bug from the `critical`/`danger` naming seam [FROZEN]:** `apps/theme-marketplace/src/app/checkout/page.tsx:407` styles the purchase-failure box with `border-[var(--lb-component-banner-critical-border)] bg-[var(--lb-component-banner-critical-bg)] text-[color:var(--lb-component-banner-critical-text)]`. Those names are **never emitted** (`defs=0, uses=1` measured). With no fallback supplied, the failed-payment banner renders transparent with inherited text.

### 13.6 The two colour-only status signals in the product

| Site | Signal | Evidence |
|---|---|---|
| Storefront star rating (shopper-facing) | Rating carried 100% by `text-amber-400` vs `text-gray-200`, and the buttons have **empty accessible names** | `apps/storefront-runtime/src/components/product/product-reviews.tsx:36-60`. `lucide-react@0.562.0` auto-applies `aria-hidden="true"` to childless icons, so each `<Button unstyled>` wrapping a bare `<Star>` computes no name. Active `#FFB900` = **1.72:1** on white; inactive `#E5E7EB` = **1.24:1**; active-vs-inactive = **1.39:1** — the two states are near-indistinguishable. |
| Merchant testimonials rating (active runtime) | Identical defect, `aria-hidden` explicit | `apps/merchant-control-plane/src/app/[store]/testimonials/page.tsx:100-116` (`active ? 'text-[var(--lb-color-warning)]' : 'text-[var(--lb-color-border)]'`), rendered at `:412` inside a text-free `<div>`. `testimonial.rating` is in scope and never exposed. |
| `MetricCard` delta | Tone is the only signal | `productivity.tsx:58-69`; live at `ai/page.tsx:255-256` |
| `Badge` `default` vs `info` | **Same `<Info>` glyph** (`feedback.tsx:36` and `:42` are byte-identical JSX) — only hue differs | Both are produced from live data by `statusToBadgeVariant` (`:100`, `:101`) |

**Storefront out-of-stock is *not* a colour-only failure** — `apps/storefront-runtime/src/app/store/[subdomain]/product/[productId]/product-details-client.tsx:367-372` pairs the dot with a text label. It is raw-palette drift, covered in §14.6.

---

## 14. Design Tokens

### 14.1 Pipeline — 12 stages, one injected stylesheet

| Stage | What | Where |
|---|---|---|
| 1 | **Primitives** — raw ramps. Status hues: `green` `:125-130`, `amber` `:131-136`, `red` `:137-144`, `blue` `:152-158`. `pink`/`cyan`/`teal`/`emerald` exist and no semantic token references them. | `tokens.ts:47-174` (`const primitive` at `:176`) |
| 2 | **Flat aliases** — collapses ramps to four status entries: `success` `:233`, `warning` `:234`, `danger` `:235`, `info` `:236`. **This is the only place the word `danger` is authored**; everything downstream saying `critical` is an alias of it. | `tokens.ts:210-237` |
| 3 | **Per-theme semantic** — splits each status into three ramps: `status` (light `:283-288` / dark `:347-352`), `statusText` (`:289-294` / `:353-358`), `statusSoft` (`:295-300` / `:359-364`). Note `status.*` is byte-identical light vs dark; only `statusText` and `statusSoft` invert. | `tokens.ts:239-368` |
| 4 | **Per-theme component** — `banner` `:446-459`/`:535-548` (bg=`statusSoft`, text=`statusText`, border=`status`), `badge` `:441-445`/`:530-534`, `emptyState` `:402-409`/`:491-498`, `input` `:410-418`/`:499-507`. | `tokens.ts:370-550` |
| 5 | **Aggregate** — re-flattens; `danger` is renamed `critical` (`critical` `:686`/`:724`, `criticalSoft` `:688`/`:726`). No `dangerSoft` alias survives. | `tokens.ts:649-864` |
| 6a | **Non-colour emit** — spreads `letbuyyDensityCssVariables.compact` first (`:906`), so **compact is the implicit `:root` default**; then type, space `--lb-space-0..11` (`:958-969`) + legacy `xs/sm/md/lg/xl` (`:970-974`), radius, shadow, z-index, motion, size. | `tokens.ts:905-1038`; density built by `densityVariables()` `:866-897` |
| 6b | **Colour emit** — (i) hand-written flat map `:1062-1116` names `--lb-color-{success,warning,critical,info}[-soft]`, `--lb-color-focus-ring`, `--lb-color-overlay` at `:1104-1114`; (ii) `appendTokenVariables` (`:1044-1055`) **mechanically mirrors** the whole primitive/semantic/component trees into `--lb-primitive-*` / `--lb-semantic-*` / `--lb-component-*` (calls at `:1118-1120`); (iii) 11 deprecated aliases are **deleted** from the output at `:1121-1123`. | `tokens.ts:1057-1126` |
| 7 | **Theme maps** — `sharedCssVariables + colorVariables(theme)`. | `tokens.ts:1482-1491` |
| 8 | **Surface maps** — a ~60-key subset including **all 12 banner tokens** (`:1308-1319`) and the 3 badge tokens (`:1305-1307`), with the surface identity spread **last** (`:1355`). | `tokens.ts:1254-1357`; materialised `:1361-1369` |
| 9 | **Serialisation** — `:root`+`[data-theme="light"]` (0,1,0) → light surface blocks (0,2,0) → `auto` → `@media (prefers-color-scheme: dark)` → dark blocks → 3 density blocks → base rules → reduced-motion → empty-state keyframes. | `tokens.ts:1520-1634`; `surfaceSelector` `:1499-1508` |
| 10 | **DOM injection** — `DesignSystemRoot` passes `letbuyyTokenCss` into `TokenStyleBoundary`, which renders one `<style data-letbuyy-token-source="true">` **inside the React tree** (in `<body>`), i.e. **after** every app `globals.css` in document order. | `design-system-root.tsx:19-50`; `token-style-boundary.tsx:24-27` |
| 11 | **Tailwind bridge** — `@theme` block imported as line 2 of every app `globals.css`; status mapping at `:47-51`. | `config/tailwind/letbuyy-tokens.css:19-57` |
| 12 | **Interchange (not runtime)** — DTCG projection consumed by the Flutter/Figma generators. | `packages/typescript/ui/tokens.json` |

### 14.2 Surface identities — the abstraction is currently one surface, and it touches zero status tokens

```ts
// tokens.ts:1250-1252
const letbuyySurfaceIdentities: Partial<Record<LetbuyySurface, Record<LetbuyyTheme, CssVariableMap>>> = {
    admin: adminSurfaceIdentity,
};
```

Five surfaces are declared (`admin | marketplace | storefront | identity | operations`, `tokens.ts:1100`) but only `admin` carries an identity (`tokens.ts:1140-1248`). The other four resolve to shared defaults.

**The decisive finding for this audit: `adminSurfaceIdentity` overrides zero status tokens.** I read the full block `tokens.ts:1140-1248` and scanned it for `success|warning|critical|danger|info|banner` — **zero matches**, light and dark. It touches only primary/CTA/secondary (`:1143-1158`, `:1201-1215`), focus ring (`:1154`, `:1210`), button (`:1161-1170`, `:1217-1225`), input focus (`:1172-1173`, `:1227-1228`), badge accent (`:1178-1180`, `:1230-1232`), empty-state illustration (`:1181-1182`, `:1233-1234`) and the sidebar.

Independently confirmed at the app layer: neither `platform-console` nor `platform-operations-portal` `globals.css` declares any `--lb-color-{success,warning,critical,info}[-soft]` or `--lb-component-banner-*`, and `merchant-control-plane` has no *reachable* status-base override (see §14.5).

**Therefore every status colour in this report is surface-invariant.** Success is `#22C55E` and danger is `#EF4444` in merchant-control-plane, storefront-runtime, identity-platform and platform-console alike. Any per-app status difference a user perceives comes from app CSS or raw Tailwind classes — **not** from the surface system.

What the admin identity *does* change, visibly: the **neutral** badge. Admin light `bg = color-mix(in srgb, #2C2642 10%, transparent)`, `text = #362C58`; everywhere else `rgba(139,92,246,0.12)` / `#6D28D9`. Same for the empty-state illustration ink (`#362C58` vs `#8B5CF6`) and the input focus ring (`#443870` vs `#8B5CF6`).

### 14.3 The cascade contract, stated in the token file itself

`tokens.ts:1128-1139` documents the rule:

> `letbuyySurfaceTokens` is emitted under `[data-letbuyy-surface="…"][data-letbuyy-theme="…"]` (specificity 0,2,0), i.e. one selector step above the `:root` block (0,1,0) inside the SAME generated stylesheet. That is the sanctioned place for a surface to differ — an app must never re-declare `--lb-color-primary` from its own stylesheet to win a cascade race against the injected tokens (DOC 03 §35: one token source).

This is `AGENTS.md:288` UI-R1 restated in code. It is broken in three runtimes (§14.5). No app CSS uses `!important` on an `--lb-*` token, so plain specificity decides every conflict.

### 14.4 Unused tokens

**Method:** emitted set = union of `letbuyyTokenCssVariables.{light,dark}` + `letbuyySurfaceTokens` (403 distinct names, 401 per theme). Used set = every `--lb-…` occurrence across real source under `apps/`, `packages/typescript/`, `services/`, `config/` (excluding `.next`/`dist`/`build`/`node_modules` and the three definition files), plus every `var(--lb-…)` self-reference inside `tokens.ts` and the generated CSS. **Result: 145 of 403 emitted variables have zero consumers.**

| Group | Count | Detail |
|---|---|---|
| `--lb-primitive-*` | **77 of 82 dead** | Only `-color-gray-100`, `-gray-200`, `-purple-500`, `-purple-600`, `-purple-700` are referenced. Every status primitive is dead: `-green-{100,500,700,950}`, `-amber-{100,500,800,950}`, `-red-{100,300,500,600,700,950}`, `-blue-{100,300,500,700,950}`. So are `-pink-*` (5), `-cyan-500`, `-teal-500`, `-emerald-500`, and all 11 `-brand-ink-*` **despite brandInk being the admin identity anchor**. All auto-generated by the `appendTokenVariables` reflection (`tokens.ts:1118`) and shipped on every page load of every app. |
| `--lb-semantic-status-*` | **12 dead** | `-success/-warning/-danger/-info`, `-text-*` (4), `-soft-*` (4). Mirrored from `tokens.ts:284-300`/`:348-364` by `appendTokenVariables` (`:1119`). The only live path to those values is `--lb-component-banner-*`. |
| Other `--lb-semantic-*` | 12 dead | `-background-{subdued,raised,header}`, `-border-{subtle,strong}`, `-button-primary-*` (5), `-button-secondary-*` (4), `-overlay`, `-text-inverse` |
| Component | 10 dead | `--lb-component-input-height`, `-table-{row-height,header-height,toolbar-height}`, `-sidebar-{row-height,icon-size,nested-item-size}`, `-page-header-{height,icon-bg,icon-border}` |
| Size/density duplicates | 6 dead | `--lb-density-empty-state-scale` (EmptyState reads `-illustration-width/-height/-min-height` instead, `feedback.tsx:498`, `:520`), `--lb-size-empty-state-min-height`, `--lb-size-page-header-height`, `--lb-size-table-*` (3) |
| Legacy pre-theme-split aliases | 8 dead | `--lb-color-{background,surface,border,text-primary,text-secondary}-{light,dark}` |
| Type / motion / misc | ~20 dead | `--lb-font-size-h1`, `--lb-line-height-{h1,h3,h4}`, `--lb-font-size-body-large`, `--lb-line-height-body-large`, `--lb-font-family-display`, `--lb-ease-emphasized`, `--lb-motion-hover-lift`, `--lb-motion-hover-scale`, `--lb-bp-sm`, `--lb-bp-lg`, `--lb-z-overlay`, `--lb-shadow-card-{light,dark}`, `--lb-space-{xs,xl,11}` |

**Component-level dead exports (same category).** `<InlineError>` (`input.tsx:166`, exported `index.ts:7`) and `<FilterChips>` (`primitives.tsx:399`, exported `index.ts:138`) have **zero app consumers** — verified by per-app loop across all 10 app roots, all extensions, `.next` excluded: `InlineError` 0, `FilterChips` 0. They are also zero in `services/`, `tools/`, `config/`, `database/`, `scripts/`, `packages/dart/` and `apps/mobile/`.

Correct phrasing matters here: **they are not "unused"** — both are instantiated inside `packages/typescript/ui` itself. `InlineError` = 2 instantiations (`foundation-primitives.stories.tsx:117`, `tests/components/foundation.test.tsx:542`, with a real assertion at `:555`). `FilterChips` = 3 (`primitives.stories.tsx:86`, `:149`, `component-catalog.stories.tsx:353`) and **zero test references**. Say *"zero app consumers"*, never *"zero usages"*.

`InlineError`'s zero adoption is **structural, not incidental**: `input.tsx:89` (Input) and `:156` (Textarea) hand-roll their own error paragraph —

```tsx
{error && <p id={errorId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">{error}</p>}
```

— with **no `role="alert"` and no icon**, while `InlineError` (`input.tsx:166-177`) supplies both. Apps that pass `error=` therefore receive the silent variant *by construction*; the accessible primitive is unreachable in practice.

Also worth stating: the design-intelligence corpus is stale on this point. `docs/design-intelligence/component-intelligence/COMPONENT_CATALOG.md:278` and `docs/design-intelligence/evidence/draft-parts-6-7.md:130` both claim Input's `error` prop "triggers red ring and InlineError below". That is false against `input.tsx:89`. `draft-parts-6-7.md:705` describes it correctly — the corpus contradicts itself. Separately, this is **known, unremediated debt**: `docs/archive/historical-audits-2026-06-10/design-system/ui-system-audit/UI_COMPONENT_CATALOG.md:20` already lists FilterChips among "17 exported components have *zero* app adoption (Storybook-only)".

### 14.5 Missing tokens and dangling references

**No token exists for six semantics the product actually needs.** `StatusVariant` has five members; `statusToBadgeVariant` (`feedback.tsx:99`) collapses `pending|review|warning|processing|draft|paused|degraded|partial|awaiting|hold|retry` into **one amber bucket**. A draft product, a degraded worker and an overdue invoice are the same colour. There is no `neutral`, no `pending`, no `positive/negative`, no `link`, no `selected/hovered`, no `caution`, no `disabled`.

**Dangling `--lb-*` references — referenced, never emitted** (measured `defs` in `packages/typescript/ui/src` + app CSS vs `var()` uses in app `.tsx`/`.css`, `.next` excluded):

| Token | Defs | Uses | Impact |
|---|---|---|---|
| `--lb-color-surface-hovered` | 0 | **24** | Every hovered row/card has **no background at all**. e.g. `apps/merchant-control-plane/src/app/[store]/online-store/themes/update/UpdatePageClient.tsx:181`, `.../products/inventory-history/page.tsx:458` |
| `--lb-color-text-critical` | 0 | **7** | The two **best-wired** field errors in merchant-control-plane render in inherited body colour: `components/theme-library/ThemeLibraryWorkspace.tsx:506` and `:569` (which otherwise have correct `aria-describedby` + `aria-invalid` + `role="alert"`). Also `theme-locale/theme-locale.module.css:133,167,204`, `ThemeUpdatePanel.tsx:627`, `settings/notifications/page.tsx:638`. Canonical name is `--lb-color-critical`. |
| `--lb-color-feedback-critical-text` / `-success-text` | 0 | 3 | `.../products/inventory-history/page.tsx:281,480-481,521-522` — **stock-increase and stock-decrease rows render in the same inherited colour**; the only signal distinguishing them is gone. |
| `--lb-color-text-success` | 0 | 2 | `ThemeUpdatePanel.tsx:391,641` |
| `--lb-color-text-disabled` | 0 | 2 | `.../orders/[orderId]/page.tsx:489`, `theme-editor/AICustomizationPanel.tsx:644` — disabled placeholder indistinguishable from live text |
| `--lb-color-text-link` | 0 | 2 | `ThemeLibraryWorkspace.tsx:361`, `platform-console/(dashboard)/incidents/page.tsx:389` — links render at body colour with only an underline |
| `--lb-color-surface-selected` | 0 | 1 | `theme-editor/TemplateSwitcherPanel.tsx:289` — selected template has no background |
| `--lb-color-text-caution` | 0 | 1 | `theme-library/ThemeLibraryCard.tsx:217` — caution and info render identically |
| `--lb-component-banner-critical-*` | 0 | 1 | `apps/theme-marketplace/src/app/checkout/page.tsx:407` **[FROZEN]** — payment error banner renders transparent |
| `--lb-color-danger` | 2 (both app-local **[FROZEN]** `app-marketplace/globals.css:43,141`) | 6 | **Deleted at emit time** (`tokens.ts:14` + `:1121-1123`). `apps/merchant-control-plane/src/app/globals.css:11416-11418` and `:11453` use it inside `color-mix(in srgb, var(--lb-color-danger) 30%, transparent)` — `color-mix` with an invalid colour makes the **whole declaration invalid**, so `.checkout-error` and `.checkout-coupon-error` render with no red tint, no red border and inherited text. |
| `--lb-color-border-subtle` | 7 (all app-local) | 63 | Also deleted (`tokens.ts:13` + `:1121-1123`). |

**A broken entry in the Tailwind bridge itself.** `config/tailwind/letbuyy-tokens.css:55`:

```css
--color-line-subtle: var(--lb-color-border-subtle);
```

`--lb-color-border-subtle` is in the deprecated-alias delete set at `tokens.ts:13` and is stripped at `tokens.ts:1121-1123` — verified absent from both emitted theme maps. **Every `border-line-subtle` / `divide-line-subtle` utility therefore resolves to an invalid value.**

**Dangling type scale.** `--lb-font-size-{xs,sm,lg,base,2xl}` are referenced ~198 times across apps and emitted zero times (the real scale is `display/h1..h4/page-title/section-title/card-title/body-large/body/secondary/table/sidebar/empty-state/small/caption/badge/heading`). Every one of those `text-[length:var(--lb-font-size-xs)]` classes is inert. Same shape for `--lb-radius-pill` (emitted name is `--lb-radius-full`).

### 14.6 App-local token forks (UI-R1 pressure)

| App | `--lb-*` redefs | Status-relevant | Reachable? |
|---|---|---|---|
| `developer-portal` **[FROZEN]** | 102 | Rebuilds the whole system on a green identity; resurrects the deleted `--lb-color-border-subtle`/`-default` locally and consumes them 20+ times. Notably does **not** redefine any `--lb-component-banner-*`, so its error banners stay purple-system red on a green page. | Yes |
| `app-marketplace` **[FROZEN]** | 77 | `globals.css:135-143` forks the **dark** status ramp: `--lb-color-critical: rgb(248 113 113)` (`#F87171`) vs canonical `#EF4444`, `--lb-color-info: rgb(125 211 252)` vs `#3B82F6`. Ironically **more accessible** (`#F87171` on `#451A1A` = 5.36:1 vs canonical 3.94:1). Also locally redefines the deleted `--lb-color-danger` (`:43`, `:141`). | **No** — the fork sits on `.dark` at `<html>` while the injected dark block also matches the nearer `DesignSystemRoot` div, so it is inert inside the subtree |
| `merchant-control-plane` | 71 | `globals.css:346-357` re-declares **all 12 banner tokens**; 8 of 12 are byte-identical restatements of canon as raw hex (dead drift), and the 4 **borders** genuinely diverge — 30% alphas (`rgba(34,197,94,.3)` etc.) vs canonical opaque `#22C55E`/`#F59E0B`/`#EF4444`/`#3B82F6`. | **No** — the block sits under the dark selector opened at `:297-298`, and `layout.tsx:41/:43/:46` pin light on all three axes (`data-theme="light"`, `<ThemeScript forcedTheme="light" />`, `<LetbuyyThemeProvider surface="admin" forcedTheme="light">`). ~55 lines of unreachable dark-mode overrides, and a UI-R3 "reachable, not just wired" gap. |
| `marketing-site` (**EXILED from the ratchet**) | 63 | Same 7-line dark canvas block copy-pasted ≥5× (`:1062-1069`, `:1575-1582`, `:3689-3696`, `:5292-5299`, `:7795-7802`) | Yes — and **entirely unmeasured**: `scripts/validators/validate-design-system.mjs:50` `EXILED_APP_ROOTS = new Set(['apps/marketing-site'])` |
| `platform-console` | 6 | Re-declares `--lb-color-primary`, `-hover`, `-active`, `-subtle`, `--lb-color-brand-purple`, `--lb-color-focus-ring` at `:root` (`globals.css:12-17`) — **the exact declaration `tokens.ts:1133-1135` forbids by name** | Dead inside the DesignSystemRoot subtree (`:root` 0,1,0 loses to surface 0,2,0); active on markup outside it |
| `platform-operations-portal` **[FROZEN]** | 6 | Byte-identical copy of the platform-console block (`globals.css:11-16`) | Same |
| `storefront-runtime` | 9 | **The only correct pattern in the repo.** `globals.css:391-400` scope-overrides canonical EmptyState tokens onto the merchant theme namespace: `.storefront-empty-state { --lb-component-empty-state-bg: var(--surface); … }` | Yes, and intentional |
| `identity-platform` / `theme-marketplace` **[FROZEN]** | **0** | Consume the token layer without forking it | — |

**The storefront's real gap is what it *does not* bridge.** `grep -n -- "--lb-component-banner\|--lb-color-critical\|--lb-color-success\|--lb-color-warning\|--lb-component-badge\|--lb-color-surface-subdued" apps/storefront-runtime/src/app/globals.css` returns **nothing**. The merchant theme injects 24 CSS variables at `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:178-212` (`--primary`, `--surface`, `--text`, `--is-dark`, …) and **not one is a semantic feedback colour** — no `--success`, no `--error`, no `--warning`. A merchant can theme their store but cannot theme a single error, success or stock message. That is why the checkout error at `checkout-client.tsx:637` is hand-rolled `border-red-200 bg-red-50 text-red-700`.

Measured raw-palette volume in `apps/**/*.tsx` (`.next` excluded): `text-red-*` 26, `text-green-*` 17, `text-amber-*` 8, `text-emerald-*` 7, `bg-green-*` 9, `bg-red-*` 7, `bg-amber-*` 6, `bg-emerald-*` 4, `border-red-*` 4, `border-amber-*` 5, `border-green-*` 3. Per app: **storefront-runtime 70** (28 in `checkout-client.tsx` alone), platform-console 19, platform-operations-portal 12 **[FROZEN]**, theme-marketplace 11 **[FROZEN]**, marketing-site 8, merchant-control-plane 0, identity-platform 0. The one customer-facing app carries the entire raw-colour debt. All of it is counted by `tailwindPaletteClasses` (baseline **535**) — i.e. it is **baselined, not blocked**, which is in direct tension with `AGENTS.md:294` UI-R7 ("The drift ratchet MUST BLOCK new drift … MUST NOT add naked rgb()/hsl(), raw px, or arbitrary radius where a `--lb-*` token exists").

Two corrected Tailwind figures (the survey used v3 hexes): storefront savings `text-green-600` = **`#00A63E`, 3.22:1** on white (not `#16A34A`/3.30); storefront field errors `text-red-500` = **`#FB2C36`, 3.82:1** (not `#EF4444`/3.76 — that is the LetBuyy token hex, not Tailwind's). Both still fail AA.

### 14.7 The interchange file is not actually guarded

`packages/typescript/ui/tokens.json` is a DTCG projection consumed by `scripts/generators/generate-mobile-tokens.mjs:21` (→ `packages/dart/ui_kit`) and by `generate-design-tokens.mjs --emit-css`. Its drift check asserts only that **15 hardcoded primitive anchor values** (`generate-design-tokens.mjs:69-85`) appear somewhere in `tokens.ts` (`:91`). `color.semantic.dark.*` is **never checked, and it has drifted**: `tokens.json:81` dark.bg `#111827` vs `tokens.ts` `ink[950]` `#0a0912`; `:82` surface `#111827` vs `ink[850]` `#0d0b16`; `:84` card `#1F2937` vs `ink[800]` `#15131f`; `:85` sidebar `#0F172A` vs `ink[900]` `#0d0b15`; `:89` border `#334155` vs `rgba(139,92,246,0.18)`.

`tokens.json` also carries **no `statusSoft`, no `statusText`, and no `ink`/`brandInk` primitives** — so Figma and the Flutter bridge **cannot see any of the values that decide banner and badge contrast**.

### 14.8 What the governance gate can and cannot see

`scripts/validators/validate-design-system.mjs` measures ten lexical metrics — `appCssRawHex`, `appCssNakedRgbHsl`, `tailwindPaletteClasses`, `appLocalLbTokenRedefs`, `rawPxFontSize`, `rawPxSpacing`, `tsxInlineStyles`, `tsxRawHex`, `tsxArbitraryRadius`, `tsxArbitraryShadow` (baselines in `scripts/validators/design-system-baseline.json`) — plus four hard invariants. It walks `apps/` **only** (`:39`, `:72-73`) and exempts `packages/typescript/ui` as the token layer.

Consequences, stated bluntly:

- The 145 dead variables, the 12 dangling `--lb-*` names, the broken `--color-line-subtle` bridge, the `critical`/`danger` naming seam, the `statusToBadgeVariant` substring bug and the `InternalStatusPill` contrast failures **all live in code the ratchet is structurally blind to**.
- No metric measures **structural duplication**. 39 forked status→tone functions and 41 copy-pasted metric tiles are 100% token-clean and score **zero drift**.
- `apps/marketing-site` — which carries the largest parallel feedback CSS system in the repo — is **exiled entirely** (`validate-design-system.mjs:50`).
- The gate is currently **green and improving** (9 of 10 metrics below baseline). Nothing in this report will surface through CI.

---

## 15. Domain Status Inventory

**There are no Postgres native enums in this repository.** `grep -rn "AS ENUM" --include=*.sql` over the whole repo returns **zero hits**. Every status is `text` + a `CHECK` constraint (237 CHECK-ARRAY constraints in `000_baseline.sql` alone, plus ~75 later migrations that `DROP` and re-`ADD` them). **The authoritative value set is the last migration that touched the column, not the baseline.**

TypeScript models live in three layers: `packages/shared-types/src/index.ts` (entity contracts), the domain `*-core` packages (API write contracts), and per-app local unions. `packages/typescript/api-types` and `services/api-gateway/src/schemas/*.ts` are re-export barrels only.

### 15.1 Orders / payments / fulfilment

| Field | Authoritative DB set | TS set | Agree? |
|---|---|---|---|
| `orders.status` | `pending, pending_cod, confirmed, processing, shipped, delivered, cancelled, refunded, returned, rto` — `147_executable_order_state_risk.sql:34-46` (supersedes `000_baseline.sql:10172`) | `OrderStatusSchema` = 8 values, **no `returned`, no `rto`** — `shared-types/src/index.ts:628-637` | **No** |
| write contract | — | `UpdateOrderStatusSchema` = `confirmed, processing, shipped, delivered, cancelled, refunded` — `packages/checkout-core/src/index.ts:233-235`. `VALID_TRANSITIONS` (`:1426-1435`) has **no `returned`/`rto` target from any state**. | `returned`/`rto` are **unwritable through the API** |
| merchant UI union | — | `all, pending, confirmed, processing, shipped, delivered, cancelled, refunded` — `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:57` — **no `pending_cod`** | No |
| `orders.payment_status` | `pending, paid, failed, refunded` — `000_baseline.sql:10168` (no later migration widens it) | `PaymentStatusSchema` = 8 values — `shared-types:639-648` | **No — the TS union is a strict superset; 4 TS-legal values violate the CHECK on write** |
| `orders.fulfillment_status` | **NO CHECK CONSTRAINT AT ALL**, `DEFAULT 'unfulfilled'` — `000_baseline.sql:10145` | `FulfillmentStatusSchema` = `unfulfilled, partial, fulfilled, returned, cancelled` — `shared-types:649-655` | Unconstrained |
| `orders.fulfillment_state` (second column added by 147) | `unfulfilled, hold, partial, fulfilled, delivered, returned, rto, cancelled` — `147:53-54` | mirrored `shared-types:1727` | — |
| `order_items.fulfillment_status` | `unfulfilled, partial, fulfilled, returned` — `000_baseline.sql:10043` | — | 4 values vs the order's 8 |
| `orders.financial_state` | `pending, authorized, paid, partially_refunded, refunded, failed, voided` — `147:51-52` | — | — |
| `orders.refund_status` | `none, pending, processing, partially_refunded, refunded, failed` — `000_baseline.sql:10170` | **no TS type** | — |
| `orders.return_status` | `none, requested, authorized, received, refunded, closed, cancelled` — `000_baseline.sql:10171` | **no TS type** | — |
| `orders.cod_confirmation_status` | `not_required, requested, confirmed, rejected, expired` — `147:55-56` | `shared-types:1728` | **Yes** |
| `orders.rto_status` | `none, at_risk, in_transit, returned, resolved` — `147:57-58` | `shared-types:1729` | **Yes** |
| `orders.risk_level` | `low, medium, high` — `147:59-60` | `shared-types:1726` | **Yes** |
| `orders.order_source` | `checkout, draft, admin, import` — `147:47-48` | — | — |
| `orders.channel` | `web, whatsapp, instagram, pos, api` — `147:49-50` | `CommerceChannelSchema`, `shared-types:59` | **Yes** |

**Fulfilment is modelled three ways on the same order**, and `OrderSchema` carries two of them as separate fields (`shared-types:1715` `fulfillment_status`, `:1727` `fulfillment_state`).

### 15.2 Payments, refunds, returns, payouts

| Field | DB | TS |
|---|---|---|
| `payment_transactions.status` | `pending, processing, authorized, captured, completed, failed, partially_refunded, refunded, voided` — `000_baseline.sql:10335` | — |
| `payments.status` (V1 sessions) | `pending, requires_action, authorized, captured, failed, voided, refunded` — `142_executable_payment_sessions.sql:49` | — |
| `payment_attempts.status` | `pending, processing, succeeded, failed` — `000_baseline.sql:10297` | — |
| `payment_credentials.provider` | `razorpay, cashfree, upi, cod` — `142:10` | `V1PaymentProviderSchema`, `api-gateway/src/schemas/payment.schema.ts:3` — **agree** |
| `payment_credentials.status` | `active, disabled, needs_verification` — `142:12` | — |
| `payment_webhook_events.processing_status` | `received, processing, processed, failed, ignored` — `000_baseline.sql:10355` | — |
| — | — | `PaymentStatusSchema` uses **`paid`** where both payment tables store **`captured`**, and has no `captured` member (`shared-types:639-648`) |
| — | — | `PaymentProviderSchema` (7) `shared-types:656-664`; `PaymentMethodSchema` (7) `:665-673` |
| `refunds.status` | `pending, processing, succeeded, failed, cancelled` — `000_baseline.sql:11158` | **no TS type** |
| `refund_attempts.status` / `refund_transactions.status` | `pending, processing, succeeded, failed` — `000_baseline.sql:11073`, `:11126` | — |
| `refunds.refund_method` | `original_payment, gift_card, manual` — `000_baseline.sql:11157` | `RefundOrderSchema`, `checkout-core:439` — **agree** |
| `returns.status` | `requested, authorized, rejected, received, inspected, approved, refunded, closed, cancelled` — `000_baseline.sql:11376` | `ReturnStatusSchema`, `checkout-core:395-405` — **agree** |
| `return_lines.status` | `requested, authorized, received, inspected, restocked, refunded, rejected` — `000_baseline.sql:11320` | — |
| `return_requests.status` (2nd parallel table) | `pending, approved, rejected, processing, refunded, completed` — `000_baseline.sql:11346` | — |
| `payouts.status` (V1 settlement) | `scheduled, processing, paid, failed, cancelled` — `151_executable_settlement_ledger.sql:138` | **no TS type** |
| `payout_statements.status` | `pending, processing, released, failed` — `119_mobile_money_ledgers.sql:38` | `MerchantPayoutStatusSchema`, `shared-types:712` — **agree** |
| `partner_payout_ledger_entries.status` | `pending, processing, released, failed, cancelled` — `000_baseline.sql:10265` | — |
| `partner_payout_ledger_entries.rail` | `razorpay_route, razorpayx, upi, manual` — `000_baseline.sql:10263` | `MerchantPayoutRailSchema` = 3 (`shared-types:713`) — **`razorpayx` inexpressible** |
| `wallet_ledger_entries.status` | `pending, posted, held, reversed` — `119:70` | `shared-types:717` — **agree** |
| `cod_reconciliation_entries.status` | `pending, collected, reconciled, short, over, reversed` — `140_mobile_cod_reconciliation.sql:44-51` | `shared-types:719` — **agree** |
| `settlements` / `reserves` / `recon_breaks` | `recorded/break_detected/failed`; `held/released/applied`; `open/explained/resolved` — `151:75, :106, :188` | — |

`refund_status` **means two different things in two APIs**: `services/api-gateway/src/routes/orders.ts:98` selects the `orders.refund_status` column, while `services/api-gateway/src/routes/returns.ts:88` emits a field of the same name populated from `refunds.status` (`refund_status: primaryRefund.status || null`). `succeeded`/`cancelled` can appear in one and never the other; `none`/`partially_refunded` the reverse.

### 15.3 Catalog, inventory, customers, stores

| Field | DB | TS |
|---|---|---|
| `products.status` | **NO CHECK CONSTRAINT**, `DEFAULT 'draft'`, plus a separate `is_active boolean` — `000_baseline.sql:10608`, `:10597` | `ProductStatusSchema` = `draft, active, archived` — `shared-types:609`; list filter `ListProductsQuery.status` = `active, inactive, all` — `commerce-core:101` |
| `product_variants` | **no status column at all** — `000_baseline.sql:10512-10529` | — |
| `collections` | **no status column at all**, only `is_active` — `000_baseline.sql:8733-8747` | `CollectionStatusSchema` = `draft, active, archived` — `shared-types:623`, applied at `:1315` with `.default('draft')` |
| `inventory_reservations.status` | `active, hold, committed, released, expired, fulfilled, cancelled` — `000_baseline.sql:9622` | — |
| `inventory_adjustments.reason` | `sale, return, adjustment, recount, transfer, damaged, reserved, unreserved` — `000_baseline.sql:9502` | `InventoryAdjustmentReasonSchema` = 10 values — `shared-types:611-622`; only 4 overlap |
| `inventory_locations.status` / `suppliers.status` | `active, inactive` — `000_baseline.sql:9595`, `:12475` | — |
| `inventory_transfers.status` | `reserved, shipped, partially_received, received, cancelled` — `000_baseline.sql:4937` | — |
| `purchase_orders.status` | `draft, ordered, partially_received, received, cancelled, closed` — `000_baseline.sql:5151` | — |
| `store_customers.status` | `active, disabled, guest` — `000_baseline.sql:12206` | `CustomerStatusSchema` = `active, disabled, invited` — `shared-types:626` |
| `carts.status` | `active, abandoned, converted, recovered` — `000_baseline.sql:8660` | `CartStatusSchema` = `active, converted, abandoned, expired` — `shared-types:627` |
| `sites.status` | `draft, published, unpublished, frozen, suspended` — `000_baseline.sql:12026` | `StoreStatusSchema` = 4, **no `unpublished`** — `shared-types:605`; write contract `UpdateStoreSchema.status` = `draft, published, suspended` — `tenant-core:216` |
| `sites.trial_status` | `active, grace, frozen, cancelled, paid` — `000_baseline.sql:12027` | untyped `z.string().max(80)` — `shared-types:1015`, `:1832` |
| `sites.ssl_status` | `pending, active, failed` — `000_baseline.sql:12025` | only `CustomDomainHealthSchema.ssl_active: z.boolean()` — `shared-types:1034` (**3 states flattened to 2**) |
| `sites.custom_domain_status` | `none, pending, review, verifying, active, error` — `090_custom_domains_and_store_access.sql:15` | `CustomDomainStatusSchema`, `shared-types:606` — **agree** |
| `sites.access_mode` / `site_type` | `090:20`; `000_baseline.sql:12024` | `shared-types:607`, `:604` — **agree** |
| `domain_orders.status` | `created, registering, provisioning, active, failed` — `090:183` | `DomainPurchaseResultSchema.status` — **no `created`, no `registering`** — `shared-types:1073` |
| `gift_card_accounts.status` | `active, held, disabled, expired` — `000_baseline.sql:9386` | `GiftCardStatusSchema` = `active, redeemed, expired, disabled` — `shared-types:624`. Canonical writer `set_gift_card_status` accepts only `active, held, disabled` — `173_v1_gift_card_issuance_lifecycle.sql:266` |

### 15.4 Content, moderation, staff, billing, ops

| Field | DB | TS |
|---|---|---|
| `pages.status` / `storefront_pages.status` | `draft, published, archived` — `000_baseline.sql:10228`, `:12301` | `PageStatusSchema`, `shared-types:677` / `cms-core:4` — **agree** |
| `blog_posts.status` | `draft, published, archived, scheduled` — `000_baseline.sql:8576` | `BlogPostStatusSchema`, `shared-types:679` — **agree** |
| `blog_comments.status` | `pending, approved, spam, rejected` — `000_baseline.sql:8526` | `BlogCommentStatusSchema`, `shared-types:680` — **agree** |
| `product_reviews.status` | `pending, approved, rejected` — `000_baseline.sql:10504` | `ReviewModerationStatusSchema`, `shared-types:625` — **agree** |
| `form_submissions.status` | `new, read, replied, contacted, converted, archived, spam` — `000_baseline.sql:9273` | `FormSubmissionStatusSchema`, `shared-types:681-689` — **agree** |
| `employees.status` | `invited, active, disabled, removed` — `000_baseline.sql:9193` | `EmployeeStatusSchema` = `invited, active, inactive, removed, suspended` — `shared-types:1908` |
| `employees.role` | 10 roles — `000_baseline.sql:9192` | `employee_invites.role` = 6 — `000_baseline.sql:9139` (`editor`, `viewer`, `fulfillment`, `staff` can exist but can never be **invited**) |
| `site_memberships.status` | `invited, active, suspended, removed` — `000_baseline.sql:11914` | — |
| `subscriptions.status` | `active, cancelled, past_due, trialing` — `000_baseline.sql:12432` | `SubscriptionStatusSchema` adds `expired` — `shared-types:675`. `StoreSubscriptionSchema.status` is `SubscriptionStatusSchema.or(z.string().min(1).max(80))` (`:1820`) — **the enum buys no runtime safety** |
| `subscriptions.plan` | 8 tiers — `176_v1_founding_program_schema.sql:216-217` | `SubscriptionTier`, `billing-core:5,12` — **agree**. But `users.subscription_tier` / `user_profiles.subscription_tier` cap at 4 (`000_baseline.sql:13119`, `:13098`) and `SubscribeSchema.plan_slug` at 4 (`billing-core:113,122`) |
| `subscriptions.billing_period` | `monthly, yearly` — `000_baseline.sql:12429` | `shared-types:674` — agree. But `CreatePlanSchema.billing_cycle` = `monthly, annual` — `billing-core:13,22` (**different field name and different value name for one concept**) |
| `merchant_kyc_documents.status` | `draft, submitted, needs_review, verified, rejected` — `120_mobile_kyc_documents.sql:38-44` | `shared-types:727-733` — **agree** |
| — | — | `MerchantKycOverallStatusSchema` = `not_started, in_progress, needs_review, verified, rejected` — `shared-types:735-741`, **no backing DB column found** |
| `merchant_2fa_factors.status` | `pending, active, disabled` — `121:27` | `shared-types:743` — **agree** |
| `webhook_deliveries.status` | `pending, processing, succeeded, failed, dead, cancelled` — `000_baseline.sql:1390` | **no TS type** |
| `webhook_subscriptions.status` | `active, paused, disabled` — `000_baseline.sql:13178` | `event-core:49` — **agree** |
| `platform_queue_jobs.status` / `outbox_events.status` | `queued, running, succeeded, failed, dead, cancelled`; `queued, processing, processed, failed, dead` — `000_baseline.sql:1319`, `:1244` | — |
| `site_api_clients.status` | `active, paused, revoked` — `000_baseline.sql:11865` | **no TS type** |
| `coupons.discount_type` **and** `coupons.type` (two parallel columns, identical CHECK) | `percentage, fixed, free_shipping, bogo` — `000_baseline.sql:8846`, `:8847` | `DiscountTypeSchema` = 3, **no `bogo`** — `shared-types:676`; `CreateCouponSchema.type` = 3 — `checkout-core:966` |
| `coupons` | **no status column**, only `is_active` — `000_baseline.sql:8831` | `ListCouponsQuery.status` = `active, expired, all` (derived filter) — `checkout-core:1000` |
| `promotions.status` / `promotion_codes.status` / `promotion_redemptions.status` | `draft/active/paused/expired/archived`; `active/paused/expired/archived`; `reserved/committed/released/voided` — `000_baseline.sql:10894`, `:10779`, `:10829` | — |
| `shipments.status` | `label_created, ready_to_ship, shipped, in_transit, out_for_delivery, delivered, failed, cancelled` — `000_baseline.sql:11793` | — |
| `shipping_labels.status` | `label_created, ready_to_ship, voided, cancelled` — `118_mobile_shipping_labels.sql:27` | — (no in-transit state on the label; `voided` only on the label) |
| `fulfillment_orders.status` / `_lines.status` | `open/in_progress/partially_fulfilled/fulfilled/cancelled`; `open/picked/packed/shipped/fulfilled/cancelled` — `000_baseline.sql:9328`, `:9300` | — |
| `checkout_sessions.status` | 9 values — `146_executable_checkout_state_machine.sql:30-41` | `checkout_state` (8) matches `CheckoutSessionStateSchema`, `checkout-core:72-81` — **agree** |
| Identity (`principals.realm` / `.actor_type` / `.status`) | `159_identity_foundation_core.sql:23,24,25` | `identity-core:6,9`, `auth-core:44` — **all agree** |
| Themes (`theme_packages.status`, `theme_package_versions.release_status`) | `000_baseline.sql:12765`, `:12739` | `theme-engine/src/theme-bundle.ts:433`, `:439` — **agree** |
| `theme_releases.release_status` | `published, superseded, rolled_back` — `000_baseline.sql:12877` (a **third** release vocabulary) | — |
| Marketplace apps **[FROZEN]** | `app_installations.status` `000_baseline.sql:8371`; `marketplace_apps.status` `:9738`; `app_versions.status` `098:26`; `app_billing_charges.status` `094:16-24` | `AppChargeStatusSchema`, `billing-core:97-104` — **agree** |

**Agreement is bimodal and it splits by era.** The "executable architecture" migrations (119-121, 140-153, 159, 176) agree almost perfectly with their TS counterparts. The baseline-era commerce tables — orders, payments, refunds, returns, products, collections, customers, carts, gift cards, coupons, employees, sites, subscriptions — all have at least one value that exists on one side and not the other. **Nothing in `scripts/validators/` compares a DB `CHECK` to a Zod enum**, which is the structural reason this drift accumulated with the gate green.

---

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

## 23. Semantic State Matrix

Ordered by whether a **single user in a single session** can observe the inconsistency. Only the first three rows are same-session.

| # | Meaning | Current UI | Current colour | Locations (conflicting sites side by side) | Consistent? | Recommended canonical mapping |
|---|---|---|---|---|---|---|
| 1 | **Content is a draft** (unpublished page) | `<Badge>` | **grey (`default`)** vs **amber (`warning`)** | `apps/merchant-control-plane/src/app/[store]/pages/page.tsx:67-70` → `published`=success, `archived`=critical, **else (draft) `return 'default'`**; rendered `:464`. VS `apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:100-103` → `published`=success, **`draft`=`'warning'`**, else default; rendered `:461-464`. Same endpoint (`pages/page.tsx:97` and `online-store/pages/page.tsx:211` both `fetch('/api/stores/{store}/pages?limit=100')`), same `PageStatus` type, both routes in `storeNavigation` (`merchantNavigation.ts:149` "Content", `:167` "Store pages"). | **No — airtight** | `draft` → one tone platform-wide. Recommend a new **`pending`/neutral-info** tone distinct from `warning` (which must mean "needs your attention"). |
| 2 | **Subscription lifecycle** (trialing / cancelled / expired) | `StatusBadge` fork vs `StatusPill` | trialing **green vs amber**; cancelled **red vs blue**; expired **grey vs blue** | `apps/platform-console/src/app/(dashboard)/subscriptions/page.tsx:57` `<StatusBadge value={row.status \|\| 'active'} />` → `ConsoleDataTable.tsx:89-107` (raw palette). VS `apps/platform-console/src/app/(dashboard)/revenue/page.tsx:137` `<StatusPill value={row.status \|\| 'active'} />` → `internal-workspace.tsx:156-163`. **Same endpoint** — both call `fetchConsoleApi(...'/internal/console/subscriptions'...)` (`revenue:46`, `subscriptions:91`). **Adjacent nav entries** — `(dashboard)/layout.tsx:32` Revenue, `:34` Subscriptions. | **No — same data, adjacent tabs** | One pill component. Retire the `ConsoleDataTable` fork onto `InternalStatusPill` (or `Badge`). |
| 3 | **Provider is live / verified** | `ProviderModeBadge` + `Badge`, siblings in one flex row | **two different greens** (`#22C55E` vs `#15803D`) on the identical `#DCFCE7`; two ambers likewise | `apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx:363-367` renders both in one `<div className="flex …">`. `ProviderModeBadge.tsx:3-6` uses `--lb-color-{success,warning}`; `feedback.tsx:44-55` uses `--lb-component-banner-*`. | **No — same element, money surface** | One token family for status. `--lb-component-banner-*` (the accessible `statusText` ramp) should be the only one any status pill reads. |
| 4 | **Moderation verdict** (pending / rejected) | `<Badge>` | pending **grey vs amber**; rejected **grey vs red** | `apps/merchant-control-plane/src/app/[store]/comments/page.tsx:66-70` → `approved`=success, `spam`=warning, **else (pending, rejected) `'default'`**; rendered `:206`. VS `apps/merchant-control-plane/src/app/[store]/reviews/page.tsx:70-74` → `approved`=success, **`pending`=`'warning'`**, **else (rejected) `'critical'`**; rendered `:300`. Both live merchant moderation queues over UGC, both in `storeNavigation` (`:155`, `:142`). | **No** | `pending`→pending-tone, `approved`→success, `rejected`→critical, `spam`→critical. One shared moderation mapper. |
| 5 | **Instrument no longer works** ("Expired") | `<Badge>`, label literally `Expired` in both | **amber vs red** | `apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx:98-102` `if (status === 'expired' \|\| status === 'held') return 'warning'`. VS `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx:94-97` `if (isExpired(coupon)) return 'critical'`. | **No** | Terminal-but-not-failure → one tone. Recommend **neutral/grey**, reserving red for *failure* and amber for *needs action*. |
| 6 | **Customer's order is being processed** | inline `style` from a raw-rgb map | `rgb(59 130 246)` (identical to `confirmed`) vs `rgb(14 165 233)` | `apps/storefront-runtime/src/app/store/[subdomain]/account/orders/orders-client.tsx:23-31` — `confirmed` **and** `processing` are both `rgb(59 130 246)`. VS `.../orders/orders-client.tsx:18-27` — `processing: rgb(14 165 233)`. Both are live shopper routes (linked from `account-bottom-sheet.tsx:539` and `checkout-client.tsx:585` / `checkout/success/page.tsx:29`). | **No** | Shopper order status should consume the canonical tone tokens through a bridged storefront layer, not raw rgb. |
| 7 | **COD order awaiting confirmation** | raw label + fallback colour | **grey with raw enum text `Pending_cod`** vs amber "COD pending" | `account/orders/orders-client.tsx:23-31` has **no `pending_cod` key** → falls back to `rgb(107 114 128)` at `:104-105`, label at `:108` is `charAt(0).toUpperCase()` → `Pending_cod`, and `timelineIndex` (`:40-45`) returns 0. VS `orders/orders-client.tsx:20` `pending_cod: { color: 'rgb(245 158 11)', label: 'COD pending' }`. Value is real: written by a trigger at `074_cod_pending_status.sql:37,53`; `apps/storefront-runtime/src/app/api/customer/orders/route.ts:15-16` forwards `payload.orders` verbatim with no normalisation. | **No — shopper-facing bug** | Total `Record<OrderStatus, {tone,label}>` coverage with a compile-time exhaustiveness check. |
| 8 | **Refunded order** | `<Badge>` vs raw rgb | merchant **red**; shopper **`rgb(107 114 128)`** on one route, **`rgb(100 116 139)`** on another | `orders/page.tsx:158` `['cancelled','refunded','failed'] → 'critical'`. VS `account/orders/orders-client.tsx:30` `refunded: 'rgb(107 114 128)'`. VS `orders/orders-client.tsx:26` `refunded: { color: 'rgb(100 116 139)' }`. **Two different greys that are not the same value.** | **No** | One tone; two greys for one state is unambiguous drift. |
| 9 | **Not connected / data source missing** | `InternalSkipBackendPanel` vs `<Banner variant="warning">` | `#F59E0B` vs `#92400E` **on the identical `#FEF3C7`** | `internal-workspace.tsx:188-190` (eyebrow "Not available" in `text-[var(--lb-color-warning)]`). VS `feedback.tsx:50-55`. Both live in `platform-operations-portal` **[FROZEN]** (`operations/communications/page.tsx:214-215` and `operations/onboarding/page.tsx:185` render `<Badge variant="warning">`). | **No** — but app-level, not same-page (verified: those two pages do not also render SkipBackendPanel) | Same token family for both. |
| 10 | **Payout in flight** | `<Badge>` | merchant **blue (`info`)** vs operator **amber (`warning`)** | `apps/merchant-control-plane/src/app/[store]/payouts/page.tsx:43-48` `if (status === 'processing') return 'info'`. VS `apps/platform-console/src/app/(dashboard)/developers/page.tsx:111-119` `if (status === 'pending' \|\| status === 'processing') return 'warning'`. | **Vocabulary drift only** — different tables (`payout_statements` uses `released`, V1 `payouts` uses `paid`), different payees, different audiences; **no single user sees both** | Align the vocabulary before aligning the colour. |
| 11 | **Archived / filed away** vs **failed** | `<Badge variant="critical">` | **the same red for both** | `pages/page.tsx:69` `archived → 'critical'`; `posts/page.tsx:92` same; `dashboard/page.tsx:298` `status === 'archived' ? 'critical'`. VS `orders/[orderId]/page.tsx:204` `['failed','refunded'] → 'critical'`; `payouts/page.tsx:45` `'failed' → 'critical'`. | **No — same colour, opposite meaning** | Red must mean *failure requiring action*. Archive is routine and reversible → neutral. |
| 12 | **Amber is doing four incompatible jobs** | `<Badge variant="warning">` | one amber for: transient, terminal, adversarial, healthy | transient → `lib/domains/domain-model.ts:40` (`verifying/pending/review`); terminal → `gift-cards/page.tsx:100` (`expired`); adversarial → `comments/page.tsx:68` (`spam`); **healthy** → `products/reservations/page.tsx:64` (`active` reservation). | **No — amber carries no signal** | Split into `pending` (transient, resolves itself) and `warning` (needs your action). Terminal → neutral. Adversarial → critical. |
| 13 | **Negated states** (`inactive`, `unpaid`, `unverified`, `not connected`) | would be `<StatusBadge>` | would be **green** | `feedback.tsx:96-97` — success keywords tested first with unanchored `includes`, so `inactive` matches `active`, `unpaid` matches `paid`, `not connected` matches `connected`. Executed and confirmed. | **Latent** — `statusToBadgeVariant` has zero consumers (`grep` returns only `index.ts:61`, `feedback.tsx:94`, `:118`); the one canonical `<StatusBadge>` call at `settings/notifications/page.tsx:650-654` passes `variant` explicitly | Replace substring matching with an explicit, exhaustive `Record<DomainStatus, StatusVariant>` per domain. |

---

## 24. Domain Status Matrix

One row per domain status actually rendered in a live surface. **[FROZEN]** rows are excluded from the active-product judgement. "Dead" marks components verified to have **zero import sites** (`StoreDirectoryIndexTable`, `SubscriptionManagementIndexTable`, `TrustSafetyIndexTable`, `TicketIndexTable`, `CrmContactIndexTable`, `MerchantHealthIndexTable`, `AppBlockSlotPanel`, `AICustomizationPanel`) — their status maps are authored intent, not user-visible behaviour. Note `OnboardingQueueIndexTable` and `CommunicationTemplateIndexTable` **are** live.

| Domain | Status value | Current representation | Component | Colour | Problems |
|---|---|---|---|---|---|
| **Orders** (merchant list) | `pending`, `pending_cod` | `<Badge label={titleize(status)}>` | `Badge` via `OrderStatusBadge` `orders/page.tsx:163-165` | amber (fallback `:160`) | `pending_cod` is absent from the app's own filter union (`orders/page.tsx:57`), so a COD order matches **no filter chip** and renders with an unmapped label |
| | `confirmed`, `processing`, `shipped` | same | same | blue (`info`, `:159`) | — |
| | `delivered` | same | same | green | — |
| | `cancelled`, `refunded` | same | same | red (`:158`) | `refunded` red here, two different greys on the shopper side (§23 row 8) |
| | `returned`, `rto` | — | — | would be amber | **Unwritable** — not in `UpdateOrderStatusSchema` (`checkout-core:233-235`) and no `VALID_TRANSITIONS` target (`:1426-1435`); only a rollback script maps to `returned`. Walking all 8 *reachable* statuses through the list mapper and the detail mapper (`orders/[orderId]/page.tsx:193-199`) shows they **agree on every reachable value**. |
| **Orders** (payment column) | 4 DB-legal values | `<Badge>` reusing the **order** mapper | `PaymentStatusBadge` `orders/page.tsx:167-170` | pending amber / paid green / failed, refunded red | The list fallback is `warning` and the detail fallback is `info` (`orders/[orderId]/page.tsx:206`), but that divergence is only reachable for `requires_action`, `authorized`, `partially_refunded`, `voided` — all four **rejected by the CHECK** at `000_baseline.sql:10168`. Not a live conflict. |
| **Orders** (fulfilment) | all 5 `FulfillmentStatusSchema` values | `<Badge variant="info">` **hardcoded** | `orders/[orderId]/page.tsx:244` | **blue for everything** | `returned` and `cancelled` render identically to `fulfilled`. No mapper exists. |
| **Orders** (shopper) | 7 of 8 values | inline `style={{backgroundColor: `${c}15`, color: c}}` | raw `<span>` | raw rgb map `account/orders/orders-client.tsx:23-31` | `confirmed` and `processing` are the **same blue**; `pending_cod` missing → grey + `Pending_cod`; no token, no theming |
| | 8 of 8 values | same shape | raw `<span>` | raw rgb map `orders/orders-client.tsx:18-27` | Different `processing` and `refunded` hexes from the sibling route |
| **Payouts** | `pending` | `<Badge>` | `payouts/page.tsx:43-48`, rendered `:201` | amber (fallback) | Not in a `<Table>` at all — hand-rolled card grid `:170-219` |
| | `processing` | same | same | **blue** | Operator view says amber (`developers/page.tsx:116`) — vocabulary drift |
| | `released` / `failed` | same | same | green / red | Label is `charAt(0).toUpperCase()` only (`:50-52`) — underscores survive |
| **Gift cards** | `active` | `<Badge>` | `gift-cards/page.tsx:98-102`, rendered `:331` | green | — |
| | `expired`, `held` | same | same | **amber** | Coupons render "Expired" **red** (`coupons/page.tsx:95`) |
| | `disabled` | same | same | red | — |
| | `redeemed` | — | — | would be `default` (brand pill) | **Phantom** — in `GiftCardStatusSchema` (`shared-types:624`) but not in the DB CHECK (`000_baseline.sql:9386`) and not accepted by the canonical writer (`173:266`). Conversely `held` is mapped in the UI but absent from the TS union. |
| **Coupons** | derived `Expired` / `Active` / `Inactive` | `<Badge>` | `coupons/page.tsx:94-97`, rendered `:545` | red / green / `default` | Not enum-driven — derived from `is_active` + `expires_at`. No `coupons.status` column exists (`000_baseline.sql:8831`). `bogo` is DB-legal (`:8846`) and TS-impossible (`shared-types:676`). |
| **Products** | `draft` / `active` / `archived` | `<Badge>` | `productStatusBadge` map `products/page.tsx:37-45`, rendered `:295`, `:317` | `archived` → **critical (red)** | Red for a routine archive. Also **no DB CHECK at all** on `products.status` (`000_baseline.sql:10608`), and the list filter uses a *different* vocabulary (`active/inactive/all`, `commerce-core:101`). **Mobile parity gap:** the desktop cell wraps the Badge in an invisible `<select>` (`:299-311`) but `cardRender` (`:314-317`) returns a bare `<Badge>` — status is **read-only on mobile**. |
| **Collections** | `draft` (always) | — | — | — | `CollectionStatusSchema` is **entirely phantom** — `collections` has no status column (`000_baseline.sql:8733-8747`), so `shared-types:1315` `.default('draft')` makes every collection report draft |
| **Inventory** | `In stock` / `Low stock` / `Out of stock` | `<Badge>` | `products/inventory/page.tsx:254-258` | success / warning / critical | Correct and icon-bearing. **The row itself is never tinted** — `Table`'s `<tr>` is hardcoded `hover:bg-…` (`table.tsx:359`) and no `rowClassName`/`rowVariant` hook exists anywhere (`grep` = 0). |
| **Inventory reservations** | `active` | `<Badge>` | `products/reservations/page.tsx:62-70` | **amber** | Internally coherent (a transient hold) but collides lexically with `active` = green in locations/suppliers. Not a semantic conflict. |
| | `committed` / `released` / `expired` | same | same | green / `default` / red | — |
| **Transfers** | `received/partial/shipped/pending/cancelled` | `<Badge>` | `products/transfers/page.tsx:65-85`, rendered `:785` | success/info/warning/default/critical | The operations dashboard uses a **disjoint vocabulary** — `completed/in_transit/draft/cancelled` (`products/operations-dashboard/page.tsx:56-74`), overlapping on one value. Whichever set the API returns, one screen renders everything through its neutral default. |
| **Purchase orders** | `ordered/partial/received/cancelled` | `<Badge>` | `products/purchase-orders/page.tsx:48-67`, rendered `:665` | default/info/success/critical | `draft` has a label branch (`:60`) but **no variant branch** — falls to `default` |
| **Customers** | `active`, `disabled`, `blocked`, `suspended` | `<Badge>` | `customers/page.tsx:129-134`; detail `customers/[email]/page.tsx:184-189` | green / red | `guest` (a real DB value, `000_baseline.sql:12206`) has **no TS type**; `invited` (TS-only, `shared-types:626`) falls to `info` and is unwritable |
| **Stores** (merchant picker) | `draft/published/unpublished/frozen/suspended` | `<span class="all-stores-card-status …">` | `apps/merchant-control-plane/src/app/stores/AllStoresClient.tsx:165` | **every store renders red** | **Live bug.** The test is `store.status === 'active' ? 'active' : 'inactive'`, but `sites.status` never contains `active` (`000_baseline.sql:12026`). So `.all-stores-card-status.active` (`globals.css:1946-1949`, emerald) is **unreachable**, `const activeStores = stores.filter((s) => s.status === 'active')` (`:70`) is **always empty**, and a healthy `published` store shows a **red** pill with the raw lowercase label — while `published` is green on four other merchant surfaces (`pages/page.tsx:68`, `online-store/pages/page.tsx:101`, `posts/page.tsx:91`, `dashboard/page.tsx:305`). Uses naked `rgba(239,68,68,0.12)` + `var(--error)`. |
| **Stores** (console) | `active/published/verified/trialing` | `<StatusBadge value>` | `ConsoleDataTable.tsx:89-107`, consumed `stores/page.tsx:64` | `bg-emerald-500/10 text-emerald-300` | Raw palette, **no icon** (colour-only), **dark-only** (UI-R3 violation). Renders `{value}` **raw** — operators see `past_due`, `frozen`. |
| | `draft/pending/past_due` | same | same | amber | — |
| | `suspended/cancelled/inactive/false` | same | same | red | — |
| | `frozen`, `expired`, **`failed`**, `error`, `declined` | same | same | **`zinc` grey** | **A `failed` row in a console list renders neutral grey.** The red list (`:95`) omits every failure word. |
| **Subscriptions** (merchant) | `active`, `trialing` | `<Badge>` | `settings/plan/page.tsx:115-119`, rendered `:241-242` | green | — |
| | **`cancelled`** | same | same | **amber** | **Live bug.** `:117` tests `status === 'canceled'` (one L). The canonical enum is `cancelled` (`shared-types:675`) and the gateway only ever emits `cancelled` (`services/api-gateway/src/routes/internal-billing.ts:46`). The real value misses the critical branch and falls through to `warning` at `:118` — while `formatStatus` (`:112`) still prints "Cancelled". |
| | `expired` | same | same | red | Not a DB-legal value (`000_baseline.sql:12432`) |
| **Subscriptions** (console) | all | `<StatusBadge>` vs `<StatusPill>` | two components, same endpoint | see §23 row 2 | trialing green vs amber; cancelled red vs blue; expired grey vs blue |
| **Staff / employees** | `active` / `disabled` | `<Badge>` | `settings/users/page.tsx:119-123`, rendered `:405` | green / red | — |
| | `invited` | same | same | amber | — |
| | `inactive`, `removed`, `suspended` | same | same | **amber, labelled "Invited"** | `formatStatus` (`:113-117`) returns the literal `'Invited'` for **everything** that is not `active`/`disabled`. A **removed** staff member is shown to the merchant as an amber "Invited" badge. `disabled` (the only DB deactivation state, `000_baseline.sql:9193`) is missing from `EmployeeStatusSchema` (`shared-types:1908`); `inactive`/`suspended` are TS-only and violate the CHECK. |
| **Domains** | `none/pending/review/verifying/active/error` | `<Badge>` + separate SSL badge | `lib/domains/domain-model.ts:18-42` → `components/domains/parts.tsx:18-19` | `active`=success, `error`=critical, `pending/verifying/review`=warning, `none`=info | **The one well-built mapping in the repo** — total `Record<DomainStatus,…>` coverage and genuine product-voice labels (`Not connected`, `Needs DNS setup`, `Action required`). Its header comment states the rule the rest of the repo ignores: *"The UI MUST consume these helpers and never re-derive status/score independently."* |
| **Domains** (SSL) | `pending/active/failed` | boolean badge | `parts.tsx:23` | 2 states | `sites.ssl_status` has 3 states (`000_baseline.sql:12025`) but the only TS surface is `ssl_active: z.boolean()` (`shared-types:1034`) — **"certificate issuing" and "certificate failed" collapse to the same `false`** |
| **Domain orders** | `created`, `registering` | — | — | — | **Inexpressible** — `DomainPurchaseResultSchema` (`shared-types:1073`) omits both, so the states a domain occupies for the entire registrar round-trip cannot be represented |
| **Pages** (Content route) | `published/draft/archived` | `<Badge>` | `pages/page.tsx:67-70` | success / **default** / **critical** | §23 row 1 |
| **Pages** (Store pages route) | `published/draft` | `<Badge>` | `online-store/pages/page.tsx:100-103` | success / **warning** | §23 row 1. Note: this surface **filters archived pages out entirely** (`:186` `pages.filter((page) => page.status !== 'archived')`, `:602`), so the `archived` fallthrough is only reachable for **policies** (`:662`, badge `:519-522`) — the real finding is that one Pages screen shows archived pages and the other silently hides them. |
| **Blog posts** | `published`/`archived` | `<Badge>` | `posts/page.tsx:90-98`, rendered `:309` | success / critical | `scheduled` is unmapped → `default`, indistinguishable from a draft |
| **Blog comments** | `approved`/`spam` | `<Badge>` | `comments/page.tsx:66-70`, rendered `:206` | success / warning | `pending` and `rejected` both → `default` grey (§23 row 4) |
| **Reviews** | `approved`/`pending`/`rejected` | `<Badge>` | `reviews/page.tsx:70-74`, rendered `:300` | success / warning / critical | Disagrees with comments on `pending` and `rejected` |
| **Reviews** (rating) | 1–5 stars | 5 `<Star>` icons | `testimonials/page.tsx:100-116`; storefront `product-reviews.tsx:36-60` | `--lb-color-warning` vs `--lb-color-border`; `text-amber-400` vs `text-gray-200` | **Colour-only, no accessible value.** Merchant: `aria-hidden` explicit, rendered in a text-free div (`:412`). Storefront: `lucide-react` auto-hides childless icons, so five buttons have **empty accessible names**; active/inactive contrast **1.39:1**. |
| **Contact submissions** | `new`/`read`/`replied`/`spam` | `<Badge>` | `contact/page.tsx:52-61`, rendered `:321`, `:357` | info / success / warning | `contacted`, `converted`, `archived` unmapped → `default` |
| **Leads** | `new`/`contacted`/`converted` | `<Badge>` | `leads/page.tsx:77-82`, rendered `:293` | info / warning / success | Maps `contacted`/`converted` that contact leaves neutral — but the two surfaces read **different `type` filters** (`contact/page.tsx:79` `?type=contact`, `leads/page.tsx:109` `?type=lead`) and live in **different site-type navigations** (`merchantNavigation.ts:198` portfolio, `:223` landing), so no merchant sees both. Not a defensible conflict. |
| **Marketing campaigns** | `sent/failed/sending/scheduled/cancelled/draft` | `<Badge>` | `marketing/page.tsx:138-160`, rendered `:453` | success/critical/warning/info/**default**/default | `cancelled` grey here vs red for orders — different consequence classes, so vocabulary drift rather than a semantic conflict |
| **Provider mode** (UI-R6) | `sandbox` / `live` | bespoke pill | `ProviderModeBadge.tsx:13-23` | `--lb-color-{warning,success}` family | **UI-R6 says "systemic … (web + Flutter)"** (`AGENTS.md:293`) but `grep -rn ProviderModeBadge packages/` = 0 — it is app-local to merchant-control-plane, with an independent Flutter copy at `apps/mobile/merchant-app/lib/widgets/shared/provider_mode_badge.dart`. **Neither has a `mock` member** despite the rule naming `mock/sandbox/live`; both render **nothing** on an unknown mode (`ProviderModeBadge.tsx:14 if (!mode) return null`) — the ANTI-R9 failure shape. Mitigating: the gateway only ever emits `sandbox`/`live`. **The shopper-facing storefront checkout has no provider-mode badge at all.** Also uses raw `text-[11px]` and `py-[2px]`. |
| **Notification delivery** | `sent/delivered/suppressed/failed/bounced` | `<StatusBadge status label variant>` | `settings/notifications/page.tsx:147-152`, rendered `:650-654` | success/warning/critical | **The only canonical `<StatusBadge>` in `apps/`** — and it passes both `label` and `variant`, so `statusToBadgeVariant` is bypassed and the **raw enum string** is displayed |
| **Incidents** (console) | `open/mitigating/resolved/closed` | `<StatusPill>` | `(dashboard)/incidents/page.tsx:33-48`, rendered `:271` | **critical**/warning/success | `open` → red. Severity uses a second mapper (`sev1\|sev2`→critical). Raw-ramp contrast: **critical 3.94:1** in the default dark theme. |
| **Compliance / DSR** (console) | `fulfilled/rejected/expired/open/verifying/in_progress` | `<StatusPill>` | `(dashboard)/compliance/page.tsx:84-89`, rendered `:260` | success/critical/warning/info | Raw-ramp contrast failures |
| **Developers / partner payouts** (console) | `approved/pending/suspended/rejected`; `paid/pending/processing/failed` | `<StatusPill>` | `(dashboard)/developers/page.tsx:102-119` | success/warning/critical/info | `processing` amber vs merchant blue |
| **Break-glass grants** (console) | derived `revoked/expired/active` | `<StatusBadge>` fork | `(dashboard)/employees/page.tsx:85-89`, rendered `:502` | red/amber/green raw palette | Lowercase raw labels |
| **Operations metrics** (console) | counts + tone | `LeadershipMetric` | `internal-workspace.tsx:43-65` | **tone silently discarded when `detail` is omitted** | `toneClass` is computed at `:44-49` but applied **only** inside `{detail ? <p className={cx(…, toneClass)}> : null}` (`:59-63`); the `value` paragraph (`:56-58`) is hardcoded `text-[var(--lb-color-text)]`. 27 of 36 tone-passing sites omit `detail`. Two sites two lines apart prove it: `(dashboard)/operations/page.tsx:337` (with `detail`, tone visible) vs `:338` `DLQ messages` (no `detail`, tone **invisible**). **Money impact:** `(dashboard)/money-reconciliation/page.tsx:129-130` — `Breaks` and `Break variance` both pass `tone='critical'` with no `detail`, so a ledger reconciliation break renders **visually identical to a clean zero**. |
| **Operations dashboard** (console) | error + counts | `ConsoleApiErrorPanel` + metrics | `(dashboard)/operations/page.tsx:286-296`, `:330-340` | warning-toned panel above **success-toned zeros** | `:286-296` collects `errors[]` yet still returns `overview: … \|\| {}`, `commands: … \|\| []`. Render order is the panel (`:330-332`), then `Open incidents 0`, `DLQ messages 0` **tone='success'**, `Firing alerts 0` **tone='success'** (`:335-340`). **The incident-command console reports all-clear during a total outage.** The panel is a plain `<section>` with **no `role="alert"` and no `aria-live`** (`ConsoleDataTable.tsx:144-151`); `grep -rn 'role="alert"\|aria-live=' apps/platform-console/src` = **0** across the entire app. |
| **Capabilities** **[FROZEN]** | `available/partial/planned/skip` | local `StatusBadge` wrapping canonical `Badge` | `apps/developer-portal/src/components/_local-ui/developer-docs.tsx:61-71` | success/warning/info/warning | Label is `status.toUpperCase()` — the only SHOUTING label style in the repo |
| **App marketplace** **[FROZEN]** | `published/approved/active/trialing/rejected/suspended/pending/changes_requested/in_review` | CSS class fork | `apps/app-marketplace/src/app/(auth)/developers/dashboard/page.tsx:62-73` | `.marketplace-badge--{success,info,critical,warning,neutral}` | Returns class strings, not variants |
| **Support tickets** **[FROZEN, dead]** | 6 values | — | `apps/platform-operations-portal/src/app/(dashboard)/support/TicketIndexTable.tsx:23-27` | `open/closed/escalated` → **critical** | **Zero import sites** — authored intent only |
| **Store directory / Trust & safety / Subscription mgmt** (console, **dead**) | `frozen`, `trialing`, `expired` | — | `StoreDirectoryIndexTable.tsx:164-178`, `TrustSafetyIndexTable.tsx:96-109`, `SubscriptionManagementIndexTable.tsx:106-120` | `frozen` → info **vs** critical | **Zero import sites.** The live console path (`ConsoleDataTable`) renders `frozen` as neutral `zinc` with the raw label. Do not report the three-way `frozen` conflict as user-visible. |

### 24.1 Cross-cutting problems visible in the matrix

1. **The canonical mapper never runs.** 39 local `statusVariant`/`statusTone`/`toneForStatus` functions carry the real behaviour; `statusToBadgeVariant` has zero consumers.
2. **Eight badge/pill implementations for one concept** — `Badge`/`StatusBadge` (`feedback.tsx:69`, `:117`), `InternalStatusPill` (`internal-workspace.tsx:146`), console `StatusBadge` (`ConsoleDataTable.tsx:89`), developer-portal `StatusBadge` **[FROZEN]**, `ProviderModeBadge` (web + Flutter), `.marketplace-badge--*` **[FROZEN]**, `.select-meta-status--*` (`identity-platform/globals.css:2217-2259`), `.all-stores-card-status` (`merchant globals.css:1937`).
3. **Colour-only status exists in a shopper-facing surface** (storefront stars, `product-reviews.tsx:36-60`) and in an active merchant runtime (`testimonials/page.tsx:100-116`), plus every `ConsoleDataTable` badge (no icon). Direct conflict with `AGENTS.md:291` UI-R4.
4. **Three live bugs, ranked**: (a) merchant store picker renders every store red because `sites.status` never equals `active` (`AllStoresClient.tsx:165` vs `000_baseline.sql:12026`); (b) `settings/plan/page.tsx:117` misspells `cancelled` so every cancelled subscription is amber; (c) `pending_cod` renders as grey `Pending_cod` with a stuck timeline on the shopper's own order list (`account/orders/orders-client.tsx:23-31`).
5. **Two silent-discard defects**: `LeadershipMetric` drops `tone` when `detail` is absent (money reconciliation affected); `orders/[orderId]/page.tsx:244` hardcodes `variant="info"` for all five fulfilment states.
6. **No governance gate covers any of this.** No validator compares a DB `CHECK` to a Zod enum, and none of the ten design-system ratchet metrics measures structural duplication, status vocabulary or state completeness. The gate is green.
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
## 29. Appendix

### 29.1 Canonical primitive source locations

| Primitive | File | Line |
|---|---|---|
| `Badge`, `BadgeProps` | `packages/typescript/ui/src/feedback.tsx` | 64, 69 |
| `StatusVariant` (union) | `packages/typescript/ui/src/feedback.tsx` | 29 |
| `statusStyles` (tone→class map) | `packages/typescript/ui/src/feedback.tsx` | 31-62 |
| `statusToBadgeVariant` | `packages/typescript/ui/src/feedback.tsx` | 94-102 |
| `StatusBadge` | `packages/typescript/ui/src/feedback.tsx` | 117 |
| `Banner` | `packages/typescript/ui/src/feedback.tsx` | 121-158 |
| `ToastMessage` / `ToastVariant` | `packages/typescript/ui/src/feedback.tsx` | 163-170, 160 |
| `toastPlacementStyles` | `packages/typescript/ui/src/feedback.tsx` | 185-195 |
| `ToastProvider` / `useToast` | `packages/typescript/ui/src/feedback.tsx` | 199 |
| `EmptyStateKind` | `packages/typescript/ui/src/feedback.tsx` | 338-352 |
| `EmptyState`, `EmptyStateIllustration` | `packages/typescript/ui/src/feedback.tsx` | — |
| `SaveBar` | `packages/typescript/ui/src/feedback.tsx` | 562-568 |
| `Skeleton` | `packages/typescript/ui/src/feedback.tsx` | — |
| `InlineError` | `packages/typescript/ui/src/input.tsx` | 162, 166 |
| `ConfirmDialogProps` / `ConfirmDialog` | `packages/typescript/ui/src/overlays.tsx` | 496-506, 508 |
| `useScrollLock` / `acquireScrollLock` | `packages/typescript/ui/src/overlay-hooks.ts` | 147+ |
| `FilterChips` | `packages/typescript/ui/src/primitives.tsx` | 393, 399 |
| `ProgressBar` | `packages/typescript/ui/src/primitives.tsx` | 443 |
| `Spinner` | `packages/typescript/ui/src/primitives.tsx` | 634 |
| `InternalStatusPill` | `packages/typescript/ui/src/internal-workspace.tsx` | 146-175 |
| `InternalEmptyDataState` | `packages/typescript/ui/src/internal-workspace.tsx` | 205-211 |
| `Table` / `TableProps` | `packages/typescript/ui/src/table.tsx` | 48-69, 103 |
| `warnDeprecated` (0 callers) | `packages/typescript/ui/src/deprecations.ts` | — |

> **Correction to the research brief:** `FilterChips`, `ProgressBar` and `Spinner` live in
> `primitives.tsx`, not `productivity.tsx`. `productivity.tsx` contains only `Avatar`,
> `CommandPalette`, `FilterBar`, `MetricCard`, `Pagination`.

### 29.2 Competing `StatusBadge` implementations

| # | File | Line | API | Tone source |
|---|---|---|---|---|
| 1 | `packages/typescript/ui/src/feedback.tsx` | 117 | `{status, label?, variant?}` | `--lb-component-banner-*` (700/800 ramp) |
| 2 | `apps/platform-console/src/components/ConsoleDataTable.tsx` | 89 | `{value, tone?}` | raw Tailwind `bg-emerald-500/10 text-emerald-300` |
| 3 | `apps/developer-portal/src/components/_local-ui/developer-docs.tsx` `[FROZEN]` | 68 | `{status: CapabilityStatus}` | local |

Imports of `StatusBadge`/`statusToBadgeVariant` from `@letbuyy/ui` across all apps: **0**.

### 29.3 Token pipeline

```
primitive.color.*                       tokens.ts:47-174
  └─ letbuyyColorTokens (flat aliases)  tokens.ts:210-237
      └─ letbuyySemanticTokens[theme]   tokens.ts:239-368
          │   .status      → raw hue    (#22C55E #F59E0B #EF4444 #3B82F6)
          │   .statusText  → 700/800    (accessible foreground)
          │   .statusSoft  → 100 / 950  (surface)
          └─ letbuyyComponentTokens     tokens.ts:370-550
              └─ sharedCssVariables     tokens.ts:905-1038
                 colorVariables         tokens.ts:1057-1126
                  └─ letbuyyTokenCssVariables   tokens.ts:1482-1491
                      └─ surfaceVariables       tokens.ts:1254-1357
                          └─ letbuyyTokenCss    tokens.ts:1520-1634
                              └─ <style data-letbuyy-token-source>
                                     token-style-boundary.tsx:24-27
```
403 distinct `--lb-*` variables emitted; 401 per theme. `adminSurfaceIdentity` (`tokens.ts:1140-1248`)
overrides **zero** status tokens — status colour is surface-invariant.

### 29.4 Resolved status colour values

| Role | Light | Dark |
|---|---|---|
| success — raw / text / soft | `#22C55E` / `#15803D` / `#DCFCE7` | `#22C55E` / `#22C55E` / `#052E16` |
| warning — raw / text / soft | `#F59E0B` / `#92400E` / `#FEF3C7` | `#F59E0B` / `#F59E0B` / `#422006` |
| danger — raw / text / soft | `#EF4444` / `#B91C1C` / `#FEE2E2` | `#EF4444` / `#FCA5A5` / `#451A1A` |
| info — raw / text / soft | `#3B82F6` / `#1D4ED8` / `#E0F2FE` | `#3B82F6` / `#7DD3FC` / `#082F49` |

Contrast (independently computed twice, WCAG relative luminance):

| Variant | Theme | Text on soft | Ratio | AA |
|---|---|---|---|---|
| success | light | `#15803D` on `#DCFCE7` | **4.57** | PASS (thin) |
| warning | light | `#92400E` on `#FEF3C7` | 6.37 | PASS |
| critical | light | `#B91C1C` on `#FEE2E2` | 5.30 | PASS |
| info | light | `#1D4ED8` on `#E0F2FE` | 5.84 | PASS |
| danger | dark | `#FCA5A5` on `#451A1A` | 7.82 | PASS |
| info | dark | `#7DD3FC` on `#082F49` | 8.32 | PASS |

`InternalStatusPill` uses the **raw 500 ramp as foreground** on the same soft surfaces:
1.93:1 (warning), 2.07:1 (success), 3.08:1 (critical), 3.21:1 (info) — **all fail AA**.

### 29.5 `statusToBadgeVariant` substring hazard

The mapper (`feedback.tsx:94-102`) uses `String.includes`, checking the success list **first**.
Negated statuses therefore match their positive keyword. Executed against the real value set:

| Status (real DB value) | Resolves to | Correct? |
|---|---|---|
| `inactive` | `success` | ✗ contains `active` |
| `unpublished` | `success` | ✗ contains `published` |
| `unverified` | `success` | ✗ contains `verified` |
| `partially_paid` | `success` | ✗ contains `paid` — should be warning |
| `past_due` | `default` | ✗ unmapped, renders neutral |
| `voided` | `default` | ✗ unmapped, renders neutral |
| `failed`, `payment_failed` | `critical` | ✓ |
| `partially_fulfilled` | `warning` | ✓ |

**Latent, not live** — the function has zero consumers. It must not be adopted as-is.

### 29.6 Verified live database facts

Local Supabase, `public` schema — 439 tables. **No native Postgres enums** repo-wide
(`grep "AS ENUM" *.sql` → 0 hits); every status is `text` + `CHECK`. 237 CHECK-ARRAY constraints in
`database/supabase/migrations/000_baseline.sql` alone, plus ~75 later migrations that DROP and re-ADD
them — so the authoritative value set for a field is the **last migration touching it**, not the baseline.

```
sites.status         draft | published | unpublished | frozen | suspended
sites.trial_status   active | grace | frozen | cancelled | paid
custom_domain_status none | pending | review | verifying | active | error
ssl_status           pending | active | failed
orders.status        10 values, migrations/147_executable_order_state_risk.sql:34-46
                     (NOT the 7 in baseline:10172)
```
Live `sites` rows at audit time: `published` ×3, `draft` ×2 — **zero** rows could ever satisfy
`AllStoresClient.tsx:165`'s `status === 'active'` test.

### 29.7 Raw palette class distribution (`apps/**/*.tsx`, build output excluded)

| App | Count | Status |
|---|---:|---|
| `platform-console` | 78 | active — worst offender |
| `storefront-runtime` | 64 | active — customer-facing |
| `marketing-site` | 24 | active (exempt from ratchet by design) |
| `platform-operations-portal` | 12 | `[FROZEN]` |
| `theme-marketplace` | 6 | `[FROZEN]` |
| `merchant-control-plane` | **0** | active — fully token-compliant |
| `identity-platform` | **0** | active — fully token-compliant |
| `developer-portal` | 0 | `[FROZEN]` |
| `app-marketplace` | 0 | `[FROZEN]` |

### 29.8 Governance references

- `scripts/validators/validate-design-system.mjs` — walks `apps/` only; exempts
  `packages/typescript/ui` as the token layer; 10 ratchet metrics, all visual.
- `scripts/validators/design-system-baseline.json` — the ratchet floor.
- `scripts/validators/shell-single-validator.mjs` — shell authority allow-list.
- Root `AGENTS.md` UI-R1 (one token source, :288) · UI-R2 (one app shell, :289) ·
  UI-R3 (light+dark, skeleton/empty/error, :290) · UI-R4 (WCAG AA floor, :291) ·
  UI-R5 (Lucide icons, avoid inline styles, :292) · UI-R6 (honesty badge, :293) ·
  UI-R7 (ratchet must block new drift, :294).
- **No validator measures component adoption or copy.** Findings ①③④⑤ in §1.3 are invisible to CI.

### 29.9 Audit provenance

| Phase | Agents | Output |
|---|---:|---|
| Survey | 16 | primitives, tokens, duplicates, toast, validation, api-errors, loading, empty-states, banners, domain enums, domain→UI mapping, a11y, responsive, copy, tables/modals, cross-app/legacy |
| Adversarial verification | 4 | zero-usage claims · colour conflicts · contrast maths · swallowed-error & double-submit claims |
| Authoring | 5 | §2–§28 |

~7.7M subagent tokens, ~1,900 tool calls. Verification refuted 33 claims across the four panels —
including the `fulfilled`/`returned` order-status conflicts (values unwritable), several Tailwind v3
hex assumptions (this repo is Tailwind v4/OKLCH), and the `ConflictDialog` double-submit claim (it
closes synchronously). Those corrections are reflected throughout.
