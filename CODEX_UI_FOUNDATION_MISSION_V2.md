# CODEX UI-FOUNDATION MISSION — V2 (Adoption → 1.0 → U9 Capabilities)

**Supersedes/extends:** `CODEX_UI_FOUNDATION_HARDENING_MISSION.md` (V1 — phases U0–U8, **DONE** on branch `stream/letbuyy-ui-foundation`, verified: 141→211 exports with 0 removed, 0 token vars removed, scope-clean, 9 commits). This V2 consumes V1's authored codemods/eslint-rule/deprecations and finishes the job V1 deliberately deferred to humans.
**Issue source of truth:** `docs/LETBUYY_UI_SYSTEM_MASTER_AUDIT.md` + `docs/ui-system-audit/*` + V1's `CODEX_UI_FOUNDATION_STATUS.md` "SKIPPED — NEEDS HUMAN" list (every item there is now authorized).
**Driver:** GPT‑5.x in Codex — `high` for the brand/token change, codemod execution, RTL, Form/Chart primitives; `medium` for mechanical migration + docs.
**Mode:** Continuous, autonomous. Run until every unblocked task is DONE or `[SKIP — NEEDS HUMAN]`. Never stop while unblocked work remains.

## DECISIONS (baked in — do not re-litigate)
1. **Brand = purple primary.** The light-mode primary CTA becomes the brand purple ramp (it already is in dark mode). Resolve audit finding C‑1 in favor of brand consistency. Pick the purple shade whose white label text passes **WCAG AA ≥4.5:1** (e.g. `purple[700]` `#6D28D9` ≈ 4.9:1 for the CTA bg; keep `#8B5CF6` for accents/fills/focus). This is an **intended product-wide visual change** to ~218 primary buttons — capture a before/after visual diff for sign-off, then proceed.
2. **Both, sequenced.** Run **Stream A (adoption + 1.0)** to completion, then **Stream B (U9 capabilities)**.
3. **Reach = all three, layered.** Ship an **India-first purple house brand as the default**, AND build **multi-brand white-label** machinery (per-surface + per-merchant palettes with contrast guardrails), AND build the **global layer** (RTL/bidi + multi-currency/i18n). Default visuals = India-purple; the other two are opt-in capabilities.
4. **Add all four:** Form system, charting library, Table virtualization, hosted docs site.

---

## 0. PRIME DIRECTIVE

V1 made `@letbuyy/ui` correct, complete-enough, and safe — **additively**, breaking nothing. But it could only go ~halfway to "the single foundation" because the high-value finishers were cross-app or design-gated: the system is still bypassed (282 raw `<button>`, 138 raw `<input>`, 417 hex), the duplicates still ship, dark mode/brand are unresolved, and the package still distributes raw `src`.

**Your job in V2:** finish the foundation for real.
- **Stream A** flips the system from "available" to "**enforced and adopted**": apply the brand decision, run V1's codemods across all consumers, enable the lint fence, remove the deprecated/duplicate surface, repoint to `dist`, and cut **`@letbuyy/ui` 1.0**.
- **Stream B** makes it **best-in-class**: real white-label theming, global/RTL/i18n, a Form system, a charting library, Table virtualization, and a published docs site.

**Honesty + evidence laws from V1 still apply.** Every `DONE` carries command evidence; nothing faked; every consumer build stays green; every issue ends DONE or `[SKIP — NEEDS HUMAN]`.

**SUCCESS = COMPLETE only when:**
1. Light + dark primary CTA both render the brand purple ramp, AA-compliant; before/after visual diff recorded and signed off.
2. **Zero raw `<button>`/`<input>`/`<table>` and zero hardcoded hex remain in `apps/**`** (eslint rule errors, not warns); all V1 codemods applied; deprecated exports + token aliases removed; `DataTable`/`TextStyle`/`PageShell`/`PageActions`/`TableFilterBar` gone; one `Table`, one `Text`.
3. `@letbuyy/ui` ships a built `dist` (ESM + d.ts); `main`/`types` → `dist`; `validate:ui` folded into root `validate-governance`; CODEOWNERS set; repository intelligence regenerated; **`@letbuyy/ui@1.0.0`** tagged with CHANGELOG.
4. White-label real: per-surface palettes + per-merchant `brand` + a contrast guardrail that blocks/auto-adjusts inaccessible brand colors; demoed on ≥2 surfaces.
5. Global real: full RTL/bidi pass (logical properties) + RTL visual baselines; multi-currency/locale formatting layer (INR default preserved).
6. New primitives shipped, tested, axe-clean, storied, visual-baselined: **Form system** (Form/Field/validation), **Chart** on a real library (old `Chart` API preserved via shim), **Table virtualization**, and a **hosted/published docs site**.
7. All repo gates green on real evidence; every V1 SKIP + every V2 capability ends DONE or `[SKIP — NEEDS HUMAN]`.

---

## 1. SCOPE, OWNERSHIP & SEQUENCING

**This mission is NOT parallel-safe with the broad `CODEX_FOUNDATION_HARDENING_*` stream, because Stream A edits `apps/**`.** Therefore:

**PRECONDITION GATE (must be true before any Stream A work):**
- The broad `stream/letbuyy-foundation-v2` mission is merged to `develop`.
- The V1 UI branch `stream/letbuyy-ui-foundation` is merged to `develop`.
- You run on a fresh `stream/letbuyy-ui-v2` off the post-merge `develop`, **serially** (no other mission writing concurrently). If either prereq is unmet, **stop and record `[BLOCKED — merge prerequisites]`** — do not start Stream A.

**Ledger:** continue V1's files — append a `## V2` section to `CODEX_UI_FOUNDATION_LEDGER.md` and `CODEX_UI_FOUNDATION_STATUS.md`. New capability IDs `V2‑A*`/`V2‑B*`.

**Write scope:**
- **Stream A:** repo-wide, but **minimize app edits to migration only** (codemod output, lint-fix to components/tokens, the one marketing-site wrapper). No business-logic changes in apps. Each app touched in its own commit (`refactor(<app>): adopt @letbuyy/ui`).
- **Stream B:** `packages/typescript/ui/**` only (additive), plus a docs target (`packages/typescript/ui/docs` or an approved `apps/design-docs` if a runtime is authorized — else publish static Storybook).

**Laws (carried from V1):** Green Law (tree green every commit; `validate-governance` ≥ baseline at every gate), Honesty Law, Real-Evidence Law (RTL + jest-axe + Storybook visual diff; no mock as proof), small reversible increments, anti-thrash (3 tries → BLOCKED), no fabrication, respect `AGENTS.md`/package `AGENTS.md`/`docs/governance/`, regenerate repository intelligence on package change.

---

## 2. STREAM A — ADOPTION, BRAND, 1.0 (run first, to completion)

### A1 — Apply the brand decision (purple primary) — *audit C‑1*
- In `tokens.ts`, set light `semantic.*.button.primary` to the brand purple ramp (bg = AA-safe purple e.g. `#6D28D9`, hover/active darker, text white, border = bg); keep dark as-is or align. Keep `#8B5CF6` for accents/focus/fills. Verify white-on-CTA ≥ 4.5:1 and active-state ≥ 3:1.
- Refresh UI token snapshot (additive/value-change recorded), refresh visual baselines as an **intended** change; export a before/after contact sheet of the primary button across light/dark × density for sign-off.
- _DoD: light + dark primary = brand purple, AA-proven; visual diff captured + recorded; snapshots refreshed._

### A2 — Run V1 codemods across all consumers — *issues #19, #41, #49–#51, #59, #60, #64*
- Execute, app-by-app, the V1 codemods in `packages/typescript/ui/codemods`: `DataTable`/`IndexTable`→`Table`, `TextStyle`→`Text`, `Badge danger`→`critical`, page-alias→canonical, token-alias rename. Inspect each diff; run that app's typecheck/build after.
- _DoD: no consumer imports `DataTable`/`TextStyle`/`PageShell`/`PageActions`/`TableFilterBar` or `Badge variant="danger"` or aliased token vars; each app builds green; commit per app._

### A3 — Enable the lint fence + migrate the bypass — *issues #26, #27, #28, #43 (the big one)*
- Wire `packages/typescript/ui/eslint` as the `@letbuyy/ui` plugin in every app's lint config; turn on `no-raw-elements` + `no-hardcoded-hex` at **error**.
- Migrate every violation: raw `<button>`→`Button`, raw `<input>`/`<checkbox>`→`Input`/`Checkbox`/`Radio`, raw `<table>`→`Table`, hex→token. Use the rule's autofix hints; hand-fix the rest. Target the audit's 282/138/417.
- _DoD: `pnpm lint` passes with the rules at error and **0 disable-comments added** without a recorded justification; raw-element/hex counts in `apps/**` are 0 (or a tiny recorded allowlist with reasons)._

### A4 — Fix marketing-site token root — *issue #9*
- Wrap the marketing-site root layout in `<DesignSystemRoot surface="storefront" theme="auto">`. Verify components now render with tokens.
- _DoD: marketing-site renders themed; typecheck/build green._

### A5 — Remove the deprecated/duplicate surface + collapse aliases — *issues #49–#51, #60, #64, #82, #85, token C‑2*
- Now that A2/A3 removed all consumers: delete the deprecated exports (`DataTable`, `IndexTable` legacy, `TextStyle`, `PageShell`, `PageActions`, `TableFilterBar`, root preview re-exports), collapse the token aliases in `tokens.ts` to canonical names, remove the empty `apps/storefront-runtime/src/components/ui`.
- Update the public-API + token snapshots to the **reduced** canonical set (this is the one place removals are allowed — guarded because all consumers are migrated).
- _DoD: one `Table`, one `Text`, canonical token names only; snapshots updated; repo typecheck/build green proving no consumer referenced the removed surface._

### A6 — Distribution + governance + 1.0 — *issues #17, #18, #40, #42, #16(CI)*
- Repoint `@letbuyy/ui` `main`/`types` → `dist`; ensure consumers resolve the built output; keep `build` network-free.
- Fold the three `validate:ui` validators into root `validate-governance.mjs` (add them as registered validators); add root `CODEOWNERS` (`packages/typescript/ui/** → design-system maintainers`).
- Wire the Storybook visual-regression + UI test suite as **CI gates** (not just local); regenerate repository intelligence.
- Cut **`@letbuyy/ui@1.0.0`** with a finalized CHANGELOG; freeze the stable-tier API.
- _DoD: dist-distributed; root governance includes UI validators; CODEOWNERS set; visual + test gates run in CI; 1.0 tagged; all green._

**GATE A (the "it is now THE foundation" gate):** brand purple shipped; 0 bypass in apps; 0 deprecated/duplicate exports; dist + 1.0 + CI gates + CODEOWNERS; every app builds green; `validate-governance` ≥ baseline.

---

## 3. STREAM B — U9 NEW CAPABILITIES (after Gate A; UI-package additive)

### B1 — Multi-brand white-label — *issues #24, #25, #50; THEMING_AUDIT TH‑4/TH‑5*
- Make `data-letbuyy-surface` real: per-surface palette overrides for `admin/marketplace/storefront/identity/operations` (default still India-purple identity).
- Make `brand`/`createTheme({brand})` rewrite the full primary ramp + focus + CTA from a single input; persist per-merchant.
- Ship a **contrast guardrail** that validates a brand color and **blocks or auto-adjusts** inaccessible choices (extend V1's `validateLetbuyyBrandContrast`). Demo on ≥2 surfaces with screenshots.
- _DoD: a surface and a merchant brand both restyle via one input, AA-guaranteed; default unchanged; tested + visual-baselined._

### B2 — Global: RTL/bidi + i18n/multi-currency — *RESPONSIVE/THEMING gaps; new*
- RTL: convert physical Tailwind utilities to logical properties (`ms/me/ps/pe`, `start/end`), honor `dir`, add RTL Storybook globals + **RTL visual baselines** for every component.
- i18n/currency: a locale-aware formatting layer (multi-currency/number/date) with **INR default preserved**; `formatInrCurrency` kept; add `formatCurrency(locale, currency)`.
- _DoD: every component verified in RTL (visual baselines) and LTR; multi-currency/locale formatting works; India default unchanged; tested._

### B3 — Form system — *V2 §3; biggest adoption lever*
- Add `Form`, `Field`, `useForm`/validation (schema-resolver friendly — e.g. zod adapter), error summary, submit/loading/disabled orchestration, composing existing Input/Select/Checkbox/Radio/Switch/Combobox/NumberField.
- _DoD: a multi-field validated form builds from the primitives; a11y error association proven; tested + storied + visual-baselined; exported additively._

### B4 — Charting library — *issue #97; bundle policy*
- Replace the hand-rolled SVG `Chart` internals with a proven library (tree-shakeable; record the bundle delta against a budget). **Preserve the existing `Chart` public API** via a shim so no consumer breaks; keep the sr-only data table.
- _DoD: `Chart` renders via the library with identical/》 API; bundle delta recorded within budget; a11y preserved; tested + visual-baselined._

### B5 — Table virtualization — *new; scale*
- Add windowed rendering to the unified `Table` for large datasets (opt-in `virtualized` or auto over a row threshold), preserving selection/sort/sticky-header/responsive-cards.
- _DoD: Table renders thousands of rows smoothly; features intact; tested; perf note recorded._

### B6 — Hosted docs site — *issue #95; adoption*
- Publish a versioned docs/Storybook site: every component with usage, do/don't, props, a11y notes, the API style guide, and a live theme/brand/surface/density playground. Wire to deploy (or produce the static build + the exact deploy command as `[SKIP — NEEDS HUMAN: hosting]`).
- _DoD: docs site builds with full coverage + playground; deployed or deploy-ready with recorded command._

### B7 — Component depth (as capacity allows) — *V2 backlog*
- Add high-demand primitives if green: `Stepper/Wizard`, `FileUpload/Dropzone`, visual `Calendar`/date-range picker, `Tag input`, `Toast actions`. Ship what lands green; record the rest as `[SKIP]`.
- _DoD: shipped primitives tested+storied+exported; remainder recorded._

**GATE B:** white-label + RTL/i18n real; Form/Chart-lib/virtualization/docs shipped, tested, axe-clean, visual-baselined; no consumer breakage; `validate-governance` ≥ baseline.

---

## 4. TRACEABILITY (every item ends DONE or SKIP)
Carry V1's matrix; add V2 rows. Map: the 20 V1 "SKIPPED — NEEDS HUMAN" items → A1–A6 (all now authorized except external hosting/credentials). New capabilities → B1–B7. The brand/visual sign-off is the only human checkpoint inside Stream A and is a *review*, not a blocker — capture the diff, proceed, flag for sign-off.

## 5. FINAL GATE (COMPLETE only when all true)
- `pnpm turbo typecheck` / `pnpm lint` (rules at **error**) / `pnpm turbo build` (no network) / `pnpm turbo test` — all PASS repo-wide
- `node scripts/validate-governance.mjs` — all-green, includes the folded UI validators
- Visual regression (incl. **RTL baselines**) green in CI; intended diffs = brand + new components only
- **Adoption proof:** 0 raw `<button>`/`<input>`/`<table>` + 0 hardcoded hex in `apps/**`; 0 deprecated/duplicate exports remain
- `@letbuyy/ui@1.0.0` dist-distributed; CODEOWNERS + CHANGELOG present
- White-label demoed on ≥2 surfaces with AA guardrail; multi-currency/RTL proven; Form/Chart-lib/virtualization/docs shipped
- Ledger: every V1‑SKIP + every `V2‑A*`/`V2‑B*` is DONE or SKIPPED — NEEDS HUMAN with evidence; STATUS summarizes remainders + exact commands

Mark COMPLETE only if `@letbuyy/ui` is now **the enforced, adopted, 1.0, brand-coherent, white-label-capable, global-ready foundation** — correct, complete, safe, honest — with raw-element bypass eliminated and the new capabilities real.

## 6. HOW TO START
1. Confirm both prerequisite branches are merged to `develop`; else `[BLOCKED — merge prerequisites]` and stop.
2. `git checkout develop && git pull && git checkout -b stream/letbuyy-ui-v2`; record the `validate-governance` baseline.
3. Append `## V2` to the V1 ledger/status. Begin **A1**. Run Stream A fully (Gate A) before any Stream B task.
