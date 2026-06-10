# LetBuyy Design System — Remediation Log

**Date:** 2026-06-08 · **Package:** `@letbuyy/ui` 0.0.2 → **1.0.0** · **Principle:** keep the architecture, close the edges, harden operations. No rewrites.

Everything below was applied to the repo and verified in-sandbox via TypeScript transpile, the package's own validators/self-tests, and config/JSON parse checks. Heavy build steps that need the full toolchain (`turbo build`, Tailwind/PostCSS build, `vitest`, Storybook visual regression) were **not** run here — see "Run in CI" at the end.

---

## ✅ Applied & verified

### 1. Token integrity — completed ramps + de-hexed semantic layer
- Added missing primitive steps: `purple` 100/200/400/**800**/**900**, `gray` 300/600/700/800, `slate` 200/**300**/400/600, `red` **300**, `blue` **300**.
- Replaced every raw hex in the semantic layer with primitive references (`#5B21B6`→`purple[800]`, `#4C1D95`→`purple[900]`, `#CBD5E1`→`slate[300]`, `#FCA5A5`→`red[300]`, `#7DD3FC`→`blue[300]`, `focusRing`).
- **Result:** raw hex below the primitive layer = **0**; the DS now obeys its own `no-hardcoded-hex` rule. The 5 added primitives equal the exact values previously inlined ⇒ **zero rendered-colour change**.
- Snapshots regenerated: token-variable (371), token-alias (127), public-api (337) — all pass.
- Files: `packages/typescript/ui/src/tokens.ts`, `snapshots/*.json`.

### 2. Lint fence expanded (non-breaking)
- ESLint plugin gains 3 rules: `no-raw-form-controls` (select/textarea/dialog→Select/Textarea/Modal), `no-raw-color-functions` (rgb()/hsl()), `no-tailwind-default-color` (Tailwind default-palette utilities). The two existing **error** rules are unchanged.
- Shipped at **warn** in the recommended config and wired into **all 9** app eslint configs (apps' `eslint` scripts have no `--max-warnings`, so CI stays green).
- Self-test updated and passing; all 9 configs parse.
- Added **Stylelint** config (`.stylelintrc.cjs`) to fence the `.css` layer (bans raw hex/named/rgb-hsl outside the generated token CSS).
- Files: `packages/typescript/ui/eslint/index.cjs`, `eslint/rules.test.mjs`, `apps/*/eslint.config.mjs`, `.stylelintrc.cjs`.

### 3. Operational base
- `@letbuyy/ui` → **1.0.0**; added `files` + `publishConfig` (dist-based `main`/`types`/`exports`); `tsconfig.dist.json` now emits declarations + maps; `prepublishOnly: npm run build`.
- **changesets** initialized: `.changeset/config.json`, `README.md`, and a `major` changeset describing 1.0.0.
- **Migrator CLI**: `codemods/cli.mjs` (`--list`, `<codemod> <path> [--dry]`) + `migrate` npm script.
- Files: `packages/typescript/ui/package.json`, `tsconfig.dist.json`, `.changeset/*`, `codemods/cli.mjs`.

### 4. Cross-platform — mobile drift killed
- New canonical source `packages/typescript/ui/src/mobile-tokens.ts` (brand + status **reference the shared web primitives**, so they can't drift; mobile-specific surfaces declared once).
- New generator `scripts/generators/generate-mobile-tokens.mjs` emits the Dart file; **regenerated** `apps/mobile/.../letbuyy_color_tokens.dart` (now `GENERATED — DO NOT EDIT`).
- Verified the regenerated values are **identical** to the previous hand-file (29 colours, 13 spacing) ⇒ no Flutter break, no mobile visual change.
- Added a `--check` **drift gate** (CI fails if the Dart file is stale) + `generate:mobile-tokens` script.

### 5. Shared Tailwind layer (additive)
- New `config/tailwind/letbuyy-tokens.css`: design-system **breakpoints** (xs/mobile/sm/md/lg/xl) + **theme-aware token utilities** (`bg-surface`, `text-default`, `text-subdued`, `border-line`, `bg-primary`, …) mapped to `--lb-*`.
- Purely additive (does **not** override Tailwind's palette ⇒ existing classes unaffected). Wired via `@import` into **all 9** `globals.css` (paths verified to resolve; Tailwind import intact).

### 6. Overlays — portals + scroll-lock
- New `useScrollLock` hook + `OverlayPortal` (SSR-safe `createPortal` to `document.body`).
- **Modal** and **Drawer** now render through the portal and lock body scroll while open (fixes clipping inside `overflow:hidden`/transformed ancestors and stacking-context z-index fights). Focus-return + background `inert` already existed in `useFocusTrap`.
- Files: `packages/typescript/ui/src/overlay-hooks.ts`, `overlays.tsx`.

### 7. Call-site codemod (built, tested, scoped)
- New `codemods/tailwind-default-color-to-token.cjs` (conservative gray-neutral + `bg-white` → token utilities; word-boundary safe) with input/output fixtures, registered in `dry-run.mjs` (**7 fixtures pass**) and the migrator CLI.
- **Dry run across apps:** would change **22 files** of 623 scanned (the high-confidence neutrals; slate/coloured/white-black deliberately left for review).

**Verification summary:** eslint self-test ✅ · codemod dry-run 7/7 ✅ · 3 token validators ✅ · TS syntax on all edited sources ✅ · mobile drift `--check` ✅ · 9/9 eslint configs parse ✅ · 9/9 globals wired ✅ · JSON valid @ v1.0.0 ✅ · raw hex below primitive = 0 ✅.

---

## ✅ Round 2 — the four QA-gated items, now applied end-to-end

All four were applied with techniques chosen to be **safe-by-construction** (value-equivalent in light mode, build-independent, behaviour-preserving) and verified by TS transpile + the package self-tests. Final divergence scan: raw `<select|textarea|button|input|table>` = **0**, `bg-white` = **0**, hex-in-TSX = **0**, raw hex below the primitive layer = **0**.

1. **Tailwind codemod — APPLIED to 22 files.** Rewrote the codemod to emit **arbitrary-value token utilities** (`bg-[var(--lb-color-surface)]`, `text-[color:var(--lb-color-text)]`, `border-[var(--lb-color-border)]`, …) — the exact pattern the DS already uses — so it does **not** depend on the Tailwind preset compiling. Light-mode values are identical; dark mode is fixed. `bg-white` 56→0; mapped gray neutrals →0. All 22 files parse clean. (`text-white`/`bg-black`/`slate-*` left intentionally — correct inverse/scrim/surface intent.)
2. **`globals.css` consolidation — APPLIED (value-verified, 25 definitions).** A script converted legacy `--primary`/`--success`/`--border`/… definitions to `var(--lb-*)` **only when the raw value byte-for-byte equals the token's value** (guaranteed zero render change), skipping app-specific/dark-first values. Converted: merchant 14, identity 6, marketing 5; raw-colour defs dropped (MCP 36→22, ID 24→18, MKT 56→51). Braces balanced. Remaining raw colours are genuine per-app theme values (Stylelint flags them for design review).
3. **Raw form controls — MIGRATED (all 12).** Added an `unstyled` escape hatch to `Textarea` and `Select` (mirroring `Input`), then converted every raw `<select>`/`<textarea>` (5 files) to `<Select unstyled options={…}>` / `<Textarea unstyled>` preserving each element's existing `className`, `name`, `required`, `value`, and `onChange` → **native form submission + handlers + styling unchanged**, zero remaining. Public-API snapshot unchanged.
4. **Dropdown/Popover — PORTALED (no dependency added).** Added `useAnchoredPosition` (fixed positioning from the trigger rect, updated on scroll/resize) and a `secondaryRef` on `useDismiss` so a portaled menu still counts as "inside" for outside-click dismissal. Both now render through `OverlayPortal` to `document.body` (can't be clipped by `overflow:hidden`/transform ancestors); keyboard nav and focus are unchanged. No Floating UI dependency required.

### ▶ Still worth a one-time runtime/visual confirmation (no code blockers)
- Run each app's **Tailwind/PostCSS build + a dark-mode glance** at the 22 codemod'd files and the migrated forms (mechanically safe; just unviewable from here).
- **Keyboard/click QA of Dropdown/Popover** in one app (open/dismiss/arrow-keys/scroll) — the positioning is rect-based without viewport-collision flipping; if edge cases appear, a positioning lib can be layered in later behind the same API.

## ▶ Run in CI (not executed in this sandbox)
`pnpm install` → `pnpm --filter @letbuyy/ui build` (dist + d.ts) · the Tailwind/PostCSS build per app (confirms preset utilities generate) · `pnpm --filter @letbuyy/ui test` (vitest) · `node scripts/generators/generate-mobile-tokens.mjs --check` · `npx changeset version`. Recommended new CI gates: the mobile drift `--check`, the eslint rule self-test, and a `changeset`-required check on `packages/typescript/ui/**`.

---

*Companion analysis:* `LETBUYY_PLATFORM_DESIGN_SYSTEM_MASTER_REPORT.md` and the Phase docs. This log covers the P0 execution from `LETBUYY_UI_FOUNDATION_IMPLEMENTATION_PLAN.md`.
