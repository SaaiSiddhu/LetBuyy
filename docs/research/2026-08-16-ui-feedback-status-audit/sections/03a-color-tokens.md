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

